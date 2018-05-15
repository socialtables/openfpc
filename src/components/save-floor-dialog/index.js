import { Component } from "react";
import { connect } from "react-redux";
import Modal from "../shared/modal";
import {
  saveFloor,
  closeSaveDialog
} from "../../actions/load-save-actions";
import "./index.less";

class LocalSaveDialogContents extends Component {
  constructor (props) {
    super(props);
    this.state = {
      fileName: props.currentFileName || "",
      valid: !!props.currentFileName
    };
    this.onFileNameChanged = this.onFileNameChanged.bind(this);
    this.onConfirmSave = this.onConfirmSave.bind(this);
  }
  onFileNameChanged (e) {
    this.setState({
      fileName: e.target.value || "",
      valid: !!e.target.value
    });
  }
  onConfirmSave () {
    const { fileName, valid } = this.state;
    if (!valid) {
      return;
    }
    this.props.dispatch(
      saveFloor(fileName || this.props.currentFileName)
    );
  }
  render () {
    const { fileName, valid } = this.state;
    return <div>
      <form
        className="save-dialog__contents"
        onSubmit={this.onConfirmSave}
      >
        <p>Save the current scene to a local file</p>
        <label>
            File Name
          <input
            value={ fileName || "" }
            onChange={ this.onFileNameChanged }
            type="text"
          />
        </label>
        <button role="submit" disabled={ !valid }>Save Floor</button>
      </form>
    </div>;
  }
}

class SaveFloorDialog extends Component {
  constructor(props) {
    super(props);
  }
  handleClose() {
    this.props.dispatch(closeSaveDialog());
  }
  render () {
    const { dialogOpen, currentFileName, dispatch } = this.props;
    return (
      <Modal
        headerText="Save Floor"
        contentLabel="Save Floor"
        isOpen={ dialogOpen }
        onRequestClose={ () => this.handleClose() }
      >
        <LocalSaveDialogContents
          dispatch={ dispatch }
          currentFileName={ currentFileName }
        />
      </Modal>
    );
  }
}

function mapStateToProps({ loadSave }) {
  return {
    dialogOpen: loadSave.get("saveDialogOpen"),
    currentFileName: loadSave.get("currentFileName")
  };
}

export default connect(mapStateToProps)(SaveFloorDialog);
