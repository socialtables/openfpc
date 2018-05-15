// curated
const debug = require("debug")("openfpc:lib:collision-resolver-maintainer");
import { Box2, Vector2 } from "three";
import { Map } from "immutable";
import shallowImmutableDiff from "../lib/immutable-map-diff";
import CollisionResolver from "./collision-resolver";
import { getObjectVertices } from "./permanent-object-shapes";

/**
 * 2D collision resolver maintainer - provides an on-demand sync utility to
 * update a collision resolver to match a given floor state with pending
 * changes not applied (in contrast to the Three.JS scene maintainer).
 */
export default class CollisionResovlerMaintainer {
  constructor () {
    this.bbox = new Box2(new Vector2(0, 0), new Vector2(0, 0));
    this.cr = new CollisionResolver(this.bbox);
    this._latestFloorState = null;
  }
  set pointRadius (val) {
    this.cr.pointRadius = val;
  }
  get pointRadius () {
    return this.cr.pointRadius;
  }
  set lineRadius (val) {
    this.cr.lineRadius = val;
  }
  get lineRadius () {
    return this.cr.lineRadius;
  }
  getResolver() {
    return this.cr;
  }
  syncFloorState (floorState) {
    // no-op if states match
    if (floorState === this._latestFloorState) {
      return;
    }

    // figure out what changed
    debug("getting diffs");
    const { entities } = floorState;
    const prevEntities = this._latestFloorState ? this._latestFloorState.entities : Map();
    let [
      addedEntities,
      updatedEntities,
      removedEntities
    ] = shallowImmutableDiff(prevEntities, entities);
    this._latestFloorState = floorState;

    // apply current state, but not pending changes
    debug("applying diffs");
    const _getBoundPoints = (b) => {
      const startPoint = entities.get(b.start).toJS();
      const endPoint = entities.get(b.end).toJS();
      if (b.get("arc")) {
        const midPoints = b.getArcPoints(entities);
        return [startPoint].concat(midPoints).concat([endPoint]);
      }

      return [startPoint, endPoint];

    };

    // calculate the update's bounding box based on points, boundary arcs
    const tmpPoint = new Vector2();
    const updateBBox = new Box2();
    addedEntities.valueSeq().concat(updatedEntities.valueSeq()).forEach(e => {
      const entityType = e.get("type");
      if (entityType === "point") {
        tmpPoint.x = e.get("x");
        tmpPoint.y = e.get("y");
        updateBBox.expandByPoint(tmpPoint);
      }
      else if (entityType === "boundary") {
        if (e.get("arc")) {
          _getBoundPoints(e).forEach(p => updateBBox.expandByPoint(p));
        }
      }
    });

    // if the update forces bbox expansion, just rebuild collision resolver
    let cr = this.cr;
    if (!this.bbox.containsBox(updateBBox)) {
      debug("expanding scene bounding box, rebuilding CR");
      this.bbox.union(updateBBox);
      cr = this.cr = new CollisionResolver(this.bbox);
      entities.valueSeq().forEach(e => {
        switch (e.get("type")) {
        case "point":
          cr.addPoint(e.get("id"), e.toJS());
          break;
        case "boundary":
          cr.addLine(e.get("id"), _getBoundPoints(e));
          break;
        case "object":
          if (e.get("objectType") === "window") {
            cr.addLine(e.get("id"), getObjectVertices(e)[0], 2);
            break;
          }
          cr.addMultiRegion(e.get("id"), getObjectVertices(e));
          break;
        case "region":
          cr.addRegion(
            e.get("id"),
            e.getPerimeterLoopPointOrder(entities, false)
            .reduce((pts, pnt) => Array.isArray(pnt) ?
              pts.concat(pnt) :
              pts.concat(entities.get(pnt).toVector3()),
            []
            ),
            e.getNestDepth(entities)
          );
          break;
        default:
          break;
        }
      });
      debug("finished rebuilding CR");
      return;
    }

    // if a point updates, its boundaries must be updated
    if (updatedEntities.count()) {
      const updatedPoints = updatedEntities.filter(e => e.type === "point");
      if (updatedPoints.count()) {
        const linkedBoundsByID = {};
        floorState.getLinkedBoundaries(updatedPoints).forEach(b => linkedBoundsByID[b.get("id")] = b);
        updatedEntities = updatedEntities.merge(new Map(linkedBoundsByID));
      }
    }

    // otherwise, just apply the updates
    debug("applying incremental CR update");
    addedEntities.valueSeq()
    .concat(updatedEntities.valueSeq())
    .forEach(e => {
      const entityType = e.get("type");
      if (entityType === "point") {
        cr.addPoint(e.get("id"), new Vector2().copy(e.toJS()));
      }
      else if (entityType === "boundary") {
        cr.addLine(e.get("id"), _getBoundPoints(e));
      }
      else if (entityType === "object") {
        if (e.get("objectType") === "window") {
          cr.addLine(e.get("id"), getObjectVertices(e)[0], 2);
          return;
        }
        cr.addMultiRegion(e.get("id"), getObjectVertices(e));
      }
      else if (entityType === "region") {
        cr.addRegion(
          e.get("id"),
          e.getPerimeterLoopPointOrder(entities, 1)
          .reduce((pts, pnt) => Array.isArray(pnt) ?
            pts.concat(pnt) :
            pts.concat(entities.get(pnt).toVector3()),
          []
          ),
          e.getNestDepth(entities)
        );
      }
    });
    removedEntities.valueSeq().forEach(e => {
      cr.remove(e.get("id"));
    });

    debug("finished updating CR");
  }
}
