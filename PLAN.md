# Arena Visual Overhaul Plan - Phase 2: Among Us Level Detail

## Problem Analysis
Comparing our current arena to Among Us, there are 5 critical visual gaps:

1. **Rooms are plain rectangles** - Among Us rooms are irregular polygons with alcoves, indentations, and angled walls. Our rooms are basic axis-aligned rectangles.
2. **Walls are too thin and flat** - Among Us walls are 30-40px thick multi-layered structures. Ours are 16px thin bars.
3. **Not enough visual density** - Among Us rooms have 40-60% floor coverage with objects. We have maybe 15-20%. Empty walls and empty floor everywhere.
4. **No infrastructure layer** - Among Us has pipes, wires, screens, panels, blinking lights, vents running throughout. We have very minimal ambient detail.
5. **No ambient occlusion / lighting** - Among Us has floor darkening near walls, screen glow casting onto surfaces, and localized light pools. We have almost none.

## Implementation Plan

### Step 1: Triple Wall Thickness + Room Shape Irregularity
**What changes:**
- Increase `WALL` from 16 to 32 (doubles wall thickness for that solid Among Us feel)
- Add alcoves, indentations, and extensions to each room using extra wall segments (stays AABB-compatible with collision system)
- Kitchen: add a counter alcove extending from top wall
- Cafeteria: add a serving bay notch on one side
- Living Room: add an entertainment center alcove
- Bathroom: add a shower alcove (recessed area)
- Hallway: add side alcoves/niches with wall panels
- Bedroom: add a closet area bump-out
- Gym: add an equipment alcove
- Garden: add irregular border using extra wall segments to simulate hedge walls
- Garage: add a work bay extension

Each room gets 4-8 additional wall segments to break up the rectangular shapes. Doorways adjusted for thicker walls.

### Step 2: Multi-Layer Wall Rendering
**What changes:**
- Render walls as 3-layer structures:
  1. Dark outer shadow (offset 3px down-right)
  2. Main wall body (current wall color)
  3. Inner face highlight (lighter strip on top/left edge, 4px wide)
  4. Panel seam lines every ~60px along long walls
  5. Visible bolt/rivet dots at panel seam intersections
- Add visible door frame rendering at doorway gaps (colored trim pieces)
- Add corner cap pieces where walls meet

### Step 3: Massive Object Density Increase
**What changes:**
Add 60-80 more objects across all rooms. Target: no stretch of wall longer than ~120px without something against it.

New object types to add:
- **Wall-mounted screens** (small rectangles with colored glow, fake readout content)
- **Wall panels** with buttons/indicators
- **Pipe junction boxes** (small boxes where pipes connect)
- **Cable trays** on walls (thin rectangular channels)
- **Warning signs** (small yellow triangles)
- **Fire alarm pull stations** (small red boxes)
- **Light fixtures** (wall-mounted sconce shapes)
- **Small crates/barrels** to fill corners
- **Floor grating sections** (in hallway and mechanical areas)
- **Paper/clipboard items** on desks/tables
- **Potted plants** in corners (we have some, need more)
- **Trash bins** near every table/desk area
- **Extension cords** running across floors
- **Chairs** at every desk/table that doesn't have them
- **Wall clocks** (small circles with hands)
- **Coat hooks/racks** near doors
- **Whiteboard/bulletin board** in hallway

### Step 4: Infrastructure Layer (Pipes, Wires, Conduits)
**What changes:**
Add a dedicated `WALL_DETAILS` array for non-collision visual details that render ON TOP of walls or along them:

- **Pipe runs**: 6-8px thick colored lines running along walls with:
  - Elbow joints at corners (small arc segments)
  - Valve wheels (circles with crosshair at intervals)
  - Color bands (red for danger, blue for water, green for oxygen)
  - Joint rings (slightly wider sections at connection points)
- **Wire/cable runs**: 2-3px lines in multiple colors running from panel to panel
- **Conduit channels**: Thin rectangular channels along walls containing wire bundles
- **Wall-mounted indicators**: Small blinking dots (red, green, amber) placed at regular intervals along corridors

Each room gets 2-4 pipe runs and 1-2 wire runs. Hallway gets the most.

### Step 5: Ambient Occlusion + Screen Glow Lighting
**What changes:**
- **Floor edge darkening**: Draw a 20-30px gradient shadow band along every wall interior face. This alone transforms the flat floor look.
- **Screen glow**: Every screen/monitor object casts a colored radial glow (30-50px radius, very low opacity) onto surrounding floor
- **Overhead light pools**: Each room gets 1-3 subtle circular light pools on the floor (warm white, very low opacity) simulating overhead fixtures
- **Corner shadows**: Extra darkening in room corners where two walls meet
- **Door threshold markings**: Slightly different floor color at doorway transitions

### Step 6: Door Frame Rendering
**What changes:**
- Detect doorway gaps in walls
- Render visible door frame pieces: thicker border segments with metallic trim color
- Add small indicator lights above/beside doors (green = open, red = locked)
- Add floor threshold strips at door locations

## File Changes
All changes are in `battle-arena.html` only:
- `WALL` constant: 16 → 32
- `generateMap()`: ~60-80 new wall segments for room shapes + ~60-80 new furniture items + door frame objects
- `drawObstacles()`: Enhanced multi-layer wall rendering with bolts/seams
- `drawArenaBackground()`: Ambient occlusion gradient pass along walls + light pools
- `drawFurnitureItem()`: ~10-15 new furniture rendering cases
- New `WALL_DETAILS` array and `drawWallDetails()` function for pipes/wires/conduits
- New `drawScreenGlow()` function for lighting effects from screens
- New door frame detection and rendering in wall drawing

## Expected Result
After these changes, the arena should have:
- Rooms that feel shaped and designed, not like boxes
- Thick, solid, dimensional walls
- Dense, lived-in rooms full of objects
- Visible infrastructure (pipes, wires, screens) throughout
- Atmospheric lighting with screen glow and ambient shadows
- Clear door transitions between rooms
- Overall visual density matching Among Us level
