import { defaultTheme } from "./colors";

export default {
  type: "object",
  properties: {
    colors: {
      type: "object",
      title: "Colors",
      properties: {
        "canvas-border": {
          type: "string",
          title: "Canvas Boundary",
          default: "#" + defaultTheme["canvas-border"].getHexString()
        },
        background: {
          type: "string",
          title: "Viewport Background",
          default: "#" + defaultTheme.background.getHexString()
        },
        point: {
          type: "string",
          title: "Points",
          default: "#" + defaultTheme.point.getHexString()
        },
        "end-point": {
          type: "string",
          title: "End Points",
          default: "#" + defaultTheme["end-point"].getHexString()
        },
        wall: {
          type: "string",
          title: "Walls",
          default: "#" + defaultTheme.wall.getHexString()
        },
        "air-wall": {
          type: "string",
          title: "Air-Walls",
          default: "#" + defaultTheme["air-wall"].getHexString()
        },
        railing: {
          type: "string",
          title: "Railings",
          default: "#" + defaultTheme.railing.getHexString()
        },
        border: {
          type: "string",
          title: "Borders",
          default: "#" + defaultTheme.border.getHexString()
        },
        stairs: {
          type: "string",
          title: "Stairs",
          default: "#" + defaultTheme.stairs.getHexString()
        },
        "dimension-line": {
          type: "string",
          title: "Dimension Line",
          default: "#" + defaultTheme["dimension-line"].getHexString()
        },
        object: {
          type: "string",
          title: "Permanent Objects",
          default: "#" + defaultTheme.object.getHexString()
        },
        region: {
          type: "string",
          title: "Regions",
          default: "#" + defaultTheme.region.getHexString()
        },
        selection: {
          type: "string",
          title: "Selection",
          default: "#" + defaultTheme.selection.getHexString()
        }
      }
    }
  }
};
