// Scatter3D.ts - 3D scatter plot with size, color, palette, tooltips, and colorbar
import * as p from "core/properties"
import {LayoutDOM, LayoutDOMView} from "models/layouts/layout_dom"
import {div} from "core/dom"
import {getPalette, valueToColor, getValueRange} from "./palettes"

interface Point3DProjected {
  x: number
  y: number
  depth: number
  index: number
}

export class Scatter3DView extends LayoutDOMView {
  declare model: Scatter3D
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
    this.connect(this.model.properties.azimuth.change, () => this.render_scatter())
    this.connect(this.model.properties.elevation.change, () => this.render_scatter())
    this.connect(this.model.properties.zoom.change, () => this.render_scatter())
    this.connect(this.model.properties.palette.change, () => {
      this.render_scatter()
      this.render_colorbar()
    })
    this.connect(this.model.properties.vmin.change, () => this.render_colorbar())
    this.connect(this.model.properties.vmax.change, () => this.render_colorbar())
    this.connect(this.model.properties.background_color.change, () => {
      if (this.container_el) {
        this.container_el.style.background = this.model.background_color
      }
      this.render_scatter()
      this.render_colorbar()
    })
    this.connect(this.model.properties.colorbar_text_color.change, () => this.render_colorbar())
    this.connect(this.model.properties.show_colorbar.change, () => {
      if (this.colorbar_canvas) {
        this.colorbar_canvas.style.display = this.model.show_colorbar ? 'block' : 'none'
      }
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
    
    // Main canvas
    this.canvas = document.createElement('canvas')
    this.canvas.width = width
    this.canvas.height = height
    this.container_el.appendChild(this.canvas)
    
    // Colorbar canvas
    if (this.model.show_colorbar) {
      this.colorbar_canvas = document.createElement('canvas')
      this.colorbar_canvas.width = 150
      this.colorbar_canvas.height = height
      this.colorbar_canvas.style.marginLeft = '10px'
      this.container_el.appendChild(this.colorbar_canvas)
      this.colorbar_ctx = this.colorbar_canvas.getContext('2d')!
    }
    
    // Tooltip
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
    this.render_scatter()
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
    
    // Clear with background color
    ctx.fillStyle = this.model.background_color
    ctx.fillRect(0, 0, width, height)
    
    const palette = getPalette(this.model.palette)
    const {vmin, vmax} = getValueRange(this.model.colors, this.model.vmin, this.model.vmax)
    
    // Colorbar dimensions
    const bar_width = 30
    const bar_height = height * 0.7
    const bar_x = 35
    const bar_y = (height - bar_height) / 2
    
    // Draw color gradient
    const step = bar_height / palette.length
    for (let i = 0; i < palette.length; i++) {
      ctx.fillStyle = palette[palette.length - 1 - i]
      ctx.fillRect(bar_x, bar_y + i * step, bar_width, step + 1)
    }
    
    // Draw border
    ctx.strokeStyle = this.model.colorbar_text_color
    ctx.lineWidth = 1
    ctx.strokeRect(bar_x, bar_y, bar_width, bar_height)
    
    // Draw ticks and labels
    ctx.fillStyle = this.model.colorbar_text_color
    ctx.font = '12px monospace'
    ctx.textAlign = 'left'
    
    const n_ticks = 5
    for (let i = 0; i < n_ticks; i++) {
      const frac = i / (n_ticks - 1)
      const value = vmin + (vmax - vmin) * (1 - frac)
      const y = bar_y + frac * bar_height
      
      // Tick mark
      ctx.beginPath()
      ctx.moveTo(bar_x + bar_width, y)
      ctx.lineTo(bar_x + bar_width + 5, y)
      ctx.stroke()
      
      // Label
      const label = value.toFixed(2)
      ctx.fillText(label, bar_x + bar_width + 10, y + 4)
    }
    
    // Title
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

  private render_scatter(): void {
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
    const sizes = this.model.sizes
    
    if (x_data.length === 0) return
    
    // Project 3D points
    const projected: Point3DProjected[] = []
    for (let i = 0; i < x_data.length; i++) {
      const x = x_data[i]
      const y = y_data[i]
      const z = z_data[i]
      
      const x_rot = x * Math.cos(azim_rad) - y * Math.sin(azim_rad)
      const y_rot = x * Math.sin(azim_rad) + y * Math.cos(azim_rad)
      const x_proj = x_rot
      const z_proj = y_rot * Math.sin(elev_rad) + z * Math.cos(elev_rad)
      const depth = y_rot * Math.cos(elev_rad) - z * Math.sin(elev_rad)
      
      projected.push({ x: x_proj, y: z_proj, depth: depth, index: i })
    }
    
    // Calculate bounds from original data
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
    
    // Center the data
    const data_center_x = (data_x_min + data_x_max) / 2
    const data_center_y = (data_y_min + data_y_max) / 2
    const data_center_z = (data_z_min + data_z_max) / 2
    
    // Project center
    const center_x_rot = data_center_x * Math.cos(azim_rad) - data_center_y * Math.sin(azim_rad)
    const center_y_rot = data_center_x * Math.sin(azim_rad) + data_center_y * Math.cos(azim_rad)
    const center_x_proj = center_x_rot
    const center_z_proj = center_y_rot * Math.sin(elev_rad) + data_center_z * Math.cos(elev_rad)
    
    // Convert to screen coordinates
    const screen_points: Array<{x: number, y: number, depth: number, index: number}> = []
    for (const p of projected) {
      screen_points.push({
        x: cx + (p.x - center_x_proj) * scale,
        y: cy - (p.y - center_z_proj) * scale,
        depth: p.depth,
        index: p.index
      })
    }
    
    // Sort by depth (back to front)
    screen_points.sort((a, b) => a.depth - b.depth)
    
    // Get palette and value range
    const palette = getPalette(this.model.palette)
    const {vmin, vmax} = getValueRange(colors, this.model.vmin, this.model.vmax)
    
    // Determine size range
    const size_min = sizes.length > 0 ? Math.min(...sizes) : this.model.default_size
    const size_max = sizes.length > 0 ? Math.max(...sizes) : this.model.default_size
    
    // Draw points
    for (const point of screen_points) {
      const idx = point.index
      const color_value = colors.length > 0 ? colors[idx] : 0
      const size_value = sizes.length > 0 ? sizes[idx] : this.model.default_size
      
      // Map size to pixel radius
      let radius: number
      if (sizes.length > 0 && size_max > size_min) {
        const size_norm = (size_value - size_min) / (size_max - size_min)
        radius = this.model.min_size + size_norm * (this.model.max_size - this.model.min_size)
      } else {
        radius = this.model.default_size
      }
      
      const color = valueToColor(color_value, palette, vmin, vmax, this.model.nan_color)
      
      // Draw point with outline for better visibility
      ctx.beginPath()
      ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.fill()
      
      // Outline
      if (this.model.show_outline) {
        ctx.strokeStyle = this.model.outline_color
        ctx.lineWidth = this.model.outline_width
        ctx.stroke()
      }
    }
  }

  private update_tooltip(): void {
    if (!this.tooltip_el || !this.canvas || !this.ctx) return
    
    const elev_rad = this.model.elevation * Math.PI / 180
    const azim_rad = this.model.azimuth * Math.PI / 180
    const zoom = this.model.zoom
    const x_data = this.model.x
    const y_data = this.model.y
    const z_data = this.model.z
    const colors = this.model.colors
    const sizes = this.model.sizes
    const labels = this.model.labels
    
    if (x_data.length === 0) return
    
    const width = this.canvas.width
    const height = this.canvas.height
    
    // Project and find closest point
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
      
      const size_value = sizes.length > 0 ? sizes[i] : this.model.default_size
      const size_min = sizes.length > 0 ? Math.min(...sizes) : this.model.default_size
      const size_max = sizes.length > 0 ? Math.max(...sizes) : this.model.default_size
      
      let radius: number
      if (sizes.length > 0 && size_max > size_min) {
        const size_norm = (size_value - size_min) / (size_max - size_min)
        radius = this.model.min_size + size_norm * (this.model.max_size - this.model.min_size)
      } else {
        radius = this.model.default_size
      }
      
      if (dist < radius + 5 && dist < min_dist) {
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
        tooltip_html += `<br>Color: ${colors[closest_idx].toFixed(2)}`
      }
      
      if (sizes.length > 0) {
        tooltip_html += `<br>Size: ${sizes[closest_idx].toFixed(2)}`
      }
      
      if (labels.length > 0 && labels[closest_idx]) {
        tooltip_html += `<br><b>${labels[closest_idx]}</b>`
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

export namespace Scatter3D {
  export type Attrs = p.AttrsOf<Props>
  export type Props = LayoutDOM.Props & {
    x: p.Property<number[]>
    y: p.Property<number[]>
    z: p.Property<number[]>
    colors: p.Property<number[]>
    sizes: p.Property<number[]>
    labels: p.Property<string[]>
    palette: p.Property<string>
    vmin: p.Property<number>
    vmax: p.Property<number>
    nan_color: p.Property<string>
    default_size: p.Property<number>
    min_size: p.Property<number>
    max_size: p.Property<number>
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

export interface Scatter3D extends Scatter3D.Attrs {}

export class Scatter3D extends LayoutDOM {
  declare properties: Scatter3D.Props
  declare __view_type__: Scatter3DView

  constructor(attrs?: Partial<Scatter3D.Attrs>) {
    super(attrs)
  }

  static {
    this.prototype.default_view = Scatter3DView
    this.define<Scatter3D.Props>(({Bool, Float, List, String}) => ({
      x: [ List(Float), [] ],
      y: [ List(Float), [] ],
      z: [ List(Float), [] ],
      colors: [ List(Float), [] ],
      sizes: [ List(Float), [] ],
      labels: [ List(String), [] ],
      palette: [ String, 'Viridis256' ],
      vmin: [ Float, NaN ],
      vmax: [ Float, NaN ],
      nan_color: [ String, '#808080' ],
      default_size: [ Float, 5.0 ],
      min_size: [ Float, 3.0 ],
      max_size: [ Float, 15.0 ],
      show_outline: [ Bool, true ],
      outline_color: [ String, '#ffffff' ],
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
