import { Color } from "three";
const rgb = (r,g,b) => new Color(r/255, g/255, b/255);

// ST colors
export const dragonfruit = rgb(255, 123, 172);
export const pink = rgb(203, 85, 153);
export const green = rgb(158, 205, 117);
export const turquoise = rgb(73, 198, 183);
export const teal = rgb(79, 141, 157);
export const blue = rgb(101, 160, 214);
export const magenta = rgb(203, 85, 153);
export const orangered = rgb(230, 97, 93);
export const orange = rgb(234, 141, 99);
export const white = rgb(255, 255, 255);
export const gray1 = rgb(234, 237, 239);
export const gray2 = rgb(203, 209, 212);
export const gray3 = rgb(88, 101, 147);
export const black = rgb(0, 0, 0);
export const pinapple = rgb(244, 251, 116);

// palette of colors for config
export const themePalette = [
  // grays
  rgb(255, 255, 255),
  rgb(235, 240, 250),
  rgb(131, 143, 187),
  rgb(88, 101, 147),
  rgb(23, 35, 77),
  rgb(0, 0, 0),

  // pinks
  rgb(163, 45, 133),
  rgb(255, 123, 172),
  rgb(203, 85, 153),
  // periwinkles
  rgb(123, 153, 250),
  // blues
  rgb(44, 195, 240),
  // yellows
  rgb(246, 248, 204),
  // oranges
  rgb(255, 173, 130),
  // greens
  rgb(170, 244, 198)
];

export const DEFAULT_POINT_COLOR = gray1;
export const DEFAULT_BOUNDARY_COLOR = gray2;
export const DEFAULT_OBJECT_COLOR = gray3;
export const DEFAULT_REGION_COLOR = white;
export const DEFAULT_BOUNDARY_SELECTION_COLOR = pink;
export const DEFAULT_SELECTION_COLOR = blue;
export const DEFAULT_CANVAS_BORDER_COLOR = gray3;
export const DEFAULT_SNAP_GUIDE_COLOR = dragonfruit;


export const defaultTheme = {
  "canvas-border": DEFAULT_CANVAS_BORDER_COLOR,
  background: new Color("#303c6b"),
  point: DEFAULT_POINT_COLOR,
  "end-point": orangered,
  wall: DEFAULT_BOUNDARY_COLOR,
  "air-wall": orange,
  railing: orangered,
  border: orangered,
  stairs: DEFAULT_BOUNDARY_COLOR,
  "dimension-line": pinapple,
  object: DEFAULT_OBJECT_COLOR,
  region: DEFAULT_REGION_COLOR,
  boundarySelection: DEFAULT_BOUNDARY_SELECTION_COLOR,
  selection: DEFAULT_SELECTION_COLOR,
  snapGuides: DEFAULT_SNAP_GUIDE_COLOR
};

export const bookableRoomsTheme = {
  "canvas-border": "#EBF0FA",
  background: "#59646e",
  wall: "#313f4c",
  "air-wall": "#313f4c",
  railing: "#313f4c",
  border: "#313f4c",
  stairs: "#313f4c",
  object: "#838FBB",
  region: "#bdc3c7",
  boundarySelection: "#A32D85",
  selection: "#ffffff"
};
