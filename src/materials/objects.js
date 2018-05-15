import { ShaderMaterial, DoubleSide } from "three";
import * as THREE from "three";
const Basic2DLineShader = require("three-line-2d/shaders/basic")(THREE);
import { DEFAULT_BOUNDARY_COLOR } from "../lib/colors";

export function createObjectMaterial ({
  color = DEFAULT_BOUNDARY_COLOR,
  opacity = 1,
  thickness = 2
} = {}) {
  return new ShaderMaterial(Basic2DLineShader({
    side: DoubleSide,
    diffuse: color,
    opacity,
    thickness
  }));
}

export function createObjectMaterialSet () {
  return {
    object: createObjectMaterial(),
    window: createObjectMaterial({
      thickness: 4
    })
  };
}
