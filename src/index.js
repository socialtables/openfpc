import { Component } from "react";
import { Provider } from "react-redux";
import AppRoot from "./components/app";
import { FLOOR_LOADED, FLOOR_SAVED } from "./constants/load-save";
import createStore from "./store";
import { setLoadSaveCallbacks } from "./actions/load-save-actions";
import "./less/style.less";

/**
 * @function OpenFPCApp - top-level component of OpenFPC
 * @param store - optional external store
 * @param onLoadFile - optional external file -> load handler
 * @param onSaveFile - optional external file -> save handler
 */
export default class OpenFPCApp extends Component {
  static get CONSTANTS () {
    return { FLOOR_LOADED, FLOOR_SAVED };
  }
  static createStore () {
    return createStore();
  }
  constructor (props) {
    super(props);
    let { store } = props;
    if (!store) {
      store = createStore();
    }
    this.state = { store };
  }
  // provide load/save hooks
  componentDidMount () {
    const { onLoadFile, onSaveFile } = this.props;
    const { store } = this.state;
    if (onLoadFile || onSaveFile) {
      store.dispatch(setLoadSaveCallbacks({
        onLoadFile,
        onSaveFile
      }));
    }
  }
  render () {
    const { store } = this.state;
    return (
      <Provider store={ store }>
        <AppRoot />
      </Provider>
    );
  }
}
