// dataStorage.js
// This module is responsible for data storage, including loading, saving,
// and normalizing node data, as well as managing application-level selections
// like the currently selected node and the manuscript list for compilation.
console.log("dataStorage.js loaded");

window.MyProjectDataStorage = {
  /** @type {string} Stores the active data path after it's set by loadNodes. */
  _activeDataPath: '',
  /** @type {string} Stores the active backup data path. */
  _backupDataPath: '',

  _rootNodes: [],
  _internalSelectedNode: null,
  _internalManuscriptList: [],

  /**
   * Initializes the data storage module by fetching the data paths from the main process.
   */
  async init() {
    const paths = await window.fs.getDataPaths();
    this._activeDataPath = paths.dataPath;
    this._backupDataPath = paths.backupPath;
  },

  /**
   * Sets the initial root nodes for the application.
   * @param {Array<Object>} nodes - The array of root node objects.
   */
  setInitialNodes: function(nodes) {
    this._rootNodes = nodes;
  },

  /**
   * Retrieves the current root nodes.
   * @returns {Array<Object>} The array of root node objects.
   */
  getRootNodes: function() {
    return this._rootNodes;
  },

  /**
   * Saves the provided tree of nodes to the JSON file.
   * It first creates a backup of the existing data file.
   * @param {Array<Object>} rootNodesToSave - The array of root node objects to save.
   */
  async saveNodes(rootNodesToSave) {
    if (!this._activeDataPath) {
      console.error("Error saving nodes: Data path not set. Call init first.");
      return;
    }
    try {
      // Backup the current data file before saving
      if (await window.fs.exists(this._activeDataPath)) {
        await window.fs.copyFile(this._activeDataPath, this._backupDataPath);
      }
      const data = JSON.stringify(rootNodesToSave, null, 2);
      await window.fs.writeFile(this._activeDataPath, data);
    } catch (err) {
      console.error(`Error saving nodes to ${this._activeDataPath}: ${err.message}`, err);
    }
  },

  /**
   * Loads nodes from the JSON file.
   * If the file doesn't exist, it returns an empty array.
   * If the file is corrupted, it attempts to load from a backup.
   * @returns {Array<Object>} The loaded (and normalized) array of root node objects, or an empty array on failure.
   */
  async loadNodes() {
    if (!this._activeDataPath) {
      await this.init(); // Ensure paths are loaded
    }

    this._internalSelectedNode = null;
    this._internalManuscriptList = [];

    const loadFromFile = async (filePath) => {
      try {
        if (await window.fs.exists(filePath)) {
          const data = await window.fs.readFile(filePath, 'utf8');
          this._rootNodes = JSON.parse(data);
          this.normalizeNodes(this._rootNodes);
          console.log(`Nodes loaded successfully from ${filePath}`);
          return this._rootNodes;
        }
      } catch (err) {
        console.error(`Error loading or parsing file from ${filePath}: ${err.message}`, err);
      }
      return null;
    };

    let loadedData = await loadFromFile(this._activeDataPath);

    if (loadedData === null && await window.fs.exists(this._backupDataPath)) {
      console.log("Attempting to load from backup file.");
      loadedData = await loadFromFile(this._backupDataPath);
      if (loadedData !== null) {
        // If backup is successful, restore it to the main file
        await this.saveNodes(loadedData);
      }
    }

    if (loadedData === null) {
      console.log("Starting with an empty dataset.");
      this._rootNodes = [];
      return this._rootNodes;
    }

    return loadedData;
  },

  /**
   * Restores the main data file from the backup file.
   * @returns {boolean} True if restoration was successful, false otherwise.
   */
  async restoreFromBackup() {
    if (!this._backupDataPath) {
      console.error("Backup path not set. Call init first.");
      return false;
    }
    try {
      if (await window.fs.exists(this._backupDataPath)) {
        await window.fs.copyFile(this._backupDataPath, this._activeDataPath);
        console.log(`Successfully restored data from ${this._backupDataPath} to ${this._activeDataPath}`);
        return true;
      } else {
        console.warn("No backup file found to restore from.");
        return false;
      }
    } catch (err) {
      console.error(`Error restoring from backup: ${err.message}`, err);
      return false;
    }
  },

  /**
   * Sets the currently selected node in the application.
   * @param {Object|null} node - The node object to set as selected, or null to clear selection.
   */
  setSelectedNode: function(node) {
    this._internalSelectedNode = node;
  },

  /**
   * Gets the currently selected node.
   * @returns {Object|null} The currently selected node object, or null if no node is selected.
   */
  getSelectedNode: function() {
    return this._internalSelectedNode;
  },

  /**
   * Gets the current list of nodes selected for the manuscript.
   * @returns {Array<Object>} An array of node objects in the manuscript list.
   */
  getManuscriptList: function() {
    return this._internalManuscriptList;
  },

  /**
   * Adds a node to the manuscript list if it's not already present.
   * @param {Object} node - The node object to add to the manuscript list.
   */
  addToManuscriptList: function(node) {
    if (!this._internalManuscriptList.find(item => item.id === node.id)) {
      this._internalManuscriptList.push(node);
    }
  },

  /**
   * Removes a node from the manuscript list by its ID.
   * @param {string} nodeId - The ID of the node to remove from the manuscript list.
   */
  removeFromManuscriptList: function(nodeId) {
    this._internalManuscriptList = this._internalManuscriptList.filter(item => item.id !== nodeId);
  },

  /**
   * Clears all nodes from the manuscript list.
   */
  clearManuscriptList: function() {
    this._internalManuscriptList = [];
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
      node.width = node.width || (window.AppConstants ? AppConstants.NODE_WIDTH : 250);
      node.height = node.height || (window.AppConstants ? AppConstants.NODE_HEIGHT : 150);

      if (!Array.isArray(node.children)) node.children = [];
      if (typeof node.type !== 'string') node.type = 'container';
      if (typeof node.title !== 'string') node.title = 'Untitled';
      if (typeof node.content !== 'string') node.content = '';
      if (!Array.isArray(node.tags)) node.tags = [];

      node.isExpanded = typeof node.isExpanded === 'boolean' ? node.isExpanded : false;
      node.selected = typeof node.selected === 'boolean' ? node.selected : false;

      if (node.children.length > 0) {
        this.normalizeNodes(node.children);
      }
    });
  }
};
console.log("dataStorage.js has been refactored to use secure IPC for file access and includes a backup system.");
