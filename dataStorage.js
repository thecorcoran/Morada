// dataStorage.js
// This module will be responsible for data storage, including loading, saving,
// and normalizing node data, as well as managing application-level selections
// like the currently selected node and the manuscript list for compilation.
console.log("dataStorage.js loaded");

const fs = require('fs');
const path = require('path');

// dataPath is defined in the original renderer.js and passed to functions.
// For a fully self-contained module, this should be configured, possibly during an init phase.
// However, adhering to current refactoring step, assuming dataPath is accessible or set.
// const defaultDataPath = path.join(__dirname, '..', 'morada-data.json'); // Example if it were self-contained

window.MyProjectDataStorage = {
  /** @type {string} Stores the active data path after it's set by loadNodes. */
  _activeDataPath: '', 
  
  _rootNodes: [], 
  _internalSelectedNode: null,
  _internalManuscriptList: [],

  /**
   * Sets the initial root nodes for the application.
   * This is typically called after loading data or when initializing with default/empty data.
   * @param {Array<Object>} nodes - The array of root node objects.
   */
  setInitialNodes: function(nodes) {
    this._rootNodes = nodes;
    // Normalization should ideally happen before or during setting initial nodes.
    // If nodes are loaded via loadNodes(), normalization is already handled.
  },
  
  /**
   * Retrieves the current root nodes.
   * @returns {Array<Object>} The array of root node objects.
   */
  getRootNodes: function() {
      return this._rootNodes;
  },

  /**
   * Saves the provided tree of nodes to the JSON file stored in `this._activeDataPath`.
   * @param {Array<Object>} rootNodesToSave - The array of root node objects to save.
   */
  saveNodes: function(rootNodesToSave) {
    if (!this._activeDataPath) {
      console.error("Error saving nodes: Data path not set. Call loadNodes first with a valid path.");
      return;
    }
    try {
      const data = JSON.stringify(rootNodesToSave, null, 2);
      fs.writeFileSync(this._activeDataPath, data);
    } catch (err) {
      console.error(`Error saving nodes to ${this._activeDataPath}: ${err.message}`, err);
    }
  },

  /**
   * Loads nodes from the JSON file specified by `passedDataPath`.
   * Sets this path as the active path for subsequent saves.
   * If the file doesn't exist or is corrupted, it returns an empty array and logs an error.
   * Also resets the internal selected node and manuscript list.
   * @param {string} passedDataPath - The path to the JSON file to load.
   * @returns {Array<Object>} The loaded (and normalized) array of root node objects, or an empty array on failure.
   */
  loadNodes: function(passedDataPath) {
    this._activeDataPath = passedDataPath; // Set the active data path
    this._internalSelectedNode = null; 
    this._internalManuscriptList = [];   
    try {
      if (fs.existsSync(this._activeDataPath)) {
        const data = fs.readFileSync(this._activeDataPath, 'utf8');
        this._rootNodes = JSON.parse(data);
        this.normalizeNodes(this._rootNodes); 
        console.log(`Nodes loaded successfully from ${this._activeDataPath}`);
        return this._rootNodes; 
      } else {
        console.log(`Data file not found at ${this._activeDataPath}. Starting with an empty dataset.`);
        this._rootNodes = [];
        return this._rootNodes; 
      }
    } catch (err) {
      if (err instanceof SyntaxError) { 
        console.error(`Error parsing JSON from ${this._activeDataPath}: ${err.message}. File might be corrupted. Starting with an empty dataset.`, err);
      } else {
        console.error(`Error loading nodes from ${this._activeDataPath}: ${err.message}. Starting with an empty dataset.`, err);
      }
      this._rootNodes = [];
      return this._rootNodes; 
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
console.log("dataStorage.js JSDoc comments added.");
