import classNames from "classnames";
import { Set } from "immutable";
import React, { Component } from "react";
import { connect } from "react-redux";
import { selectEntities } from "../../../actions/floor-actions";
import { toggleSelectInnerRooms } from "../../../actions/ui-actions";
import CloseOnClickOut from "../../shared/close-on-click-out";

// stub ST icon references
function Thin_checkmark () { return <span>✔</span>; }
function Wide_up_triangle () { return <span>▼</span>; }

class SelectDropdown extends Component {
  constructor(props) {
    super(props);
    this.state = {
      showMenu: false
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
      showMenu: false
    });
  }

  toggleRootMenu() {
    this.setState({
      showMenu: !this.state.showMenu
    });
  }

  onKeyPress(e) {
    //Esc key pressed
    if (e.keyCode === 27 && this.state.showMenu) {
      this.closeMenus();
    }
  }

  handleSelection(action) {
    const { dispatch, entities, selection } = this.props;
    const entitiesMap = entities.reduce((acc, e) => {
      if (e.get("type") !== "region") {
        return acc;
      }
      if (action === "all") {
        acc[e.get("id")] = true;
      }
      else if (action === "inverse" && !selection.includes(e.get("id"))) {
        acc[e.get("id")] = true;
      }
      return acc;
    }, {});
    const newSelection = new Set(Object.keys(entitiesMap));
    dispatch(selectEntities(newSelection));
    this.closeMenus();
  }

  handleToggleInnerRooms() {
    const { dispatch, selectInnerRooms } = this.props;
    dispatch(toggleSelectInnerRooms(!selectInnerRooms));
    this.closeMenus();
  }

  render() {
    const dropdownClasses = classNames({
      "dropdown": true,
      "dropdown--is-open": this.state.showMenu
    });

    return (
      <div className={ dropdownClasses }>
        <div
          className="dropdown__menu-button"
          onClick={ () => this.toggleRootMenu() }
        >
          <span>Select</span>
          <Wide_up_triangle />
        </div>

        <CloseOnClickOut
          onClickOut={ () => this.closeMenus() }
        >
          <div
            className="dropdown__menu-container"
            style={{ width: 135 }}
          >
            <div
              className="dropdown__option"
              onClick={ () => this.handleSelection("all") }
            >
              <span>All</span>
            </div>
            <div
              className="dropdown__option"
              onClick={ () => this.handleSelection() }
            >
              <span>Deselect</span>
            </div>
            <div
              className="dropdown__option"
              onClick={ () => this.handleSelection("inverse") }
              style={{ paddingBottom: 10 }}
            >
              <span>Inverse</span>
            </div>
            <div className="dropdown__divider"/>
            <div
              className="dropdown__option dropdown__option--with-icon"
              onClick={ () => this.handleToggleInnerRooms() }
            >
              <span>Inner Rooms</span>
              { this.props.selectInnerRooms &&
                <Thin_checkmark />
              }
            </div>
          </div>
        </CloseOnClickOut>
      </div>
    );
  }
}

const mapStateToProps = ({ floor, rooms }) => {
  return {
    entities: floor.present.get("entities"),
    selection: floor.present.get("selection"),
    selectInnerRooms: rooms.get("selectInnerRooms")
  };
};

const mapDispatchToProps = (dispatch) => ({
  dispatch
});

export default connect(mapStateToProps, mapDispatchToProps)(SelectDropdown);
