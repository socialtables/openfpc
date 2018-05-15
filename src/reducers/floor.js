import { Set } from "immutable";
import undoable, { includeAction } from "redux-undo";
import {
  LOAD_FLOORPLAN,
  SELECT_ENTITIES,
  DESELECT_ENTITIES,
  DELETE_ENTITIES,
  UPDATE_PENDING_ENTITIES,
  APPLY_PENDING_ENTITY_UPDATES,
  MODIFY_ENTITIES,
  ADD_ENTITIES,
  PASTE_ENTITIES,
  SET_FLOOR_SCALE,
  SET_UNITS,
  CALCULATE_REGIONS,
  DISCARD_REGIONS,
  SET_NEW_BOUNDARY_TYPE,
  SET_NEW_OBJECT_TYPE
} from "../constants";
import {
  FLOOR_LOADED
} from "../constants/load-save";
import { initialFloorState } from "./initial-state";
import { Scene } from "../model";

const floorDataReducer = (state = initialFloorState, action) => {
  switch (action.type) {
  case FLOOR_LOADED:
    return Scene.fromJS(action.data).discardRegions();
  case SELECT_ENTITIES:
    return state.set("selection", action.selection);
  case SET_NEW_BOUNDARY_TYPE:
  case SET_NEW_OBJECT_TYPE:
  case DESELECT_ENTITIES:
    return state.set("selection", new Set());
  case DELETE_ENTITIES:
    return state.set("hasChanges", true).removeEntities(action.entities);
  case UPDATE_PENDING_ENTITIES:
    return state.set("pendingChanges", action.entities);
  case APPLY_PENDING_ENTITY_UPDATES:
    if (action.finalEntitiesUpdate) {
      return state
      .merge({
        "pendingChanges": action.finalEntitiesUpdate,
        "hasChanges": true
      })
      .mergePendingChanges(action.removeEntityIDs);
    }
    return state.set("hasChanges", true).mergePendingChanges(action.removeEntityIDs);
  case MODIFY_ENTITIES: {
    const changedState = action.isUserChange
      ? state.set("hasChanges", true)
      : state.set("hasChanges", false);
    return changedState.mergeImmediate(action.entities);
  }
  case ADD_ENTITIES:
    return state.set("hasChanges", true).addEntities(action.entities);
  case PASTE_ENTITIES:
    return state.set("hasChanges", true).pasteEntities(action.entities.map(e => {
      switch (e.get("type")) {
      case "point":
      case "object":
        return e.merge({
          x: e.get("x") + (action.offset || { x: 10 }).x,
          y: e.get("y") + (action.offset || { y: 10 }).y
        });
      default:
        return e;
      }
    }));
  case SET_FLOOR_SCALE:
    return state.merge({
      "scale": action.scale || 1,
      "hasChanges": true
    });
  case SET_UNITS:
    return state.set("hasChanges", true).swapUnits(action.units);
  case CALCULATE_REGIONS:
    return state.calculateRegions();
  case DISCARD_REGIONS:
    return state.discardRegions();
  default:
    return state;
  }
};

// add undo support to floor data
const undoableFloorDataReducer = undoable(floorDataReducer, {
  limit: 10,
  filter: includeAction([
    LOAD_FLOORPLAN,
    DELETE_ENTITIES,
    APPLY_PENDING_ENTITY_UPDATES,
    ADD_ENTITIES,
    MODIFY_ENTITIES,
    PASTE_ENTITIES,
    SELECT_ENTITIES,
    DESELECT_ENTITIES
  ]),
  initTypes: [
    "@@redux-undo/INIT"
  ]
});

export default undoableFloorDataReducer;
