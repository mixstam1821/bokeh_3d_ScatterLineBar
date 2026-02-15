// Line3D.ts - 3D line plot with color mapping and tooltips
import * as p from "core/properties"
import {LayoutDOM, LayoutDOMView} from "models/layouts/layout_dom"
import {div} from "core/dom"
import {getPalette, valueToColor, getValueRange} from "./palettes"

export class Line3DView extends LayoutDOMView {
  declare model: Line3D
  private container_el?: HTMLDivElement
  private canvas?: HTMLCanvasElement
  private ctx?: CanvasRenderingContext2D
  private colorbar_canvas?: HTMLCanvasElement
  private colorbar_ctx?: CanvasRenderingContext2D
  private tooltip_el?: HTMLDivElement
  private mouse_x: number = 0
  private mouse_y: number = 0
  private is_dragging: boolean = false
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
    this.connect(this.model.properties.azimuth.change, () => this.render_lines())
    this.connect(this.model.properties.elevation.change, () => this.render_lines())
    this.connect(this.model.properties.zoom.change, () => this.render_lines())
    this.connect(this.model.properties.palette.change, () => {
      this.render_lines()
      this.render_colorbar()
    })
    this.connect(this.model.properties.background_color.change, () => {
      if (this.container_el) {
        this.container_el.style.background = this.model.background_color
      }
      this.render_lines()
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
    this.ctx = this.canvas.getContext('2d')!
    this.render_lines()
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
    const {vmin, vmax} = getValueRange(this.model.colors, this.model.vmin, this.model.vmax)
    
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
      
      const label = value.toFixed(2)
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

  private render_lines(): void {
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
    const z_data = this.model.z
    const colors = this.model.colors
    
    if (x_data.length === 0) return
    
    // Calculate bounds
    const data_x_min = Math.min(...x_data)
    const data_x_max = Math.max(...x_data)
    const data_y_min = Math.min(...y_data)
    const data_y_max = Math.max(...y_data)
    const data_z_min = Math.min(...z_data)
    const data_z_max = Math.max(...z_data)
    
    const data_range = Math.max(
      data_x_max - data_x_min,
      data_y_max - data_y_min,
      data_z_max - data_z_min
    )
    
    const scale = (Math.min(width, height) / data_range) * 0.6 * zoom
    const cx = width / 2
    const cy = height / 2
    
    const data_center_x = (data_x_min + data_x_max) / 2
    const data_center_y = (data_y_min + data_y_max) / 2
    const data_center_z = (data_z_min + data_z_max) / 2
    
    const center_x_rot = data_center_x * Math.cos(azim_rad) - data_center_y * Math.sin(azim_rad)
    const center_y_rot = data_center_x * Math.sin(azim_rad) + data_center_y * Math.cos(azim_rad)
    const center_x_proj = center_x_rot
    const center_z_proj = center_y_rot * Math.sin(elev_rad) + data_center_z * Math.cos(elev_rad)
    
    // Get palette
    const palette = getPalette(this.model.palette)
    const {vmin, vmax} = getValueRange(colors, this.model.vmin, this.model.vmax)
    
    // Draw line segments
    for (let i = 0; i < x_data.length - 1; i++) {
      const x1 = x_data[i]
      const y1 = y_data[i]
      const z1 = z_data[i]
      
      const x2 = x_data[i + 1]
      const y2 = y_data[i + 1]
      const z2 = z_data[i + 1]
      
      // Project both points
      const x1_rot = x1 * Math.cos(azim_rad) - y1 * Math.sin(azim_rad)
      const y1_rot = x1 * Math.sin(azim_rad) + y1 * Math.cos(azim_rad)
      const x1_proj = x1_rot
      const z1_proj = y1_rot * Math.sin(elev_rad) + z1 * Math.cos(elev_rad)
      
      const x2_rot = x2 * Math.cos(azim_rad) - y2 * Math.sin(azim_rad)
      const y2_rot = x2 * Math.sin(azim_rad) + y2 * Math.cos(azim_rad)
      const x2_proj = x2_rot
      const z2_proj = y2_rot * Math.sin(elev_rad) + z2 * Math.cos(elev_rad)
      
      const screen_x1 = cx + (x1_proj - center_x_proj) * scale
      const screen_y1 = cy - (z1_proj - center_z_proj) * scale
      const screen_x2 = cx + (x2_proj - center_x_proj) * scale
      const screen_y2 = cy - (z2_proj - center_z_proj) * scale
      
      // Color based on segment midpoint or start point
      const color_value = colors.length > 0 ? colors[i] : 0
      const color = valueToColor(color_value, palette, vmin, vmax, this.model.nan_color)
      
      ctx.strokeStyle = color
      ctx.lineWidth = this.model.line_width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      
      ctx.beginPath()
      ctx.moveTo(screen_x1, screen_y1)
      ctx.lineTo(screen_x2, screen_y2)
      ctx.stroke()
      
      // Optionally draw markers at points
      if (this.model.show_markers) {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(screen_x1, screen_y1, this.model.marker_size, 0, 2 * Math.PI)
        ctx.fill()
        
        // Last point
        if (i === x_data.length - 2) {
          ctx.beginPath()
          ctx.arc(screen_x2, screen_y2, this.model.marker_size, 0, 2 * Math.PI)
          ctx.fill()
        }
      }
    }
  }

  private update_tooltip(): void {
    if (!this.tooltip_el || !this.canvas) return
    
    const elev_rad = this.model.elevation * Math.PI / 180
    const azim_rad = this.model.azimuth * Math.PI / 180
    const zoom = this.model.zoom
    const x_data = this.model.x
    const y_data = this.model.y
    const z_data = this.model.z
    const colors = this.model.colors
    
    if (x_data.length === 0) return
    
    const width = this.canvas.width
    const height = this.canvas.height
    
    // Calculate projection parameters
    const data_x_min = Math.min(...x_data)
    const data_x_max = Math.max(...x_data)
    const data_y_min = Math.min(...y_data)
    const data_y_max = Math.max(...y_data)
    const data_z_min = Math.min(...z_data)
    const data_z_max = Math.max(...z_data)
    
    const data_range = Math.max(
      data_x_max - data_x_min,
      data_y_max - data_y_min,
      data_z_max - data_z_min
    )
    
    const scale = (Math.min(width, height) / data_range) * 0.6 * zoom
    const cx = width / 2
    const cy = height / 2
    
    const data_center_x = (data_x_min + data_x_max) / 2
    const data_center_y = (data_y_min + data_y_max) / 2
    const data_center_z = (data_z_min + data_z_max) / 2
    
    const center_x_rot = data_center_x * Math.cos(azim_rad) - data_center_y * Math.sin(azim_rad)
    const center_y_rot = data_center_x * Math.sin(azim_rad) + data_center_y * Math.cos(azim_rad)
    const center_x_proj = center_x_rot
    const center_z_proj = center_y_rot * Math.sin(elev_rad) + data_center_z * Math.cos(elev_rad)
    
    // Find closest point on the line
    let closest_idx = -1
    let min_dist = Infinity
    
    for (let i = 0; i < x_data.length; i++) {
      const x = x_data[i]
      const y = y_data[i]
      const z = z_data[i]
      
      const x_rot = x * Math.cos(azim_rad) - y * Math.sin(azim_rad)
      const y_rot = x * Math.sin(azim_rad) + y * Math.cos(azim_rad)
      const x_proj = x_rot
      const z_proj = y_rot * Math.sin(elev_rad) + z * Math.cos(elev_rad)
      
      const screen_x = cx + (x_proj - center_x_proj) * scale
      const screen_y = cy - (z_proj - center_z_proj) * scale
      
      const dist = Math.sqrt((screen_x - this.mouse_x) ** 2 + (screen_y - this.mouse_y) ** 2)
      
      const threshold = this.model.show_markers ? this.model.marker_size + 5 : this.model.line_width + 5
      
      if (dist < threshold && dist < min_dist) {
        min_dist = dist
        closest_idx = i
      }
    }
    
    if (closest_idx >= 0) {
      let tooltip_html = `<b>Point ${closest_idx}</b><br>`
      tooltip_html += `X: ${x_data[closest_idx].toFixed(2)}<br>`
      tooltip_html += `Y: ${y_data[closest_idx].toFixed(2)}<br>`
      tooltip_html += `Z: ${z_data[closest_idx].toFixed(2)}`
      
      if (colors.length > 0) {
        tooltip_html += `<br>Value: ${colors[closest_idx].toFixed(2)}`
      }
      
      this.tooltip_el.innerHTML = tooltip_html
      this.tooltip_el.style.display = 'block'
      this.tooltip_el.style.left = `${this.mouse_x + 15}px`
      this.tooltip_el.style.top = `${this.mouse_y - 30}px`
    } else {
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

export namespace Line3D {
  export type Attrs = p.AttrsOf<Props>
  export type Props = LayoutDOM.Props & {
    x: p.Property<number[]>
    y: p.Property<number[]>
    z: p.Property<number[]>
    colors: p.Property<number[]>
    palette: p.Property<string>
    vmin: p.Property<number>
    vmax: p.Property<number>
    nan_color: p.Property<string>
    line_width: p.Property<number>
    show_markers: p.Property<boolean>
    marker_size: p.Property<number>
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

export interface Line3D extends Line3D.Attrs {}

export class Line3D extends LayoutDOM {
  declare properties: Line3D.Props
  declare __view_type__: Line3DView

  constructor(attrs?: Partial<Line3D.Attrs>) {
    super(attrs)
  }

  static {
    this.prototype.default_view = Line3DView
    this.define<Line3D.Props>(({Bool, Float, List, String}) => ({
      x: [ List(Float), [] ],
      y: [ List(Float), [] ],
      z: [ List(Float), [] ],
      colors: [ List(Float), [] ],
      palette: [ String, 'Viridis256' ],
      vmin: [ Float, NaN ],
      vmax: [ Float, NaN ],
      nan_color: [ String, '#808080' ],
      line_width: [ Float, 2.0 ],
      show_markers: [ Bool, false ],
      marker_size: [ Float, 3.0 ],
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
