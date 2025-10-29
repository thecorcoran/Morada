// This file is required by the index.html file and will
// be executed in the renderer process for that window.

// --- Imports and Global State ---
// The canonical canvas id in the HTML/CSS is `nest-canvas`.
const canvas = document.getElementById('nest-canvas');
const ctx = canvas.getContext('2d');
// Snap/grid size (pixels in world coords)
const GRID_SIZE = 20;

// --- State (now managed by StateManager) ---
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let lastMousePosition = { x: 0, y: 0 };

// --- Initialization ---
async function init() {
    console.log('[renderer] init: starting');
    try {
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

    // Initialize the EditorManager after the UIManager so it can receive
    // the uiManager and dataStorage references it needs to configure TinyMCE.
    MyProjectEditorManager.init({
        stateManager: MyProjectStateManager,
        uiManager: MyProjectUIManager,
        dataStorage: MyProjectDataStorage,
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

    // Fit nodes into view so they're visible and clustered at start
    try { if (window.MyProjectUIManager && typeof window.MyProjectUIManager.fitNodesToView === 'function') window.MyProjectUIManager.fitNodesToView(); } catch (e) { console.warn('fitNodesToView initial call failed', e); }

    // Event Listeners
    setupEventListeners();
    console.log('[renderer] init: completed');
    // Add a small debug overlay so users can visually confirm the renderer
    // finished initialization. Click to dismiss.
    try {
        const overlay = document.createElement('div');
        overlay.id = 'renderer-ready-overlay';
        overlay.textContent = 'Renderer initialized — click to dismiss';
        Object.assign(overlay.style, {
            position: 'fixed',
            right: '12px',
            bottom: '12px',
            background: 'rgba(0,0,0,0.75)',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '6px',
            zIndex: 99999,
            cursor: 'pointer'
        });
        overlay.addEventListener('click', () => overlay.remove());
        document.body.appendChild(overlay);
    } catch (err) {
        console.error('[renderer] overlay creation failed:', err);
    }
    } catch (err) {
        console.error('[renderer] init failed:', err);
    }
}

function setupEventListeners() {
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('wheel', onWheel);
    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('keydown', onKeyDown);
    // Hide custom context menu on any document click
    document.addEventListener('click', (ev) => {
        try { const cm = document.getElementById('canvas-context-menu'); if (cm) cm.classList.add('hidden'); } catch (e) {}
    });
    // Prevent the browser's default context menu on the canvas
    canvas.addEventListener('contextmenu', (ev) => { ev.preventDefault(); });
}

// --- Event Handlers ---

function onMouseDown(e) {
    const { x, y } = getMousePos(e);
    lastMousePosition = { x, y };

    const clickedNode = MyProjectNodeManager.getNodeAtPosition(x, y);

    console.log('[renderer] onMouseDown at', x, y, 'clickedNode=', clickedNode && clickedNode.id);

    if (e.button === 2 || e.ctrlKey) { // Right-click or Ctrl-click -> show custom context menu
        try {
            const menu = document.getElementById('canvas-context-menu');
            if (menu) {
                // Position the menu at mouse location
                menu.style.left = (e.clientX) + 'px';
                menu.style.top = (e.clientY) + 'px';
                menu.classList.remove('hidden');
                // Wire the rename option to open the title editor for the clicked node
                const renameOpt = document.getElementById('rename-node-option');
                if (renameOpt) {
                    renameOpt.onclick = (evt) => {
                        evt.stopPropagation();
                        try {
                            if (clickedNode && window.MyProjectUIManager && typeof window.MyProjectUIManager.createTitleEditor === 'function') {
                                window.MyProjectUIManager.createTitleEditor(clickedNode);
                            }
                        } catch (err) { console.warn('rename handler failed', err); }
                        menu.classList.add('hidden');
                    };
                }
            }
        } catch (err) { console.warn('show context menu failed', err); }
        e.preventDefault();
        return;
    }

    if (clickedNode) {
        const selectedNode = MyProjectStateManager.getSelectedNode();
        if (selectedNode && selectedNode.isEditing) {
            MyProjectUIManager.createTitleEditor(selectedNode); // Changed from MyProjectNodeManager
        }
        // If the user clicks the already-selected node (single click), deselect it.
        if (selectedNode && selectedNode.id === clickedNode.id && e.detail === 1) {
            MyProjectStateManager.setSelectedNode(null);
            try { const m = document.getElementById('node-inspector-modal'); if (m) m.remove(); } catch (e) {}
            // don't start dragging this click
            isDragging = false;
            draw();
            return;
        }
        MyProjectStateManager.setSelectedNode(clickedNode);
        // Show node inspector overlay when selecting a container node
        try {
            if (clickedNode && clickedNode.type === 'container' && window.MyProjectUIManager && typeof window.MyProjectUIManager.showNodeInspector === 'function') {
                window.MyProjectUIManager.showNodeInspector(clickedNode);
            } else {
                // remove any existing inspector when selecting non-container
                const existing = document.getElementById('node-inspector-overlay'); if (existing) existing.remove();
            }
        } catch (err) { console.warn('showNodeInspector failed', err); }
        // Support double-click to open text nodes or enter containers
        if (e.detail === 2 || e.type === 'dblclick') {
            if (clickedNode.type === 'text') {
                console.log('[renderer] double-click/open attempt for text node', clickedNode.id);
                MyProjectEditorManager.openEditorMode(clickedNode);
                return;
            } else if (clickedNode.type === 'container') {
                console.log('[renderer] double-click/enter container', clickedNode.id);
                MyProjectStateManager.pushToViewStack(clickedNode);
                MyProjectStateManager.setCurrentNodes(clickedNode.children || []);
                MyProjectUIManager.updateUIChrome();
                draw();
                return;
            }
        }
        isDragging = true;
        dragStart = { x: x - clickedNode.x, y: y - clickedNode.y };
    } else {
        // Clicked empty space: clear selection and close any node inspector
        MyProjectStateManager.setSelectedNode(null);
        try { const m = document.getElementById('node-inspector-modal'); if (m) m.remove(); } catch (e) {}
        isDragging = true; // For panning
        dragStart = { x, y };
    }
    draw();
}

function onMouseUp(e) {
    isDragging = false;
    const sel = MyProjectStateManager.getSelectedNode();
    if (sel) {
        try {
            // Snap the node to grid to keep layout tidy
            sel.x = Math.round(sel.x / GRID_SIZE) * GRID_SIZE;
            sel.y = Math.round(sel.y / GRID_SIZE) * GRID_SIZE;
            // Make sure node remains visible in the viewport
            if (window.MyProjectUIManager && typeof window.MyProjectUIManager.ensureNodeVisible === 'function') {
                window.MyProjectUIManager.ensureNodeVisible(sel, 80);
            }
        } catch (err) { console.warn('post-drag snap/ensure failed', err); }
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
                // route delete through UIManager to allow confirmation and undo
                try {
                    if (window.MyProjectUIManager && typeof window.MyProjectUIManager.confirmAndDeleteNode === 'function') {
                        window.MyProjectUIManager.confirmAndDeleteNode(selectedNode);
                    } else {
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
                        try { if (window.MyProjectUIManager && window.MyProjectUIManager._autoFit && typeof window.MyProjectUIManager.fitNodesToView === 'function') window.MyProjectUIManager.fitNodesToView(); } catch (err) {}
                    }
                } catch (err) { console.warn('Delete handling failed', err); }
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
