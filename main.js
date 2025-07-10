const { app, BrowserWindow, ipcMain, session, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    fullscreen: true,
    width: 800,
    height: 600,
    // NEW: Add the webPreferences block here
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Set a Content Security Policy (CSP) for the application.
  // This is the recommended, most secure way to apply a CSP in Electron.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self';",
          "script-src 'self' https://cdn.tiny.cloud https://cdn.jsdelivr.net;",
          "style-src 'self' 'unsafe-inline' https://cdn.tiny.cloud;",
          "font-src 'self' data: https://cdn.tiny.cloud;",
          "img-src 'self' data: blob: https://sp.tinymce.com;",
          "connect-src 'self' https://cdn.tiny.cloud https://en.wiktionary.org;"
        ].join(' ')
      }
    });
  });

  mainWindow.loadFile('index.html');
};

// --- Application Menu ---
const createMenu = () => {
  const isMac = process.platform === 'darwin';

  const template = [
    // { role: 'appMenu' } for macOS
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    // { role: 'fileMenu' } for Windows/Linux
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    // { role: 'viewMenu' }
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};
// --- IPC Handlers for Secure File System Access ---

const fsSync = require('node:fs'); // Keep sync version for migration check
// Use the recommended 'userData' directory for storing application data.
const dataPath = path.join(app.getPath('userData'), 'morada-data.json');

/**
 * One-time migration logic to move the data file from the project directory
 * to the standard user data directory. This ensures existing users don't
 * lose their data after the storage location was changed for security.
 */
function migrateDataFile() {
  const oldPath = path.join(__dirname, 'morada-data.json');
  const newPath = dataPath; // dataPath is already defined with the new location

  // If the new file doesn't exist but the old one does, copy it.
  if (!fsSync.existsSync(newPath) && fsSync.existsSync(oldPath)) {
    try {
      fsSync.copyFileSync(oldPath, newPath);
      console.log(`[Migration] Successfully moved data from ${oldPath} to ${newPath}`);
    } catch (err) {
      console.error(`[Migration] Failed to move data file: ${err}`);
    }
  }
}

// These handlers listen for ASYNCHRONOUS requests from the preload script.
// They use ipcMain.handle and return a Promise.
ipcMain.handle('get-data-paths', () => {
  return {
    dataPath: dataPath,
    backupPath: dataPath + '.bak' // Provide backup path directly
  };
});

ipcMain.handle('fs-read-file', async (event, aPath, options) => {
  try {
    return await fs.readFile(aPath, options);
  } catch (err) {
    console.error(`Error reading file ${aPath}:`, err);
    throw err; // Re-throw the error to be caught by the renderer's .catch()
  }
});

ipcMain.handle('fs-write-file', async (event, aPath, data, options) => {
  try {
    await fs.writeFile(aPath, data, options);
  } catch (err) {
    console.error(`Error writing file ${aPath}:`, err);
    throw err;
  }
});

ipcMain.handle('fs-exists', async (event, aPath) => {
  try {
    await fs.access(aPath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('fs-copy-file', async (event, src, dest) => {
  try {
    await fs.copyFile(src, dest);
  } catch (err) {
    console.error(`Error copying file from ${src} to ${dest}:`, err);
    throw err;
  }
});

ipcMain.handle('fs-rename', async (event, oldPath, newPath) => {
  try {
    await fs.rename(oldPath, newPath);
  } catch (err) {
    console.error(`Error renaming file from ${oldPath} to ${newPath}:`, err);
    throw err;
  }
});

app.whenReady().then(() => {
  migrateDataFile(); // Run migration logic before creating the window
  createMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});