// This file is required by the index.html file and will
// be executed in the renderer process for that window.

// --- Imports and Global State ---
const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');

// --- State (now managed by StateManager) ---
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let lastMousePosition = { x: 0, y: 0 };

// --- Initialization ---
async function init() {
    // Initialize DataStorage first
    await MyProjectDataStorage.init();

    // Load Data into StateManager
    const loadedNodes = await MyProjectDataStorage.loadNodes();
    MyProjectStateManager.setRootNodes(loadedNodes);

    // Initialize Managers with a reference to the state manager
    MyProjectUIManager.init({
        canvas: canvas, // Pass canvas to UIManager
        stateManager: MyProjectStateManager,
        drawFunction: draw,
        saveNodesFunction: () => MyProjectDataStorage.saveNodes(MyProjectStateManager.getRootNodes()),
        navigateToNodeFunction: navigateToNode,
    });

    MyProjectEditorManager.init({
        stateManager: MyProjectStateManager,
        drawFunction: draw,
    });

    MyProjectNodeManager.init({
        canvas: canvas,
        stateManager: MyProjectStateManager,
        drawFunction: draw,
        saveNodesFunction: () => MyProjectDataStorage.saveNodes(MyProjectStateManager.getRootNodes()),
    });

    MyProjectCanvasRenderer.init(canvas, MyProjectUIManager.getWordCount);

    // Initial draw
    resizeCanvas();
    draw();

    // Event Listeners
    setupEventListeners();
}

function setupEventListeners() {
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('wheel', onWheel);
    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('keydown', onKeyDown);
}

// --- Event Handlers ---

function onMouseDown(e) {
    const { x, y } = getMousePos(e);
    lastMousePosition = { x, y };

    const clickedNode = MyProjectNodeManager.getNodeAtPosition(x, y);

    if (e.button === 2 || e.ctrlKey) { // Right-click or Ctrl-click
        // Context menu logic will be handled in a future step
        return;
    }

    if (clickedNode) {
        const selectedNode = MyProjectStateManager.getSelectedNode();
        if (selectedNode && selectedNode.isEditing) {
            MyProjectUIManager.createTitleEditor(selectedNode); // Changed from MyProjectNodeManager
        }
        MyProjectStateManager.setSelectedNode(clickedNode);
        isDragging = true;
        dragStart = { x: x - clickedNode.x, y: y - clickedNode.y };
    } else {
        isDragging = true; // For panning
        dragStart = { x, y };
    }
    draw();
}

function onMouseUp(e) {
    isDragging = false;
    if (MyProjectStateManager.getSelectedNode()) {
        MyProjectDataStorage.saveNodes(MyProjectStateManager.getRootNodes());
    }
}

function onMouseMove(e) {
    if (!isDragging) return;

    const { x, y } = getMousePos(e);
    const dx = x - lastMousePosition.x;
    const dy = y - lastMousePosition.y;
    const scale = MyProjectStateManager.getScale();

    const selectedNode = MyProjectStateManager.getSelectedNode();
    if (selectedNode) { // Dragging a node
        selectedNode.x += dx / scale;
        selectedNode.y += dy / scale;
    } else { // Panning the canvas
        MyProjectStateManager.setOffsetX(MyProjectStateManager.getOffsetX() - dx / scale);
        MyProjectStateManager.setOffsetY(MyProjectStateManager.getOffsetY() - dy / scale);
    }

    lastMousePosition = { x, y };
    draw();
}

function onWheel(e) {
    e.preventDefault();
    const { x, y } = getMousePos(e);

    const zoomIntensity = AppConstants.CANVAS_ZOOM_INTENSITY;
    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoom = Math.exp(wheel * zoomIntensity);

    const oldScale = MyProjectStateManager.getScale();
    const newScale = oldScale * zoom;

    const offsetX = MyProjectStateManager.getOffsetX();
    const offsetY = MyProjectStateManager.getOffsetY();

    MyProjectStateManager.setOffsetX(offsetX + (x / oldScale - x / newScale));
    MyProjectStateManager.setOffsetY(offsetY + (y / oldScale - y / newScale));
    MyProjectStateManager.setScale(newScale);

    draw();
}

function onKeyDown(e) {
    if (MyProjectEditorManager.isEditorOpen() || MyProjectUIManager.isCompendiumOpen() || MyProjectUIManager.isSearchOpen()) {
        return; // Modals handle their own events
    }

    const selectedNode = MyProjectStateManager.getSelectedNode();
    const viewStack = MyProjectStateManager.getViewStack();

    switch (e.key) {
        case 'Enter':
            if (selectedNode) {
                if (selectedNode.type === 'text') {
                    MyProjectEditorManager.openEditorMode(selectedNode);
                } else {
                    MyProjectStateManager.pushToViewStack(selectedNode);
                    MyProjectStateManager.setCurrentNodes(selectedNode.children);
                    MyProjectUIManager.updateUIChrome();
                    draw();
                }
            }
            break;
        case 'Backspace':
            if (viewStack.length > 0) {
                MyProjectStateManager.popFromViewStack();
                const newCurrentNodes = viewStack.length > 0 ? viewStack[viewStack.length - 1].children : MyProjectStateManager.getRootNodes();
                MyProjectStateManager.setCurrentNodes(newCurrentNodes);
                MyProjectUIManager.updateUIChrome();
                draw();
            }
            break;
        case 'Delete':
            if (selectedNode) {
                const currentNodes = MyProjectStateManager.getCurrentNodes();
                const newCurrentNodes = MyProjectNodeManager.deleteNode(selectedNode.id, currentNodes);

                if (viewStack.length > 0) {
                    viewStack[viewStack.length - 1].children = newCurrentNodes;
                } else {
                    MyProjectStateManager.setRootNodes(newCurrentNodes);
                }
                MyProjectStateManager.setCurrentNodes(newCurrentNodes);
                MyProjectStateManager.setSelectedNode(null);
                MyProjectDataStorage.saveNodes(MyProjectStateManager.getRootNodes());
                draw();
            }
            break;
        case 'c':
            if (e.ctrlKey || e.metaKey) {
                MyProjectUIManager.openCompendium();
            }
            break;
        case 'f':
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                MyProjectUIManager.openSearch();
            }
            break;
    }
}

// --- Helper Functions ---

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
}

function navigateToNode(path, nodeId) {
    const node = MyProjectNodeManager.findNodeByIdPath(nodeId, MyProjectStateManager.getRootNodes());
    if (node) {
        MyProjectStateManager.setViewStack(path);
        MyProjectStateManager.setCurrentNodes(node.children);
        MyProjectUIManager.updateUIChrome();
        draw();
    }
}

function draw() {
    const state = MyProjectStateManager.getState();
    MyProjectCanvasRenderer.draw(
        state.rootNodes,
        state.viewStack,
        state.currentNodes,
        state.scale,
        state.offsetX,
        state.offsetY,
        state.selectedNode
    );
}

// --- Initialization ---
init();
