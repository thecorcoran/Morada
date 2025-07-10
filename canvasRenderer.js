// canvasRenderer.js
// This module handles all drawing operations on the main application canvas.
// It includes logic for rendering nodes, text, and applying transformations like zoom and pan.
console.log("canvasRenderer.js loaded");
import { NodeConstants, UIConstants, BookshelfConstants } from './constants.js';

export const canvasRenderer = {
  /** @type {HTMLCanvasElement|null} The main canvas element. */
  canvas: null,
  /** @type {CanvasRenderingContext2D|null} The 2D rendering context of the canvas. */
  ctx: null,
  /** @type {number} The current canvas zoom scale, mirrored from renderer. */
  scale: 1,
  /** @type {number} The current canvas horizontal offset, mirrored from renderer. */
  offsetX: 0,
  /** @type {number} The current canvas vertical offset, mirrored from renderer. */
  offsetY: 0,
  /** @type {Function|null} A function reference to get word count, typically from UIManager. */
  getWordCountFunction: null,
  /** @type {Function|null} A function reference to get total word count for a node and its children. */
  getTotalWordCountFunction: null,
  /** @private @type {Object|null} Caches the calculated bookshelf layout to prevent re-sorting on every frame. */
  _bookLayoutCache: {
    hash: null,
    layout: null
  },
  /** @private @type {Array<Object>} Caches the screen positions and dimensions of shelf titles for click detection. */
  _shelfTitleLayoutCache: [],
  /** @private @type {Array<Object>} Caches the screen positions and dimensions of shelf planks for click detection. */
  _shelfLayoutCache: [],
  // Note: Drag state (draggedNode, dropTarget) is now passed directly into the draw function
  // via a `dragState` object, so it doesn't need to be a persistent property on the renderer itself.

  /**
   * Initializes the CanvasRenderer with the canvas element and necessary utility functions.
   * @param {HTMLCanvasElement} canvasElement - The main canvas DOM element.
   * @param {Function} getWordCountFn - A function that takes a string and returns its word count.
   * @param {Function} getTotalWordCountFn - A function that recursively counts words in a node.
   */
  init: function(canvasElement, getWordCountFn, getTotalWordCountFn) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.getWordCountFunction = getWordCountFn; 
    this.getTotalWordCountFunction = getTotalWordCountFn;
  },

  /**
   * Calculates the layout for the bookshelf view, arranging nodes as books.
   * @private
   * @param {Array<Object>} nodes - The root nodes to lay out.
   * @returns {Array<Object>} A new array of nodes with calculated drawing properties.
   */
  calculateBookLayout: function(nodes, dragState = {}) {
      // Create a hash of node IDs, titles, and drag state to detect changes.
      const dragStateIdentifier = dragState.draggedNode ? `drag:${dragState.draggedNode.id}` : '';
      const dropTargetIdentifier = dragState.dropTarget ? `drop:${dragState.dropTarget.index}` : '';
      const nodeIdentifiers = nodes.map(n => n.id + n.title).join(',') + dragStateIdentifier + dropTargetIdentifier;

      // If the nodes haven't changed, return the cached layout.
      if (this._bookLayoutCache.hash === nodeIdentifiers) {
          return this._bookLayoutCache.layout;
      }

      // Exclude the currently dragged node from the layout calculation
      const nodesToLayout = nodes.filter(n => {
          return !dragState.draggedNode || n.id !== dragState.draggedNode.id;
      });

      const bookWidth = BookshelfConstants.BOOK_WIDTH;
      const bookSpacing = BookshelfConstants.BOOK_SPACING;
      
      // Sort nodes alphabetically by title to ensure a consistent order on the shelf
      const sortedNodes = [...nodesToLayout].sort((a, b) => a.title.localeCompare(b.title));

      // Inject a placeholder into the layout if we are dragging a book over the shelf
      if (dragState.dropTarget) {
          const placeholder = {
              isPlaceholder: true,
              width: BookshelfConstants.BOOK_WIDTH,
              height: NodeConstants.NODE_HEIGHT
          };
          // The dropTarget.index is calculated relative to the sorted list of books
          sortedNodes.splice(dragState.dropTarget.index, 0, placeholder);
      }

      const totalWidth = (sortedNodes.length * bookWidth) + ((sortedNodes.length - 1) * bookSpacing);
      let currentX = -totalWidth / 2; // Start from the left to center the shelf horizontally

      // The Y position should be consistent for all books to sit on the shelf
      const bookY = BookshelfConstants.BOOKSHELF_Y_POSITION - NodeConstants.NODE_HEIGHT;

      const newLayout = sortedNodes.map(node => {
          // Return a new object with calculated positions, preserving original data
          const bookNode = { ...node, x: currentX, y: bookY, width: bookWidth, height: NodeConstants.NODE_HEIGHT, rotation: 0 };

          // Only apply rotation to actual books, not the placeholder
          if (!node.isPlaceholder) {
              // Generate a consistent, small random rotation based on the node's ID for a more natural look
              const idHash = node.id.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
              const maxRotationRadians = (BookshelfConstants.BOOK_ROTATION_MAX_DEGREES * Math.PI) / 180;
              bookNode.rotation = (idHash % 100 / 100 - 0.5) * 2 * maxRotationRadians; // from -max to +max
          }
          currentX += bookWidth + bookSpacing;
          return bookNode;
      });

      this._bookLayoutCache = { hash: nodeIdentifiers, layout: newLayout };
      return newLayout;
  },

  /**
   * Calculates the layout for the multi-shelf bookshelf view.
   * This function is aware of the drag-and-drop state to inject placeholders.
   * @private
   * @param {Array<Object>} nodes - The root nodes (books and loose leafs).
   * @param {Object} dragState - The current state of the drag operation.
   * @returns {Array<Object>} A new array of nodes with calculated drawing properties.
   */
  calculateMultiShelfLayout: function(nodes, dragState = {}) {
      // Create a hash of node IDs, shelf data, and drag state to detect changes.
      const dragStateIdentifier = dragState.draggedNode ? `drag:${dragState.draggedNode.id}` : '';
      const dropTargetIdentifier = dragState.dropTarget ? `drop:${dragState.dropTarget.shelf},${dragState.dropTarget.index}` : '';
      const nodeIdentifiers = nodes.map(n => `${n.id}:${n.shelf || 0}:${n.shelfPosition || 0}`).join(',') + dragStateIdentifier + dropTargetIdentifier;

      if (this._bookLayoutCache.hash === nodeIdentifiers) {
          return this._bookLayoutCache.layout;
      }

      // Exclude the currently dragged node from the main layout calculation
      const nodesToLayout = nodes.filter(n => {
          return !dragState.draggedNode || n.id !== dragState.draggedNode.id;
      });

      const bookWidth = BookshelfConstants.BOOK_WIDTH;
      const bookSpacing = BookshelfConstants.BOOK_SPACING;

      // Group nodes by their shelf index
      const groupedNodes = {};

      nodesToLayout.forEach(node => {
          const shelfIndex = node.shelf || 0;
          if (!groupedNodes[shelfIndex]) {
              groupedNodes[shelfIndex] = [];
          }
          groupedNodes[shelfIndex].push(node);
      });

      // If dragging, inject a placeholder into the target shelf's array
      if (dragState.dropTarget) {
          const targetShelfIndex = dragState.dropTarget.shelf;
          if (!groupedNodes[targetShelfIndex]) {
              groupedNodes[targetShelfIndex] = [];
          }
          const placeholder = {
              isPlaceholder: true,
              width: BookshelfConstants.BOOK_WIDTH,
              height: NodeConstants.NODE_HEIGHT
          };
          groupedNodes[targetShelfIndex].splice(dragState.dropTarget.index, 0, placeholder);
      }
      const finalLayout = [];

      // Calculate layout for each shelf
      for (const shelfIndex in groupedNodes) {
          const shelfNodes = groupedNodes[shelfIndex];

          // Sort nodes on each shelf by their specified position
          shelfNodes.sort((a, b) => (a.shelfPosition || 0) - (b.shelfPosition || 0));

          const totalWidth = (shelfNodes.length * bookWidth) + (Math.max(0, shelfNodes.length - 1) * bookSpacing);
          let currentX = -totalWidth / 2;

          const shelfY = BookshelfConstants.BOOKSHELF_Y_POSITION + (parseInt(shelfIndex, 10) * BookshelfConstants.SHELF_SPACING_VERTICAL);
          const bookY = shelfY - NodeConstants.NODE_HEIGHT;

          shelfNodes.forEach(node => {
              const idHash = node.id ? node.id.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
              const maxRotationRadians = (BookshelfConstants.BOOK_ROTATION_MAX_DEGREES * Math.PI) / 180;
              const rotation = (idHash % 100 / 100 - 0.5) * 2 * maxRotationRadians;

              const layoutNode = {
                  ...node,
                  x: currentX,
                  y: bookY,
                  width: bookWidth,
                  height: NodeConstants.NODE_HEIGHT,
                  rotation: node.isPlaceholder ? 0 : rotation,
                  shelf: parseInt(shelfIndex, 10) // Ensure shelf number is stored
              };
              currentX += bookWidth + bookSpacing;
              finalLayout.push(layoutNode);
          });
      }

      this._bookLayoutCache = { hash: nodeIdentifiers, layout: finalLayout };
      return finalLayout;
  },

  /**
   * Draws a semi-transparent "ghost" of the node being dragged.
   * @private
   * @param {Object} node - The node object being dragged.
   */
  _drawBookGhost: function(node) {
      this.ctx.save();
      this.ctx.globalAlpha = 0.6; // Make it semi-transparent
      // Draw the ghost with 0 rotation for stability while dragging
      const ghostNode = { ...node, rotation: 0 };

      // A dragged item can be a book (container) or a loose leaf (text)
      if (node.type === 'container') {
          this._drawBookSpine(ghostNode);
      } else {
          this._drawLooseLeaf(ghostNode);
      }
      this.ctx.restore();
  },

  /**
   * Draws a dashed placeholder to indicate a potential drop location on the shelf.
   * @private
   * @param {Object} placeholderNode - The placeholder object from the calculated layout.
   */
  _drawDropPlaceholder: function(placeholderNode) {
      if (!placeholderNode) return;

      this.ctx.save();
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      this.ctx.lineWidth = 2 / this.scale;
      this.ctx.setLineDash([5 / this.scale, 5 / this.scale]);

      this.ctx.beginPath();
      // Use the x, y, width, height from the placeholder object itself
      this.ctx.roundRect(placeholderNode.x, placeholderNode.y, placeholderNode.width, placeholderNode.height, 5);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.restore();
  },

  /**
   * Draws the title for a shelf to the left of the bookends.
   * @private
   * @param {Object} shelfInfo - The shelf object, e.g., { index: 0, name: "Shelf 1" }.
   * @param {number} shelfY - The y-coordinate of the top of the shelf plank.
   * @param {Array<Object>} itemsOnShelf - The layout nodes on the shelf, used for positioning.
   */
  _drawShelfTitle: function(shelfInfo, shelfY, itemsOnShelf) {
      // --- Position Calculation ---
      let leftEdgeX;
      if (itemsOnShelf.length > 0) {
          const minX = itemsOnShelf.reduce((min, node) => Math.min(min, node.x), Infinity);
          leftEdgeX = minX - BookshelfConstants.SHELF_PADDING - BookshelfConstants.BOOKEND_WIDTH;
      } else {
          // If shelf is empty, calculate a default position based on a minimal shelf width.
          const minShelfWidth = 2 * (BookshelfConstants.SHELF_PADDING + BookshelfConstants.BOOKEND_WIDTH);
          leftEdgeX = -minShelfWidth / 2;
      }

      const titleX = leftEdgeX - BookshelfConstants.SHELF_TITLE_X_OFFSET;
      const titleY = (shelfY - (NodeConstants.NODE_HEIGHT / 2)) + BookshelfConstants.SHELF_TITLE_Y_OFFSET;

      this.ctx.save();
      this.ctx.font = BookshelfConstants.SHELF_TITLE_FONT;
      this.ctx.fillStyle = BookshelfConstants.SHELF_TITLE_COLOR;
      this.ctx.textAlign = 'right';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(shelfInfo.name, titleX, titleY);

      // --- Cache the title's bounding box for click detection ---
      // This must be done *before* restoring the context so the font is correct for measureText.
      const metrics = this.ctx.measureText(shelfInfo.name);
      const titleWidth = metrics.width;
      // Using fontBoundingBoxAscent/Descent is more accurate than parsing the font string.
      const ascent = metrics.fontBoundingBoxAscent || parseInt(this.ctx.font, 10);
      const descent = metrics.fontBoundingBoxDescent || 0;
      const fontHeight = ascent + descent;

      const titleRect = {
          shelfInfo: shelfInfo,
          x: titleX - titleWidth, // because textAlign is 'right'
          y: titleY - ascent, // Align top of bounding box with text ascent
          width: titleWidth,
          height: fontHeight
      };
      this._shelfTitleLayoutCache.push(titleRect);
      this.ctx.restore();
  },
  /**
   * Draws a single node as a polished, antique-style book spine.
   * @private
   * @param {Object} node - The node object to draw, with layout properties.
   */
  _drawBookSpine: function(node) {
      const isTextNode = node.type === 'text';
      const baseColor = isTextNode ? BookshelfConstants.BOOK_BASE_COLOR_TEXT : BookshelfConstants.BOOK_BASE_COLOR_CONTAINER;
      const lightColor = isTextNode ? BookshelfConstants.BOOK_LIGHT_COLOR_TEXT : BookshelfConstants.BOOK_LIGHT_COLOR_CONTAINER;
      const bandHighlight = BookshelfConstants.BOOK_BAND_HIGHLIGHT;
      const bandShadow = BookshelfConstants.BOOK_BAND_SHADOW;

      this.ctx.save();
      this.ctx.translate(node.x + node.width / 2, node.y + node.height); // Rotate from the bottom center
      this.ctx.rotate(node.rotation);
      this.ctx.translate(-(node.x + node.width / 2), -(node.y + node.height));

      // Create a subtle gradient to give the spine a rounded look
      const spineGradient = this.ctx.createLinearGradient(node.x, node.y, node.x + node.width, node.y);
      spineGradient.addColorStop(0, baseColor);
      spineGradient.addColorStop(0.5, lightColor);
      spineGradient.addColorStop(1, baseColor);

      this.ctx.fillStyle = spineGradient;
      this.ctx.fillRect(node.x, node.y, node.width, node.height);

      // Add decorative bands at the top and bottom with a 3D effect
      const bandHeight = 4 / this.scale;
      const bandY1 = node.y + 10 / this.scale;
      const bandY2 = node.y + node.height - (10 + bandHeight * 2) / this.scale;
      this.ctx.fillStyle = bandHighlight;
      this.ctx.fillRect(node.x, bandY1, node.width, bandHeight);
      this.ctx.fillRect(node.x, bandY2, node.width, bandHeight);
      this.ctx.fillStyle = bandShadow;
      this.ctx.fillRect(node.x, bandY1 + bandHeight, node.width, bandHeight / 2);
      this.ctx.fillRect(node.x, bandY2 + bandHeight, node.width, bandHeight / 2);

      // Draw outline
      this.ctx.strokeStyle = BookshelfConstants.BOOK_OUTLINE_COLOR;
      this.ctx.lineWidth = 1 / this.scale;
      this.ctx.strokeRect(node.x, node.y, node.width, node.height);

      // Draw title vertically
      this.ctx.save();
      this.ctx.translate(node.x + node.width / 2, node.y + node.height / 2);
      this.ctx.rotate(-Math.PI / 2); // Rotate -90 degrees
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = BookshelfConstants.BOOK_TITLE_COLOR;
      this.ctx.font = `bold ${16 / this.scale}px 'Vollkorn', serif`; // Font size is dynamic
      this.ctx.shadowColor = BookshelfConstants.BOOK_TITLE_SHADOW;
      this.ctx.shadowBlur = 4 / this.scale;

      // Truncate text if it's too long for the book height
      const maxTextWidth = node.height - 30; // Leave more padding for bands
      let title = node.title;
      if (this.ctx.measureText(title).width > maxTextWidth) {
          while (this.ctx.measureText(title + '...').width > maxTextWidth && title.length > 0) {
              title = title.slice(0, -1);
          }
          title += '...';
      }
      this.ctx.fillText(title, 0, 0);
      this.ctx.restore();

      // Draw total word count at the bottom of the spine
      if (this.getTotalWordCountFunction) {
          const totalWordCount = this.getTotalWordCountFunction(node);
          if (totalWordCount > 0) {
              this.ctx.save();
              this.ctx.fillStyle = BookshelfConstants.BOOK_WORD_COUNT_COLOR;
              this.ctx.font = `italic ${10 / this.scale}px 'Vollkorn', serif`; // Font size is dynamic
              this.ctx.textAlign = 'center';
              this.ctx.fillText(`${totalWordCount}`, node.x + node.width / 2, node.y + node.height - (15 / this.scale));
              this.ctx.restore();
          }
      }

      this.ctx.restore(); // Restore from the rotation save
  },

  /**
   * Draws a single text node as a piece of paper or loose leaf.
   * @private
   * @param {Object} node - The text node object to draw.
   */
  _drawLooseLeaf: function(node) {
      this.ctx.save();

      // Main paper body
      this.ctx.fillStyle = BookshelfConstants.LOOSE_LEAF_BG_COLOR;
      this.ctx.strokeStyle = BookshelfConstants.LOOSE_LEAF_BORDER_COLOR;
      this.ctx.lineWidth = 1 / this.scale;
      this.ctx.shadowColor = BookshelfConstants.LOOSE_LEAF_SHADOW_COLOR;
      this.ctx.shadowBlur = 15;
      this.ctx.shadowOffsetY = 5;

      this.ctx.beginPath();
      this.ctx.roundRect(node.x, node.y, node.width, node.height, 10);
      this.ctx.fill();
      this.ctx.stroke();

      // Reset shadow for text
      this.ctx.shadowColor = 'transparent';

      // Draw title
      this.ctx.fillStyle = UIConstants.DEFAULT_TEXT_COLOR;
      this.ctx.font = `bold ${18 / this.scale}px 'Vollkorn', serif`; // Font size is dynamic
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(node.title, node.x + node.width / 2, node.y + 20 / this.scale);

      this.ctx.restore();
  },
  /**
   * Draws a stylized, carved lion head bookend.
   * @private
   * @param {number} x - The x-coordinate for the bookend's base.
   * @param {number} y - The y-coordinate for the bookend's base.
   * @param {number} width - The width of the bookend.
   * @param {number} height - The height of the bookend.
   * @param {boolean} isFlipped - If true, draws a mirrored version for the right side.
   */
  _drawLionBookend: function(x, y, width, height, isFlipped) {
      this.ctx.save();

      // Base of the bookend
      this.ctx.fillStyle = BookshelfConstants.BOOKEND_COLOR;
      this.ctx.fillRect(x, y - height, width, height);

      // Lion Head Carving
      const headX = isFlipped ? x : x + width; // Position head on the inside edge
      const headY = y - height * 0.7;
      const headWidth = width * 1.5;
      const headHeight = height * 0.5;

      // Create a gradient to give a 3D carved look
      const gradient = this.ctx.createLinearGradient(headX, headY, headX + (isFlipped ? -headWidth : headWidth), headY);
      gradient.addColorStop(0, BookshelfConstants.LION_SHADOW_COLOR);
      gradient.addColorStop(0.3, BookshelfConstants.LION_BASE_COLOR);
      gradient.addColorStop(0.7, BookshelfConstants.LION_HIGHLIGHT_COLOR);
      gradient.addColorStop(1, BookshelfConstants.LION_SHADOW_COLOR);
      
      this.ctx.fillStyle = gradient;

      // Draw a stylized mane and face shape
      this.ctx.beginPath();
      this.ctx.moveTo(headX, headY);
      this.ctx.quadraticCurveTo(headX + (isFlipped ? -headWidth * 0.8 : headWidth * 0.8), headY + headHeight * 0.2, headX + (isFlipped ? -headWidth * 0.5 : headWidth * 0.5), headY + headHeight);
      this.ctx.quadraticCurveTo(headX + (isFlipped ? -headWidth * 0.2 : headWidth * 0.2), headY + headHeight * 0.8, headX, headY + headHeight);
      this.ctx.closePath();
      this.ctx.fill();

      this.ctx.restore();
  },
  /**
   * Draws a single decorative shelf and its bookends.
   * @private
   * @param {Array<Object>} shelfNodes - The laid-out nodes on a single shelf, used to determine shelf size.
   */
  _drawSingleShelfAndBookends: function(shelfNodes, shelfInfo) {
        if (!shelfNodes || shelfNodes.length === 0) return;

        // Find the horizontal bounds of the books
        let minX = Infinity;
        let maxX = -Infinity;
        shelfNodes.forEach(node => {
            minX = Math.min(minX, node.x);
            maxX = Math.max(maxX, node.x + node.width);
        });

        const shelfWidth = (maxX - minX) + (2 * BookshelfConstants.SHELF_PADDING);
        const shelfHeight = BookshelfConstants.SHELF_HEIGHT;
        const shelfY = shelfNodes[0].y + shelfNodes[0].height; // All books on a shelf have the same bottom edge
        const shelfX = minX - BookshelfConstants.SHELF_PADDING;

        this.ctx.save();
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        this.ctx.shadowBlur = 20;
        this.ctx.shadowOffsetY = 8;

        // Create a wood gradient for the shelf for a more antique look
        const woodGradient = this.ctx.createLinearGradient(shelfX, shelfY, shelfX, shelfY + shelfHeight);
        woodGradient.addColorStop(0, BookshelfConstants.SHELF_COLOR_TOP);
        woodGradient.addColorStop(1, BookshelfConstants.SHELF_COLOR_BOTTOM);

        this.ctx.fillStyle = woodGradient;
        this.ctx.fillRect(shelfX - 5, shelfY, shelfWidth + 10, shelfHeight);
        this.ctx.fillStyle = BookshelfConstants.SHELF_EDGE_COLOR;
        this.ctx.fillRect(shelfX - 5, shelfY + shelfHeight, shelfWidth + 10, BookshelfConstants.SHELF_BOTTOM_EDGE_HEIGHT);

        this.ctx.restore(); // Restore from shadow save before drawing bookends

        // --- Cache the shelf's bounding box for click detection ---
        if (shelfInfo) {
            const shelfRect = {
                shelfInfo: shelfInfo,
                x: shelfX,
                y: shelfY,
                width: shelfWidth,
                height: shelfHeight + BookshelfConstants.SHELF_BOTTOM_EDGE_HEIGHT
            };
            this._shelfLayoutCache.push(shelfRect);
        }

        // Draw bookends with new lion head design
        const bookendWidth = BookshelfConstants.BOOKEND_WIDTH;
        const bookendHeight = NodeConstants.NODE_HEIGHT + 20;
        const leftBookendX = shelfX - bookendWidth;
        const rightBookendX = shelfX + shelfWidth;
        const bookendY = shelfY + shelfHeight; // The base of the bookend sits on the bottom edge of the shelf

        this._drawLionBookend(leftBookendX, bookendY, bookendWidth, bookendHeight, false);
        this._drawLionBookend(rightBookendX, bookendY, bookendWidth, bookendHeight, true);
  },

  /**
   * Determines the fill and text alpha based on the node's level.
   * @private
   */
  _getDrawingAlphas: function(isCurrentLevel, isAncestor) {
    if (isCurrentLevel) {
      return { fill: UIConstants.CURRENT_LEVEL_FILL_ALPHA, text: UIConstants.CURRENT_LEVEL_TEXT_ALPHA };
    }
    if (isAncestor) {
      return { fill: UIConstants.ANCESTOR_FILL_ALPHA, text: UIConstants.ANCESTOR_TEXT_ALPHA };
    }
    return { fill: UIConstants.OTHER_LEVEL_FILL_ALPHA, text: UIConstants.OTHER_LEVEL_TEXT_ALPHA };
  },

  /**
   * Draws the title and word count for a standard node.
   * @private
   */
  _drawNodeText: function(node) {
    this.ctx.fillStyle = UIConstants.DEFAULT_TEXT_COLOR;
    this.ctx.font = UIConstants.DEFAULT_FONT_BOLD;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(node.title, node.x + node.width / 2, node.y + node.height / 2);

    if (node.type === 'text' && this.getWordCountFunction) {
      const wordCount = this.getWordCountFunction(node.content);
      this.ctx.font = UIConstants.WORD_COUNT_FONT;
      this.ctx.fillStyle = UIConstants.WORD_COUNT_COLOR;
      this.ctx.textAlign = 'right';
      this.ctx.textBaseline = 'bottom';
      this.ctx.fillText(`${wordCount} words`, node.x + node.width - 10, node.y + node.height - 10);
    }
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
    const nodeColor = node.type === 'text' ? NodeConstants.NODE_TEXT_COLOR : NodeConstants.NODE_DEFAULT_COLOR;
    const alphas = this._getDrawingAlphas(isCurrentLevel, isAncestor);
    
    this.ctx.globalAlpha = alphas.fill;
    this.ctx.fillStyle = nodeColor;
    this.ctx.beginPath();
    this.ctx.roundRect(node.x, node.y, node.width, node.height, 15);
    this.ctx.fill();

    this.ctx.strokeStyle = isCurrentLevel && node.selected ? NodeConstants.NODE_SELECTED_STROKE_COLOR : NodeConstants.NODE_DEFAULT_STROKE_COLOR;
    this.ctx.lineWidth = isCurrentLevel && node.selected ? (4 / scale) : (1 / scale);
    this.ctx.stroke();

    if (!node.isEditing) {
      this.ctx.globalAlpha = alphas.text;
      this._drawNodeText(node);
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
   *                                         (Note: This parameter is no longer used as selection state is on the node object itself)
   */
  draw: function(nodes, viewStack, currentNodes, scale, offsetX, offsetY, dragState = {}, allShelvesData = []) {

    if (!this.canvas || !this.ctx) return;
    this._shelfTitleLayoutCache = []; // Clear cache at the start of every draw
    this._shelfLayoutCache = []; // Clear shelf cache too

    // Mirror the renderer's transform state so helper functions can access it
    this.scale = scale;
    this.offsetX = offsetX;
    this.offsetY = offsetY;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();

    // Apply standard pan and zoom from the center of the canvas
    this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.scale(scale, scale);
    this.ctx.translate(-this.offsetX, -this.offsetY); // Pan the world

    const isRootView = viewStack.length === 0;

    if (isRootView) {
        // Use the new multi-shelf layout function for all nodes in the root view.
        const layoutNodes = this.calculateMultiShelfLayout(currentNodes, dragState);

        // Group the layout nodes by shelf to draw each shelf individually.
        const shelves = {};
        layoutNodes.forEach(node => {
            const shelfIndex = node.shelf || 0;
            if (!shelves[shelfIndex]) {
                shelves[shelfIndex] = [];
            }
            shelves[shelfIndex].push(node);
        });

        // Draw each shelf, its bookends, and its title.
        for (const shelfIndex in shelves) {
            const shelfInfo = allShelvesData.find(s => s.index == shelfIndex);
            const itemsOnShelf = shelves[shelfIndex].filter(n => !n.isPlaceholder);

            // We only want to calculate shelf dimensions based on actual items, not placeholders.
            if (itemsOnShelf.length > 0) {
                this._drawSingleShelfAndBookends(itemsOnShelf, shelfInfo);
            }

            // Draw the title if a name exists for this shelf index.
            if (shelfInfo) {
                const shelfY = BookshelfConstants.BOOKSHELF_Y_POSITION + (parseInt(shelfIndex, 10) * BookshelfConstants.SHELF_SPACING_VERTICAL);
                this._drawShelfTitle(shelfInfo, shelfY, itemsOnShelf);
            }
        }

        // Now draw all the items (books, loose leafs, placeholders) on top of the shelves.
        layoutNodes.forEach(node => {
            if (node.isPlaceholder) {
                this._drawDropPlaceholder(node);
            } else if (node.type === 'container') {
                this._drawBookSpine(node);
            } else if (node.type === 'text') {
                // Skip drawing the original if it's being dragged
                if (dragState.draggedNode && node.id === dragState.draggedNode.id) {
                    return;
                }
                this._drawLooseLeaf(node);
            } else {
                // This handles book spines, skipping the dragged one via the layout function
                if (!(dragState.draggedNode && node.id === dragState.draggedNode.id)) {
                    this._drawBookSpine(node);
                }
            }
        });

        // Draw the dragged node "ghost" on top of everything else
        if (dragState.draggedNode) {
            this._drawBookGhost(dragState.draggedNode);
        }
    } else {
        const allLevels = [nodes, ...viewStack.map(n => n.children)];
        const ancestorSet = new Set(viewStack); // For efficient ancestor lookup

        // --- PERFORMANCE OPTIMIZATION: Viewport Culling ---
        // Calculate the visible area in world coordinates to avoid drawing off-screen nodes.
        const viewLeft = this.offsetX - (this.canvas.width / 2) / this.scale;
        const viewRight = this.offsetX + (this.canvas.width / 2) / this.scale;
        const viewTop = this.offsetY - (this.canvas.height / 2) / this.scale;
        const viewBottom = this.offsetY + (this.canvas.height / 2) / this.scale;

        allLevels.forEach((levelNodes) => {
          const isCurrentLevel = levelNodes === currentNodes;
          levelNodes.forEach(node => {
                // AABB (Axis-Aligned Bounding Box) check to see if the node is in the viewport.
                if (node.x + node.width < viewLeft || node.x > viewRight ||
                    node.y + node.height < viewTop || node.y > viewBottom) {
                    // Node is off-screen, skip drawing it.
                    return;
                }

                const isAncestor = ancestorSet.has(node);
                this._drawNode(node, isCurrentLevel, isAncestor, scale);
          });
        });
    }
    this.ctx.restore();
  },

  /**
   * Finds a shelf title at the given world coordinates.
   * @param {number} worldX - The x-coordinate in world space.
   * @param {number} worldY - The y-coordinate in world space.
   * @returns {Object|null} The shelf title layout object if found, otherwise null.
   */
  getShelfTitleAtPosition: function(worldX, worldY) {
      for (const titleLayout of this._shelfTitleLayoutCache) {
          if (worldX >= titleLayout.x && worldX <= titleLayout.x + titleLayout.width &&
              worldY >= titleLayout.y && worldY <= titleLayout.y + titleLayout.height) {
              return titleLayout;
          }
      }
      return null;
  },

  /**
   * Finds a shelf plank at the given world coordinates.
   * @param {number} worldX - The x-coordinate in world space.
   * @param {number} worldY - The y-coordinate in world space.
   * @returns {Object|null} The shelf layout object if found, otherwise null.
   */
  getShelfAtPosition: function(worldX, worldY) {
      for (const shelfLayout of this._shelfLayoutCache) {
          if (worldX >= shelfLayout.x && worldX <= shelfLayout.x + shelfLayout.width &&
              worldY >= shelfLayout.y && worldY <= shelfLayout.y + shelfLayout.height) {
              return shelfLayout;
          }
      }
      return null;
  },

  /**
   * Finds a cached shelf title layout by its shelf index.
   * @param {number} shelfIndex - The index of the shelf.
   * @returns {Object|null} The shelf title layout object if found, otherwise null.
   */
  getShelfTitleLayoutByIndex: function(shelfIndex) {
      return this._shelfTitleLayoutCache.find(layout => layout.shelfInfo.index === shelfIndex);
  }
};
