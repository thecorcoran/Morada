// canvasRenderer.js
if (typeof window === 'undefined') {
  global.window = global;
}
// This module handles all drawing operations for the Scholar's Desk canvas.
// Implements Tufte-style minimalist typography, desk grid guides, and tag trellis lines.

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
   * Retrieves active theme color palette tokens.
   * @returns {Object}
   */
  _getThemeTokens: function() {
    if (typeof AppConstants !== 'undefined' && typeof AppConstants.getThemeTokens === 'function') {
      return AppConstants.getThemeTokens();
    }
    return {
      gridDot: 'rgba(180, 150, 120, 0.4)',
      trellisStroke: 'rgba(139, 90, 43, 0.4)',
      trellisLabel: 'rgba(139, 90, 43, 0.9)',
      sheetBg: '#ffffff',
      portfolioBg: '#f5ece1',
      portfolioSpine: '#8b5a2b',
      portfolioTab: '#d4a373',
      sheetSpine: '#8b5a2b',
      selectedStroke: '#b57614',
      hoverStroke: '#8b5a2b',
      baseStroke: 'rgba(189, 174, 147, 0.45)',
      selectedShadow: 'rgba(181, 118, 20, 0.35)',
      hoverShadow: 'rgba(60, 56, 54, 0.18)',
      defaultShadow: 'rgba(60, 56, 54, 0.08)',
      titleColor: '#282421',
      headerColor: '#7c6f64',
      headerSelectedColor: '#8b5a2b',
      excerptColor: '#504945',
      childColor: '#3c3836',
      dividerColor: 'rgba(189, 174, 147, 0.35)',
      progressBg: 'rgba(189, 174, 147, 0.25)',
      progressFill: '#8b5a2b',
      progressSelected: '#b57614',
      tagBg: 'rgba(213, 196, 161, 0.35)',
      tagText: '#665c54'
    };
  },

  /** @type {string|null} Active tag or search filter string for spatial canvas highlighting. */
  activeTagFilter: null,

  setActiveTagFilter: function(filter) {
    this.activeTagFilter = (filter && typeof filter === 'string' && filter.trim().length > 0) ? filter.trim() : null;
  },

  getActiveTagFilter: function() {
    return this.activeTagFilter;
  },

  /**
   * Checks if a node matches the active tag or search filter.
   * @param {Object} node
   * @param {string|null} filter
   * @returns {boolean}
   */
  nodeMatchesFilter: function(node, filter) {
    if (!filter) return true;
    if (!node) return false;
    const cleanFilter = filter.trim().toLowerCase();
    if (!cleanFilter) return true;

    if (cleanFilter.startsWith('#')) {
      const tagTerm = cleanFilter.slice(1).toLowerCase();
      if (!Array.isArray(node.tags) || node.tags.length === 0) return false;
      return node.tags.some(t => {
        const lower = String(t).toLowerCase();
        return lower === tagTerm || lower.includes(tagTerm);
      });
    }

    if (Array.isArray(node.tags) && node.tags.some(t => String(t).toLowerCase().includes(cleanFilter))) {
      return true;
    }
    if (node.title && String(node.title).toLowerCase().includes(cleanFilter)) {
      return true;
    }
    if (node.content && String(node.content).toLowerCase().includes(cleanFilter)) {
      return true;
    }
    return false;
  },

  /**
   * Strips HTML tags and entities to return clean prose excerpt.
   * @param {string} html
   * @returns {string}
   */
  _extractPlainText: function(html) {
    if (!html || typeof html !== 'string') return '';
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  },

  /**
   * Splits and word-wraps text into at most maxLines that fit within maxWidth.
   * @param {string} text
   * @param {number} maxWidth
   * @param {number} maxLines
   * @returns {Array<string>}
   */
  _wrapTextLines: function(text, maxWidth, maxLines) {
    if (!text || !this.ctx || maxWidth <= 0 || maxLines <= 0) return [];
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = '';
    let truncated = false;

    for (let i = 0; i < words.length; i++) {
      let word = words[i];
      if (!word) continue;
      // If a single word is wider than maxWidth, truncate it
      if (this.ctx.measureText(word).width > maxWidth) {
        while (word.length > 3 && this.ctx.measureText(word + '...').width > maxWidth) {
          word = word.slice(0, -1);
        }
        word = word + '...';
      }

      const testLine = currentLine ? currentLine + ' ' + word : word;
      const metrics = this.ctx.measureText(testLine);
      if (metrics.width > maxWidth) {
        if (currentLine) lines.push(currentLine);
        if (lines.length >= maxLines) {
          truncated = true;
          break;
        }
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (lines.length < maxLines && currentLine) {
      lines.push(currentLine);
    } else if (currentLine && lines.length >= maxLines) {
      truncated = true;
    }

    if (lines.length > 0) {
      for (let j = 0; j < lines.length; j++) {
        while (lines[j].length > 3 && this.ctx.measureText(lines[j]).width > maxWidth) {
          lines[j] = lines[j].slice(0, -1);
        }
      }
      if ((truncated || lines.length === maxLines) && words.length > 0) {
        let last = lines[lines.length - 1];
        if (!last.endsWith('...')) {
          while (last.length > 3 && this.ctx.measureText(last + '...').width > maxWidth) {
            last = last.slice(0, -1);
          }
          lines[lines.length - 1] = last.trim() + '...';
        }
      }
    }
    return lines;
  },

  /**
   * Draws subtle Jeffersonian desk grid dots for spatial orientation without visual noise.
   */
  _drawDeskGrid: function(scale, offsetX, offsetY) {
    const spacing = 40; // World pixels between alignment dots
    // draw() centers the view on world point (W/2 + offsetX, H/2 + offsetY)
    const centerX = this.canvas.width / 2 + offsetX;
    const centerY = this.canvas.height / 2 + offsetY;
    const startX = centerX - (this.canvas.width / 2) / scale;
    const endX = centerX + (this.canvas.width / 2) / scale;
    const startY = centerY - (this.canvas.height / 2) / scale;
    const endY = centerY + (this.canvas.height / 2) / scale;

    const firstGridX = Math.floor(startX / spacing) * spacing;
    const firstGridY = Math.floor(startY / spacing) * spacing;

    const theme = this._getThemeTokens();
    this.ctx.save();
    this.ctx.fillStyle = theme.gridDot || 'rgba(189, 174, 147, 0.4)';
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
    const theme = this._getThemeTokens();

    this.ctx.save();
    currentNodes.forEach(target => {
      if (target === selectedNode || target.archived || !Array.isArray(target.tags)) return;
      const sharedTags = selectedNode.tags.filter(t => target.tags.includes(t));
      if (sharedTags.length === 0) return;

      const targetX = target.x + target.width / 2;
      const targetY = target.y + target.height / 2;

      // Draw subtle curved connector line
      this.ctx.beginPath();
      this.ctx.strokeStyle = theme.trellisStroke || 'rgba(139, 90, 43, 0.4)';
      this.ctx.lineWidth = 1.5 / scale;
      this.ctx.setLineDash([4 / scale, 4 / scale]);

      const midX = (sourceX + targetX) / 2;
      const midY = (sourceY + targetY) / 2 - 20;

      this.ctx.quadraticCurveTo(midX, midY, targetX, targetY);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      // Draw tag label badge at midpoint
      const rawTag = typeof sharedTags[0] === 'string' ? sharedTags[0].replace(/^#+/, '') : String(sharedTags[0] || '');
      const labelText = '#' + rawTag;
      this.ctx.font = `${Math.max(10, 11 / scale)}px 'Vollkorn', serif`;
      this.ctx.fillStyle = theme.trellisLabel || 'rgba(139, 90, 43, 0.9)';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(labelText, midX, midY - 6);
    });
    this.ctx.restore();
  },

  /**
   * Draws Trellis Lines connecting all visible nodes matching the active filter.
   */
  _drawFilterTrellisLines: function(currentNodes, filter, scale) {
    if (!Array.isArray(currentNodes) || !filter) return;
    const matchingNodes = currentNodes.filter(n => !n.archived && this.nodeMatchesFilter(n, filter));
    if (matchingNodes.length < 2) return;

    this.ctx.save();
    for (let i = 0; i < matchingNodes.length - 1; i++) {
      const source = matchingNodes[i];
      const target = matchingNodes[i + 1];

      const sourceX = source.x + source.width / 2;
      const sourceY = source.y + source.height / 2;
      const targetX = target.x + target.width / 2;
      const targetY = target.y + target.height / 2;

      this.ctx.beginPath();
      this.ctx.strokeStyle = 'rgba(181, 118, 20, 0.45)';
      this.ctx.lineWidth = 2 / scale;
      this.ctx.setLineDash([5 / scale, 3 / scale]);

      const midX = (sourceX + targetX) / 2;
      const midY = (sourceY + targetY) / 2 - 25;

      this.ctx.quadraticCurveTo(midX, midY, targetX, targetY);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      const rawFilter = typeof filter === 'string' ? filter.replace(/^#+/, '') : String(filter || '');
      const labelText = '#' + rawFilter;
      this.ctx.font = `bold ${Math.max(10, 11 / scale)}px 'Vollkorn', serif`;
      this.ctx.fillStyle = 'rgba(181, 118, 20, 0.9)';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(labelText, midX, midY - 6);
    }
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
    const isFilterActive = !!this.activeTagFilter;
    const isFilterMatch = isFilterActive ? this.nodeMatchesFilter(node, this.activeTagFilter) : true;

    let fillAlpha = isCurrentLevel ? AppConstants.CURRENT_LEVEL_FILL_ALPHA : (isAncestor ? AppConstants.ANCESTOR_FILL_ALPHA : AppConstants.OTHER_LEVEL_FILL_ALPHA);
    let textAlpha = isCurrentLevel ? AppConstants.CURRENT_LEVEL_TEXT_ALPHA : (isAncestor ? AppConstants.ANCESTOR_TEXT_ALPHA : AppConstants.OTHER_LEVEL_TEXT_ALPHA);

    if (isFilterActive && !isFilterMatch) {
      fillAlpha = 0.2;
      textAlpha = 0.25;
    }

    this.ctx.save();
    this.ctx.globalAlpha = fillAlpha;

    const theme = this._getThemeTokens();

    // Card background
    const bgColor = isSheet ? (theme.sheetBg || '#ffffff') : (theme.portfolioBg || '#f4ece1');
    this.ctx.fillStyle = bgColor;

    // Natural paper dropshadow when current level
    if (isCurrentLevel) {
      if (isFilterActive && isFilterMatch) {
        this.ctx.shadowColor = 'rgba(181, 118, 20, 0.4)';
        this.ctx.shadowBlur = 10 / scale;
        this.ctx.shadowOffsetY = 2 / scale;
      } else {
        this.ctx.shadowColor = isSelected ? theme.selectedShadow : (isHovered ? theme.hoverShadow : theme.defaultShadow);
        this.ctx.shadowBlur = isSelected ? 12 / scale : (isHovered ? 8 / scale : 4 / scale);
        this.ctx.shadowOffsetY = (isSelected || isHovered) ? 3 / scale : 1 / scale;
      }
    }

    this.ctx.beginPath();
    this.ctx.roundRect(node.x, node.y, node.width, node.height, borderRadius);
    this.ctx.fill();

    // Reset shadow for crisp inner elements
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;

    // Left binding spine indicator for Manuscript Sheets
    if (isSheet) {
      const spineColor = (isFilterActive && isFilterMatch) ? '#b57614' : (isSelected ? theme.selectedStroke : (isHovered ? theme.hoverStroke : theme.sheetSpine));
      this.ctx.fillStyle = spineColor;
      this.ctx.beginPath();
      this.ctx.roundRect(node.x, node.y, 6, node.height, [borderRadius, 0, 0, borderRadius]);
      this.ctx.fill();
    } else {
      // Leather binding spine (left) and archival tab (top) for Portfolios
      const spineColor = (isFilterActive && isFilterMatch) ? '#b57614' : (isSelected ? theme.selectedStroke : (isHovered ? theme.hoverStroke : theme.portfolioSpine));
      this.ctx.fillStyle = spineColor;
      this.ctx.beginPath();
      this.ctx.roundRect(node.x, node.y, 8, node.height, [borderRadius, 0, 0, borderRadius]);
      this.ctx.fill();

      const tabColor = (isFilterActive && isFilterMatch) ? '#b57614' : (isSelected ? theme.selectedStroke : (isHovered ? theme.hoverStroke : theme.portfolioTab));
      this.ctx.fillStyle = tabColor;
      this.ctx.beginPath();
      this.ctx.roundRect(node.x + 16, node.y, Math.min(100, node.width - 32), 5, [3, 3, 0, 0]);
      this.ctx.fill();
    }

    // Border: Revealed on hover, selection, or filter match
    let strokeColor = null;
    let strokeWidth = 1 / scale;

    if (isFilterActive && isFilterMatch) {
      strokeColor = '#b57614';
      strokeWidth = 2.5 / scale;
    } else if (isSelected) {
      strokeColor = theme.selectedStroke || '#b57614';
      strokeWidth = 2.5 / scale;
    } else if (isHovered) {
      strokeColor = theme.hoverStroke || '#8b5a2b';
      strokeWidth = 1.5 / scale;
    } else {
      // Subtle baseline outline for clear legibility on the desk
      strokeColor = theme.baseStroke || 'rgba(189, 174, 147, 0.45)';
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
      this.ctx.save();
      this.ctx.globalAlpha = textAlpha;

      // STRICT CLIPPING: Ensure all internal content stays strictly bounded within the card margins
      this.ctx.beginPath();
      this.ctx.roundRect(node.x, node.y, node.width, node.height, borderRadius);
      if (typeof this.ctx.clip === 'function') this.ctx.clip();

      const innerX = node.x + 18;
      const innerW = Math.max(10, node.width - 36);
      const rightX = node.x + node.width - 18;

      // 1. Header row
      const badgeY = node.y + 18;
      this.ctx.font = "12px 'Vollkorn', serif";
      this.ctx.fillStyle = isSelected ? theme.headerSelectedColor : theme.headerColor;
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';

      if (!isSheet) {
        const childCount = Array.isArray(node.children) ? node.children.length : 0;
        let totalWords = 0;
        if (this.getWordCountFunction && Array.isArray(node.children)) {
          const countWordsRecursive = (items) => {
            let sum = 0;
            items.forEach(it => {
              if (it.type === 'text') sum += this.getWordCountFunction(it.content || '');
              if (it.children && it.children.length) sum += countWordsRecursive(it.children);
            });
            return sum;
          };
          totalWords = countWordsRecursive(node.children);
        }
        const countText = childCount === 1 ? '1 sheet' : `${childCount} sheets`;
        const wordSummary = totalWords > 0 ? ` · ${totalWords.toLocaleString()} words` : '';
        let headerLabel = `📁 Portfolio · ${countText}${wordSummary}`;
        while (headerLabel.length > 5 && this.ctx.measureText(headerLabel).width > innerW) {
          headerLabel = headerLabel.slice(0, -1);
        }
        if (headerLabel.length < `📁 Portfolio · ${countText}${wordSummary}`.length) {
          headerLabel = headerLabel.trim() + '...';
        }
        this.ctx.fillText(headerLabel, innerX, badgeY);
      } else {
        const wordCount = this.getWordCountFunction ? this.getWordCountFunction(node.content || '') : 0;
        this.ctx.fillText(`📄 Sheet`, innerX, badgeY);

        // Header right: word count & read time
        const readTime = Math.max(1, Math.round(wordCount / 200));
        this.ctx.font = "11px 'Vollkorn', serif";
        this.ctx.fillStyle = theme.headerColor;
        const sheetLabelW = 60;
        const maxMetaW = innerW - sheetLabelW;
        let metaText = `${wordCount}w · ~${readTime}m read`;
        if (this.ctx.measureText(metaText).width > maxMetaW) {
          metaText = `${wordCount}w`;
        }
        if (this.ctx.measureText(metaText).width <= maxMetaW) {
          this.ctx.textAlign = 'right';
          this.ctx.fillText(metaText, rightX, badgeY);
        }
      }

      // 2. Title
      this.ctx.fillStyle = theme.titleColor || '#282421';
      this.ctx.font = isSelected ? "bold 17px 'Vollkorn', serif" : (AppConstants.DEFAULT_FONT_BOLD || "bold 17px 'Vollkorn', serif");
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'top';

      if (!node.isEditing) {
        let displayTitle = node.title || 'Untitled';
        if (this.ctx.measureText(displayTitle).width > innerW) {
          while (displayTitle.length > 3 && this.ctx.measureText(displayTitle + '...').width > innerW) {
            displayTitle = displayTitle.slice(0, -1);
          }
          displayTitle += '...';
        }
        this.ctx.fillText(displayTitle, innerX, node.y + 36);
      }

      // 3. Subtle separator rule below title
      if (this.ctx.moveTo && this.ctx.lineTo) {
        this.ctx.strokeStyle = theme.dividerColor || 'rgba(189, 174, 147, 0.35)';
        this.ctx.lineWidth = 1 / scale;
        this.ctx.beginPath();
        this.ctx.moveTo(innerX, node.y + 64);
        this.ctx.lineTo(rightX, node.y + 64);
        this.ctx.stroke();
      }

      // 4. Body Content Preview / Children List
      const bodyY = node.y + 74;
      const footerTop = node.y + node.height - 36;
      const availableBodyH = Math.max(0, footerTop - bodyY);

      if (isSheet) {
        const plainText = this._extractPlainText(node.content || '');
        if (plainText) {
          this.ctx.font = AppConstants.EXCERPT_FONT || "13px 'Vollkorn', serif";
          this.ctx.fillStyle = theme.excerptColor || '#504945';
          this.ctx.textAlign = 'left';
          this.ctx.textBaseline = 'top';

          const maxExcerptLines = Math.max(1, Math.min(6, Math.floor(availableBodyH / 19)));
          const lines = this._wrapTextLines(plainText, innerW, maxExcerptLines);
          lines.forEach((line, idx) => {
            this.ctx.fillText(line, innerX, bodyY + (idx * 19));
          });
        } else {
          this.ctx.font = "italic 13px 'Vollkorn', serif";
          this.ctx.fillStyle = theme.headerColor || '#a89984';
          this.ctx.textAlign = 'left';
          this.ctx.textBaseline = 'top';
          let emptyPrompt = 'Empty sheet — double-click or press Enter to write...';
          while (emptyPrompt.length > 5 && this.ctx.measureText(emptyPrompt).width > innerW) {
            emptyPrompt = emptyPrompt.slice(0, -1);
          }
          if (emptyPrompt.length < 'Empty sheet — double-click or press Enter to write...'.length) {
            emptyPrompt = emptyPrompt.trim() + '...';
          }
          this.ctx.fillText(emptyPrompt, innerX, bodyY + 6);
        }
      } else {
        // Portfolio: list children that fit within availableBodyH
        const children = Array.isArray(node.children) ? node.children : [];
        if (children.length > 0) {
          const maxPossibleRows = Math.max(1, Math.floor(availableBodyH / 24));
          const maxShow = Math.min(maxPossibleRows, children.length);
          for (let i = 0; i < maxShow; i++) {
            if (i === maxPossibleRows - 1 && children.length > maxPossibleRows) {
              this.ctx.font = "italic 12px 'Vollkorn', serif";
              this.ctx.fillStyle = theme.headerColor || '#7c6f64';
              this.ctx.textAlign = 'left';
              let moreLabel = `+ ${children.length - i} more items in this portfolio...`;
              while (moreLabel.length > 5 && this.ctx.measureText(moreLabel).width > innerW) {
                moreLabel = moreLabel.slice(0, -1);
              }
              this.ctx.fillText(moreLabel, innerX, bodyY + (i * 24));
              break;
            }
            const child = children[i];
            const isChildSheet = (child.type === 'text');
            const icon = isChildSheet ? '• ' : '📁 ';
            let itemText = icon + (child.title || 'Untitled');
            const itemRowY = bodyY + (i * 24);

            let wordBadge = '';
            if (isChildSheet && this.getWordCountFunction) {
              const childWords = this.getWordCountFunction(child.content || '');
              wordBadge = `${childWords}w`;
            }

            this.ctx.font = "14px 'Vollkorn', serif";
            this.ctx.fillStyle = theme.childColor || '#3c3836';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'top';

            const badgeWidth = wordBadge ? this.ctx.measureText(wordBadge).width + 16 : 0;
            const maxTitleWidth = Math.max(20, innerW - badgeWidth);

            if (this.ctx.measureText(itemText).width > maxTitleWidth) {
              while (itemText.length > 4 && this.ctx.measureText(itemText + '...').width > maxTitleWidth) {
                itemText = itemText.slice(0, -1);
              }
              itemText += '...';
            }
            this.ctx.fillText(itemText, innerX, itemRowY);

            if (wordBadge) {
              this.ctx.font = "11px 'Vollkorn', serif";
              this.ctx.fillStyle = theme.headerColor || '#7c6f64';
              this.ctx.textAlign = 'right';
              this.ctx.fillText(wordBadge, rightX, itemRowY + 2);
            }
          }
        } else {
          this.ctx.font = "italic 14px 'Vollkorn', serif";
          this.ctx.fillStyle = theme.headerColor || '#a89984';
          this.ctx.textAlign = 'left';
          this.ctx.textBaseline = 'top';
          let emptyDrawerPrompt = 'Empty archival portfolio — double-click or press Enter to open drawer...';
          while (emptyDrawerPrompt.length > 5 && this.ctx.measureText(emptyDrawerPrompt).width > innerW) {
            emptyDrawerPrompt = emptyDrawerPrompt.slice(0, -1);
          }
          if (emptyDrawerPrompt.length < 'Empty archival portfolio — double-click or press Enter to open drawer...'.length) {
            emptyDrawerPrompt = emptyDrawerPrompt.trim() + '...';
          }
          this.ctx.fillText(emptyDrawerPrompt, innerX, bodyY + 12);
        }
      }

      // 5. Metadata Footer
      const footerY = node.y + node.height - 14;

      if (isSheet && this.getWordCountFunction) {
        const wordCount = this.getWordCountFunction(node.content || '');
        const densityGoal = (node.wordGoal && node.wordGoal > 0) ? node.wordGoal : 1000;
        const progress = Math.min(1.0, wordCount / densityGoal);
        const barWidth = innerW * progress;

        // Density bar
        this.ctx.fillStyle = theme.progressBg || 'rgba(189, 174, 147, 0.25)';
        this.ctx.fillRect(innerX, node.y + node.height - 30, innerW, 2.5);

        this.ctx.fillStyle = isSelected ? theme.progressSelected : theme.progressFill;
        this.ctx.fillRect(innerX, node.y + node.height - 30, barWidth, 2.5);
      }

      // Comment / certification indicator badges on bottom right
      const commentCount = Array.isArray(node.comments) ? node.comments.length : 0;
      const certCount = Array.isArray(node.certifiedWords) ? node.certifiedWords.length : 0;
      let badgeReservationW = 0;
      if (commentCount > 0 || certCount > 0) {
        let badges = [];
        if (commentCount > 0) badges.push(`💬 ${commentCount}`);
        if (certCount > 0) badges.push(`✦ ${certCount}`);
        const badgeStr = badges.join('  ');
        this.ctx.font = "11px 'Vollkorn', serif";
        badgeReservationW = this.ctx.measureText(badgeStr).width + 12;
        this.ctx.fillStyle = theme.headerColor || '#7c6f64';
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(badgeStr, rightX, footerY - 6);
      }

      // Tags pills (bottom left)
      if (Array.isArray(node.tags) && node.tags.length > 0) {
        let tagOffset = innerX;
        const maxTagAreaRight = rightX - badgeReservationW - 10;
        for (let t = 0; t < Math.min(3, node.tags.length); t++) {
          const tag = node.tags[t];
          const rawTag = typeof tag === 'string' ? tag.replace(/^#+/, '') : String(tag || '');
          const tagStr = '#' + rawTag;
          this.ctx.font = "11px 'Vollkorn', serif";
          const tagW = this.ctx.measureText(tagStr).width;
          if (tagOffset + tagW + 12 <= maxTagAreaRight) {
            // Draw tag pill background
            this.ctx.fillStyle = theme.tagBg || 'rgba(213, 196, 161, 0.35)';
            this.ctx.beginPath();
            this.ctx.roundRect(tagOffset, footerY - 14, tagW + 10, 16, 3);
            this.ctx.fill();

            // Draw tag pill text
            this.ctx.fillStyle = theme.tagText || '#665c54';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(tagStr, tagOffset + 5, footerY - 6);
            tagOffset += tagW + 16;
          } else {
            break;
          }
        }
      }

      this.ctx.restore();
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

    // 2. Draw Trellis lines (active filter trellis or selected node trellis)
    if (this.activeTagFilter) {
      this._drawFilterTrellisLines(currentNodes, this.activeTagFilter, scale);
    } else if (selectedNodeGlobal) {
      this._drawTrellisLines(selectedNodeGlobal, currentNodes, scale);
    }

    // 3. Draw visible nodes at current level only (clean focused desk; background levels disabled)
    (currentNodes || []).forEach(node => {
      if (node && node.archived) return; // ARCHIVE: Exclude archived portfolios and sheets
      this._drawNode(node, true, false, scale);
    });

    this.ctx.restore();
  },

  getCanvasWorldPosition: function(mouseX, mouseY, canvasEl, currentScale, currentOffsetX, currentOffsetY) {
    const rect = canvasEl.getBoundingClientRect();
    const clientW = canvasEl.clientWidth || canvasEl.width || 1;
    const clientH = canvasEl.clientHeight || canvasEl.height || 1;
    const scaleX = canvasEl.width / clientW;
    const scaleY = canvasEl.height / clientH;
    const canvasMouseX = (mouseX - rect.left) * scaleX;
    const canvasMouseY = (mouseY - rect.top) * scaleY;

    const worldX = (canvasMouseX - canvasEl.width / 2) / currentScale + canvasEl.width / 2 + currentOffsetX;
    const worldY = (canvasMouseY - canvasEl.height / 2) / currentScale + canvasEl.height / 2 + currentOffsetY;
    return { x: worldX, y: worldY };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.MyProjectCanvasRenderer;
}
