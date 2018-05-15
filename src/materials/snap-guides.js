import {
  ShaderMaterial,
  DoubleSide
} from "three";
import * as THREE from "three";
const Basic2DLineShader = require("three-line-2d/shaders/basic")(THREE);

import {
  DEFAULT_SNAP_GUIDE_COLOR
} from "../lib/colors";

export function createSnapGuidesMaterial ({
  color = DEFAULT_SNAP_GUIDE_COLOR,
  opacity = 0.5,
  thickness = 1
} = {}) {
  return new ShaderMaterial(Basic2DLineShader({
    side: DoubleSide,
    diffuse: color,
    opacity,
    thickness
  }));
}
