import { Component } from "react";
import { Provider } from "react-redux";
import AppRoot from "./components/app";
import ViewOnlyAppRoot from "./components/view-only-app";
import { FLOOR_LOADED, FLOOR_SAVED } from "./constants/load-save";
import createStore from "./store";
import { setLoadSaveCallbacks } from "./actions/load-save-actions";
import * as model from "./model";
import RenderableSceneMaintainer from "./lib/renderable-scene-maintainer";
import CollisionResolverMaintainer from "./lib/collision-resolver-maintainer";
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
  // convienence method for accessing scene model utility libs
  static get MODEL () {
    return model;
  }
  static get LIB () {
    return {
      RenderableSceneMaintainer,
      CollisionResolverMaintainer
    };
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
    const viewMode = this.props.mode === "visualizer";
    const { store } = this.state;
    return (
      <Provider store={ store }>
        { viewMode ? <ViewOnlyAppRoot /> : <AppRoot/> }
      </Provider>
    );
  }
}
