import { connect } from "react-redux";
import ThemeConfig from "./theme-config";
import Modal from "../shared/modal";
import { closeOptionsDialog } from "../../actions/ui-actions";
import "./index.less";

const modalStyle = {
  overlay: {
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 99
  },
  content: {
    width: 500,
    left: null,
    right: 50,
    top: 50,
    bottom: 50,
    padding: "20px",
    overflow: "hidden"
  }
};

function OptionsDialog (props) {
  const { dialogOpen, dispatch } = props;
  return <Modal
    style={modalStyle}
    contentLabel="Options"
    isOpen={ dialogOpen }
    onRequestClose={ () => dispatch(closeOptionsDialog()) }
  >
    <div className="options-dialog-content">
      <p>
        Points and boundaries can be hard to see on some backgrounds, so
        you can change the color scheme here to make them easier to see.
      </p>
      <ThemeConfig/>
    </div>
  </Modal>;
}

function mapStateToProps ({ editor }) {
  return {
    dialogOpen: editor.get("optionsDialogOpen")
  };
}

export default connect(mapStateToProps)(OptionsDialog);
