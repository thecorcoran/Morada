if (typeof window === 'undefined') {
  global.window = global;
}
console.log("nodeManager.js loaded");

window.MyProjectNodeManager = {
  // --- Injected Dependencies (set via init) ---
  stateManager: null,
  canvas: null,
  drawFunction: null,
  saveNodesFunction: null,

  /**
   * Initializes the NodeManager with necessary references and functions from the main application.
   * @param {Object} config - Configuration object.
   * @param {HTMLCanvasElement} config.canvas - The main canvas DOM element.
   * @param {Object} config.stateManager - The central state manager for the application.
   * @param {Function} config.drawFunction - Function to call to redraw the canvas.
   * @param {Function} config.saveNodesFunction - Function to call to save all nodes.
   */
  init: function(config) {
    this.canvas = config.canvas;
    this.stateManager = config.stateManager;
    this.drawFunction = config.drawFunction;
    this.saveNodesFunction = config.saveNodesFunction;
  },

  /**
   * Finds a node at the given mouse coordinates on the canvas.
   * @param {number} mouseX - The x-coordinate of the mouse on the canvas.
   * @param {number} mouseY - The y-coordinate of the mouse on the canvas.
   * @returns {Object|null} The node object if found, otherwise null.
   */
  getNodeAtPosition: function(mouseX, mouseY) {
  if (!this.canvas) {
    console.error("NodeManager not fully initialized for getNodeAtPosition (canvas missing)");
    return null;
  }
  const scale = this.stateManager.getScale();
  const offsetX = this.stateManager.getOffsetX();
  const offsetY = this.stateManager.getOffsetY();

  // mouseX/mouseY are client (CSS) coordinates. Convert to canvas pixel
  // coordinates in case the canvas is scaled by devicePixelRatio or CSS.
  const clientW = this.canvas.clientWidth || this.canvas.width;
  const clientH = this.canvas.clientHeight || this.canvas.height;
  const scaleX = this.canvas.width / clientW;
  const scaleY = this.canvas.height / clientH;
  const canvasMouseX = mouseX * scaleX;
  const canvasMouseY = mouseY * scaleY;

  // Convert canvas pixel coordinates into world coordinates used by the scene.
  const worldX = (canvasMouseX - this.canvas.width / 2) / scale + this.canvas.width / 2 + offsetX;
  const worldY = (canvasMouseY - this.canvas.height / 2) / scale + this.canvas.height / 2 + offsetY;
    
    const currentNodes = this.stateManager.getCurrentNodes();
    for (let i = currentNodes.length - 1; i >= 0; i--) {
      const node = currentNodes[i];
      if (worldX >= node.x && worldX <= node.x + node.width &&
          worldY >= node.y && worldY <= node.y + node.height) {
        return node;
      }
    }
    return null;
  },

  

  /**
   * Creates a new node object.
   * @param {number} x - The x-coordinate for the new node.
   * @param {number} y - The y-coordinate for the new node.
   * @param {boolean} isTextType - True if the node should be a text node, false for a container.
   * @param {string} id - A unique ID for the node.
   * @returns {Object} The newly created node object.
   */
  createNode: function(x, y, isTextType, id) {
    const nodeWidth = (typeof AppConstants !== 'undefined' && AppConstants.NODE_WIDTH) || 250;
    const nodeHeight = (typeof AppConstants !== 'undefined' && AppConstants.NODE_HEIGHT) || 150;
    const sheetTitle = (typeof AppConstants !== 'undefined' && (AppConstants.NEW_SHEET_TITLE || AppConstants.NEW_SCRIPTORIUM_TITLE)) || 'New Sheet';
    const portfolioTitle = (typeof AppConstants !== 'undefined' && (AppConstants.NEW_PORTFOLIO_TITLE || AppConstants.NEW_CHAMBER_TITLE)) || 'New Portfolio';
    return {
      id: id,
      x: x - nodeWidth / 2,
      y: y - nodeHeight / 2,
      width: nodeWidth,
      height: nodeHeight,
      title: isTextType ? sheetTitle : portfolioTitle,
      content: '',
      tags: [],
      children: [],
      type: isTextType ? 'text' : 'container',
      isExpanded: false,
      selected: false,
      isEditing: false
    };
  },

  /**
   * Adds a tag to a node if it doesn't already exist.
   * @param {Object} node - The node object to add the tag to.
   * @param {string} tag - The tag string to add.
   */
  addTagToNode: function(node, tag) {
    if (node && tag && !node.tags.includes(tag)) {
      node.tags.push(tag);
    }
  },

  /**
   * Deletes a node from a list of nodes by its ID.
   * @param {string} nodeId - The ID of the node to delete.
   * @param {Array<Object>} nodeList - The list of nodes to remove from.
   * @returns {Array<Object>} A new array with the node removed.
   */
  deleteNode: function(nodeId, nodeList) {
    return nodeList.filter(node => node.id !== nodeId);
  },

  /**
   * Recursively finds a node by its ID within a tree structure.
   * @param {string} nodeId - The ID of the node to find.
   * @param {Array<Object>} nodes - The array of nodes to search within.
   * @returns {Object|null} The found node object, or null if not found.
   */
  findNodeByIdPath: function(nodeId, nodes) {
    for (const node of nodes) {
      if (node.id === nodeId) {
        return node;
      }
      if (node.children && node.children.length > 0) {
        const found = this.findNodeByIdPath(nodeId, node.children);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.MyProjectNodeManager;
}
