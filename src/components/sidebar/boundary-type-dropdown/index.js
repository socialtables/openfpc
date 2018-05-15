import classNames from "classnames";
import { Component } from "react";
import CloseOnClickOut from "../../shared/close-on-click-out";

// stub ST icon references
function Wide_up_triangle () { return <span>V</span>; }

export default class BoundaryTypeDropdown extends Component {
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

  handleSelection(e) {
    this.props.onChange(e);
    this.closeMenus();
  }

  render() {
    const dropdownClasses = classNames({
      "dropdown": true,
      "dropdown--is-open": this.state.showMenu
    });

    const options = this.props.options;
    const selectedValue = options.find(opt => opt.value === this.props.value) || {};

    return (
      <div className={ dropdownClasses }>
        <div
          className="dropdown__menu-button"
          onClick={ () => this.toggleRootMenu() }
        >
          <span>{ selectedValue.text || "Select..." }</span>
          <Wide_up_triangle />
        </div>

        <CloseOnClickOut
          onClickOut={ () => this.closeMenus() }
        >
          <div className="dropdown__menu-container">
            {
              options.map((opt, i) => {
                const dropdownOptionClassNames = classNames({
                  "dropdown__option": true,
                  "dropdown__option--is-selected": selectedValue.value === opt.value
                });
                return <div
                  className={dropdownOptionClassNames}
                  key={i}
                  value={opt.value}
                  onClick={() => this.handleSelection(opt.value)}
                >
                  <span>{opt.text}</span>
                </div>;
              })
            }
          </div>
        </CloseOnClickOut>
      </div>
    );
  }
}
