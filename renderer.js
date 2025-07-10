// --- MODULE IMPORTS ---
import { CanvasConstants, KeyConstants, MiscConstants, NodeConstants, BookshelfConstants } from './constants.js';
import { dataStorageManager } from './dataStorage.js';
import { uiManager } from './uiManager.js';
import { nodeManager } from './nodeManager.js';
import { canvasRenderer } from './canvasRenderer.js';
import { editorManager } from './editorManager.js';
import { modalManager } from './modalManager.js';
import { timerManager } from './timerManager.js';

// --- POLYFILLS ---
// Add a polyfill for roundRect if it doesn't exist on the canvas context.
// This is a common cause for rendering failures on older versions of Electron/Chromium.
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.beginPath();
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    }
}

// --- DOM ELEMENT GETTERS ---
const canvas = document.getElementById('nest-canvas');

// --- STATE MANAGEMENT ---
// Core application state, managed by the renderer as the orchestrator.
let scale = 1,
    offsetX = 0,
    offsetY = 0,
    rootNodes = [],
    viewStack = [],
    shelves = [],
    manuscriptList = [];
let selectedNode = null; // This is the single source of truth for the selected node.

// Transient state for canvas interactions
let isPanning = false,
    isDragging = false;

// New state for bookshelf drag-and-drop
let isDraggingBook = false,
    draggedNode = null,
    dropTarget = null; // { shelf: number, index: number }

let dragOffsetX = 0,
    dragOffsetY = 0,
    lastMouseX = 0,
    lastMouseY = 0;

// --- CORE DATA & DRAWING ---
function getCurrentNodes() {
    if (viewStack.length === 0) return rootNodes;
    return viewStack[viewStack.length - 1].children;
}
/**
 * Saves the current state of all nodes to the data file.
 */
async function saveData() {
    try {
        await dataStorageManager.saveData({ nodes: rootNodes, manuscript: manuscriptList, shelves: shelves });
    } catch (err) {
        // Error is already handled and alerted in dataStorageManager,
        // but we could add more UI feedback here if needed.
        console.error("Save operation failed in renderer.", err);
    }
}

/**
 * Triggers a redraw of the canvas and UI elements.
 * Delegates the actual drawing to the CanvasRenderer and UI updates to the UIManager.
 */
function draw() {
    // Update shared variables in case they were changed externally (though they shouldn't be)
    nodeManager.updateSharedVariables(scale, offsetX, offsetY);
    // Delegate drawing to the specialized renderer
    canvasRenderer.draw(rootNodes, viewStack, getCurrentNodes(), scale, offsetX, offsetY, {
        draggedNode: draggedNode, dropTarget: dropTarget
    }, shelves);

    // Update UI chrome like breadcrumbs
    uiManager.updateUIChrome();
}

/**
 * Centralizes the logic for selecting a node.
 * Handles deselecting the previous node and updating all necessary references.
 * @param {Object | null} nodeToSelect The node to select, or null to deselect all.
 */
function selectNode(nodeToSelect) {
    // Deselect the currently selected node, if one exists.
    if (selectedNode) {
        selectedNode.selected = false;
    }

    // Select the new node.
    selectedNode = nodeToSelect;
    if (selectedNode) {
        selectedNode.selected = true;
    }

    // Update any managers that need to know about the selection change.
    uiManager.updateSelectedNodeReference(selectedNode);
}
/**
 * Deletes the currently selected node, updates state, saves, and redraws.
 * This encapsulates the deletion logic to avoid duplication.
 */
async function deleteSelectedNode() {
    if (!selectedNode) return;

    const nodeToDeleteId = selectedNode.id;
    let currentNodes = getCurrentNodes();
    const newNodes = nodeManager.deleteNode(nodeToDeleteId, currentNodes);

    if (viewStack.length === 0) {
        rootNodes = newNodes;
    } else {
        viewStack[viewStack.length - 1].children = newNodes;
    }

    selectNode(null); // Deselect everything

    await saveData();
    draw();
}
/**
 * Navigates the view to a specific node, updating the view stack and focusing on it.
 * This function is passed as a callback to the UIManager for search results.
 * @param {Array<Object>} path - The array of parent nodes leading to the target.
 * @param {string} nodeId - The ID of the target node to navigate to.
 */
function navigateToNode(path, nodeId) {
    viewStack = path.slice(0, -1); // The path includes the node itself, so we slice it
    draw(); // Redraw to show the new view level

    const targetNode = getCurrentNodes().find(n => n.id === nodeId);
    if (targetNode) {
        selectNode(targetNode);

        // Pan and zoom to focus on the node
        offsetX = targetNode.x + targetNode.width / 2;
        offsetY = targetNode.y + targetNode.height / 2;
        scale = CanvasConstants.CANVAS_FOCUS_ZOOM_LEVEL; // Zoom in a bit for focus
        draw();
    }
}

/**
 * Opens a Scriptorium from an external UI element like the outliner.
 * Handles updating the selection state and calling the editor manager.
 * @param {string} nodeId - The ID of the Scriptorium node to open.
 */
function openScriptoriumFromOutliner(nodeId) {
    const nodeToOpen = getCurrentNodes().find(n => n.id === nodeId);
    if (nodeToOpen && nodeToOpen.type === 'text') {
        selectNode(nodeToOpen); // Select the node before opening

        // Open the editor
        editorManager.openEditorMode(nodeToOpen);
    }
}

/**
 * Creates a new book on a new shelf.
 * This is triggered by the "Add Shelf" button in the UI.
 */
async function addNewShelf() {
    // 1. Find the highest shelf index currently in use.
    // If no nodes exist, start with shelf 0.
    const maxShelf = rootNodes.reduce((max, node) => Math.max(max, node.shelf || 0), -1);
    const newShelfIndex = maxShelf < 0 ? 0 : maxShelf + 1;

    // 2. Create a new book node. The x/y are placeholders as the layout will determine the final position.
    const newNode = nodeManager.createNode(0, 0, false, `book-${Date.now()}`);

    // 3. Assign it to the new shelf.
    newNode.shelf = newShelfIndex;
    newNode.shelfPosition = 0;

    // 4. Add a name for the new shelf.
    shelves.push({ index: newShelfIndex, name: `Shelf ${newShelfIndex + 1}` });

    // 4. Add to root nodes, save, and refit the view to include the new shelf.
    rootNodes.push(newNode);
    await saveData();
    fitViewToNodes();
    draw();
}

/**
 * Creates an inline editor for a shelf's title.
 * @param {Object} shelfTitleLayout - The layout object for the shelf title from canvasRenderer.
 */
function createShelfTitleEditor(shelfTitleLayout) {
    const editor = document.createElement('input');
    editor.type = 'text';
    editor.className = 'node-editor'; // Reuse styling for consistency
    editor.value = shelfTitleLayout.shelfInfo.name;

    // Calculate screen position for the editor
    const screenX = (shelfTitleLayout.x - offsetX) * scale + canvas.width / 2;
    const screenY = (shelfTitleLayout.y - offsetY) * scale + canvas.height / 2;
    
    editor.style.position = 'absolute';
    const canvasRect = canvas.getBoundingClientRect();
    editor.style.left = `${canvasRect.left + screenX}px`;
    editor.style.top = `${canvasRect.top + screenY}px`;
    editor.style.width = `${shelfTitleLayout.width * scale + 10}px`; // Add padding
    editor.style.height = `${shelfTitleLayout.height * scale}px`;
    editor.style.fontSize = `${18 * scale}px`; // Match shelf title font size
    editor.style.zIndex = '1000';

    document.body.appendChild(editor);
    editor.focus();
    editor.select();

    const saveAndRemoveEditor = async () => {
        const newName = editor.value.trim();
        const shelfInfo = shelfTitleLayout.shelfInfo;

        // Find the shelf in the main `shelves` array and update it.
        // Only save if the name has changed and is not empty.
        const shelfToUpdate = shelves.find(s => s.index === shelfInfo.index);
        if (shelfToUpdate && newName && shelfToUpdate.name !== newName) {
            shelfToUpdate.name = newName;
            await saveData(); // Persist the change
        }

        if (document.body.contains(editor)) {
            document.body.removeChild(editor);
        }
        draw(); // Redraw to show the updated name
    };

    editor.addEventListener('blur', saveAndRemoveEditor, { once: true });
    editor.addEventListener('keydown', (e) => {
        if (e.key === KeyConstants.ENTER || e.key === KeyConstants.ESCAPE) {
            e.stopPropagation();
            editor.blur();
        }
    });
}
function calculateNodesBoundingBox(nodes) { // This function is now view-aware
    if (viewStack.length === 0) { // Bookshelf view logic
        // Use the multi-shelf layout to get the correct positions of all items.
        const layoutNodes = canvasRenderer.calculateMultiShelfLayout(nodes);

        if (layoutNodes.length === 0) {
            const defaultSize = Math.min(canvas.width, canvas.height) || 500;
            return { minX: -defaultSize / 2, minY: -defaultSize / 2, maxX: defaultSize / 2, maxY: defaultSize / 2, width: defaultSize, height: defaultSize };
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let maxShelfIndex = 0;

        // Find the bounding box of all the items themselves.
        layoutNodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + node.width);
            maxY = Math.max(maxY, node.y + node.height);
            maxShelfIndex = Math.max(maxShelfIndex, node.shelf || 0);
        });

        // Now, expand the bounding box to include the shelves and bookends.
        if (layoutNodes.length > 0) {
            // Calculate the Y position of the bottom of the books on the last shelf.
            const lastShelfYPosition = BookshelfConstants.BOOKSHELF_Y_POSITION + (maxShelfIndex * BookshelfConstants.SHELF_SPACING_VERTICAL);
            const shelfStructureHeight = BookshelfConstants.SHELF_HEIGHT + BookshelfConstants.SHELF_BOTTOM_EDGE_HEIGHT;
            const bottomOfShelfStructure = lastShelfYPosition + shelfStructureHeight;
            maxY = Math.max(maxY, bottomOfShelfStructure);

            // Expand horizontally for the padding and bookends.
            minX -= (BookshelfConstants.SHELF_PADDING + BookshelfConstants.BOOKEND_WIDTH);
            maxX += (BookshelfConstants.SHELF_PADDING + BookshelfConstants.BOOKEND_WIDTH);
        }

        const width = (maxX - minX) || NodeConstants.NODE_WIDTH;
        const height = (maxY - minY) || NodeConstants.NODE_HEIGHT;
        return { minX, minY, maxX, maxY, width, height };

    } else { // Standard view logic
        return calculateBboxFromNodeList(nodes);
    }
}


function fitViewToNodes() {
    const nodesToFit = getCurrentNodes(); // Fit to current view, not always root
    if (nodesToFit.length === 0) {
        scale = 1;
        offsetX = 0;
        offsetY = 0;
        return;
    }

    const bbox = calculateNodesBoundingBox(nodesToFit);

    const contentWidth = bbox.width + 2 * CanvasConstants.CANVAS_FIT_VIEW_PADDING;
    const contentHeight = bbox.height + 2 * CanvasConstants.CANVAS_FIT_VIEW_PADDING;

    scale = Math.min(canvas.width / contentWidth, canvas.height / contentHeight);
    scale = Math.max(CanvasConstants.CANVAS_MIN_ZOOM_DEFAULT, Math.min(scale, CanvasConstants.CANVAS_MAX_ZOOM)); // Prevent zooming too far out or in
    offsetX = bbox.minX + bbox.width / 2;
    offsetY = bbox.minY + bbox.height / 2;
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    canvas.addEventListener('mousedown', (e) => { // Note: getNodeAtPosition now uses internal references
        const clickedNode = nodeManager.getNodeAtPosition(e.offsetX, e.offsetY);
        
        // --- Bookshelf Drag & Drop Start ---
        if (viewStack.length === 0 && clickedNode) {
            isDraggingBook = true;
            draggedNode = clickedNode;

            // Prevent normal panning and node selection
            isPanning = false;
            isDragging = false;
            selectNode(null);

            // Calculate offset from mouse to top-left of node
            const worldX = (e.offsetX - canvas.width / 2) / scale + offsetX;
            const worldY = (e.offsetY - canvas.height / 2) / scale + offsetY;
            dragOffsetX = worldX - clickedNode.x;
            dragOffsetY = worldY - clickedNode.y;

            draw();
            return; // Exit early to prevent other mousedown logic
        }
        selectNode(clickedNode);

        if (clickedNode) {
            isDragging = true;
            isPanning = false;
            const worldX = (e.offsetX - canvas.width / 2) / scale + offsetX;
            const worldY = (e.offsetY - canvas.height / 2) / scale + offsetY;
            dragOffsetX = worldX - clickedNode.x;
            dragOffsetY = worldY - clickedNode.y;
        } else {
            isDragging = false;
            isPanning = true;
            lastMouseX = e.offsetX;
            lastMouseY = e.offsetY;
        }
        draw();
        uiManager.renderTags(selectedNode); // Update tags display
    });

    canvas.addEventListener('mouseup', async () => {
        // --- Bookshelf Drag & Drop End ---
        if (isDraggingBook && draggedNode && dropTarget) {
            // A valid drop occurred. Update the data model.
            const originalShelfIndex = draggedNode.shelf || 0;
            const targetShelfIndex = dropTarget.shelf;

            // Ensure shelf names exist up to the target shelf index.
            // This handles creating new shelves by dragging to an empty space below.
            const maxKnownShelf = shelves.reduce((max, s) => Math.max(max, s.index), -1);
            if (targetShelfIndex > maxKnownShelf) {
                for (let i = maxKnownShelf + 1; i <= targetShelfIndex; i++) {
                    shelves.push({ index: i, name: `Shelf ${i + 1}` });
                }
            }

            // 1. Move the dragged node to the new shelf in the data model.
            draggedNode.shelf = targetShelfIndex;

            // 2. Get all nodes that were on the target shelf (excluding the one we just moved).
            const nodesOnTargetShelf = rootNodes
                .filter(n => (n.shelf || 0) === targetShelfIndex && n.id !== draggedNode.id)
                .sort((a, b) => (a.shelfPosition || 0) - (b.shelfPosition || 0));

            // 3. Insert the dragged node at its new position.
            nodesOnTargetShelf.splice(dropTarget.index, 0, draggedNode);

            // 4. Re-sequence the shelf positions for the entire target shelf.
            nodesOnTargetShelf.forEach((node, index) => {
                node.shelfPosition = index;
            });

            // 5. If the node was moved from a different shelf, re-sequence the original shelf too.
            if (originalShelfIndex !== targetShelfIndex) {
                const nodesOnOriginalShelf = rootNodes
                    .filter(n => (n.shelf || 0) === originalShelfIndex && n.id !== draggedNode.id)
                    .sort((a, b) => (a.shelfPosition || 0) - (b.shelfPosition || 0));

                nodesOnOriginalShelf.forEach((node, index) => {
                    node.shelfPosition = index;
                });
            }

            // 6. Save the new layout and clean up state.
            await saveData();

            isDraggingBook = false;
            draggedNode = null;
            dropTarget = null;
            draw();
            return; // Exit early
        } else if (isDraggingBook) {
            // Drop occurred in an invalid location, just snap back.
            isDraggingBook = false;
            draggedNode = null;
            dropTarget = null;
            draw();
            return;
        }
        // --- End Bookshelf Drag & Drop ---
        if (isDragging) await saveData();
        isPanning = false;
        isDragging = false;
    });


    canvas.addEventListener('mousemove', (e) => { // No save call here, so no async needed
        if (isDragging && selectedNode) {
            const worldX = (e.offsetX - canvas.width / 2) / scale + offsetX;
            const worldY = (e.offsetY - canvas.height / 2) / scale + offsetY;
            selectedNode.x = worldX - dragOffsetX;
            selectedNode.y = worldY - dragOffsetY;
            draw();
            return;
        }
        // --- Bookshelf Drag & Drop Move ---
        if (isDraggingBook && draggedNode) {
            const worldX = (e.offsetX - canvas.width / 2) / scale + offsetX;
            const worldY = (e.offsetY - canvas.height / 2) / scale + offsetY;

            // Update the ghost's position to follow the mouse
            draggedNode.x = worldX - dragOffsetX;
            draggedNode.y = worldY - dragOffsetY;

            // --- Multi-Shelf Drop Target Calculation ---
            // 1. Determine which shelf the cursor is over vertically.
            const shelfIndex = Math.max(0, Math.round((worldY - BookshelfConstants.BOOKSHELF_Y_POSITION) / BookshelfConstants.SHELF_SPACING_VERTICAL));

            // 2. Get all items on that target shelf, sorted by their position.
            const nodesOnTargetShelf = rootNodes
                .filter(n => (n.shelf || 0) === shelfIndex && n.id !== draggedNode.id)
                .sort((a, b) => (a.shelfPosition || 0) - (b.shelfPosition || 0));

            const bookWidth = BookshelfConstants.BOOK_WIDTH;
            const bookSpacing = BookshelfConstants.BOOK_SPACING;
            const totalShelfWidth = (nodesOnTargetShelf.length * bookWidth) + (Math.max(0, nodesOnTargetShelf.length - 1) * bookSpacing);
            let currentX = -totalShelfWidth / 2;

            // 3. Find the horizontal insertion index on that shelf.
            let insertIndex = nodesOnTargetShelf.length; // Default to the end of the shelf
            for (let i = 0; i < nodesOnTargetShelf.length; i++) {
                if (worldX < currentX + bookWidth + bookSpacing / 2) {
                    insertIndex = i;
                    break;
                }
                currentX += bookWidth + bookSpacing;
            }
            dropTarget = { shelf: shelfIndex, index: insertIndex };

            draw();
            return;
        }
        if (!isPanning) return;
        const dx = e.offsetX - lastMouseX;
        const dy = e.offsetY - lastMouseY;
        offsetX -= dx / scale;
        offsetY -= dy / scale;
        lastMouseX = e.offsetX;
        lastMouseY = e.offsetY;
        draw();
    });

    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault(); // Prevent native context menu

        // Hide any existing menu first to ensure listeners are cleaned up.
        uiManager.hideContextMenu();

        const clickedNode = nodeManager.getNodeAtPosition(e.offsetX, e.offsetY);
        if (clickedNode) {
            // Dynamically build the menu items based on the node context
            const menuItems = [
                {
                    label: 'Rename',
                    action: () => nodeManager.createTitleEditor(clickedNode)
                }
            ];

            if (clickedNode.type === 'text') {
                menuItems.push({
                    label: 'Open Editor',
                    action: () => editorManager.openEditorMode(clickedNode)
                });
            } else if (clickedNode.type === 'container') {
                menuItems.push({
                    label: 'Enter Book',
                    action: () => {
                        viewStack.push(clickedNode);
                        offsetX = 0;
                        offsetY = 0;
                        scale = 1;
                        selectedNode = null;
                        draw();
                    }
                });
            }

            menuItems.push({ type: 'separator' });

            menuItems.push({
                label: 'Delete',
                action: async () => {
                    selectNode(clickedNode); // Ensure the right-clicked node is the one selected for deletion.
                    await deleteSelectedNode();
                }
            });

            uiManager.showContextMenu(e.clientX, e.clientY, menuItems);
        }
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const scrollDirection = e.deltaY < 0 ? 1 : -1;
        const zoomFactor = Math.exp(scrollDirection * CanvasConstants.CANVAS_ZOOM_INTENSITY);
        let newScale = scale * zoomFactor;
        
        // Restrict zoom-out on bookshelf view to keep titles readable, allow deeper zoom otherwise.
        const minScale = viewStack.length === 0 ? CanvasConstants.CANVAS_MIN_ZOOM_BOOKSHELF : CanvasConstants.CANVAS_MIN_ZOOM_DEFAULT;
        newScale = Math.max(minScale, Math.min(newScale, CanvasConstants.CANVAS_MAX_ZOOM));

        if (isNaN(newScale) || !isFinite(newScale)) {
            newScale = scale;
        }

        if (newScale === scale) return;

        const worldXBeforeZoom = (e.offsetX - canvas.width / 2) / scale + offsetX;
        const worldYBeforeZoom = (e.offsetY - canvas.height / 2) / scale + offsetY;

        scale = newScale;

        const worldXAfterZoom = (e.offsetX - canvas.width / 2) / scale + offsetX;
        const worldYAfterZoom = (e.offsetY - canvas.height / 2) / scale + offsetY;

        offsetX += worldXBeforeZoom - worldXAfterZoom;
        offsetY += worldYBeforeZoom - worldYAfterZoom;

        draw();
    });

    canvas.addEventListener('dblclick', async (e) => {
        const clickedNode = nodeManager.getNodeAtPosition(e.offsetX, e.offsetY);
        if (clickedNode) {
            if (e.ctrlKey) {
                nodeManager.createTitleEditor(clickedNode);
            } else if (clickedNode.type === 'container') {
                viewStack.push(clickedNode);
                offsetX = 0;
                offsetY = 0;
                scale = 1;
                selectNode(null);
            } else if (clickedNode.type === 'text') {
                editorManager.openEditorMode(clickedNode);
            }
        } else {
            const worldX = (e.offsetX - canvas.width / 2) / scale + offsetX;
            const worldY = (e.offsetY - canvas.height / 2) / scale + offsetY;

            // Check for shelf title click first, but only in the main library view.
            if (viewStack.length === 0) {
                const clickedShelfTitle = canvasRenderer.getShelfTitleAtPosition(worldX, worldY);
                if (clickedShelfTitle) {
                    createShelfTitleEditor(clickedShelfTitle);
                    return; // Prevent creating a new node
                }
            }

            if (viewStack.length > 0) {
                // We are inside a book, so create a new Scriptorium (text node).
                const newNode = nodeManager.createNode(worldX, worldY, true, Date.now() + Math.random());
                getCurrentNodes().push(newNode);
                await saveData();
            } else {
                // We are in the main library view. Create a new Book on the nearest shelf.
                const shelfIndex = Math.max(0, Math.round((worldY - BookshelfConstants.BOOKSHELF_Y_POSITION) / BookshelfConstants.SHELF_SPACING_VERTICAL));

                // Ensure shelf and shelf name exist up to the target shelf index.
                const maxKnownShelf = shelves.reduce((max, s) => Math.max(max, s.index), -1);
                if (shelfIndex > maxKnownShelf) {
                    for (let i = maxKnownShelf + 1; i <= shelfIndex; i++) {
                        shelves.push({ index: i, name: `Shelf ${i + 1}` });
                    }
                }

                const nodesOnShelf = rootNodes.filter(n => (n.shelf || 0) === shelfIndex);
                const newNode = nodeManager.createNode(worldX, worldY, false, `book-${Date.now()}`);
                newNode.shelf = shelfIndex;
                newNode.shelfPosition = nodesOnShelf.length; // Add to the end of the shelf.
                rootNodes.push(newNode);
                await saveData();
            }
        }
        draw();
    });

    window.addEventListener('keydown', async (e) => {
        // Ignore keyboard shortcuts if an input field is focused.
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
            return;
        }

        // A map of key-action pairs for cleaner, more extensible event handling.
        const keyActions = {
            'k': {
                ctrl: true,
                action: () => uiManager.isSearchOpen() ? uiManager.closeSearch() : uiManager.openSearch()
            },
            'f3': {
                action: () => uiManager.isCompendiumOpen() ? uiManager.closeCompendium() : uiManager.openCompendium()
            },
            'escape': {
                action: async () => {
                    if (uiManager.isSearchOpen()) return uiManager.closeSearch();
                    if (uiManager.isCompendiumOpen()) return uiManager.closeCompendium();
                    if (editorManager.isEditorOpen()) return await editorManager.closeEditorMode();
                    
                    const titleEditor = document.querySelector('.node-editor');
                    if (titleEditor) return titleEditor.blur();

                    if (viewStack.length > 0) {
                        viewStack.pop();
                        offsetX = 0;
                        offsetY = 0;
                        scale = 1;
                        selectNode(null);
                        draw();
                    }
                }
            },
            'delete': {
                action: async () => { if (selectedNode) await deleteSelectedNode(); }
            },
            'backspace': {
                action: async () => { if (selectedNode) await deleteSelectedNode(); }
            }
        };

        const actionConfig = keyActions[e.key.toLowerCase()];
        if (actionConfig && (!actionConfig.ctrl || e.ctrlKey)) {
            e.preventDefault();
            await actionConfig.action();
        }
    });

    window.addEventListener('resize', () => {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        draw();
    });
}


// --- INITIALIZATION ---
async function initialize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;

    // Load data FIRST, so all managers are initialized with the correct data.
    const { nodes, manuscript, shelves: loadedShelves } = await dataStorageManager.loadData(); // Now an async operation
    rootNodes = nodes;
    shelves = loadedShelves;

    // The manuscript list is now managed as an array of IDs, which is more robust.
    // It is resolved to full objects only when needed by specific functions (e.g., in uiManager).
    manuscriptList = manuscript;
    console.log("Manuscript list loaded with IDs:", manuscriptList);

    // Initialize Manager Modules
    // Note: UIManager.init is passed the initial `selectedNode` which is null.
    // The event listeners in setupEventListeners() are responsible for keeping the
    // uiManager's reference up-to-date by calling updateSelectedNodeReference().
    canvasRenderer.init(canvas, uiManager.getWordCount.bind(uiManager), uiManager.getTotalWordCount.bind(uiManager));
    nodeManager.init({
        canvasEl: canvas,
        initialScale: scale,
        initialOffsetX: offsetX,
        initialOffsetY: offsetY,
        getCurrentNodesFunc: getCurrentNodes,
        drawFunc: draw,
        saveNodesFunc: saveData,
        viewStackRef: viewStack,
        canvasRendererRef: canvasRenderer
    });
    uiManager.init({
        rootNodes: rootNodes, viewStack: viewStack, selectedNode: selectedNode, manuscriptList: manuscriptList,
        drawFunction: draw, saveNodesFunction: saveData, navigateToNodeFunction: navigateToNode,
        createTitleEditorFunction: nodeManager.createTitleEditor.bind(nodeManager),
        openScriptoriumCallback: openScriptoriumFromOutliner,
        addShelfCallback: addNewShelf
    });
    editorManager.init({
        selectedNodeRef: { get node() { return selectedNode; }, set node(n) { selectedNode = n; } },
        rootNodesRef: { get nodes() { return rootNodes; } },
        drawFunction: draw,
        uiManager: uiManager,
        modalManager: modalManager
    });
    modalManager.init({
        selectedNodeRef: { get node() { return selectedNode; } },
        rootNodesRef: { get nodes() { return rootNodes; } },
        saveNodesFunction: saveData,
        editorManager: editorManager
    });
    timerManager.init();

    fitViewToNodes(); // Always fit the current view on startup.
    setupEventListeners();
    draw();
}

window.addEventListener('DOMContentLoaded', initialize)