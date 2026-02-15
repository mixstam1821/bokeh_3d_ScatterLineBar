// Bar3D.ts - 3D bar chart with color mapping, tooltips, and colorbar
import * as p from "core/properties"
import {LayoutDOM, LayoutDOMView} from "models/layouts/layout_dom"
import {div} from "core/dom"
import {getPalette, valueToColor, getValueRange} from "./palettes"

interface Bar3DProjected {
  corners: Array<{x: number, y: number}>
  depth: number
  value: number
  index: number
  face: string
}

export class Bar3DView extends LayoutDOMView {
  declare model: Bar3D
  private container_el?: HTMLDivElement
  private canvas?: HTMLCanvasElement
  private ctx?: CanvasRenderingContext2D
  private colorbar_canvas?: HTMLCanvasElement
  private colorbar_ctx?: CanvasRenderingContext2D
  private tooltip_el?: HTMLDivElement
  private mouse_x: number = 0
  private mouse_y: number = 0
  private is_dragging: boolean = false
  // private hovered_bar_index: number = -1
  private bar_screen_positions: Array<{index: number, x_min: number, x_max: number, y_min: number, y_max: number}> = []
  private drag_start_x: number = 0
  private drag_start_y: number = 0
  private drag_start_azimuth: number = 0
  private drag_start_elevation: number = 0
  private animation_id?: number
  private rotation_resume_timeout?: number

  override get child_models(): LayoutDOM[] {
    return []
  }

  override connect_signals(): void {
    super.connect_signals()
    this.connect(this.model.properties.azimuth.change, () => this.render_bars())
    this.connect(this.model.properties.elevation.change, () => this.render_bars())
    this.connect(this.model.properties.zoom.change, () => this.render_bars())
    this.connect(this.model.properties.palette.change, () => {
      this.render_bars()
      this.render_colorbar()
    })
    this.connect(this.model.properties.background_color.change, () => {
      if (this.container_el) {
        this.container_el.style.background = this.model.background_color
      }
      this.render_bars()
      this.render_colorbar()
    })
    this.connect(this.model.properties.autorotate.change, () => {
      if (this.model.autorotate) {
        this.start_autorotation()
      } else {
        this.stop_autorotation()
      }
    })
  }

  override render(): void {
    super.render()
    const width = this.model.width ?? 800
    const height = this.model.height ?? 800
    
    this.container_el = div({style: {
      width: `${width + 140}px`,
      height: `${height}px`,
      background: this.model.background_color,
      position: 'relative',
      display: 'flex',
      cursor: 'grab'
    }})
    
    this.canvas = document.createElement('canvas')
    this.canvas.width = width
    this.canvas.height = height
    this.container_el.appendChild(this.canvas)
    
    if (this.model.show_colorbar) {
      this.colorbar_canvas = document.createElement('canvas')
      this.colorbar_canvas.width = 150
      this.colorbar_canvas.height = height
      this.colorbar_canvas.style.marginLeft = '10px'
      this.container_el.appendChild(this.colorbar_canvas)
      this.colorbar_ctx = this.colorbar_canvas.getContext('2d')!
    }
    
    this.tooltip_el = div({style: {
      position: 'absolute', background: 'rgba(0, 0, 0, 0.85)', color: 'white',
      padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
      fontFamily: 'monospace', pointerEvents: 'none', display: 'none',
      zIndex: '1000', border: '1px solid rgba(255, 255, 255, 0.3)', whiteSpace: 'nowrap'
    }})
    this.container_el.appendChild(this.tooltip_el)
    
    this.setup_interactions()
    this.shadow_el.appendChild(this.container_el)
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!
    this.render_bars()
    this.render_colorbar()
    
    if (this.model.autorotate) {
      this.start_autorotation()
    }
  }

  private render_colorbar(): void {
    if (!this.colorbar_ctx || !this.colorbar_canvas || !this.model.show_colorbar) return
    
    const ctx = this.colorbar_ctx
    const canvas = this.colorbar_canvas
    const width = canvas.width
    const height = canvas.height
    
    ctx.fillStyle = this.model.background_color
    ctx.fillRect(0, 0, width, height)
    
    const palette = getPalette(this.model.palette)
    const {vmin, vmax} = getValueRange(this.model.values, this.model.vmin, this.model.vmax)
    
    const bar_width = 30
    const bar_height = height * 0.7
    const bar_x = 35
    const bar_y = (height - bar_height) / 2
    
    const step = bar_height / palette.length
    for (let i = 0; i < palette.length; i++) {
      ctx.fillStyle = palette[palette.length - 1 - i]
      ctx.fillRect(bar_x, bar_y + i * step, bar_width, step + 1)
    }
    
    ctx.strokeStyle = this.model.colorbar_text_color
    ctx.lineWidth = 1
    ctx.strokeRect(bar_x, bar_y, bar_width, bar_height)
    
    ctx.fillStyle = this.model.colorbar_text_color
    ctx.font = '12px monospace'
    ctx.textAlign = 'left'
    
    const n_ticks = 5
    for (let i = 0; i < n_ticks; i++) {
      const frac = i / (n_ticks - 1)
      const value = vmin + (vmax - vmin) * (1 - frac)
      const y = bar_y + frac * bar_height
      
      ctx.beginPath()
      ctx.moveTo(bar_x + bar_width, y)
      ctx.lineTo(bar_x + bar_width + 5, y)
      ctx.stroke()
      
      const label = value.toFixed(1)
      ctx.fillText(label, bar_x + bar_width + 10, y + 4)
    }
    
    if (this.model.colorbar_title) {
      ctx.save()
      ctx.translate(12, height / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.textAlign = 'center'
      ctx.font = 'bold 13px monospace'
      ctx.fillStyle = this.model.colorbar_text_color
      ctx.fillText(this.model.colorbar_title, 0, 0)
      ctx.restore()
    }
  }

  private setup_interactions(): void {
    if (!this.canvas) return
    
    this.canvas.onmousedown = (e) => {
      this.is_dragging = true
      this.drag_start_x = e.clientX
      this.drag_start_y = e.clientY
      this.drag_start_azimuth = this.model.azimuth
      this.drag_start_elevation = this.model.elevation
      this.container_el!.style.cursor = 'grabbing'
      this.stop_autorotation()
      if (this.rotation_resume_timeout) clearTimeout(this.rotation_resume_timeout)
    }
    
    this.canvas.onmousemove = (e) => {
      const rect = this.canvas!.getBoundingClientRect()
      this.mouse_x = e.clientX - rect.left
      this.mouse_y = e.clientY - rect.top
      
      if (this.is_dragging) {
        const dx = e.clientX - this.drag_start_x
        const dy = e.clientY - this.drag_start_y
        const new_azimuth = this.drag_start_azimuth - dx * 0.5
        this.model.azimuth = ((new_azimuth % 360) + 360) % 360
        const new_elevation = this.drag_start_elevation - dy * 0.5
        this.model.elevation = Math.max(-90, Math.min(90, new_elevation))
      } else if (this.model.enable_hover) {
        this.update_tooltip()
      }
    }
    
    this.canvas.onmouseup = () => {
      this.is_dragging = false
      this.container_el!.style.cursor = 'grab'
      if (this.model.autorotate) {
        if (this.rotation_resume_timeout) clearTimeout(this.rotation_resume_timeout)
        this.rotation_resume_timeout = window.setTimeout(() => {
          this.start_autorotation()
        }, 1000)
      }
    }
    
    this.canvas.onmouseleave = () => {
      this.is_dragging = false
      this.container_el!.style.cursor = 'grab'
      if (this.tooltip_el) this.tooltip_el.style.display = 'none'
    }
    
    this.canvas.onwheel = (e) => {
      e.preventDefault()
      const delta = -Math.sign(e.deltaY) * 0.1
      const new_zoom = this.model.zoom + delta
      this.model.zoom = Math.max(0.5, Math.min(8.0, new_zoom))
    }
  }

  private project_point(x: number, y: number, z: number, azim_rad: number, elev_rad: number): {x: number, y: number, depth: number} {
    const x_rot = x * Math.cos(azim_rad) - y * Math.sin(azim_rad)
    const y_rot = x * Math.sin(azim_rad) + y * Math.cos(azim_rad)
    const x_proj = x_rot
    const z_proj = y_rot * Math.sin(elev_rad) + z * Math.cos(elev_rad)
    const depth = y_rot * Math.cos(elev_rad) - z * Math.sin(elev_rad)
    return {x: x_proj, y: z_proj, depth}
  }

  private render_bars(): void {
    if (!this.ctx || !this.canvas) return
    
    const ctx = this.ctx
    const width = this.canvas.width
    const height = this.canvas.height
    
    ctx.fillStyle = this.model.background_color
    ctx.fillRect(0, 0, width, height)
    
    const elev_rad = this.model.elevation * Math.PI / 180
    const azim_rad = this.model.azimuth * Math.PI / 180
    const zoom = this.model.zoom
    const x_data = this.model.x
    const y_data = this.model.y
    const values = this.model.values
    
    if (x_data.length === 0) return
    
    const bar_width = this.model.bar_width
    const bar_depth = this.model.bar_depth
    
    // Calculate scale
    const data_x_min = Math.min(...x_data)
    const data_x_max = Math.max(...x_data)
    const data_y_min = Math.min(...y_data)
    const data_y_max = Math.max(...y_data)
    const data_z_min = Math.min(0, ...values)
    const data_z_max = Math.max(...values)
    
    const data_range = Math.max(
      data_x_max - data_x_min + bar_width * 2,
      data_y_max - data_y_min + bar_depth * 2,
      data_z_max - data_z_min
    )
    
    const scale = (Math.min(width, height) / data_range) * 0.6 * zoom
    const cx = width / 2
    const cy = height / 2
    
    const data_center_x = (data_x_min + data_x_max) / 2
    const data_center_y = (data_y_min + data_y_max) / 2
    const data_center_z = (data_z_min + data_z_max) / 2
    
    const center_proj = this.project_point(data_center_x, data_center_y, data_center_z, azim_rad, elev_rad)
    
    // Get palette
    const palette = getPalette(this.model.palette)
    const {vmin, vmax} = getValueRange(values, this.model.vmin, this.model.vmax)
    
    // Create bar faces and track screen positions
    const faces: Bar3DProjected[] = []
    this.bar_screen_positions = []
    
    for (let i = 0; i < x_data.length; i++) {
      const x = x_data[i]
      const y = y_data[i]
      const z_base = 0
      const z_top = values[i]
      
      const hw = bar_width / 2
      const hd = bar_depth / 2
      
      // Define 8 corners of the bar
      const corners_3d = [
        {x: x - hw, y: y - hd, z: z_base}, // 0: bottom-left-front
        {x: x + hw, y: y - hd, z: z_base}, // 1: bottom-right-front
        {x: x + hw, y: y + hd, z: z_base}, // 2: bottom-right-back
        {x: x - hw, y: y + hd, z: z_base}, // 3: bottom-left-back
        {x: x - hw, y: y - hd, z: z_top}, // 4: top-left-front
        {x: x + hw, y: y - hd, z: z_top}, // 5: top-right-front
        {x: x + hw, y: y + hd, z: z_top}, // 6: top-right-back
        {x: x - hw, y: y + hd, z: z_top}, // 7: top-left-back
      ]
      
      // Project all corners
      const corners_proj = corners_3d.map(c => {
        const p = this.project_point(c.x, c.y, c.z, azim_rad, elev_rad)
        return {
          x: cx + (p.x - center_proj.x) * scale,
          y: cy - (p.y - center_proj.y) * scale,
          depth: p.depth
        }
      })
      
      // Define 6 faces with their corner indices
      const face_defs = [
        {indices: [4, 5, 6, 7], name: 'top'},
        {indices: [0, 1, 5, 4], name: 'front'},
        {indices: [1, 2, 6, 5], name: 'right'},
        {indices: [2, 3, 7, 6], name: 'back'},
        {indices: [3, 0, 4, 7], name: 'left'},
        {indices: [0, 3, 2, 1], name: 'bottom'},
      ]
      
      // Track bounding box for this bar
      const all_screen_x = corners_proj.map(c => c.x)
      const all_screen_y = corners_proj.map(c => c.y)
      this.bar_screen_positions.push({
        index: i,
        x_min: Math.min(...all_screen_x),
        x_max: Math.max(...all_screen_x),
        y_min: Math.min(...all_screen_y),
        y_max: Math.max(...all_screen_y)
      })
      
      for (const face_def of face_defs) {
        const face_corners = face_def.indices.map(idx => corners_proj[idx])
        const avg_depth = face_corners.reduce((sum, c) => sum + c.depth, 0) / face_corners.length
        
        faces.push({
          corners: face_corners,
          depth: avg_depth,
          value: values[i],
          index: i,
          face: face_def.name
        })
      }
    }
    
    // Sort faces by depth (painter's algorithm)
    faces.sort((a, b) => a.depth - b.depth)
    
    // Draw faces
    for (const face of faces) {
      // Darken side faces slightly for better 3D effect
      let brightness = 1.0
      if (face.face === 'left' || face.face === 'right') brightness = 0.8
      if (face.face === 'front' || face.face === 'back') brightness = 0.9
      if (face.face === 'bottom') brightness = 0.6
      
      const base_color = valueToColor(face.value, palette, vmin, vmax, this.model.nan_color)
      const rgb = this.hex_to_rgb(base_color)
      const darker = `rgb(${Math.floor(rgb.r * brightness)}, ${Math.floor(rgb.g * brightness)}, ${Math.floor(rgb.b * brightness)})`
      
      ctx.fillStyle = darker
      ctx.strokeStyle = this.model.outline_color
      ctx.lineWidth = this.model.outline_width
      
      ctx.beginPath()
      ctx.moveTo(face.corners[0].x, face.corners[0].y)
      for (let i = 1; i < face.corners.length; i++) {
        ctx.lineTo(face.corners[i].x, face.corners[i].y)
      }
      ctx.closePath()
      ctx.fill()
      
      if (this.model.show_outline) {
        ctx.stroke()
      }
    }
  }

  private hex_to_rgb(hex: string): {r: number, g: number, b: number} {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : {r: 0, g: 0, b: 0}
  }

  private update_tooltip(): void {
    if (!this.tooltip_el) return
    
    // Find which bar is hovered
    let found = false
    for (const bar_pos of this.bar_screen_positions) {
      if (this.mouse_x >= bar_pos.x_min && this.mouse_x <= bar_pos.x_max &&
          this.mouse_y >= bar_pos.y_min && this.mouse_y <= bar_pos.y_max) {
        
        const idx = bar_pos.index
        const x_data = this.model.x
        const y_data = this.model.y
        const values = this.model.values
        const labels = this.model.labels
        
        let tooltip_html = `<b>Bar ${idx}</b><br>`
        tooltip_html += `X: ${x_data[idx].toFixed(2)}<br>`
        tooltip_html += `Y: ${y_data[idx].toFixed(2)}<br>`
        tooltip_html += `Value: ${values[idx].toFixed(2)}`
        
        if (labels.length > 0 && labels[idx]) {
          tooltip_html += `<br><b>${labels[idx]}</b>`
        }
        
        this.tooltip_el.innerHTML = tooltip_html
        this.tooltip_el.style.display = 'block'
        this.tooltip_el.style.left = `${this.mouse_x + 15}px`
        this.tooltip_el.style.top = `${this.mouse_y - 30}px`
        found = true
        break
      }
    }
    
    if (!found) {
      this.tooltip_el.style.display = 'none'
    }
  }

  private start_autorotation(): void {
    if (this.animation_id !== undefined) return
    const animate = () => {
      if (!this.model.autorotate || this.is_dragging) return
      this.model.azimuth = (this.model.azimuth + this.model.rotation_speed * 0.5) % 360
      this.animation_id = requestAnimationFrame(animate)
    }
    animate()
  }

  private stop_autorotation(): void {
    if (this.animation_id !== undefined) {
      cancelAnimationFrame(this.animation_id)
      this.animation_id = undefined
    }
  }

  override remove(): void {
    this.stop_autorotation()
    if (this.rotation_resume_timeout) clearTimeout(this.rotation_resume_timeout)
    super.remove()
  }
}

export namespace Bar3D {
  export type Attrs = p.AttrsOf<Props>
  export type Props = LayoutDOM.Props & {
    x: p.Property<number[]>
    y: p.Property<number[]>
    values: p.Property<number[]>
    labels: p.Property<string[]>
    bar_width: p.Property<number>
    bar_depth: p.Property<number>
    palette: p.Property<string>
    vmin: p.Property<number>
    vmax: p.Property<number>
    nan_color: p.Property<string>
    show_outline: p.Property<boolean>
    outline_color: p.Property<string>
    outline_width: p.Property<number>
    azimuth: p.Property<number>
    elevation: p.Property<number>
    zoom: p.Property<number>
    autorotate: p.Property<boolean>
    rotation_speed: p.Property<number>
    enable_hover: p.Property<boolean>
    show_colorbar: p.Property<boolean>
    colorbar_title: p.Property<string>
    background_color: p.Property<string>
    colorbar_text_color: p.Property<string>
  }
}

export interface Bar3D extends Bar3D.Attrs {}

export class Bar3D extends LayoutDOM {
  declare properties: Bar3D.Props
  declare __view_type__: Bar3DView

  constructor(attrs?: Partial<Bar3D.Attrs>) {
    super(attrs)
  }

  static {
    this.prototype.default_view = Bar3DView
    this.define<Bar3D.Props>(({Bool, Float, List, String}) => ({
      x: [ List(Float), [] ],
      y: [ List(Float), [] ],
      values: [ List(Float), [] ],
      labels: [ List(String), [] ],
      bar_width: [ Float, 0.4 ],
      bar_depth: [ Float, 0.4 ],
      palette: [ String, 'Viridis256' ],
      vmin: [ Float, NaN ],
      vmax: [ Float, NaN ],
      nan_color: [ String, '#808080' ],
      show_outline: [ Bool, true ],
      outline_color: [ String, '#000000' ],
      outline_width: [ Float, 0.5 ],
      azimuth: [ Float, 45 ],
      elevation: [ Float, 30 ],
      zoom: [ Float, 1.0 ],
      autorotate: [ Bool, false ],
      rotation_speed: [ Float, 1.0 ],
      enable_hover: [ Bool, true ],
      show_colorbar: [ Bool, true ],
      colorbar_title: [ String, 'Value' ],
      background_color: [ String, '#0a0a0a' ],
      colorbar_text_color: [ String, '#ffffff' ],
    }))
  }
}
