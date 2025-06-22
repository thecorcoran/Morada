// editorManager.js
// This module is responsible for managing the TinyMCE editor instance,
// its state (open/closed), and interactions related to editing node content.
console.log("editorManager.js loaded");

window.MyProjectEditorManager = {
    /** @type {tinymce.Editor|null} Holds the TinyMCE editor instance. */
    tinymceEditor: null, 

    // --- Injected Dependencies (set via init) ---
    /** 
     * @type {{ node: Object|null }} 
     * A reference object to get/set the currently selected node in the main application (renderer.js). 
     */
    selectedNodeRef: null, 
    /** 
     * @type {{ nodes: Array<Object> }} 
     * A reference object to get the rootNodes array from the main application. 
     */
    rootNodesRef: null,    
    
    /** @type {object|null} Direct reference to UIManager. */
    uiManager: window.MyProjectUIManager, 
    /** @type {object|null} Direct reference to DataStorage. */
    dataStorage: window.MyProjectDataStorage, 
    /** @type {Function|null} Function from renderer.js to trigger a canvas redraw. */
    drawFunction: null, 

    /**
     * Initializes the EditorManager and the TinyMCE editor instance.
     * @param {Object} config - Configuration object.
     * @param {{ node: Object|null }} config.selectedNodeRef - Reference object for the selected node.
     * @param {{ nodes: Array<Object> }} config.rootNodesRef - Reference object for the root nodes array.
     * @param {Function} config.drawFunction - Callback to redraw the main canvas.
     */
    init: function(config) {
        this.selectedNodeRef = config.selectedNodeRef;
        this.rootNodesRef = config.rootNodesRef;
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
                    // Update word count via UIManager
                    if (this.selectedNodeRef.node && this.tinymceEditor && this.tinymceEditor.plugins.wordcount && this.uiManager && this.uiManager.editorWordCount) {
                        const wordCount = this.tinymceEditor.plugins.wordcount.body.getWordCount();
                        this.uiManager.editorWordCount.textContent = `Words: ${wordCount}`;
                    }
                    // Call onContentChangeFn if it were passed in init, for more generic callback
                });
            }
        });
    },

    /**
     * Opens the editor for the given node.
     * @param {Object} node - The node object to be edited.
     * Note: The prompt signature mentioned editorModeEl, etc. This implementation uses uiManager for DOM.
     */
    openEditorMode: function(node) { 
        if (!this.uiManager || !this.tinymceEditor) {
            console.error("EditorManager or UIManager not fully initialized for openEditorMode");
            return;
        }
        
        this.selectedNodeRef.node = node; 
        this.uiManager.updateSelectedNodeReference(node); // Keep UIManager's direct ref in sync

        if (this.uiManager.editorMode) { // editorMode is the div container from UIManager
            this.uiManager.editorMode.classList.remove('hidden');
        }

        this.tinymceEditor.setContent(node.content || '');
        
        if (this.uiManager.editorWordCount && this.uiManager.getWordCount) {
            this.uiManager.editorWordCount.textContent = `Words: ${this.uiManager.getWordCount(node.content)}`;
        }
        if (this.uiManager.renderTags) this.uiManager.renderTags(node); 
        this.tinymceEditor.focus();
    },

    /**
     * Closes the editor, saving any changes made to the current node.
     * Note: The prompt signature mentioned editorModeEl. This implementation uses uiManager for DOM.
     */
    closeEditorMode: function() {
        if (!this.uiManager || !this.dataStorage || !this.drawFunction || !this.tinymceEditor) {
            console.error("EditorManager not fully initialized for closeEditorMode");
            return;
        }

        if (this.selectedNodeRef.node) { 
            this.selectedNodeRef.node.content = this.tinymceEditor.getContent();
            this.dataStorage.saveNodes(this.rootNodesRef.nodes); 
        }

        if (this.uiManager.editorMode) { // editorMode is the div container from UIManager
            this.uiManager.editorMode.classList.add('hidden');
        }
        this.drawFunction(); 
    },

    /**
     * Checks if the TinyMCE editor is currently open (visible).
     * @returns {boolean} True if the editor is open, false otherwise.
     */
    isEditorOpen: function() {
        // Relies on UIManager managing the visibility of the editorMode container
        return this.uiManager && this.uiManager.editorMode && !this.uiManager.editorMode.classList.contains('hidden');
    }
};
console.log("editorManager.js JSDoc comments added.");
