import "./objects-toggle.less";
import classNames from "classnames";
import { connect } from "react-redux";
import { toggleShowObjects } from "../../../actions/ui-actions";

function Thin_checkmark () { return <span>✔</span>; }

function ObjectsToggle ({
  showObjects,
  dispatch
}) {
  const onClick = () => {
    dispatch(toggleShowObjects(!showObjects));
  };
  const objectsToggleClassNames = classNames({
    "objects-toggle": true,
    "objects-toggle--is-checked": showObjects
  });
  return <div
    className={objectsToggleClassNames}
    onClick={onClick}
  >
    <Thin_checkmark />
    <span>Objects</span>
  </div>;
}

const mapStateToProps = ({ rooms }) => {
  return {
    showObjects: rooms.get("showObjects")
  };
};

const mapDispatchToProps = (dispatch) => ({
  dispatch
});

export default connect(mapStateToProps, mapDispatchToProps)(ObjectsToggle);
