from bokeh.core.properties import Int, Float, String, List, Bool
from bokeh.models import LayoutDOM

class Scatter3D(LayoutDOM):
    """
    A 3D scatter plot visualization with interactive rotation, size mapping, color mapping,
    tooltips, and an optional colorbar.
    
    This component renders a 3D scatter plot from point data (x, y, z) with customizable
    point colors via palette mapping, point sizes, labels, viewing angles, zoom, and tooltips.
    """
    
    __implementation__ = "scatter3d.ts"
    
    # Data properties
    x = List(Float, help="X-coordinates of the points")
    y = List(Float, help="Y-coordinates of the points")
    z = List(Float, help="Z-coordinates of the points")
    colors = List(Float, help="Values for color mapping (optional)")
    sizes = List(Float, help="Values for size mapping (optional)")
    labels = List(String, help="Labels for each point (shown in tooltip)")
    
    # Color properties
    palette = String("Viridis256", help="Color palette name for value mapping")
    vmin = Float(float('nan'), help="Minimum value for color scaling (auto if NaN)")
    vmax = Float(float('nan'), help="Maximum value for color scaling (auto if NaN)")
    nan_color = String("#808080", help="Color for NaN/missing values")
    
    # Size properties
    default_size = Float(5.0, help="Default point size when sizes array is empty")
    min_size = Float(3.0, help="Minimum point radius in pixels")
    max_size = Float(15.0, help="Maximum point radius in pixels")
    
    # Outline properties
    show_outline = Bool(True, help="Show outline around points")
    outline_color = String("#ffffff", help="Color of point outlines")
    outline_width = Float(0.5, help="Width of point outlines")
    
    # View properties
    azimuth = Float(45, help="Horizontal rotation angle in degrees (0-360)")
    elevation = Float(30, help="Vertical tilt angle in degrees (-90 to 90)")
    zoom = Float(1.0, help="Zoom level (0.5 to 8.0)")
    
    # Animation properties
    autorotate = Bool(False, help="Enable automatic rotation")
    rotation_speed = Float(1.0, help="Speed of auto-rotation")
    
    # Interaction properties
    enable_hover = Bool(True, help="Show tooltips on hover")
    
    # Colorbar properties
    show_colorbar = Bool(True, help="Display the colorbar")
    colorbar_title = String("Value", help="Title text for the colorbar")
    
    # Appearance properties
    background_color = String("#0a0a0a", help="Background color of the visualization")
    colorbar_text_color = String("#ffffff", help="Text color for colorbar labels and title")
