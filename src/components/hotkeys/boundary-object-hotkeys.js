import PropTypes from "prop-types";
import filterInvalidDOMProps from "filter-invalid-dom-props";
import { HotKeys } from "react-hotkeys";
import { ActionCreators } from "redux-undo";

import {
  selectTool,
  deselectTool,
  setNewBoundaryType,
  setNewObjectType
} from "../../actions/ui-actions";
import { copyEntities, pasteEntities, deselectEntities } from "../../actions/floor-actions";

import {
  ADJUST_SCALE_TOOL_NAME,
  PAN_TOOL_NAME,
  SELECT_TOOL_NAME,
  WALL_BOUNDARY_TOOL_NAME,
  AIR_WALL_BOUNDARY_TOOL_NAME,
  RAILING_BOUNDARY_TOOL_NAME,
  BORDER_BOUNDARY_TOOL_NAME,
  STAIRS_BOUNDARY_TOOL_NAME,
  DOOR_OBJECT_TOOL_NAME,
  DOUBLE_DOOR_OBJECT_TOOL_NAME,
  ROUND_COLUMN_OBJECT_TOOL_NAME,
  SQUARE_COLUMN_OBJECT_TOOL_NAME,
  ELECTRICAL_OUTLET_OBJECT_TOOL_NAME,
  WINDOW_OBJECT_TOOL_NAME,
  RIGGING_OBJECT_TOOL_NAME
} from "../../constants/tools";

const keyMap = {
  undo: ["ctrl+z", "command+z"],
  redo: ["ctrl+shift+z", "command+shift+z"],
  copy: ["ctrl+c", "command+c"],
  paste: ["ctrl+v", "command+v"],

  selectTool: "esc",
  scaleTool: "c",
  panStart: {
    sequence: "space",
    action: "keydown"
  },
  panEnd: {
    sequence: "space",
    action: "keyup"
  },

  wallType: "w",
  airWallType: "e",
  railingType: "r",
  borderType: "t",
  stairsType: "s",

  doorType: "d",
  doubleDoorType: "b",
  electricalType: "z",
  roundColumnType: "o",
  squareColumnType: "q",
  windowType: "n",
  riggingType: "g"
};

export default function BoundaryObjectHotkeys({
  dispatch, children, ...restProps
}) {
  const handlers = {
    undo: () => dispatch(ActionCreators.undo()),
    redo: () => dispatch(ActionCreators.redo()),
    copy: () => dispatch(copyEntities()),
    paste: () => dispatch(pasteEntities()),

    selectTool: () => {
      dispatch(selectTool(SELECT_TOOL_NAME));
      dispatch(deselectEntities());
    },
    scaleTool: () => dispatch(selectTool(ADJUST_SCALE_TOOL_NAME)),
    panStart: () => dispatch(selectTool(PAN_TOOL_NAME)),
    panEnd: () => dispatch(deselectTool()),

    wallType: () => dispatch(setNewBoundaryType(WALL_BOUNDARY_TOOL_NAME)),
    airWallType: () => dispatch(setNewBoundaryType(AIR_WALL_BOUNDARY_TOOL_NAME)),
    railingType: () => dispatch(setNewBoundaryType(RAILING_BOUNDARY_TOOL_NAME)),
    borderType: () => dispatch(setNewBoundaryType(BORDER_BOUNDARY_TOOL_NAME)),
    stairsType: () => dispatch(setNewBoundaryType(STAIRS_BOUNDARY_TOOL_NAME)),

    doorType: () => dispatch(setNewObjectType(DOOR_OBJECT_TOOL_NAME)),
    doubleDoorType: () => dispatch(setNewObjectType(DOUBLE_DOOR_OBJECT_TOOL_NAME)),
    electricalType: () => dispatch(setNewObjectType(ELECTRICAL_OUTLET_OBJECT_TOOL_NAME)),
    roundColumnType: () => dispatch(setNewObjectType(ROUND_COLUMN_OBJECT_TOOL_NAME)),
    squareColumnType: () => dispatch(setNewObjectType(SQUARE_COLUMN_OBJECT_TOOL_NAME)),
    windowType: () => dispatch(setNewObjectType(WINDOW_OBJECT_TOOL_NAME)),
    riggingType: () => dispatch(setNewObjectType(RIGGING_OBJECT_TOOL_NAME))
  };
  const filteredProps = filterInvalidDOMProps({ ...restProps });
  return (
    <HotKeys keyMap={ keyMap } handlers={ handlers } { ...filteredProps }>
      { children }
    </HotKeys>
  );
}
BoundaryObjectHotkeys.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.arrayOf(PropTypes.node)
  ]),
  dispatch: PropTypes.func.isRequired
};
