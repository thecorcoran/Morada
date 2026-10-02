// canvasRenderer.js
// This module handles all drawing operations for the Scholar's Desk canvas.
// Implements Tufte-style minimalist typography, desk grid guides, and tag trellis lines.
console.log("canvasRenderer.js loaded (Scholar's Desk edition)");

window.MyProjectCanvasRenderer = {
  /** @type {HTMLCanvasElement|null} The main canvas element. */
  canvas: null,
  /** @type {CanvasRenderingContext2D|null} The 2D rendering context of the canvas. */
  ctx: null,
  /** @type {Function|null} Function reference to get word count from UIManager. */
  getWordCountFunction: null,
  /** @type {Object|null} Node currently under the mouse cursor. */
  hoveredNode: null,

  init: function(canvasElement, getWordCountFn) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.getWordCountFunction = getWordCountFn;
  },

  setHoveredNode: function(node) {
    this.hoveredNode = node;
  },

  /**
   * Draws subtle Jeffersonian desk grid dots for spatial orientation without visual noise.
   */
  _drawDeskGrid: function(scale, offsetX, offsetY) {
    const spacing = 40; // World pixels between alignment dots
    const startX = offsetX - (this.canvas.width / 2) / scale;
    const endX = offsetX + (this.canvas.width / 2) / scale;
    const startY = offsetY - (this.canvas.height / 2) / scale;
    const endY = offsetY + (this.canvas.height / 2) / scale;

    const firstGridX = Math.floor(startX / spacing) * spacing;
    const firstGridY = Math.floor(startY / spacing) * spacing;

    this.ctx.save();
    this.ctx.fillStyle = AppConstants.DESK_GRID_DOT_COLOR || 'rgba(189, 174, 147, 0.4)';
    const dotRadius = Math.max(1, 1.2 / scale);

    for (let gx = firstGridX; gx <= endX; gx += spacing) {
      for (let gy = firstGridY; gy <= endY; gy += spacing) {
        // Every 200px make a slightly more noticeable intersection
        const isMajor = (gx % 200 === 0 && gy % 200 === 0);
        this.ctx.beginPath();
        this.ctx.arc(gx, gy, isMajor ? dotRadius * 1.6 : dotRadius, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    this.ctx.restore();
  },

  /**
   * Draws Tufte Trellis Lines: subtle vector curves connecting the selected node
   * to any other visible nodes sharing active tags.
   */
  _drawTrellisLines: function(selectedNode, currentNodes, scale) {
    if (!selectedNode || !Array.isArray(selectedNode.tags) || selectedNode.tags.length === 0) return;
    if (!Array.isArray(currentNodes)) return;

    const sourceX = selectedNode.x + selectedNode.width / 2;
    const sourceY = selectedNode.y + selectedNode.height / 2;

    this.ctx.save();
    currentNodes.forEach(target => {
      if (target === selectedNode || !Array.isArray(target.tags)) return;
      const sharedTags = selectedNode.tags.filter(t => target.tags.includes(t));
      if (sharedTags.length === 0) return;

      const targetX = target.x + target.width / 2;
      const targetY = target.y + target.height / 2;

      // Draw subtle curved connector line
      this.ctx.beginPath();
      this.ctx.strokeStyle = 'rgba(7, 102, 120, 0.35)'; // scholarly teal/slate
      this.ctx.lineWidth = 1.5 / scale;
      this.ctx.setLineDash([4 / scale, 4 / scale]);

      const midX = (sourceX + targetX) / 2;
      const midY = (sourceY + targetY) / 2 - 20;

      this.ctx.quadraticCurveTo(midX, midY, targetX, targetY);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      // Draw tag label badge at midpoint
      const labelText = '#' + sharedTags[0];
      this.ctx.font = `${Math.max(10, 11 / scale)}px 'Vollkorn', serif`;
      this.ctx.fillStyle = 'rgba(7, 102, 120, 0.75)';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(labelText, midX, midY - 6);
    });
    this.ctx.restore();
  },

  /**
   * Draws a single node following the Tufte Scholar's Desk design:
   * text-first elegance, clean paper cards, borders on hover/selection only.
   */
  _drawNode: function(node, isCurrentLevel, isAncestor, scale) {
    const isSelected = !!node.selected;
    const isHovered = (this.hoveredNode && this.hoveredNode.id === node.id);
    const isSheet = (node.type === 'text');
    const borderRadius = AppConstants.NODE_BORDER_RADIUS || 6;

    let fillAlpha = isCurrentLevel ? AppConstants.CURRENT_LEVEL_FILL_ALPHA : (isAncestor ? AppConstants.ANCESTOR_FILL_ALPHA : AppConstants.OTHER_LEVEL_FILL_ALPHA);
    let textAlpha = isCurrentLevel ? AppConstants.CURRENT_LEVEL_TEXT_ALPHA : (isAncestor ? AppConstants.ANCESTOR_TEXT_ALPHA : AppConstants.OTHER_LEVEL_TEXT_ALPHA);

    this.ctx.save();
    this.ctx.globalAlpha = fillAlpha;

    // Card background
    const bgColor = isSheet ? (AppConstants.NODE_SHEET_COLOR || '#ffffff') : (AppConstants.NODE_PORTFOLIO_COLOR || '#f4ece1');
    this.ctx.fillStyle = bgColor;

    // Very subtle natural paper dropshadow when current level
    if (isCurrentLevel) {
      this.ctx.shadowColor = isSelected ? 'rgba(7, 102, 120, 0.25)' : (isHovered ? 'rgba(60, 56, 54, 0.18)' : 'rgba(60, 56, 54, 0.08)');
      this.ctx.shadowBlur = isSelected ? 12 / scale : (isHovered ? 8 / scale : 4 / scale);
      this.ctx.shadowOffsetY = (isSelected || isHovered) ? 3 / scale : 1 / scale;
    }

    this.ctx.beginPath();
    this.ctx.roundRect(node.x, node.y, node.width, node.height, borderRadius);
    this.ctx.fill();

    // Reset shadow for crisp inner elements
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;

    // Left binding spine indicator for Manuscript Sheets
    if (isSheet) {
      const spineColor = isSelected ? '#076678' : (isHovered ? '#a89984' : '#d5c4a1');
      this.ctx.fillStyle = spineColor;
      this.ctx.beginPath();
      this.ctx.roundRect(node.x, node.y, 4, node.height, [borderRadius, 0, 0, borderRadius]);
      this.ctx.fill();
    } else {
      // Top tab indicator for Portfolios (Folders)
      const tabColor = isSelected ? '#076678' : (isHovered ? '#bdae93' : '#d5c4a1');
      this.ctx.fillStyle = tabColor;
      this.ctx.beginPath();
      this.ctx.roundRect(node.x + 12, node.y, Math.min(80, node.width - 24), 4, [2, 2, 0, 0]);
      this.ctx.fill();
    }

    // Border: Revealed on hover or selection (Tufte minimalist pass)
    let strokeColor = null;
    let strokeWidth = 1 / scale;

    if (isSelected) {
      strokeColor = AppConstants.NODE_SELECTED_STROKE_COLOR || '#076678';
      strokeWidth = 2.5 / scale;
    } else if (isHovered) {
      strokeColor = AppConstants.NODE_HOVER_STROKE_COLOR || '#a89984';
      strokeWidth = 1.5 / scale;
    } else {
      // Subtle baseline outline for clear legibility on the desk
      strokeColor = 'rgba(189, 174, 147, 0.45)';
      strokeWidth = 1 / scale;
    }

    if (strokeColor) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = strokeWidth;
      this.ctx.beginPath();
      this.ctx.roundRect(node.x, node.y, node.width, node.height, borderRadius);
      this.ctx.stroke();
    }

    // Content & Typography
    if (!node.isEditing) {
      this.ctx.globalAlpha = textAlpha;

      // Header icon / badge
      const badgeY = node.y + 18;
      this.ctx.font = "11px 'Vollkorn', serif";
      this.ctx.fillStyle = isSelected ? '#076678' : '#7c6f64';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';

      if (!isSheet) {
        const childCount = Array.isArray(node.children) ? node.children.length : 0;
        const countText = childCount === 1 ? '1 sheet' : `${childCount} sheets`;
        this.ctx.fillText(`📁 Portfolio · ${countText}`, node.x + 14, badgeY);
      } else {
        this.ctx.fillText(`📄 Sheet`, node.x + 14, badgeY);
      }

      // Title
      this.ctx.fillStyle = isSelected ? '#1d2021' : AppConstants.DEFAULT_TEXT_COLOR;
      this.ctx.font = isSelected ? "bold 16px 'Vollkorn', serif" : AppConstants.DEFAULT_FONT_BOLD;
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';

      // Clip title text if longer than card width
      const maxTitleWidth = node.width - 28;
      let displayTitle = node.title || 'Untitled';
      if (this.ctx.measureText(displayTitle).width > maxTitleWidth) {
        while (displayTitle.length > 3 && this.ctx.measureText(displayTitle + '...').width > maxTitleWidth) {
          displayTitle = displayTitle.slice(0, -1);
        }
        displayTitle += '...';
      }
      this.ctx.fillText(displayTitle, node.x + 14, node.y + node.height / 2 - 4);

      // Metadata footer
      if (isSheet && this.getWordCountFunction) {
        const wordCount = this.getWordCountFunction(node.content || '');

        // Subtle word density progress bar across bottom of sheet
        const densityGoal = (node.wordGoal && node.wordGoal > 0) ? node.wordGoal : 1000;
        const progress = Math.min(1.0, wordCount / densityGoal);
        const barWidth = (node.width - 28) * progress;

        this.ctx.fillStyle = 'rgba(189, 174, 147, 0.25)';
        this.ctx.fillRect(node.x + 14, node.y + node.height - 18, node.width - 28, 2);

        this.ctx.fillStyle = isSelected ? '#076678' : '#79740e';
        this.ctx.fillRect(node.x + 14, node.y + node.height - 18, barWidth, 2);

        // Word count text
        this.ctx.font = AppConstants.WORD_COUNT_FONT || "12px 'Vollkorn', serif";
        this.ctx.fillStyle = AppConstants.WORD_COUNT_COLOR || '#7c6f64';
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText(`${wordCount} words`, node.x + node.width - 14, node.y + node.height - 6);
      }

      // Display primary tag pill if available
      if (Array.isArray(node.tags) && node.tags.length > 0) {
        const firstTag = '#' + node.tags[0];
        this.ctx.font = "11px 'Vollkorn', serif";
        this.ctx.fillStyle = '#7c6f64';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText(firstTag, node.x + 14, node.y + node.height - 6);
      }
    }

    this.ctx.restore();
  },

  /**
   * Main draw routine: clears canvas, draws desk grid, draws trellis lines, and draws all visible nodes.
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

    // 1. Draw subtle Jeffersonian desk grid
    this._drawDeskGrid(scale, offsetX, offsetY);

    // 2. Draw Trellis lines linking semantic tags when a node is selected
    if (selectedNodeGlobal) {
      this._drawTrellisLines(selectedNodeGlobal, currentNodes, scale);
    }

    // 3. Draw all visible nodes
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

  getCanvasWorldPosition: function(mouseX, mouseY, canvasEl, currentScale, currentOffsetX, currentOffsetY) {
    const rect = canvasEl.getBoundingClientRect();
    const canvasMouseX = mouseX - rect.left;
    const canvasMouseY = mouseY - rect.top;

    const worldX = (canvasMouseX - canvasEl.width / 2) / currentScale + canvasEl.width / 2 + currentOffsetX;
    const worldY = (canvasMouseY - canvasEl.height / 2) / currentScale + canvasEl.height / 2 + currentOffsetY;
    return { x: worldX, y: worldY };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.MyProjectCanvasRenderer;
}
