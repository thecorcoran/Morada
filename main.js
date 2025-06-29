const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const remoteMain = require('@electron/remote/main');

remoteMain.initialize(); // Initialize @electron/remote

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    // NEW: Add the webPreferences block here
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  remoteMain.enable(mainWindow.webContents); // Enable @electron/remote for the window

  mainWindow.loadFile('index.html');
};

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});