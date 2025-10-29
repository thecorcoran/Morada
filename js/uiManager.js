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
    this.breadcrumbPath = document.getElementById('breadcrumb-path');
        this.viewTitle = document.getElementById('view-title');
    this.breadcrumbBackBtn = document.getElementById('breadcrumb-back-btn');
        this.editorMode = document.getElementById('editor-mode');
        this.editorWordCount = document.getElementById('editor-word-count');
    this.editorInspectorSidebar = document.getElementById('editor-inspector-sidebar');
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

        // wrap saveNodesFunction so we can rebuild search index after saves
        try {
            if (this.saveNodesFunction && typeof this.saveNodesFunction === 'function') {
                this._origSaveNodesFunction = this.saveNodesFunction;
                const self = this;
                this.saveNodesFunction = function(...args) {
                    try { self._origSaveNodesFunction.apply(this, args); } catch (e) { console.warn('orig saveNodesFunction failed', e); }
                    try { self._buildSearchIndex(); } catch (e) { console.warn('buildSearchIndex failed', e); }
                };
            }
        } catch (e) {}
        // initial index build
        try { this._buildSearchIndex(); } catch (e) {}

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
        // Top-level compendium/scriptorium buttons
        this.openCompendiumBtn = document.getElementById('open-compendium-btn');
        this.openScriptoriumBtn = document.getElementById('open-scriptorium-btn');
    this.openNavigatorBtn = document.getElementById('open-navigator-btn');
    if (this.openNavigatorBtn) this.openNavigatorBtn.addEventListener('click', () => this.showNavigatorPanel());
        this.autoFitToggleBtn = document.getElementById('auto-fit-toggle');
        this._autoFit = true; // default: auto-fit on changes
        if (this.autoFitToggleBtn) {
            this.autoFitToggleBtn.addEventListener('click', () => {
                this._autoFit = !this._autoFit;
                this.autoFitToggleBtn.textContent = `Auto-Fit: ${this._autoFit ? 'On' : 'Off'}`;
            });
        }
        if (this.breadcrumbBackBtn) this.breadcrumbBackBtn.addEventListener('click', () => {
            const viewStack = this.stateManager.getViewStack();
            if (viewStack.length === 0) return;
            // Pop and restore parent nodes
            viewStack.pop();
            const parent = viewStack.length > 0 ? viewStack[viewStack.length - 1].children : this.stateManager.getRootNodes();
            this.stateManager.setCurrentNodes(parent);
            this.stateManager.setViewStack(viewStack);
            this.updateUIChrome();
            if (this.drawFunction) this.drawFunction();
        });
        if (this.openCompendiumBtn) this.openCompendiumBtn.addEventListener('click', () => this.openCompendium());
        if (this.openScriptoriumBtn) this.openScriptoriumBtn.addEventListener('click', () => {
            const sel = this.stateManager.getSelectedNode();
            if (!sel) return alert('No node selected');
            if (typeof window.MyProjectEditorManager?.openEditorMode === 'function') {
                window.MyProjectEditorManager.openEditorMode(sel);
            }
        });
        // New Project button (creates a container node on the current view - typically main floor)
        this.newProjectBtn = document.getElementById('new-project-btn');
        if (this.newProjectBtn) this.newProjectBtn.addEventListener('click', () => {
            const id = 'node-' + Date.now() + '-' + Math.floor(Math.random()*10000);
            const centerX = (this.canvas ? (this.canvas.width/2) : 0);
            const centerY = (this.canvas ? (this.canvas.height/2) : 0);
            const newNode = window.MyProjectNodeManager.createNode(centerX, centerY, false, id);
            const current = this.stateManager.getCurrentNodes();
            current.push(newNode);
            this.stateManager.setCurrentNodes(current);
            this.stateManager.setSelectedNode(newNode);
            if (this.saveNodesFunction) this.saveNodesFunction();
            if (this.drawFunction) this.drawFunction();
            if (typeof this.fitNodesToView === 'function' && this._autoFit) this.fitNodesToView();
        });
        // Timer and word-goal elements
        this.timerDurationInput = document.getElementById('timer-duration-input');
        this.timerStartBtn = document.getElementById('timer-start-btn');
        this.writingTimerDisplay = document.getElementById('writing-timer-display');
        this.wordGoalInput = document.getElementById('word-goal-input');
        this.wordGoalCurrent = document.getElementById('word-goal-current');

        this._timerInterval = null;
        this._timerRemaining = 0;

        if (this.timerStartBtn) this.timerStartBtn.addEventListener('click', () => this._toggleTimer());
        if (this.wordGoalInput) this.wordGoalInput.addEventListener('change', () => {
            const g = parseInt(this.wordGoalInput.value, 10) || 0;
            if (this.wordGoalCurrent) this.wordGoalCurrent.textContent = '0';
            if (this.wordGoalCurrent) this.wordGoalCurrent.classList.remove('goal-met');
        });

    // Export tags button -> open tags panel (allows copy/download)
    this.exportTagsBtn = document.getElementById('export-tags-btn');
    if (this.exportTagsBtn) this.exportTagsBtn.addEventListener('click', () => this.showAllTagsPanel());

        // Editor toolbar buttons (if present)
        this.editorCommentBtn = document.getElementById('editor-comment-btn');
        this.editorCertifyBtn = document.getElementById('editor-certify-btn');
        this.editorSaveCloseBtn = document.getElementById('editor-saveclose-btn');

        if (this.editorCommentBtn) this.editorCommentBtn.addEventListener('click', () => {
            if (window.MyProjectEditorManager && typeof window.MyProjectEditorManager.addCommentAtSelection === 'function') {
                window.MyProjectEditorManager.addCommentAtSelection();
            }
        });

        if (this.editorCertifyBtn) this.editorCertifyBtn.addEventListener('click', () => {
            if (window.MyProjectEditorManager && typeof window.MyProjectEditorManager.certifySelection === 'function') {
                window.MyProjectEditorManager.certifySelection();
            }
        });

        if (this.editorSaveCloseBtn) this.editorSaveCloseBtn.addEventListener('click', () => {
            if (window.MyProjectEditorManager && typeof window.MyProjectEditorManager.closeEditorMode === 'function') {
                window.MyProjectEditorManager.closeEditorMode();
            }
        });

        // Keyboard shortcuts while editor is focused
        document.addEventListener('keydown', (e) => {
            const isEditorOpen = this.isEditorOpen && this.isEditorOpen();
            if (!isEditorOpen) return;
            // Ctrl+M -> add comment
            if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'm') {
                e.preventDefault();
                if (window.MyProjectEditorManager && typeof window.MyProjectEditorManager.addCommentAtSelection === 'function') {
                    window.MyProjectEditorManager.addCommentAtSelection();
                }
            }
            // Ctrl+Shift+C -> certify
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                if (window.MyProjectEditorManager && typeof window.MyProjectEditorManager.certifySelection === 'function') {
                    window.MyProjectEditorManager.certifySelection();
                }
            }
        });

    // Comment / Certify modal elements (if present in DOM)
    this.commentModal = document.getElementById('comment-modal');
    this.closeCommentBtn = document.getElementById('close-comment-modal');
    this.saveCommentBtn = document.getElementById('save-comment-btn');
    this.deleteCommentBtn = document.getElementById('delete-comment-btn');
    this.commentSelectedText = document.getElementById('comment-selected-text');
    this.commentTextarea = document.getElementById('comment-textarea');

    this.certifyWordModal = document.getElementById('certify-word-modal');
    this.closeCertifyWordBtn = document.getElementById('close-certify-word-btn');
    this.certifySelectedWord = document.getElementById('certify-selected-word');
    this.certifyDefinitionInput = document.getElementById('certify-definition-input');
    this.saveCertificationBtn = document.getElementById('save-certification-btn');
    this.cancelCertificationBtn = document.getElementById('cancel-certification-btn');

    // internal pending objects while modal is open
    this._pendingComment = null; // { spanId, nodeId }
    this._pendingCertify = null; // { spanId, nodeId, word }

    // Hook up modal buttons if elements exist
    if (this.closeCommentBtn) this.closeCommentBtn.addEventListener('click', () => this.closeCommentModal());
    if (this.saveCommentBtn) this.saveCommentBtn.addEventListener('click', () => this._savePendingComment());
    if (this.deleteCommentBtn) this.deleteCommentBtn.addEventListener('click', () => this._deletePendingComment());

    if (this.closeCertifyWordBtn) this.closeCertifyWordBtn.addEventListener('click', () => this.closeCertifyModal());
    if (this.saveCertificationBtn) this.saveCertificationBtn.addEventListener('click', () => this._savePendingCertification());
    if (this.cancelCertificationBtn) this.cancelCertificationBtn.addEventListener('click', () => this.closeCertifyModal());

        // --- Debug Toolbar (visible controls for selection operations) ---
        // This small floating toolbar helps with testing selection/open/delete
        // when keyboard events or double-clicks are unreliable on some setups.
        this._createDebugToolbar();
        // Utility: ensure modals close on Escape and trap focus when opened
        this._attachedModals = new WeakMap();
    },

    /**
     * Attach keyboard handlers and focus trap to a modal element.
     * options.close should be a function that hides/removes the modal.
     */
    _attachModalBehavior: function(modalEl, options = {}) {
        if (!modalEl) return;
        // If already attached, skip
        if (this._attachedModals.has(modalEl)) return;

        // set ARIA attributes for screen readers
        try {
            modalEl.setAttribute('role', 'dialog');
            modalEl.setAttribute('aria-modal', 'true');
            modalEl.setAttribute('aria-hidden', 'false');
            // find a heading to label the dialog
            const heading = modalEl.querySelector('h1, h2, h3, h4, h5, h6');
            if (heading) {
                if (!heading.id) heading.id = `dialog-title-${Math.floor(Math.random()*100000)}`;
                modalEl.setAttribute('aria-labelledby', heading.id);
            }
        } catch (e) { /* non-fatal */ }

        const focusableSelector = 'a[href], area, input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';
        let focusable = Array.from(modalEl.querySelectorAll(focusableSelector)).filter(el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length));
        const prevFocus = document.activeElement;
        // Ensure any decorative close spans are keyboard accessible
        Array.from(modalEl.querySelectorAll('.close-button')).forEach(cb => {
            try {
                if (!cb.hasAttribute('role')) cb.setAttribute('role', 'button');
                if (!cb.hasAttribute('tabindex')) cb.setAttribute('tabindex', '0');
                if (!cb.hasAttribute('aria-label')) cb.setAttribute('aria-label', 'Close dialog');
                // allow Enter/Space to trigger
                if (!cb._closeKeyHandler) {
                    cb._closeKeyHandler = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); cb.click(); } };
                    cb.addEventListener('keydown', cb._closeKeyHandler);
                }
            } catch (e) {}
        });

        focusable = Array.from(modalEl.querySelectorAll(focusableSelector)).filter(el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length));

        if (focusable.length) {
            try { focusable[0].focus(); } catch (e) { try { modalEl.setAttribute('tabindex', '-1'); modalEl.focus(); } catch (e2) {} }
        } else {
            try { modalEl.setAttribute('tabindex', '-1'); modalEl.focus(); } catch (e) {}
        }

        const closeFn = options.close || (() => { if (modalEl.parentNode) modalEl.parentNode.removeChild(modalEl); });

        const keydownHandler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                try { closeFn(); } catch (err) { console.warn('modal close handler failed', err); }
            }
            if (e.key === 'Tab') {
                // trap focus
                const current = document.activeElement;
                const idx = focusable.indexOf(current);
                if (e.shiftKey) {
                    // shift+tab
                    if (idx === 0 || current === modalEl) {
                        e.preventDefault();
                        const last = focusable[focusable.length - 1]; if (last) last.focus();
                    }
                } else {
                    if (idx === focusable.length - 1) {
                        e.preventDefault();
                        const first = focusable[0]; if (first) first.focus();
                    }
                }
            }
        };

        document.addEventListener('keydown', keydownHandler);

        const detach = () => {
            document.removeEventListener('keydown', keydownHandler);
            // remove any synthetic key handlers on close-button spans
            Array.from(modalEl.querySelectorAll('.close-button')).forEach(cb => {
                try { if (cb._closeKeyHandler) cb.removeEventListener('keydown', cb._closeKeyHandler); cb._closeKeyHandler = null; } catch (e) {}
            });
            try { if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus(); } catch (e) {}
            try { modalEl.setAttribute('aria-hidden', 'true'); } catch (e) {}
            this._attachedModals.delete(modalEl);
        };

        this._attachedModals.set(modalEl, { detach, keydownHandler, prevFocus });
        // expose detach for external callers
        modalEl._detachModalBehavior = detach;
    },

    /**
     * Show a modal navigator listing nodes hierarchically so the user can jump to a node
     * or open its scriptorium (editor) directly.
     */
    showNavigatorPanel: function() {
        const self = this;
        // If modal exists, show it
        let modal = document.getElementById('navigator-modal');
        if (modal) { modal.classList.remove('hidden'); return; }

        const root = this.stateManager.getRootNodes() || [];
        modal = document.createElement('div');
        modal.id = 'navigator-modal';
        modal.className = 'modal';

        const content = document.createElement('div');
        content.className = 'modal-content navigator-content';
        content.style.maxWidth = '920px';
        content.style.width = '86%';

        const header = document.createElement('div'); header.className = 'modal-header';
        const h = document.createElement('h3'); h.textContent = 'Navigator';
        const closeX = document.createElement('span'); closeX.className = 'close-button'; closeX.textContent = '×';
        header.appendChild(h); header.appendChild(closeX);

        const body = document.createElement('div'); body.className = 'modal-body navigator-body';

        // Search input
        const searchWrap = document.createElement('div'); searchWrap.className = 'navigator-search';
        const searchInput = document.createElement('input'); searchInput.type = 'search'; searchInput.placeholder = 'Filter nodes by title...';
    searchInput.setAttribute('aria-label', 'Filter nodes');
        searchInput.style.width = '100%'; searchInput.style.padding = '8px'; searchInput.style.marginBottom = '8px';
        searchWrap.appendChild(searchInput);
        body.appendChild(searchWrap);

        const treeContainer = document.createElement('div'); treeContainer.className = 'navigator-tree'; treeContainer.style.maxHeight = '62vh'; treeContainer.style.overflow = 'auto';

        // expand/collapse state (persisted in localStorage)
        const expanded = new Set();
        try {
            const saved = localStorage.getItem('morada.navigator.expanded');
            if (saved) {
                const arr = JSON.parse(saved);
                if (Array.isArray(arr)) arr.forEach(id => expanded.add(id));
            }
        } catch (e) { console.warn('failed to load navigator expand state', e); }

        // helper: check if node or descendants match term (title, content, tags)
        const matchesTerm = (node, term) => {
            if (!term) return true;
            // If we have a prebuilt index, use it for faster checks
            try {
                if (this._searchIndex && this._searchIndex[node.id]) {
                    if (this._searchIndex[node.id].includes(term)) return true;
                }
            } catch (e) {}
            // fallback to per-node checks
            const tTitle = (node.title || '').toLowerCase();
            if (tTitle.includes(term)) return true;
            // tags
            if (Array.isArray(node.tags) && node.tags.some(tag => (tag || '').toLowerCase().includes(term))) return true;
            // content
            try {
                const plain = (this.getPlainText(node.content) || '').toLowerCase();
                if (plain.includes(term)) return true;
            } catch (e) {}
            if (node.children && node.children.length) {
                return node.children.some(ch => matchesTerm(ch, term));
            }
            return false;
        };

        const renderTree = (nodes, container, pathSoFar, term) => {
            container.innerHTML = '';
            const ul = document.createElement('ul'); ul.className = 'navigator-ul';
            nodes.forEach(n => {
                if (!matchesTerm(n, term)) return; // skip non-matching branches
                const li = document.createElement('li'); li.className = 'navigator-li';

                const row = document.createElement('div'); row.className = 'navigator-row';
                const left = document.createElement('div'); left.className = 'navigator-left';
                left.style.display = 'flex'; left.style.alignItems = 'center';

                // toggle for containers
                if (n.type === 'container' && n.children && n.children.length) {
                    const toggle = document.createElement('button'); toggle.className = 'navigator-toggle';
                    toggle.textContent = expanded.has(n.id) ? '▾' : '▸';
                    toggle.addEventListener('click', (ev) => { ev.stopPropagation(); if (expanded.has(n.id)) expanded.delete(n.id); else expanded.add(n.id); try { localStorage.setItem('morada.navigator.expanded', JSON.stringify(Array.from(expanded))); } catch (e) {} renderTree(root, treeContainer, [], searchInput.value.trim().toLowerCase()); });
                    left.appendChild(toggle);
                    const count = document.createElement('span'); count.className = 'navigator-count'; count.textContent = ` (${n.children.length})`;
                    const title = document.createElement('span'); title.className = 'navigator-title'; title.textContent = n.title || '(untitled)';
                    left.appendChild(title);
                    left.appendChild(count);
                } else {
                    const spacer = document.createElement('span'); spacer.style.display = 'inline-block'; spacer.style.width = '20px'; left.appendChild(spacer);
                    const title = document.createElement('span'); title.className = 'navigator-title'; title.textContent = n.title || '(untitled)'; left.appendChild(title);
                }

                row.appendChild(left);

                const right = document.createElement('div'); right.className = 'navigator-right';
                const openBtn = document.createElement('button'); openBtn.className = 'navigator-open-btn'; openBtn.textContent = 'Open';
                openBtn.addEventListener('click', (ev) => { ev.stopPropagation(); // navigate then possibly open editor
                    const newPath = [...pathSoFar, n];
                    try { if (typeof this.navigateToNodeFunction === 'function') this.navigateToNodeFunction(newPath, n.id); } catch (err) { console.warn(err); }
                    try { const found = window.MyProjectNodeManager && typeof window.MyProjectNodeManager.findNodeByIdPath === 'function' ? window.MyProjectNodeManager.findNodeByIdPath(n.id, this.stateManager.getRootNodes()) : null; if (found && found.type === 'text' && window.MyProjectEditorManager && typeof window.MyProjectEditorManager.openEditorMode === 'function') window.MyProjectEditorManager.openEditorMode(found); } catch (err) { console.warn(err); }
                    modal.classList.add('hidden');
                });
                right.appendChild(openBtn);
                row.appendChild(right);

                // clicking row navigates too
                row.addEventListener('click', () => {
                    const newPath = [...pathSoFar, n];
                    try { if (typeof this.navigateToNodeFunction === 'function') this.navigateToNodeFunction(newPath, n.id); } catch (err) { console.warn(err); }
                    try { const found = window.MyProjectNodeManager && typeof window.MyProjectNodeManager.findNodeByIdPath === 'function' ? window.MyProjectNodeManager.findNodeByIdPath(n.id, this.stateManager.getRootNodes()) : null; if (found && found.type === 'text' && window.MyProjectEditorManager && typeof window.MyProjectEditorManager.openEditorMode === 'function') window.MyProjectEditorManager.openEditorMode(found); } catch (err) { console.warn(err); }
                    modal.classList.add('hidden');
                });

                li.appendChild(row);

                // children
                if (n.children && n.children.length) {
                    const childWrap = document.createElement('div'); childWrap.className = 'navigator-children';
                    if (!expanded.has(n.id)) { childWrap.classList.add('hidden'); }
                    renderChildList(n.children, childWrap, [...pathSoFar, n], term);
                    li.appendChild(childWrap);
                }

                ul.appendChild(li);
            });
            container.appendChild(ul);
        };

        // helper to render child lists (keeps recursion clean)
        const renderChildList = (children, wrapper, pathSoFar, term) => {
            wrapper.innerHTML = '';
            const innerUl = document.createElement('ul'); innerUl.className = 'navigator-ul';
            children.forEach(ch => {
                if (!matchesTerm(ch, term)) return;
                const li = document.createElement('li'); li.className = 'navigator-li';
                const row = document.createElement('div'); row.className = 'navigator-row';
                const left = document.createElement('div'); left.className = 'navigator-left';
                left.style.display = 'flex'; left.style.alignItems = 'center';
                if (ch.type === 'container' && ch.children && ch.children.length) {
                    const toggle = document.createElement('button'); toggle.className = 'navigator-toggle';
                    toggle.textContent = expanded.has(ch.id) ? '▾' : '▸';
                    toggle.addEventListener('click', (ev) => { ev.stopPropagation(); if (expanded.has(ch.id)) expanded.delete(ch.id); else expanded.add(ch.id); try { localStorage.setItem('morada.navigator.expanded', JSON.stringify(Array.from(expanded))); } catch (e) {} renderTree(root, treeContainer, [], searchInput.value.trim().toLowerCase()); });
                    left.appendChild(toggle);
                    const title = document.createElement('span'); title.className = 'navigator-title'; title.textContent = ch.title || '(untitled)';
                    left.appendChild(title);
                    const count = document.createElement('span'); count.className = 'navigator-count'; count.textContent = ` (${ch.children.length})`;
                    left.appendChild(count);
                } else {
                    const spacer = document.createElement('span'); spacer.style.display = 'inline-block'; spacer.style.width = '20px'; left.appendChild(spacer);
                    const title = document.createElement('span'); title.className = 'navigator-title'; title.textContent = ch.title || '(untitled)'; left.appendChild(title);
                }
                row.appendChild(left);
                const right = document.createElement('div'); right.className = 'navigator-right';
                const openBtn = document.createElement('button'); openBtn.className = 'navigator-open-btn'; openBtn.textContent = 'Open';
                openBtn.addEventListener('click', (ev) => { ev.stopPropagation(); const newPath = [...pathSoFar, ch]; try { if (typeof this.navigateToNodeFunction === 'function') this.navigateToNodeFunction(newPath, ch.id); } catch (err) {} try { const found = window.MyProjectNodeManager && typeof window.MyProjectNodeManager.findNodeByIdPath === 'function' ? window.MyProjectNodeManager.findNodeByIdPath(ch.id, this.stateManager.getRootNodes()) : null; if (found && found.type === 'text' && window.MyProjectEditorManager && typeof window.MyProjectEditorManager.openEditorMode === 'function') window.MyProjectEditorManager.openEditorMode(found); } catch (err) {} modal.classList.add('hidden'); });
                right.appendChild(openBtn);
                row.appendChild(right);
                row.addEventListener('click', () => { const newPath = [...pathSoFar, ch]; try { if (typeof this.navigateToNodeFunction === 'function') this.navigateToNodeFunction(newPath, ch.id); } catch (err) {} try { const found = window.MyProjectNodeManager && typeof window.MyProjectNodeManager.findNodeByIdPath === 'function' ? window.MyProjectNodeManager.findNodeByIdPath(ch.id, this.stateManager.getRootNodes()) : null; if (found && found.type === 'text' && window.MyProjectEditorManager && typeof window.MyProjectEditorManager.openEditorMode === 'function') window.MyProjectEditorManager.openEditorMode(found); } catch (err) {} modal.classList.add('hidden'); });
                li.appendChild(row);
                if (ch.children && ch.children.length) {
                    const gw = document.createElement('div'); gw.className = 'navigator-children'; if (!expanded.has(ch.id)) gw.classList.add('hidden'); renderChildList(ch.children, gw, [...pathSoFar, ch], term); li.appendChild(gw);
                }
                innerUl.appendChild(li);
            });
            wrapper.appendChild(innerUl);
        };

        // initial render
        renderTree(root, treeContainer, [], '');

        // wire search (debounced)
        const debouncedNavSearch = self._debounce(() => {
            const term = searchInput.value.trim().toLowerCase();
            // auto-expand all when searching
            if (term) {
                const walkExpand = (nodes) => { nodes.forEach(n => { if (matchesTerm(n, term)) { expanded.add(n.id); } if (n.children && n.children.length) walkExpand(n.children); }); };
                walkExpand(root);
            }
            renderTree(root, treeContainer, [], term);
        }, 220);
        searchInput.addEventListener('input', debouncedNavSearch);

        body.appendChild(treeContainer);

        const footer = document.createElement('div'); footer.className = 'modal-footer';
        const closeBtn = document.createElement('button'); closeBtn.textContent = 'Close'; footer.appendChild(closeBtn);

        content.appendChild(header); content.appendChild(body); content.appendChild(footer);
        modal.appendChild(content); document.body.appendChild(modal);

        const hide = () => modal.classList.add('hidden');
        closeX.addEventListener('click', hide); closeBtn.addEventListener('click', hide);
        modal.addEventListener('click', (ev) => { if (ev.target === modal) hide(); });
        try { this._attachModalBehavior(modal, { close: hide }); } catch (err) { console.warn('attach modal for navigator failed', err); }
    },

    /**
     * Creates a small floating toolbar with debug actions: Open, Delete, New Text, New Container.
     * These call into the application's managers and persist changes.
     */
    _createDebugToolbar: function() {
        try {
            const toolbar = document.createElement('div');
            toolbar.id = 'debug-toolbar';
            Object.assign(toolbar.style, {
                position: 'fixed',
                left: '12px',
                bottom: '12px',
                background: 'rgba(255,255,255,0.95)',
                border: '1px solid #ccc',
                padding: '6px',
                borderRadius: '6px',
                zIndex: 99999,
                display: 'flex',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
            });

            const makeBtn = (text, handler) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.textContent = text;
                b.addEventListener('click', handler);
                return b;
            };

            const openBtn = makeBtn('Open', () => {
                const sel = this.stateManager.getSelectedNode();
                if (!sel) return alert('No node selected');
                if (typeof window.MyProjectEditorManager?.openEditorMode === 'function') {
                    window.MyProjectEditorManager.openEditorMode(sel);
                }
            });

            const delBtn = makeBtn('Delete', () => {
                const sel = this.stateManager.getSelectedNode();
                if (!sel) return alert('No node selected');
                // use centralized confirm + undo
                try { this.confirmAndDeleteNode(sel); } catch (err) { console.warn('confirmDelete failed', err); }
            });

            const newTextBtn = makeBtn('New Text', () => {
                // Prevent creating text/scriptorium nodes on the main floor (root view).
                const viewStack = this.stateManager.getViewStack();
                if (!viewStack || viewStack.length === 0) {
                    const createContainer = confirm('Scriptoria (text editors) cannot be created on the main floor. Create a new Project container here instead?');
                    if (!createContainer) return;
                    // fall through to create container
                    const idc = 'node-' + Date.now() + '-' + Math.floor(Math.random()*10000);
                    const centerXc = (this.canvas ? (this.canvas.width/2) : 0);
                    const centerYc = (this.canvas ? (this.canvas.height/2) : 0);
                    const newContainer = window.MyProjectNodeManager.createNode(centerXc, centerYc, false, idc);
                    const currentC = this.stateManager.getCurrentNodes();
                    currentC.push(newContainer);
                    this.stateManager.setCurrentNodes(currentC);
                    this.stateManager.setSelectedNode(newContainer);
                    if (this.saveNodesFunction) this.saveNodesFunction();
                    if (this.drawFunction) this.drawFunction();
                    if (typeof this.fitNodesToView === 'function' && this._autoFit) this.fitNodesToView();
                    return;
                }
                const id = 'node-' + Date.now() + '-' + Math.floor(Math.random()*10000);
                const centerX = (this.canvas ? (this.canvas.width/2) : 0);
                const centerY = (this.canvas ? (this.canvas.height/2) : 0);
                const newNode = window.MyProjectNodeManager.createNode(centerX, centerY, true, id);
                const current = this.stateManager.getCurrentNodes();
                current.push(newNode);
                this.stateManager.setCurrentNodes(current);
                this.stateManager.setSelectedNode(newNode);
                if (this.saveNodesFunction) this.saveNodesFunction();
                if (this.drawFunction) this.drawFunction();
                if (typeof this.fitNodesToView === 'function' && this._autoFit) this.fitNodesToView();
            });

            const newContainerBtn = makeBtn('New Container', () => {
                const id = 'node-' + Date.now() + '-' + Math.floor(Math.random()*10000);
                const centerX = (this.canvas ? (this.canvas.width/2) : 0);
                const centerY = (this.canvas ? (this.canvas.height/2) : 0);
                const newNode = window.MyProjectNodeManager.createNode(centerX, centerY, false, id);
                const current = this.stateManager.getCurrentNodes();
                current.push(newNode);
                this.stateManager.setCurrentNodes(current);
                this.stateManager.setSelectedNode(newNode);
                if (this.saveNodesFunction) this.saveNodesFunction();
                if (this.drawFunction) this.drawFunction();
                if (typeof this.fitNodesToView === 'function' && this._autoFit) this.fitNodesToView();
            });

            toolbar.appendChild(openBtn);
            toolbar.appendChild(delBtn);
            toolbar.appendChild(newTextBtn);
            toolbar.appendChild(newContainerBtn);

            document.body.appendChild(toolbar);
        } catch (err) {
            console.error('Failed to create debug toolbar', err);
        }
    },

    /**
     * Confirm and delete a node with a short undo window.
     * Shows a confirm() prompt, deletes the node, then displays an undo toast for 10s.
     */
    confirmAndDeleteNode: function(node) {
        if (!node) return;
        const confirmed = confirm(`Delete "${node.title || '(untitled)'}"? You can undo for a short time.`);
        if (!confirmed) return;
        // find parent list and index
        const current = this.stateManager.getCurrentNodes() || [];
        const idx = current.findIndex(n => n.id === node.id);
        const parentList = current;
        // perform deletion via NodeManager to keep behavior consistent
        const newNodes = window.MyProjectNodeManager.deleteNode(node.id, current);
        if (this.stateManager.getViewStack().length > 0) {
            const top = this.stateManager.getViewStack()[this.stateManager.getViewStack().length - 1];
            top.children = newNodes;
        } else {
            this.stateManager.setRootNodes(newNodes);
        }
        this.stateManager.setCurrentNodes(newNodes);
        this.stateManager.setSelectedNode(null);
        if (this.saveNodesFunction) this.saveNodesFunction();
        if (this.drawFunction) this.drawFunction();
        if (typeof this.fitNodesToView === 'function' && this._autoFit) this.fitNodesToView();

        // store for undo
        this._lastDeleted = { node: node, parentList: parentList, index: idx };
        const undoFn = () => {
            try {
                // restore into parentList at index if possible
                const targetList = (this.stateManager.getViewStack().length > 0) ? this.stateManager.getViewStack()[this.stateManager.getViewStack().length - 1].children : this.stateManager.getRootNodes();
                const insertAt = Math.min(Math.max(0, this._lastDeleted.index), targetList.length);
                targetList.splice(insertAt, 0, this._lastDeleted.node);
                if (this.stateManager.getViewStack().length === 0) this.stateManager.setRootNodes(targetList);
                this.stateManager.setCurrentNodes(targetList);
                this.stateManager.setSelectedNode(this._lastDeleted.node);
                if (this.saveNodesFunction) this.saveNodesFunction();
                if (this.drawFunction) this.drawFunction();
            } catch (err) { console.warn('undo restore failed', err); }
            this._lastDeleted = null;
        };

        this._showUndoToast(`Deleted "${node.title || '(untitled)'}"`, undoFn, 10000);
    },

    _showUndoToast: function(message, undoFn, ttl = 10000) {
        try {
            // remove existing toast
            const existing = document.getElementById('undo-toast'); if (existing) existing.remove();
            const toast = document.createElement('div'); toast.id = 'undo-toast'; toast.className = 'undo-toast';
            toast.style.position = 'fixed'; toast.style.right = '16px'; toast.style.bottom = '16px'; toast.style.background = 'rgba(0,0,0,0.85)'; toast.style.color = '#fff'; toast.style.padding = '10px 12px'; toast.style.borderRadius = '6px'; toast.style.zIndex = 100000;
            const text = document.createElement('span'); text.textContent = message; text.style.marginRight = '12px';
            const undoBtn = document.createElement('button'); undoBtn.textContent = 'Undo'; undoBtn.style.marginLeft = '6px';
            undoBtn.addEventListener('click', () => { try { undoFn(); } catch (e) { console.warn('undoFn failed', e); } if (toast.parentNode) toast.parentNode.removeChild(toast); });
            toast.appendChild(text); toast.appendChild(undoBtn);
            document.body.appendChild(toast);
            // auto-dismiss after ttl
            setTimeout(() => { try { if (toast.parentNode) toast.parentNode.removeChild(toast); this._lastDeleted = null; } catch (e) {} }, ttl);
        } catch (e) { console.warn('showUndoToast failed', e); }
    },

    /**
     * Small debounce helper.
     * Returns a debounced function that delays invoking fn until wait ms have elapsed
     * since the last call.
     */
    _debounce: function(fn, wait) {
        let timeout = null;
        return function(...args) {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => { timeout = null; try { fn.apply(this, args); } catch (e) { console.warn('debounced fn failed', e); } }, wait);
        };
    },

    /**
     * Build a simple in-memory search index for nodes to accelerate title/content/tag lookups.
     * This creates `this._searchIndex` mapping node.id -> lowercased searchable text.
     */
    _buildSearchIndex: function() {
        try {
            this._searchIndex = Object.create(null);
            const walk = (nodes) => {
                (nodes || []).forEach(n => {
                    try {
                        const parts = [];
                        if (n.title) parts.push(n.title);
                        if (Array.isArray(n.tags)) parts.push(n.tags.join(' '));
                        if (n.content) parts.push(this.getPlainText(n.content));
                        this._searchIndex[n.id] = parts.join(' ').toLowerCase();
                        if (n.children && n.children.length) walk(n.children);
                    } catch (e) { /* ignore per-node errors */ }
                });
            };
            walk(this.stateManager.getRootNodes() || []);
        } catch (e) { console.warn('buildSearchIndex failed', e); }
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
        if (this.breadcrumbPath) {
            this.breadcrumbPath.textContent = path;
        } else {
            // fallback: set textContent of container but preserve buttons
            this.breadcrumbBar.textContent = path;
        }
        // Toggle Back button visibility
        try {
            if (this.breadcrumbBackBtn) {
                if (viewStack.length > 0) this.breadcrumbBackBtn.classList.remove('hidden'); else this.breadcrumbBackBtn.classList.add('hidden');
            }
        } catch (err) { /* ignore */ }
        this.viewTitle.textContent = viewStack.length === 0 ? 'The Castle Grounds' : viewStack[viewStack.length - 1].title;
    },

    getWordCount: function(content) {
        if (!content) return 0;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const text = tempDiv.textContent || tempDiv.innerText || '';
        return text.trim() ? text.trim().split(/\s+/).length : 0;
    },

    /**
     * Return plain text stripped from HTML for a node's content.
     */
    getPlainText: function(content) {
        if (!content) return '';
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        return (tempDiv.textContent || tempDiv.innerText || '').trim();
    },

    updateEditorWordCount: function(content) {
        if (this.editorWordCount) {
            const wordCount = this.getWordCount(content);
            this.editorWordCount.textContent = `Words: ${wordCount}`;
            // Update word goal UI
            if (this.wordGoalCurrent) {
                this.wordGoalCurrent.textContent = String(wordCount);
            }
            if (this.wordGoalInput) {
                const goal = parseInt(this.wordGoalInput.value, 10) || 0;
                if (goal > 0 && wordCount >= goal) {
                    if (this.wordGoalCurrent) this.wordGoalCurrent.classList.add('goal-met');
                } else {
                    if (this.wordGoalCurrent) this.wordGoalCurrent.classList.remove('goal-met');
                }
            }
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

    /* Comment modal control API */
    openCommentModal: function(spanId, selectedText) {
        const node = this.stateManager.getSelectedNode();
        if (!node) return;
        this._pendingComment = { spanId: spanId, nodeId: node.id };
        if (this.commentSelectedText) this.commentSelectedText.textContent = selectedText || '';
        if (this.commentTextarea) {
            const existing = (node.comments || []).find(c => c.id === spanId || c.spanId === spanId);
            this.commentTextarea.value = existing ? existing.text : '';
        }
        if (this.commentModal) {
            this.commentModal.classList.remove('hidden');
            // trap focus + Escape to close
            try { this._attachModalBehavior(this.commentModal, { close: () => this.closeCommentModal() }); } catch (err) { console.warn(err); }
        }
    },

    closeCommentModal: function() {
        if (this.commentModal) {
            this.commentModal.classList.add('hidden');
            try { if (this.commentModal._detachModalBehavior) this.commentModal._detachModalBehavior(); } catch (e) {}
        }
        this._pendingComment = null;
        if (this.commentTextarea) this.commentTextarea.value = '';
        if (this.commentSelectedText) this.commentSelectedText.textContent = '';
    },

    _savePendingComment: function() {
        try {
            if (!this._pendingComment) return;
            const node = this.stateManager.getSelectedNode();
            if (!node) return;
            const txt = this.commentTextarea ? this.commentTextarea.value.trim() : '';
            const commentObj = { id: this._pendingComment.spanId, spanId: this._pendingComment.spanId, text: txt, createdAt: Date.now() };
            if (!Array.isArray(node.comments)) node.comments = [];
            // replace existing or push
            const idx = node.comments.findIndex(c => c.id === commentObj.id || c.spanId === commentObj.spanId);
            if (idx > -1) node.comments[idx] = commentObj; else node.comments.push(commentObj);
            if (this.saveNodesFunction) this.saveNodesFunction(this.stateManager.getRootNodes());
            // Refresh footnotes UI and editor content if open
            try {
                this.renderFootnotes(node);
                if (window.MyProjectEditorManager && window.MyProjectEditorManager.tinymceEditor) {
                    window.MyProjectEditorManager.tinymceEditor.setContent(node.content || '');
                }
            } catch (err) { console.warn('post-save comment refresh failed', err); }
        } catch (err) {
            console.error('Error saving comment', err);
        } finally {
            this.closeCommentModal();
        }
    },

    _deletePendingComment: function() {
        try {
            if (!this._pendingComment) return;
            const node = this.stateManager.getSelectedNode();
            if (!node) return;
            node.comments = (node.comments || []).filter(c => c.id !== this._pendingComment.spanId && c.spanId !== this._pendingComment.spanId);
            // also strip the span from node.content if present
            if (node.content) {
                const re = new RegExp(`<span[^>]*id="${this._pendingComment.spanId}"[^>]*>([\s\S]*?)<\\/span>`, 'g');
                node.content = node.content.replace(re, '$1');
            }
            if (this.saveNodesFunction) this.saveNodesFunction(this.stateManager.getRootNodes());
            // Refresh footnotes UI and editor content if open
            try {
                this.renderFootnotes(node);
                if (window.MyProjectEditorManager && window.MyProjectEditorManager.tinymceEditor) {
                    window.MyProjectEditorManager.tinymceEditor.setContent(node.content || '');
                }
            } catch (err) { console.warn('post-save certify refresh failed', err); }
        } catch (err) {
            console.error('Error deleting comment', err);
        } finally {
            this.closeCommentModal();
        }
    },

    /* Certify modal control API */
    openCertifyModal: function(spanId, word) {
        const node = this.stateManager.getSelectedNode();
        if (!node) return;
        this._pendingCertify = { spanId: spanId, nodeId: node.id, word: word };
        if (this.certifySelectedWord) this.certifySelectedWord.textContent = word || '';
        // if existing certified word present, pre-fill
        if (this.certifyDefinitionInput) {
            const existing = (node.certifiedWords || []).find(cw => cw.spanId === spanId);
            this.certifyDefinitionInput.value = existing ? existing.definition || '' : '';
        }
        if (this.certifyWordModal) {
            this.certifyWordModal.classList.remove('hidden');
            try { this._attachModalBehavior(this.certifyWordModal, { close: () => this.closeCertifyModal() }); } catch (err) { console.warn(err); }
        }
    },

    closeCertifyModal: function() {
        if (this.certifyWordModal) {
            this.certifyWordModal.classList.add('hidden');
            try { if (this.certifyWordModal._detachModalBehavior) this.certifyWordModal._detachModalBehavior(); } catch (e) {}
        }
        this._pendingCertify = null;
        if (this.certifyDefinitionInput) this.certifyDefinitionInput.value = '';
        if (this.certifySelectedWord) this.certifySelectedWord.textContent = '';
    },

    _savePendingCertification: function() {
        try {
            if (!this._pendingCertify) return;
            const node = this.stateManager.getSelectedNode();
            if (!node) return;
            const def = this.certifyDefinitionInput ? this.certifyDefinitionInput.value.trim() : '';
            const cwObj = { spanId: this._pendingCertify.spanId, word: this._pendingCertify.word, definition: def, createdAt: Date.now() };
            if (!Array.isArray(node.certifiedWords)) node.certifiedWords = [];
            const idx = node.certifiedWords.findIndex(cw => cw.spanId === cwObj.spanId);
            if (idx > -1) node.certifiedWords[idx] = cwObj; else node.certifiedWords.push(cwObj);

            // update the inline span to include data-definition attribute
            if (node.content) {
                const re = new RegExp(`(<span[^>]*id=\\"${this._pendingCertify.spanId}\\"[^>]*class=\\"[^\\"]*certified-word[^\\"]*\\"[^>]*)(>)`);
                node.content = node.content.replace(re, `$1 data-definition="${def.replace(/\"/g, '&quot;')}"$2`);
            }

            if (this.saveNodesFunction) this.saveNodesFunction(this.stateManager.getRootNodes());
        } catch (err) {
            console.error('Error saving certification', err);
        } finally {
            this.closeCertifyModal();
        }
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
            // prefer indexed search if available
            try {
                if (isTagSearch) {
                    if (node.tags && node.tags.some(tag => tag.toLowerCase().includes(searchTerm))) isMatch = true;
                } else if (this._searchIndex && this._searchIndex[node.id]) {
                    if (this._searchIndex[node.id].includes(searchTerm)) isMatch = true;
                } else {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = node.content;
                    const plainTextContent = tempDiv.textContent || tempDiv.innerText || '';
                    if (node.title.toLowerCase().includes(searchTerm) || plainTextContent.toLowerCase().includes(searchTerm)) isMatch = true;
                }
            } catch (e) {
                // fallback
                try {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = node.content;
                    const plainTextContent = tempDiv.textContent || tempDiv.innerText || '';
                    if (node.title.toLowerCase().includes(searchTerm) || plainTextContent.toLowerCase().includes(searchTerm)) isMatch = true;
                } catch (err) {}
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
        try { this._attachModalBehavior(this.compendiumModal, { close: () => this.closeCompendium() }); } catch (err) { console.warn(err); }
    },

    closeCompendium: function() {
        if (!this.compendiumModal) return;
        this.compendiumModal.classList.add('hidden');
        try { if (this.compendiumModal._detachModalBehavior) this.compendiumModal._detachModalBehavior(); } catch (e) {}
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

    /**
     * Export a CSV of all tags found across nodes. Columns: tag, nodeId, nodeTitle
     */
    exportTagsCSV: function() {
        const nodes = this.stateManager.getRootNodes() || [];
        const rows = [['tag','nodeId','nodeTitle']];
        function walk(nlist) {
            nlist.forEach(n => {
                if (Array.isArray(n.tags)) {
                    n.tags.forEach(t => rows.push([t, n.id, n.title.replace(/\"/g, '"')]));
                }
                if (n.children && n.children.length) walk(n.children);
            });
        }
        walk(nodes);
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'morada-tags.csv'; a.click();
        URL.revokeObjectURL(url);
    },

    /**
     * Show a modal listing tags per node and provide copy/download actions.
     * This builds a lightweight modal dynamically so we don't require static DOM markup.
     */
    showAllTagsPanel: function() {
        // If modal already exists, just show it
        let modal = document.getElementById('tags-modal');
        if (modal) { modal.classList.remove('hidden'); return; }

        const nodes = this.stateManager.getRootNodes() || [];
        const rows = [];
        function walk(nlist) {
            nlist.forEach(n => {
                if (Array.isArray(n.tags) && n.tags.length) {
                    rows.push({ nodeId: n.id, title: n.title, tags: Array.from(n.tags) });
                }
                if (n.children && n.children.length) walk(n.children);
            });
        }
        walk(nodes);

        modal = document.createElement('div');
        modal.id = 'tags-modal';
        modal.className = 'modal';

        const content = document.createElement('div');
        content.className = 'modal-content';

        const header = document.createElement('div');
        header.className = 'modal-header';
        const h = document.createElement('h3'); h.textContent = 'Tags Overview';
        const closeX = document.createElement('span'); closeX.className = 'close-button'; closeX.textContent = '×';
        header.appendChild(h); header.appendChild(closeX);

        const body = document.createElement('div'); body.className = 'modal-body';

        const instructions = document.createElement('div');
        instructions.style.marginBottom = '8px';
        instructions.textContent = 'List of nodes that have tags. Use Copy CSV to copy a CSV to clipboard or Download CSV to save a file.';
        body.appendChild(instructions);

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        const thead = document.createElement('thead');
        thead.innerHTML = '<tr><th style="text-align:left;padding:6px;border-bottom:1px solid #ccc;">Node ID</th><th style="text-align:left;padding:6px;border-bottom:1px solid #ccc;">Title</th><th style="text-align:left;padding:6px;border-bottom:1px solid #ccc;">Tags</th></tr>';
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        rows.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td style="padding:6px;border-bottom:1px solid #eee;">${r.nodeId}</td><td style="padding:6px;border-bottom:1px solid #eee;">${r.title}</td><td style="padding:6px;border-bottom:1px solid #eee;">${r.tags.map(t => `<span class=\"tag-pill\">${t}</span>`).join(' ')}</td>`;
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        body.appendChild(table);

        const footer = document.createElement('div'); footer.className = 'modal-footer';
        const copyBtn = document.createElement('button'); copyBtn.textContent = 'Copy CSV';
        const downloadBtn = document.createElement('button'); downloadBtn.textContent = 'Download CSV';
        const closeBtn = document.createElement('button'); closeBtn.textContent = 'Close';
        footer.appendChild(copyBtn); footer.appendChild(downloadBtn); footer.appendChild(closeBtn);

        content.appendChild(header); content.appendChild(body); content.appendChild(footer);
        modal.appendChild(content);
        document.body.appendChild(modal);

        const buildCSV = () => {
            const rowsCsv = [['tag','nodeId','nodeTitle']];
            rows.forEach(r => {
                r.tags.forEach(t => rowsCsv.push([t, r.nodeId, r.title]));
            });
            return rowsCsv.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
        };

        copyBtn.addEventListener('click', async () => {
            const csv = buildCSV();
            try {
                await navigator.clipboard.writeText(csv);
                copyBtn.textContent = 'Copied!';
                setTimeout(() => copyBtn.textContent = 'Copy CSV', 1500);
            } catch (err) {
                console.warn('clipboard write failed', err);
                alert('Copy failed. You can still Download CSV.');
            }
        });

        downloadBtn.addEventListener('click', () => {
            const csv = buildCSV();
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'morada-tags.csv'; a.click(); URL.revokeObjectURL(url);
        });

        const hideModal = () => { modal.classList.add('hidden'); };
        closeX.addEventListener('click', hideModal);
        closeBtn.addEventListener('click', hideModal);
        modal.addEventListener('click', (ev) => { if (ev.target === modal) hideModal(); });
        try { this._attachModalBehavior(modal, { close: hideModal }); } catch (err) { console.warn('attach modal for tags failed', err); }
    },

    /**
     * Render comments and certified words for the currently selected node into the footnotes pane.
     * @param {Object} node
     */
    renderFootnotes: function(node) {
        const container = document.getElementById('footnotes-list');
        if (!container) return;
        container.innerHTML = '';
        if (!node) return;

        // Comments
        if (Array.isArray(node.comments) && node.comments.length > 0) {
            const h = document.createElement('h5'); h.textContent = 'Comments'; container.appendChild(h);
            node.comments.forEach(c => {
                const div = document.createElement('div');
                div.className = 'footnote-item comment-item';
                div.dataset.commentId = c.id || c.spanId || '';
                div.textContent = c.text || '';
                // clicking a footnote opens the editor and focuses the inline span
                div.addEventListener('click', async () => {
                    if (window.MyProjectEditorManager && typeof window.MyProjectEditorManager.openEditorMode === 'function') {
                        const selectedNode = this.stateManager.getSelectedNode();
                        if (selectedNode && selectedNode.id === node.id) {
                            window.MyProjectEditorManager.openEditorMode(selectedNode);
                            // allow editor to initialize content, then focus span
                            setTimeout(() => {
                                try {
                                    const spanId = div.dataset.commentId;
                                    if (spanId && window.MyProjectEditorManager && typeof window.MyProjectEditorManager.focusSpan === 'function') {
                                        window.MyProjectEditorManager.focusSpan(spanId);
                                    }
                                } catch (err) { console.warn('jump to comment span failed', err); }
                            }, 150);
                        }
                    }
                });
                container.appendChild(div);
            });
        }

        // Certified words
        if (Array.isArray(node.certifiedWords) && node.certifiedWords.length > 0) {
            const h2 = document.createElement('h5'); h2.textContent = 'Certified Words'; container.appendChild(h2);
            node.certifiedWords.forEach(cw => {
                const div = document.createElement('div');
                div.className = 'footnote-item certified-item';
                div.dataset.spanId = cw.spanId || '';
                div.innerHTML = `<strong>${cw.word}</strong>: ${cw.definition || ''}`;
                div.addEventListener('click', () => {
                    if (window.MyProjectEditorManager && typeof window.MyProjectEditorManager.openEditorMode === 'function') {
                        const selectedNode = this.stateManager.getSelectedNode();
                        if (selectedNode && selectedNode.id === node.id) {
                            window.MyProjectEditorManager.openEditorMode(selectedNode);
                            setTimeout(() => {
                                try {
                                    const spanId = div.dataset.spanId;
                                    if (spanId && window.MyProjectEditorManager && typeof window.MyProjectEditorManager.focusSpan === 'function') {
                                        window.MyProjectEditorManager.focusSpan(spanId);
                                    }
                                } catch (err) { console.warn('jump to certified span failed', err); }
                            }, 150);
                        }
                    }
                });
                container.appendChild(div);
            });
        }
    },

    /**
     * Show the node inspector as a large, node-styled panel that fills most of the screen
     * and places the information inside the node visual (title, stats, search, and list of scriptoriums).
     * @param {Object} node
     */
    showNodeInspector: function(node) {
        try {
            // remove existing modal
            const prevModal = document.getElementById('node-inspector-modal'); if (prevModal) prevModal.remove();
            if (!node) return;

            // Build modal (full-screen but styled like an expanded node)
            const modal = document.createElement('div');
            modal.id = 'node-inspector-modal';
            modal.className = 'modal node-inspector-modal';

            const panel = document.createElement('div');
            panel.className = 'node-inspector-panel';
            // header
            const header = document.createElement('div'); header.className = 'node-inspector-panel-header';
            const title = document.createElement('h2'); title.className = 'node-inspector-panel-title'; title.textContent = node.title || '(untitled)';
            const closeBtn = document.createElement('button'); closeBtn.className = 'node-inspector-close'; closeBtn.textContent = 'Close';
            try { closeBtn.setAttribute('aria-label', 'Close inspector'); } catch (e) {}
            header.appendChild(title); header.appendChild(closeBtn);
            panel.appendChild(header);

            // stats + search row
            const metaRow = document.createElement('div'); metaRow.className = 'node-inspector-meta';
            const statsDiv = document.createElement('div'); statsDiv.className = 'node-inspector-stats';
            const searchDiv = document.createElement('div'); searchDiv.className = 'node-inspector-searchwrap';
            const searchInput = document.createElement('input'); searchInput.type = 'search'; searchInput.placeholder = 'Search scriptoriums by title...'; searchInput.className = 'node-inspector-search';
            try { searchInput.setAttribute('aria-label', 'Search scriptoriums by title, content, or tags'); } catch (e) {}
            searchDiv.appendChild(searchInput);
            metaRow.appendChild(statsDiv); metaRow.appendChild(searchDiv);
            panel.appendChild(metaRow);

            // list container
            const list = document.createElement('div'); list.className = 'node-inspector-list';

            // gather scriptoriums
            const children = (node.children || []).filter(c => c && c.type === 'text');
            const totalScriptoria = children.length;
            let totalWords = 0, totalComments = 0, totalCertified = 0;
            children.forEach(c => { totalWords += this.getWordCount(c.content); totalComments += (c.comments||[]).length; totalCertified += (c.certifiedWords||[]).length; });
            statsDiv.innerHTML = `<div class="stats-item">Scriptoria: ${totalScriptoria}</div><div class="stats-item">Words: ${totalWords}</div><div class="stats-item">Comments: ${totalComments}</div><div class="stats-item">Certified: ${totalCertified}</div>`;

            // populate list
            children.forEach(c => {
                const row = document.createElement('div'); row.className = 'node-inspector-list-row';
                row.innerHTML = `<div class="row-left"><div class="row-title">${c.title || '(untitled)'}</div><div class="row-sub">Words: ${this.getWordCount(c.content)} • C:${(c.comments||[]).length} • Cert:${(c.certifiedWords||[]).length}</div></div>`;
                const openBtn = document.createElement('button'); openBtn.className = 'row-open-btn'; openBtn.textContent = 'Open';
                openBtn.addEventListener('click', (ev) => { ev.stopPropagation(); try { window.MyProjectEditorManager.openEditorMode(c); } catch (err) { console.warn(err); } });
                row.appendChild(openBtn);
                list.appendChild(row);
            });

            panel.appendChild(list);
            // For a nicer spatial transition, start the panel scaled down at the node's screen
            // position and then scale it up to full size.
            try {
                const rect = this.canvas.getBoundingClientRect();
                const scale = this.stateManager.getScale();
                const offsetX = this.stateManager.getOffsetX();
                const offsetY = this.stateManager.getOffsetY();
                const canvasX = rect.left + window.scrollX;
                const canvasY = rect.top + window.scrollY;
                const screenX = (node.x - offsetX) * scale + this.canvas.width / 2 + canvasX;
                const screenY = (node.y - offsetY) * scale + this.canvas.height / 2 + canvasY;
                // Set transform origin so the panel appears to grow from the node center
                panel.style.transformOrigin = `${(screenX / window.innerWidth) * 100}% ${(screenY / window.innerHeight) * 100}%`;
                panel.style.transform = 'scale(0.18)';
                panel.style.transition = 'transform 320ms cubic-bezier(0.2,0.9,0.2,1)';
            } catch (e) { console.warn('inspector animation prep failed', e); }

            modal.appendChild(panel);
            document.body.appendChild(modal);

            // Trigger the grow animation
            requestAnimationFrame(() => {
                try { panel.style.transform = 'scale(1)'; } catch (e) {}
            });

            // wire close
            const hide = () => {
                try {
                    // animate shrink then remove
                    panel.style.transform = 'scale(0.18)';
                    const onEnd = (ev) => {
                        try { if (modal && modal.parentNode) modal.parentNode.removeChild(modal); } catch (e) {}
                        try { if (modal && modal._detachModalBehavior) modal._detachModalBehavior(); } catch (e) {}
                        panel.removeEventListener('transitionend', onEnd);
                    };
                    panel.addEventListener('transitionend', onEnd);
                    // fallback remove after 400ms
                    setTimeout(() => { try { if (modal && modal.parentNode) modal.parentNode.removeChild(modal); } catch (e) {} }, 420);
                } catch (e) { try { if (modal && modal.parentNode) modal.parentNode.removeChild(modal); } catch (err) {} }
            };
            closeBtn.addEventListener('click', hide);
            modal.addEventListener('click', (ev) => { if (ev.target === modal) hide(); });
            try { this._attachModalBehavior(modal, { close: hide }); } catch (err) { console.warn('attach modal behavior failed', err); }

            // search filtering (debounced)
            const debouncedInspectorSearch = this._debounce((ev) => {
                const term = (ev.target.value || '').trim().toLowerCase();
                Array.from(list.children).forEach(r => {
                    const titleText = (r.querySelector('.row-title')?.textContent || '').toLowerCase();
                    const rowTitleMatches = titleText.includes(term);
                    const rowSub = (r.querySelector('.row-sub')?.textContent || '').toLowerCase();
                    const rowSubMatches = rowSub.includes(term);
                    // try to find the node by title in stateManager to check tags/content
                    let nodeMatches = false;
                    try {
                        const nodeTitle = r.querySelector('.row-title')?.textContent || '';
                        const found = (children || []).find(c => (c.title || '') === nodeTitle);
                        if (found) {
                            const tags = (found.tags || []).join(' ').toLowerCase();
                            const plain = (this.getPlainText(found.content) || '').toLowerCase();
                            if ((tags && tags.includes(term)) || (plain && plain.includes(term))) nodeMatches = true;
                        }
                    } catch (e) {}
                    if (!term || rowTitleMatches || rowSubMatches || nodeMatches) r.style.display = '';
                    else r.style.display = 'none';
                });
            }, 200);
            searchInput.addEventListener('input', debouncedInspectorSearch);

        } catch (err) {
            console.warn('showNodeInspector modal error', err);
        }
    },

    _toggleTimer: function() {
        if (!this.timerDurationInput || !this.writingTimerDisplay) return;
        if (this._timerInterval) {
            // Stop
            clearInterval(this._timerInterval);
            this._timerInterval = null;
            this.timerStartBtn.textContent = 'Start Timer';
            this.writingTimerDisplay.classList.remove('timer-ended');
            return;
        }
        const minutes = parseInt(this.timerDurationInput.value, 10) || 0;
        this._timerRemaining = minutes * 60;
        const updateDisplay = () => {
            const mm = Math.floor(this._timerRemaining / 60).toString().padStart(2, '0');
            const ss = (this._timerRemaining % 60).toString().padStart(2, '0');
            this.writingTimerDisplay.textContent = `Time: ${mm}:${ss}`;
            if (this._timerRemaining <= 0) {
                clearInterval(this._timerInterval);
                this._timerInterval = null;
                this.timerStartBtn.textContent = 'Start Timer';
                this.writingTimerDisplay.classList.add('timer-ended');
                // Optionally notify
                try { new Notification('Timer finished', { body: 'Writing timer has ended.' }); } catch (e) {}
            }
            this._timerRemaining = Math.max(0, this._timerRemaining - 1);
        };
        updateDisplay();
        this.timerStartBtn.textContent = 'Stop Timer';
        this._timerInterval = setInterval(updateDisplay, 1000);
    },

    _showHoverTooltip: function(text, x, y) {
        const tip = document.getElementById('hover-tooltip');
        if (!tip) return;
        tip.textContent = text;
        tip.style.left = (x + 12) + 'px';
        tip.style.top = (y + 12) + 'px';
        tip.classList.remove('hidden');
    },

    _hideHoverTooltip: function() {
        const tip = document.getElementById('hover-tooltip');
        if (!tip) return;
        tip.classList.add('hidden');
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

// Fit and visibility helpers: keep nodes visible and optionally fit them to the viewport.
MyProjectUIManager.fitNodesToView = function(padding = 80) {
    try {
        const nodes = (this.stateManager && this.stateManager.getCurrentNodes && this.stateManager.getCurrentNodes()) || (this.stateManager.getRootNodes && this.stateManager.getRootNodes()) || [];
        if (!nodes || nodes.length === 0) return;
        // Compute bounding box in world coordinates
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(n => {
            const w = n.width || 200; const h = n.height || 120;
            minX = Math.min(minX, n.x - w/2);
            minY = Math.min(minY, n.y - h/2);
            maxX = Math.max(maxX, n.x + w/2);
            maxY = Math.max(maxY, n.y + h/2);
        });
        const bboxW = Math.max(1, maxX - minX);
        const bboxH = Math.max(1, maxY - minY);
        const canvasW = (this.canvas && this.canvas.width) || window.innerWidth;
        const canvasH = (this.canvas && this.canvas.height) || window.innerHeight;
        const scaleX = (canvasW - padding*2) / bboxW;
        const scaleY = (canvasH - padding*2) / bboxH;
        // choose the smaller scale so everything fits
        let newScale = Math.min(scaleX, scaleY);
        // clamp reasonable zoom range
        newScale = Math.max(0.2, Math.min(newScale, 2.5));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        if (this.stateManager && typeof this.stateManager.setScale === 'function') this.stateManager.setScale(newScale);
        if (this.stateManager && typeof this.stateManager.setOffsetX === 'function') this.stateManager.setOffsetX(centerX);
        if (this.stateManager && typeof this.stateManager.setOffsetY === 'function') this.stateManager.setOffsetY(centerY);
        if (typeof this.drawFunction === 'function') this.drawFunction();
    } catch (err) {
        console.warn('fitNodesToView failed', err);
    }
};

MyProjectUIManager.ensureNodeVisible = function(node, margin = 80) {
    try {
        if (!node) return;
        const scale = this.stateManager.getScale();
        const offsetX = this.stateManager.getOffsetX();
        const offsetY = this.stateManager.getOffsetY();
        const canvasW = (this.canvas && this.canvas.width) || window.innerWidth;
        const canvasH = (this.canvas && this.canvas.height) || window.innerHeight;
        let screenX = (node.x - offsetX) * scale + canvasW / 2;
        let screenY = (node.y - offsetY) * scale + canvasH / 2;
        let changed = false;
        let desiredScreenX = screenX;
        let desiredScreenY = screenY;
        if (screenX < margin) { desiredScreenX = margin; changed = true; }
        if (screenX > canvasW - margin) { desiredScreenX = canvasW - margin; changed = true; }
        if (screenY < margin) { desiredScreenY = margin; changed = true; }
        if (screenY > canvasH - margin) { desiredScreenY = canvasH - margin; changed = true; }
        if (!changed) return;
        // compute new offsets that would place node at desired screen position
        const newOffsetX = node.x - (desiredScreenX - canvasW/2) / scale;
    const newOffsetY = node.y - (desiredScreenY - canvasH/2) / scale;
        if (typeof this.stateManager.setOffsetX === 'function') this.stateManager.setOffsetX(newOffsetX);
        if (typeof this.stateManager.setOffsetY === 'function') this.stateManager.setOffsetY(newOffsetY);
        if (typeof this.drawFunction === 'function') this.drawFunction();
    } catch (err) {
        console.warn('ensureNodeVisible failed', err);
    }
};
