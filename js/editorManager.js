if (typeof window === 'undefined') {
    global.window = global;
}

const CraftDrawerManager = (typeof require !== 'undefined') ? require('./craftDrawerManager.js') : (window.CraftDrawerManager || {});

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
        this._initFormattingControls();

        // Ensure clicking on editor background transfers focus directly to active editor
        try {
            const editorMain = document.getElementById('editor-main-content');
            if (editorMain && !editorMain._hasFocusTransferHandler) {
                editorMain._hasFocusTransferHandler = true;
                editorMain.addEventListener('click', (e) => {
                    if (e.target === editorMain) {
                        if (this.isTinyMCEActive() && typeof this.tinymceEditor.focus === 'function') {
                            this.tinymceEditor.focus();
                        } else {
                            const ta = this.getTextareaElement();
                            if (ta) ta.focus();
                        }
                    }
                });
            }
        } catch (e) {}

        // Native Scholar Textarea is the resilient foundation across desktop and mobile.
        this.tinyMCEAvailable = false;
    },

    /**
     * Checks if current environment is a mobile viewport or mobile touch device.
     * Guaranteed false in Electron desktop app to preserve full desktop features.
     * @returns {boolean}
     */
    isMobileMode: function() {
        if (typeof window === 'undefined') return false;
        // Check window width: if mobile phone/tablet screen (<= 768px), it's mobile mode
        const width = typeof window.innerWidth === 'number' ? window.innerWidth : 1024;
        if (width <= 768) return true;
        const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
        const isMobileUA = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        if (isMobileUA && width <= 1024) return true;
        return false;
    },

    /**
     * Checks if TinyMCE is fully initialized, ready, and actively visible in the DOM.
     * @returns {boolean}
     */
    isTinyMCEActive: function() {
        if (this.isMobileMode() || !this.tinyMCEAvailable || !this.tinymceEditor) return false;
        try {
            const container = (this.tinymceEditor && this.tinymceEditor.editorContainer)
                || (typeof document !== 'undefined' ? document.querySelector('.tox.tox-tinymce') : null);
            return Boolean(container && container.style.display !== 'none');
        } catch (e) {
            return false;
        }
    },

    /**
     * Helper to retrieve the active raw textarea element (#main-editor or #main-editor-fallback).
     * @returns {HTMLTextAreaElement|null}
     */
    getTextareaElement: function() {
        return (typeof document !== 'undefined')
            ? (document.getElementById('main-editor') || document.getElementById('main-editor-fallback'))
            : null;
    },

    /**
     * Initializes the TinyMCE editor instance. Safe to call multiple times or upon CDN script load.
     * On mobile browsers, TinyMCE iframe is bypassed in favor of native mobile textarea.
     */
    initTinyMCE: function() {
        if (this.isMobileMode()) {
            return;
        }
        if (this._tinymceInitStarted || (this.tinymceEditor && this.tinyMCEAvailable)) {
            return;
        }
        if (typeof tinymce === 'undefined' || !tinymce || typeof tinymce.init !== 'function') {
            console.warn('[editor] TinyMCE not available; falling back to textarea editor');
            return;
        }

        this._tinymceInitStarted = true;
        this.tinyMCEAvailable = false;
        try {
            const isFileProtocol = (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:');
            const baseUrl = (typeof tinymce !== 'undefined' && tinymce.baseURL && tinymce.baseURL !== (typeof window !== 'undefined' && window.location ? window.location.origin : ''))
                ? tinymce.baseURL
                : (isFileProtocol ? 'node_modules/tinymce' : 'https://cdnjs.cloudflare.com/ajax/libs/tinymce/7.1.2');

            tinymce.init({
                selector: '#main-editor', // From index.html
                license_key: 'gpl',
                base_url: baseUrl,
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
                    @media (max-width: 600px) {
                        body {
                            padding: 1rem 0.8rem !important;
                            font-size: 16px !important;
                        }
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
                    // Do NOT mark available until 'init' event confirms UI and body are ready
                    this.tinyMCEAvailable = false;
                    this._tinymceInitStarted = false;

                    // Register custom Scholar's Desk icons
                    editor.ui.registry.addIcon('craft-quill', '<svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M3 21v-3l11-11 3 3L6 21H3Zm14.7-12.3-3-3L16.4 4a1.4 1.4 0 0 1 2 0l1.6 1.6a1.4 1.4 0 0 1 0 2l-2.3 2.1Z"/></svg>');
                    editor.ui.registry.addIcon('craft-book', '<svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M19 2H6a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h13a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1ZM6 4h12v12H6a1 1 0 0 1-1-.1V5a1 1 0 0 1 1-1Zm12 16H6a1 1 0 0 1 0-2h12v2Z"/></svg>');
                    editor.ui.registry.addIcon('craft-drawer', '<svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm0 6H5V5h14v4Zm-5 2v2h-4v-2h4Zm5 8H5v-4h4v1a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1h4v4Z"/></svg>');
                    editor.ui.registry.addIcon('craft-save', '<svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2ZM5 5v14h14V7.8L16.2 5H5Zm2 2h8v3H7V7Zm0 7h10v5H7v-5Z"/></svg>');
                    editor.ui.registry.addIcon('craft-comment', '<svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>');
                    editor.ui.registry.addIcon('craft-fullscreen', '<svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>');

                    // Handle resource load errors gracefully
                    editor.on('SkinLoadError ThemeLoadError PluginLoadError Error', (e) => {
                        console.warn('[editor] TinyMCE resource error, remaining on native textarea:', e);
                        this.tinyMCEAvailable = false;
                        try {
                            const tox = editor.editorContainer || document.querySelector('.tox.tox-tinymce');
                            if (tox) tox.style.display = 'none';
                            const editorMain = document.getElementById('editor-main-content');
                            if (editorMain) editorMain.classList.remove('tinymce-active');
                            const ta = this.getTextareaElement();
                            if (ta && this.isEditorOpen()) {
                                ta.style.display = 'block';
                                ta.focus();
                            }
                        } catch (err) {}
                    });

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
                        this.tinyMCEAvailable = true;
                        this._tinymceInitStarted = false;
                        try {
                            const editorMain = document.getElementById('editor-main-content');
                            if (editorMain) editorMain.classList.add('tinymce-active');

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

                        // If editor mode was already opened before TinyMCE finished initializing, smoothly activate TinyMCE
                        if (this.isEditorOpen() && !this.isMobileMode()) {
                            try {
                                const tox = editor.editorContainer || document.querySelector('.tox.tox-tinymce');
                                const ta = this.getTextareaElement();
                                const currentContent = ta ? ta.value : '';

                                if (tox && typeof editor.getBody === 'function' && editor.getBody()) {
                                    tox.style.display = 'flex';
                                    if (ta) ta.style.display = 'none';

                                    const selectedNode = this.stateManager ? this.stateManager.getSelectedNode() : null;
                                    const contentToLoad = currentContent || (selectedNode ? (selectedNode.content || '') : '');
                                    editor.setContent(contentToLoad);
                                    if (this.uiManager && typeof this.uiManager.updateEditorWordCount === 'function') {
                                        this.uiManager.updateEditorWordCount(contentToLoad);
                                    }
                                    if (selectedNode) {
                                        if (this.uiManager && this.uiManager.renderTags) this.uiManager.renderTags(selectedNode);
                                        if (this.uiManager && this.uiManager.renderFootnotes) this.uiManager.renderFootnotes(selectedNode);
                                    }
                                    this.applyStrunkHighlights();
                                    editor.focus();
                                }
                            } catch (e) {
                                console.warn('[editor] populate on late init failed', e);
                            }
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
        } catch (err) {
            console.error('[editor] TinyMCE init failed:', err);
            this.tinyMCEAvailable = false;
            this._tinymceInitStarted = false;
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
            if (this.isTinyMCEActive()) {
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
            const ta = this.getTextareaElement();
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
            if (this.isTinyMCEActive()) {
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
            const ta = this.getTextareaElement();
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
            if (this.isTinyMCEActive()) {
                selText = (this.tinymceEditor.selection.getContent({ format: 'text' }) || '').trim();
            }
        } catch (err) {
            console.warn('[editor] TinyMCE get selection failed', err);
        }

        if (!selText) {
            try {
                const ta = this.getTextareaElement();
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
            if (this.isTinyMCEActive()) {
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
            const ta = this.getTextareaElement();
            if (!ta) return;
            const re = new RegExp(`<span[^>]*id="${spanId}"[^>]*>([\\s\\S]*?)<\\/span>`, 'i');
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
     * Initializes formatting toolbar buttons (bold, italic, h2, quote, bullet)
     */
    _initFormattingControls: function() {
        const formatTypes = [
            { id: 'editor-bold-btn', type: 'bold' },
            { id: 'editor-italic-btn', type: 'italic' },
            { id: 'editor-h2-btn', type: 'h2' },
            { id: 'editor-quote-btn', type: 'quote' },
            { id: 'editor-bullet-btn', type: 'bullet' }
        ];

        formatTypes.forEach(({ id, type }) => {
            const btn = document.getElementById(id);
            if (btn && !btn._hasFormatListener) {
                btn._hasFormatListener = true;
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.applyFormatting(type);
                });
            }
        });
    },

    /**
     * Applies text formatting either via TinyMCE commands or fallback textarea markdown wrappers.
     * @param {string} type - 'bold', 'italic', 'h2', 'quote', 'bullet'
     */
    applyFormatting: function(type) {
        if (this.isTinyMCEActive()) {
            try {
                switch (type) {
                    case 'bold':
                        this.tinymceEditor.execCommand('Bold');
                        break;
                    case 'italic':
                        this.tinymceEditor.execCommand('Italic');
                        break;
                    case 'h2':
                        this.tinymceEditor.execCommand('FormatBlock', false, 'h2');
                        break;
                    case 'quote':
                        this.tinymceEditor.execCommand('FormatBlock', false, 'blockquote');
                        break;
                    case 'bullet':
                        this.tinymceEditor.execCommand('InsertUnorderedList');
                        break;
                }
                this.tinymceEditor.focus();
                return;
            } catch (err) {
                console.warn('[editor] TinyMCE execCommand failed', err);
            }
        }

        // Fallback textarea formatting
        const ta = this.getTextareaElement();
        if (!ta) return;
        const start = ta.selectionStart != null ? ta.selectionStart : 0;
        const end = ta.selectionEnd != null ? ta.selectionEnd : start;
        const val = ta.value || '';
        const selectedText = val.substring(start, end);
        let replacement = '';

        switch (type) {
            case 'bold':
                replacement = `**${selectedText || 'bold text'}**`;
                break;
            case 'italic':
                replacement = `*${selectedText || 'italic text'}*`;
                break;
            case 'h2':
                replacement = selectedText ? `\n## ${selectedText}\n` : `\n## Heading\n`;
                break;
            case 'quote':
                replacement = selectedText ? `\n> ${selectedText}\n` : `\n> Quote\n`;
                break;
            case 'bullet':
                if (selectedText) {
                    replacement = '\n' + selectedText.split('\n').map(line => `- ${line}`).join('\n') + '\n';
                } else {
                    replacement = `\n- Item\n`;
                }
                break;
            default:
                return;
        }

        if (typeof ta.setRangeText === 'function') {
            ta.setRangeText(replacement, start, end, 'end');
        } else {
            ta.value = val.substring(0, start) + replacement + val.substring(end);
        }
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.focus();
    },
    // --- Craft Drawer, Strunk Metrics & Scenic Maxims are modularized in CraftDrawerManager ---


    /**
     * Opens the editor for the given node.
     * @param {Object} node - The node object to be edited.
     */
    openEditorMode: function(node) {
        if (!this.uiManager) {
            console.error("EditorManager not fully initialized (missing uiManager) for openEditorMode");
            return;
        }

        this.stateManager.setSelectedNode(node);

        // Update breadcrumb in editor toolbar
        const breadcrumbEl = document.getElementById('editor-breadcrumb-label');
        if (breadcrumbEl) {
            let path = 'The Desk';
            const viewStack = (this.stateManager && typeof this.stateManager.getViewStack === 'function') ? this.stateManager.getViewStack() : [];
            viewStack.forEach(stNode => {
                if (stNode && stNode.title && (!node || stNode.id !== node.id)) {
                    path += ` / ${stNode.title}`;
                }
            });
            if (node && node.title) {
                path += ` / ${node.title}`;
            }
            breadcrumbEl.textContent = path;
            breadcrumbEl.title = path;
        }

        const editorMode = (this.uiManager && this.uiManager.editorMode)
            ? this.uiManager.editorMode
            : (typeof document !== 'undefined' ? document.getElementById('editor-mode') : null);
        if (editorMode) {
            editorMode.classList.remove('hidden');
        }

        // Initialize Craft Drawer controls
        this.initCraftDrawer();

        // Ensure Craft Drawer is visible on desktop, but start hidden on mobile so editor is immediately usable
        const isMobile = this.isMobileMode();
        // Ensure Craft Drawer is visible on desktop, but start hidden on mobile so editor is immediately usable
        try {
            if (this.uiManager && this.uiManager.editorInspectorSidebar) {
                if (isMobile) {
                    this.uiManager.editorInspectorSidebar.classList.add('hidden');
                } else {
                    this.uiManager.editorInspectorSidebar.classList.remove('hidden');
                }
            }
        } catch (err) { console.warn('[editor] failed to adjust inspector sidebar', err); }

        const isSidebarOpen = Boolean(this.uiManager && this.uiManager.editorInspectorSidebar && !this.uiManager.editorInspectorSidebar.classList.contains('hidden'));
        const toggleBtn = document.getElementById('toggle-craft-drawer-btn');
        if (toggleBtn) toggleBtn.textContent = isSidebarOpen ? 'Craft Drawer ▾' : 'Craft Drawer ▸';

        if (this._tinymceCraftDrawerApi && typeof this._tinymceCraftDrawerApi.setActive === 'function') {
            this._tinymceCraftDrawerApi.setActive(isSidebarOpen);
        }
        if (this._tinymceFullViewApi && typeof this._tinymceFullViewApi.setActive === 'function') {
            this._tinymceFullViewApi.setActive(Boolean(this.isFullView));
        }

        // Populate Craft Drawer panels
        this.renderCraftCertifiedList(node);
        this.updateStrunkMetrics(node ? (node.content || '') : '');
        this.initScenicMaxims();
        this.drawRandomWarmUpPassage();

        // Native Scholar Textarea (reliable, ultra-responsive typing across desktop and mobile)
        try {
            const editorMain = document.getElementById('editor-main-content');
            if (editorMain) editorMain.classList.remove('tinymce-active');

            // Hide any broken or lingering TinyMCE wrapper
            const tox = (typeof document !== 'undefined' && typeof document.querySelector === 'function')
                ? document.querySelector('.tox.tox-tinymce')
                : null;
            if (tox) tox.style.display = 'none';

            let ta = this.getTextareaElement();
            if (!ta) {
                ta = document.createElement('textarea');
                ta.id = 'main-editor';
                const container = editorMain || document.body;
                container.appendChild(ta);
            }
            ta.classList.remove('hidden');
            ta.style.display = 'block';
            ta.disabled = false;
            ta.readOnly = false;
            ta.value = node ? (node.content || '') : '';
            this.uiManager.updateEditorWordCount(ta.value);
            if (this.uiManager.renderTags) this.uiManager.renderTags(node);
            if (this.uiManager.renderFootnotes) this.uiManager.renderFootnotes(node);

            ta.oninput = () => {
                const clean = (window.MyProjectStrunkEngine && typeof window.MyProjectStrunkEngine.cleanStrunkMarkers === 'function')
                    ? window.MyProjectStrunkEngine.cleanStrunkMarkers(ta.value)
                    : ta.value;
                if (node) node.content = clean;
                if (this.uiManager && typeof this.uiManager.updateEditorWordCount === 'function') {
                    this.uiManager.updateEditorWordCount(clean);
                }
                this.updateStrunkMetrics(clean);
                this._scheduleAutoSave();
            };

            ta.onkeydown = (e) => {
                if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
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
                    } else {
                        this.closeEditorMode();
                    }
                    return;
                }
                if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'b') {
                    e.preventDefault();
                    this.applyFormatting('bold');
                } else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'i') {
                    e.preventDefault();
                    this.applyFormatting('italic');
                } else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'm') {
                    e.preventDefault();
                    this.addCommentAtSelection();
                } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') {
                    e.preventDefault();
                    this.certifySelection();
                } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'e') {
                    e.preventDefault();
                    this.lookupEtymologyAtSelection();
                } else if (e.key === 'F11' || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f')) {
                    e.preventDefault();
                    this.toggleFullView();
                }
            };

            setTimeout(() => {
                try {
                    ta.focus();
                    const len = ta.value.length;
                    ta.setSelectionRange(len, len);
                } catch (err) {}
            }, 50);
        } catch (err) {
            console.error('[editor] openEditorMode failed:', err);
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
            const tox = (typeof document !== 'undefined' && typeof document.querySelector === 'function')
                ? document.querySelector('.tox.tox-tinymce')
                : null;
            const isToxVisible = Boolean(tox && tox.style.display !== 'none');
            const isTinyMCEActive = !this.isMobileMode() && this.tinymceEditor && this.tinyMCEAvailable && isToxVisible;

            if (isTinyMCEActive) {
                content = this.tinymceEditor.getContent();
            } else {
                const ta = this.getTextareaElement();
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
        const editorMode = (this.uiManager && this.uiManager.editorMode)
            ? this.uiManager.editorMode
            : (typeof document !== 'undefined' ? document.getElementById('editor-mode') : null);
        if (editorMode) {
            editorMode.classList.add('hidden');
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
        if (this.uiManager && this.uiManager.editorMode) {
            return !this.uiManager.editorMode.classList.contains('hidden');
        }
        if (typeof document !== 'undefined') {
            const em = document.getElementById('editor-mode');
            return Boolean(em && !em.classList.contains('hidden'));
        }
        return false;
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
    }
};

Object.assign(window.MyProjectEditorManager, CraftDrawerManager);

if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.MyProjectEditorManager;
}
