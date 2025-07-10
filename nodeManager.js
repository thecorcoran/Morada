// nodeManager.js
// This module is responsible for managing nodes: creating, deleting, finding, 
// adding tags, and handling title editing.
// Node dimensions (NODE_WIDTH, NODE_HEIGHT) are sourced from AppConstants.
console.log("nodeManager.js loaded");
import { NodeConstants, MiscConstants, KeyConstants } from './constants.js';

export const nodeManager = {
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
  /** @type {Array<Object>|null} A reference to the main view stack array. */
  viewStack: null,
  /** @type {Object|null} A reference to the canvasRenderer module. */
  canvasRenderer: null,

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
  init: function(config) {
    this.canvas = config.canvasEl;
    this.scale = config.initialScale;
    this.offsetX = config.initialOffsetX;
    this.offsetY = config.initialOffsetY;
    this.getCurrentNodes = config.getCurrentNodesFunc;
    this.drawFunction = config.drawFunc;
    this.saveNodesFunction = config.saveNodesFunc;
    this.viewStack = config.viewStackRef;
    this.canvasRenderer = config.canvasRendererRef;
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
   */
  getNodeAtPosition: function(mouseX, mouseY) {
    if (!this.canvas || !this.getCurrentNodes) {
        console.error("NodeManager not fully initialized for getNodeAtPosition (canvas or getCurrentNodes missing)");
        return null;
    }
    // Correctly convert screen coordinates (from event.offsetX/Y) to world coordinates
    const worldX = (mouseX - this.canvas.width / 2) / this.scale + this.offsetX;
    const worldY = (mouseY - this.canvas.height / 2) / this.scale + this.offsetY;
    
    const currentNodes = this.getCurrentNodes();

    if (this.viewStack && this.viewStack.length === 0) {
      // Bookshelf view logic: check against both books and loose-leaf documents
      // Use the multi-shelf layout to get the correct, rendered positions of all items.
      const layoutNodes = this.canvasRenderer.calculateMultiShelfLayout(currentNodes);

      // Iterate backwards so we hit the top-most items first.
      for (let i = layoutNodes.length - 1; i >= 0; i--) {
        const layoutNode = layoutNodes[i];
        if (worldX >= layoutNode.x && worldX <= layoutNode.x + layoutNode.width &&
            worldY >= layoutNode.y && worldY <= layoutNode.y + layoutNode.height) {
          // The layoutNode has the original node's data, so we can return it directly.
          // However, it's safer to return the original object from the source array.
          return currentNodes.find(n => n.id === layoutNode.id);
        }
      }
    } else {
      // Standard view logic: check against original node positions
      for (let i = currentNodes.length - 1; i >= 0; i--) {
        const node = currentNodes[i];
        if (worldX >= node.x && worldX <= node.x + node.width &&
            worldY >= node.y && worldY <= node.y + node.height) {
          return node;
        }
      }
    }
    return null;
  },

  /**
   * Creates an inline editor for a node's title.
   * @param {Object} node - The node object whose title is to be edited.
   * Note: The prompt signature was (node, scale, offsetX, offsetY, canvas, onSaveCallback).
   * This implementation uses the module's internal scale, offsetX, canvas, and saveNodesFunction/drawFunction.
   */
  createTitleEditor: function(node) { 
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

    // Correctly calculate screen position for the editor
    const screenX = (node.x - this.offsetX) * this.scale + this.canvas.width / 2;
    const screenY = (node.y - this.offsetY) * this.scale + this.canvas.height / 2;
    
    editor.style.position = 'absolute'; // Crucial for correct positioning
    const canvasRect = this.canvas.getBoundingClientRect();
    editor.style.left = `${canvasRect.left + screenX}px`;
    editor.style.top = `${canvasRect.top + screenY}px`;
    editor.style.width = `${node.width * this.scale}px`;
    editor.style.fontSize = `${16 * this.scale}px`; // Consider AppConstants for font details
    editor.style.zIndex = '1000'; // Ensure editor is on top

    document.body.appendChild(editor);
    editor.focus();
    editor.select();

    const saveAndRemove = async () => {
      node.title = editor.value;
      node.isEditing = false;
      if (document.body.contains(editor)) { // Check if editor is still in DOM
          document.body.removeChild(editor);
      }
      await this.saveNodesFunction(); // This is now an alias for saveData
      this.drawFunction(); 
    };

    editor.addEventListener('blur', saveAndRemove, { once: true }); // Use {once: true} to auto-remove after blur
    editor.addEventListener('keydown', (e) => {
      if (e.key === KeyConstants.ENTER || e.key === KeyConstants.ESCAPE) {
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
      x: x - NodeConstants.NODE_WIDTH / 2, // Center node on coordinates
      y: y - NodeConstants.NODE_HEIGHT / 2,
      width: NodeConstants.NODE_WIDTH,
      height: NodeConstants.NODE_HEIGHT,
      title: isTextType ? MiscConstants.NEW_SCRIPTORIUM_TITLE : MiscConstants.NEW_BOOK_TITLE,
      content: '',
      tags: [],
      children: [],
      // Note: 'comments' array is initialized, but individual comment objects will not have 'status' property.
      comments: [],
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
