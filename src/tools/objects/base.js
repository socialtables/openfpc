import classNames from "classnames";
import { connect } from "react-redux";
import { setNewObjectType } from "../../actions/ui-actions";
import {
  ADD_OBJECT_TOOL_NAME,
  WINDOW_OBJECT_TOOL_NAME,
  RIGGING_OBJECT_TOOL_NAME
} from "../../constants/tools";

export function BaseButton (OBJECT_NAME) {
  const RawBaseButton = ({
    children,
    dataTip,
    selected,
    onClick
  }) => {
    const formatSVG = OBJECT_NAME !== WINDOW_OBJECT_TOOL_NAME;
    const useSelectedToolClass = OBJECT_NAME === RIGGING_OBJECT_TOOL_NAME;
    const rawBaseButtonClassNames = classNames({
      "object-tool": true,
      "object-tool--is-selected": selected,
      "object-tool__format-svg": formatSVG,
      "object-tool__format-svg--is-selected": selected && formatSVG,
      "tool--is-selected": selected && useSelectedToolClass
    });
    if (dataTip) {
      return <div
        className={ rawBaseButtonClassNames }
        data-tip={ dataTip }
        onClick={ onClick }
      >
        { children || OBJECT_NAME }
      </div>;
    }
    return <div
      className={ rawBaseButtonClassNames }
      onClick={ onClick }
    >
      { children || OBJECT_NAME }
    </div>;
  };
  const mapStateToProps = ({ editor }) => {
    const selectedTool = (editor.get("activeTool") || {}).name === ADD_OBJECT_TOOL_NAME;
    const selected = selectedTool && editor.get("newObjectType") === OBJECT_NAME;
    return { selected };
  };
  const mapDispatchToProps = (dispatch) => ({
    onClick: () => dispatch(setNewObjectType(OBJECT_NAME))
  });
  return connect(mapStateToProps, mapDispatchToProps)(RawBaseButton);
}
