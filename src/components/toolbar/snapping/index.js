import classNames from "classnames";
import { connect } from "react-redux";
import { Magnet } from "../../icons";
import { setSnappingEnabled } from "../../../actions/ui-actions";

function mapStateToProps (state) {
  return {
    snappingEnabled: state.editor.get("enableSnapGuides")
  };
}

function SnapButton ({ dispatch, snappingEnabled = false }) {
  const classes = classNames({
    "tool": true,
    "tool--is-selected": snappingEnabled
  });
  const onClick = () => dispatch(setSnappingEnabled(!snappingEnabled));
  return <div className={classes} onClick={onClick}>
    <Magnet/>
  </div>;
}

export default connect(mapStateToProps)(SnapButton);
