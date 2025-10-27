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

        tinymce.init({
            selector: '#main-editor', // From index.html
            plugins: 'lists link wordcount',
            toolbar: 'undo redo | bold italic underline | bullist numlist | link',
            menubar: false,
            statusbar: true,
            content_css: false,
            content_style: ` body { font-family: 'Vollkorn', serif; font-size: ${AppConstants.EDITOR_DEFAULT_FONT_SIZE}; line-height: ${AppConstants.EDITOR_DEFAULT_LINE_HEIGHT}; background-color: ${AppConstants.EDITOR_BACKGROUND_COLOR}; padding: 2em; }`,
            height: "100%",
            width: "100%",
            setup: (editor) => {
                this.tinymceEditor = editor;
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
    },

    /**
     * Opens the editor for the given node.
     * @param {Object} node - The node object to be edited.
     */
    openEditorMode: function(node) {
        if (!this.uiManager || !this.tinymceEditor) {
            console.error("EditorManager or UIManager not fully initialized for openEditorMode");
            return;
        }

        this.stateManager.setSelectedNode(node);
        // The UIManager will now get the selected node from the state manager
        // this.uiManager.updateSelectedNodeReference(node); // This is no longer needed

        if (this.uiManager.editorMode) {
            this.uiManager.editorMode.classList.remove('hidden');
        }

        this.tinymceEditor.setContent(node.content || '');
        this.uiManager.updateEditorWordCount(node.content || '');
        if (this.uiManager.renderTags) this.uiManager.renderTags(node);
        this.tinymceEditor.focus();
    },

    /**
     * Closes the editor, saving any changes made to the current node.
     */
    closeEditorMode: function() {
        if (!this.uiManager || !this.dataStorage || !this.drawFunction || !this.tinymceEditor) {
            console.error("EditorManager not fully initialized for closeEditorMode");
            return;
        }

        const selectedNode = this.stateManager.getSelectedNode();
        if (selectedNode) {
            selectedNode.content = this.tinymceEditor.getContent();
            this.dataStorage.saveNodes(this.stateManager.getRootNodes());
        }

        if (this.uiManager.editorMode) {
            this.uiManager.editorMode.classList.add('hidden');
        }
        this.drawFunction();
    },

    /**
     * Checks if the TinyMCE editor is currently open (visible).
     * @returns {boolean} True if the editor is open, false otherwise.
     */
    isEditorOpen: function() {
        return this.uiManager && this.uiManager.editorMode && !this.uiManager.editorMode.classList.contains('hidden');
    }
};
