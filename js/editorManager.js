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
        // Try to initialize TinyMCE, but don't let its absence break the app.
        this.tinyMCEAvailable = false;
        try {
            if (typeof tinymce !== 'undefined' && tinymce && typeof tinymce.init === 'function') {
                tinymce.init({
                    selector: '#main-editor', // From index.html
                    plugins: 'lists link wordcount',
                    toolbar: 'undo redo | bold italic underline | bullist numlist | link',
                    menubar: true,
                    statusbar: true,
                    content_css: false,
                    content_style: ` body { font-family: 'Vollkorn', serif; font-size: ${AppConstants.EDITOR_DEFAULT_FONT_SIZE}; line-height: ${AppConstants.EDITOR_DEFAULT_LINE_HEIGHT}; background-color: ${AppConstants.EDITOR_BACKGROUND_COLOR}; padding: 2em; }`,
                    height: "100%",
                    width: "100%",
                    setup: (editor) => {
                        this.tinymceEditor = editor;
                        this.tinyMCEAvailable = true;
                        editor.on('keydown', (e) => {
                            if (e.key === AppConstants.KEY_ESCAPE) {
                                e.stopPropagation();
                                this.closeEditorMode();
                            }
                        });
                        editor.on('input', () => {
                            this.uiManager.updateEditorWordCount(this.tinymceEditor.getContent());
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
                const selHtml = this.tinymceEditor.selection.getContent({ format: 'html' }) || '';
                const selText = this.tinymceEditor.selection.getContent({ format: 'text' }) || '';
                const wrapped = `<span id="${spanId}" class="comment-highlight">${selHtml}</span>`;
                this.tinymceEditor.selection.setContent(wrapped);
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
            const wrapped = `<span id="${spanId}" class="comment-highlight">${sel}</span>`;
            ta.value = ta.value.substring(0, start) + wrapped + ta.value.substring(end);
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
                const selHtml = this.tinymceEditor.selection.getContent({ format: 'html' }) || '';
                const selText = this.tinymceEditor.selection.getContent({ format: 'text' }) || '';
                const wrapped = `<span id="${spanId}" class="certified-word">${selHtml}</span>`;
                this.tinymceEditor.selection.setContent(wrapped);
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
            const wrapped = `<span id="${spanId}" class="certified-word">${sel}</span>`;
            ta.value = ta.value.substring(0, start) + wrapped + ta.value.substring(end);
            if (this.uiManager && typeof this.uiManager.openCertifyModal === 'function') {
                this.uiManager.openCertifyModal(spanId, sel);
            }
        } catch (err) {
            console.error('[editor] fallback certify insertion failed', err);
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
        // The UIManager will now get the selected node from the state manager
        // this.uiManager.updateSelectedNodeReference(node); // This is no longer needed

        if (this.uiManager.editorMode) {
            this.uiManager.editorMode.classList.remove('hidden');
        }

        // Ensure the inspector/sidebar is visible when the editor opens
        try {
            if (this.uiManager && this.uiManager.editorInspectorSidebar) {
                this.uiManager.editorInspectorSidebar.classList.remove('hidden');
            }
        } catch (err) { console.warn('[editor] failed to show inspector sidebar', err); }

        // If TinyMCE is available and initialized, use it. Otherwise fall back to
        // a simple textarea so the editor can still be used.
        if (this.tinyMCEAvailable && this.tinymceEditor) {
            try {
                this.tinymceEditor.setContent(node.content || '');
                this.uiManager.updateEditorWordCount(node.content || '');
                if (this.uiManager.renderTags) this.uiManager.renderTags(node);
                if (this.uiManager.renderFootnotes) this.uiManager.renderFootnotes(node);
                // Attach hover tooltip listeners inside TinyMCE document to show comment/certify previews
                try {
                    const doc = this.tinymceEditor.getDoc();
                    const hoverHandler = (ev) => {
                        try {
                            const target = ev.target;
                            if (!target) return;
                            if (target.classList && target.classList.contains('comment-highlight')) {
                                const text = target.textContent || '';
                                if (this.uiManager && typeof this.uiManager._showHoverTooltip === 'function') this.uiManager._showHoverTooltip(text, ev.clientX, ev.clientY);
                                return;
                            }
                            if (target.classList && target.classList.contains('certified-word')) {
                                const def = target.getAttribute('data-definition') || '';
                                const text = (target.textContent || '') + (def ? ' — ' + def : '');
                                if (this.uiManager && typeof this.uiManager._showHoverTooltip === 'function') this.uiManager._showHoverTooltip(text, ev.clientX, ev.clientY);
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
            ta.focus();
        } catch (err) {
            console.error('[editor] fallback textarea failed:', err);
        }
    },

    /**
     * Closes the editor, saving any changes made to the current node.
     */
    closeEditorMode: function() {
        if (!this.uiManager || !this.dataStorage || !this.drawFunction) {
            console.error("EditorManager not fully initialized for closeEditorMode");
            return;
        }

        const selectedNode = this.stateManager.getSelectedNode();
        if (selectedNode) {
            try {
                if (this.tinymceEditor && this.tinyMCEAvailable) {
                    selectedNode.content = this.tinymceEditor.getContent();
                } else {
                    const ta = document.getElementById('main-editor-fallback');
                    selectedNode.content = ta ? ta.value : (selectedNode.content || '');
                }
                // Persist changes
                if (typeof this.dataStorage.saveNodes === 'function') {
                    this.dataStorage.saveNodes(this.stateManager.getRootNodes());
                }
            } catch (err) {
                console.error('[editor] error saving content on closeEditorMode', err);
            }
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
        try { this.drawFunction(); } catch (err) { /* ignore draw errors */ }
    },

    /**
     * Checks if the TinyMCE editor is currently open (visible).
     * @returns {boolean} True if the editor is open, false otherwise.
     */
    isEditorOpen: function() {
        return this.uiManager && this.uiManager.editorMode && !this.uiManager.editorMode.classList.contains('hidden');
    }
};
