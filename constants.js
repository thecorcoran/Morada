// js/constants.js
/**
 * @fileOverview AppConstants provides a centralized object for widely used
 * constant values across the application. This helps in maintaining consistency
 * and makes updates easier.
 */

/**
 * @namespace NodeConstants
 * @description Constants related to node dimensions and appearance.
 */
export const NodeConstants = {
  NODE_WIDTH: 250,
  NODE_HEIGHT: 150,
  NODE_DEFAULT_COLOR: '#f5f5f5',
  NODE_TEXT_COLOR: '#fdf5e6',
  NODE_SELECTED_STROKE_COLOR: '#007bff',
  NODE_DEFAULT_STROKE_COLOR: '#d5c4a1',
};

/**
 * @namespace CanvasConstants
 * @description Constants related to the canvas and its interactions.
 */
export const CanvasConstants = {
  CANVAS_ZOOM_INTENSITY: 0.1,
  CANVAS_MIN_ZOOM_BOOKSHELF: 0.4,
  CANVAS_MIN_ZOOM_DEFAULT: 0.1,
  CANVAS_MAX_ZOOM: 2.0,
  CANVAS_FIT_VIEW_PADDING: 100,
  CANVAS_FOCUS_ZOOM_LEVEL: 1.2,
};

/**
 * @namespace EditorConstants
 * @description Constants related to the TinyMCE editor's appearance.
 */
export const EditorConstants = {
  DEFAULT_FONT_SIZE: '18px',
  DEFAULT_LINE_HEIGHT: '1.6',
  BACKGROUND_COLOR: '#fdf5e6',
};

/**
 * @namespace UIConstants
 * @description Constants related to UI elements and styles on the canvas.
 */
export const UIConstants = {
  CURRENT_LEVEL_FILL_ALPHA: 1.0,
  CURRENT_LEVEL_TEXT_ALPHA: 1.0,
  ANCESTOR_FILL_ALPHA: 0.25,
  ANCESTOR_TEXT_ALPHA: 0.6,
  OTHER_LEVEL_FILL_ALPHA: 0.1,
  OTHER_LEVEL_TEXT_ALPHA: 0.7,
  DEFAULT_TEXT_COLOR: '#333',
  DEFAULT_FONT_BOLD: "bold 16px 'Vollkorn', serif",
  WORD_COUNT_FONT: "12px 'Vollkorn', serif",
  WORD_COUNT_COLOR: '#666',
};

/**
 * @namespace BookshelfConstants
 * @description Constants for the root "bookshelf" view styling.
 */
export const BookshelfConstants = {
  BOOK_WIDTH: 40,
  BOOK_SPACING: 10,
  BOOK_ROTATION_MAX_DEGREES: 1,
  BOOK_BASE_COLOR_CONTAINER: '#8B4513', // SaddleBrown
  BOOK_LIGHT_COLOR_CONTAINER: '#A0522D',
  BOOK_BASE_COLOR_TEXT: '#C19A6B', // Camel
  BOOK_LIGHT_COLOR_TEXT: '#D2B48C',
  BOOK_BAND_HIGHLIGHT: '#F0E68C', // Khaki
  BOOK_BAND_SHADOW: '#B8860B',   // DarkGoldenrod
  BOOK_OUTLINE_COLOR: '#3E2723',
  BOOK_TITLE_COLOR: '#FFFFFF',
  BOOK_TITLE_SHADOW: 'rgba(0,0,0,0.7)',
  BOOK_WORD_COUNT_COLOR: 'rgba(255, 255, 255, 0.8)',
  BOOKSHELF_Y_POSITION: 0, // Center the bookshelf vertically in world space.
  SHELF_SPACING_VERTICAL: 250, // The vertical distance between shelves.
  SHELF_PADDING: 100,
  SHELF_HEIGHT: 20,
  SHELF_BOTTOM_EDGE_HEIGHT: 5,
  SHELF_COLOR_TOP: '#855E42',
  SHELF_COLOR_BOTTOM: '#5D4037',
  SHELF_EDGE_COLOR: '#4E342E',
  SHELF_TITLE_FONT: "italic bold 22px 'Vollkorn', serif",
  SHELF_TITLE_COLOR: '#4E342E', // Darker brown to match shelf edge
  SHELF_TITLE_X_OFFSET: 20, // Distance from the bookend
  SHELF_TITLE_Y_OFFSET: 0, // Vertical offset from the book's vertical center. Positive is down, negative is up.
  BOOKEND_WIDTH: 30,
  BOOKEND_COLOR: '#3E2723',
  LION_BASE_COLOR: '#6D4C41', // A dark, stony brown
  LION_SHADOW_COLOR: '#4E342E',
  LION_HIGHLIGHT_COLOR: '#8D6E63',
  LOOSE_LEAF_BG_COLOR: '#fdf5e6',
  LOOSE_LEAF_BORDER_COLOR: '#d3c5b4',
  LOOSE_LEAF_SHADOW_COLOR: 'rgba(0,0,0,0.2)',
};

/**
 * @namespace KeyConstants
 * @description Constants for keyboard interaction keys.
 */
export const KeyConstants = {
  ENTER: 'Enter',
  ESCAPE: 'Escape',
  DELETE: 'Delete',
  BACKSPACE: 'Backspace',
  F3: 'F3',
  K: 'k',
};

/**
 * @namespace MiscConstants
 * @description Miscellaneous constants like default titles.
 */
export const MiscConstants = {
  NEW_BOOK_TITLE: 'New Book',
  NEW_SCRIPTORIUM_TITLE: 'New Scriptorium',
};


console.log("constants.js reorganized into feature-based groups.");
console.log("constants.js JSDoc comments added.");
