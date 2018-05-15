import { combineReducers } from "redux";
import editorReducer from "./editor";
import floorReducer from "./floor";
import loadSaveReducer from "./load-save";

export default combineReducers({
  editor: editorReducer,
  floor: floorReducer,
  loadSave: loadSaveReducer
});
