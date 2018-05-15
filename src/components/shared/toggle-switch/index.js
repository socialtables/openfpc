import PropTypes from "prop-types";
import classnames from "classnames";
import "./toggle-switch.less";

const ToggleSwitch = ({ onClick = () => {}, on = false }) => {
  const toggleSwitchClassnames = classnames({
    "toggle-switch": true,
    "toggle-switch--on": on
  });
  return (
    <div className={ toggleSwitchClassnames } onClick={ () => onClick() }>
      <div className="toggle-switch__switch-toggle"></div>
    </div>
  );
};

ToggleSwitch.propTypes = {
  onClick: PropTypes.func,
  on: PropTypes.bool
};

module.exports = ToggleSwitch;
