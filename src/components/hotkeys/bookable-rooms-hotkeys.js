import filterInvalidDOMProps from "filter-invalid-dom-props";
import PropTypes from "prop-types";
import { HotKeys } from "react-hotkeys";
import { ActionCreators } from "redux-undo";

import {
  selectTool,
  deselectTool
} from "../../actions/ui-actions";
import {
  SELECT_TOOL_NAME,
  ROTATE_TOOL_NAME,
  PAN_TOOL_NAME
} from "../../constants/tools";

const keyMap = {
  undo: ["ctrl+z", "command+z"],
  redo: ["ctrl+shift+z", "command+shift+z"],

  selectTool: "esc",
  rotateTool: "r",
  panStart: {
    sequence: "space",
    action: "keydown"
  },
  panEnd: {
    sequence: "space",
    action: "keyup"
  }
};

export default function BookableRoomsHotkeys({
  bookableRoomDrawerOpen, children, dispatch, ...restProps
}) {
  const handlers = {
    undo: () => dispatch(ActionCreators.undo()),
    redo: () => dispatch(ActionCreators.redo()),
    panStart: () => dispatch(selectTool(PAN_TOOL_NAME)),
    panEnd: () => dispatch(deselectTool())
  };
  if (bookableRoomDrawerOpen) {
    handlers.selectTool = () => {
      dispatch(selectTool(SELECT_TOOL_NAME));
    };
    handlers.rotateTool = () => {
      dispatch(selectTool(ROTATE_TOOL_NAME));
    };
  }

  const filteredProps = filterInvalidDOMProps({ ...restProps });

  return (
    <HotKeys keyMap={ keyMap } handlers={ handlers } { ...filteredProps }>
      { children }
    </HotKeys>
  );
}
BookableRoomsHotkeys.propTypes = {
  bookableRoomDrawerOpen: PropTypes.bool,
  children: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.arrayOf(PropTypes.node)
  ]),
  dispatch: PropTypes.func.isRequired
};
