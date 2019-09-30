import "./toolbar.less";
import { connect } from "react-redux";
import ReactTooltip from "react-tooltip";
import {
  EditDropdown,
  FileDropdown
} from "./dropdowns";
import BoundaryTools from "./boundaries";
import SnapTools from "./snapping";
import * as TOOLS from "../../constants/tools";

function Toolbar ({
  renderer,
  toolButtons
}) {
  return <div className="header-bar__toolbar">
    <div className="toolbar__group">
      <FileDropdown />
      <EditDropdown />
    </div>
    <div className="toolbar__divider" />
    <div className="toolbar__group">
      { toolButtons[TOOLS.SELECT_TOOL_NAME] }
      { toolButtons[TOOLS.ADJUST_SCALE_TOOL_NAME] }
      { toolButtons[TOOLS.DIMENSION_LINE_TOOL_NAME] }
    </div>
    <div className="toolbar__divider" />
    <div className="toolbar__group">
      <BoundaryTools
        renderer={renderer}
      />
    </div>
    <div className="toolbar__divider" />
    <div className="toolbar__group">
      { toolButtons[TOOLS.DOOR_OBJECT_TOOL_NAME] }
      { toolButtons[TOOLS.DOUBLE_DOOR_OBJECT_TOOL_NAME] }
      { toolButtons[TOOLS.ELECTRICAL_OUTLET_OBJECT_TOOL_NAME] }
      { toolButtons[TOOLS.ROUND_COLUMN_OBJECT_TOOL_NAME] }
      { toolButtons[TOOLS.SQUARE_COLUMN_OBJECT_TOOL_NAME] }
      { toolButtons[TOOLS.WINDOW_OBJECT_TOOL_NAME] }
      { toolButtons[TOOLS.RIGGING_OBJECT_TOOL_NAME] }
    </div>
    <div className="toolbar__divider" />
    <div className="toolbar__group">
      <SnapTools />
      { toolButtons[TOOLS.ARC_TOOL_NAME] }
      { toolButtons[TOOLS.TRACE_LINES_TOOL_NAME] }
    </div>
    <ReactTooltip
      class="toolbar__tooltip"
      delayHide={200}
      effect="solid"
      place="bottom"
    />
  </div>;
}

function mapStateToProps ({ editor }) {
  return {
    toolButtons: editor.get("tools").reduce((l, v) => {
      l[v.name] = v.toolButton;
      return l;
    }, {})
  };
}

export default connect(mapStateToProps)(Toolbar);
