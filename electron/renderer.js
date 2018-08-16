"use strict";
const { ipcRenderer } = require("electron");
const { dialog } = require("electron").remote;
const fs = require("fs");
const path = require("path");
const React = require("react");
const ReactDOM = require("react-dom");
const App = require("../dist/index.js");
const loadScene = require("./lib/loader");
const genTestChunks = require("./generate-test-chunks");

// stub out window env - would be good to remove this later
window.ENV = window.ENV || {};

// helper for parsing a scene
function parseSceneFile (fileContents) {
  return Promise.resolve()
  .then(() => loadScene(fileContents))
  .catch(err => {
    if (err.loaderErrorMessages) {
      console.error(err.loaderErrorMessages); // eslint-disable-line no-console
    }
    else {
      ipcRenderer.send("renderer-failure", err.message);
    }
    return Promise.reject(err);
  });
}

// dispatches a file's contents into a given store
function loadFloorFromFileContents (store, fileContents, fileName, filePath) {
  return Promise.resolve()
  .then(() => parseSceneFile(fileContents))
  .then(data => store.dispatch({
    type: App.CONSTANTS.FLOOR_LOADED,
    data,
    fileName,
    filePath
  }));
}

// this gets injected to provide file -> load
function onLoadFile (store) {
  dialog.showOpenDialog(
    {
      title: "Load File",
      defaultPath: process.cwd(),
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile"]
    },
    (filePaths) => {
      if (filePaths && filePaths.length) {
        filePaths.forEach(filePath => {
          const fileName = path.parse(filePath).base;
          const fileContents = JSON.parse(fs.readFileSync(filePath));
          loadFloorFromFileContents(store, fileContents, fileName, filePath);
        });
      }
    }
  );
}

// this gets injected to provide file -> save
function onSaveFile (store, data, { currentFileName, currentFilePath }) {
  dialog.showSaveDialog(
    {
      title: "Save File",
      defaultPath: currentFilePath || (currentFileName ?
        `${process.cwd()}/currentFileName` :
        process.cwd()
      ),
      filters: [{ name: "JSON", extensions: ["json"] }]
    },
    (selectedFilePath) => {
      if (selectedFilePath) {
        fs.writeFileSync(selectedFilePath, JSON.stringify(data));
        store.dispatch({
          type: App.CONSTANTS.FLOOR_SAVED,
          filePath: selectedFilePath,
          fileName: path.parse(selectedFilePath).base
        });
      }
    }
  );
}

function initApp ({ mode = "editor" } = {}) {

  // manually create app store so we can dispatch events from main process
  const appStore = App.createStore();

  // create and start the app
  const appEl = React.createElement(App, {
    store: appStore,
    onLoadFile: onLoadFile.bind(null, appStore),
    onSaveFile: onSaveFile.bind(null, appStore),
    mode
  });

  ReactDOM.render(appEl, document.getElementById("openfpc-view"));

  return { store: appStore };
}

function init() {
  let initializedApp = null;

  // handle display mode assignment and app readiness
  ipcRenderer.on("init-app", (e, msg) => {
    const { mode = "editor" } = msg;
    initializedApp = initApp({ mode });
    ipcRenderer.send("ack", msg);
  });

  // handle load events
  ipcRenderer.on("load-file", (event, {
    fileContents,
    fileName,
    filePath,
    messageId
  }) => {
    initializedApp || (initializedApp = initApp());
    const { store } = initializedApp;
    loadFloorFromFileContents(store, fileContents, fileName, filePath);
    ipcRenderer.send("ack", { messageId });
  });

  // tell the main process we're ready for more events
  ipcRenderer.send("renderer-ready", true);

  // if we're asked to render something, render something
  ipcRenderer.on("generate-test-chunks", async (e, {
    messageId,
    fileContents,
    ...opts
  }) => {
    ipcRenderer.send("ack", { messageId });
    try {
      await genTestChunks({
        containerElement: document.getElementById("openfpc-view"),
        floorData: await parseSceneFile(fileContents),
        ...opts
      });
      ipcRenderer.send("done-with-chunks", { messageId });
    }
    catch (err) {
      console.log("failed to generate chunks", err);
    }
  });
}

init();
