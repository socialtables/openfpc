import { Component } from "react";
import { connect } from "react-redux";
import PropTypes from "prop-types";
import { WebGLRenderer } from "three";
import Toolbar from "../toolbar";
import { openHotkeyInfoDialog } from "../../actions/ui-actions";
import "./header.less";

class AppHeaderBar extends Component {
  constructor(props) {
    super(props);
  }
  // focus header when it mounts so that we can use app-level hotkeys
  componentDidMount() {
    this._headerRef.focus();
  }
  render() {
    const { dispatch, floorName } = this.props;
    const renderer = new WebGLRenderer({
      alpha: true,
      antialias: true
    });
    return <div
      className="header-bar"
      ref={ r => this._headerRef = r }
      tabIndex={ -1 }
    >
      <div className="header-bar__header">
        <div className="header__text">
          <span>
            <h2>Editing Floor Geometry</h2>
            <div className="info-svg-replacement" onClick={ () => dispatch(openHotkeyInfoDialog()) }>i</div>
          </span>
          <h1>{ floorName ? floorName : "New Floor" }</h1>
        </div>
      </div>
      <div className="header_bar__divider"/>
      <Toolbar renderer={ renderer } />
    </div>;
  }
}

AppHeaderBar.propTypes = {
  dispatch: PropTypes.func.isRequired,
  floorName: PropTypes.string
};

function mapStateToProps ({ loadSave }) {
  return {
    floorName: loadSave.get("currentFileName") || null
  };
}

function mapDispatchToProps (dispatch) {
  return { dispatch };
}

export default connect(mapStateToProps, mapDispatchToProps)(AppHeaderBar);
