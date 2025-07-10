// editorManager.js
// This module is responsible for managing the TinyMCE editor instance,
// its state (open/closed), and interactions related to editing node content.
console.log("editorManager.js loaded");

import { EditorConstants, KeyConstants } from './constants.js';
import { dataStorageManager } from './dataStorage.js';
import { timerManager } from './timerManager.js';

export const editorManager = {
    /** @type {tinymce.Editor|null} Holds the TinyMCE editor instance. */
    tinymceEditor: null, 
    /** @type {boolean} Tracks if typewriter mode is active. */
    isTypewriterModeActive: false,

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
    /** @type {object|null} A direct reference to the UIManager instance. */
    uiManager: null,
    /** @type {object|null} A direct reference to the ModalManager instance. */
    modalManager: null,
    /** @type {Function|null} Function from renderer.js to trigger a canvas redraw. */
    drawFunction: null, 
    /** @private @type {Function|null} Holds the bound event handler for typewriter mode. */
    _typewriterScrollHandler: null,

    /**
     * Initializes the EditorManager and the TinyMCE editor instance.
     * @param {Object} config - Configuration object.
     * @param {{ node: Object|null }} config.selectedNodeRef - Reference object for the selected node.
     * @param {{ nodes: Array<Object> }} config.rootNodesRef - Reference object for the root nodes array.
     * @param {Function} config.drawFunction - Callback to redraw the main canvas.
     * @param {object} config.uiManager - The application's UIManager instance.
     * @param {object} config.modalManager - The application's ModalManager instance.
     */
    init: function(config) {
        this.selectedNodeRef = config.selectedNodeRef;
        this.rootNodesRef = config.rootNodesRef;
        this.drawFunction = config.drawFunction;
        this.uiManager = config.uiManager;
        this.modalManager = config.modalManager;

        tinymce.init({
            selector: '#main-editor', // From index.html
            plugins: 'lists link wordcount fullscreen',
            toolbar: 'undo redo | bold italic underline | bullist numlist | link | toggleToolsPane | toggletypewritermode | fullscreen',
            contextmenu: 'link | addcomment certifyword | lookupetymology',
            menubar: false,
            statusbar: true,
            content_css: false, 
            content_style: `
                body { font-family: 'Vollkorn', serif; font-size: ${EditorConstants.DEFAULT_FONT_SIZE}; line-height: ${EditorConstants.DEFAULT_LINE_HEIGHT}; background-color: ${EditorConstants.BACKGROUND_COLOR}; padding: 2em; }
                body.typewriter-mode { padding-top: 50vh; padding-bottom: 50vh; } /* Add padding for typewriter mode */
                .certified-word { background-color: #e6ffed; cursor: pointer; }
                .comment-highlight { background-color: #fff8c4; cursor: pointer; }
                .flash { animation: flash-animation 1s; }
                @keyframes flash-animation { 
                    0% { background-color: #ffc107; } 
                    100% { background-color: #fff8c4; } 
                }`,
            height: "100%",
            width: "100%",
            setup: (editor) => {
                this.tinymceEditor = editor; 

                // Add custom button for Tools Pane
                editor.ui.registry.addButton('toggleToolsPane', {
                    text: 'Tools',
                    tooltip: 'Toggle Tools Pane',
                    onAction: () => {
                        if (this.uiManager) {
                            this.uiManager.toggleInspectorSidebar();
                        }
                    }
                });

                // Add custom button for Typewriter Mode
                editor.ui.registry.addToggleButton('toggletypewritermode', {
                    text: 'Typewriter',
                    tooltip: 'Toggle Typewriter Mode',
                    icon: 'text-direction-ltr', // A fitting icon
                    onAction: (api) => {
                        this.toggleTypewriterMode();
                        api.setActive(this.isTypewriterModeActive);
                        if (this.isTypewriterModeActive) {
                            this.tinymceEditor.focus();
                        }
                    }
                });

                // Register a custom menu item for Adding/Editing a Comment
                editor.ui.registry.addMenuItem('addcomment', {
                    text: 'Add/Edit Comment',
                    icon: 'comment',
                    onAction: () => {
                        const selection = editor.selection;
                        const selectedNode = selection.getNode();
                        
                        // Check if we are inside an existing comment span
                        const commentSpan = editor.dom.getParent(selectedNode, 'span.comment-highlight');

                        if (commentSpan) {
                            // We are editing an existing comment
                            const commentId = commentSpan.id;
                            const textContent = commentSpan.textContent;
                            this.modalManager.showCommentModal(commentId, textContent);
                        } else {
                            // We are adding a new comment
                            const selectedText = selection.getContent({ format: 'text' }).trim();
                            if (!selectedText) return; // Should be disabled, but as a safeguard
                            
                            const commentId = `comment-${Date.now()}`;
                            const newComment = { id: commentId, text: '' }; // Start with empty text
                            
                            if (this.selectedNodeRef.node) {
                                if (!this.selectedNodeRef.node.comments) this.selectedNodeRef.node.comments = [];
                                this.selectedNodeRef.node.comments.push(newComment);
                                editor.execCommand('mceInsertContent', false, `<span class="comment-highlight" id="${commentId}">${selection.getContent()}</span>`);
                                this.modalManager.showCommentModal(commentId, selectedText);
                            }
                        }
                    },
                    onSetup: (api) => {
                        // The onSetup should be used for listeners that affect the menu item's state.
                        // Since setDisabled is not available, we handle the logic in onAction.
                        // This keeps the menu item always enabled, and the action will simply do nothing if conditions aren't met.
                        const onNodeChange = () => {}; // Placeholder if needed for other state changes in the future.
                        editor.on('NodeChange', onNodeChange);
                        return () => editor.off('NodeChange', onNodeChange);
                    }
                });

                // Register a custom menu item for Certifying a Word
                editor.ui.registry.addMenuItem('certifyword', {
                    text: 'Certify Word',
                    icon: 'bookmark',
                    onAction: () => {
                        const selectedText = editor.selection.getContent({ format: 'text' }).trim();
                        if (selectedText) {
                            this.modalManager.showCertifyWordModal(selectedText);
                        }
                    },
                    onSetup: (api) => {
                        // onAction will handle the logic if no text is selected.
                        const onNodeChange = () => {};
                        editor.on('NodeChange', onNodeChange);
                        return () => editor.off('NodeChange', onNodeChange);
                    }
                });

                // Register a custom menu item for Etymology
                editor.ui.registry.addMenuItem('lookupetymology', {
                    text: 'Look up Etymology',
                    icon: 'search', // Using a built-in icon
                    onAction: () => {
                        const selectedText = editor.selection.getContent({ format: 'text' }).trim();
                        if (selectedText) {
                            this.modalManager.showEtymologyFor(selectedText);
                        }
                    }
                });

                editor.on('keydown', (e) => {
                    if (e.key === KeyConstants.ESCAPE) {
                        e.stopPropagation();
                        this.closeEditorMode();
                    }
                });
                editor.on('input', () => {
                    // Update word count via UIManager
                    if (this.selectedNodeRef.node && this.tinymceEditor && this.tinymceEditor.plugins.wordcount && this.uiManager) {
                        const wordCount = this.tinymceEditor.plugins.wordcount.body.getWordCount();
                        if (this.uiManager.editorWordCount) {
                            this.uiManager.editorWordCount.textContent = `Words: ${wordCount}`;
                        }
                        if (this.uiManager.updateWordGoalDisplay) {
                            this.uiManager.updateWordGoalDisplay(wordCount);
                        }
                    }
                });

                this._setupHoverTooltips(editor);
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

        // Show the footnotes pane when the editor opens
        if (this.uiManager && this.uiManager.editorFootnotesPane) {
            this.uiManager.editorFootnotesPane.classList.remove('hidden');
        }

        // Reset the timer whenever the editor is opened.
        timerManager.reset();

        this.tinymceEditor.setContent(node.content || '');
        this.applyAndRefreshCertifiedWordHighlights();
        
        if (this.uiManager.editorWordCount && this.uiManager.getWordCount) {
            const wordCount = this.uiManager.getWordCount(node.content);
            this.uiManager.editorWordCount.textContent = `Words: ${wordCount}`;
            if (this.uiManager.updateWordGoalDisplay) {
                this.uiManager.updateWordGoalDisplay(wordCount);
            }
        }
        if (this.uiManager.renderTags) this.uiManager.renderTags(node); 
        if (this.uiManager.renderEditorFootnotes) this.uiManager.renderEditorFootnotes(node);
        this.tinymceEditor.focus();
    },

    /**
     * Toggles typewriter mode on or off.
     */
    toggleTypewriterMode: function() {
        if (!this.tinymceEditor) return;
        this.isTypewriterModeActive = !this.isTypewriterModeActive;
        
        const editorBody = this.tinymceEditor.getBody();
        editorBody.classList.toggle('typewriter-mode', this.isTypewriterModeActive);

        if (this.isTypewriterModeActive) {
            this._attachTypewriterListener();
            // Initial centering when mode is activated
            this._centerCaretVertically(); 
        } else {
            this._detachTypewriterListener();
        }
    },

    /**
     * Attaches the event listener for typewriter mode scrolling.
     * @private
     */
    _attachTypewriterListener: function() {
        if (!this.tinymceEditor) return;
        // Create a bound function so 'this' is correct and we can remove it later.
        this._typewriterScrollHandler = this._centerCaretVertically.bind(this);
        this.tinymceEditor.on('NodeChange', this._typewriterScrollHandler);
    },

    /**
     * Detaches the event listener for typewriter mode.
     * @private
     */
    _detachTypewriterListener: function() {
        if (!this.tinymceEditor || !this._typewriterScrollHandler) return;
        this.tinymceEditor.off('NodeChange', this._typewriterScrollHandler);
        this._typewriterScrollHandler = null;
    },

    /**
     * The core logic for typewriter mode. It calculates and sets the scroll position
     * to keep the current text cursor vertically centered in the editor window.
     * @private
     */
    _centerCaretVertically: function() {
        if (!this.isTypewriterModeActive || !this.tinymceEditor) return;

        try {
            const editorWindow = this.tinymceEditor.getWin();
            const caretRect = this.tinymceEditor.selection.getRng().getClientRects();
            if (!caretRect || caretRect.length === 0) return; // No caret visible
            const caretTop = caretRect[0].top;
            const editorHeight = editorWindow.innerHeight;
            const currentScrollY = editorWindow.scrollY;
            const desiredScrollY = currentScrollY + caretTop - (editorHeight / 2);
            editorWindow.scrollTo({ top: desiredScrollY, left: 0, behavior: 'smooth' });
        } catch (e) {
            // This can happen if the editor is not fully focused or ready. It's safe to ignore.
        }
    },
    /**
     * Closes the editor, saving any changes made to the current node.
     * Note: The prompt signature mentioned editorModeEl. This implementation uses uiManager for DOM.
     */
    async closeEditorMode() {
        if (!this.uiManager || !this.drawFunction || !this.tinymceEditor) {
            console.error("EditorManager not fully initialized for closeEditorMode");
            return;
        }

        if (this.selectedNodeRef.node) { 
            this.selectedNodeRef.node.content = this.tinymceEditor.getContent();
            await dataStorageManager.saveData({ nodes: this.rootNodesRef.nodes, manuscript: this.uiManager.manuscriptList }); 
        }

        // Disable typewriter mode if it's active to reset state for next time
        if (this.isTypewriterModeActive) {
            this.toggleTypewriterMode();
        }

        // Stop and reset the timer whenever the editor is closed.
        timerManager.reset();

        if (this.uiManager.editorMode) { // editorMode is the div container from UIManager
            this.uiManager.editorMode.classList.add('hidden');
        }

        // Hide the footnotes pane when the editor closes
        if (this.uiManager && this.uiManager.editorFootnotesPane) {
            this.uiManager.editorFootnotesPane.classList.add('hidden');
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
    },

    /**
     * Triggers a refresh of UI elements that depend on editor content, like footnotes.
     */
    refreshUI: function() {
        if (this.uiManager && this.uiManager.renderEditorFootnotes && this.selectedNodeRef.node) {
            this.uiManager.renderEditorFootnotes(this.selectedNodeRef.node);
        }
    },

    /**
     * Removes a comment highlight span from the editor content by its ID.
     * This is called by the modalManager when a comment is deleted.
     * @param {string} commentId - The ID of the comment span to remove.
     */
    removeCommentHighlight: function(commentId) {
        if (!this.tinymceEditor) return;
        const targetSpan = this.tinymceEditor.dom.get(commentId);
        if (targetSpan) {
            this.tinymceEditor.dom.remove(targetSpan, true); // true keeps the inner text
            this.tinymceEditor.nodeChanged(); // Notifies TinyMCE of a change
        }
    },

    /**
     * Applies certified word highlights to the current editor content.
     * It removes old highlights and adds new ones based on the selected node's data.
     */
    applyAndRefreshCertifiedWordHighlights: function() {
        if (!this.tinymceEditor || !this.selectedNodeRef.node) {
            return;
        }

        const bookmark = this.tinymceEditor.selection.getBookmark();

        // Remove existing highlights to prevent duplicates
        this.tinymceEditor.dom.select('span.certified-word').forEach(span => {
            this.tinymceEditor.dom.remove(span, true); // true keeps inner text
        });
        this.tinymceEditor.nodeChanged();

        const selectedNode = this.selectedNodeRef.node;
        if (!selectedNode.certifiedWords || selectedNode.certifiedWords.length === 0) {
            this.tinymceEditor.selection.moveToBookmark(bookmark);
            return;
        }

        let content = this.tinymceEditor.getContent({ format: 'html' });
        selectedNode.certifiedWords.forEach(cw => {
            // Use the UIManager's escape function to avoid duplication
            const wordRegex = new RegExp(`\\b(${this.uiManager._escapeRegExp(cw.text)})\\b`, 'gi');
            const sanitizedDefinition = cw.definition.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            content = content.replace(wordRegex, `<span class="certified-word" data-definition="${sanitizedDefinition}">${'$&'}</span>`);
        });

        this.tinymceEditor.setContent(content);
        this.tinymceEditor.selection.moveToBookmark(bookmark);
        this.tinymceEditor.nodeChanged();
        this.refreshUI(); // Refresh footnotes after highlights are applied
    },

    /**
     * Sets up the hover tooltips for comments and certified words within the editor.
     * @private
     * @param {tinymce.Editor} editor The TinyMCE editor instance.
     */
    _setupHoverTooltips: function(editor) {
        const hoverTooltip = document.getElementById('hover-tooltip');
        if (!hoverTooltip) return;

        editor.on('mouseover', (e) => {
            const certifiedWordSpan = editor.dom.getParent(e.target, 'span.certified-word');
            const commentSpan = editor.dom.getParent(e.target, 'span.comment-highlight');

            let tooltipText = '';
            let targetElement = null;

            if (certifiedWordSpan) {
                tooltipText = certifiedWordSpan.getAttribute('data-definition');
                targetElement = certifiedWordSpan;
            } else if (commentSpan && this.selectedNodeRef.node) {
                const comment = this.selectedNodeRef.node.comments.find(c => c.id === commentSpan.id);
                if (comment && comment.text) {
                    tooltipText = comment.text;
                    targetElement = commentSpan;
                }
            }

            if (tooltipText && targetElement) {
                const tempDiv = document.createElement('div');
                tempDiv.textContent = tooltipText;
                hoverTooltip.innerHTML = tempDiv.innerHTML.replace(/\n/g, '<br>');

                const targetRect = targetElement.getBoundingClientRect();
                const editorContainerRect = editor.getContainer().getBoundingClientRect();

                hoverTooltip.style.left = `${targetRect.left}px`;
                hoverTooltip.style.top = `${targetRect.bottom + 5}px`;
                hoverTooltip.classList.remove('hidden');

                // Adjust position if tooltip goes off-screen
                if (hoverTooltip.offsetLeft + hoverTooltip.offsetWidth > editorContainerRect.right) {
                    hoverTooltip.style.left = `${editorContainerRect.right - hoverTooltip.offsetWidth - 5}px`;
                }
                if (hoverTooltip.offsetTop + hoverTooltip.offsetHeight > editorContainerRect.bottom) {
                    hoverTooltip.style.top = `${targetRect.top - hoverTooltip.offsetHeight - 5}px`;
                }
            }
        });

        editor.on('mouseout', () => {
            hoverTooltip.classList.add('hidden');
        });
    }
};
console.log("editorManager.js JSDoc comments added.");
