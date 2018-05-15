import {
  ShaderMaterial,
  DoubleSide
} from "three";
import * as THREE from "three";
const Basic2DLineShader = require("three-line-2d/shaders/basic")(THREE);
import {
  DEFAULT_CANVAS_BORDER_COLOR
} from "../lib/colors";

export function createCanvasBorderMaterial ({
  color = DEFAULT_CANVAS_BORDER_COLOR,
  thickness = 2,
  opacity = 1
} = {}) {
  return new ShaderMaterial(Basic2DLineShader({
    side: DoubleSide,
    diffuse: color,
    opacity,
    thickness
  }));
}
