from bokeh.core.properties import Float, String, List, Bool
from bokeh.models import LayoutDOM

class Line3D(LayoutDOM):
    """
    A 3D line plot visualization with interactive rotation, color mapping, and colorbar.
    
    This component renders a 3D line connecting points (x, y, z) with customizable
    line width, optional markers, colors via palette mapping, and viewing angles.
    """
    
    __implementation__ = "line3d.ts"
    
    # Data properties
    x = List(Float, help="X-coordinates of the line points")
    y = List(Float, help="Y-coordinates of the line points")
    z = List(Float, help="Z-coordinates of the line points")
    colors = List(Float, help="Values for color mapping along the line (optional)")
    
    # Color properties
    palette = String("Viridis256", help="Color palette name for value mapping")
    vmin = Float(float('nan'), help="Minimum value for color scaling (auto if NaN)")
    vmax = Float(float('nan'), help="Maximum value for color scaling (auto if NaN)")
    nan_color = String("#808080", help="Color for NaN/missing values")
    
    # Line properties
    line_width = Float(2.0, help="Width of the line in pixels")
    show_markers = Bool(False, help="Show markers at each data point")
    marker_size = Float(3.0, help="Size of markers in pixels")
    
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
