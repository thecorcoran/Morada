// nodeManager.js
// This module is responsible for managing nodes: creating, deleting, finding, 
// adding tags, and handling title editing.
// Node dimensions (NODE_WIDTH, NODE_HEIGHT) are sourced from AppConstants.
console.log("nodeManager.js loaded");

window.MyProjectNodeManager = {
  // --- Injected Dependencies (set via init) ---
  /** @type {number} Current canvas zoom scale. */
  scale: 1,
  /** @type {number} Current canvas horizontal offset. */
  offsetX: 0,
  /** @type {number} Current canvas vertical offset. */
  offsetY: 0,
  /** @type {HTMLCanvasElement|null} The main canvas element. */
  canvas: null, 
  /** @type {Function|null} Function to get the current list of nodes to operate on. */
  getCurrentNodes: null, 
  /** @type {Function|null} Function to trigger a redraw of the canvas. */
  drawFunction: null, 
  /** @type {Function|null} Function to save the current state of all nodes. */
  saveNodesFunction: null, 

  /**
   * Initializes the NodeManager with necessary references and functions from the main application.
   * @param {HTMLCanvasElement} canvasEl - The main canvas DOM element.
   * @param {number} initialScale - The initial zoom scale of the canvas.
   * @param {number} initialOffsetX - The initial horizontal pan offset.
   * @param {number} initialOffsetY - The initial vertical pan offset.
   * @param {Function} getCurrentNodesFunc - Function that returns the current array of nodes.
   * @param {Function} drawFunc - Function to call to redraw the canvas.
   * @param {Function} saveNodesFunc - Function to call to save all nodes.
   */
  init: function(canvasEl, initialScale, initialOffsetX, initialOffsetY, getCurrentNodesFunc, drawFunc, saveNodesFunc) {
    this.canvas = canvasEl;
    this.scale = initialScale;
    this.offsetX = initialOffsetX;
    this.offsetY = initialOffsetY;
    this.getCurrentNodes = getCurrentNodesFunc;
    this.drawFunction = drawFunc;
    this.saveNodesFunction = saveNodesFunc;
  },
  
  /**
   * Updates the shared canvas transform variables if they change in the renderer.
   * @param {number} newScale - The new canvas zoom scale.
   * @param {number} newOffsetX - The new canvas horizontal offset.
   * @param {number} newOffsetY - The new canvas vertical offset.
   */
  updateSharedVariables: function(newScale, newOffsetX, newOffsetY) {
    this.scale = newScale;
    this.offsetX = newOffsetX;
    this.offsetY = newOffsetY;
  },

  /**
   * Finds a node at the given mouse coordinates on the canvas.
   * @param {number} mouseX - The x-coordinate of the mouse on the canvas.
   * @param {number} mouseY - The y-coordinate of the mouse on the canvas.
   * @returns {Object|null} The node object if found, otherwise null.
   * Note: This version of getNodeAtPosition uses the module's internal canvas, scale, offsetX, offsetY, and getCurrentNodes.
   * The prompt signature was (mouseX, mouseY, canvas, scale, offsetX, offsetY, currentNodes) - this implies passing them,
   * but current implementation uses 'this.canvas' etc. Sticking to current internal usage.
   */
  getNodeAtPosition: function(mouseX, mouseY) {
    if (!this.canvas || !this.getCurrentNodes) {
        console.error("NodeManager not fully initialized for getNodeAtPosition (canvas or getCurrentNodes missing)");
        return null;
    }
    // Use MyProjectCanvasRenderer.getCanvasWorldPosition if available and appropriate
    const worldX = (mouseX - this.canvas.clientWidth / 2) / this.scale + this.canvas.width / 2 + this.offsetX;
    const worldY = (mouseY - this.canvas.clientHeight / 2) / this.scale + this.canvas.height / 2 + this.offsetY;
    
    const currentNodes = this.getCurrentNodes();
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
   * Creates an inline editor for a node's title.
   * @param {Object} node - The node object whose title is to be edited.
   * @param {Array<Object>} rootNodes - The root nodes array, passed to saveNodesFunction.
   * Note: The prompt signature was (node, scale, offsetX, offsetY, canvas, onSaveCallback).
   * This implementation uses the module's internal scale, offsetX, canvas, and saveNodesFunction/drawFunction.
   * It's being kept consistent with current module structure. `rootNodes` is for the save function.
   */
  createTitleEditor: function(node, rootNodes) { 
    if (!this.drawFunction || !this.saveNodesFunction || !this.canvas) {
        console.error("NodeManager not fully initialized for createTitleEditor");
        return;
    }
    node.isEditing = true;
    this.drawFunction(); 

    const editor = document.createElement('input');
    editor.type = 'text';
    editor.className = 'node-editor'; // Ensure CSS class for styling
    editor.value = node.title;

    const rect = this.canvas.getBoundingClientRect();
    const canvasX = rect.left + window.scrollX;
    const canvasY = rect.top + window.scrollY;

    const screenX = (node.x - this.offsetX) * this.scale + this.canvas.width / 2 + canvasX;
    const screenY = (node.y - this.offsetY) * this.scale + this.canvas.height / 2 + canvasY;
    
    editor.style.position = 'absolute'; // Crucial for correct positioning
    editor.style.left = `${screenX}px`;
    editor.style.top = `${screenY}px`;
    editor.style.width = `${node.width * this.scale}px`;
    editor.style.fontSize = `${16 * this.scale}px`; // Consider AppConstants for font details
    editor.style.zIndex = '1000'; // Ensure editor is on top

    document.body.appendChild(editor);
    editor.focus();
    editor.select();

    const saveAndRemove = () => {
      node.title = editor.value;
      node.isEditing = false;
      if (document.body.contains(editor)) { // Check if editor is still in DOM
          document.body.removeChild(editor);
      }
      this.saveNodesFunction(rootNodes); 
      this.drawFunction(); 
    };

    editor.addEventListener('blur', saveAndRemove, { once: true }); // Use {once: true} to auto-remove after blur
    editor.addEventListener('keydown', (e) => {
      if (e.key === AppConstants.KEY_ENTER || e.key === AppConstants.KEY_ESCAPE) {
        e.stopPropagation();
        // blur will trigger saveAndRemove due to {once: true}
        editor.blur(); // Trigger blur to save and remove
      }
    });
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
    return {
      id: id,
      x: x - AppConstants.NODE_WIDTH / 2, // Center node on coordinates
      y: y - AppConstants.NODE_HEIGHT / 2,
      width: AppConstants.NODE_WIDTH,
      height: AppConstants.NODE_HEIGHT,
      title: isTextType ? AppConstants.NEW_SCRIPTORIUM_TITLE : AppConstants.NEW_CHAMBER_TITLE,
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
      // Note: This function doesn't save; saving should be handled by the caller.
    }
  },

  /**
   * Deletes a node from a list of nodes by its ID.
   * This is a pure function and does not modify the original list directly.
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
console.log("nodeManager.js JSDoc comments and new functions added.");
