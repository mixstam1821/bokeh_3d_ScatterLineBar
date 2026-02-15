from bokeh.core.properties import Float, String, List, Bool
from bokeh.models import LayoutDOM

class Bar3D(LayoutDOM):
    """
    A 3D bar chart visualization with interactive rotation, color mapping, and colorbar.
    
    This component renders 3D bars from x, y position data and height values with
    customizable bar dimensions, colors via palette mapping, viewing angles, and zoom.
    """
    
    __implementation__ = "bar3d.ts"
    
    # Data properties
    x = List(Float, help="X-coordinates (positions) of the bars")
    y = List(Float, help="Y-coordinates (positions) of the bars")
    values = List(Float, help="Height values of the bars")
    labels = List(String, help="Labels for each bar (shown in tooltip)")
    
    # Bar dimension properties
    bar_width = Float(0.4, help="Width of each bar in data units")
    bar_depth = Float(0.4, help="Depth of each bar in data units")
    
    # Color properties
    palette = String("Viridis256", help="Color palette name for value mapping")
    vmin = Float(float('nan'), help="Minimum value for color scaling (auto if NaN)")
    vmax = Float(float('nan'), help="Maximum value for color scaling (auto if NaN)")
    nan_color = String("#808080", help="Color for NaN/missing values")
    
    # Outline properties
    show_outline = Bool(True, help="Show outline around bar faces")
    outline_color = String("#000000", help="Color of bar outlines")
    outline_width = Float(0.5, help="Width of bar outlines")
    
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
