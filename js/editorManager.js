if (typeof window === 'undefined') {
    global.window = global;
}
// editorManager.js
// This module is responsible for managing the TinyMCE editor instance,
// its state (open/closed), and interactions related to editing node content.
console.log("editorManager.js loaded");

window.MyProjectEditorManager = {
    /** @type {tinymce.Editor|null} Holds the TinyMCE editor instance. */
    tinymceEditor: null,

    // --- Injected Dependencies (set via init) ---
    stateManager: null,
    uiManager: null,
    dataStorage: null,
    drawFunction: null,
    _craftDrawerInitialized: false,
    _strunkDebounceTimer: null,

    /**
     * Initializes the EditorManager and the TinyMCE editor instance.
     * @param {Object} config - Configuration object.
     * @param {Object} config.stateManager - The central state manager for the application.
     * @param {Object} config.uiManager - The UI manager for interacting with UI elements.
     * @param {Object} config.dataStorage - The data storage manager for persistence.
     * @param {Function} config.drawFunction - Callback to redraw the main canvas.
     */
    init: function(config) {
        this.stateManager = config.stateManager;
        this.uiManager = config.uiManager;
        this.dataStorage = config.dataStorage;
        this.drawFunction = config.drawFunction;

        // Initialize Craft Drawer controls
        this.initCraftDrawer();

        // Try to initialize TinyMCE, but don't let its absence break the app.
        this.tinyMCEAvailable = false;
        try {
            if (typeof tinymce !== 'undefined' && tinymce && typeof tinymce.init === 'function') {
                tinymce.init({
                    selector: '#main-editor', // From index.html
                    license_key: 'gpl',
                    base_url: 'node_modules/tinymce',
                    suffix: '.min',
                    plugins: 'lists link wordcount',
                    menu: {
                        file: { title: 'File', items: 'newdocument | preview | print | archive_item | saveclose_item' },
                        edit: { title: 'Edit', items: 'undo redo | cut copy paste | selectall' },
                        view: { title: 'View', items: 'fullview_item | visualaid visualchars visualblocks' },
                        insert: { title: 'Insert', items: 'link insert_maxim_item | hr' },
                        format: { title: 'Format', items: 'bold italic underline strikethrough superscript subscript | removeformat' },
                        craft: { title: 'Craft', items: 'craftdrawer_item | comment_item certify_item etymology_item | maxim_item insert_maxim_item' },
                        tools: { title: 'Tools', items: 'wordcount' }
                    },
                    menubar: 'file edit view insert format craft tools',
                    toolbar: 'undo redo | bold italic underline blockquote | bullist numlist | comment certify etymology | craftdrawer fullview | saveclose',
                    statusbar: true,
                    content_css: false,
                    content_style: `
                        body {
                            font-family: 'Vollkorn', Georgia, serif;
                            font-size: ${typeof AppConstants !== 'undefined' ? AppConstants.EDITOR_DEFAULT_FONT_SIZE : '18px'};
                            line-height: ${typeof AppConstants !== 'undefined' ? AppConstants.EDITOR_DEFAULT_LINE_HEIGHT : '1.7'};
                            background-color: ${typeof AppConstants !== 'undefined' ? AppConstants.EDITOR_BACKGROUND_COLOR : '#fdfaf4'};
                            color: #2c2523;
                            max-width: 820px;
                            margin: 0 auto;
                            padding: 2.5rem 3.5rem;
                            box-sizing: border-box;
                        }
                        .comment-highlight {
                            background-color: #fff275;
                            border-bottom: 2px solid #dab600;
                            border-radius: 2px;
                            padding: 1px 2px;
                            cursor: pointer;
                        }
                        .comment-highlight:hover {
                            background-color: #ffe600;
                        }
                        .certified-word {
                            background-color: #c7f9cc;
                            border-bottom: 2px solid #38b000;
                            border-radius: 2px;
                            padding: 1px 2px;
                            cursor: pointer;
                        }
                        .certified-word:hover {
                            background-color: #80ed99;
                        }
                        .strunk-passive {
                            border-bottom: 2px dotted #8b5cf6;
                            background-color: rgba(139, 92, 246, 0.12);
                            cursor: help;
                            border-radius: 2px;
                            padding: 0 1px;
                        }
                        .strunk-passive:hover {
                            background-color: rgba(139, 92, 246, 0.25);
                        }
                        .strunk-adverb {
                            border-bottom: 2px dashed #f59e0b;
                            background-color: rgba(245, 158, 11, 0.12);
                            cursor: help;
                            border-radius: 2px;
                            padding: 0 1px;
                        }
                        .strunk-adverb:hover {
                            background-color: rgba(245, 158, 11, 0.25);
                        }
                    `,
                    height: "100%",
                    width: "100%",
                    setup: (editor) => {
                        this.tinymceEditor = editor;
                        this.tinyMCEAvailable = true;

                        // Mark main content container as tinymce-active to hide redundant outer fallback toolbar
                        try {
                            const editorMain = document.getElementById('editor-main-content');
                            if (editorMain) editorMain.classList.add('tinymce-active');
                        } catch (e) {}

                        // Register custom Scholar's Desk icons
                        editor.ui.registry.addIcon('craft-quill', '<svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M3 21v-3l11-11 3 3L6 21H3Zm14.7-12.3-3-3L16.4 4a1.4 1.4 0 0 1 2 0l1.6 1.6a1.4 1.4 0 0 1 0 2l-2.3 2.1Z"/></svg>');
                        editor.ui.registry.addIcon('craft-book', '<svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M19 2H6a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h13a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1ZM6 4h12v12H6a1 1 0 0 1-1-.1V5a1 1 0 0 1 1-1Zm12 16H6a1 1 0 0 1 0-2h12v2Z"/></svg>');
                        editor.ui.registry.addIcon('craft-drawer', '<svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm0 6H5V5h14v4Zm-5 2v2h-4v-2h4Zm5 8H5v-4h4v1a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1h4v4Z"/></svg>');
                        editor.ui.registry.addIcon('craft-save', '<svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2ZM5 5v14h14V7.8L16.2 5H5Zm2 2h8v3H7V7Zm0 7h10v5H7v-5Z"/></svg>');
                        editor.ui.registry.addIcon('craft-comment', '<svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>');
                        editor.ui.registry.addIcon('craft-fullscreen', '<svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>');

                        // 1. Scholar Annotation Tools (Group 4)
                        editor.ui.registry.addButton('comment', {
                            icon: 'craft-comment',
                            text: 'Comment',
                            tooltip: 'Add Comment to Selection (Ctrl+M)',
                            onAction: () => this.addCommentAtSelection()
                        });
                        editor.ui.registry.addButton('certify', {
                            icon: 'craft-quill',
                            text: 'Certify',
                            tooltip: 'Certify Highlighted Word (Percy) (Ctrl+Shift+C)',
                            onAction: () => this.certifySelection()
                        });
                        editor.ui.registry.addButton('etymology', {
                            icon: 'craft-book',
                            text: 'Etymology',
                            tooltip: 'Look up Word Etymology (Wiktionary) (Ctrl+Shift+E)',
                            onAction: () => this.lookupEtymologyAtSelection()
                        });

                        // 2. Workspace & Layout Controls (Group 5: Right-Docked Toggle Buttons)
                        editor.ui.registry.addToggleButton('craftdrawer', {
                            icon: 'craft-drawer',
                            text: 'Craft Drawer',
                            tooltip: 'Toggle Craft Drawer Sidebar (Ctrl+Shift+D)',
                            onAction: (api) => {
                                this.toggleCraftDrawer();
                                const sidebar = (this.uiManager && this.uiManager.editorInspectorSidebar)
                                    ? this.uiManager.editorInspectorSidebar
                                    : document.getElementById('editor-inspector-sidebar');
                                const isOpen = sidebar && !sidebar.classList.contains('hidden');
                                api.setActive(Boolean(isOpen));
                            },
                            onSetup: (api) => {
                                this._tinymceCraftDrawerApi = api;
                                const sidebar = (this.uiManager && this.uiManager.editorInspectorSidebar)
                                    ? this.uiManager.editorInspectorSidebar
                                    : document.getElementById('editor-inspector-sidebar');
                                const isOpen = sidebar && !sidebar.classList.contains('hidden');
                                api.setActive(Boolean(isOpen));
                                return () => { this._tinymceCraftDrawerApi = null; };
                            }
                        });
                        editor.ui.registry.addToggleButton('fullview', {
                            icon: 'craft-fullscreen',
                            text: 'Full Screen',
                            tooltip: 'Toggle Full Screen Focus Mode (F11)',
                            onAction: (api) => {
                                this.toggleFullView();
                                api.setActive(Boolean(this.isFullView));
                            },
                            onSetup: (api) => {
                                this._tinymceFullViewApi = api;
                                api.setActive(Boolean(this.isFullView));
                                return () => { this._tinymceFullViewApi = null; };
                            }
                        });

                        // 3. Primary Document Action: Save & Close Sheet (Group 6: Rightmost Exit)
                        editor.ui.registry.addButton('saveclose', {
                            icon: 'craft-save',
                            text: 'Save & Close',
                            tooltip: 'Save Sheet & Return to Desk (Esc)',
                            onAction: () => this.closeEditorMode()
                        });

                        // Right-dock workspace controls dynamically after editor rendering
                        editor.on('init', () => {
                            try {
                                const container = editor.editorContainer || document.querySelector('.tox.tox-tinymce');
                                if (container) {
                                    const drawerBtn = container.querySelector('[data-mce-name="craftdrawer"]') ||
                                                      container.querySelector('[aria-label*="Craft Drawer"]') ||
                                                      container.querySelector('[title*="Craft Drawer"]');
                                    if (drawerBtn) {
                                        const group = drawerBtn.closest('.tox-toolbar__group');
                                        if (group) group.style.marginLeft = 'auto';
                                    }
                                }
                            } catch (err) {
                                console.warn('[editor] Failed to dock workspace group right:', err);
                            }
                        });

                        // Register custom menu items for menubar
                        editor.ui.registry.addMenuItem('craftdrawer_item', {
                            text: 'Toggle Craft Drawer',
                            shortcut: 'Ctrl+Shift+D',
                            onAction: () => this.toggleCraftDrawer()
                        });
                        editor.ui.registry.addMenuItem('comment_item', {
                            text: 'Add Comment at Selection',
                            shortcut: 'Ctrl+M',
                            onAction: () => this.addCommentAtSelection()
                        });
                        editor.ui.registry.addMenuItem('certify_item', {
                            text: 'Certify Word (Percy)',
                            shortcut: 'Ctrl+Shift+C',
                            onAction: () => this.certifySelection()
                        });
                        editor.ui.registry.addMenuItem('etymology_item', {
                            text: 'Lookup Etymology (Wiktionary)',
                            shortcut: 'Ctrl+Shift+E',
                            onAction: () => this.lookupEtymologyAtSelection()
                        });
                        editor.ui.registry.addMenuItem('maxim_item', {
                            text: 'Draw Scenic Maxim',
                            onAction: () => this.drawRandomMaxim()
                        });
                        editor.ui.registry.addMenuItem('insert_maxim_item', {
                            text: 'Insert Featured Maxim into Sheet',
                            onAction: () => this.insertCurrentMaximIntoSheet()
                        });
                        editor.ui.registry.addMenuItem('fullview_item', {
                            text: 'Toggle Full Screen Writing',
                            shortcut: 'F11',
                            onAction: () => this.toggleFullView()
                        });
                        editor.ui.registry.addMenuItem('archive_item', {
                            text: 'Archive Sheet',
                            shortcut: 'Ctrl+Shift+A',
                            onAction: () => {
                                const currentNode = this.stateManager ? this.stateManager.getSelectedNode() : null;
                                this.closeEditorMode();
                                if (currentNode && this.uiManager && typeof this.uiManager.archiveNode === 'function') {
                                    this.uiManager.archiveNode(currentNode);
                                }
                            }
                        });
                        editor.ui.registry.addMenuItem('saveclose_item', {
                            text: 'Save & Close Sheet',
                            shortcut: 'Esc',
                            onAction: () => this.closeEditorMode()
                        });

                        editor.on('keydown', (e) => {
                            if (e.key === 'F11' || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f')) {
                                e.preventDefault();
                                this.toggleFullView();
                            }
                            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
                                e.preventDefault();
                                const currentNode = this.stateManager ? this.stateManager.getSelectedNode() : null;
                                this.closeEditorMode();
                                if (currentNode && this.uiManager && typeof this.uiManager.archiveNode === 'function') {
                                    this.uiManager.archiveNode(currentNode);
                                }
                            }
                            if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27 || (typeof AppConstants !== 'undefined' && e.key === AppConstants.KEY_ESCAPE)) {
                                e.preventDefault();
                                e.stopPropagation();
                                const activeModal = document.querySelector('.modal:not(.hidden), #archive-modal:not(.hidden), #compendium-modal:not(.hidden)');
                                if (activeModal) {
                                    const closeBtn = activeModal.querySelector('.close-button, .close-btn, .modal-close-btn, .craft-close-btn, #close-comment-modal, #close-certify-word-btn, #close-etymology-btn, #close-compendium-btn, #close-archive-btn');
                                    if (closeBtn) {
                                        closeBtn.click();
                                        return;
                                    } else {
                                        activeModal.classList.add('hidden');
                                        return;
                                    }
                                }
                                if (this.isFullView) {
                                    this.toggleFullView(false);
                                    return;
                                }
                                this.closeEditorMode();
                                return;
                            }
                            if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'm') {
                                e.preventDefault();
                                this.addCommentAtSelection();
                            }
                            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') {
                                e.preventDefault();
                                this.certifySelection();
                            }
                            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'e') {
                                e.preventDefault();
                                this.lookupEtymologyAtSelection();
                            }
                            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
                                e.preventDefault();
                                this.toggleCraftDrawer();
                            }
                        });
                        try {
                            editor.ui.registry.addMenuItem('lookupetymology', {
                                text: 'Look up Etymology',
                                icon: 'search',
                                onAction: () => {
                                    this.lookupEtymologyAtSelection();
                                }
                            });
                        } catch (err) {}
                        editor.on('click', (ev) => {
                            let target = ev.target;
                            while (target && target !== editor.getBody()) {
                                if (target.classList && target.classList.contains('comment-highlight')) {
                                    if (this.uiManager && typeof this.uiManager.openCommentModal === 'function') {
                                        this.uiManager.openCommentModal(target.id, target.textContent);
                                    }
                                    break;
                                }
                                if (target.classList && target.classList.contains('certified-word')) {
                                    if (this.uiManager && typeof this.uiManager.openCertifyModal === 'function') {
                                        this.uiManager.openCertifyModal(target.id, target.textContent);
                                    }
                                    break;
                                }
                                target = target.parentElement;
                            }
                        });
                        editor.on('input change', () => {
                            const rawContent = this.tinymceEditor.getContent();
                            const cleanContent = (window.MyProjectStrunkEngine && typeof window.MyProjectStrunkEngine.cleanStrunkMarkers === 'function')
                                ? window.MyProjectStrunkEngine.cleanStrunkMarkers(rawContent)
                                : rawContent;

                            const selectedNode = this.stateManager ? this.stateManager.getSelectedNode() : null;
                            if (selectedNode) {
                                selectedNode.content = cleanContent;
                            }
                            if (this.uiManager && typeof this.uiManager.updateEditorWordCount === 'function') {
                                this.uiManager.updateEditorWordCount(cleanContent);
                            }
                            this.updateStrunkMetrics(cleanContent);
                            this._scheduleStrunkHighlightRefresh();
                            this._scheduleAutoSave();
                        });
                    }
                });
            } else {
                console.warn('[editor] TinyMCE not available; falling back to textarea editor');
            }
        } catch (err) {
            console.error('[editor] TinyMCE init failed:', err);
            this.tinyMCEAvailable = false;
        }

        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function' && !this._beforeUnloadAttached) {
            this._beforeUnloadAttached = true;
            window.addEventListener('beforeunload', () => {
                try {
                    this.flushAndSaveCurrentSheet();
                } catch (e) {}
            });
        }

        const isTestEnv = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';
        if (!isTestEnv && !this._autoSaveInterval && typeof setInterval === 'function') {
            this._autoSaveInterval = setInterval(() => {
                if (this.isEditorOpen()) {
                    this.flushAndSaveCurrentSheet();
                }
            }, 30000);
            if (this._autoSaveInterval && typeof this._autoSaveInterval.unref === 'function') {
                this._autoSaveInterval.unref();
            }
        }

        if (typeof document !== 'undefined' && !this._fullscreenListenerAdded) {
            this._fullscreenListenerAdded = true;
            document.addEventListener('fullscreenchange', () => {
                if (!document.fullscreenElement && this.isFullView) {
                    this.toggleFullView(false);
                }
            });
        }
    },

    /**
     * Wrap the current editor selection in a comment span and open the comment modal.
     */
    addCommentAtSelection: function() {
        const node = this.stateManager.getSelectedNode();
        if (!node) return;
        const spanId = 'comment-' + Date.now();
        try {
            if (this.tinyMCEAvailable && this.tinymceEditor) {
                const selText = this.tinymceEditor.selection.getContent({ format: 'text' }) || '';
                const selHtml = this.tinymceEditor.selection.getContent({ format: 'html' }) || '';
                if (!selText.trim()) {
                    alert('Please select text in the editor to add a comment.');
                    return;
                }
                const wrapped = `<span id="${spanId}" class="comment-highlight">${selHtml}</span>`;
                this.tinymceEditor.selection.setContent(wrapped);
                node.content = this.tinymceEditor.getContent();
                // update editor word count and open modal
                if (this.uiManager && typeof this.uiManager.openCommentModal === 'function') {
                    this.uiManager.openCommentModal(spanId, selText);
                }
                return;
            }
        } catch (err) {
            console.warn('[editor] TinyMCE comment wrap failed, trying fallback', err);
        }

        // Fallback: manipulate textarea content
        try {
            const ta = document.getElementById('main-editor-fallback');
            if (!ta) return;
            const start = ta.selectionStart || 0;
            const end = ta.selectionEnd || 0;
            const sel = ta.value.substring(start, end);
            if (!sel.trim()) {
                alert('Please select text in the editor to add a comment.');
                return;
            }
            const wrapped = `<span id="${spanId}" class="comment-highlight">${sel}</span>`;
            ta.value = ta.value.substring(0, start) + wrapped + ta.value.substring(end);
            node.content = ta.value;
            if (this.uiManager && typeof this.uiManager.openCommentModal === 'function') {
                this.uiManager.openCommentModal(spanId, sel);
            }
        } catch (err) {
            console.error('[editor] fallback comment insertion failed', err);
        }
    },

    /**
     * Wrap the current editor selection in a certified-word span and open certify modal.
     */
    certifySelection: function() {
        const node = this.stateManager.getSelectedNode();
        if (!node) return;
        const spanId = 'cert-' + Date.now();
        try {
            if (this.tinyMCEAvailable && this.tinymceEditor) {
                const selText = this.tinymceEditor.selection.getContent({ format: 'text' }) || '';
                const selHtml = this.tinymceEditor.selection.getContent({ format: 'html' }) || '';
                if (!selText.trim()) {
                    alert('Please select a word or phrase in the editor to certify.');
                    return;
                }
                const wrapped = `<span id="${spanId}" class="certified-word">${selHtml}</span>`;
                this.tinymceEditor.selection.setContent(wrapped);
                node.content = this.tinymceEditor.getContent();
                if (this.uiManager && typeof this.uiManager.openCertifyModal === 'function') {
                    this.uiManager.openCertifyModal(spanId, selText);
                }
                return;
            }
        } catch (err) {
            console.warn('[editor] TinyMCE certify wrap failed, trying fallback', err);
        }

        try {
            const ta = document.getElementById('main-editor-fallback');
            if (!ta) return;
            const start = ta.selectionStart || 0;
            const end = ta.selectionEnd || 0;
            const sel = ta.value.substring(start, end);
            if (!sel.trim()) {
                alert('Please select a word or phrase in the editor to certify.');
                return;
            }
            const wrapped = `<span id="${spanId}" class="certified-word">${sel}</span>`;
            ta.value = ta.value.substring(0, start) + wrapped + ta.value.substring(end);
            node.content = ta.value;
            if (this.uiManager && typeof this.uiManager.openCertifyModal === 'function') {
                this.uiManager.openCertifyModal(spanId, sel);
            }
        } catch (err) {
            console.error('[editor] fallback certify insertion failed', err);
        }
    },

    /**
     * Look up the currently selected word or phrase in Wiktionary.
     */
    lookupEtymologyAtSelection: function() {
        let selText = '';
        try {
            if (this.tinyMCEAvailable && this.tinymceEditor) {
                selText = (this.tinymceEditor.selection.getContent({ format: 'text' }) || '').trim();
            }
        } catch (err) {
            console.warn('[editor] TinyMCE get selection failed', err);
        }

        if (!selText) {
            try {
                const ta = document.getElementById('main-editor-fallback');
                if (ta) {
                    const start = ta.selectionStart || 0;
                    const end = ta.selectionEnd || 0;
                    selText = ta.value.substring(start, end).trim();
                }
            } catch (err) {
                console.warn('[editor] fallback textarea get selection failed', err);
            }
        }

        if (!selText) {
            alert('Please select a word or phrase in the editor to look up its etymology.');
            return;
        }

        if (this.uiManager && typeof this.uiManager.showEtymologyFor === 'function') {
            this.uiManager.showEtymologyFor(selText);
        }
    },

    /**
     * Focus and (if possible) select an inline span inside the current editor by id.
     * @param {string} spanId
     */
    focusSpan: function(spanId) {
        const node = this.stateManager.getSelectedNode();
        if (!node) return;
        try {
            if (this.tinyMCEAvailable && this.tinymceEditor) {
                const doc = this.tinymceEditor.getDoc();
                const el = doc.getElementById(spanId);
                if (el) {
                    try {
                        // Select the node and scroll into view
                        this.tinymceEditor.selection.select(el);
                        if (this.tinymceEditor.dom && typeof this.tinymceEditor.dom.scrollIntoView === 'function') {
                            this.tinymceEditor.dom.scrollIntoView(el);
                        } else if (el.scrollIntoView) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    } catch (err) {
                        console.warn('[editor] focusSpan selection failed', err);
                    }
                } else {
                    console.warn('[editor] focusSpan: element not found in TinyMCE doc', spanId);
                }
                return;
            }
        } catch (err) {
            console.warn('[editor] focusSpan with TinyMCE failed', err);
        }

        // Fallback: try to focus the raw textarea and select the inner text of the span
        try {
            const ta = document.getElementById('main-editor-fallback');
            if (!ta) return;
            const re = new RegExp(`<span[^>]*id="${spanId}"[^>]*>([\s\S]*?)<\\/span>`, 'i');
            const m = node.content.match(re);
            if (m && m[1]) {
                const inner = m[1];
                const idx = ta.value.indexOf(inner);
                if (idx >= 0) {
                    ta.focus();
                    ta.setSelectionRange(idx, idx + inner.length);
                }
            }
        } catch (err) {
            console.warn('[editor] focusSpan fallback failed', err);
        }
    },

    /**
     * Initializes DOM events and controls for the Craft Drawer.
     */
    initCraftDrawer: function() {
        if (this._craftDrawerInitialized) return;
        this._craftDrawerInitialized = true;

        const toggleBtn = document.getElementById('toggle-craft-drawer-btn');
        const closeBtn = document.getElementById('close-craft-drawer-btn');
        const passiveToggle = document.getElementById('toggle-passive-voice');
        const adverbsToggle = document.getElementById('toggle-adverbs');
        const craftCertifyBtn = document.getElementById('craft-certify-btn');
        const craftEtymologyBtn = document.getElementById('craft-etymology-btn');
        const craftEtymologyInput = document.getElementById('craft-etymology-input');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleCraftDrawer());
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.toggleCraftDrawer(false));
        }
        if (passiveToggle) {
            passiveToggle.addEventListener('change', () => this.applyStrunkHighlights());
        }
        if (adverbsToggle) {
            adverbsToggle.addEventListener('change', () => this.applyStrunkHighlights());
        }
        if (craftCertifyBtn) {
            craftCertifyBtn.addEventListener('click', () => this.certifySelection());
        }
        if (craftEtymologyBtn) {
            craftEtymologyBtn.addEventListener('click', () => {
                const query = craftEtymologyInput ? craftEtymologyInput.value.trim() : '';
                if (query) {
                    if (this.uiManager && typeof this.uiManager.showEtymologyFor === 'function') {
                        this.uiManager.showEtymologyFor(query);
                    }
                } else {
                    this.lookupEtymologyAtSelection();
                }
            });
        }
        const fullviewBtn = document.getElementById('editor-fullview-btn');
        const exitFullviewBtn = document.getElementById('exit-fullview-btn');
        const scenicShuffleBtn = document.getElementById('scenic-shuffle-btn');
        const scenicInsertBtn = document.getElementById('scenic-insert-btn');
        const scenicSearchInput = document.getElementById('scenic-search-input');
        const scenicCategoryFilter = document.getElementById('scenic-category-filter');

        if (fullviewBtn) {
            fullviewBtn.addEventListener('click', () => this.toggleFullView());
        }
        if (exitFullviewBtn) {
            exitFullviewBtn.addEventListener('click', () => this.toggleFullView(false));
        }
        if (scenicShuffleBtn) {
            scenicShuffleBtn.addEventListener('click', () => this.drawRandomMaxim());
        }
        if (scenicInsertBtn) {
            scenicInsertBtn.addEventListener('click', () => this.insertCurrentMaximIntoSheet());
        }
        if (scenicSearchInput) {
            scenicSearchInput.addEventListener('input', () => this.renderScenicMaximsList());
        }
        if (scenicCategoryFilter) {
            scenicCategoryFilter.addEventListener('change', () => {
                this.drawRandomMaxim();
                this.renderScenicMaximsList();
            });
        }

        // 5-Minute Warm-Up Controls (Craft Drawer)
        const warmupNextBtn = document.getElementById('warmup-next-btn');
        const warmupCopyBtn = document.getElementById('warmup-copy-btn');
        const warmupTimerBtn = document.getElementById('warmup-timer-btn');
        const warmupInsertBtn = document.getElementById('warmup-insert-btn');

        if (warmupNextBtn) {
            warmupNextBtn.addEventListener('click', () => this.drawRandomWarmUpPassage());
        }
        if (warmupCopyBtn) {
            warmupCopyBtn.addEventListener('click', () => this.copyCurrentWarmUpPassage());
        }
        if (warmupTimerBtn) {
            warmupTimerBtn.addEventListener('click', () => this.startWarmUpTimer());
        }
        if (warmupInsertBtn) {
            warmupInsertBtn.addEventListener('click', () => this.insertWarmUpIntoSheet());
        }

        if (!this._documentKeyListenersAttached && typeof document !== 'undefined') {
            this._documentKeyListenersAttached = true;
            document.addEventListener('keydown', (e) => {
                if (!this.isEditorOpen()) return;
                if (e.key === 'F11' || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f')) {
                    e.preventDefault();
                    this.toggleFullView();
                } else if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
                    e.preventDefault();
                    const activeModal = document.querySelector('.modal:not(.hidden), #archive-modal:not(.hidden), #compendium-modal:not(.hidden)');
                    if (activeModal) {
                        const closeBtn = activeModal.querySelector('.close-button, .close-btn, .modal-close-btn, .craft-close-btn, #close-comment-modal, #close-certify-word-btn, #close-etymology-btn, #close-compendium-btn, #close-archive-btn');
                        if (closeBtn) {
                            closeBtn.click();
                            return;
                        } else {
                            activeModal.classList.add('hidden');
                            return;
                        }
                    }
                    if (this.isFullView) {
                        this.toggleFullView(false);
                    } else {
                        this.closeEditorMode();
                    }
                }
            });
        }
    },

    /**
     * Toggles the Craft Drawer sidebar open or closed.
     * @param {boolean} [forceState] - Optional boolean to force open (true) or closed (false).
     */
    toggleCraftDrawer: function(forceState) {
        const sidebar = (this.uiManager && this.uiManager.editorInspectorSidebar)
            ? this.uiManager.editorInspectorSidebar
            : document.getElementById('editor-inspector-sidebar');
        if (!sidebar) return;

        const isCurrentlyHidden = sidebar.classList.contains('hidden');
        const shouldShow = typeof forceState === 'boolean' ? forceState : isCurrentlyHidden;

        if (shouldShow) {
            sidebar.classList.remove('hidden');
            const selectedNode = this.stateManager ? this.stateManager.getSelectedNode() : null;
            if (selectedNode) {
                this.renderCraftCertifiedList(selectedNode);
                const currentContent = (this.tinymceEditor && this.tinyMCEAvailable)
                    ? this.tinymceEditor.getContent()
                    : (selectedNode.content || '');
                this.updateStrunkMetrics(currentContent);
            }
        } else {
            sidebar.classList.add('hidden');
        }

        const toggleBtn = document.getElementById('toggle-craft-drawer-btn');
        if (toggleBtn) {
            toggleBtn.textContent = shouldShow ? 'Craft Drawer ▾' : 'Craft Drawer ▸';
        }

        if (this._tinymceCraftDrawerApi && typeof this._tinymceCraftDrawerApi.setActive === 'function') {
            this._tinymceCraftDrawerApi.setActive(shouldShow);
        }
    },

    /**
     * Computes real-time Flesch-Kincaid readability scoring and passive/adverb counts.
     * Updates the Craft Drawer badges and cards.
     * @param {string} rawContent
     */
    updateStrunkMetrics: function(rawContent) {
        if (!window.MyProjectStrunkEngine) return;
        const text = rawContent || '';
        const readability = window.MyProjectStrunkEngine.calculateReadability(text);
        const passives = window.MyProjectStrunkEngine.findPassiveVoice(text);
        const adverbs = window.MyProjectStrunkEngine.findAdverbs(text);

        const gradeEl = document.getElementById('flesch-grade');
        const easeEl = document.getElementById('flesch-ease');
        const summaryEl = document.getElementById('readability-summary');
        const passiveCountEl = document.getElementById('passive-voice-count');
        const adverbCountEl = document.getElementById('adverb-count');

        if (gradeEl) gradeEl.textContent = readability.words > 0 ? readability.grade : '--';
        if (easeEl) easeEl.textContent = readability.words > 0 ? readability.ease : '--';
        if (summaryEl) summaryEl.textContent = readability.words > 0 ? readability.label : 'Draft text to analyze';
        if (passiveCountEl) passiveCountEl.textContent = passives.length;
        if (adverbCountEl) adverbCountEl.textContent = adverbs.length;
    },

    /**
     * Schedules a debounced refresh of in-editor Strunk highlights during typing.
     */
    _scheduleStrunkHighlightRefresh: function() {
        const passiveToggle = document.getElementById('toggle-passive-voice');
        const adverbsToggle = document.getElementById('toggle-adverbs');
        const isPassiveActive = passiveToggle && passiveToggle.checked;
        const isAdverbsActive = adverbsToggle && adverbsToggle.checked;

        if (!isPassiveActive && !isAdverbsActive) return;

        if (this._strunkDebounceTimer) {
            clearTimeout(this._strunkDebounceTimer);
        }
        this._strunkDebounceTimer = setTimeout(() => {
            this.applyStrunkHighlights();
        }, 900);
    },

    /**
     * Applies non-destructive Strunk highlight underlines to the editor document
     * based on toggle switch states, or restores clean HTML if toggled off.
     */
    applyStrunkHighlights: function() {
        if (!window.MyProjectStrunkEngine) return;
        const passiveToggle = document.getElementById('toggle-passive-voice');
        const adverbsToggle = document.getElementById('toggle-adverbs');
        const passiveOn = passiveToggle ? passiveToggle.checked : false;
        const adverbsOn = adverbsToggle ? adverbsToggle.checked : false;

        if (this.tinyMCEAvailable && this.tinymceEditor) {
            const rawContent = this.tinymceEditor.getContent();
            const clean = window.MyProjectStrunkEngine.cleanStrunkMarkers(rawContent);

            if (!passiveOn && !adverbsOn) {
                if (rawContent !== clean) {
                    let bm = null;
                    try { bm = this.tinymceEditor.selection ? this.tinymceEditor.selection.getBookmark(2, true) : null; } catch (e) {}
                    this.tinymceEditor.setContent(clean);
                    if (bm && this.tinymceEditor.selection) {
                        try { this.tinymceEditor.selection.moveToBookmark(bm); } catch (e) {}
                    }
                }
                return;
            }

            const highlighted = window.MyProjectStrunkEngine.applyHighlights(clean, {
                passive: passiveOn,
                adverbs: adverbsOn
            });

            if (highlighted !== rawContent) {
                let bm = null;
                try { bm = this.tinymceEditor.selection ? this.tinymceEditor.selection.getBookmark(2, true) : null; } catch (e) {}
                this.tinymceEditor.setContent(highlighted);
                if (bm && this.tinymceEditor.selection) {
                    try { this.tinymceEditor.selection.moveToBookmark(bm); } catch (e) {}
                }
            }
        }
    },

    /**
     * Renders the Percy Certified Lexicon list inside the Craft Drawer for the given node.
     * @param {Object} node
     */
    renderCraftCertifiedList: function(node) {
        const container = document.getElementById('craft-certified-list');
        if (!container) return;
        container.innerHTML = '';

        if (!node || !Array.isArray(node.certifiedWords) || node.certifiedWords.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'craft-empty-state';
            if (empty.style) {
                empty.style.color = 'var(--color-text-muted)';
                empty.style.fontStyle = 'italic';
                empty.style.padding = '4px 0';
            }
            empty.textContent = 'No words certified in this Sheet.';
            container.appendChild(empty);
            return;
        }

        node.certifiedWords.forEach(cw => {
            const item = document.createElement('div');
            item.className = 'craft-certified-item';
            const word = cw.word || cw.text || '';
            const def = cw.definition || '';
            item.title = `Click to locate "${word}" in editor, double-click to edit`;
            item.innerHTML = `
                <span class="craft-certified-word">${word}</span>
                <span class="craft-certified-def" title="${def}">${def}</span>
            `;
            item.addEventListener('click', () => {
                if (cw.spanId) {
                    this.focusSpan(cw.spanId);
                }
            });
            item.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                if (this.uiManager && typeof this.uiManager.openCertifyModal === 'function') {
                    this.uiManager.openCertifyModal(cw.spanId, word);
                }
            });
            container.appendChild(item);
        });
    },

    /**
     * Opens the editor for the given node.
     * @param {Object} node - The node object to be edited.
     */
    openEditorMode: function(node) {
        console.log('[editor] openEditorMode', node && node.id);
        if (!this.uiManager) {
            console.error("EditorManager not fully initialized (missing uiManager) for openEditorMode");
            return;
        }

        this.stateManager.setSelectedNode(node);

        if (this.uiManager.editorMode) {
            this.uiManager.editorMode.classList.remove('hidden');
        }

        // Initialize Craft Drawer controls
        this.initCraftDrawer();

        // Ensure the Craft Drawer sidebar is visible when opening
        try {
            if (this.uiManager && this.uiManager.editorInspectorSidebar) {
                this.uiManager.editorInspectorSidebar.classList.remove('hidden');
            }
        } catch (err) { console.warn('[editor] failed to show inspector sidebar', err); }

        const toggleBtn = document.getElementById('toggle-craft-drawer-btn');
        if (toggleBtn) toggleBtn.textContent = 'Craft Drawer ▾';

        if (this._tinymceCraftDrawerApi && typeof this._tinymceCraftDrawerApi.setActive === 'function') {
            this._tinymceCraftDrawerApi.setActive(true);
        }
        if (this._tinymceFullViewApi && typeof this._tinymceFullViewApi.setActive === 'function') {
            this._tinymceFullViewApi.setActive(Boolean(this.isFullView));
        }

        // Populate Craft Drawer panels
        this.renderCraftCertifiedList(node);
        this.updateStrunkMetrics(node ? (node.content || '') : '');
        this.initScenicMaxims();
        this.drawRandomWarmUpPassage();

        // If TinyMCE is available and initialized, use it. Otherwise fall back to
        // a simple textarea so the editor can still be used.
        if (this.tinyMCEAvailable && this.tinymceEditor) {
            try {
                this.tinymceEditor.setContent(node.content || '');
                this.uiManager.updateEditorWordCount(node.content || '');
                if (this.uiManager.renderTags) this.uiManager.renderTags(node);
                if (this.uiManager.renderFootnotes) this.uiManager.renderFootnotes(node);

                // Apply Strunk highlights if toggles were left enabled
                this.applyStrunkHighlights();

                // Attach hover tooltip listeners inside TinyMCE document to show comment/certify previews
                try {
                    const doc = this.tinymceEditor.getDoc();
                    const hoverHandler = (ev) => {
                        try {
                            const target = ev.target;
                            if (!target) return;
                            const iframe = this.tinymceEditor.iframeElement || document.querySelector('.tox-edit-area iframe');
                            const rect = iframe ? iframe.getBoundingClientRect() : { left: 0, top: 0 };
                            const clientX = ev.clientX + rect.left;
                            const clientY = ev.clientY + rect.top;

                            if (target.classList && target.classList.contains('comment-highlight')) {
                                const selectedNode = this.stateManager.getSelectedNode();
                                const c = selectedNode && Array.isArray(selectedNode.comments)
                                    ? selectedNode.comments.find(item => item.id === target.id || item.spanId === target.id)
                                    : null;
                                const text = c ? `💬 Comment: "${c.text}"` : (target.textContent || '');
                                if (this.uiManager && typeof this.uiManager._showHoverTooltip === 'function') {
                                    this.uiManager._showHoverTooltip(text, clientX, clientY);
                                }
                                return;
                            }
                            if (target.classList && target.classList.contains('certified-word')) {
                                const selectedNode = this.stateManager.getSelectedNode();
                                const cw = selectedNode && Array.isArray(selectedNode.certifiedWords)
                                    ? selectedNode.certifiedWords.find(item => item.spanId === target.id)
                                    : null;
                                const def = cw ? cw.definition : (target.getAttribute('data-definition') || '');
                                const word = cw ? cw.word : target.textContent;
                                const text = `✓ Certified: "${word}" — ${def || '(no definition)'}`;
                                if (this.uiManager && typeof this.uiManager._showHoverTooltip === 'function') {
                                    this.uiManager._showHoverTooltip(text, clientX, clientY);
                                }
                                return;
                            }
                            if (this.uiManager && typeof this.uiManager._hideHoverTooltip === 'function') this.uiManager._hideHoverTooltip();
                        } catch (err) { /* ignore hover handler errors */ }
                    };
                    doc.addEventListener('mouseover', hoverHandler);
                    doc.addEventListener('mousemove', hoverHandler);
                    doc.addEventListener('mouseout', () => { if (this.uiManager && typeof this.uiManager._hideHoverTooltip === 'function') this.uiManager._hideHoverTooltip(); });
                } catch (err) { console.warn('[editor] attaching hover listeners failed', err); }
                this.tinymceEditor.focus();
                return;
            } catch (err) {
                console.error('[editor] TinyMCE open failed, falling back:', err);
            }
        }

        // Fallback textarea
        try {
            let ta = document.getElementById('main-editor-fallback');
            if (!ta) {
                ta = document.createElement('textarea');
                ta.id = 'main-editor-fallback';
                ta.style.width = '100%';
                ta.style.height = '100%';
                const container = document.getElementById('editor-main-content') || document.body;
                container.innerHTML = '';
                container.appendChild(ta);
            }
            ta.value = node.content || '';
            this.uiManager.updateEditorWordCount(ta.value);
            if (this.uiManager.renderTags) this.uiManager.renderTags(node);
            if (this.uiManager.renderFootnotes) this.uiManager.renderFootnotes(node);
            ta.oninput = () => {
                const clean = (window.MyProjectStrunkEngine && typeof window.MyProjectStrunkEngine.cleanStrunkMarkers === 'function')
                    ? window.MyProjectStrunkEngine.cleanStrunkMarkers(ta.value)
                    : ta.value;
                node.content = clean;
                if (this.uiManager && typeof this.uiManager.updateEditorWordCount === 'function') {
                    this.uiManager.updateEditorWordCount(clean);
                }
                this.updateStrunkMetrics(clean);
                this._scheduleAutoSave();
            };
            ta.onkeydown = (e) => {
                if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
                    e.preventDefault();
                    const activeModal = document.querySelector('.modal:not(.hidden), #archive-modal:not(.hidden), #compendium-modal:not(.hidden)');
                    if (activeModal) {
                        const closeBtn = activeModal.querySelector('.close-button, .close-btn, .modal-close-btn, .craft-close-btn, #close-comment-modal, #close-certify-word-btn, #close-etymology-btn, #close-compendium-btn, #close-archive-btn');
                        if (closeBtn) {
                            closeBtn.click();
                            return;
                        } else {
                            activeModal.classList.add('hidden');
                            return;
                        }
                    }
                    if (this.isFullView) {
                        this.toggleFullView(false);
                    } else {
                        this.closeEditorMode();
                    }
                }
            };
            ta.focus();
        } catch (err) {
            console.error('[editor] fallback textarea failed:', err);
        }
    },

    /**
     * Schedules a debounced auto-save (1.5s) while writing.
     */
    _scheduleAutoSave: function() {
        if (this._autoSaveDebounceTimer) {
            clearTimeout(this._autoSaveDebounceTimer);
        }
        this._updateSaveStatusIndicator('Saving…');
        this._autoSaveDebounceTimer = setTimeout(() => {
            this.flushAndSaveCurrentSheet();
        }, 1500);
    },

    /**
     * Flushes current editor content directly into the node object and saves to disk.
     */
    flushAndSaveCurrentSheet: function() {
        if (!this.stateManager || !this.dataStorage) return;
        const selectedNode = this.stateManager.getSelectedNode();
        if (!selectedNode) return;

        try {
            let content = '';
            if (this.tinymceEditor && this.tinyMCEAvailable) {
                content = this.tinymceEditor.getContent();
            } else {
                const ta = document.getElementById('main-editor-fallback');
                content = ta ? ta.value : (selectedNode.content || '');
            }

            // Strip non-destructive Strunk highlight markers before saving
            if (window.MyProjectStrunkEngine && typeof window.MyProjectStrunkEngine.cleanStrunkMarkers === 'function') {
                content = window.MyProjectStrunkEngine.cleanStrunkMarkers(content);
            }
            selectedNode.content = content;

            // Persist changes
            if (typeof this.dataStorage.saveNodes === 'function') {
                this.dataStorage.saveNodes(this.stateManager.getRootNodes());
                this._updateSaveStatusIndicator('Saved');
            }
        } catch (err) {
            console.error('[editor] error saving content on flushAndSaveCurrentSheet', err);
            this._updateSaveStatusIndicator('Save error');
        }
    },

    /**
     * Updates visual save status indicator in the UI.
     * @param {string} status
     */
    _updateSaveStatusIndicator: function(status) {
        try {
            let indicator = document.getElementById('editor-save-indicator');
            if (!indicator) {
                const toolbar = document.getElementById('editor-toolbar');
                if (toolbar) {
                    indicator = document.createElement('span');
                    indicator.id = 'editor-save-indicator';
                    indicator.className = 'editor-save-indicator';
                    toolbar.appendChild(indicator);
                }
            }
            if (indicator) {
                indicator.textContent = status;
                const cleanCls = (status || '').toLowerCase().replace(/[^a-z]/g, '');
                indicator.className = `editor-save-indicator status-${cleanCls}`;
                if (status === 'Saved') {
                    if (this._saveIndicatorFadeTimer) clearTimeout(this._saveIndicatorFadeTimer);
                    this._saveIndicatorFadeTimer = setTimeout(() => {
                        try {
                            if (indicator && indicator.textContent === 'Saved') {
                                indicator.textContent = 'All changes saved';
                            }
                        } catch (e) {}
                    }, 2500);
                }
            }
        } catch (e) {}
    },

    /**
     * Closes the editor, saving any changes made to the current node without Strunk markers.
     */
    closeEditorMode: function() {
        if (!this.uiManager || !this.dataStorage || !this.drawFunction) {
            console.error("EditorManager not fully initialized for closeEditorMode");
            return;
        }

        if (this._autoSaveDebounceTimer) {
            clearTimeout(this._autoSaveDebounceTimer);
            this._autoSaveDebounceTimer = null;
        }

        const selectedNode = this.stateManager ? this.stateManager.getSelectedNode() : null;
        this.flushAndSaveCurrentSheet();

        if (this.isFullView) {
            this.toggleFullView(false);
        }
        if (this.uiManager.editorMode) {
            this.uiManager.editorMode.classList.add('hidden');
        }
        // Hide inspector/sidebar when closing editor
        try {
            if (this.uiManager && this.uiManager.editorInspectorSidebar) {
                this.uiManager.editorInspectorSidebar.classList.add('hidden');
            }
        } catch (err) { /* ignore */ }

        // Return desk view to what makes sense: ensure the edited sheet or parent container is visible
        try {
            if (selectedNode && this.uiManager && typeof this.uiManager.ensureNodeVisible === 'function') {
                this.uiManager.ensureNodeVisible(selectedNode, 100);
            } else if (this.uiManager && typeof this.uiManager.fitNodesToView === 'function') {
                this.uiManager.fitNodesToView(80);
            }
        } catch (err) { /* non-fatal */ }

        try { this.drawFunction(); } catch (err) { /* ignore draw errors */ }
    },

    /**
     * Checks if the TinyMCE editor is currently open (visible).
     * @returns {boolean} True if the editor is open, false otherwise.
     */
    isEditorOpen: function() {
        return this.uiManager && this.uiManager.editorMode && !this.uiManager.editorMode.classList.contains('hidden');
    },

    /**
     * Toggles Full View focus writing mode.
     * @param {boolean} [forceState]
     */
    toggleFullView: function(forceState) {
        const editorMode = (this.uiManager && this.uiManager.editorMode)
            ? this.uiManager.editorMode
            : document.getElementById('editor-mode');
        if (!editorMode) return;

        const isCurrentlyFull = editorMode.classList.contains('full-view-mode');
        const shouldBeFull = typeof forceState === 'boolean' ? forceState : !isCurrentlyFull;

        this.isFullView = shouldBeFull;

        if (shouldBeFull) {
            editorMode.classList.add('full-view-mode');
            try {
                if (typeof document !== 'undefined' && !document.fullscreenElement && document.documentElement && typeof document.documentElement.requestFullscreen === 'function') {
                    const p = document.documentElement.requestFullscreen();
                    if (p && typeof p.catch === 'function') p.catch(() => {});
                }
            } catch (e) { /* ignore */ }
        } else {
            editorMode.classList.remove('full-view-mode');
            try {
                if (typeof document !== 'undefined' && document.fullscreenElement && typeof document.exitFullscreen === 'function') {
                    const p = document.exitFullscreen();
                    if (p && typeof p.catch === 'function') p.catch(() => {});
                }
            } catch (e) { /* ignore */ }
        }

        const fullviewBtn = document.getElementById('editor-fullview-btn');
        if (fullviewBtn) {
            fullviewBtn.textContent = shouldBeFull ? '✕ Exit Full View' : '⛶ Full View';
        }

        const exitBtn = document.getElementById('exit-fullview-btn');
        if (exitBtn) {
            if (shouldBeFull) exitBtn.classList.remove('hidden');
            else exitBtn.classList.add('hidden');
        }

        if (this._tinymceFullViewApi && typeof this._tinymceFullViewApi.setActive === 'function') {
            this._tinymceFullViewApi.setActive(shouldBeFull);
        }
    },

    /**
     * Initializes and renders the Scenic Method (55 Maxims) section in the Craft Drawer.
     */
    initScenicMaxims: function() {
        if (!window.MyProjectScenicMaxims) return;
        if (!this._currentFeaturedMaxim) {
            this.drawRandomMaxim();
        } else {
            this.renderFeaturedMaxim(this._currentFeaturedMaxim);
        }
        this.renderScenicMaximsList();
    },

    /**
     * Draws and renders a new random maxim for inspiration.
     */
    drawRandomMaxim: function() {
        if (!window.MyProjectScenicMaxims) return;
        const categoryFilter = document.getElementById('scenic-category-filter');
        const cat = categoryFilter ? categoryFilter.value : 'all';
        const maxim = window.MyProjectScenicMaxims.getRandomMaxim(cat);
        this._currentFeaturedMaxim = maxim;
        this.renderFeaturedMaxim(maxim);
    },

    /**
     * Displays a featured maxim on the card.
     * @param {Object} maxim
     */
    renderFeaturedMaxim: function(maxim) {
        if (!maxim) return;
        const quoteEl = document.getElementById('scenic-featured-quote');
        const metaEl = document.getElementById('scenic-featured-meta');
        if (quoteEl) quoteEl.textContent = `“${maxim.text}”`;
        if (metaEl) metaEl.textContent = `Maxim #${maxim.id} · ${maxim.categoryLabel}`;
    },

    /**
     * Inserts the current featured maxim into the sheet editor.
     */
    insertCurrentMaximIntoSheet: function() {
        const maxim = this._currentFeaturedMaxim;
        if (!maxim) return;
        const insertHtml = `<blockquote><em>“${maxim.text}”</em> &mdash; <small>Scenic Method Maxim #${maxim.id}</small></blockquote><p></p>`;

        if (this.tinyMCEAvailable && this.tinymceEditor) {
            try {
                this.tinymceEditor.insertContent(insertHtml);
                return;
            } catch (err) {
                console.warn('[editor] insertContent into TinyMCE failed', err);
            }
        }

        try {
            const ta = document.getElementById('main-editor-fallback');
            if (ta) {
                const start = ta.selectionStart || ta.value.length;
                const end = ta.selectionEnd || ta.value.length;
                const textToInsert = `\n> "${maxim.text}" — Scenic Method Maxim #${maxim.id}\n\n`;
                ta.value = ta.value.substring(0, start) + textToInsert + ta.value.substring(end);
            }
        } catch (err) {
            console.error('[editor] fallback insert maxim failed', err);
        }
    },

    /**
     * Loads the checked maxims for the given node from localStorage.
     * @param {string} nodeId
     * @returns {Set<number>}
     */
    _getCheckedMaximsForNode: function(nodeId) {
        if (!nodeId) return new Set();
        try {
            if (typeof localStorage !== 'undefined') {
                const raw = localStorage.getItem(`morada_scenic_checks_${nodeId}`);
                if (raw) {
                    const arr = JSON.parse(raw);
                    if (Array.isArray(arr)) return new Set(arr);
                }
            } else if (this._scenicChecksMemory) {
                const arr = this._scenicChecksMemory[nodeId];
                if (Array.isArray(arr)) return new Set(arr);
            }
        } catch (e) {}
        return new Set();
    },

    /**
     * Saves checked maxims for the given node to localStorage.
     * @param {string} nodeId
     * @param {Set<number>} checkedSet
     */
    _saveCheckedMaximsForNode: function(nodeId, checkedSet) {
        if (!nodeId) return;
        try {
            const arr = Array.from(checkedSet);
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(`morada_scenic_checks_${nodeId}`, JSON.stringify(arr));
            } else {
                if (!this._scenicChecksMemory) this._scenicChecksMemory = {};
                this._scenicChecksMemory[nodeId] = arr;
            }
        } catch (e) {}
    },

    /**
     * Toggles a maxim check state for the current node.
     * @param {number} maximId
     */
    toggleScenicMaximCheck: function(maximId) {
        const selNode = this.stateManager ? this.stateManager.getSelectedNode() : null;
        if (!selNode) return;
        const checkedSet = this._getCheckedMaximsForNode(selNode.id);
        if (checkedSet.has(maximId)) {
            checkedSet.delete(maximId);
        } else {
            checkedSet.add(maximId);
        }
        this._saveCheckedMaximsForNode(selNode.id, checkedSet);
        this.renderScenicMaximsList();
    },

    /**
     * Renders the filtered list of maxims with interactive checkboxes.
     */
    renderScenicMaximsList: function() {
        const container = document.getElementById('scenic-maxims-list');
        if (!container || !window.MyProjectScenicMaxims) return;
        container.innerHTML = '';

        const categoryFilter = document.getElementById('scenic-category-filter');
        const searchInput = document.getElementById('scenic-search-input');
        const selectedCat = categoryFilter ? categoryFilter.value : 'all';
        const query = searchInput ? searchInput.value.trim() : '';

        let list = (selectedCat && selectedCat !== 'all')
            ? window.MyProjectScenicMaxims.getMaximsByCategory(selectedCat)
            : window.MyProjectScenicMaxims.getAllMaxims();

        if (query) {
            list = window.MyProjectScenicMaxims.searchMaxims(query).filter(m => {
                return selectedCat === 'all' || m.category === selectedCat;
            });
        }

        const selNode = this.stateManager ? this.stateManager.getSelectedNode() : null;
        const checkedSet = this._getCheckedMaximsForNode(selNode ? selNode.id : null);

        if (list.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'craft-empty-state';
            empty.textContent = 'No matching maxims found.';
            container.appendChild(empty);
            return;
        }

        list.forEach(maxim => {
            const isChecked = checkedSet.has(maxim.id);
            const isCurrentlyFeatured = this._currentFeaturedMaxim && this._currentFeaturedMaxim.id === maxim.id;
            const item = document.createElement('div');
            item.className = 'scenic-maxim-item' + (isChecked ? ' applied' : '') + (isCurrentlyFeatured ? ' active-featured' : '');
            item.title = 'Click to feature this maxim at top. Check box to track as applied to scene.';

            // Checklist container with explicit tooltip
            const chkWrap = document.createElement('label');
            chkWrap.className = 'scenic-chk-wrap';
            chkWrap.title = isChecked ? 'Marked applied to scene (click to uncheck)' : 'Check off when applied to this scene';

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.className = 'scenic-chk-box';
            chk.checked = isChecked;
            chk.addEventListener('change', (e) => {
                e.stopPropagation();
                this.toggleScenicMaximCheck(maxim.id);
            });

            chkWrap.appendChild(chk);

            const num = document.createElement('span');
            num.className = 'scenic-maxim-num';
            num.textContent = `#${maxim.id}`;

            const text = document.createElement('span');
            text.className = 'scenic-maxim-text';
            text.textContent = maxim.text;

            const actionsWrap = document.createElement('div');
            actionsWrap.className = 'scenic-item-actions';

            if (isChecked) {
                const badge = document.createElement('span');
                badge.className = 'scenic-status-badge badge-applied';
                badge.textContent = '✓ Applied';
                actionsWrap.appendChild(badge);
            }

            const insertBtn = document.createElement('button');
            insertBtn.type = 'button';
            insertBtn.className = 'scenic-item-insert-btn';
            insertBtn.textContent = 'Insert';
            insertBtn.title = 'Insert maxim into sheet';
            insertBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._currentFeaturedMaxim = maxim;
                this.renderFeaturedMaxim(maxim);
                this.insertCurrentMaximIntoSheet();
            });
            actionsWrap.appendChild(insertBtn);

            item.appendChild(chkWrap);
            item.appendChild(num);
            item.appendChild(text);
            item.appendChild(actionsWrap);

            // Clicking on the item row sets it as the active Maxim of the Moment at the top
            item.addEventListener('click', (e) => {
                if (e.target !== chk && e.target !== insertBtn && e.target !== chkWrap) {
                    this._currentFeaturedMaxim = maxim;
                    this.renderFeaturedMaxim(maxim);
                    this.renderScenicMaximsList();
                }
            });

            container.appendChild(item);
        });
    },

    /**
     * Draws a random or specified literary warm-up passage for copywork priming.
     * @param {string} [passageId]
     */
    drawRandomWarmUpPassage: function(passageId) {
        if (!window.MyProjectWarmUp) return;
        const currentId = this._currentWarmUpPassage ? this._currentWarmUpPassage.id : null;
        const passage = passageId
            ? window.MyProjectWarmUp.getPassageById(passageId)
            : window.MyProjectWarmUp.getRandomPassage(currentId);
        if (!passage) return;
        this._currentWarmUpPassage = passage;

        const authorWorkEl = document.getElementById('warmup-author-work');
        const quoteEl = document.getElementById('warmup-quote-text');

        if (authorWorkEl) {
            authorWorkEl.textContent = `${passage.author} — ${passage.work}`;
        }
        if (quoteEl) {
            quoteEl.textContent = `"${passage.text}"`;
        }
    },

    /**
     * Copies current warm-up passage text and citation to system clipboard.
     */
    copyCurrentWarmUpPassage: function() {
        if (!this._currentWarmUpPassage && window.MyProjectWarmUp) {
            this.drawRandomWarmUpPassage();
        }
        if (!this._currentWarmUpPassage) return;

        const text = `"${this._currentWarmUpPassage.text}"\n— ${this._currentWarmUpPassage.author}, ${this._currentWarmUpPassage.work}`;
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                navigator.clipboard.writeText(text);
            }
        } catch (e) {
            console.warn('[editor] Failed to copy to clipboard:', e);
        }

        const copyBtn = document.getElementById('warmup-copy-btn');
        if (copyBtn) {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✓ Copied!';
            setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
        }
    },

    /**
     * Starts a 5-minute countdown timer on the scholar status bar.
     */
    startWarmUpTimer: function() {
        if (this.uiManager && typeof this.uiManager.startTimer === 'function') {
            this.uiManager.startTimer(5);
        }
        const timerBtn = document.getElementById('warmup-timer-btn');
        if (timerBtn) {
            const originalText = timerBtn.textContent;
            timerBtn.textContent = '⏱ 5m Running…';
            setTimeout(() => { timerBtn.textContent = originalText; }, 3000);
        }
    },

    /**
     * Inserts the current warm-up copywork quote block directly into the sheet.
     */
    insertWarmUpIntoSheet: function() {
        if (!this._currentWarmUpPassage && window.MyProjectWarmUp) {
            this.drawRandomWarmUpPassage();
        }
        if (!this._currentWarmUpPassage) return;

        const passage = this._currentWarmUpPassage;
        const html = window.MyProjectWarmUp.generateSheetContent(passage);

        if (this.tinyMCEAvailable && this.tinymceEditor) {
            this.tinymceEditor.insertContent(html);
        } else {
            const ta = document.getElementById('main-editor-fallback') || document.getElementById('main-editor');
            if (ta) {
                const plain = `\n\n--- 5-Minute Warm-Up (${passage.author} — ${passage.work}) ---\n"${passage.text}"\n\nMy Writing:\n`;
                ta.value += plain;
                ta.dispatchEvent(new Event('input'));
            }
        }

        const insertBtn = document.getElementById('warmup-insert-btn');
        if (insertBtn) {
            const originalText = insertBtn.textContent;
            insertBtn.textContent = '✓ Inserted!';
            setTimeout(() => { insertBtn.textContent = originalText; }, 2000);
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.MyProjectEditorManager;
}
