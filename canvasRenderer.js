// canvasRenderer.js
// This module handles all drawing operations on the main application canvas.
// It includes logic for rendering nodes, text, and applying transformations like zoom and pan.
console.log("canvasRenderer.js loaded");

window.MyProjectCanvasRenderer = {
  /** @type {HTMLCanvasElement|null} The main canvas element. */
  canvas: null,
  /** @type {CanvasRenderingContext2D|null} The 2D rendering context of the canvas. */
  ctx: null,
  /** @type {Function|null} A function reference to get word count, typically from UIManager. */
  getWordCountFunction: null,

  /**
   * Initializes the CanvasRenderer with the canvas element and necessary utility functions.
   * @param {HTMLCanvasElement} canvasElement - The main canvas DOM element.
   * @param {Function} getWordCountFn - A function that takes a string and returns its word count.
   */
  init: function(canvasElement, getWordCountFn) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.getWordCountFunction = getWordCountFn; 
  },

  /**
   * Draws a single node on the canvas.
   * This is a helper function called by the main `draw` method.
   * @private
   * @param {Object} node - The node object to draw.
   * @param {boolean} isCurrentLevel - True if the node is in the currently active viewing level.
   * @param {boolean} isAncestor - True if the node is an ancestor of the current viewing level.
   * @param {number} scale - The current zoom scale of the canvas.
   */
  _drawNode: function(node, isCurrentLevel, isAncestor, scale) {
    const nodeColor = node.type === 'text' ? AppConstants.NODE_TEXT_COLOR : AppConstants.NODE_DEFAULT_COLOR;
    let fillAlpha = AppConstants.OTHER_LEVEL_FILL_ALPHA;
    let textAlpha = AppConstants.OTHER_LEVEL_TEXT_ALPHA;
    let strokeStyle = null;
    let strokeWidth = 2 / scale; // Default stroke width, adjusts with zoom

    if (isCurrentLevel) {
      fillAlpha = AppConstants.CURRENT_LEVEL_FILL_ALPHA;
      textAlpha = AppConstants.CURRENT_LEVEL_TEXT_ALPHA;
      if (node.selected) {
        strokeStyle = AppConstants.NODE_SELECTED_STROKE_COLOR;
        strokeWidth = 4 / scale; // Thicker stroke for selected node
      }
    } else if (isAncestor) { 
      fillAlpha = AppConstants.ANCESTOR_FILL_ALPHA;
      textAlpha = AppConstants.ANCESTOR_TEXT_ALPHA;
    }
    
    this.ctx.globalAlpha = fillAlpha;
    this.ctx.fillStyle = nodeColor;
    this.ctx.beginPath();
    this.ctx.roundRect(node.x, node.y, node.width, node.height, 15);
    this.ctx.fill();

    if (strokeStyle) {
      this.ctx.strokeStyle = strokeStyle;
      this.ctx.lineWidth = strokeWidth;
      this.ctx.stroke();
    }

    if (!node.isEditing) {
      this.ctx.globalAlpha = textAlpha;
      this.ctx.fillStyle = AppConstants.DEFAULT_TEXT_COLOR;
      this.ctx.font = AppConstants.DEFAULT_FONT_BOLD;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(node.title, node.x + node.width / 2, node.y + node.height / 2);

      if (node.type === 'text' && this.getWordCountFunction) {
            const wordCount = this.getWordCountFunction(node.content);
            this.ctx.font = AppConstants.WORD_COUNT_FONT;
            this.ctx.fillStyle = AppConstants.WORD_COUNT_COLOR; 
            this.ctx.textAlign = 'right';
            this.ctx.textBaseline = 'bottom';
            this.ctx.fillText(`${wordCount} words`, node.x + node.width - 10, node.y + node.height - 10);
      }
    }
  },
  
  /**
   * The main drawing function for the application.
   * It clears the canvas and renders all visible nodes based on the current view,
   * zoom (scale), and pan (offsetX, offsetY) settings.
   * @param {Array<Object>} nodes - The array of root node objects.
   * @param {Array<Object>} viewStack - An array representing the current path in the node hierarchy.
   * @param {Array<Object>} currentNodes - The array of nodes at the current viewing level.
   * @param {number} scale - The current zoom scale.
   * @param {number} offsetX - The current horizontal pan offset.
   * @param {number} offsetY - The current vertical pan offset.
   * @param {Object|null} selectedNodeGlobal - The currently selected node object (if any), managed by renderer.js.
   *                                         (Note: _drawNode uses node.selected, which should be consistent)
   */
  draw: function(nodes, viewStack, currentNodes, scale, offsetX, offsetY, selectedNodeGlobal) {
    if (!this.canvas || !this.ctx) {
      console.error("Canvas or context not initialized in MyProjectCanvasRenderer");
      return;
    }
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.scale(scale, scale);
    this.ctx.translate(-this.canvas.width / 2 - offsetX, -this.canvas.height / 2 - offsetY);

    const allLevels = [nodes, ...viewStack.map(n => n.children)];

    allLevels.forEach((levelNodes) => {
      const isCurrentLevel = levelNodes === currentNodes;
      levelNodes.forEach(node => {
        const isNodeInViewStack = viewStack.includes(node);
        this._drawNode(node, isCurrentLevel, isNodeInViewStack && !isCurrentLevel, scale);
      });
    });
    this.ctx.restore();
  },

  /**
   * Converts canvas click coordinates to world coordinates based on current scale and offset.
   * @param {number} mouseX - The x-coordinate of the mouse click on the canvas.
   * @param {number} mouseY - The y-coordinate of the mouse click on the canvas.
   * @param {HTMLCanvasElement} canvasEl - The canvas element (passed to make it more of a utility).
   * @param {number} currentScale - The current zoom scale.
   * @param {number} currentOffsetX - The current horizontal pan offset.
   * @param {number} currentOffsetY - The current vertical pan offset.
   * @returns {{x: number, y: number}} The world coordinates.
   */
  getCanvasWorldPosition: function(mouseX, mouseY, canvasEl, currentScale, currentOffsetX, currentOffsetY) {
    const rect = canvasEl.getBoundingClientRect(); // Get canvas position in viewport
    const canvasMouseX = mouseX - rect.left;
    const canvasMouseY = mouseY - rect.top;

    const worldX = (canvasMouseX - canvasEl.width / 2) / currentScale + canvasEl.width / 2 + currentOffsetX;
    const worldY = (canvasMouseY - canvasEl.height / 2) / currentScale + canvasEl.height / 2 + currentOffsetY;
    return { x: worldX, y: worldY };
  }
};
console.log("canvasRenderer.js JSDoc comments added and getCanvasWorldPosition updated.");
