import React, { Component } from "react";
import { connect } from "react-redux";
import HeaderBar from "../../src/components/header";
import Sidebar from "../../src/components/sidebar";
import Viewport from "../../src/components/viewport";
import SaveFloorDialog from "../../src/components/save-floor-dialog";
import OptionsDialog from "../../src/components/options-dialog";
import HotkeyInfoDialog from "../../src/components/hotkey-info-dialog";
import BoundaryObjectHotkeys from "../../src/components/hotkeys/boundary-object-hotkeys";
import "../less/app.less";

const SELECTABLE_TYPES = {
  point: 1,
  boundary: 1,
  object: 1
};
const HIDDEN_TYPES = {
  region: 1
};

class App extends Component {
  render() {
    const { dispatch } = this.props;
    return (
      <div>
        <BoundaryObjectHotkeys dispatch={ dispatch }>
          <HeaderBar />
        </BoundaryObjectHotkeys>
        <div className="main-content-and-sidebar">
          <div className="main-content-container">
            <div className="viewport-container">
              <BoundaryObjectHotkeys dispatch={ dispatch }>
                <Viewport
                  height="100%"
                  width="100%"
                  selectableEntityTypes={SELECTABLE_TYPES}
                  hiddenEntityTypes={HIDDEN_TYPES}
                  showMeasurements={true}
                />
              </BoundaryObjectHotkeys>
            </div>
          </div>
          <div className="sidebar-container">
            <Sidebar/>
          </div>
        </div>
        <SaveFloorDialog />
        <OptionsDialog />
        <HotkeyInfoDialog />
      </div>
    );
  }
}

const mapDispatchToProps = dispatch => ({ dispatch });
export default connect(null, mapDispatchToProps)(App);
