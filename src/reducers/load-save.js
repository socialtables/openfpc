import {
  FLOOR_LOADED,
  FLOOR_SAVED,
  SET_LOAD_SAVE_CALLBACKS
} from "../constants/load-save";
import {
  initialLoadSaveState
} from "./initial-state";

export default function loadSaveReducer (state = initialLoadSaveState, action) {
  switch (action.type) {
  case FLOOR_LOADED:
  case FLOOR_SAVED:
    return state.merge({
      currentFileName: action.fileName || null,
      currentFilePath: action.filePath || null
    });
  case SET_LOAD_SAVE_CALLBACKS:
    return state.merge({
      onLoadFile: (action.onLoadFile !== undefined) ?
        action.onLoadFile :
        state.get("onLoadFile"),
      onSaveFile: (action.onSaveFile !== undefined) ?
        action.onSaveFile :
        state.get("onSaveFile")
    });
  default:
    return state;
  }
}
