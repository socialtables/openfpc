import { connect } from "react-redux";
import Modal from "../shared/modal";
import { closeHotkeyInfoDialog } from "../../actions/ui-actions";
import "./index.less";

function HotkeyInfoDialog (props) {
  const { dialogOpen, dispatch } = props;
  return <Modal
    contentLabel="Hotkey Info"
    isOpen={ dialogOpen }
    onRequestClose={ () => dispatch(closeHotkeyInfoDialog()) }
  >
    <div className="hotkey-dialog">
      <h3>FPC4 Hotkeys</h3>
      <table className="hotkey-dialog__table">
        <colgroup span="2"></colgroup>
        <tr>
          <th>Actions</th>
          <th>Tools</th>
        </tr>
        <tr>
          <td>
            <span>Undo:</span>
            <span>ctrl+z, command+z (mac)</span>
          </td>
          <td>
            <span>Select:</span>
            <span>esc</span>
          </td>
        </tr>
        <tr>
          <td>
            <span>Redo:</span>
            <span>ctrl+shift+z,<br/>command+shift+z (mac)</span>
          </td>
          <td>
            <span>Scale:</span>
            <span>c</span>
          </td>
        </tr>
        <tr>
          <td>
            <span>Copy:</span>
            <span>ctrl+c, command+c (mac)</span>
          </td>
          <td>
            <span>Pan:</span>
            <span>space</span>
          </td>
        </tr>
        <tr>
          <td>
            <span>Paste:</span>
            <span>ctrl+z, command+z (mac)</span>
          </td>
        </tr>
        <tr>
          <th>Boundary Types</th>
          <th>Object Types</th>
        </tr>
        <tr>
          <td>
            <span>Wall:</span>
            <span>w</span>
          </td>
          <td>
            <span>Door:</span>
            <span>d</span>
          </td>
        </tr>
        <tr>
          <td>
            <span>Air Wall:</span>
            <span>e</span>
          </td>
          <td>
            <span>Double Door:</span>
            <span>b</span>
          </td>
        </tr>
        <tr>
          <td>
            <span>Railing:</span>
            <span>r</span>
          </td>
          <td>
            <span>Electrical Outlet:</span>
            <span>z</span>
          </td>
        </tr>
        <tr>
          <td>
            <span>Border:</span>
            <span>t</span>
          </td>
          <td>
            <span>Round Column:</span>
            <span>o</span>
          </td>
        </tr>
        <tr>
          <td>
            <span>Stairs:</span>
            <span>s</span>
          </td>
          <td>
            <span>Square Column:</span>
            <span>q</span>
          </td>
        </tr>
        <tr>
          <td></td>
          <td>
            <span>Window:</span>
            <span>n</span>
          </td>
        </tr>
        <tr>
          <td></td>
          <td>
            <span>Rigging:</span>
            <span>g</span>
          </td>
        </tr>
      </table>
    </div>
  </Modal>;
}

function mapStateToProps ({ editor }) {
  return {
    dialogOpen: editor.get("hotkeyInfoDialogOpen")
  };
}

export default connect(mapStateToProps)(HotkeyInfoDialog);
