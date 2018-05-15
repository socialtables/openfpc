import { Map } from "immutable";
import { SELECT_TOOL_NAME } from "../constants/tools";
import * as tools from "../tools";
import Scene from "../model/scene";
import CanvasBorder from "../model/canvas-border";

const initialCanvas = new CanvasBorder({
  width: 1200,
  height: 1200
});
export const initialFloorState = new Scene().addEntities([initialCanvas]);

// remap tool classes to instances (not a great pattern)
const toolMap = Object.keys(tools)
.map(k => new tools[k]())
.reduce((o, t) => { o[t.name]= t; return o; }, {});

// start with all tools in state, first tool active
export const initialEditorState = new Map({
  tools: Map(toolMap),
  activeTool: toolMap[SELECT_TOOL_NAME],
  fallbackTool: toolMap[SELECT_TOOL_NAME],
  externalEventEmitter: null,
  copyAndPasteEntities: null,
  colorScheme: null,
  sceneFrame: [2400, 1600],
  optionsDialogOpen: false,
  hotkeyInfoDialogOpen: false,
  newBoundaryType: "wall",
  newObjectType: "door",
  enableSnapGuides: false,
  visibleSnapGuides: null
});

export const initialLoadSaveState = new Map({
  currentFileName: null,
  currentFilePath: null,
  onLoadFile: null,
  onSaveFile: null
});

// for mocking the store in tests
export const defaultState = {
  floor: initialFloorState,
  editor: initialEditorState,
  loadSave: initialLoadSaveState
};
