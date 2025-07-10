// preload.js
// This script runs before the renderer process and has access to both the DOM
// and Node.js APIs. It's used to securely expose a limited set of Node.js
// functionality to the renderer process.

const { contextBridge, ipcRenderer } = require('electron');

// Expose a controlled API to the renderer process (window object).
// We are using IPC to invoke functions on the main process, which is the most
// secure way to handle file system access.
contextBridge.exposeInMainWorld('electronAPI', {
  // These functions now use ipcRenderer.invoke to call async handlers in the main process.
  // They return Promises, making the file operations non-blocking.
  getDataPaths: () => ipcRenderer.invoke('get-data-paths'),
  fs: {
    exists: (path) => ipcRenderer.invoke('fs-exists', path),
    copyFile: (src, dest) => ipcRenderer.invoke('fs-copy-file', src, dest),
    writeFile: (path, data, options) => ipcRenderer.invoke('fs-write-file', path, data, options),
    rename: (oldPath, newPath) => ipcRenderer.invoke('fs-rename', oldPath, newPath),
    readFile: (path, options) => ipcRenderer.invoke('fs-read-file', path, options),
  }
});

console.log("preload.js executed and API exposed.");