"""
Comprehensive examples for 3D visualizations using Bokeh
Includes: Scatter3D, Bar3D, Line3D, and Pie3D (bonus)
"""

import numpy as np
from bokeh.plotting import show, output_file
from scatter3d_py import Scatter3D
from bar3d_py import Bar3D
from line3d_py import Line3D


# ============================================================================
# SCATTER3D EXAMPLES
# ============================================================================

print("Creating Scatter3D examples...")

# Example 1: Basic 3D Scatter with Color Mapping
# Generate random 3D points
np.random.seed(42)
n_points = 200
x = np.random.randn(n_points) * 2
y = np.random.randn(n_points) * 2
z = np.random.randn(n_points) * 2

# Color based on distance from origin
colors = np.sqrt(x**2 + y**2 + z**2)

scatter1 = Scatter3D(
    x=x.tolist(),
    y=y.tolist(),
    z=z.tolist(),
    colors=colors.tolist(),
    palette='Viridis256',
    default_size=6.0,
    autorotate=False,
    rotation_speed=1.0,
    width=800,
    height=800,
    background_color='#0a0a0a',
    colorbar_title='Distance',
    show_colorbar=True,
    enable_hover=True,
)

output_file("scatter3d_basic.html", title="3D Scatter - Basic")
show(scatter1)


# Example 2: Scatter with Variable Sizes
# Generate spiral pattern
t = np.linspace(0, 4*np.pi, 150)
x = t * np.cos(t)
y = t * np.sin(t)
z = t

# Size increases with time
sizes = t / t.max() * 10

scatter2 = Scatter3D(
    x=x.tolist(),
    y=y.tolist(),
    z=z.tolist(),
    colors=z.tolist(),
    sizes=sizes.tolist(),
    palette='Plasma256',
    min_size=2.0,
    max_size=20.0,
    autorotate=False,
    width=800,
    height=800,
    background_color='#0a0a0a',
    colorbar_title='Height',
    azimuth=60,
    elevation=25,
)

output_file("scatter3d_spiral.html", title="3D Scatter - Spiral with Variable Sizes")
show(scatter2)


# Example 3: Clustered Data
# Create 3 clusters
n_per_cluster = 80
clusters = []
cluster_centers = [(0, 0, 0), (5, 5, 2), (-3, 4, -2)]
cluster_colors = [0, 1, 2]

x_all, y_all, z_all, colors_all = [], [], [], []
labels_all = []

for i, (cx, cy, cz) in enumerate(cluster_centers):
    x_cluster = np.random.randn(n_per_cluster) * 0.8 + cx
    y_cluster = np.random.randn(n_per_cluster) * 0.8 + cy
    z_cluster = np.random.randn(n_per_cluster) * 0.8 + cz
    
    x_all.extend(x_cluster)
    y_all.extend(y_cluster)
    z_all.extend(z_cluster)
    colors_all.extend([cluster_colors[i]] * n_per_cluster)
    labels_all.extend([f"Cluster {i+1}"] * n_per_cluster)

scatter3 = Scatter3D(
    x=x_all,
    y=y_all,
    z=z_all,
    colors=colors_all,
    labels=labels_all,
    palette='Set1',
    default_size=5.0,
    show_outline=True,
    outline_color='#ffffff',
    outline_width=1.0,
    autorotate=True,
    width=800,
    height=800,
    background_color='#0a0a0a',
    colorbar_title='Cluster',
    vmin=0,
    vmax=2,
)

output_file("scatter3d_clusters.html", title="3D Scatter - Clustered Data")
show(scatter3)


# Example 4: Sphere Surface Points
# Points on a sphere surface
n_points = 500
phi = np.random.uniform(0, 2*np.pi, n_points)
theta = np.arccos(2*np.random.uniform(0, 1, n_points) - 1)
r = 5

x = r * np.sin(theta) * np.cos(phi)
y = r * np.sin(theta) * np.sin(phi)
z = r * np.cos(theta)

# Color by height
colors = z

scatter4 = Scatter3D(
    x=x.tolist(),
    y=y.tolist(),
    z=z.tolist(),
    colors=colors.tolist(),
    palette='Spectral',
    default_size=4.0,
    autorotate=True,
    rotation_speed=0.8,
    width=800,
    height=800,
    background_color='#0a0a0a',
    colorbar_title='Z-coordinate',
    elevation=15,
    zoom=1.2,
)

output_file("scatter3d_sphere.html", title="3D Scatter - Sphere Surface")
show(scatter4)


# ============================================================================
# BAR3D EXAMPLES
# ============================================================================

print("Creating Bar3D examples...")

# Example 1: Simple 3D Bar Chart
# Create a simple grid of bars
n_x, n_y = 5, 5
x_grid = []
y_grid = []
values_grid = []

for i in range(n_x):
    for j in range(n_y):
        x_grid.append(i)
        y_grid.append(j)
        # Height based on distance from center
        dx = i - n_x/2
        dy = j - n_y/2
        values_grid.append(5 - np.sqrt(dx**2 + dy**2))

bar1 = Bar3D(
    x=x_grid,
    y=y_grid,
    values=values_grid,
    bar_width=0.6,
    bar_depth=0.6,
    palette='Turbo256',
    autorotate=True,
    width=800,
    height=800,
    background_color='#0a0a0a',
    colorbar_title='Height',
    elevation=-35,
    azimuth=50,
)

output_file("bar3d_grid.html", title="3D Bar Chart - Grid Pattern")
show(bar1)


# Example 3: Wave Pattern Bars
n_x, n_y = 8, 8
x_wave = []
y_wave = []
values_wave = []

for i in range(n_x):
    for j in range(n_y):
        x_wave.append(i)
        y_wave.append(j)
        # Sine wave pattern
        value = 3 + 2*np.sin(i * 0.8) * np.cos(j * 0.8)
        values_wave.append(max(0.1, value))

bar3 = Bar3D(
    x=x_wave,
    y=y_wave,
    values=values_wave,
    bar_width=0.7,
    bar_depth=0.7,
    palette='Plasma256',
    autorotate=True,
    width=800,
    height=800,
    background_color='#0a0a0a',
    colorbar_title='Wave Height',
    elevation=-40,
)

output_file("bar3d_wave.html", title="3D Bar Chart - Wave Pattern")
show(bar3)


# ============================================================================
# LINE3D EXAMPLES
# ============================================================================

print("Creating Line3D examples...")

# Example 1: Helix
t = np.linspace(0, 6*np.pi, 300)
x = 5 * np.cos(t)
y = 5 * np.sin(t)
z = t

# Color by height
colors = z

line1 = Line3D(
    x=x.tolist(),
    y=y.tolist(),
    z=z.tolist(),
    colors=colors.tolist(),
    palette='Viridis256',
    line_width=3.0,
    show_markers=False,
    autorotate=True,
    width=800,
    height=800,
    background_color='#0a0a0a',
    colorbar_title='Height',
    elevation=20,
)

output_file("line3d_helix.html", title="3D Line - Helix")
show(line1)


# Example 2: Parametric Curve (Trefoil Knot)
t = np.linspace(0, 2*np.pi, 500)
x = np.sin(t) + 2*np.sin(2*t)
y = np.cos(t) - 2*np.cos(2*t)
z = -np.sin(3*t)

# Color by parameter
colors = t

line2 = Line3D(
    x=x.tolist(),
    y=y.tolist(),
    z=z.tolist(),
    colors=colors.tolist(),
    palette='Turbo256',
    line_width=4.0,
    show_markers=False,
    autorotate=True,
    rotation_speed=0.6,
    width=800,
    height=800,
    background_color='#0a0a0a',
    colorbar_title='Parameter t',
    elevation=25,
    azimuth=45,
)

output_file("line3d_trefoil.html", title="3D Line - Trefoil Knot")
show(line2)


# Example 3: Random Walk in 3D
n_steps = 500
x = np.cumsum(np.random.randn(n_steps) * 0.1)
y = np.cumsum(np.random.randn(n_steps) * 0.1)
z = np.cumsum(np.random.randn(n_steps) * 0.1)

# Color by time/step
colors = np.arange(n_steps)

line3 = Line3D(
    x=x.tolist(),
    y=y.tolist(),
    z=z.tolist(),
    colors=colors.tolist(),
    palette='Plasma256',
    line_width=2.5,
    show_markers=True,
    marker_size=2.0,
    autorotate=True,
    width=800,
    height=800,
    background_color='#0a0a0a',
    colorbar_title='Time Step',
)

output_file("line3d_random_walk.html", title="3D Line - Random Walk")
show(line3)


# Example 4: Lorenz Attractor
def lorenz(x, y, z, s=10, r=28, b=2.667):
    dx = s * (y - x)
    dy = r * x - y - x * z
    dz = x * y - b * z
    return dx, dy, dz

dt = 0.01
n_steps = 5000
xs, ys, zs = np.zeros(n_steps), np.zeros(n_steps), np.zeros(n_steps)
xs[0], ys[0], zs[0] = 1, 1, 1

for i in range(n_steps - 1):
    dx, dy, dz = lorenz(xs[i], ys[i], zs[i])
    xs[i + 1] = xs[i] + dx * dt
    ys[i + 1] = ys[i] + dy * dt
    zs[i + 1] = zs[i] + dz * dt

# Color by height
colors = zs

line4 = Line3D(
    x=xs.tolist(),
    y=ys.tolist(),
    z=zs.tolist(),
    colors=colors.tolist(),
    palette='Spectral',
    line_width=1.5,
    show_markers=False,
    autorotate=True,
    rotation_speed=0.5,
    width=800,
    height=800,
    background_color='#0a0a0a',
    colorbar_title='Z-coordinate',
    elevation=30,
    azimuth=45,
    zoom=1.5,
)

output_file("line3d_lorenz.html", title="3D Line - Lorenz Attractor")
show(line4)


