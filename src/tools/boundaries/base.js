import classNames from "classnames";
import { connect } from "react-redux";
import { setNewBoundaryType } from "../../actions/ui-actions";
import { ADD_BOUNDARY_TOOL_NAME } from "../../constants/tools";

export function BaseButton (BOUNDARY_NAME) {
  const RawBaseButton = ({
    children,
    dataTip,
    selected,
    onClick
  }) => {
    const rawBaseButtonClassNames = classNames({
      "tool": true,
      "tool--is-selected": selected
    });
    if (dataTip) {
      return <div
        className={ rawBaseButtonClassNames }
        data-tip={ dataTip }
        onClick={ onClick }
      >
        { children || BOUNDARY_NAME }
      </div>;
    }
    return <div
      className={ rawBaseButtonClassNames }
      onClick={ onClick }
    >
      { children || BOUNDARY_NAME }
    </div>;
  };
  const mapStateToProps = ({ editor }) => {
    const selectedTool = (editor.get("activeTool") || {}).name === ADD_BOUNDARY_TOOL_NAME;
    const selected = selectedTool && editor.get("newBoundaryType") === BOUNDARY_NAME;
    return { selected };
  };
  const mapDispatchToProps = (dispatch) => ({
    onClick: () => dispatch(setNewBoundaryType(BOUNDARY_NAME))
  });
  return connect(mapStateToProps, mapDispatchToProps)(RawBaseButton);
}
