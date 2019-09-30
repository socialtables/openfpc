const debug = require("debug")("openfpc:lib:renderable-scene-maintainer");

import {
  Geometry,
  Vector3,
  Vector2,
  Face3,
  Scene,
  Mesh,
  Points,
  BufferGeometry,
  TextureLoader,
  MeshBasicMaterial,
  PlaneGeometry,
  Object3D,
  NearestFilter,
  LinearFilter,
  DoubleSide
} from "three";

import earcut from "earcut";
import { Map, Set } from "immutable";
import {
  generateMaterials,
  updateMaterialsWithTheme,
  getLineThicknessDefaults,
  applyLineThickness
} from "../materials";
import { defaultTheme } from "./colors";
import shallowImmutableDiff from "../lib/immutable-map-diff";
import { getObjectVertices } from "./permanent-object-shapes";
import { IMPERIAL_FEET_INCHES } from "../constants";

import * as THREE from "three";
const Line2D = require("three-line-2d")(THREE);

// fonts (TODO put into its own file)
import createTextGeometry from "three-bmfont-text";
import loadFont from "load-bmfont/browser";
import opensansFnt from "../assets/OpenSans-sdf.fnt";
import opensansPng from "../assets/OpenSans-sdf.png";


// three-line-2d normalizes the dash-position along lines based on point
// index, not geometric distance. this overwrites that behavior.
function _fixLine2DDistances (lineGeom) {
  const distAttr = lineGeom.getAttribute("lineDistance");
  if (distAttr) {
    const posArr = lineGeom.getAttribute("position").array;
    const distArr = distAttr.array;
    let totalDist = 0;
    const tmpA = new Vector3();
    const tmpB = new Vector3();
    for (let ai=1; ai<distArr.length; ai++) {
      tmpA.fromArray(posArr, ai * 3 - 3);
      tmpB.fromArray(posArr, ai * 3);
      tmpB.sub(tmpA);
      totalDist += tmpB.length();
      distArr[ai] = totalDist;
    }
  }
  return lineGeom;
}

function _applyMaterial (mesh, mat) {
  if (mesh.children) {
    mesh.children.forEach(c => _applyMaterial(c, mat));
  }
  if (!mesh.material.map) {
    mesh.material = mat;
  }
}

// recursive disposal for meshes - not materials, since they are re-used
function _disposeMesh (mesh) {
  if (mesh.children) {
    mesh.children.forEach(_disposeMesh);
  }
  if (mesh.geometry && mesh.geometry.dispose) {
    mesh.geometry.dispose();
  }
  if (mesh.dispose) {
    mesh.dispose();
  }
}

/**
 * ThreeJS scene maintainer - lets viewports sync a ThreeJS scene to match
 * an immutable floor state with pending changes applied.
 */
export default class RenderableSceneMaintainer {

  // TODO: layers; maintaining a seperate selection set is a pain, would
  // much rather just store state changes on scene entities directly and
  // either compound, override, or just sepeately maintain the set of static
  // stuff and pending changes so that they could be more efficiently redrawn
  // as changes occurred.

  constructor ({
    colorScheme = null,
    onAsyncLoadFinished
  } = {}) {

    this.scene = new Scene();
    this.clearColor = defaultTheme.background;
    this.textureLoader = new TextureLoader();
    this.sceneEntityMap = {};
    this.maintainPointRefCounts = true;

    this.onAsyncLoadFinished = onAsyncLoadFinished ?
      onAsyncLoadFinished :
      () => {};

    this._latestFloorState = null;
    this._latestCombinedFloorEntities = null;
    this._latestSelectionSet = null;
    this._numRemoves = 0;
    this._latestColorScheme = null;

    [this.materials, this.matLoadPromise] = generateMaterials(1);
    this._bgMaterials = {};

    this._font = null;
    this._fontMaterial = null;
    this._idsPendingFontLoad = [];

    if (colorScheme) {
      this.syncColorScheme(colorScheme);
    }

    this._pointRadius = 4;
    this._lineThicknessDefaults = getLineThicknessDefaults(this.materials);
    this._pointRefCounts = {};

    this.loadTextAssets();
    this.matLoadPromise.then(() => this.onAsyncLoadFinished());

    this._snapGuides = null;
  }
  getScene () {
    return this.scene;
  }
  set pointRadius (val) {
    this._pointRadius = val;
    this.materials.point.uniforms.size.value = val;
    this.materials["end-point"].uniforms.size.value = val * 1.5;
  }
  get pointRadius () {
    return this._pointRadius;
  }
  set lineThickness (val) {
    applyLineThickness(this.materials, val, this._lineThicknessDefaults);
  }
  syncColorScheme (colorScheme) {
    updateMaterialsWithTheme(this.materials, colorScheme);
    if (colorScheme.colors && colorScheme.colors.background) {
      this.clearColor = colorScheme.colors.background;
    }
    else {
      this.clearColor = defaultTheme.background;
    }
  }
  syncFloorState (floorState, hiddenEntityTypes, hiddenBoundaryTypes) {

    // figure out what changed
    debug("getting diffs");
    const { entities, pendingChanges, selection, scale = 1, units } = floorState;
    let prevEntities = this._latestCombinedFloorEntities || Map();
    let diffEntities = entities;

    // apply pending changes
    if (pendingChanges) {
      diffEntities = diffEntities.merge(pendingChanges);
    }

    // apply visibility filtering
    if (hiddenEntityTypes) {
      diffEntities = diffEntities.filter(e => !hiddenEntityTypes[e.get("type")]);
    }

    if (hiddenBoundaryTypes) {
      diffEntities = diffEntities.filter(e => {
        return e.get("type") === "boundary" && !hiddenBoundaryTypes[e.get("boundaryType")];
      });
    }

    // if the scale updated, refresh everything
    const sceneUnitsChanged = this._latestFloorState && (
      this._latestFloorState.get("scale") !== scale ||
      this._latestFloorState.get("units") !== units
    );
    if (sceneUnitsChanged) {
      debug("scale or units changed, will re-create scene");
      this.disposeAll();
      prevEntities = this._latestSelectionSet = null;
    }

    // compute and process the diff
    let [
      addedEntities,
      updatedEntities,
      removedEntities
    ] = shallowImmutableDiff(prevEntities, diffEntities);
    this._latestCombinedFloorEntities = diffEntities;
    this._latestFloorState = floorState;

    debug("applying diffs");
    const _pointSrc = (pendingChanges) ? entities.merge(pendingChanges) : entities;

    const addedPoints = addedEntities.valueSeq().filter(e => e.type === "point");
    const addedBounds = addedEntities.valueSeq().filter(e => e.type === "boundary");
    const addedRegions = addedEntities.valueSeq().filter(e => e.type === "region");
    const addedObjects = addedEntities.valueSeq().filter(e => e.type === "object");
    const addedCanvasBorders = addedEntities.valueSeq().filter(e => e.type === "canvas-border");
    const addedBackgroundImages = addedEntities.valueSeq().filter(e => e.type === "background");

    // tricky!
    let updatedPoints = [];
    let updatedBounds = [];
    let updatedObjects = [];

    if (updatedEntities.count()) {
      updatedPoints = updatedEntities.filter(e => e.type === "point");
      updatedBounds = updatedEntities.filter(e => e.type === "boundary");
      updatedObjects = updatedEntities.valueSeq().filter(e => e.type === "object");
      if (updatedPoints.count()) {
        const linkedBoundsByID = {};
        floorState.mergePendingChanges().getLinkedBoundaries(updatedPoints).forEach(b => linkedBoundsByID[b.get("id")] = b);
        updatedBounds = updatedBounds.merge(new Map(linkedBoundsByID));
      }
    }

    addedPoints.forEach(p => {
      const objMesh = this.constructPointObject(p);
      this.scene.add(objMesh);
      this.sceneEntityMap[p.get("id")] = objMesh;
    });
    const newLabels = [];
    addedBounds.forEach(b => {
      const objMesh = this.constructBoundaryObject(b, _pointSrc);
      this.scene.add(objMesh);
      this.sceneEntityMap[b.get("id")] = objMesh;
      if (this.maintainPointRefCounts) {
        const startID = b.get("start");
        const endID = b.get("end");
        this._pointRefCounts[startID] = (this._pointRefCounts[startID] || 0) + 1;
        this._pointRefCounts[endID] = (this._pointRefCounts[endID] || 0) + 1;
      }
      const objLabel = this.constructLabel(b, _pointSrc, scale, this._latestFloorState.units);
      if (objLabel) {
        newLabels.push([objMesh, objLabel]);
      }
    });
    // there's a call stack depth bug here - get around it with animation frame CB
    requestAnimationFrame(() => {
      newLabels.forEach(([p, c]) => p.children.push(c));
    });

    addedRegions.forEach(r => {
      const objMesh = this.constructRegionObject(r, entities);
      this.scene.add(objMesh);
      this.sceneEntityMap[r.get("id")] = objMesh;
    });
    addedObjects.forEach(o => {
      const objMesh = this.constructPermanentObject(o);
      this.scene.add(objMesh);
      this.sceneEntityMap[o.get("id")] = objMesh;
    });
    addedCanvasBorders.forEach(cb => {
      const cbMesh = this.constructCanvasBorderObject(cb);
      this.scene.add(cbMesh);
      this.sceneEntityMap[cb.get("id")] = cbMesh;
    });
    addedBackgroundImages.forEach(bg => {
      const bgMeshPromise = this.constructBackgroundImageObject(bg);
      bgMeshPromise.then(bgMesh => {
        this.scene.add(bgMesh);
        this.sceneEntityMap[bg.get("id")] = bgMesh;
        if (this.onAsyncLoadFinished){
          this.onAsyncLoadFinished();
        }
      });
    });

    // just re-create for MVP stage; entity churn is generally very minor
    updatedPoints.forEach(p => {
      this._removeEntityFromScene(p.get("id"));
      const objMesh = this.constructPointObject(p);
      this.scene.add(objMesh);
      this.sceneEntityMap[p.get("id")] = objMesh;
    });
    updatedBounds.forEach(b => {
      this._removeEntityFromScene(b.get("id"));
      const objMesh = this.constructBoundaryObject(b, _pointSrc);
      this.scene.add(objMesh);
      this.sceneEntityMap[b.get("id")] = objMesh;
      const objLabel = this.constructLabel(b, _pointSrc, scale, this._latestFloorState.units);
      if (objLabel) {
        objMesh.children.push(objLabel);
      }
      // handle endpoint reassignment reference count updates
      if (this.maintainPointRefCounts && prevEntities) {
        const prevBound = prevEntities.get(b.get("id"));
        if (prevBound) {
          this._pointRefCounts[prevBound.get("start")] =
            (this._pointRefCounts[prevBound.get("start")] || 0) - 1;
          this._pointRefCounts[prevBound.get("end")] =
            (this._pointRefCounts[prevBound.get("end")] || 0) - 1;
          this._pointRefCounts[b.get("start")] =
            (this._pointRefCounts[b.get("start")] || 0) + 1;
          this._pointRefCounts[b.get("end")] =
            (this._pointRefCounts[b.get("end")] || 0) + 1;
        }
      }
    });
    updatedObjects.forEach(o => {
      this._removeEntityFromScene(o.get("id"));
      const objMesh = this.constructPermanentObject(o);
      this.scene.add(objMesh);
      this.sceneEntityMap[o.get("id")] = objMesh;
    });

    removedEntities.forEach(entity => {
      this._removeEntityFromScene(entity.get("id"));
      if (this.maintainPointRefCounts) {
        if (entity.get("type") === "boundary") {
          const startID = entity.get("start");
          const endID = entity.get("end");
          this._pointRefCounts[startID] = (this._pointRefCounts[startID] || 0) - 1;
          this._pointRefCounts[endID] = (this._pointRefCounts[endID] || 0) - 1;
        }
      }
    });

    debug("assigning endpoint materials");
    if (this.maintainPointRefCounts) {
      Object.keys(this._pointRefCounts).forEach(id => {
        const pointRefCount = this._pointRefCounts[id];
        const pointMesh = this.sceneEntityMap[id];
        let mats = this.materials;
        if (selection && selection.get(id)) {
          mats = this.materials.selected;
        }
        const pointMat = (pointRefCount > 1) ? mats.point : mats["end-point"];
        if (pointMesh && (pointMesh.material !== pointMat)) {
          pointMesh.material = pointMat;
        }
      });
    }

    debug("assigning selection materials");
    let [
      addedSelection,
      updatedSelection,
      removedSelection
    ] = shallowImmutableDiff(this._latestSelectionSet, selection);
    addedSelection = addedSelection
    .merge(updatedSelection)
    .merge(new Set(
      updatedEntities
      .merge(updatedBounds)
      .valueSeq()
      .map(e => e.get("id"))
      .filter(id => selection.get(id))
    ));
    this._latestSelectionSet = selection;
    addedSelection.keySeq().forEach(id => {
      const sceneEntity = this.sceneEntityMap[id];
      const stateEntity = entities.get(id);
      const mats = this.materials.selected;
      if (stateEntity && sceneEntity) {
        const bType = stateEntity.get("boundaryType");
        const objType = stateEntity.get("objectType");
        switch (stateEntity.get("type")) {
        case "point":
          if (this.maintainPointRefCounts) {
            const isEndpoint = !(this._pointRefCounts[id] > 1);
            _applyMaterial(sceneEntity, isEndpoint ? mats["end-point"] : mats.point);
            break;
          }
          _applyMaterial(sceneEntity, mats.point);
          break;
        case "boundary":
          _applyMaterial(sceneEntity, mats[`${bType}Line`] || mats.baseLine);
          break;
        case "object":
          _applyMaterial(sceneEntity, mats[`${objType}Line`] || mats.objectLine);
          break;
        case "region":
          _applyMaterial(sceneEntity, mats.region);
          break;
        }
      }
    });
    removedSelection.keySeq().forEach(id => {
      const sceneEntity = this.sceneEntityMap[id];
      const stateEntity = entities.get(id);
      const mats = this.materials;
      if (stateEntity && sceneEntity) {
        const bType = stateEntity.get("boundaryType");
        const objType = stateEntity.get("objectType");
        switch (stateEntity.get("type")) {
        case "point":
          if (this.maintainPointRefCounts) {
            const isEndpoint = !(this._pointRefCounts[id] > 1);
            _applyMaterial(sceneEntity, isEndpoint ? mats["end-point"] : mats.point);
            break;
          }
          _applyMaterial(sceneEntity, mats.point);
          break;
        case "boundary":
          _applyMaterial(sceneEntity, mats[`${bType}Line`] || mats.baseLine);
          break;
        case "object":
          _applyMaterial(sceneEntity, mats[`${objType}Line`] || mats.objectLine);
          break;
        case "region":
          _applyMaterial(sceneEntity, mats.region);
          break;
        }
      }
    });
    debug("finished updating scene");
  }
  _setSnapGuides (guides) {
    this._clearSnapGuides();
    if (!guides) {
      return;
    }
    const combinedGuidesObj = new Object3D();
    // TODO: clip these to the scene or snap position accurately
    guides.forEach(guide => {
      const bigTangent = guide.tangent.clone().multiplyScalar(2000);
      const s = guide.pos.clone().sub(bigTangent);
      const e = guide.pos.clone().add(bigTangent);
      const objGeom = new Line2D([[s.x, s.y], [e.x, e.y]], {
        distances: true
      });
      _fixLine2DDistances(objGeom);
      const objMat = this.materials.snapGuides;
      const objMesh = new Mesh(objGeom, objMat);
      combinedGuidesObj.add(objMesh);
    });
    this._snapGuides = combinedGuidesObj;
    this.scene.add(combinedGuidesObj);
  }
  _clearSnapGuides () {
    if (this._snapGuides) {
      this.scene.remove(this._snapGuides);
      _disposeMesh(this._snapGuides);
      this._snapGuides = null;
    }
  }
  _removeEntityFromScene (id) {
    const sceneEntity = this.sceneEntityMap[id];
    if (sceneEntity) {
      this.sceneEntityMap[id] = undefined;
      // Object3D.remove is O(n), might be slow, but ok for now
      this.scene.remove(sceneEntity);
      _disposeMesh(sceneEntity);
      // buggy since it can occur during traversal - probably need a way to
      // swap to WeakMap or a way to defer this until after each cycle
      // remove undefined entries from entity map every so often
      // if ((++this._numRemoves) % 10000 === 0) {
      // this.sceneEntityMap = cleanMap(this.sceneEntityMap);
      // }
    }
  }
  constructPointObject (point) {
    const point3 = new Vector3(point.get("x"), point.get("y"), 1);
    const positions = new Float32Array(3);
    positions[0] = point3.x;
    positions[1] = point3.y;
    positions[2] = point3.z;
    const objGeom = new BufferGeometry();
    objGeom.addAttribute("position", new THREE.BufferAttribute( positions, 3 ) );
    const objMat = this.materials.point;
    const objMesh = new Points(objGeom, objMat);
    return objMesh;
  }
  constructBoundaryObject (boundary, points) {
    const start = points.get(boundary.get("start"));
    const end = points.get(boundary.get("end"));
    if (!start || !end) {
      return null;
    }
    const startPoint = start.toJS();
    const endPoint = end.toJS();
    let boundaryPoints;
    if (boundary.get("arc")) {
      const midPoints = boundary.getArcPoints(points);
      boundaryPoints = [startPoint].concat(midPoints).concat([endPoint]);
    }
    else {
      boundaryPoints = [startPoint, endPoint];
    }
    const objGeom = new Line2D(
      boundaryPoints.map(p => ([p.x, p.y])),
      { distances: true }
    );
    // make sure dash coordinates match spatial distance
    _fixLine2DDistances(objGeom);
    const objMat = this.materials[`${boundary.get("boundaryType")}Line`] || this.materials.baseLine;
    const objMesh = new Mesh(objGeom, objMat);
    return objMesh;
  }
  constructRegionObject (region, entities) {
    const combinedPoints = [];
    region.getPerimeterLoopPointOrder(entities, 1)
    .forEach(idOrVectorArr => {
      if (Array.isArray(idOrVectorArr)) {
        combinedPoints.push(...idOrVectorArr);
      }
      else {
        combinedPoints.push(entities.get(idOrVectorArr).toVector3());
      }
    });
    const holeIndices = [];
    region.getHolePointOrders(entities, 1)
    .forEach(h => {
      holeIndices.push(combinedPoints.length);
      h.forEach(idOrVectorArr => {
        if (Array.isArray(idOrVectorArr)) {
          combinedPoints.push(...idOrVectorArr);
        }
        else {
          combinedPoints.push(entities.get(idOrVectorArr).toVector3());
        }
      });
    });
    const triangles = earcut(combinedPoints.reduce((pts, { x, y }) => pts.concat([x, y]), []), holeIndices, 2);
    const objGeom = new Geometry();
    combinedPoints.forEach(p => objGeom.vertices.push(p));
    for (let i=0; i<triangles.length; i+=3) {
      objGeom.faces.push(new Face3(
        triangles[i],
        triangles[i+1],
        triangles[i+2]
      ));
    }
    const objMesh = new Mesh(objGeom, this.materials.region);
    objMesh.position.setZ(-5);
    return objMesh;
  }
  constructPermanentObject (obj) {
    const objVertsArrays = getObjectVertices(obj);
    const objVerts = objVertsArrays[0];
    const geom = new Line2D(
      objVerts.map(v=>[v.x, v.y]),
      { distances: true }
    );
    const mat = this.materials[`${obj.get("objectType")}Line`] || this.materials.objectLine;
    const objMesh = new Mesh(geom, mat);
    objMesh.position.setZ(0);
    if (objVertsArrays.length > 1) {
      objVertsArrays.slice(1).forEach(verts => {
        const subGeom = new Line2D(
          verts.map(v=>[v.x, v.y]),
          { distances: true }
        );
        objMesh.add(new Mesh(subGeom, mat));
      });
    }
    return objMesh;
  }
  constructBackgroundImageObject (bg) {
    return new Promise((resolve) =>
      this.textureLoader.load(bg.get("url"), tex => {
        tex.magFilter = NearestFilter;
        tex.minFilter = LinearFilter;
        const img = tex.image;
        let bgSize;
        const autoSize = bg.get("autoSizeOnLoad");
        if (autoSize) {
          let bgSizeConstraints = autoSize;
          if (Array.isArray(bgSizeConstraints)) {
            bgSizeConstraints = {
              width: autoSize[0],
              height: autoSize[1]
            };
          }
          bgSize = {
            width: img.naturalWidth,
            height: img.naturalHeight
          };
          const wFactor = bgSize.width / bgSizeConstraints.width;
          const hFactor = bgSize.height / bgSizeConstraints.height;
          const sizeFactor = Math.max(wFactor, hFactor);
          bgSize.width /= sizeFactor;
          bgSize.height /= sizeFactor;
        }
        else {
          bgSize = {
            width: bg.get("width") || 1000,
            height: bg.get("height") || 1000
          };
        }
        const bgOffset = new Vector2(
          bg.get("centerX") || 500,
          bg.get("centerY") || 500
        );
        const bgGeom = new PlaneGeometry(bgSize.width, bgSize.height, 2, 2);
        const bgMat = new MeshBasicMaterial({
          map: tex,
          side: DoubleSide,
          transparent: true,
          opacity: 0.2
        });
        bgGeom.rotateX(Math.PI);
        const bgMesh = new Mesh(bgGeom, bgMat);
        bgMesh.position.copy(new Vector3(bgOffset.x, bgOffset.y, -2));
        bgMesh.name = "backgroundImage";
        this._bgMaterials[bg.get("id")] = bgMat;
        console.log(bgMesh);
        resolve(bgMesh);
      }
      ));
  }
  constructCanvasBorderObject (cb) {
    const cbSize = {
      width: cb.get("width") || 2400,
      height: cb.get("height") || 1600
    };
    const cbOffset = new Vector2(
      cb.get("centerX") || 1200,
      cb.get("centerY") || 800
    );
    const cbPlane = new PlaneGeometry(cbSize.width, cbSize.height, 2, 2);
    const cbPath = [
      [cbPlane.vertices[0].x, cbPlane.vertices[0].y],
      [cbPlane.vertices[2].x, cbPlane.vertices[2].y],
      [cbPlane.vertices[8].x, cbPlane.vertices[8].y],
      [cbPlane.vertices[6].x, cbPlane.vertices[6].y]
    ];
    const cbMat = this.materials["canvas-border"];
    const cbGeom = new Line2D(
      cbPath,
      { distances: true, closed: true }
    );
    const cbMesh = new Mesh( cbGeom, cbMat );
    cbMesh.position.copy(new Vector3(cbOffset.x, cbOffset.y, -3));
    return cbMesh;
  }
  loadTextAssets () {
    this._fontsLoaded = false;
    this._fnt = this._fntTex = null;
    Promise.all([
      new Promise((res, rej) => loadFont(
        opensansFnt,
        (err, fnt) => err ? rej(err) : res(fnt))
      ),
      new Promise((res, rej) => this.textureLoader.load(
        opensansPng,
        tex => tex ? res(tex) : rej(new Error())
      ))
    ])
    .then(([font, tex]) => {
      this._font = font;
      this._fontMaterial = new MeshBasicMaterial({
        map: tex,
        transparent: true,
        color: 0xffffff,
        opacity: 0.5
      });
      this._fontsLoaded = true;
      this._addAllPendingLabels();
      if (this.onAsyncLoadFinished){
        this.onAsyncLoadFinished();
      }
    });
  }
  _addAllPendingLabels () {
    const { scale = 1 } = this._latestFloorState;
    this._idsPendingFontLoad.forEach(id => {
      const entity = this._latestCombinedFloorEntities.get(id);
      const sceneEntity = this.sceneEntityMap[id];
      if (!entity || !sceneEntity) {
        return;
      }
      const objLabelMesh = this.constructLabel(
        entity,
        this._latestCombinedFloorEntities,
        scale
      );
      if (objLabelMesh) {
        sceneEntity.children.push(objLabelMesh);
      }
    });
  }
  constructLabel (entity, entities, floorScale=1, units="", labelScale=0.1) {
    if (!this.labelsEnabled) {
      return;
    }

    // handle labels queued for addition on asset load
    if (!this._font || !this._fontMaterial) {
      this._idsPendingFontLoad.push(entity.get("id"));
      return;
    }
    if (entity.get("type") !== "boundary") {
      return;
    }

    const boundaryLength = entity.getLength(entities) * floorScale;

    // decrease size of small boundaries to declutter floorplans
    let sizeRatioBias = 1;
    if (boundaryLength < 10) {
      sizeRatioBias = 0.5;
    }
    else if (boundaryLength < 50) {
      sizeRatioBias = 0.8;
    }
    let offsetMultiplier = 1;
    let displayValue = `${Math.round(boundaryLength)}`;

    if (units === IMPERIAL_FEET_INCHES){
      const lengthInFeet = boundaryLength / 12;
      const feet = lengthInFeet|0;
      const inches = Math.round((lengthInFeet % 1) * 12);
      displayValue = `${feet}' ${inches}"`;
      offsetMultiplier = 0.75;
    }

    // create length text, position at center of boundary
    const geom = createTextGeometry({
      align: "left",
      font: this._font,
      text: displayValue
    });
    geom.computeBoundingBox();
    const labelMesh = new Mesh(geom, this._fontMaterial);
    labelMesh.scale.multiplyScalar(labelScale * sizeRatioBias);
    const startPoint = entities.get(entity.get("start")).toVector3();
    const endPoint = entities.get(entity.get("end")).toVector3();
    const delta = endPoint.clone().sub(startPoint);
    const normal = new Vector3(-delta.y, delta.x, 0).normalize();
    const centerPoint = startPoint.clone().add(endPoint).multiplyScalar(0.5);
    centerPoint.add(normal.clone().multiplyScalar(entity.get("arc") || 0));
    labelMesh.position
    .copy(centerPoint)
    .sub(geom.boundingBox.getCenter().multiplyScalar(labelScale * sizeRatioBias))
    .setZ(3);

    // make labels readable by offsetting them to the side of their boundaries
    let textOffset = normal.clone();
    if (normal.y < 0) {
      textOffset.multiplyScalar(-1);
    }
    textOffset
    .multiply(geom.boundingBox.getSize())
    .multiplyScalar(labelScale * offsetMultiplier * sizeRatioBias);
    labelMesh.position.add(textOffset);
    return labelMesh;
  }
  disposeAll () {
    this._pointRefCounts = {};
    Object.keys(this.sceneEntityMap)
    .forEach(k => this._removeEntityFromScene(k));
    // TODO dispose of materials
  }
}
