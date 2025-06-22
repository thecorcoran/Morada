// uiManager.js
// This module is responsible for managing UI interactions, DOM updates, 
// search functionality, and the compendium view.
console.log("uiManager.js loaded");

window.MyProjectUIManager = {
    // --- DOM ELEMENT GETTERS (to be initialized in init) ---
    breadcrumbBar: null, viewTitle: null,
    editorMode: null, editorWordCount: null,
    tagList: null, tagInput: null,
    searchPalette: null, searchInput: null, searchResults: null,
    compendiumModal: null, closeCompendiumBtn: null,
    compendiumLibrary: null, compendiumManuscript: null,
    generateBtn: null, compendiumFilter: null,

    // --- STATE & DEPENDENCIES (to be initialized) ---
    rootNodes: [], 
    viewStack: [], 
    selectedNode: null,
    manuscriptList: [], 
    sortableInstance: null,
    
    drawFunction: null,
    saveNodesFunction: null,
    navigateToNodeFunction: null, 

    /**
     * Initializes the UIManager with necessary DOM elements, data references, and callback functions.
     * @param {Object} config - Configuration object.
     * @param {Array<Object>} config.rootNodes - Reference to the main root nodes array.
     * @param {Array<Object>} config.viewStack - Reference to the main view stack array.
     * @param {Object|null} config.selectedNode - Reference to the currently selected node.
     * @param {Function} config.drawFunction - Callback function to trigger a canvas redraw.
     * @param {Function} config.saveNodesFunction - Callback function to save all node data.
     * @param {Function} config.navigateToNodeFunction - Callback function to navigate to a specific node.
     */
    init: function(config) { // Prompt refers to this as initUIManager for JSDoc
        this.breadcrumbBar = document.getElementById('breadcrumb-bar');
        this.viewTitle = document.getElementById('view-title');
        this.editorMode = document.getElementById('editor-mode');
        this.editorWordCount = document.getElementById('editor-word-count');
        this.tagList = document.getElementById('tag-list');
        this.tagInput = document.getElementById('tag-input');
        this.searchPalette = document.getElementById('search-palette');
        this.searchInput = document.getElementById('search-input');
        this.searchResults = document.getElementById('search-results');
        this.compendiumModal = document.getElementById('compendium-modal');
        this.closeCompendiumBtn = document.getElementById('close-compendium-btn');
        this.compendiumLibrary = document.getElementById('compendium-library');
        this.compendiumManuscript = document.getElementById('compendium-manuscript');
        this.generateBtn = document.getElementById('generate-btn');
        this.compendiumFilter = document.getElementById('compendium-filter');

        this.rootNodes = config.rootNodes;
        this.viewStack = config.viewStack;
        this.selectedNode = config.selectedNode;
        this.drawFunction = config.drawFunction;
        this.saveNodesFunction = config.saveNodesFunction;
        this.navigateToNodeFunction = config.navigateToNodeFunction;

        this.updateUIChrome(); 
        
        this.tagInput.addEventListener('keydown', (e) => {
            if (e.key === AppConstants.KEY_ENTER && this.selectedNode) { 
                e.preventDefault();
                const newTag = this.tagInput.value.trim();
                if (newTag && !this.selectedNode.tags.includes(newTag)) {
                    // Assumes selectedNode.tags is an array. Consider nodeManager.addTagToNode if it exists.
                    this.selectedNode.tags.push(newTag); 
                    this.saveNodesFunction(this.rootNodes);
                    this.renderTags(this.selectedNode); // Pass current selected node
                }
                this.tagInput.value = '';
            }
        });
        this.closeCompendiumBtn.addEventListener('click', () => this.closeCompendium());
        this.generateBtn.addEventListener('click', () => this.compileAndDownload());
        this.searchInput.addEventListener('input', () => {
            const query = this.searchInput.value;
            if (query.length > 1 || (query.startsWith('#') && query.length > 1)) {
                const results = this.search(query, this.rootNodes, []); // 'search' is the current name
                this.displayResults(results);
            } else {
                this.clearSearchResults();
            }
        });
        this.compendiumFilter.addEventListener('input', () => this.refreshCompendiumView());
    },
    
    /** Updates the local reference to the rootNodes array. @param {Array<Object>} newRootNodes */
    updateRootNodesReference: function(newRootNodes) { this.rootNodes = newRootNodes; },
    /** Updates the local reference to the viewStack array. @param {Array<Object>} newViewStack */
    updateViewStackReference: function(newViewStack) { this.viewStack = newViewStack; },
    /** Updates the local reference to the selectedNode object. @param {Object|null} newSelectedNode */
    updateSelectedNodeReference: function(newSelectedNode) { this.selectedNode = newSelectedNode; },

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
        if (this.manuscriptList.find(item => item.id === node.id)) { // manuscriptList is local to UIManager for now
            li.classList.add('selected-for-compile');
        }

        const toggle = document.createElement('span');
        toggle.className = 'tree-toggle';
        if (node.type === 'container' && node.children && node.children.length > 0) {
            const isExpanded = filterTerm ? true : node.isExpanded;
            toggle.textContent = isExpanded ? '▾ ' : '▸ ';
            if (!isExpanded) li.classList.add('collapsed');
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                node.isExpanded = !node.isExpanded;
                this.refreshCompendiumView();
            });
        } else {
            toggle.innerHTML = '&nbsp;&nbsp;';
        }

        const label = document.createElement('span');
        label.className = 'tree-item-label';
        label.textContent = node.title;
        li.appendChild(toggle);
        li.appendChild(label);

        li.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target === toggle) return;
            // Interaction with manuscriptList which should ideally be managed by dataStorage
            const dataStorageManuscriptList = window.MyProjectDataStorage ? window.MyProjectDataStorage.getManuscriptList() : this.manuscriptList;
            const existingIndex = dataStorageManuscriptList.findIndex(item => item.id === node.id);
            if (existingIndex > -1) {
                if(window.MyProjectDataStorage) window.MyProjectDataStorage.removeFromManuscriptList(node.id);
                else this.manuscriptList.splice(existingIndex, 1);
            } else {
                if(window.MyProjectDataStorage) window.MyProjectDataStorage.addToManuscriptList(node);
                else this.manuscriptList.push(node);
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
        const li = document.createElement('li');
        li.dataset.nodeId = node.id; // For SortableJS
        const titleSpan = document.createElement('span');
        titleSpan.textContent = node.title;
        li.appendChild(titleSpan);
        if (node.type === 'container') {
            const labelEl = document.createElement('label');
            labelEl.className = 'include-notes-label';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = node.includeNotes || false;
            checkbox.onchange = () => { 
                node.includeNotes = checkbox.checked; 
                // If manuscriptList is from dataStorage, this change is on a copy.
                // Need to update the item in dataStorage if this is desired to persist.
            };
            labelEl.appendChild(checkbox);
            labelEl.appendChild(document.createTextNode(' Include Notes'));
            li.appendChild(labelEl);
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
        const pathString = ['The Grounds', ...(result.path ? result.path.map(p => p.title) : [])].join(' / ');
        resultEl.innerHTML = `<div class.result-text">${result.title}</div><div class="result-path">${pathString}</div>`;
        resultEl.addEventListener('click', () => {
            if (this.navigateToNodeFunction && result.path) {
                this.navigateToNodeFunction(result.path, result.id);
            }
            this.closeSearch();
        });
        return resultEl;
    },

    // --- Public API ---
    /**
     * Updates the UI chrome elements like breadcrumbs and view titles.
     * The prompt signature was (viewStack, rootNodes, breadcrumbBarEl, viewTitleEl),
     * but this implementation uses internal references set during init.
     */
    updateUIChrome: function() {
        if (!this.breadcrumbBar || !this.viewTitle) return;
        let path = 'The Grounds';
        this.viewStack.forEach(node => { path += ` / ${node.title}`; });
        this.breadcrumbBar.textContent = path;
        this.viewTitle.textContent = this.viewStack.length === 0 ? 'The Castle Grounds' : this.viewStack[this.viewStack.length - 1].title;
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
                deleteBtn.onclick = () => {
                    node.tags = node.tags.filter(t => t !== tag);
                    this.saveNodesFunction(this.rootNodes);
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
     * Performs a search through the nodes based on a query.
     * @param {string} query - The search query. Can include '#' for tag search.
     * @param {Array<Object>} nodesToSearch - The array of nodes to search within.
     * @param {Array<Object>} currentPath - The current path of nodes leading to this search level (for breadcrumbs).
     * @returns {Array<Object>} An array of matching node results, each with a 'path' property.
     */
    search: function(query, nodesToSearch, currentPath) { // Renamed from performSearch in prompt for consistency
        let results = [];
        const isTagSearch = query.startsWith('#');
        const searchTerm = (isTagSearch ? query.substring(1) : query).toLowerCase();
        if (searchTerm.length === 0) return results;

        for (const node of nodesToSearch) {
            const newPath = [...currentPath, node];
            let isMatch = false;
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = node.content;
            const plainTextContent = tempDiv.textContent || tempDiv.innerText || '';
            if (isTagSearch) {
                if (node.tags && node.tags.some(tag => tag.toLowerCase().includes(searchTerm))) isMatch = true;
            } else {
                if (node.title.toLowerCase().includes(searchTerm) || plainTextContent.toLowerCase().includes(searchTerm)) isMatch = true;
            }
            if (isMatch) results.push({ ...node, path: newPath });
            if (node.children && node.children.length > 0) {
                results = results.concat(this.search(query, node.children, newPath));
            }
        }
        return results;
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
        // Always fetch the latest from dataStorage when opening
        this.manuscriptList = window.MyProjectDataStorage ? window.MyProjectDataStorage.getManuscriptList() : [];
        this.refreshCompendiumView(); // Will use the just-fetched list
        this.compendiumModal.classList.remove('hidden');
    },
    
    /** Clears the local UIManager copy of the manuscript list. */
    clearManuscriptListLocal: function() { 
        this.manuscriptList = [];
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
        this.manuscriptList = window.MyProjectDataStorage ? window.MyProjectDataStorage.getManuscriptList() : [];

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
        if (!this.compendiumManuscript) return;
        this.compendiumManuscript.innerHTML = '';
        this.manuscriptList = window.MyProjectDataStorage ? window.MyProjectDataStorage.getManuscriptList() : [];

        if (this.manuscriptList.length === 0) {
            if (this.sortableInstance) { this.sortableInstance.destroy(); this.sortableInstance = null; }
            return;
        }
        const ol = document.createElement('ol');
        this.manuscriptList.forEach(node => {
            const li = this._createManuscriptItemElement(node);
            ol.appendChild(li);
        });
        this.compendiumManuscript.appendChild(ol);

        if (this.sortableInstance) this.sortableInstance.destroy();
        if (typeof Sortable !== 'undefined') {
            this.sortableInstance = Sortable.create(ol, {
                animation: 150,
                onEnd: (evt) => {
                    if (window.MyProjectDataStorage) {
                        const currentList = window.MyProjectDataStorage.getManuscriptList();
                        const item = currentList.splice(evt.oldIndex, 1)[0];
                        if (item) currentList.splice(evt.newIndex, 0, item);
                        // No need to manually set this.manuscriptList, it's fetched at render start
                    }
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
        if (!window.MyProjectDataStorage) return;
        let output = '';
        const tempDiv = document.createElement('div');
        const currentManuscriptList = window.MyProjectDataStorage.getManuscriptList();

        currentManuscriptList.forEach(node => {
            if (node.type === 'container') {
                output += `\n\n## ${node.title.toUpperCase()} ##\n\n`;
                if (node.includeNotes && node.content) {
                    tempDiv.innerHTML = node.content;
                    output += `${tempDiv.textContent || tempDiv.innerText || ''}\n\n`;
                }
            } else if (node.type === 'text') {
                output += `### ${node.title} ###\n\n`;
                if (node.content) {
                    tempDiv.innerHTML = node.content;
                    output += `${tempDiv.textContent || tempDiv.innerText || ''}\n\n`;
                }
            }
        });

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
console.log("uiManager.js JSDoc comments added.");
