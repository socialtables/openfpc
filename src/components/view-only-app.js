import React, { Component } from "react";
import { connect } from "react-redux";
import Viewport from "../../src/components/viewport";
import SaveFloorDialog from "../../src/components/save-floor-dialog";
import "../less/app.less";

class ViewOnlyApp extends Component {
  render() {
    const { dispatch } = this.props;
    return (
      <div>
        <div className="main-content-and-sidebar">
          <div className="main-content-container">
            <div className="viewport-container">
              <Viewport
                height="100%"
                width="100%"
                showMeasurements={true}
              />
            </div>
          </div>
        </div>
        <SaveFloorDialog />
      </div>
    );
  }
}

const mapDispatchToProps = dispatch => ({ dispatch });
export default connect(null, mapDispatchToProps)(ViewOnlyApp);
