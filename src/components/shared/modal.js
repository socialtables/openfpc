import Modal from "react-modal";
import PropTypes from "prop-types";

const modalStyle = {
  overlay: {
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 99
  },
  content: {
    width: 500,
    height: 410,
    bottom: null,
    backgroundColor: "#f8f8f9",
    borderColor: "#f8f8f9",
    margin: "100px auto 0",
    padding: "20px"
  }
};

function STModal (props) {
  return <Modal
    {...props}
    ariaHideApp={ false } // no users on screenreaders so removing console warning
    style={props.style || modalStyle}
  >
    <div>
      <h3>{ props.headerText }</h3>
      { props.children }
    </div>
  </Modal>;
}

STModal.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.array,
    PropTypes.object
  ]),
  headerText: PropTypes.string
};

export default STModal;
