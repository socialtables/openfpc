import {
  FLOOR_LOADED,
  FLOOR_SAVED,
  SET_LOAD_SAVE_CALLBACKS
} from "../constants/load-save";

export function loadFloor (data, fileName = null, filePath= null) {
  return {
    type: FLOOR_LOADED,
    data,
    fileName,
    filePath
  };
}

export function saveFloor (fileName, filePath) {
  return {
    type: FLOOR_SAVED,
    fileName,
    filePath
  };
}

export function setLoadSaveCallbacks ({ onLoadFile, onSaveFile }) {
  return {
    type: SET_LOAD_SAVE_CALLBACKS,
    onLoadFile,
    onSaveFile
  };
}
