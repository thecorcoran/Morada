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
                    toolbar: 'undo redo | bold italic underline | bullist numlist | link',
                    menubar: true,
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
                        editor.on('keydown', (e) => {
                            if (e.key === 'F11' || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f')) {
                                e.preventDefault();
                                this.toggleFullView();
                            }
                            if (typeof AppConstants !== 'undefined' && e.key === AppConstants.KEY_ESCAPE) {
                                e.stopPropagation();
                                if (this.isFullView) {
                                    this.toggleFullView(false);
                                } else {
                                    this.closeEditorMode();
                                }
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

        if (!this._documentKeyListenersAttached && typeof document !== 'undefined') {
            this._documentKeyListenersAttached = true;
            document.addEventListener('keydown', (e) => {
                if (!this.isEditorOpen()) return;
                if (e.key === 'F11' || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f')) {
                    e.preventDefault();
                    this.toggleFullView();
                } else if (e.key === 'Escape' && this.isFullView) {
                    e.preventDefault();
                    this.toggleFullView(false);
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

        // Populate Craft Drawer panels
        this.renderCraftCertifiedList(node);
        this.updateStrunkMetrics(node ? (node.content || '') : '');
        this.initScenicMaxims();

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
            };
            ta.focus();
        } catch (err) {
            console.error('[editor] fallback textarea failed:', err);
        }
    },

    /**
     * Closes the editor, saving any changes made to the current node without Strunk markers.
     */
    closeEditorMode: function() {
        if (!this.uiManager || !this.dataStorage || !this.drawFunction) {
            console.error("EditorManager not fully initialized for closeEditorMode");
            return;
        }

        const selectedNode = this.stateManager ? this.stateManager.getSelectedNode() : null;
        if (selectedNode) {
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
                }
            } catch (err) {
                console.error('[editor] error saving content on closeEditorMode', err);
            }
        }

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
            const item = document.createElement('div');
            item.className = 'scenic-maxim-item' + (isChecked ? ' applied' : '');

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = isChecked;
            chk.addEventListener('change', (e) => {
                e.stopPropagation();
                this.toggleScenicMaximCheck(maxim.id);
            });

            const num = document.createElement('span');
            num.className = 'scenic-maxim-num';
            num.textContent = `#${maxim.id}`;

            const text = document.createElement('span');
            text.className = 'scenic-maxim-text';
            text.textContent = maxim.text;

            item.appendChild(chk);
            item.appendChild(num);
            item.appendChild(text);

            item.addEventListener('click', (e) => {
                if (e.target !== chk) {
                    chk.checked = !chk.checked;
                    this.toggleScenicMaximCheck(maxim.id);
                }
            });

            container.appendChild(item);
        });
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.MyProjectEditorManager;
}
