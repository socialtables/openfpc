#!/usr/bin/env electron
"use strict";
const { app, BrowserWindow, ipcMain } = require("electron");
const Promise = require("bluebird");
const commander = require("commander");
const fs = require("fs");
const path = require("path");
const url = require("url");

// grab command line args
const cmdArgs = {};
commander
.arguments("[file]")
.option("--dev", "open DevTools")
.action((file, { dev }) => Object.assign(cmdArgs, { file, dev }));
commander.parse(process.argv);

// commander won't fire its action clause without a file argument
cmdArgs.dev = cmdArgs.dev || commander.dev;

// loader for specified file
function loadTargetFile(targetFileName) {
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
function createWindow () {

  // kick off loading he target file
  let fileLoadStub;
  if (cmdArgs.file) {
    fileLoadStub = loadTargetFile(cmdArgs.file);
  }

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
    title: cmdArgs.file ? `OpenFPC - ${cmdArgs.file}` : "OpenFPC",
    webPreferences: {
      nodeIntegration: true
    }
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

  // when file and window are loaded, send file to window
  let fileContents;
  if (fileLoadStub) {
    Promise.all([
      windowLoadStub,
      fileLoadStub.then(contents => fileContents = contents)
    ])
    .then(() => {
      mainWindow.webContents.send("load-file", {
        fileContents,
        fileName: cmdArgs.file && path.basename(cmdArgs.file),
        filePath: cmdArgs.file
      });
    })
    .catch(e => {
      global.console.error(e);
    });
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
