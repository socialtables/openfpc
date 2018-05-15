import classNames from "classnames";
import React, { Component } from "react";
import { connect } from "react-redux";
import { openOptionsDialog } from "../../../actions/ui-actions";
import { setUnits } from "../../../actions/floor-actions";
import CloseOnClickOut from "../../shared/close-on-click-out";
import {
  METRIC,
  IMPERIAL_INCHES,
  IMPERIAL_FEET_INCHES
} from "../../../constants";

// stub ST icon references
function Thin_checkmark () { return <span>✔</span>; }
function Wide_up_triangle () { return <span>▼</span>; }

class FileDropdown extends Component {
  constructor(props) {
    super(props);
    this.state = {
      showMenu: false,
      showUnits: false,
      showImperialUnits: false
    };
    this.onKeyPress = this.onKeyPress.bind(this);
  }

  componentDidMount() {
    document.addEventListener("keydown", this.onKeyPress);
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.onKeyPress);
  }

  closeMenus() {
    this.setState({
      showMenu: false,
      showUnits: false,
      showImperialUnits: false
    });
  }

  toggleRootMenu() {
    this.setState({
      showMenu: !this.state.showMenu,
      showUnits: false,
      showImperialUnits: false
    });
  }

  onKeyPress(e) {
    //Esc key pressed
    if (e.keyCode === 27 && this.state.showMenu) {
      this.closeMenus();
    }
  }

  handleSelection(action) {
    this.props.dispatch(action());
    this.closeMenus();
  }

  handleUnits() {
    this.setState({
      showUnits: true
    });
  }

  render() {
    const { onLoadFile, onSaveFile } = this.props;
    const dropdownClasses = classNames({
      "dropdown": true,
      "dropdown--is-open": this.state.showMenu
    });
    const submenuClasses = classNames({
      "dropdown__submenu": true,
      "dropdown__submenu--is-open": this.state.showUnits
    });
    const suboptionsMenuClasses = classNames(
      "dropdown__submenu__suboptions-menu",
      { "dropdown__submenu__suboptions-menu--is-open": this.state.showImperialUnits }
    );

    return (
      <div className={ dropdownClasses }>
        <div
          className="dropdown__menu-button"
          onClick={ () => this.toggleRootMenu() }
        >
          <span>File</span>
          <Wide_up_triangle />
        </div>

        <CloseOnClickOut
          onClickOut={ () => this.closeMenus() }
        >
          <div className="dropdown__menu-container">
            { onLoadFile ?
              <div
                className="dropdown__option"
                onClick={ onLoadFile }
              >
                <span>Load</span>
              </div> :
              null
            }
            { onSaveFile ?
              <div
                className="dropdown__option"
                onClick={ onSaveFile }
              >
                <span>Save</span>
              </div> :
              null
            }
            <div
              className="dropdown__option"
              onClick={ () => this.handleSelection(openOptionsDialog) }
            >
              <span>Colors</span>
            </div>
            <div
              className="dropdown__option dropdown__option--with-icon"
              onClick={ () => this.setState({ showUnits: !this.state.showUnits }, () => {
                this.setState({ showImperialUnits: !this.state.showUnits ? false : this.state.showImperialUnits });
              }) }
            >
              <span>Units</span>
              <Wide_up_triangle style={{ width: 8, height: 10, transform: "rotate(90deg)" }}/>
            </div>
          </div>
          <div className={ submenuClasses }>
            <div
              className="dropdown__option dropdown__option--with-icon"
              onClick={ () => this.setState({ showImperialUnits: !this.state.showImperialUnits }) }
            >
              <span>Imperial</span>
              <Wide_up_triangle style={{ width: 8, height: 10, transform: "rotate(90deg)" }}/>
            </div>
            <div
              className="dropdown__option dropdown__option--with-icon"
              onClick={ () => this.handleSelection(setUnits.bind(null, METRIC)) }
            >
              <span>Metric</span>
              { this.props.units === METRIC &&
                <Thin_checkmark />
              }
            </div>
          </div>
          <div className={ suboptionsMenuClasses }>
            <div
              className="dropdown__option dropdown__option--with-icon"
              onClick={ () => this.handleSelection(setUnits.bind(null, IMPERIAL_INCHES)) }>
              <span>Inches</span>
              { this.props.units === IMPERIAL_INCHES &&
                <Thin_checkmark />
              }
            </div>
            <div
              className="dropdown__option dropdown__option--with-icon"
              onClick={ () => this.handleSelection(setUnits.bind(null, IMPERIAL_FEET_INCHES)) }>
              <span>Feet & Inches</span>
              { this.props.units === IMPERIAL_FEET_INCHES &&
                <Thin_checkmark />
              }
            </div>
          </div>
        </CloseOnClickOut>
      </div>
    );
  }
}

const mapStateToProps = ({ floor, loadSave }) => {
  const {
    onLoadFile,
    onSaveFile,
    currentFileName,
    currentFilePath
  } = loadSave.toJS();
  return {
    floor: floor && floor.present,
    units: floor && floor.present.get("units"),
    onLoadFile: onLoadFile,
    onSaveFile: onSaveFile ?
      () => onSaveFile(floor && floor.present.toJS(), {
        currentFileName,
        currentFilePath
      }) :
      null
  };
};

const mapDispatchToProps = (dispatch) => ({
  dispatch
});

export default connect(mapStateToProps, mapDispatchToProps)(FileDropdown);
