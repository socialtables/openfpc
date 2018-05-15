import "./view-toggle.less";
import classNames from "classnames";
import { connect } from "react-redux";
import { setViewAllMode, setViewSelectedMode } from "../../../actions/ui-actions";

function ViewToggle ({
  viewSelectedMode,
  dispatch
}) {
  const onClickViewAll = () => {
    dispatch(setViewAllMode());
  };
  const onClickViewSelected = () => {
    dispatch(setViewSelectedMode());
  };
  const viewAllClassNames = classNames({
    "view-toggle__option": true,
    "view-toggle__option--is-selected": !viewSelectedMode
  });
  const viewSelectedClassNames = classNames({
    "view-toggle__option": true,
    "view-toggle__option--is-selected": viewSelectedMode
  });
  return <div className="view-toggle">
    <span
      className={viewAllClassNames}
      onClick={onClickViewAll}
    >
      All
    </span>
    <span
      className={viewSelectedClassNames}
      onClick={onClickViewSelected}
    >
      Selected
    </span>
  </div>;
}

const mapStateToProps = ({ rooms }) => {
  return {
    viewSelectedMode: rooms.get("viewSelectedMode")
  };
};

const mapDispatchToProps = (dispatch) => ({
  dispatch
});

export default connect(mapStateToProps, mapDispatchToProps)(ViewToggle);
