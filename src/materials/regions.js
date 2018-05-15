import { MeshBasicMaterial, DoubleSide } from "three";
import { DEFAULT_REGION_COLOR } from "../lib/colors";

export function createRegionMaterial ({
  color = DEFAULT_REGION_COLOR,
  opacity = 0.5
} = {}) {
  return new MeshBasicMaterial({
    side: DoubleSide,
    color,
    transparent: opacity !== 1,
    opacity
  });
}

export function createRegionMaterialSet () {
  return {
    region: createRegionMaterial()
  };
}
