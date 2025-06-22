// js/constants.js
/**
 * @fileOverview AppConstants provides a centralized object for widely used
 * constant values across the application. This helps in maintaining consistency
 * and makes updates easier.
 * @namespace AppConstants
 */
window.AppConstants = {
    // --- Node Dimensions & Appearance ---
    /** @const {number} NODE_WIDTH - Default width for new nodes. */
    NODE_WIDTH: 250,
    /** @const {number} NODE_HEIGHT - Default height for new nodes. */
    NODE_HEIGHT: 150,
    /** @const {string} NODE_DEFAULT_COLOR - Default background color for container nodes. */
    NODE_DEFAULT_COLOR: '#f5f5f5',
    /** @const {string} NODE_TEXT_COLOR - Default background color for text nodes. */
    NODE_TEXT_COLOR: '#fdf5e6',
    /** @const {string} NODE_SELECTED_STROKE_COLOR - Stroke color for selected nodes. */
    NODE_SELECTED_STROKE_COLOR: '#007bff',

    // --- Canvas Settings ---
    /** @const {number} CANVAS_ZOOM_INTENSITY - Multiplier for zoom operations. */
    CANVAS_ZOOM_INTENSITY: 0.1,

    // --- Editor Appearance (TinyMCE) ---
    /** @const {string} EDITOR_DEFAULT_FONT_SIZE - Default font size for the TinyMCE editor. */
    EDITOR_DEFAULT_FONT_SIZE: '18px',
    /** @const {string} EDITOR_DEFAULT_LINE_HEIGHT - Default line height for the TinyMCE editor. */
    EDITOR_DEFAULT_LINE_HEIGHT: '1.6',
    /** @const {string} EDITOR_BACKGROUND_COLOR - Background color for the TinyMCE editor. */
    EDITOR_BACKGROUND_COLOR: '#fdf5e6',

    // --- Default Node Titles ---
    /** @const {string} NEW_CHAMBER_TITLE - Default title for new container nodes. */
    NEW_CHAMBER_TITLE: 'New Chamber',
    /** @const {string} NEW_SCRIPTORIUM_TITLE - Default title for new text nodes. */
    NEW_SCRIPTORIUM_TITLE: 'New Scriptorium',

    // --- UI Interaction Keys ---
    /** @const {string} KEY_ENTER - String representation for the 'Enter' key. */
    KEY_ENTER: 'Enter',
    /** @const {string} KEY_ESCAPE - String representation for the 'Escape' key. */
    KEY_ESCAPE: 'Escape',
    /** @const {string} KEY_DELETE - String representation for the 'Delete' key. */
    KEY_DELETE: 'Delete',
    /** @const {string} KEY_BACKSPACE - String representation for the 'Backspace' key. */
    KEY_BACKSPACE: 'Backspace',
    /** @const {string} KEY_F3 - String representation for the 'F3' key. */
    KEY_F3: 'F3',
    /** 
     * @const {string} CTRL_K_COMBO - Conceptual representation for Ctrl+K combination.
     * Note: Actual check in code is `e.ctrlKey && e.key === 'k'`.
     */
    CTRL_K_COMBO: 'Control+K', 

    // --- Canvas Drawing Styles (Colors, Alphas, Fonts) ---
    /** @const {number} CURRENT_LEVEL_FILL_ALPHA - Alpha transparency for nodes at the current viewing level. */
    CURRENT_LEVEL_FILL_ALPHA: 1.0,
    /** @const {number} CURRENT_LEVEL_TEXT_ALPHA - Alpha transparency for text on current level nodes. */
    CURRENT_LEVEL_TEXT_ALPHA: 1.0,
    /** @const {number} ANCESTOR_FILL_ALPHA - Alpha transparency for ancestor nodes. */
    ANCESTOR_FILL_ALPHA: 0.25,
    /** @const {number} ANCESTOR_TEXT_ALPHA - Alpha transparency for text on ancestor nodes. */
    ANCESTOR_TEXT_ALPHA: 0.6,
    /** @const {number} OTHER_LEVEL_FILL_ALPHA - Alpha transparency for nodes not current and not ancestor. */
    OTHER_LEVEL_FILL_ALPHA: 0.1, 
    /** @const {number} OTHER_LEVEL_TEXT_ALPHA - Alpha transparency for text on 'other' level nodes. */
    OTHER_LEVEL_TEXT_ALPHA: 0.7, 
    /** @const {string} DEFAULT_TEXT_COLOR - Default color for node titles and other general text on canvas. */
    DEFAULT_TEXT_COLOR: '#333',
    /** @const {string} DEFAULT_FONT_BOLD - Default bold font style for node titles. */
    DEFAULT_FONT_BOLD: "bold 16px 'Vollkorn', serif",
    /** @const {string} WORD_COUNT_FONT - Font style for word count text on nodes. */
    WORD_COUNT_FONT: "12px 'Vollkorn', serif",
    /** @const {string} WORD_COUNT_COLOR - Color for word count text on nodes. */
    WORD_COUNT_COLOR: '#666',
};
console.log("constants.js JSDoc comments added.");
