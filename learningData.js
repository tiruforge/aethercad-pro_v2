export const categories = [
  "Getting Started",
  "Interface Overview",
  "Drawing Tools",
  "Modify Tools",
  "Civil Engineering Tools",
  "Layers",
  "Dimensions",
  "Templates",
  "DXF Import & Export",
  "Keyboard Shortcuts",
  "Printing & PDF",
  "Frequently Asked Questions",
  "Troubleshooting"
];

export const guides = {
  "interface": {
    name: "Interface Overview",
    category: "Interface Overview",
    purpose: "The interface provides an organized environment designed to maximize drafting real estate while keeping all commands instantly accessible.",
    location: "Main Window",
    shortcut: "N/A",
    steps: [
      "Header Bar: Houses project info, autosave indicators, and global tools (Undo, Redo, Clear).",
      "Main Sidebar: Collapsible tabs containing Draw, Modify, and Civil toolboxes.",
      "Working Canvas: Center area where elements are drafted, panned, and zoomed.",
      "Footer Bar: Displays exact coordinate tracking, Snap controls, Unit toggles, and status updates."
    ],
    example: "Efficiently workflow transitions between Drawing, Civil, and Layer settings panels.",
    tips: "Double-click panels or use shortcuts to toggle sidebar visibility on smaller screens.",
    mistakes: "Mistaking secondary panels for primary drawing tools.",
    related: ["Toolbar", "Workspace", "Settings"],
    faq: [
      { q: "How do I resize panels?", a: "Sidebars are responsive and automatically scale or collapse depending on screen width." }
    ]
  },
  "toolbar": {
    name: "Toolbar Guide",
    category: "Interface Overview",
    purpose: "The Toolbar provides high-priority workspace tools including project management, canvas cleanups, and export settings.",
    location: "Top of screen",
    shortcut: "N/A",
    steps: [
      "Access the Project Manager via the top-left menu option.",
      "Perform Undo and Redo actions using the responsive left buttons.",
      "Erase the current canvas workspace with the Delete Workspace command.",
      "Export your work into DXF, SVG, or PNG using the drop-down selector."
    ],
    example: "Saving Aether drawing formats or triggering a complete canvas reset.",
    tips: "The Undo/Redo buttons show status states dynamically as you make canvas modifications.",
    mistakes: "Using Clear Workspace instead of selection deletions for individual object cleaning.",
    related: ["Interface", "Save", "Export DXF"],
    faq: [
      { q: "Can I hide the toolbar?", a: "The toolbar remains fixed at the top to ensure critical functions are never lost." }
    ]
  },
  "workspace": {
    name: "Workspace Navigation",
    category: "Getting Started",
    purpose: "Manage the drafting environment size, canvas orientation, and background configurations.",
    location: "Center screen",
    shortcut: "N/A",
    steps: [
      "Adjust canvas size automatically by resizing your browser tab.",
      "Observe coordinate origins tracking from the upper-left or central coordinates.",
      "Manage background modes between clean grids or dark drafting slates."
    ],
    example: "Positioning structural drawings relative to default coordinate hubs.",
    tips: "Configure units to fit your project layout metrics (e.g. pixels or imperial).",
    mistakes: "Drafting far outside coordinate limits, making zoom-to-fit alignments difficult.",
    related: ["Grid", "Zoom", "Pan"],
    faq: [
      { q: "Can I change workspace boundaries?", a: "The canvas uses a fluid system that updates dynamically based on container bounds." }
    ]
  },
  "grid": {
    name: "Grid Configuration",
    category: "Getting Started",
    purpose: "The grid provides a visual background reference for estimating distances, alignments, and spacings.",
    location: "Bottom Footer (Grid Toggle)",
    shortcut: "G",
    steps: [
      "Toggle the visual grid visibility by clicking Grid on the bottom bar.",
      "Adjust grid spacing increments inside the settings workspace.",
      "Use snap features to bind your cursors to grid intersections."
    ],
    example: "Aligning floor plan walls along neat 50-pixel standard margins.",
    tips: "Keep grid settings proportional to drawing dimensions for optimal readability.",
    mistakes: "Drafting micro-components with a highly dense grid, causing visual noise.",
    related: ["Snap", "Workspace", "Settings"],
    faq: [
      { q: "Does the grid export with drawings?", a: "No, the grid is a utility reference and does not display on DXF, SVG, or PNG exports." }
    ]
  },
  "zoom": {
    name: "Zooming Canvas",
    category: "Getting Started",
    purpose: "Enlarge or decrease canvas magnification to inspect detailed segments or view full CAD layouts.",
    location: "Canvas (Mouse Wheel) or Zoom Widget",
    shortcut: "Scroll / +/-",
    steps: [
      "Rotate mouse scroll wheel forward to magnify specific points.",
      "Rotate wheel backward to decrease magnification.",
      "Use the Zoom to Fit icon to instantly center all drafted elements."
    ],
    example: "Zooming into a column-to-beam connection to perform a fine trim operation.",
    tips: "The zoom centers around the cursor position, making navigation intuitive.",
    mistakes: "Zooming out excessively and losing track of drafted vectors.",
    related: ["Pan", "Workspace"],
    faq: [
      { q: "My zoom is stuck. What do I do?", a: "Click 'Zoom to Fit' in the navigation menu to reset translation scales instantly." }
    ]
  },
  "pan": {
    name: "Panning Workspace",
    category: "Getting Started",
    purpose: "Shift the view window horizontally or vertically without altering coordinate values.",
    location: "Middle Mouse Button / Drag mode",
    shortcut: "P / Spacebar (hold)",
    steps: [
      "Select the Pan tool or press P.",
      "Click and hold the left or middle mouse button.",
      "Drag the cursor across the canvas to shift coordinates."
    ],
    example: "Moving from the east bedroom draft layout over to the west bathroom layout.",
    tips: "Use keyboard spacebar modifiers to quickly pan without dropping your active drawing tools.",
    mistakes: "Dragging objects mistakenly instead of panning the viewport.",
    related: ["Zoom", "Workspace"],
    faq: [
      { q: "Is panning available on touchscreens?", a: "Yes, use standard two-finger swipe motions to shift coordinates on mobile devices." }
    ]
  },
  "snap": {
    name: "Object Snap (OSNAP)",
    category: "Getting Started",
    purpose: "Locks drawing inputs precisely to grid points, element endpoints, or midpoints.",
    location: "Bottom Status Bar / Snapping Toggle",
    shortcut: "S",
    steps: [
      "Activate snap-to-grid in the bottom status toolbar.",
      "Move drawing cursors near target vertices or intersections.",
      "Observe the cursor binding directly to the lock point before clicking."
    ],
    example: "Creating a partition wall that meets a main perimeter wall at an exact corner.",
    tips: "Temporarily disable snaps to draft organic lines or custom freehand curves.",
    mistakes: "Drafting complex designs with snap disabled, causing tiny overlapping gaps.",
    related: ["Grid", "Line", "Wall"],
    faq: [
      { q: "Why is my cursor jumping?", a: "Grid snap is active and the spacing is wide. Adjust grid settings or toggle snaps off." }
    ]
  },
  "layers": {
    name: "Layers Management",
    category: "Layers",
    purpose: "Organize drafts by separating structural components, dimensions, annotations, and electrical lines.",
    location: "Top Toolbar / Layer Selector Panel",
    shortcut: "L (Layer Control)",
    steps: [
      "Open the Layers Panel in the top menu bar.",
      "Create a new layer and specify color, name, and transparency.",
      "Toggle the eye icon to hide or display specific elements.",
      "Click the lock icon to protect a layer from accidental editing."
    ],
    example: "Hiding the 'Electrical' layer while working on 'Wall' structures.",
    tips: "Always place dimensions on a separate dedicated layer so they can be filtered cleanly.",
    mistakes: "Drafting all elements onto the 'Default' layer, making multi-component designs messy.",
    related: ["Interface", "Properties"],
    faq: [
      { q: "Can I move a shape to another layer?", a: "Yes, select the shape and modify its layer field in the Properties panel." }
    ]
  },
  "properties": {
    name: "Element Properties",
    category: "Interface Overview",
    purpose: "Inspect and modify precise attributes of selected canvas elements, including sizing, color, and layer settings.",
    location: "Right Sidebar / Properties Panel",
    shortcut: "N/A",
    steps: [
      "Select a drafted shape using the Selection pointer.",
      "Inspect the dynamic Properties panel on the right sidebar.",
      "Alter stroke widths, color values, text inputs, or layer associations.",
      "Observe modifications updating on the canvas instantly."
    ],
    example: "Changing a line's thickness from 2px to 6px to indicate a main property boundary.",
    tips: "Select multiple items to apply batch property changes (like changing layers simultaneously).",
    mistakes: "Forgetting to select the element first before modifying property fields.",
    related: ["Selection", "Layers"],
    faq: [
      { q: "Why is the properties panel blank?", a: "Ensure you have the Select Tool active and have clicked an element on the canvas." }
    ]
  },
  "selection": {
    name: "Selecting Elements",
    category: "Getting Started",
    purpose: "Target specific drawings on the canvas for moving, resizing, modifying, or deleting.",
    location: "Toolbox (Top option)",
    shortcut: "Esc / Space",
    steps: [
      "Activate the Selection tool (arrow cursor icon).",
      "Click directly on a line, wall, or object.",
      "Drag a bounding box over multiple elements to perform a group selection."
    ],
    example: "Selecting an entire window group to move it down a wall partition.",
    tips: "Use Escape to instantly deselect all elements and clear drafting tools.",
    mistakes: "Trying to select items while another drawing tool (like Circle) is still active.",
    related: ["Properties", "Move", "Delete"],
    faq: [
      { q: "How do I add to my current selection?", a: "Hold down the Shift key while clicking additional elements on the canvas." }
    ]
  },
  "line": {
    name: "Line Tool",
    category: "Drawing Tools",
    purpose: "The Line tool is used to create simple, straight vector segments between two coordinates.",
    location: "Draw Panel → Line",
    shortcut: "L",
    steps: [
      "Click the Line icon or press L.",
      "Click on the canvas to place the start vertex.",
      "Move the cursor to determine the length and angle.",
      "Click a second time to define the end vertex and create the segment."
    ],
    example: "Drafting boundary outlines or reference lines on structural designs.",
    tips: "Keep Snap enabled to align your lines precisely with other CAD geometry.",
    mistakes: "Pressing and dragging instead of using the clean click-move-click method.",
    related: ["Polyline", "Wall", "Rectangle"],
    faq: [
      { q: "How do I draw perfectly vertical lines?", a: "Hold the Shift modifier to activate Ortho mode for clean 90-degree lines." }
    ]
  },
  "rectangle": {
    name: "Rectangle Tool",
    category: "Drawing Tools",
    purpose: "The Rectangle tool creates rectangular or square shapes with custom dimensions.",
    location: "Draw Panel → Rectangle",
    shortcut: "R",
    steps: [
      "Click the Rectangle tool or press R.",
      "Click to establish the first corner coordinate.",
      "Move the cursor diagonally to expand the shape bounds.",
      "Click again to establish the opposite corner and place the rectangle."
    ],
    example: "Constructing simple rooms, rectangular table assets, or door bounds.",
    tips: "Read the dimension labels in the status panel while drawing to align sizing.",
    mistakes: "Clicking once and expecting a shape without moving the cursor.",
    related: ["Line", "Circle", "Hatch"],
    faq: [
      { q: "Can I enter exact dimensions?", a: "Yes, use the CAD dimension prompt box that appears when drafting shapes." }
    ]
  },
  "circle": {
    name: "Circle Tool",
    category: "Drawing Tools",
    purpose: "The Circle tool drafts perfect circles based on a defined center point and radius.",
    location: "Draw Panel → Circle",
    shortcut: "C",
    steps: [
      "Click the Circle tool or press C.",
      "Click on the canvas to designate the center coordinate.",
      "Drag outward to expand the circular radius.",
      "Click a second time to place the completed circle."
    ],
    example: "Drafting circular dining tables, pillars, pipe outlines, or round windows.",
    tips: "Snapping the center point to grid intersections guarantees perfect positioning.",
    mistakes: "Over-stretching the radius beyond the canvas boundaries.",
    related: ["Rectangle", "Line"],
    faq: [
      { q: "How do I specify exact diameter?", a: "Enter the desired radius (half the diameter) in the drafting input prompt." }
    ]
  },
  "wall": {
    name: "Wall Tool",
    category: "Civil Engineering Tools",
    purpose: "The Wall tool drafts thick structural building walls with integrated corner connections.",
    location: "Civil Panel → Wall",
    shortcut: "W",
    steps: [
      "Select Wall tool or press W.",
      "Click to place the starting node of the wall segment.",
      "Move the cursor to define wall length and direction.",
      "Click to place the ending node and finalize the thick wall segment."
    ],
    example: "Drafting standard 9-inch exterior building perimeter structures.",
    tips: "Adjust Wall Thickness inside the right Properties panel to fit custom interior or exterior guidelines.",
    mistakes: "Using simple Line tools instead of Wall, which prevents auto-room and door attachments.",
    related: ["Door", "Window", "Room Detection"],
    faq: [
      { q: "Do walls automatically join?", a: "Yes! AetherCAD auto-merges contiguous wall nodes to form seamless corners." }
    ]
  },
  "door": {
    name: "Door Tool",
    category: "Civil Engineering Tools",
    purpose: "The Door tool inserts interactive door symbols (complete with swings) directly into drafted walls.",
    location: "Civil Panel → Door",
    shortcut: "D",
    steps: [
      "Select the Door tool or press D.",
      "Hover over an existing wall segment to preview the door insertion.",
      "Move the cursor along the wall to adjust placement and swing angle.",
      "Click to attach the door; AetherCAD will auto-trim the wall beneath it."
    ],
    example: "Adding a single-hinge bedroom entry door along a room partition wall.",
    tips: "Adjust the swing radius or toggle opening directions in the Properties tab.",
    mistakes: "Placing doors on empty canvas areas without walls, which leaves them floating.",
    related: ["Wall", "Window"],
    faq: [
      { q: "Can I change the door width?", a: "Yes, click on the door element and alter its length or scale in the Properties panel." }
    ]
  },
  "window": {
    name: "Window Tool",
    category: "Civil Engineering Tools",
    purpose: "The Window tool places glazed structural window symbols inside walls.",
    location: "Civil Panel → Window",
    shortcut: "K",
    steps: [
      "Select Window tool or press K.",
      "Hover the cursor over an existing wall line.",
      "Slide the window along the wall to find the exact alignment.",
      "Click to finalize placement; AetherCAD handles the wall section cut."
    ],
    example: "Inserting standard double-hung sliding windows along an exterior living room wall.",
    tips: "Enable snap to position windows at equal distances from structural corners.",
    mistakes: "Placing windows without a wall backdrop, rendering them as standard floating rectangles.",
    related: ["Wall", "Door"],
    faq: [
      { q: "Does the wall auto-repair if I delete a window?", a: "Yes! Deleting a window auto-rebuilds the underlying solid wall segment." }
    ]
  },
  "beam": {
    name: "Beam Tool",
    category: "Civil Engineering Tools",
    purpose: "The Beam tool places structural support beams to indicate overhead weight transfers.",
    location: "Civil Panel → Beam",
    shortcut: "B",
    steps: [
      "Click the Beam tool or press B.",
      "Specify structural support thickness in the properties panel.",
      "Click the start structural node, then click the end node to span the beam."
    ],
    example: "Adding horizontal support beams over open-concept kitchens.",
    tips: "Style beams with dashed stroke properties to denote they exist overhead.",
    mistakes: "Confusing columns (vertical support points) with beams (horizontal support spans).",
    related: ["Column", "Wall"],
    faq: [
      { q: "Can I customize the beam color?", a: "Yes, use the Properties panel to choose contrasting colors (like red or orange) for load elements." }
    ]
  },
  "column": {
    name: "Column Tool",
    category: "Civil Engineering Tools",
    purpose: "Inserts rectangular or circular vertical load-bearing pillars into CAD drafts.",
    location: "Civil Panel → Column",
    shortcut: "O",
    steps: [
      "Click Column tool or press O.",
      "Define size specs (e.g. 12x12 inches) in the configuration panel.",
      "Click the targeted coordinate on the canvas to place the column."
    ],
    example: "Positioning concrete pillars at intersection nodes of exterior wall modules.",
    tips: "Always snap columns to grid points or wall midpoints for sound structural plans.",
    mistakes: "Failing to attach columns to load lines, leaving layouts structurally unsupported.",
    related: ["Beam", "Wall"],
    faq: [
      { q: "Can columns cut through walls?", a: "Columns will overlay cleanly above wall elements to indicate vertical load hierarchy." }
    ]
  },
  "polyline": {
    name: "Polyline Tool",
    category: "Drawing Tools",
    purpose: "The Polyline tool creates contiguous, connected sequences of line segments drafted as a single complex shape.",
    location: "Draw Panel → Polyline",
    shortcut: "Y",
    steps: [
      "Click the Polyline tool or press Y.",
      "Click on the canvas to place the initial point.",
      "Click sequentially to place additional joint coordinates.",
      "Press Escape or click the initial point to close the shape and finish."
    ],
    example: "Drafting custom property plots or irregular geometric footprints.",
    tips: "Polylines are highly useful for area calculations since they represent closed regions.",
    mistakes: "Using separate line segments instead of a contiguous polyline, which complicates moving the shape as one.",
    related: ["Line", "Area Calculator"],
    faq: [
      { q: "Can I convert lines into a polyline?", a: "Select separate contiguous lines and group them or redraw with the Polyline tool." }
    ]
  },
  "move": {
    name: "Move Tool",
    category: "Modify Tools",
    purpose: "Reposition selected elements to another coordinate on the workspace canvas.",
    location: "Modify Panel → Move",
    shortcut: "M",
    steps: [
      "Select the elements you want to move.",
      "Click the Move icon or press M.",
      "Click a reference basepoint on the canvas.",
      "Drag elements to the new location and click to release."
    ],
    example: "Shifting a desk assembly away from a wall to adjust office pathways.",
    tips: "Using an element corner as your basepoint makes snapping it to other lines easy.",
    mistakes: "Dragging without selecting a solid basepoint, resulting in misalignments.",
    related: ["Copy", "Rotate", "Selection"],
    faq: [
      { q: "Can I move shapes with arrow keys?", a: "Yes, you can nudge selected shapes using keyboard arrow keys for fine alignments." }
    ]
  },
  "copy": {
    name: "Copy Tool",
    category: "Modify Tools",
    purpose: "Duplicate selected elements and place them at designated positions while preserving the originals.",
    location: "Modify Panel → Copy",
    shortcut: "V (Copy Command)",
    steps: [
      "Select the items you wish to duplicate.",
      "Click the Copy icon or press V.",
      "Click a baseline coordinate point.",
      "Move the cursor to target areas and click to paste copies."
    ],
    example: "Duplicating a standardized hotel room bathroom layout across 10 floors.",
    tips: "Pasting is multi-instance; keep clicking to place multiple duplicates in a row.",
    mistakes: "Accidentally duplicating too many shapes directly on top of each other, creating double lines.",
    related: ["Move", "Mirror"],
    faq: [
      { q: "Is standard Ctrl+C copy supported?", a: "Yes! Standard keyboard shortcuts copy to cache as well." }
    ]
  },
  "rotate": {
    name: "Rotate Tool",
    category: "Modify Tools",
    purpose: "Spin selected geometry around a defined pivot point to adjust angles.",
    location: "Modify Panel → Rotate",
    shortcut: "T (Rotate)",
    steps: [
      "Select the target elements.",
      "Click the Rotate tool or press T.",
      "Click to establish the rotation center pivot point.",
      "Move the cursor or enter an angle to swing shapes, then click to set."
    ],
    example: "Turning a sofa asset by 90 degrees to fit a corner layout.",
    tips: "Hold the Shift modifier to snap rotation angles to clean 15-degree steps.",
    mistakes: "Selecting a pivot point far away from the object, which swings it in a wide circle.",
    related: ["Move", "Mirror"],
    faq: [
      { q: "Can I enter a precise rotation angle?", a: "Yes, use the CAD dimension text input box during active rotation." }
    ]
  },
  "mirror": {
    name: "Mirror Tool",
    category: "Modify Tools",
    purpose: "Reflect selected CAD elements across a custom-drawn symmetry axis line.",
    location: "Modify Panel → Mirror",
    shortcut: "I",
    steps: [
      "Select the target elements.",
      "Click the Mirror tool or press I.",
      "Click to define the first point of the mirror axis line.",
      "Click a second point to establish the mirror angle and generate the reflection."
    ],
    example: "Drafting a symmetrical duplex house layout by mirroring one side over a firewall.",
    tips: "You can choose to delete or keep the original source elements after mirroring.",
    mistakes: "Drawing an off-angle mirror axis, resulting in crooked reflections.",
    related: ["Rotate", "Copy"],
    faq: [
      { q: "Can I mirror elements horizontally?", a: "Yes, draw a perfectly vertical mirror axis to reflect elements horizontally." }
    ]
  },
  "scale": {
    name: "Scale Tool",
    category: "Modify Tools",
    purpose: "Enlarge or shrink selected elements proportionally or along specific factors.",
    location: "Modify Panel → Scale",
    shortcut: "N/A",
    steps: [
      "Select the shapes you want to scale.",
      "Click the Scale icon.",
      "Click a fixed base reference coordinate on the canvas.",
      "Drag outwards to expand or inwards to compress sizes, then click."
    ],
    example: "Resizing imported furniture templates to match actual room sizes.",
    tips: "Scaling from the midpoint of an object keeps it neatly centered.",
    mistakes: "Over-scaling items past boundaries, causing them to distort or disappear.",
    related: ["Properties", "Move"],
    faq: [
      { q: "Can I scale precisely?", a: "Yes, input numeric factors (e.g., '2' for double size, '0.5' for half size) in the active dimension prompt." }
    ]
  },
  "trim": {
    name: "Trim Tool",
    category: "Modify Tools",
    purpose: "Clip or cut away line segments back to their nearest intersections with other geometry.",
    location: "Modify Panel → Trim",
    shortcut: "X",
    steps: [
      "Click the Trim tool or press X.",
      "Hover over a line segment that crosses other lines.",
      "The segments that will be trimmed are previewed in red.",
      "Click the segment to cleanly remove it."
    ],
    example: "Cleaning up interior intersecting lines where partition walls meet.",
    tips: "Ensure cutting boundary lines intersect completely; Trim requires overlapping vectors.",
    mistakes: "Trying to trim isolated lines that do not cross any other geometry.",
    related: ["Extend", "Delete"],
    faq: [
      { q: "Can I trim walls?", a: "Yes, trim handles lines, polylines, and wall boundaries smoothly." }
    ]
  },
  "extend": {
    name: "Extend Tool",
    category: "Modify Tools",
    purpose: "Lengthen straight segments to meet the closest intersecting vector bounds.",
    location: "Modify Panel → Extend",
    shortcut: "E",
    steps: [
      "Click the Extend tool or press E.",
      "Hover over a line segment pointing toward other geometry.",
      "The extended length preview displays on screen.",
      "Click the line segment to project it forward."
    ],
    example: "Extending a drafted room separator wall to meet the exterior building perimeter.",
    tips: "If a line cannot find an intersection path, it cannot be extended.",
    mistakes: "Failing to check if a boundary line actually exists in the projection path.",
    related: ["Trim", "Line"],
    faq: [
      { q: "Does extend work on circles?", a: "Extend is specialized for straight elements like lines, polylines, and walls." }
    ]
  },
  "offset": {
    name: "Offset Tool",
    category: "Modify Tools",
    purpose: "Create concentric or parallel duplicates of shapes at specified offset distances.",
    location: "Modify Panel → Offset",
    shortcut: "F (Offset)",
    steps: [
      "Click the Offset tool or press F.",
      "Select the shape you want to duplicate.",
      "Specify the offset spacing gap.",
      "Hover inside or outside the shape and click to place the offset copy."
    ],
    example: "Creating interior room clearances or concentric structural columns.",
    tips: "Offsetting a circle is a rapid way to draw matching rings or pipe thickness.",
    mistakes: "Setting an offset distance larger than the shape itself, which breaks geometry.",
    related: ["Copy", "Scale"],
    faq: [
      { q: "Does offset work on polylines?", a: "Yes! Offsetting closed polylines is a powerful way to create concentric boundary lines." }
    ]
  },
  "delete": {
    name: "Delete Tool",
    category: "Modify Tools",
    purpose: "Permanently erase selected elements from the canvas and project memory.",
    location: "Toolbar / Toolbox",
    shortcut: "Del / Backspace",
    steps: [
      "Select the shapes you wish to remove.",
      "Press the Delete or Backspace key.",
      "OR click 'Delete Shape' inside the top toolbar."
    ],
    example: "Clearing outdated draft guidelines or incorrect window models.",
    tips: "If you make a mistake, use Undo (Ctrl+Z) instantly to recover your deleted shapes.",
    mistakes: "Accidentally deleting non-targeted elements because they were part of a group selection.",
    related: ["Undo", "Selection"],
    faq: [
      { q: "Is there a recycle bin?", a: "There is no recycle bin, but the Undo stack preserves deleted elements in active memory." }
    ]
  },
  "measure": {
    name: "Measure Tool",
    category: "Dimensions",
    purpose: "Read exact coordinate distances, lengths, and angles dynamically without drafting shapes.",
    location: "Toolbox → Measure",
    shortcut: "U",
    steps: [
      "Select the Measure tool or press U.",
      "Click your start measurement coordinate.",
      "Hover over the destination end coordinate.",
      "Read distance readouts on screen, then click to finish."
    ],
    example: "Checking clear spacing distance between a door jam and a pillar column.",
    tips: "Measure is transient and does not add line geometry to your drawings.",
    mistakes: "Confusing Measure (which hides on click) with Dimension (which places persistent annotations).",
    related: ["Dimension"],
    faq: [
      { q: "Can I measure in inches?", a: "Yes, use the bottom status bar unit toggle to switch between pixel references and civil inches." }
    ]
  },
  "dimension": {
    name: "Dimension Tool",
    category: "Dimensions",
    purpose: "Place persistent measurement annotations with arrows and numeric labels on drawings.",
    location: "Toolbox → Dimension",
    shortcut: "N",
    steps: [
      "Select the Dimension tool or press N.",
      "Click the first reference point (e.g. wall corner).",
      "Click the second reference point.",
      "Move the cursor perpendicular to draft offset markers, then click to drop."
    ],
    example: "Labeling floor plans with clean, legible width and depth dimension values.",
    tips: "Always put Dimension shapes onto a separate layer for easy toggle visibility.",
    mistakes: "Drawing reference lines manually and writing text instead of using this automated tool.",
    related: ["Measure", "Text"],
    faq: [
      { q: "Can I adjust the dimension label font size?", a: "Yes, select the dimension shape and modify font dimensions via the Properties tab." }
    ]
  },
  "text": {
    name: "Text Annotation",
    category: "Drawing Tools",
    purpose: "Label rooms, add drafting notes, and write title block descriptions on CAD sheets.",
    location: "Draw Panel → Text",
    shortcut: "T (Text Annotation)",
    steps: [
      "Select the Text tool.",
      "Click the exact spot on the canvas to place your label.",
      "Type the annotation contents in the properties input box.",
      "Alter font sizes, color metrics, and rotations as needed."
    ],
    example: "Placing 'MASTER BEDROOM (12'x14')' in the center of a newly drafted room segment.",
    tips: "Combine text tags with Hatch boundaries to design gorgeous blueprints.",
    mistakes: "Typing huge strings that overlap underlying lines; adjust font sizes to match layouts.",
    related: ["Interface", "Properties"],
    faq: [
      { q: "Is multiline text supported?", a: "Currently, single and double line structural annotations are fully optimized." }
    ]
  },
  "hatch": {
    name: "Hatch Shading",
    category: "Drawing Tools",
    purpose: "Fill closed geometric bounds with standard patterns to denote materials (e.g., solid, diagonal wall hatch, concrete, masonry).",
    location: "Draw Panel → Hatch",
    shortcut: "H",
    steps: [
      "Ensure you have a fully closed loop boundary (like a circle or rectangle).",
      "Select Hatch tool or press H.",
      "Choose a pattern (Solid, Diagonal lines, Brick, Grid) in properties.",
      "Click inside the closed boundary to apply the hatch pattern."
    ],
    example: "Applying a diagonal pattern inside thick exterior walls to indicate brick masonry.",
    tips: "If a boundary has even a 1-pixel gap, hatching may fail to detect the region correctly.",
    mistakes: "Hatching open lines, which can lead to layout-wide overflows.",
    related: ["Rectangle", "Circle", "Polyline"],
    faq: [
      { q: "How do I remove a hatch?", a: "Select the hatch shape using the selection pointer and press Delete." }
    ]
  },
  "area-calculator": {
    name: "Area Calculator",
    category: "Civil Engineering Tools",
    purpose: "Computes square footage or area metrics of designated closed loops on the canvas.",
    location: "Civil Panel → Area Calculator",
    shortcut: "N/A",
    steps: [
      "Open the Civil toolbox and click Area Calculator.",
      "Hover over closed canvas segments (like a rectangle room).",
      "Read computed area readouts shown in square pixels or converted square feet."
    ],
    example: "Calculating exact square foot sizing of a master master bedroom floor plan.",
    tips: "Ensure room boundaries are closed to guarantee precise algorithmic calculations.",
    mistakes: "Trying to measure areas of disconnected and open line segments.",
    related: ["Room Detection", "Measure"],
    faq: [
      { q: "How does unit setting affect area?", a: "Switching from px to feet/inches dynamically converts area factors." }
    ]
  },
  "room-detection": {
    name: "Room Detection",
    category: "Civil Engineering Tools",
    purpose: "Scans wall intersections automatically to identify closed rooms and append name tags.",
    location: "Civil Panel → Room Detection",
    shortcut: "N/A",
    steps: [
      "Select Room Detection inside the Civil panel.",
      "AetherCAD will scan and highlight identified rooms.",
      "Click inside a highlighted region to generate an annotated label."
    ],
    example: "Instantly labeling and cataloging 'Living Room' and 'Kitchen' spaces.",
    tips: "The detection algorithm requires fully closed wall structures to distinguish rooms.",
    mistakes: "Expecting detection to work on partition walls that do not close completely.",
    related: ["Wall", "Area Calculator", "Text"],
    faq: [
      { q: "Can I rename detected rooms?", a: "Yes, select the generated text label and modify the string in Properties." }
    ]
  },
  "material-estimation": {
    name: "Material Estimation",
    category: "Civil Engineering Tools",
    purpose: "Generates estimated material counts (concrete volume, brick counts, drywall sheets) based on total drafted wall lengths.",
    location: "Civil Panel → Material Est.",
    shortcut: "N/A",
    steps: [
      "Draft your floor plan layout using Wall and Column structures.",
      "Click Material Estimation in the Civil panel.",
      "Inspect the generated summary listing total wall volumes, brick estimates, and baseline costs."
    ],
    example: "Estimating brick costs for a 2 BHK residential floor plan instantly.",
    tips: "Ensure wall thicknesses are set accurately to yield reliable volume metrics.",
    mistakes: "Expecting estimation on simple drawn lines; ensure you are using solid Wall objects.",
    related: ["Wall", "Area Calculator"],
    faq: [
      { q: "Are material estimates exact?", a: "These represent high-precision mathematical estimates based on average material standards." }
    ]
  },
  "templates": {
    name: "Civil CAD Templates",
    category: "Templates",
    purpose: "Bootstrap new projects instantly using pre-designed floor plans, structural arrays, and modular templates.",
    location: "Top Banner / Civil Templates section",
    shortcut: "N/A",
    steps: [
      "Open the civil templates section from the Project Manager.",
      "Choose from presets like 1 BHK House, 2 BHK House, 3 BHK, Shop Layout, Office, or Classroom.",
      "Click Start Template to launch a clean workspace loaded with that blueprint.",
      "Alternatively, use 'Overlay' to import template shapes into your current canvas."
    ],
    example: "Spinning up a corporate office workstation structure to begin an interior build.",
    tips: "Predefined templates open as copy-safe drafts so your modifications never damage the base template.",
    mistakes: "Mistakenly editing templates directly and expecting the core template to overwrite.",
    related: ["Save", "Open"],
    faq: [
      { q: "Can I save over a template?", a: "Predefined templates are strictly read-only. Edits save to separate client-authored drafts." }
    ]
  },
  "save": {
    name: "Save Project",
    category: "Printing & PDF",
    purpose: "Persist work across editing sessions into browser local database systems or local files.",
    location: "Top Header Bar → Save .aether",
    shortcut: "N/A",
    steps: [
      "Work drafts are autosaved to local browser storage continuously.",
      "To export a persistent backup file, click the 'Save .aether' button in the toolbar.",
      "Choose a local drive path to save the .aether CAD project file."
    ],
    example: "Backing up complex structural drafts to an external hard drive.",
    tips: "Always export a final .aether file before clearing browser cookies.",
    mistakes: "Assuming clearing browser history preserves locally stored project lists.",
    related: ["Open", "Autosave"],
    faq: [
      { q: "What is an .aether file?", a: "It is a standardized local JSON format representing CAD lines, layers, and styles." }
    ]
  },
  "open": {
    name: "Open Project",
    category: "Printing & PDF",
    purpose: "Load existing projects from browser databases or external files back onto the working canvas.",
    location: "Top Header Bar → Open .aether",
    shortcut: "N/A",
    steps: [
      "Access saved drafts inside the Projects List modal.",
      "To load from an external file, click 'Open .aether' on the toolbar.",
      "Select your local file, and AetherCAD loads your project."
    ],
    example: "Resuming an older structural design by uploading its saved backup file.",
    tips: "Loading an external project automatically adds it to your internal Projects list.",
    mistakes: "Uploading standard image files like PNG into the Open .aether uploader.",
    related: ["Save", "Templates"],
    faq: [
      { q: "Can I open multiple files?", a: "You can load one active workspace project at a time. Manage multiple drafts in the Projects list." }
    ]
  },
  "import-dxf": {
    name: "Import DXF",
    category: "DXF Import & Export",
    purpose: "Import industry-standard DXF (Drawing Exchange Format) files into AetherCAD.",
    location: "Toolbar dropdown / File upload",
    shortcut: "N/A",
    steps: [
      "Access the import menu option.",
      "Select a vector-based .dxf file from your machine.",
      "AetherCAD parses DXF line, circle, and text entities directly onto active layers."
    ],
    example: "Importing a site layout drafted in AutoCAD to append electrical layers.",
    tips: "Ensure DXF files contain standard vector geometries; rasterized embeddings may not import.",
    mistakes: "Importing binary DWG files directly; convert them to ASCII DXF first.",
    related: ["Export DXF", "Layers"],
    faq: [
      { q: "Does layer color carry over?", a: "Yes, standard layer tags and styling colors are translated on import." }
    ]
  },
  "export-dxf": {
    name: "Export DXF",
    category: "DXF Import & Export",
    purpose: "Convert current drafts into a standardized AutoCAD-compatible DXF format.",
    location: "Toolbar → Export → Export DXF",
    shortcut: "N/A",
    steps: [
      "Click the Export button in the top toolbar.",
      "Choose 'Export DXF' from the drop-down menu.",
      "AetherCAD compiles all canvas entities and downloads the .dxf file."
    ],
    example: "Sharing structural blueprints with external consultants using AutoCAD.",
    tips: "Layers are fully mapped inside the exported file, preserving CAD layout structures.",
    mistakes: "Exporting blank canvases; make sure you have elements on active layers.",
    related: ["Import DXF", "Export PDF"],
    faq: [
      { q: "Is the export compatible with laser cutters?", a: "Yes, the exported DXF is highly clean and works perfectly with CNC and laser plotters." }
    ]
  },
  "export-pdf": {
    name: "Export to PDF",
    category: "Printing & PDF",
    purpose: "Generate printable, high-resolution vector PDF sheets of your drawings.",
    location: "Toolbar → Export → Export PDF",
    shortcut: "Ctrl+P",
    steps: [
      "Click Export and select 'Export PDF'.",
      "Configure PDF scale, margin offsets, and sheet size (A4, A3, Letter).",
      "Click Export to download the document."
    ],
    example: "Creating a professional client-ready floor plan printout.",
    tips: "Enable black-and-white mode inside settings if color printing is not required.",
    mistakes: "Exporting drawings far off-center, leading to cropped PDF outputs.",
    related: ["Export PNG", "Print"],
    faq: [
      { q: "Can I add title blocks?", a: "Yes, configure borders and title options in the PDF setup modal." }
    ]
  },
  "export-png": {
    name: "Export PNG",
    category: "Printing & PDF",
    purpose: "Export high-fidelity raster images of drafts suitable for presentations or web sharing.",
    location: "Toolbar → Export → Export PNG",
    shortcut: "N/A",
    steps: [
      "Open the Export dropdown menu.",
      "Select 'Export PNG'.",
      "The canvas rendering is exported as a clean raster file directly to your downloads."
    ],
    example: "Saving a quick progress screenshot to email or slack directly to clients.",
    tips: "A transparent or solid background can be toggled inside settings beforehand.",
    mistakes: "Assuming PNGs retain vector edit capabilities; export DXF for cad alterations.",
    related: ["Export PDF", "Export DXF"],
    faq: [
      { q: "What resolution is the PNG?", a: "The PNG matches your active browser viewport resolution with optimal pixel densities." }
    ]
  },
  "undo": {
    name: "Undo Last Action",
    category: "Getting Started",
    purpose: "Revert the most recent alteration or draft added to the canvas.",
    location: "Top Toolbar → Undo Button",
    shortcut: "Ctrl+Z",
    steps: [
      "If you make a drafting error, click the Undo icon.",
      "Alternatively, press Ctrl+Z on your keyboard.",
      "The workspace rolls back precisely to the preceding state."
    ],
    example: "Canceling an accidental deletion or misplaced partition wall segment.",
    tips: "The undo buffer is large, allowing you to walk back dozens of steps.",
    mistakes: "Assuming you can undo after clearing browser storage or reloading.",
    related: ["Redo", "Delete"],
    faq: [
      { q: "Does undo affect saved files?", a: "Yes! Undo works in active session memory, updating saved drawing files instantly." }
    ]
  },
  "redo": {
    name: "Redo Action",
    category: "Getting Started",
    purpose: "Re-apply the draft action or transformation that was just reverted by an Undo command.",
    location: "Top Toolbar → Redo Button",
    shortcut: "Ctrl+Y / Ctrl+Shift+Z",
    steps: [
      "Click the Redo icon in the top toolbar.",
      "Alternatively, press Ctrl+Y.",
      "The reverted canvas state is restored cleanly."
    ],
    example: "Restoring a wall segment you decided to keep after undoing it.",
    tips: "The Redo stack clears if you perform a brand-new drawing action after an undo.",
    mistakes: "Drafting a new segment and then trying to redo older undone modifications.",
    related: ["Undo"],
    faq: [
      { q: "How many times can I redo?", a: "You can redo up to the size of the active undo stack." }
    ]
  },
  "print": {
    name: "Printing Layouts",
    category: "Printing & PDF",
    purpose: "Send active CAD sheets directly to physical home or office paper printers.",
    location: "Toolbar dropdown / Browser Print",
    shortcut: "Ctrl+P",
    steps: [
      "Click Export and select 'Export PDF' to create a clean scale print.",
      "Open the PDF and trigger the standard system Print dialog.",
      "Adjust paper margins and print orientations on your printer interface."
    ],
    example: "Printing physical drafts of site layouts for site engineers.",
    tips: "Using the PDF vector pipeline guarantees sharp lines on physical paper.",
    mistakes: "Printing screenshots directly, which results in blurry low-resolution lines.",
    related: ["Export PDF"],
    faq: [
      { q: "Can I print in black and white?", a: "Yes, standard CAD styles allow monochrome options during printer configurations." }
    ]
  },
  "keyboard-shortcuts": {
    name: "Keyboard Shortcuts",
    category: "Keyboard Shortcuts",
    purpose: "Accelerate your drafting workflow using single-key command binds.",
    location: "Help Toolbar / Hotkeys Guide",
    shortcut: "N/A",
    steps: [
      "Press standard keys like L (Line), R (Rectangle), or C (Circle) to active tools instantly.",
      "Use Esc to clear selection tools and reset cursors.",
      "Toggle UI helpers like G (Grid) and S (Snap) instantly."
    ],
    example: "Rapidly switching from Wall drafting (W) over to placing a Door (D).",
    tips: "Keep your left hand over the key bindings and your right hand on the mouse.",
    mistakes: "Forgetting to clear active commands (with Esc) before typing.",
    related: ["Interface", "Settings"],
    faq: [
      { q: "Can I remap keys?", a: "The default layout is standard CAD shortcuts, widely compatible with AutoCAD presets." }
    ]
  },
  "autosave": {
    name: "Autosave System",
    category: "Getting Started",
    purpose: "Automatically secure CAD drawings continuously to prevent work loss from crashes.",
    location: "Top Header / Continuous",
    shortcut: "Automatic",
    steps: [
      "An active green 'AUTOSAVE' indicator shines in the toolbar.",
      "Every single line, layer change, or edit triggers a background commit.",
      "If the browser reloads unexpectedly, your project is loaded perfectly from where you left off."
    ],
    example: "Recovering a layout after an unexpected laptop battery shutdown.",
    tips: "Autosave writes to localStorage; don't clear browser cache if you have unexported files.",
    mistakes: "Assuming autosave replaces exporting backup .aether files for long-term storage.",
    related: ["Save", "Settings"],
    faq: [
      { q: "How often does it save?", a: "AetherCAD's autosave is instant, triggering within milliseconds of any edit." }
    ]
  },
  "settings": {
    name: "CAD Settings Panel",
    category: "Interface Overview",
    purpose: "Adjust drafting defaults, coordinate tolerances, theme colors, and grid parameters.",
    location: "Bottom Left of the workspace / Settings Option",
    shortcut: "N/A",
    steps: [
      "Access the Settings panel from the menu.",
      "Toggle grid sizing increments, snapping tolerance factors, and themes.",
      "Enable or disable metric conversions to align with project specs."
    ],
    example: "Increasing snap limits to make locking to line ends more comfortable.",
    tips: "The settings are persisted locally so you do not need to reconfigure them each session.",
    mistakes: "Setting snapping values too high, which restricts free-form drawing.",
    related: ["Workspace", "Grid", "Snap"],
    faq: [
      { q: "How do I reset defaults?", a: "You can click 'Reset Defaults' in the settings panel to restore original configurations." }
    ]
  }
};

export const faqs = [
  {
    q: "How do I draw a wall?",
    a: "Select the Wall Tool (shortcut: W) from the Civil sidebar. Click once on the canvas to place the starting node, drag your mouse to set the direction, and click a second time to complete the segment. Walls automatically merge at intersection corners."
  },
  {
    q: "How do I rotate an object?",
    a: "Select the object using the Selection arrow. Click the Rotate tool (shortcut: T) from the Modify panel, click on the canvas to set your pivot point, and swing the mouse or enter a precise degree value. Click again to set."
  },
  {
    q: "How do I import a DXF?",
    a: "Click on 'Open/Import' in the toolbar dropdown, choose 'Import DXF', select a standard vector ASCII .dxf file, and the parser will map the elements into your active layer structure."
  },
  {
    q: "How do I export to PDF?",
    a: "Select 'Export' from the top toolbar, click 'Export PDF', configure your page dimensions (A4/A3/Letter), and set your crop offsets. Click 'Export' to download the vector sheet."
  },
  {
    q: "How do I print?",
    a: "Generate an exported vector PDF first to ensure pixel-perfect sharp lines. Open the PDF in your browser and press Ctrl+P to trigger your system's paper printer dialog."
  },
  {
    q: "How do I use templates?",
    a: "Open the Projects List modal from the top menu, select one of the Predefined Civil Templates (like 1 BHK or Office), and click Start Template. It launches as a copy-safe draft ready for editing."
  },
  {
    q: "How do I recover deleted objects?",
    a: "If you accidentally delete CAD shapes, press Ctrl+Z (Undo) immediately. This rolls back the deletion from current memory."
  }
];

export const troubleshooting = [
  {
    problem: "Snap not working",
    solution: "Ensure that 'Snap to Grid' or 'Object Snap' is enabled on the bottom status footer. You can also press 'S' to toggle snapping on or off. Check that your grid spacing in settings is not set to an extreme value."
  },
  {
    problem: "Dimension not appearing",
    solution: "Verify that the 'Dimensions' layer is set to visible (eye icon open) in the layers panel. Also check that your label font size in the Properties tab is large enough to be legible at your current zoom level."
  },
  {
    problem: "Cannot select object",
    solution: "Make sure you have deactivated other drawing tools by pressing Escape to activate the default 'Selection' arrow. Also, check if the layer containing the object is locked (lock icon closed)."
  },
  {
    problem: "DXF import failed",
    solution: "AetherCAD parses ASCII DXF vector formats. Ensure that your file is not a binary DWG or a binary-encoded DXF. Try converting it to standard ASCII DXF in AutoCAD before importing."
  },
  {
    problem: "Print is blank",
    solution: "This usually happens when drawings are located far outside the viewport coordinate boundaries. Click 'Zoom to Fit' first to center your designs, and use the Export PDF preview to adjust margins."
  },
  {
    problem: "Undo not working",
    solution: "Undo operates inside your current active drafting session. If you refresh the browser page, clear your browser's local cache, or switch active projects, the undo stack buffer is cleared."
  }
];
