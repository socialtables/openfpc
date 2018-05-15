import {
  ShaderMaterial,
  TextureLoader
} from "three";
import {
  DEFAULT_POINT_COLOR
} from "../lib/colors";
import pointsFrag from "../shaders/points.frag";
import pointsVert from "../shaders/points.vert";
import dotTex from "../assets/disc.png";

const assetState = {
  done: false
};
assetState.completionPromise = new Promise(resolve => assetState.completionPromiseResolve = resolve);

export function createPointMaterial ({ color, size }={}) {
  return new ShaderMaterial({
    uniforms: {
      color: {
        value: color || DEFAULT_POINT_COLOR
      },
      texture: {
        value: new TextureLoader().load(dotTex, () => assetState.completionPromiseResolve())
      },
      size: {
        value: size || 10
      }
    },
    vertexShader: pointsVert,
    fragmentShader: pointsFrag,
    alphaTest: 0.8,
    transparent: true,
    opacity: 0.5
  });
}

export function getPointAssetLoadPromise() {
  return assetState.completionPromise;
}
