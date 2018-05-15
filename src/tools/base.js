import classNames from "classnames";
import { connect } from "react-redux";
import { selectTool } from "../actions/ui-actions";

export function BaseButton (TOOL_NAME) {
  const RawBaseButton = ({
    children,
    dataTip,
    selected,
    onClick,
    additionalClasses
  }) => {
    const rawBaseButtonClassNames = classNames({
      "tool": true,
      "tool--is-selected": selected,
      [additionalClasses]: !!additionalClasses,
      [`${additionalClasses}--is-selected`]: !!additionalClasses && selected
    });
    if (dataTip) {
      return <div
        className={ rawBaseButtonClassNames }
        data-tip={ dataTip }
        onClick={ onClick }
      >
        { children || TOOL_NAME }
      </div>;
    }
    return <div
      className={ rawBaseButtonClassNames }
      onClick={ onClick }
    >
      { children || TOOL_NAME }
    </div>;
  };
  const mapStateToProps = ({ editor }) => {
    const selected = (editor.get("activeTool") || {}).name === TOOL_NAME;
    return { selected };
  };
  const mapDispatchToProps = (dispatch) => ({
    onClick: () => dispatch(selectTool(TOOL_NAME))
  });
  return connect(mapStateToProps, mapDispatchToProps)(RawBaseButton);
}
