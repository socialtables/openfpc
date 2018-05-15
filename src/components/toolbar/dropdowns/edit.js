import classNames from "classnames";
import React, { Component } from "react";
import { connect } from "react-redux";
import { ActionCreators } from "redux-undo";
import { copyEntities, pasteEntities } from "../../../actions/floor-actions";
import CloseOnClickOut from "../../shared/close-on-click-out";

// stub ST icon references
function Wide_up_triangle () { return <span>▼</span>; }

class EditDropdown extends Component {
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
    this.props.dispatch(action());
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
          <span>Edit</span>
          <Wide_up_triangle />
        </div>

        <CloseOnClickOut
          onClickOut={ () => this.closeMenus() }
        >
          <div className="dropdown__menu-container">
            <div
              className="dropdown__option"
              onClick={ () => this.handleSelection(copyEntities) }
            >
              <span>Copy</span>
            </div>
            <div
              className="dropdown__option"
              onClick={ () => this.handleSelection(pasteEntities) }
            >
              <span>Paste</span>
            </div>
            <div
              className="dropdown__option"
              onClick={ () => this.handleSelection(ActionCreators.undo) }
            >
              <span>Undo</span>
            </div>
            <div
              className="dropdown__option"
              onClick={ () => this.handleSelection(ActionCreators.redo) }
            >
              <span>Redo</span>
            </div>
          </div>
        </CloseOnClickOut>
      </div>
    );
  }
}

const mapDispatchToProps = (dispatch) => ({
  dispatch
});

export default connect(mapDispatchToProps)(EditDropdown);
