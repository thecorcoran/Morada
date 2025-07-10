// dataStorage.js
// This module will be responsible for data storage, including loading, saving,
// and normalizing node data, as well as managing application-level selections
// like the currently selected node and the manuscript list for compilation.
console.log("dataStorage.js loaded");

import { NodeConstants, MiscConstants } from './constants.js';
const fs = window.electronAPI.fs;

// dataPath is defined in the original renderer.js and passed to functions.
// For a fully self-contained module, this should be configured, possibly during an init phase.
// However, adhering to current refactoring step, assuming dataPath is accessible or set.
// const defaultDataPath = path.join(__dirname, '..', 'morada-data.json'); // Example if it were self-contained
export const dataStorageManager = {
  /** @type {string} Stores the active data path after it's set by loadNodes. */
  _activeDataPath: '', 
  /** @type {string} Stores the path for the backup data file. */
  _backupDataPath: '',

  /**
   * Asynchronously saves the provided data to the JSON file, with backup and temp file logic for safety.
   * @param {Object} dataToSave - An object containing all data to be persisted, e.g., { nodes: [], manuscript: [] }.
   * @returns {Promise<void>} A promise that resolves when the save is complete.
   */
  async saveData(dataToSave) {
    if (!this._activeDataPath) {
      throw new Error("Error saving data: Data path not set. Call loadData first.");
    }
    try {
      // Before saving, if manuscript contains full objects, map it to an array of IDs.
      const dataToSerialize = {
        nodes: dataToSave.nodes,
        manuscript: (dataToSave.manuscript || []).map(item => (typeof item === 'object' && item.id) ? item.id : item),
        shelves: dataToSave.shelves || []
      };

      const jsonString = JSON.stringify(dataToSerialize, null, 2);
      const tempPath = this._activeDataPath + '.tmp';

      // Create a backup of the current data file before overwriting
      if (await fs.exists(this._activeDataPath)) {
          await fs.copyFile(this._activeDataPath, this._backupDataPath);
      }

      await fs.writeFile(tempPath, jsonString, 'utf8');
      await fs.rename(tempPath, this._activeDataPath);
      console.log(`Data saved successfully to: ${this._activeDataPath}`);
    } catch (err) {
      console.error(`!!! CRITICAL: Error saving data to ${this._activeDataPath}: ${err.message}`, err);
      alert("Critical error saving data. Please check console and consider manual backup of morada-data.json if possible.");
      throw err; // Re-throw the error so the caller knows the save failed.
    }
  },

  /**
   * Recursively normalizes an array of nodes and their children.
   * Ensures essential properties exist and have default values.
   * @param {Array<Object>} nodesToNormalize - The array of node objects to normalize.
   */
  normalizeNodes: function(nodesToNormalize) {
    nodesToNormalize.forEach(node => {
      node.id = node.id || Date.now() + Math.random().toString(36).substr(2, 9);
      node.x = typeof node.x === 'number' ? node.x : 0;
      node.y = typeof node.y === 'number' ? node.y : 0;
      node.width = node.width || NodeConstants.NODE_WIDTH;
      node.height = node.height || NodeConstants.NODE_HEIGHT;
      
      if (!Array.isArray(node.children)) node.children = [];
      if (typeof node.type !== 'string') node.type = 'container'; 
      if (typeof node.title !== 'string') {
        // Use the same default titles as nodeManager for consistency.
        node.title = node.type === 'text' ? MiscConstants.NEW_SCRIPTORIUM_TITLE : MiscConstants.NEW_BOOK_TITLE;
      }
      if (typeof node.content !== 'string') node.content = '';
      if (!Array.isArray(node.tags)) node.tags = [];
      if (!Array.isArray(node.comments)) node.comments = [];
      if (!Array.isArray(node.certifiedWords)) node.certifiedWords = []; // Ensure certifiedWords exists
      
      node.isExpanded = typeof node.isExpanded === 'boolean' ? node.isExpanded : false;
      node.selected = typeof node.selected === 'boolean' ? node.selected : false;
      
      if (node.children.length > 0) { 
        this.normalizeNodes(node.children);
      }
    });
  },

  /**
   * Asynchronously loads data from the JSON file, with logic to restore from a backup.
   * Sets the active data and backup paths for subsequent saves.
   * @returns {Promise<{nodes: Array<Object>, manuscript: Array<Object>}>} A promise that resolves with the loaded data.
   */
  async loadData() {
    const paths = await window.electronAPI.getDataPaths();
    this._activeDataPath = paths.dataPath;
    this._backupDataPath = paths.backupPath;

    let appData = { nodes: [], manuscript: [], shelves: [] }; // Default empty state

    try {
      if (await fs.exists(this._activeDataPath)) {
        const data = await fs.readFile(this._activeDataPath, 'utf8');
        const parsedData = JSON.parse(data);
        
        // Handle both old array-only format and new object format
        appData.nodes = Array.isArray(parsedData) ? parsedData : (parsedData.nodes || []);
        // Ensure manuscript is an array of IDs, not full objects
        const manuscriptIds = (parsedData.manuscript || []).map(item => (typeof item === 'object' && item.id) ? item.id : item);
        appData.manuscript = manuscriptIds;
        appData.shelves = parsedData.shelves || [];

        // --- One-time Migration for Shelf Names ---
        if (appData.nodes.length > 0 && appData.shelves.length === 0) {
            console.log("[Migration] No shelf names found. Creating defaults.");
            const maxShelf = appData.nodes.reduce((max, node) => Math.max(max, node.shelf || 0), -1);
            if (maxShelf >= 0) {
                for (let i = 0; i <= maxShelf; i++) {
                    appData.shelves.push({ index: i, name: `Shelf ${i + 1}` });
                }
            }
        }

        this.normalizeNodes(appData.nodes);
        console.log(`Data loaded successfully from ${this._activeDataPath}.`);
      } else {
        console.log("Main data file not found. Checking for backup.");
        appData = await this._loadFromBackup();
      }
    } catch (err) {
      console.error(`!!! CRITICAL: Error loading or parsing ${this._activeDataPath}:`, err);
      alert(`Error loading data: ${err.message}. Trying to load from backup.`);
      appData = await this._loadFromBackup();
    }
    return appData;
  },

  /**
   * Asynchronously attempts to load data from the backup file. If successful,
   * it restores the main data file from the backup.
   * @private
   * @returns {Promise<{nodes: Array<Object>, manuscript: Array<Object>}>} A promise that resolves with the backup data or an empty state.
   */
  async _loadFromBackup() {
    if (await fs.exists(this._backupDataPath)) {
      try {
        console.log(`Attempting to restore from backup: ${this._backupDataPath}`);
        const backupData = await fs.readFile(this._backupDataPath, 'utf8');
        const parsedData = JSON.parse(backupData); // This will be returned
        await fs.copyFile(this._backupDataPath, this._activeDataPath); // Restore main file
        console.log("Successfully restored data from backup.");
        return parsedData;
      } catch (backupErr) {
        console.error(`!!! CRITICAL: Failed to load or restore from backup file:`, backupErr);
        alert("Failed to load from backup. Starting with a blank state. Your data might still be in 'morada-data.json.bak'.");
      }
    }
    return { nodes: [], manuscript: [], shelves: [] }; // Return default empty state if no backup exists or fails
  }
};
console.log("dataStorage.js JSDoc comments added.");
