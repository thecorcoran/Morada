// uiManager.js
// This module is responsible for managing UI interactions, DOM updates, 
// search functionality, and the compendium view.

import { KeyConstants } from './constants.js';

export const uiManager = {
    // --- DOM ELEMENT GETTERS (to be initialized in init) ---
    breadcrumbBar: null, viewTitle: null,
    editorMode: null, editorMetadata: null, editorWordCount: null, editorFootnotesPane: null, footnotesList: null, footnotesHeader: null, editorInspectorSidebar: null, outlinerSidebar: null, outlinerList: null,
    tagList: null, tagInput: null, // Bug fix: 'class.result-text' corrected to 'class="result-text"'.
    searchPalette: null, searchInput: null, searchResults: null,
    canvasContextMenu: null, renameNodeOption: null,

    addShelfBtn: null,
    compendiumModal: null, closeCompendiumBtn: null,
    compendiumLibrary: null, compendiumManuscript: null,
    generateBtn: null, compendiumFilter: null,
    includeCommentsCheckbox: null,
    includeCertifiedWordsCheckbox: null, // New checkbox for certified words

    // --- STATE & DEPENDENCIES (to be initialized) ---
    rootNodes: [], 
    viewStack: [], 
    selectedNode: null,
    manuscriptList: [], 
    sortableInstance: null,
    _searchDebounceTimeout: null, // For debouncing search input
    _hideContextMenuHandler: null,
    
    drawFunction: null,
    saveNodesFunction: null,
    navigateToNodeFunction: null, 
    createTitleEditorFunction: null,
    openScriptoriumCallback: null,
    addShelfCallback: null,

    /**
     * Initializes the UIManager with necessary DOM elements, data references, and callback functions.
     * @param {Object} config - Configuration object.
     * @param {Array<Object>} config.rootNodes - Reference to the main root nodes array.
     * @param {Array<Object>} config.viewStack - Reference to the main view stack array.
     * @param {Object|null} config.selectedNode - Reference to the currently selected node.
     * @param {Array<Object>} config.manuscriptList - Reference to the main manuscript list array.
     * @param {Function} config.drawFunction - Callback function to trigger a canvas redraw.
     * @param {Function} config.saveNodesFunction - Callback function to save all node data.
     * @param {Function} config.navigateToNodeFunction - Callback function to navigate to a specific node.
     * @param {Function} config.createTitleEditorFunction - Callback to create the title editor for a node.
     * @param {Function} config.openScriptoriumCallback - Callback to open a scriptorium from the outliner.
     * @param {Function} config.addShelfCallback - Callback to create a new shelf.
     */
    init: function(config) { // Prompt refers to this as initUIManager for JSDoc
        this.breadcrumbBar = document.getElementById('breadcrumb-bar');
        this.viewTitle = document.getElementById('view-title');
        this.editorMode = document.getElementById('editor-mode');
        this.editorMetadata = document.getElementById('editor-metadata');
        this.editorFootnotesPane = document.getElementById('editor-footnotes-pane');
        this.footnotesList = document.getElementById('footnotes-list');
        this.editorInspectorSidebar = document.getElementById('editor-inspector-sidebar');
        this.footnotesHeader = document.getElementById('footnotes-header');
        this.editorWordCount = document.getElementById('editor-word-count');
        this.outlinerSidebar = document.getElementById('outliner-sidebar');
        this.outlinerList = document.getElementById('outliner-list');
        this.tagList = document.getElementById('tag-list');
        this.tagInput = document.getElementById('tag-input');
        this.searchPalette = document.getElementById('search-palette');
        this.searchInput = document.getElementById('search-input');
        this.searchResults = document.getElementById('search-results');
        this.canvasContextMenu = document.getElementById('canvas-context-menu');
        this.addShelfBtn = document.getElementById('add-shelf-btn');
        this.compendiumModal = document.getElementById('compendium-modal');
        this.closeCompendiumBtn = document.getElementById('close-compendium-btn');
        this.compendiumLibrary = document.getElementById('compendium-library');
        this.compendiumManuscript = document.getElementById('compendium-manuscript');
        this.generateBtn = document.getElementById('generate-btn');
        this.compendiumFilter = document.getElementById('compendium-filter');
        this.includeCommentsCheckbox = document.getElementById('include-comments-checkbox');
        this.includeCertifiedWordsCheckbox = document.getElementById('include-certified-words-checkbox'); // Get reference to new checkbox

        this.rootNodes = config.rootNodes;
        this.viewStack = config.viewStack;
        this.selectedNode = config.selectedNode;
        this.manuscriptList = config.manuscriptList;
        this.drawFunction = config.drawFunction;
        this.saveNodesFunction = config.saveNodesFunction;
        this.navigateToNodeFunction = config.navigateToNodeFunction;
        this.createTitleEditorFunction = config.createTitleEditorFunction;
        this.openScriptoriumCallback = config.openScriptoriumCallback;
        this.addShelfCallback = config.addShelfCallback;

        this.updateUIChrome(); 
        
        this.tagInput.addEventListener('keydown', async (e) => {
            if (e.key === KeyConstants.ENTER && this.selectedNode) { 
                e.preventDefault();
                const newTag = this.tagInput.value.trim();
                if (newTag && !this.selectedNode.tags.includes(newTag)) {
                    // Assumes selectedNode.tags is an array. Consider nodeManager.addTagToNode if it exists.
                    this.selectedNode.tags.push(newTag);
                    await this.saveNodesFunction();
                    this.renderTags(this.selectedNode); // Pass current selected node
                }
                this.tagInput.value = '';
            }
        });
        this.closeCompendiumBtn.addEventListener('click', () => this.closeCompendium());
        if (this.footnotesHeader) {
            this.footnotesHeader.addEventListener('click', () => {
                if (this.editorFootnotesPane) {
                    this.editorFootnotesPane.classList.toggle('collapsed');
                }
            });
        }
        this.generateBtn.addEventListener('click', () => this.compileAndDownload());
        this.searchInput.addEventListener('input', () => { // Debounced search
            clearTimeout(this._searchDebounceTimeout);
            this._searchDebounceTimeout = setTimeout(() => {
                const query = this.searchInput.value;
                if (query.length > 1 || (query.startsWith('#') && query.length > 1)) {
                    const results = this.search(query);
                    this.displayResults(results);
                } else {
                    this.clearSearchResults();
                }
            }, 250); // Wait 250ms after user stops typing
        });
        this.compendiumFilter.addEventListener('input', () => this.refreshCompendiumView());

        if (this.addShelfBtn && this.addShelfCallback) {
            this.addShelfBtn.addEventListener('click', () => this.addShelfCallback());
        }
    },
    
    /** Updates the local reference to the rootNodes array. @param {Array<Object>} newRootNodes */
    updateRootNodesReference: function(newRootNodes) { this.rootNodes = newRootNodes; },
    /** Updates the local reference to the viewStack array. @param {Array<Object>} newViewStack */
    updateViewStackReference: function(newViewStack) { this.viewStack = newViewStack; },
    /** Updates the local reference to the selectedNode object and refreshes dependent UI. @param {Object|null} newSelectedNode */
    updateSelectedNodeReference: function(newSelectedNode) {
        this.selectedNode = newSelectedNode;
        // If we are in a book view, re-render the outliner to update highlighting
        if (this.viewStack.length > 0) {
            const currentBook = this.viewStack[this.viewStack.length - 1];
            this.renderOutliner(currentBook.children);
        }
    },

    // --- Private Helper Functions ---
    /**
     * Creates a single list item element for the compendium tree view.
     * @private
     * @param {Object} node - The node data to create the tree item for.
     * @param {string} filterTerm - The current filter term to determine expansion state.
     * @returns {HTMLLIElement} The created list item element.
     */
    _createTreeItemElement: function(node, filterTerm) {
        const li = document.createElement('li');
        li.dataset.nodeId = node.id;

        // The manuscriptList now holds IDs, so we check for the node's ID directly.
        const isSelected = this.manuscriptList.includes(node.id);
        if (isSelected) {
            li.classList.add('selected-for-compile');
        }

        const hasChildren = node.type === 'container' && node.children && node.children.length > 0;
        const isExpanded = filterTerm ? true : node.isExpanded;
        const toggleIcon = hasChildren ? (isExpanded ? '▾' : '▸') : '&nbsp;&nbsp;';

        if (hasChildren && !isExpanded) {
            li.classList.add('collapsed');
        }

        let previewHTML = '';
        if (node.type === 'text' && node.content) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = node.content;
            const plainText = (tempDiv.textContent || tempDiv.innerText || "").trim();
            if (plainText) {
                const words = plainText.split(/\s+/);
                let previewText = words.slice(0, 7).join(' ');
                if (words.length > 7) {
                    previewText += '...';
                }
                previewHTML = `<span class="compendium-item-preview">${previewText}</span>`;
            }
        }

        li.innerHTML = `
            <div style="display: flex; flex-direction: column;">
                <div style="display: flex; align-items: center;">
                    <span class="tree-toggle">${toggleIcon}</span>
                    <span class="tree-item-label">${node.title}</span>
                </div>
                ${previewHTML}
            </div>
        `;

        // Add event listeners after setting innerHTML
        if (hasChildren) {
            const toggle = li.querySelector('.tree-toggle');
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                node.isExpanded = !node.isExpanded;
                this.refreshCompendiumView();
            });
        }

        li.addEventListener('click', (e) => {
            if (e.target.classList.contains('compendium-item-preview')) {
                return;
            }
            e.stopPropagation();

            const existingIndex = this.manuscriptList.indexOf(node.id);
            if (existingIndex > -1) {
                this.manuscriptList.splice(existingIndex, 1);
            } else {
                this.manuscriptList.push(node.id);
            }
            this.refreshCompendiumView();
        });
        return li;
    },

    /**
     * Creates a single list item element for the manuscript view.
     * @private
     * @param {Object} node - The node data to create the manuscript item for.
     * @returns {HTMLLIElement} The created list item element.
     */
    _createManuscriptItemElement: function(node) {
        if (!node) {
            const li = document.createElement('li');
            li.textContent = '[Node not found - data may be out of sync]';
            li.style.color = 'red';
            return li;
        }
        const li = document.createElement('li');
        li.dataset.nodeId = node.id; // For SortableJS

        let includeNotesCheckboxHTML = '';
        if (node.type === 'container') {
            // The 'checked' property will be correctly set based on the boolean value.
            includeNotesCheckboxHTML = `
                <label class="include-notes-label">
                    <input type="checkbox" class="include-notes-checkbox" ${node.includeNotes ? 'checked' : ''}>
                     Include Notes
                </label>
            `;
        }

        li.innerHTML = `
            <span>${node.title}</span>
            ${includeNotesCheckboxHTML}
        `;

        // Add event listener after setting innerHTML
        const checkbox = li.querySelector('.include-notes-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                node.includeNotes = checkbox.checked;
            });
        }

        return li;
    },

    /**
     * Creates a single div element for a search result item.
     * @private
     * @param {Object} result - The search result object, containing the node and its path.
     * @returns {HTMLDivElement} The created div element.
     */
    _createSearchResultItemElement: function(result) {
        const resultEl = document.createElement('div');
        resultEl.className = 'search-result-item';

        const pathString = ['Bookshelf', ...(result.path ? result.path.map(p => p.title) : [])].join(' / ');

        // Conditionally create the snippet HTML to be injected into the template
        const snippetHTML = result.snippet
            ? `<div class="result-snippet">${result.snippet}</div>`
            : '';

        // Bug fix: 'class.result-text' corrected to 'class="result-text"'.
        // Bug fix: Snippet is now correctly included instead of being overwritten.
        resultEl.innerHTML = `
            <div class="result-text">${result.title}</div>
            <div class="result-path">${pathString}</div>
            ${snippetHTML}
        `;

        resultEl.addEventListener('click', () => {
            if (this.navigateToNodeFunction && result.path) {
                this.navigateToNodeFunction(result.path, result.id);
            }
            this.closeSearch();
        });
        return resultEl;
    },

    /**
     * Escapes a string for use in a regular expression.
     * @private
     * @param {string} string The string to escape.
     * @returns {string} The escaped string.
     */
    _escapeRegExp: function(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    /**
     * Shows the custom context menu at the specified coordinates.
     * This function is now dynamic and builds the menu from a configuration array.
     * @param {number} x - The clientX coordinate for the menu.
     * @param {number} y - The clientY coordinate for the menu.
     * @param {Array<Object>} items - An array of menu item objects to display.
     */
    showContextMenu: function(x, y, items) {
        if (!this.canvasContextMenu) return;

        this.hideContextMenu();

        this.canvasContextMenu.innerHTML = ''; // Clear old items

        items.forEach(item => {
            const li = document.createElement('li');
            if (item.type === 'separator') {
                li.className = 'context-menu-separator';
            } else {
                li.className = 'context-menu-item';
                li.textContent = item.label;
                if (item.disabled) {
                    li.classList.add('disabled');
                } else {
                    li.addEventListener('click', () => {
                        item.action();
                        this.hideContextMenu(); // Hide menu after action
                    });
                }
            }
            this.canvasContextMenu.appendChild(li);
        });

        this.canvasContextMenu.style.left = `${x}px`;
        this.canvasContextMenu.style.top = `${y}px`;
        this.canvasContextMenu.classList.remove('hidden');

        // Add a one-time listener to the window to close the menu if the user clicks elsewhere.
        this._hideContextMenuHandler = (e) => {
            if (!this.canvasContextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        };
        setTimeout(() => window.addEventListener('click', this._hideContextMenuHandler), 0);
    },

    /**
     * Hides the custom context menu and cleans up its event listeners.
     */
    hideContextMenu: function() {
        if (this.canvasContextMenu && !this.canvasContextMenu.classList.contains('hidden')) {
            this.canvasContextMenu.classList.add('hidden');
            if (this._hideContextMenuHandler) {
                // Clean up the global listener to prevent memory leaks.
                window.removeEventListener('click', this._hideContextMenuHandler);
                this._hideContextMenuHandler = null;
            }
        }
    },
    // --- Public API ---
    /**
     * Updates the UI chrome elements like breadcrumbs and view titles.
     * The prompt signature was (viewStack, rootNodes, breadcrumbBarEl, viewTitleEl),
     * but this implementation uses internal references set during init.
     */
    updateUIChrome: function() { // This function now also manages the outliner
        if (!this.breadcrumbBar || !this.viewTitle || !this.outlinerSidebar) return;

        // Update breadcrumbs and title
        let path = 'Bookshelf';
        this.viewStack.forEach(node => { path += ` / ${node.title}`; });
        this.breadcrumbBar.textContent = path;
        this.viewTitle.textContent = this.viewStack.length === 0 ? 'The Library' : this.viewStack[this.viewStack.length - 1].title;

        // Update outliner visibility and content
        if (this.viewStack.length > 0) {
            this.outlinerSidebar.classList.remove('hidden');
            const currentBook = this.viewStack[this.viewStack.length - 1];
            this.renderOutliner(currentBook.children);
        } else {
            this.outlinerSidebar.classList.add('hidden');
        }

        // Update "Add Shelf" button visibility
        if (this.addShelfBtn) {
            this.addShelfBtn.classList.toggle('hidden', this.viewStack.length !== 0);
        }
    },

    /**
     * Renders the list of Scriptoriums for the current Book in the outliner.
     * @param {Array<Object>} nodes - The child nodes of the current Book.
     */
    renderOutliner: function(nodes) {
        if (!this.outlinerList) return;
        this.outlinerList.innerHTML = '';

        const scriptoriums = nodes.filter(node => node.type === 'text');

        if (scriptoriums.length === 0) {
            this.outlinerList.innerHTML = '<div class="outliner-item-empty">No Scriptoriums</div>';
            return;
        }

        scriptoriums.forEach(node => {
            const item = document.createElement('div');
            item.className = 'outliner-item';
            item.textContent = node.title;
            item.dataset.nodeId = node.id;

            // Add highlighting for the currently selected node
            if (this.selectedNode && this.selectedNode.id === node.id) {
                item.classList.add('selected');
            }

            // Add interactivity to open the scriptorium on click
            item.addEventListener('click', () => {
                if (this.openScriptoriumCallback) this.openScriptoriumCallback(node.id);
            });

            this.outlinerList.appendChild(item);
        });
    },

    /**
     * Renders the footnotes (comments and certified words) for the current node.
     * @param {Object} node The currently selected node.
     */
    renderEditorFootnotes: function(node) {
        if (!this.footnotesList || !node) return;
        this.footnotesList.innerHTML = '';

        const allFootnotes = [];

        if (node.comments) {
            node.comments.forEach(comment => {
                if (comment.text && comment.text.trim() !== '') {
                    allFootnotes.push({
                        type: 'Comment',
                        id: comment.id,
                        text: comment.text,
                        sourceText: 'Comment' // Placeholder, as we don't store the original highlighted text
                    });
                }
            });
        }

        if (node.certifiedWords) {
            node.certifiedWords.forEach(cw => {
                allFootnotes.push({
                    type: 'Certified Word',
                    id: `cw-${cw.text}`,
                    text: cw.definition,
                    sourceText: cw.text
                });
            });
        }

        if (allFootnotes.length === 0) {
            this.footnotesList.innerHTML = '<li>No comments or certified words for this node.</li>';
            return;
        }

        allFootnotes.forEach((item, index) => {
            const li = document.createElement('li');
            const tempDiv = document.createElement('div');
            tempDiv.textContent = item.text; // Use textContent to prevent HTML injection
            li.innerHTML = `<strong>${index + 1}. [${item.type}: "${item.sourceText}"]</strong>: ${tempDiv.innerHTML}`;
            // Note: The click-to-highlight functionality would need editorManager reference, can be added later.
            this.footnotesList.appendChild(li);
        });
    },

    /**
     * Toggles the visibility of the editor's inspector sidebar.
     */
    toggleInspectorSidebar: function() {
        if (this.editorInspectorSidebar) {
            this.editorInspectorSidebar.classList.toggle('hidden');
        }
    },

    /**
     * Recursively calculates the total word count for a node and all its children.
     * @param {Object} node - The node to start counting from.
     * @returns {number} The total word count.
     */
    getTotalWordCount: function(node) {
        if (!node) return 0;

        if (node.type === 'text') {
            return this.getWordCount(node.content);
        }

        if (node.type === 'container' && node.children && node.children.length > 0) {
            return node.children.reduce((sum, child) => sum + this.getTotalWordCount(child), 0);
        }
        return 0;
    },
    /**
     * Calculates the word count of a given HTML string.
     * @param {string} content - The HTML content string.
     * @returns {number} The number of words.
     */
    getWordCount: function(content) {
        if (!content) return 0;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const text = tempDiv.textContent || tempDiv.innerText || '';
        return text.trim() ? text.trim().split(/\s+/).length : 0;
    },

    /**
     * Renders the tags for a given node in the specified tag list element.
     * @param {Object} node - The node whose tags are to be rendered.
     * The prompt signature was (node, tagListEl, saveNodesCallback, selectedNodeRef).
     * This implementation uses internal `this.tagList` and `this.saveNodesFunction`,
     * and `this.selectedNode` as the node reference.
     */
    renderTags: function(node) {
        if (!this.tagList) return;
        this.tagList.innerHTML = '';
        if (node && node.tags) {
            node.tags.forEach(tag => {
                const tagPill = document.createElement('div');
                tagPill.className = 'tag-pill';
                tagPill.textContent = tag;
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'tag-delete-btn';
                deleteBtn.textContent = '×';
                deleteBtn.onclick = async () => {
                    node.tags = node.tags.filter(t => t !== tag);
                    await this.saveNodesFunction();
                    this.renderTags(node); // Re-render for the same node
                };
                tagPill.appendChild(deleteBtn);
                this.tagList.appendChild(tagPill);
            });
        }
    },

    /**
     * Opens the search palette.
     * The prompt signature was (searchPaletteEl, searchInputEl). This uses internal refs.
     */
    openSearch: function() {
        if (!this.searchPalette || !this.searchInput || !this.searchResults) return;
        this.searchPalette.classList.remove('hidden');
        this.searchInput.value = '';
        this.searchResults.innerHTML = '';
        this.searchInput.focus();
    },

    /**
     * Closes the search palette.
     * The prompt signature was (searchPaletteEl). This uses internal refs.
     */
    closeSearch: function() {
        if (!this.searchPalette) return;
        this.searchPalette.classList.add('hidden');
    },
    
    /**
     * Clears the search results.
     * The prompt signature was (searchResultsContainerEl). This uses internal refs.
     */
    clearSearchResults: function() {
        if (this.searchResults) {
            this.searchResults.innerHTML = '';
        }
    },

    /**
     * Performs a search through the nodes based on a query, generating snippets with highlighting.
     * @param {string} queryToSearch - The search query. Can include '#' for tag search.
     * This function now implicitly searches `this.rootNodes`.
     * @returns {Array<Object>} An array of matching node results, each with 'path' and 'snippet' properties.
     */
    search: function(queryToSearch) {
        const results = [];
        if (!queryToSearch || queryToSearch.trim() === '') {
            return results;
        }

        const isTagSearch = queryToSearch.startsWith('#');
        const searchTerm = (isTagSearch ? queryToSearch.substring(1) : queryToSearch).trim().toLowerCase();

        if (searchTerm === '') return results;
        
        const escapedSearchTerm = this._escapeRegExp(searchTerm);
        const highlightRegex = new RegExp(escapedSearchTerm, 'gi');

        // Start the recursive search, passing down the prepared terms and the results array to be populated.
        this._performSearchRecursively(this.rootNodes, searchTerm, isTagSearch, highlightRegex, [], results);
        return results;
    },

    /**
     * The recursive part of the search functionality, optimized to avoid repeated work.
     * @private
     * @param {Array<Object>} nodes - The current set of nodes to search through.
     * @param {string} searchTerm - The lower-cased search term.
     * @param {boolean} isTagSearch - Whether this is a tag search.
     * @param {RegExp} highlightRegex - The regex for highlighting matches.
     * @param {Array<Object>} currentPath - The path to the current set of nodes.
     * @param {Array<Object>} results - The master results array to push matches into.
     */
    _performSearchRecursively: function(nodes, searchTerm, isTagSearch, highlightRegex, currentPath, results) {
        for (const node of nodes) {
            const newPath = [...currentPath, node];
            let isMatch = false;
            let snippet = '';

            if (isTagSearch) {
                if (node.tags && node.tags.some(tag => tag.toLowerCase().includes(searchTerm))) {
                    isMatch = true;
                    const firstMatchingTag = node.tags.find(tag => tag.toLowerCase().includes(searchTerm));
                    snippet = `Tag: ${firstMatchingTag ? firstMatchingTag.replace(highlightRegex, '<mark>$&</mark>') : 'Matches in tags.'}`;
                }
            } else {
                const matchInTitle = node.title.toLowerCase().includes(searchTerm);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = node.content || '';
                const plainTextContent = tempDiv.textContent || tempDiv.innerText || '';
                const matchInContent = plainTextContent.toLowerCase().includes(searchTerm);

                if (matchInTitle) {
                    isMatch = true;
                    snippet = node.title.replace(highlightRegex, '<mark>$&</mark>');
                } else if (matchInContent) {
                    isMatch = true;
                    const matchIndex = plainTextContent.toLowerCase().indexOf(searchTerm);
                    const snippetRadius = 30;
                    const termActualLength = searchTerm.length;
                    const startIndex = Math.max(0, matchIndex - snippetRadius);
                    const endIndex = Math.min(plainTextContent.length, matchIndex + termActualLength + snippetRadius);
                    const prefix = startIndex > 0 ? '...' : '';
                    const suffix = endIndex < plainTextContent.length ? '...' : '';
                    const rawSnippetText = plainTextContent.substring(startIndex, endIndex);
                    snippet = prefix + rawSnippetText.replace(highlightRegex, '<mark>$&</mark>') + suffix;
                }
            }

            if (isMatch) {
                results.push({ ...node, path: newPath, snippet: snippet });
            }

            if (node.children && node.children.length > 0) {
                this._performSearchRecursively(node.children, searchTerm, isTagSearch, highlightRegex, newPath, results);
            }
        }
    },

    /**
     * Displays search results in the specified container.
     * @param {Array<Object>} results - The array of search result objects.
     * The prompt signature was (results, searchResultsContainerEl, onResultClickCallback).
     * This implementation uses internal `this.searchResults` and `this.navigateToNodeFunction`.
     */
    displayResults: function(results) {
        if (!this.searchResults || !this.navigateToNodeFunction) return;
        this.searchResults.innerHTML = '';
        results.forEach(result => {
            const resultEl = this._createSearchResultItemElement(result);
            this.searchResults.appendChild(resultEl);
        });
    },

    /**
     * Opens the compendium modal.
     * The prompt signature was (compendiumModalEl, rootNodes, manuscriptList, filterValue).
     * This implementation uses internal refs and fetches manuscriptList from dataStorage.
     */
    openCompendium: function() {
        if (!this.compendiumModal) return;
        this.refreshCompendiumView(); // Will use the just-fetched list
        this.compendiumModal.classList.remove('hidden');
    },

    /**
     * Closes the compendium modal.
     * The prompt signature was (compendiumModalEl). This uses internal refs.
     */
    closeCompendium: function() {
        if (!this.compendiumModal) return;
        this.compendiumModal.classList.add('hidden');
    },

    /**
     * Refreshes the compendium view, including the library tree and manuscript list.
     * The prompt signature was (rootNodes, manuscriptList, filterTerm).
     * This implementation uses internal refs and fetches manuscriptList from dataStorage.
     */
    refreshCompendiumView: function() {
        if (!this.compendiumLibrary || !this.compendiumFilter || !this.rootNodes) return;
        const filterTerm = this.compendiumFilter.value;
        this.compendiumLibrary.innerHTML = '';

        this.buildTree(this.rootNodes, this.compendiumLibrary, filterTerm);
        this.renderManuscript();
    },
    
    /**
     * Filters a tree of nodes based on a search term.
     * @param {Array<Object>} nodes - The nodes to filter.
     * @param {string} searchTerm - The term to filter by.
     * @param {boolean} isTagSearch - True if searching by tags, false for content/title.
     * @returns {Array<Object>} The filtered array of nodes.
     */
    filterTree: function(nodes, searchTerm, isTagSearch) {
        return nodes.reduce((acc, node) => {
            const children = (node.children && node.children.length > 0) ? this.filterTree(node.children, searchTerm, isTagSearch) : [];
            let isMatch = false;
            if (isTagSearch) {
                if (node.tags && node.tags.some(tag => tag.toLowerCase().includes(searchTerm))) isMatch = true;
            } else {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = node.content;
                const plainTextContent = tempDiv.textContent || tempDiv.innerText || '';
                if (node.title.toLowerCase().includes(searchTerm) || plainTextContent.toLowerCase().includes(searchTerm)) isMatch = true;
            }
            if (isMatch || children.length > 0) {
                acc.push({ ...node, children: children, isExpanded: true });
            }
            return acc;
        }, []);
    },

    /**
     * Recursively builds the HTML tree for the compendium library.
     * @param {Array<Object>} nodes - The current array of nodes to process.
     * @param {HTMLElement} parentElement - The HTML element to append the tree to.
     * @param {string} [filterTerm=''] - The current filter term.
     */
    buildTree: function(nodes, parentElement, filterTerm = '') { 
        const ul = document.createElement('ul');
        let nodesToDisplay = nodes;
        if (filterTerm.trim()) {
            const isTagSearch = filterTerm.startsWith('#');
            const searchTerm = (isTagSearch ? filterTerm.substring(1) : filterTerm).toLowerCase();
            if (searchTerm) nodesToDisplay = this.filterTree(nodes, searchTerm, isTagSearch);
        }

        nodesToDisplay.forEach(node => {
            const li = this._createTreeItemElement(node, filterTerm);
            if (node.type === 'container' && node.children && node.children.length > 0) {
                 if (filterTerm ? true : node.isExpanded) { // Auto-expand filtered results
                    this.buildTree(node.children, li, filterTerm);
                 }
            }
            ul.appendChild(li);
        });
        parentElement.appendChild(ul);
    },

    /**
     * Renders the list of nodes selected for the manuscript.
     * The prompt signature was (manuscriptList, parentElement).
     * This implementation uses internal `this.compendiumManuscript` and fetches manuscriptList from dataStorage.
     */
    renderManuscript: function() {
        // Helper function to find a node by ID from the root, needed for resolving IDs to objects.
        const findNode = (nodes, id) => {
            for (const node of nodes) {
                if (node.id === id) return node;
                if (node.children) {
                    const found = findNode(node.children, id);
                    if (found) return found;
                }
            }
            return null;
        };

        if (!this.compendiumManuscript) return;
        this.compendiumManuscript.innerHTML = '';

        if (this.manuscriptList.length === 0) {
            if (this.sortableInstance) { this.sortableInstance.destroy(); this.sortableInstance = null; }
            return;
        }
        const ol = document.createElement('ol');
        this.manuscriptList.forEach(nodeId => {
            const node = findNode(this.rootNodes, nodeId);
            const li = this._createManuscriptItemElement(node);
            ol.appendChild(li);
        });
        this.compendiumManuscript.appendChild(ol);

        if (this.sortableInstance) this.sortableInstance.destroy();
        if (typeof Sortable !== 'undefined') {
            this.sortableInstance = Sortable.create(ol, {
                animation: 150,
                onEnd: async (evt) => {
                    const movedItemId = this.manuscriptList.splice(evt.oldIndex, 1)[0];
                    if (movedItemId) this.manuscriptList.splice(evt.newIndex, 0, movedItemId);
                    await this.saveNodesFunction(); // Save the new order
                    this.renderManuscript(); // Re-render
                }
            });
        } else {
            console.warn("Sortable.js not found. Manuscript items will not be sortable.");
        }
    },

    /**
     * Compiles the content of nodes in the manuscript list and triggers a download.
     * The prompt signature was (manuscriptList). This fetches from dataStorage.
     */
    compileAndDownload: function() {
        if (!this.includeCommentsCheckbox || !this.includeCertifiedWordsCheckbox) return;
        let output = '';
        const includeComments = this.includeCommentsCheckbox.checked;
        const includeCertifiedWords = this.includeCertifiedWordsCheckbox.checked; // Get state of new checkbox
        let footnotes = [];
        let footnoteCounter = 1;

        // Helper function to find a node by ID from the root, needed for resolving IDs to objects.
        const findNode = (nodes, id) => {
            for (const node of nodes) {
                if (node.id === id) return node;
                if (node.children) {
                    const found = findNode(node.children, id);
                    if (found) return found;
                }
            }
            return null;
        };

        this.manuscriptList.forEach(nodeId => {
            const node = findNode(this.rootNodes, nodeId);
            if (!node) return; // Skip if node not found

            // Process node title
            if (node.type === 'container') {
                output += `\n\n## ${node.title.toUpperCase()} ##\n\n`;
            } else if (node.type === 'text') {
                output += `### ${node.title} ###\n\n`;
            }

            // Determine which content to process
            let contentToProcess = null;
            if (node.type === 'container' && node.includeNotes) {
                contentToProcess = node.content;
            } else if (node.type === 'text') {
                contentToProcess = node.content;
            }

            if (!contentToProcess) return; // Skips to the next node in forEach

            const contentProcessorDiv = document.createElement('div');
            contentProcessorDiv.innerHTML = contentToProcess;

            // Process comments
            if (includeComments && node.comments && node.comments.length > 0) {
                const commentSpans = contentProcessorDiv.querySelectorAll('span.comment-highlight');
                commentSpans.forEach(span => {
                    const commentData = node.comments.find(c => c.id === span.id);
                    if (commentData && commentData.text && commentData.text.trim() !== '') {
                        footnotes.push(`${footnoteCounter}. [Comment] ${commentData.text}`); // Add type for clarity
                        const marker = document.createTextNode(` [${footnoteCounter}]`);
                        if (span.parentNode) {
                            span.parentNode.insertBefore(marker, span.nextSibling);
                        }
                        footnoteCounter++;
                    }
                });
            }

            // Process certified words
            if (includeCertifiedWords && node.certifiedWords && node.certifiedWords.length > 0) {
                // To ensure all certified words are included, we dynamically wrap them,
                // rather than relying on the spans already being in the content.
                let tempContent = contentProcessorDiv.innerHTML;
                node.certifiedWords.forEach(cw => {
                    const wordRegex = new RegExp(`\\b(${this._escapeRegExp(cw.text)})\\b`, 'gi');
                    const sanitizedDefinition = cw.definition.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                    tempContent = tempContent.replace(wordRegex, `<span class="certified-word-compile" data-definition="${sanitizedDefinition}">${'$&'}</span>`);
                });
                contentProcessorDiv.innerHTML = tempContent;

                contentProcessorDiv.querySelectorAll('span.certified-word-compile').forEach(span => {
                    const definition = span.getAttribute('data-definition');
                    const wordText = span.textContent;
                    footnotes.push(`${footnoteCounter}. [Certified Word: "${wordText}"] ${definition}`);
                    span.insertAdjacentText('afterend', ` [${footnoteCounter++}]`);
                });
            }

            // Finally, extract plain text from the processed HTML
            output += `${contentProcessorDiv.textContent || contentProcessorDiv.innerText || ''}\n\n`;
        });

        // Append footnotes if any were collected
        if (footnotes.length > 0) {
            output += '\n\n--- FOOTNOTES ---\n\n';
            output += footnotes.join('\n');
        }

        const blob = new Blob([output], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Morada_Export.txt';
        a.click();
        URL.revokeObjectURL(url);
    },
    
    /**
     * Checks if the compendium modal is currently open.
     * @returns {boolean} True if the compendium is open, false otherwise.
     */
    isCompendiumOpen: function() { // Parameter compendiumModalEl removed, uses internal this.compendiumModal
        return this.compendiumModal && !this.compendiumModal.classList.contains('hidden');
    },

    /**
     * Checks if the search palette is currently open.
     * @returns {boolean} True if the search palette is open, false otherwise.
     */
    isSearchOpen: function() { // Parameter searchPaletteEl removed, uses internal this.searchPalette
        return this.searchPalette && !this.searchPalette.classList.contains('hidden');
    }
};
console.log("uiManager.js JSDoc comments added and search functions refactored.");
