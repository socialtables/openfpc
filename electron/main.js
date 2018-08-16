#!/usr/bin/env electron
"use strict";
const { app, BrowserWindow, ipcMain } = require("electron");
const Promise = require("bluebird");
const commander = require("commander");
const fs = require("fs");
const path = require("path");
const url = require("url");
const shortid = require("shortid");

// grab command line args
const cmdArgs = {};
commander
.arguments("[file]")
.option("--dev", "open DevTools")
.option("--display-only", "open in display-only mode")
.option("--generate-test-chunks", "open in generative test mode")
.option("--screenshot [file]", "screenshot to specified file")
// commander won't d its action clause without a file argument
.action((file, { dev }) => Object.assign(cmdArgs, { file, dev }));
commander.parse(process.argv);

// combine args present on commander instance with cmdArgs object to get
// full args
cmdArgs.dev = cmdArgs.dev || commander.dev;
cmdArgs.displayOnly = cmdArgs.displayOnly || commander.displayOnly;
cmdArgs.screenshot = cmdArgs.screenshot || commander.screenshot;
cmdArgs.generateTestChunks = cmdArgs.generateTestChunks || commander.generateTestChunks;
if (cmdArgs.screenshot === true) {
  cmdArgs.screenshot = "screenshot";
}

// loader for specified file
function _loadLocalFile(targetFileName) {
  return new Promise((resolve) => {
    fs.readFile(targetFileName, (err, buff) => {
      if (err) {
        global.console.error(err);
        process.exit(1);
      }
      try {
        resolve(JSON.parse(buff));
      }
      catch (err) {
        global.console.error(err);
        process.exit(1);
      }
    });
  });
}

// need global reference to prevent GC deref
let mainWindow;
async function createWindow () {

  // kick off loading the target file if specified
  let fileLoadStub;
  if (cmdArgs.file) {
    fileLoadStub = _loadLocalFile(cmdArgs.file);
  }

  // get ready to wait for the renderer to come online
  const windowLoadStub = new Promise((resolve) => {
    ipcMain.on("renderer-ready", (event, msg) => {
      resolve(msg || "renderer-ready");
    });
    ipcMain.on("renderer-failure", (event, msg) => {
      mainWindow = null;
      global.console.error(msg);
      process.exit(1);
    });
  });

    // init all the things
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    title: "FPSee",
    show: false
  });

  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, "index.html"),
    protocol: "file:",
    slashes: true
  }));

  if (cmdArgs.dev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", function () {
    mainWindow = null;
    process.exit(0);
  });

  // set up promise-chainable comms to the window
  const resolveInFlight = {};
  function sendMessageAndPromiseResponse (channel, rawData, ...extra) {
    const data = Object.assign({ messageId: shortid() }, rawData || {});
    const messageId = data.messageId;
    const chain = new Promise(resolve => resolveInFlight[messageId] = resolve);
    mainWindow.webContents.send(channel, data, ...extra);
    return chain;
  }
  ipcMain.on("ack", (event, msg) => {
    const { messageId } = msg;
    const resolve = resolveInFlight[messageId];
    if (resolve) {
      resolve(msg);
      delete resolveInFlight[messageId];
    }
  });

  // finally, attempt to do whatever the CLI speficies
  try {

    // load renderer
    await windowLoadStub;

    // configure and initialize
    let mode = "visualizer";
    if (!cmdArgs.generateTestChunks) {
      await sendMessageAndPromiseResponse("init-app", {
        mode
      });
    }

    // display
    mainWindow.show();

    // load file
    if (fileLoadStub && !cmdArgs.generateTestChunks) {
      const fileContents = await fileLoadStub;
      await sendMessageAndPromiseResponse("load-file", {
        fileContents,
        fileName: cmdArgs.file && path.basename(cmdArgs.file),
        filePath: cmdArgs.file
      });
    }

    if (cmdArgs.generateTestChunks) {
      const fileContents = fileLoadStub ? await fileLoadStub : null;
      ipcMain.on("done-with-chunks", () => process.exit(0));
      await sendMessageAndPromiseResponse("generate-test-chunks", {
        fileContents,
        outputFile: path.resolve(process.cwd(), "test", "chunk"),
        spatialSize: 256,
        imageSize: 256
      });
    }
  }
  catch (e) {
    global.console.error(e);
  }
}

// this method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on("ready", createWindow);

// quit when all windows are closed.
app.on("window-all-closed", function () {
  app.quit();
});

app.on("activate", function () {
  if (mainWindow === null) {
    createWindow();
  }
});
