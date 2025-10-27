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
    stateManager: null,
    sortableInstance: null,
    drawFunction: null,
    saveNodesFunction: null,
    navigateToNodeFunction: null,
    canvas: null, // Added canvas here

    /**
     * Initializes the UIManager with necessary DOM elements, the state manager, and callback functions.
     * @param {Object} config - Configuration object.
     * @param {HTMLCanvasElement} config.canvas - The main canvas DOM element.
     * @param {Object} config.stateManager - The central state manager for the application.
     * @param {Function} config.drawFunction - Callback function to trigger a canvas redraw.
     * @param {Function} config.saveNodesFunction - Callback function to save all node data.
     * @param {Function} config.navigateToNodeFunction - Callback function to navigate to a specific node.
     */
    init: function(config) {
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

        this.canvas = config.canvas; // Store canvas
        this.stateManager = config.stateManager;
        this.drawFunction = config.drawFunction;
        this.saveNodesFunction = config.saveNodesFunction;
        this.navigateToNodeFunction = config.navigateToNodeFunction;

        this.updateUIChrome();

        this.tagInput.addEventListener('keydown', (e) => {
            const selectedNode = this.stateManager.getSelectedNode();
            if (e.key === AppConstants.KEY_ENTER && selectedNode) {
                e.preventDefault();
                const newTag = this.tagInput.value.trim();
                if (newTag && !selectedNode.tags.includes(newTag)) {
                    selectedNode.tags.push(newTag);
                    this.saveNodesFunction();
                    this.renderTags(selectedNode);
                }
                this.tagInput.value = '';
            }
        });
        this.closeCompendiumBtn.addEventListener('click', () => this.closeCompendium());
        this.generateBtn.addEventListener('click', () => this.compileAndDownload());
        this.searchInput.addEventListener('input', () => {
            const query = this.searchInput.value;
            if (query.length > 1 || (query.startsWith('#') && query.length > 1)) {
                const results = this.search(query, this.stateManager.getRootNodes(), []);
                this.displayResults(results);
            } else {
                this.clearSearchResults();
            }
        });
        this.compendiumFilter.addEventListener('input', () => this.refreshCompendiumView());
    },

    /**
     * Creates an inline editor for a node's title.
     * @param {Object} node - The node object whose title is to be edited.
     */
    createTitleEditor: function(node) {
        if (!this.drawFunction || !this.saveNodesFunction || !this.canvas) {
            console.error("UIManager not fully initialized for createTitleEditor");
            return;
        }
        node.isEditing = true;
        this.drawFunction();

        const editor = document.createElement('input');
        editor.type = 'text';
        editor.className = 'node-editor';
        editor.value = node.title;

        const rect = this.canvas.getBoundingClientRect();
        const canvasX = rect.left + window.scrollX;
        const canvasY = rect.top + window.scrollY;

        const scale = this.stateManager.getScale();
        const offsetX = this.stateManager.getOffsetX();
        const offsetY = this.stateManager.getOffsetY();

        const screenX = (node.x - offsetX) * scale + this.canvas.width / 2 + canvasX;
        const screenY = (node.y - offsetY) * scale + this.canvas.height / 2 + canvasY;

        editor.style.position = 'absolute';
        editor.style.left = `${screenX}px`;
        editor.style.top = `${screenY}px`;
        editor.style.width = `${node.width * scale}px`;
        editor.style.fontSize = `${16 * scale}px`;
        editor.style.zIndex = '1000';

        document.body.appendChild(editor);
        editor.focus();
        editor.select();

        const saveAndRemove = () => {
            node.title = editor.value;
            node.isEditing = false;
            if (document.body.contains(editor)) {
                document.body.removeChild(editor);
            }
            this.saveNodesFunction();
            this.drawFunction();
        };

        editor.addEventListener('blur', saveAndRemove, { once: true });
        editor.addEventListener('keydown', (e) => {
            if (e.key === AppConstants.KEY_ENTER || e.key === AppConstants.KEY_ESCAPE) {
                e.stopPropagation();
                editor.blur();
            }
        });
    },

    // --- Private Helper Functions ---
    _createTreeItemElement: function(node, filterTerm) {
        const li = document.createElement('li');
        li.dataset.nodeId = node.id;
        const manuscriptList = window.MyProjectDataStorage.getManuscriptList();
        if (manuscriptList.find(item => item.id === node.id)) {
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
            const existingIndex = manuscriptList.findIndex(item => item.id === node.id);
            if (existingIndex > -1) {
                window.MyProjectDataStorage.removeFromManuscriptList(node.id);
            } else {
                window.MyProjectDataStorage.addToManuscriptList(node);
            }
            this.refreshCompendiumView();
        });
        return li;
    },

    _createManuscriptItemElement: function(node) {
        const li = document.createElement('li');
        li.dataset.nodeId = node.id;
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
            };
            labelEl.appendChild(checkbox);
            labelEl.appendChild(document.createTextNode(' Include Notes'));
            li.appendChild(labelEl);
        }
        return li;
    },

    _createSearchResultItemElement: function(result) {
        const resultEl = document.createElement('div');
        resultEl.className = 'search-result-item';
        const pathString = ['The Grounds', ...(result.path ? result.path.map(p => p.title) : [])].join(' / ');
        resultEl.innerHTML = `<div class="result-text">${result.title}</div><div class="result-path">${pathString}</div>`;
        resultEl.addEventListener('click', () => {
            if (this.navigateToNodeFunction && result.path) {
                this.navigateToNodeFunction(result.path, result.id);
            }
            this.closeSearch();
        });
        return resultEl;
    },

    // --- Public API ---
    updateUIChrome: function() {
        if (!this.breadcrumbBar || !this.viewTitle) return;
        const viewStack = this.stateManager.getViewStack();
        let path = 'The Grounds';
        viewStack.forEach(node => { path += ` / ${node.title}`; });
        this.breadcrumbBar.textContent = path;
        this.viewTitle.textContent = viewStack.length === 0 ? 'The Castle Grounds' : viewStack[viewStack.length - 1].title;
    },

    getWordCount: function(content) {
        if (!content) return 0;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const text = tempDiv.textContent || tempDiv.innerText || '';
        return text.trim() ? text.trim().split(/\s+/).length : 0;
    },

    updateEditorWordCount: function(content) {
        if (this.editorWordCount) {
            const wordCount = this.getWordCount(content);
            this.editorWordCount.textContent = `Words: ${wordCount}`;
        }
    },

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
                    this.saveNodesFunction();
                    this.renderTags(node);
                };
                tagPill.appendChild(deleteBtn);
                this.tagList.appendChild(tagPill);
            });
        }
    },

    openSearch: function() {
        if (!this.searchPalette || !this.searchInput || !this.searchResults) return;
        this.searchPalette.classList.remove('hidden');
        this.searchInput.value = '';
        this.searchResults.innerHTML = '';
        this.searchInput.focus();
    },

    closeSearch: function() {
        if (!this.searchPalette) return;
        this.searchPalette.classList.add('hidden');
    },

    clearSearchResults: function() {
        if (this.searchResults) {
            this.searchResults.innerHTML = '';
        }
    },

    search: function(query, nodesToSearch, currentPath) {
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

    displayResults: function(results) {
        if (!this.searchResults || !this.navigateToNodeFunction) return;
        this.searchResults.innerHTML = '';
        results.forEach(result => {
            const resultEl = this._createSearchResultItemElement(result);
            this.searchResults.appendChild(resultEl);
        });
    },

    openCompendium: function() {
        if (!this.compendiumModal) return;
        this.refreshCompendiumView();
        this.compendiumModal.classList.remove('hidden');
    },

    closeCompendium: function() {
        if (!this.compendiumModal) return;
        this.compendiumModal.classList.add('hidden');
    },

    refreshCompendiumView: function() {
        if (!this.compendiumLibrary || !this.compendiumFilter) return;
        const filterTerm = this.compendiumFilter.value;
        this.compendiumLibrary.innerHTML = '';
        this.buildTree(this.stateManager.getRootNodes(), this.compendiumLibrary, filterTerm);
        this.renderManuscript();
    },

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
                if (filterTerm ? true : node.isExpanded) {
                    this.buildTree(node.children, li, filterTerm);
                }
            }
            ul.appendChild(li);
        });
        parentElement.appendChild(ul);
    },

    renderManuscript: function() {
        if (!this.compendiumManuscript) return;
        this.compendiumManuscript.innerHTML = '';
        const manuscriptList = window.MyProjectDataStorage.getManuscriptList();

        if (manuscriptList.length === 0) {
            if (this.sortableInstance) { this.sortableInstance.destroy(); this.sortableInstance = null; }
            return;
        }
        const ol = document.createElement('ol');
        manuscriptList.forEach(node => {
            const li = this._createManuscriptItemElement(node);
            ol.appendChild(li);
        });
        this.compendiumManuscript.appendChild(ol);

        if (this.sortableInstance) this.sortableInstance.destroy();
        if (typeof Sortable !== 'undefined') {
            this.sortableInstance = Sortable.create(ol, {
                animation: 150,
                onEnd: (evt) => {
                    const currentList = window.MyProjectDataStorage.getManuscriptList();
                    const item = currentList.splice(evt.oldIndex, 1)[0];
                    if (item) currentList.splice(evt.newIndex, 0, item);
                    this.renderManuscript(); // Re-render
                }
            });
        } else {
            console.warn("Sortable.js not found. Manuscript items will not be sortable.");
        }
    },

    compileAndDownload: function() {
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

    isCompendiumOpen: function() {
        return this.compendiumModal && !this.compendiumModal.classList.contains('hidden');
    },

    isSearchOpen: function() {
        return this.searchPalette && !this.searchPalette.classList.contains('hidden');
    }
};
