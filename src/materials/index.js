import {
  Color,
  Material
} from "three";
import {
  DEFAULT_BOUNDARY_SELECTION_COLOR,
  DEFAULT_SELECTION_COLOR,
  DEFAULT_BOUNDARY_COLLISION_COLOR,
  defaultTheme
} from "../lib/colors";
import { createCanvasBorderMaterial } from "./canvas-border";
import { createPointMaterial, getPointAssetLoadPromise } from "./points";
import { createBoundaryMaterialSet } from "./boundaries";
import { createObjectMaterialSet } from "./objects";
import { createRegionMaterialSet } from "./regions";
import { createSnapGuidesMaterial } from "./snap-guides";

export function generateRawMaterials () {
  const materials = {
    "canvas-border": createCanvasBorderMaterial(),
    point: createPointMaterial(),
    "end-point": createPointMaterial({
      color: defaultTheme["end-point"],
      size: 20
    }),
    snapGuides: createSnapGuidesMaterial()
  };
  const boundaryMaterials = createBoundaryMaterialSet();
  Object.keys(boundaryMaterials).forEach(bk => {
    materials[`${bk}Line`] = boundaryMaterials[bk];
  });
  const objectMaterials = createObjectMaterialSet();
  Object.keys(objectMaterials).forEach(ok => {
    materials[`${ok}Line`] = objectMaterials[ok];
  });
  const regionMaterials = createRegionMaterialSet();
  Object.assign(materials, regionMaterials);
  return [materials, getPointAssetLoadPromise()];
}

export function generateRecoloredMaterials (rawMaterials, color) {
  const recoloredMaterials = {};
  Object.keys(rawMaterials).forEach(m => {
    const rawMat = rawMaterials[m];
    if (rawMat instanceof Material) {
      const recoloredMat = rawMat.clone();
      if (rawMat.color) {
        recoloredMat.color = color;
      }
      if (rawMat.uniforms && rawMat.uniforms.color) {
        recoloredMat.uniforms = Object.assign({}, rawMat.uniforms, {
          color: { value: color }
        });
      }
      if (rawMat.uniforms && rawMat.uniforms.diffuse) {
        recoloredMat.uniforms = Object.assign({}, rawMat.uniforms, {
          diffuse: { value: color }
        });
      }
      recoloredMat.needsUpdate = true;
      recoloredMaterials[m] = recoloredMat;
    }
  });
  return recoloredMaterials;
}

export function updateMaterialsWithTheme (materials, theme) {
  Object.keys(materials).forEach(m => {
    const mat = materials[m];
    if (mat instanceof Material) {
      let themeKey = m;
      const pm = /(.+)(Line|Mesh)$/.exec(m);
      if (pm && pm[1]) {
        themeKey = pm[1];
      }
      if (theme.colors && theme.colors[themeKey]) {
        if (mat.color) {
          mat.color = new Color(theme.colors[themeKey]);
        }
        if (mat.uniforms && mat.uniforms.color) {
          mat.uniforms.color.value = new Color(theme.colors[themeKey]);
        }
        if (mat.uniforms && mat.uniforms.diffuse) {
          mat.uniforms.diffuse.value = new Color(theme.colors[themeKey]);
        }
        mat.needsUpdate = true;
      }
    }
  });
  Object.keys(materials.selected).forEach(m => {
    const mat = materials.selected[m];
    if (mat instanceof Material) {
      if (theme.colors && theme.colors.selection) {
        if (mat.color) {
          mat.color = new Color(theme.colors.selection);
        }
        if (mat.uniforms && mat.uniforms.color) {
          mat.uniforms.color.value = new Color(theme.colors.selection);
        }
        if (mat.uniforms && mat.uniforms.diffuse) {
          mat.uniforms.diffuse.value = new Color(theme.colors.selection);
        }
        mat.needsUpdate = true;
      }
    }
  });
  Object.keys(materials.boundarySelected).forEach(m => {
    const mat = materials.boundarySelected[m];
    if (mat instanceof Material) {
      if (theme.colors && theme.colors.boundarySelected) {
        if (mat.color) {
          mat.color = new Color(theme.colors.boundarySelected);
        }
        if (mat.uniforms && mat.uniforms.color) {
          mat.uniforms.color.value = new Color(theme.colors.boundarySelected);
        }
        if (mat.uniforms && mat.uniforms.diffuse) {
          mat.uniforms.diffuse.value = new Color(theme.colors.boundarySelected);
        }
        mat.needsUpdate = true;
      }
    }
  });
}

export function generateMaterials (includeAsync) {
  const [materials, loadPromise] = generateRawMaterials();
  materials.boundarySelected = generateRecoloredMaterials(materials, DEFAULT_BOUNDARY_SELECTION_COLOR);
  materials.selected = generateRecoloredMaterials(materials, DEFAULT_SELECTION_COLOR);
  materials.boundaryCollided = generateRecoloredMaterials(materials, DEFAULT_BOUNDARY_COLLISION_COLOR);
  updateMaterialsWithTheme(materials, defaultTheme);
  if (includeAsync) {
    return [materials, loadPromise];
  }

  return materials;
}

export function getLineThicknessDefaults (materials) {
  const thicknesses = {};
  Object.keys(materials).forEach(m => {
    const mat = materials[m];
    if (mat instanceof Material) {
      if (mat.uniforms && mat.uniforms.thickness) {
        thicknesses[m] = mat.uniforms.thickness.value;
      }
    }
  });
  return thicknesses;
}

export function applyLineThickness (materials, thickness, defaults) {
  Object.keys(materials).forEach(m => {
    const mat = materials[m];
    if (mat instanceof Material) {
      if (defaults[m]) {
        mat.uniforms.thickness.value = defaults[m] * thickness;
      }
    }
  });
  Object.keys(materials.selected).forEach(m => {
    const mat = materials.selected[m];
    if (mat instanceof Material) {
      if (defaults[m]) {
        mat.uniforms.thickness.value = defaults[m] * thickness;
      }
    }
  });
}
