import {
  SELECT_TOOL,
  DESELECT_TOOL,
  APPLY_COLOR_SCHEME,
  OPEN_OPTIONS_DIALOG,
  CLOSE_OPTIONS_DIALOG,
  OPEN_HOTKEY_INFO_DIALOG,
  CLOSE_HOTKEY_INFO_DIALOG,
  SET_NEW_BOUNDARY_TYPE,
  SET_NEW_OBJECT_TYPE,
  COPY_ENTITIES,
  SET_SNAPPING_ENABLED,
  UPDATE_PENDING_ENTITIES,
  APPLY_PENDING_ENTITY_UPDATES
} from "../constants";
import {
  FLOOR_LOADED
} from "../constants/load-save";
import {
  ADD_BOUNDARY_TOOL_NAME,
  ADD_OBJECT_TOOL_NAME,
  PAN_TOOL_NAME
} from "../constants/tools";
import { initialEditorState } from "./initial-state";

// this goes in another file
const editorReducer = (state = initialEditorState, action) => {
  switch (action.type) {
  case SELECT_TOOL:
    if (action.toolName === PAN_TOOL_NAME) {
      return state.merge({
        activeTool: state.getIn(["tools", action.toolName], null)
      });
    }
    return state.merge({
      activeTool: state.getIn(["tools", action.toolName], null),
      fallbackTool: state.getIn(["tools", action.toolName], null)
    });
  case DESELECT_TOOL:
    return state.merge({
      activeTool: state.get("fallbackTool")
    });
  case APPLY_COLOR_SCHEME:
    return state.merge({
      "colorScheme": action.colorScheme
    });
  case OPEN_OPTIONS_DIALOG:
    return state.set("optionsDialogOpen", true);
  case CLOSE_OPTIONS_DIALOG:
    return state.set("optionsDialogOpen", false);
  case OPEN_HOTKEY_INFO_DIALOG:
    return state.set("hotkeyInfoDialogOpen", true);
  case CLOSE_HOTKEY_INFO_DIALOG:
    return state.set("hotkeyInfoDialogOpen", false);
  case FLOOR_LOADED:
    return state.set("sceneFrame", new Date());
  case SET_NEW_BOUNDARY_TYPE:
    return state.merge({
      newBoundaryType: action.boundaryType,
      activeTool: state.getIn(["tools", ADD_BOUNDARY_TOOL_NAME], null),
      fallbackTool: state.getIn(["tools", ADD_BOUNDARY_TOOL_NAME], null)
    });
  case SET_NEW_OBJECT_TYPE:
    return state.merge({
      newObjectType: action.objectType,
      activeTool: state.getIn(["tools", ADD_OBJECT_TOOL_NAME], null),
      fallbackTool: state.getIn(["tools", ADD_OBJECT_TOOL_NAME], null)
    });
  case COPY_ENTITIES:
    return state.set("copyAndPasteEntities", action.entities);
  case SET_SNAPPING_ENABLED:
    return state.set("enableSnapGuides", action.enabled || false);
  case UPDATE_PENDING_ENTITIES:
    return state.set("visibleSnapGuides", action.visibleSnapGuides || null);
  case APPLY_PENDING_ENTITY_UPDATES:
    return state.set("visibleSnapGuides", null);
  default:
    return state;
  }
};

export default editorReducer;
