import { Record, Map, Set, List, isImmutable } from "immutable";
import shortid from "shortid";
import { resolveRooms } from "../lib/floor-geometry/room-traversal";
import {
  IMPERIAL_INCHES,
  IMPERIAL_FEET_INCHES,
  METRIC,
  IMPERIAL_METRIC_MULTIPLIER
} from "../constants";
import {
  Point,
  Boundary,
  PermanentObject,
  Region,
  CanvasBorder,
  BackgroundImage
} from "./";

// scene graph
export default class Scene extends Record({
  entities: new Map(),
  selection: new Set(),
  pendingChanges: null,
  scale: 1,
  units: IMPERIAL_INCHES,
  rotation: 0
}) {
  static fromJS (raw) {
    return new Scene({ scale: raw && raw.scale || 1 }).appendFromJS(raw);
  }
  appendFromJS ({
    scale = 1,
    points = [],
    boundaries = [],
    objects = [],
    regions = [],
    backgroundImages = [],
    withErrors = false
  } = {}) {
    const newPoints = {};
    const newBoundaries = {};
    const newObjects = {};
    const newRegions = {};
    const newBackgroundImages = {};
    const errors = [];
    const oldPointIDsToNew = {};
    const oldBoundIDsToNew = {};
    const oldRegionIDsToNew = {};

    points.forEach(pOld => {
      const pNew = Point.fromJS(pOld);
      newPoints[pNew.get("id")] = pNew;
      oldPointIDsToNew[pOld.id] = pNew.get("id");
    });
    const newPointMap = new Map(newPoints);
    boundaries.forEach(bOld => {
      const newStartId = oldPointIDsToNew[bOld.start];
      const newEndId = oldPointIDsToNew[bOld.end];
      if (newStartId && newEndId) {
        const bNew = Boundary.fromJS(bOld)
        .set("start", oldPointIDsToNew[bOld.start])
        .set("end", oldPointIDsToNew[bOld.end]);
        newBoundaries[bNew.get("id")] = bNew;
        oldBoundIDsToNew[bOld.id] = bNew.get("id");
      }
      else {
        errors.push({
          error: "broken boundary endpoint reference",
          data: bOld
        });
      }
    });
    objects.forEach(oOld => {
      let oNew = PermanentObject.fromJS(oOld);
      if (oOld.boundary) {
        const bNewID = oldBoundIDsToNew[oOld.boundary];
        if (bNewID) {
          const bNew = newBoundaries[bNewID];
          oNew = oNew
          .set("attachedToBoundary", bNewID)
          .alignToBoundary(bNew, newPointMap);
        }
        else {
          errors.push({
            error: "broken object boundary reference",
            data: oOld
          });
        }
      }
      newObjects[oNew.get("id")] = oNew;
    });
    regions.forEach(rOld => {
      let regionMissingBound = false;
      const getBound = oldId => {
        const newId = oldBoundIDsToNew[oldId];
        if (newId) {
          return newId;
        }
        regionMissingBound = true;
      };
      let perimeterBoundariesArr = [];
      let interiorBoundariesArr = [];
      let holesArr = [];
      if (rOld.boundaries.perimeter) {
        perimeterBoundariesArr = rOld.boundaries.perimeter.map(getBound);
      }
      if (rOld.boundaries.interior) {
        interiorBoundariesArr = rOld.boundaries.interior.map(getBound);
      }
      if (rOld.boundaries.holes) {
        holesArr = rOld.boundaries.holes.map(h => h.map(getBound));
      }
      if (regionMissingBound) {
        errors.push({
          error: "broken region boundary reference",
          region: rOld
        });
        return;
      }
      const rNew = Region.fromJS({
        perimeterBoundaries: new List(perimeterBoundariesArr),
        interiorBoundaries: new List(interiorBoundariesArr),
        holes: new List(holesArr.map(h => new List(h)))
      });
      newRegions[rNew.get("id")] = rNew;
      oldRegionIDsToNew[rOld.id] = rNew.get("id");
    });
    regions.forEach(rOld => {
      if (rOld.parent) {
        const rNew = newRegions[oldRegionIDsToNew[rOld.id]];
        const rNewParentID = oldRegionIDsToNew[rOld.parent];
        if (!rNewParentID) {
          errors.push({
            error: "broken region parent reference",
            region: rOld
          });
          return;
        }
        newRegions[rNew.id] = rNew.set("parent", rNewParentID);
      }
    });

    Object.keys(backgroundImages).forEach(oldID => {
      const bgOld = backgroundImages[oldID];
      const oNew = BackgroundImage.fromJS(bgOld);
      newBackgroundImages[oNew.get("id")] = oNew;
    });

    const canvasBorders = {};
    const cb = CanvasBorder.fromJS();
    canvasBorders[cb.get("id")] = cb;

    const newEntitiesMerged = Object.assign(
      {},
      newPoints,
      newBoundaries,
      newObjects,
      newRegions,
      newBackgroundImages,
      canvasBorders
    );

    const newState = this.merge({
      entities: this.get("entities").merge(newEntitiesMerged),
      scale
    });
    if (withErrors) {
      return [newState, errors];
    }

    if (errors.length) {
      console.warn("errors occurred while appending floor", errors); // eslint-disable-line no-console
    }

    return newState;
  }

  toJS () {
    let scale = this.get("scale") || 1;
    if (this.get("units") === METRIC) {
      scale /= IMPERIAL_METRIC_MULTIPLIER;
    }
    return {
      scale,
      points: this.getEntitiesOfType("point")
      .valueSeq()
      .toJS()
      .map(({ id, x, y }) => ({ id, x, y })),
      boundaries: this.getEntitiesOfType("boundary")
      .valueSeq()
      .toJS()
      .map(({ id, start, end, boundaryType, arc }) => ({
        id,
        type: boundaryType,
        start: start,
        end: end,
        arc: arc
      })),
      objects: this.getEntitiesOfType("object")
      .valueSeq()
      .toJS()
      .map(({
        id, x, y, objectType, width, height, rotation, attachedToBoundary,
        attachedToRegions, isFlippedX
      }) => ({
        id,
        type: objectType,
        x,
        y,
        width,
        height,
        rotation,
        boundary: attachedToBoundary || null,
        regions: attachedToRegions || [],
        isFlippedX
      })),
      regions: this.getEntitiesOfType("region")
      .valueSeq()
      .toJS()
      .map(({
        id,
        perimeterBoundaries,
        interiorBoundaries,
        holes,
        parent
      }) => ({
        id,
        parent,
        boundaries: {
          perimeter: perimeterBoundaries,
          interior: interiorBoundaries,
          holes: holes
        }
      }))
    };
  }

  // removes points that are not connected to a boundary
  removeOrphanPoints () {
    const currentEntities = this.get("entities");
    const pointsReferenced = {};
    currentEntities.valueSeq().forEach(e => {
      if (e.get("type") === "boundary") {
        pointsReferenced[e.get("start")] = true;
        pointsReferenced[e.get("end")] = true;
      }
    });
    const entities = currentEntities.filter(e => (
      (e.get("type") !== "point") ||
      (pointsReferenced[e.get("id")])
    ));
    const selection = this.get("selection").filter(id => entities.get(id));
    return this.merge({
      entities,
      selection
    });
  }

  // resolves a Map of points connected to the provided entities
  // entities should be boundaries, others are ignored
  getLinkedPoints (entities) {
    const pointMap = {};
    const allEntities = this.get("entities");
    entities.valueSeq().forEach(e => {
      if (e.get("type") === "boundary") {
        const start = e.get("start");
        const end = e.get("end");
        const startPoint = allEntities.get(start);
        const endPoint = allEntities.get(end);
        pointMap[startPoint.get("id")] = startPoint;
        pointMap[endPoint.get("id")] = endPoint;
      }
    });
    return new Map(pointMap);
  }
  getLinkedPointsSeq (entities) {
    return this.getLinkedPoints(entities).valueSeq();
  }

  // resolves a Map of boundaries connected to the provided entities
  // entities should be points or objects, others are ignored
  getLinkedBoundaries (entities) {
    const boundMap = {};
    this.getLinkedBoundariesSeq(entities)
    .forEach(b => boundMap[b.get("id")] = b);
    return new Map(boundMap);
  }
  getLinkedBoundariesSeq (entities) {
    return this.get("entities")
    .valueSeq()
    .filter(e => (
      (e.get("type") === "boundary") &&
        (entities.get(e.get("start")) || entities.get(e.get("end")))
    ));
  }

  // resolves a Map of objects connected to the provided entities
  // entities should be boundaries
  getLinkedObjects (entities) {
    const objMap = {};
    this.getLinkedObjectSeq(entities)
    .forEach(o => objMap[o.get("id")] = o);
    return new Map(objMap);
  }
  getLinkedObjectSeq (entities) {
    return this.get("entities")
    .valueSeq()
    .filter(e => (
      (e.get("type") === "object") &&
        entities.get(e.get("attachedToBoundary"))
    ));
  }

  // removes stuff
  removeEntities (entities) {
    const rmSet = entities;
    const rmBoundSeq = this.getLinkedBoundariesSeq(rmSet).map(b => b.get("id"));
    const rmObjSeq = this.getLinkedObjectSeq(rmSet).map(o => o.get("id"));
    const rmSeq = rmSet.keySeq().concat(rmBoundSeq).concat(rmObjSeq);
    return this.set("entities", this.get("entities").removeAll(rmSeq));
  }

  // gets entities of a specific set of types
  getEntitiesOfType (...entityTypes) {
    return this.get("entities").filter(e => {
      for (let eti = 0; eti < entityTypes.length; eti++) {
        const entityType = entityTypes[eti];
        if (e.isEntityType(entityType)) {
          return true;
        }
      }
      return false;
    });
  }

  // helper for removing all regions fast
  discardRegions () {
    return this.set("entities", this.get("entities")
    .filter(e => e.get("type") !== "region")
    );
  }

  // merge edits in progress
  mergePendingChanges (removeEntities = null) {
    let pendingChanges = this.get("pendingChanges");
    if (!pendingChanges) {
      return this;
    }
    let updatedEntities = this.get("entities");
    // apply removes
    let removeIDs = {};
    if (removeEntities) {
      const rmSet = removeEntities;
      const rmBoundSeq = this.getLinkedBoundariesSeq(rmSet).map(b => b.get("id"));
      const rmObjSeq = this.getLinkedObjectSeq(rmSet).map(o => o.get("id"));
      const rmSeq = rmSet.keySeq().concat(rmBoundSeq).concat(rmObjSeq);
      rmSeq.forEach(rmid => removeIDs[rmid] = 1);
      updatedEntities = updatedEntities.removeAll(rmSeq);
    }
    // apply updates
    updatedEntities = updatedEntities.merge(pendingChanges);
    // apply object dependencies
    const boundariesWithUpdates = this.getLinkedBoundaries(updatedEntities)
    .merge(updatedEntities.filter(e => e.get("type") === "boundary"));
    const objectUpdates = this
    .getLinkedObjects(boundariesWithUpdates)
    .filter(o => !pendingChanges.get(o.get("id")) && !removeIDs[o.get("id")])
    .map(o => o.maintainAttachment(updatedEntities));
    updatedEntities = updatedEntities.merge(objectUpdates);

    return this.merge({
      entities: updatedEntities,
      pendingChanges: null
    });
  }

  mergeImmediate (changes) {
    let mergedEntities = this.get("entities").merge(changes);
    if (changes) {
      const imChanges = isImmutable(changes) ? changes : new Map(changes);
      const boundariesWithUpdates = this.getLinkedBoundaries(imChanges)
      .merge(imChanges.filter(e => e.get("type") === "boundary"));
      const objectUpdates = this.getLinkedObjects(boundariesWithUpdates)
      .filter(o => !imChanges.get(o.get("id")))
      .map(o => o.maintainAttachment(mergedEntities));
      mergedEntities = mergedEntities.merge(objectUpdates);
    }
    return this.merge({
      selection: this.get("selection").filter(e => mergedEntities.get(e)),
      entities: mergedEntities
    });
  }

  addEntities (entities) {
    if (Array.isArray(entities)) {
      const obj = {};
      entities.forEach(e => obj[e.get("id")] = e);
      return this.addEntities(obj);
    }
    return this.set("entities", this.get("entities").merge(entities));
  }

  pasteEntities (entities) {
    const remapped = this.relabel(entities);
    return this.merge({
      entities: this.get("entities").merge(remapped),
      selection: new Set(remapped.keySeq())
    });
  }

  calculateRegions (active = true, needsCleanup = true) {
    if (active) {
      return this.set(
        "entities",
        this.get("entities").merge(this.calculateRegions(false, needsCleanup))
      );
    }
    if (needsCleanup) {
      return this
      .removeEntities(this.getEntitiesOfType(
        "region",
        ["boundary", "dimension-line"]
      ))
      .removeOrphanPoints()
      .calculateRegions(active, false);
    }

    const traversalFloor = {
      data: {
        points: this.getEntitiesOfType("point")
        .valueSeq()
        .toJS()
        .map(({ x, y, id }) => ({ x, y, id })),
        boundaries: this.getEntitiesOfType("boundary")
        .valueSeq()
        .toJS()
        .map(({ start, end, id }) => ({ start, end, id }))
      }
    };

    // create raw regions from floor data and keep reference to enclosure tree
    // for object assignment
    const [rawNewRegions, encTree] = resolveRooms(traversalFloor);

    // convert back to immutable
    const newRegionsByRawId = {};
    let newRegionsArr = rawNewRegions.map(r => {
      const newRegion = new Region({
        perimeterBoundaries: new List(r.boundaries.perimeter),
        interiorBoundaries: new List(r.boundaries.interior),
        holes: new List(r.boundaries.holes.map(h => new List(h))),
        parent: r.parent_id
      });
      newRegionsByRawId[r.id] = newRegion;
      return newRegion;
    });
    // and assign parents
    newRegionsArr = newRegionsArr.map(r => (
      r.get("parent") ?
        r.set("parent", newRegionsByRawId[r.get("parent")].get("id")) :
        r
    ));
    newRegionsArr.forEach(r => newRegionsByRawId[r.get("id")] = r);

    // make map from boundaries to regions for object inclusion
    const boundIdToNewRegionIds = {};
    newRegionsArr.forEach(
      newR => (
        newR.get("perimeterBoundaries")
        .concat(newR.get("interiorBoundaries"))
        .concat(newR.get("holes").reduce((a, h) => a.concat(h)), new List())
      ).forEach(bId => {
        if (!boundIdToNewRegionIds[bId]) {
          boundIdToNewRegionIds[bId] = [];
        }
        boundIdToNewRegionIds[bId].push(newR.get("id"));
      })
    );

    // update permanent objects with region membership
    const objectsArr = this.getEntitiesOfType("object")
    .map(obj => {
      const x = obj.get("x");
      const y = obj.get("y");
      let objRegionIds = [];
      const rawRegionId = encTree.getEnclosingPolygonIDForPoint({x, y});
      if (rawRegionId) {
        const enclosingRegion = newRegionsByRawId[rawRegionId];
        objRegionIds.push(enclosingRegion.get("id"));
      }
      const attachedToBoundaryId = obj.get("attachedToBoundary");
      if (attachedToBoundaryId) {
        const attachedToRegions = boundIdToNewRegionIds[attachedToBoundaryId] ||
          [];
        attachedToRegions.forEach(rId => {
          if (objRegionIds.indexOf(rId) === -1) {
            objRegionIds.push(rId);
          }
        });
      }
      return obj.set("attachedToRegions", new List(objRegionIds));
    });

    // construct new entity mapping with region and parmanent object updates
    const entitiesMap = {};
    newRegionsArr.forEach(r => entitiesMap[r.get("id")] = r);
    objectsArr.forEach(obj => entitiesMap[obj.get("id")] = obj);
    return entitiesMap;
  }

  relabel (entities) {
    const newEntityMap = {};
    const idReMap = {};
    entities.forEach(e => {
      const remapped = e.set("id", shortid.generate());
      newEntityMap[remapped.get("id")] = remapped;
      idReMap[e.get("id")] = remapped.get("id");
    });
    entities.forEach(e => {
      const remapped = newEntityMap[idReMap[e.get("id")]];
      switch (remapped.get("type")) {
      case "boundary":
        newEntityMap[remapped.get("id")] = remapped.merge({
          start: idReMap[e.get("start")],
          end: idReMap[e.get("end")]
        });
        break;
      case "object":
        newEntityMap[remapped.get("id")] = remapped.merge({
          attachedToBoundary: e.get("attachedToBoundary") ?
            idReMap[e.get("attachedToBoundary")] :
            null
        });
        break;
      default:
        break;
      }
    });
    return new Map(newEntityMap);
  }
  getSplitBoundaryUpdates (boundary, splitPoint) {
    const ents = this.get("entities");
    const [boundA, boundB, splitBias] = boundary.splitAtPoint(ents, splitPoint);
    let allUpdates = new Map({
      [boundA.get("id")]: boundA,
      [boundB.get("id")]: boundB
    });
    const objectUpdates = this
    .getLinkedObjects(new Map({[boundary.get("id")]: boundary}))
    .map(o => {
      let oBias = o.get("attachedToBoundaryPos") || 0;
      let attachedToBoundary;
      if (oBias > splitBias) {
        attachedToBoundary = boundB.get("id");
        oBias = (oBias - splitBias) / ((1 - splitBias) || 1);
      }
      else {
        attachedToBoundary = boundA.get("id");
        oBias = oBias / (splitBias || 1);
      }
      return o.merge({
        attachedToBoundary,
        attachedToBoundaryPos: oBias
      });
    });
    return allUpdates.merge(objectUpdates);
  }
  getMergedPointUpdates (pointsToMerge) {
    const firstPoint = pointsToMerge.valueSeq().first();
    if (!firstPoint) {
      return [];
    }
    const firstPointID = firstPoint.get("id");
    const newEntityMap = {};
    const removeIDArr = pointsToMerge.keySeq().toJS().slice(1);
    this.getLinkedBoundariesSeq(pointsToMerge).forEach(linkedBoundary => {
      removeIDArr.push(linkedBoundary.get("id"));
      const startIncluded = pointsToMerge.get(linkedBoundary.get("start"));
      const endIncluded = pointsToMerge.get(linkedBoundary.get("end"));
      let newEntity;
      if (!startIncluded) {
        newEntity = new Boundary({
          start: linkedBoundary.get("start"),
          end: firstPointID,
          boundaryType: linkedBoundary.get("boundaryType"),
          arc: linkedBoundary.get("arc")
        });
      }
      else if (!endIncluded) {
        newEntity = new Boundary({
          start: firstPointID,
          end: linkedBoundary.get("end"),
          boundaryType: linkedBoundary.get("boundaryType"),
          arc: linkedBoundary.get("arc")
        });
      }
      if (newEntity) {
        newEntityMap[newEntity.get("id")] = newEntity;
      }
    });
    let removeIDSet = new Set(removeIDArr);
    // linked objects can just be removed for now, tackle later if needed
    removeIDSet = removeIDSet.merge(this.getLinkedObjects(removeIDSet).keySeq());
    return [new Map(newEntityMap), removeIDSet];
  }
  setRotation (direction) {
    const rotation = this.get("rotation");
    let newRotation;
    switch (direction) {
    case "clockwise":
      newRotation = rotation + 90 - ((rotation + 90) % 90);
      break;
    case "counterclockwise":
      newRotation = rotation - 90 - ((rotation - 90) % 90);
      break;
    case "bottom":
    case "top":
    case "left":
    case "right":
      newRotation = this.calculateBoundaryRotation(direction);
      break;
    default:
      newRotation = typeof direction === "number" ? direction : null;
    }
    newRotation = newRotation ? newRotation % 360 : newRotation;
    return this.set("rotation", newRotation);
  }
  swapUnits (swapTo=IMPERIAL_INCHES) {
    let next = this.set("units", swapTo);
    const swapFrom = this.get("units");
    const swapToImperial = swapTo === IMPERIAL_INCHES || swapTo === IMPERIAL_FEET_INCHES;
    const swapFromImperial = swapFrom === IMPERIAL_INCHES || swapFrom === IMPERIAL_FEET_INCHES;
    if ((swapFrom === METRIC) && swapToImperial) {
      next = next.set("scale", next.get("scale") / IMPERIAL_METRIC_MULTIPLIER);
    }
    else if ((swapTo === METRIC) && swapFromImperial) {
      next = next.set("scale", next.get("scale") * IMPERIAL_METRIC_MULTIPLIER);
    }
    return next;
  }
}
