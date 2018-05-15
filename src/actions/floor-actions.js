import { uniq } from "lodash";
import CollisionResolver from "../lib/collision-resolver";
import { Box2, Vector2 } from "three";
import {
  SELECT_ENTITIES,
  DESELECT_ENTITIES,

  DELETE_ENTITIES,
  MODIFY_ENTITIES,
  ADD_ENTITIES,

  // fired by tool
  UPDATE_PENDING_ENTITIES,
  APPLY_PENDING_ENTITY_UPDATES,

  COPY_ENTITIES,
  PASTE_ENTITIES,

  SET_FLOOR_SCALE,
  SET_UNITS,
  SET_ROTATION,
  SELECT_ROTATION_BOUNDARY,
  DESELECT_ROTATION_BOUNDARY,

  CALCULATE_REGIONS,
  DISCARD_REGIONS,
  CALCULATE_UNBOUNDED_ENTITIES,
  DISCARD_UNBOUNDED_ENTITIES,

  MARK_BOUNDARY_COLLISIONS
} from "../constants";

export const selectEntities = (selection, cursorPos) => ({
  type: SELECT_ENTITIES,
  selection,
  cursorPos
});

export const deselectEntities = () => ({
  type: DESELECT_ENTITIES
});

export const deleteEntities = (entities) => ({
  type: DELETE_ENTITIES,
  entities
});

export const addEntities = (entities) => ({
  type: ADD_ENTITIES,
  entities
});

export const updatePendingEntities = (entities, meta={}) => ({
  type: UPDATE_PENDING_ENTITIES,
  entities,
  // supports display of snapping guides during drag operations
  visibleSnapGuides: meta.snapGuides || null
});

export function applyPendingUpdate (
  finalEntitiesUpdate = null,
  removeEntityIDs = null
) {
  return {
    type: APPLY_PENDING_ENTITY_UPDATES,
    finalEntitiesUpdate,
    removeEntityIDs
  };
}

/**
 * @param  {Map}  entities     [The entities being modified.]
 * @param  {Boolean} [isUserChange=true] [Indicates whether to flag the scene as having user changes]
 */
export const modifyEntities = (entities, isUserChange = true) => ({
  type: MODIFY_ENTITIES,
  entities,
  isUserChange
});

export const copyEntities = () => (dispatch, getState) => {
  const floor = getState().floor.present;
  const selection = floor.get("selection");
  let entities = floor.get("entities");
  entities = entities.filter(e => selection.get(e.get("id")));
  entities = entities.merge(floor.getLinkedPoints(entities));
  dispatch({
    type: COPY_ENTITIES,
    entities
  });
};

export const pasteEntities = (offset) => (dispatch, getState) => {
  const entities = getState().editor.get("copyAndPasteEntities");
  if (entities) {
    dispatch({
      type: PASTE_ENTITIES,
      entities,
      offset
    });
  }
};

export const setFloorScale = (scale) => ({
  type: SET_FLOOR_SCALE,
  scale
});

export const setUnits = (units) => ({
  type: SET_UNITS,
  units
});

export const setRotation = (direction) => ({
  type: SET_ROTATION,
  direction
});

export const selectRotationBoundary = (boundary) => boundary ? ({
  type: SELECT_ROTATION_BOUNDARY,
  boundary
}) : ({
  type: DESELECT_ROTATION_BOUNDARY
});

export const calculateRegions = () => ({
  type: CALCULATE_REGIONS
});

export const discardRegions = () => ({
  type: DISCARD_REGIONS
});

export const calculateUnboundedEntities = () => ({
  type: CALCULATE_UNBOUNDED_ENTITIES
});

export const discardUnboundedEntities = () => ({
  type: DISCARD_UNBOUNDED_ENTITIES
});

// helper to check a given floor for collisions
function _getBoundaryCollisions (floor) {
  const entities = floor.get("entities");
  const bbox = new Box2(new Vector2(0, 0), new Vector2(0, 0));
  const cr = new CollisionResolver(bbox);
  function _getBoundPoints (b) {
    const startPoint = entities.get(b.start).toJS();
    const endPoint = entities.get(b.end).toJS();
    if (b.get("arc")) {
      const midPoints = b.getArcPoints(entities);
      return [startPoint].concat(midPoints).concat([endPoint]);
    }
    return [startPoint, endPoint];
  }
  // dump boundaries into collision resolver
  const idsAndBBoxes = [];
  entities
  .valueSeq()
  .filter(e => e.get("type") === "boundary")
  .forEach(ent => {
    const boundPoints = _getBoundPoints(ent);
    for (let i = 0; i < boundPoints.length - 1; i++) {
      const min = new Vector2(boundPoints[i].x, boundPoints[i].y);
      const max = new Vector2(boundPoints[i + 1].x, boundPoints[i + 1].y);
      idsAndBBoxes.push({
        id: ent.id,
        bBox: new Box2(min, max)
      });
    }
    cr.addLine(ent.id, boundPoints);
  });
  // test each boundary for collisions
  const allCollisions = [];
  idsAndBBoxes.forEach(({ id, bBox }) => {
    const cols = cr.checkCollisions(bBox, id);
    if (cols.collisions.length > 0) {
      allCollisions.push(cols.id);
      cols.collisions.forEach(col => allCollisions.push(col.id));
    }
  });
  // dedup collisions
  const uniqueCollisions = uniq(allCollisions);
  return uniqueCollisions;
}

// marks collisions in the viewport and rejects if there are any
export function markBoundaryCollisions () {
  return function _mark (dispatch, getState) {
    const floor = getState().floor.present;
    const collisions = _getBoundaryCollisions(floor);
    dispatch ({
      type: MARK_BOUNDARY_COLLISIONS,
      collisions
    });
    if (collisions.length > 0) {
      return Promise.reject(new Error("floor has collisions"));
    }
  };
}

/**
 * Helper to verify that data is in good shape prior to save
 */
export function runPreSaveIntegrityChecks ({
  checkCollisions = true,
  checkRegions = true,
  checkUnboundedEntities = true
} = {}) {
  return function _preSaveIntegrityChecks(dispatch, getState) {
    let floor = getState().floor.present;
    // we can actually do everythig here synchronously, which is good
    // later, if we allow correction during the save process, we can make it
    // all async
    if (checkCollisions) {
      const collisions = _getBoundaryCollisions(floor);
      dispatch ({
        type: MARK_BOUNDARY_COLLISIONS,
        collisions
      });
      if (collisions.length) {
        return Promise.reject(new Error("floor has collisions"));
      }
    }
    if (checkRegions) {
      dispatch(calculateRegions());
      floor = getState().floor.present;
    }
    if (checkUnboundedEntities) {
      dispatch(discardUnboundedEntities());
      dispatch(calculateUnboundedEntities());
      floor = getState().floor.present;
      const numUnbounded = floor
      .get("entities")
      .valueSeq()
      .filter(e => e.get("isUnbounded"))
      .count();
      if (numUnbounded > 0) {
        return Promise.reject(new Error("floor has unbounded entities"));
      }
    }
    return Promise.resolve();
  };
}
