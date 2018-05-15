import {
  ShaderMaterial,
  DoubleSide
} from "three";
import * as THREE from "three";
const Basic2DLineShader = require("three-line-2d/shaders/basic")(THREE);
import {
  DEFAULT_BOUNDARY_COLOR,
  defaultTheme
} from "../lib/colors";
import dashedLineVert from "../shaders/dashed-lines.vert";
import dashedLineFrag from "../shaders/dashed-lines.frag";

export function createDashedBoundaryMaterial ({
  color = DEFAULT_BOUNDARY_COLOR,
  opacity = 1,
  thickness = 4,
  dashStepsPerUnit = 0.1,
  dashDistance = 0.5
} = {}) {
  return new ShaderMaterial ({
    transparent: true,
    side: DoubleSide,
    vertexShader: dashedLineVert,
    fragmentShader: dashedLineFrag,
    uniforms: {
      thickness: {
        type: "f",
        value: thickness
      },
      opacity: {
        type: "f",
        value: opacity
      },
      diffuse: {
        type: "c",
        value: color
      },
      dashSteps: {
        type: "f", value: dashStepsPerUnit
      },
      dashDistance: {
        type: "f", value: dashDistance / 2
      },
      dashSmooth: {
        type: "f", value: 0.01
      }
    }
  });
}

export function createBoundaryMaterial ({
  color = DEFAULT_BOUNDARY_COLOR,
  opacity = 1,
  thickness = 2,
  dashStepsPerUnit,
  dashDistance
} = {}) {
  if (dashStepsPerUnit || dashDistance) {
    return createDashedBoundaryMaterial({
      color,
      opacity,
      thickness,
      dashStepsPerUnit,
      dashDistance
    });
  }
  return new ShaderMaterial(Basic2DLineShader({
    side: DoubleSide,
    diffuse: color,
    opacity,
    thickness
  }));
}

export function createBoundaryMaterialSet () {
  const b = createBoundaryMaterial;
  return {
    base: b(),
    wall: b({
      thickness: 2,
      color: defaultTheme.wall
    }),
    "air-wall": b({
      thickness: 1.5,
      dashDistance: 0.5,
      color: defaultTheme["air-wall"]
    }),
    railing: b({
      thickness: 1.5,
      dashDistance: 0.4,
      color: defaultTheme.railing
    }),
    border: b({
      thickness: 1,
      dashDistance: 0.3,
      color: defaultTheme.border
    }),
    stairs: b({
      thickness: 1,
      color: defaultTheme.stairs
    }),
    "dimension-line": b({
      thickness: 3,
      color: defaultTheme["dimension-line"],
      dashDistance: 0.15
    }),
    "object": b({
      thickness: 3,
      color: defaultTheme.object
    })
  };
}
