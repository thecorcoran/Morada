// This file is required by the index.html file and will
// be executed in the renderer process for that window.

// --- Imports and Global State ---
// The canonical canvas id in the HTML/CSS is `nest-canvas`.
const canvas = document.getElementById('nest-canvas');
// Snap/grid size (pixels in world coords)
const GRID_SIZE = 20;

// --- State (now managed by StateManager) ---
let isDragging = false;
let isPotentialDrag = false;
let dragStartScreenPos = { x: 0, y: 0 };
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
    // In development mode, add a small debug overlay to visually confirm renderer init.
    try {
        const isDev = (typeof process !== 'undefined' && process.env && (process.env.NODE_ENV === 'development' || (process.argv && process.argv.includes('--dev')))) ||
                      (typeof window !== 'undefined' && window.location && window.location.search.includes('dev=true'));
        if (isDev) {
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
        }
    } catch (err) {
        console.error('[renderer] overlay creation failed:', err);
    }
    } catch (err) {
        console.error('[renderer] init failed:', err);
    }
}

function setupEventListeners() {
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
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

                const openOpt = document.getElementById('open-node-option');
                if (openOpt) {
                    openOpt.onclick = (evt) => {
                        evt.stopPropagation();
                        menu.classList.add('hidden');
                        if (!clickedNode) return;
                        if (clickedNode.type === 'text') {
                            MyProjectEditorManager.openEditorMode(clickedNode);
                        } else {
                            MyProjectStateManager.pushToViewStack(clickedNode);
                            MyProjectStateManager.setCurrentNodes(clickedNode.children || []);
                            MyProjectUIManager.updateUIChrome();
                            if (window.MyProjectUIManager && typeof window.MyProjectUIManager.fitNodesToView === 'function') {
                                window.MyProjectUIManager.fitNodesToView(80);
                            }
                            draw();
                        }
                    };
                }

                const renameOpt = document.getElementById('rename-node-option');
                if (renameOpt) {
                    renameOpt.onclick = (evt) => {
                        evt.stopPropagation();
                        menu.classList.add('hidden');
                        try {
                            if (clickedNode && window.MyProjectUIManager && typeof window.MyProjectUIManager.createTitleEditor === 'function') {
                                window.MyProjectUIManager.createTitleEditor(clickedNode);
                            }
                        } catch (err) { console.warn('rename handler failed', err); }
                    };
                }

                const inspectOpt = document.getElementById('inspect-node-option');
                if (inspectOpt) {
                    inspectOpt.onclick = (evt) => {
                        evt.stopPropagation();
                        menu.classList.add('hidden');
                        try {
                            if (clickedNode && window.MyProjectUIManager && typeof window.MyProjectUIManager.showNodeInspector === 'function') {
                                window.MyProjectUIManager.showNodeInspector(clickedNode);
                            }
                        } catch (err) { console.warn('inspect handler failed', err); }
                    };
                }
            }
        } catch (err) { console.warn('show context menu failed', err); }
        e.preventDefault();
        return;
    }

    if (clickedNode) {
        const selectedNode = MyProjectStateManager.getSelectedNode();
        if (selectedNode && selectedNode.isEditing && selectedNode.id !== clickedNode.id) {
            MyProjectUIManager.createTitleEditor(selectedNode);
        }
        MyProjectStateManager.setSelectedNode(clickedNode);

        // Support double-click to open text nodes or enter containers
        if (e.detail === 2 || e.type === 'dblclick') {
            isPotentialDrag = false;
            isDragging = false;
            if (clickedNode.type === 'text') {
                console.log('[renderer] double-click/open attempt for text node', clickedNode.id);
                MyProjectEditorManager.openEditorMode(clickedNode);
                return;
            } else if (clickedNode.type === 'container') {
                console.log('[renderer] double-click/enter container', clickedNode.id);
                MyProjectStateManager.pushToViewStack(clickedNode);
                MyProjectStateManager.setCurrentNodes(clickedNode.children || []);
                MyProjectUIManager.updateUIChrome();
                if (window.MyProjectUIManager && typeof window.MyProjectUIManager.fitNodesToView === 'function') {
                    window.MyProjectUIManager.fitNodesToView(80);
                }
                draw();
                return;
            }
        }
        isPotentialDrag = true;
        dragStartScreenPos = { x: e.clientX, y: e.clientY };
        isDragging = false;
    } else {
        // Clicked empty space: clear selection and close any node inspector
        MyProjectStateManager.setSelectedNode(null);
        try { const m = document.getElementById('node-inspector-modal'); if (m) m.remove(); } catch (e) {}

        if (e.detail === 2) {
            // Double click empty space: create a new node
            // Shift + double-click -> Sheet (text)
            // Normal double-click -> Portfolio (container)
            const isText = !!e.shiftKey;
            const id = 'node-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
            const scale = MyProjectStateManager.getScale();
            const offsetX = MyProjectStateManager.getOffsetX();
            const offsetY = MyProjectStateManager.getOffsetY();
            const worldPos = MyProjectCanvasRenderer.getCanvasWorldPosition(e.clientX, e.clientY, canvas, scale, offsetX, offsetY);
            const newNode = MyProjectNodeManager.createNode(worldPos.x, worldPos.y, isText, id);
            const current = MyProjectStateManager.getCurrentNodes();
            current.push(newNode);
            MyProjectStateManager.setCurrentNodes(current);
            MyProjectStateManager.setSelectedNode(newNode);
            MyProjectDataStorage.saveNodes(MyProjectStateManager.getRootNodes());
            if (window.MyProjectUIManager && typeof window.MyProjectUIManager.renderOutliner === 'function') {
                window.MyProjectUIManager.renderOutliner();
            }
            draw();
            return;
        }

        isPotentialDrag = true;
        dragStartScreenPos = { x: e.clientX, y: e.clientY };
        isDragging = false; // For panning
    }
    draw();
}

function onMouseUp() {
    isPotentialDrag = false;
    const wasDragging = isDragging;
    isDragging = false;
    canvas.style.cursor = (MyProjectCanvasRenderer.hoveredNode) ? 'pointer' : 'default';
    if (wasDragging) {
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
            draw();
        }
    }
}

function onMouseMove(e) {
    const { x, y } = getMousePos(e);

    if (isPotentialDrag && !isDragging) {
        const dist = Math.hypot(e.clientX - dragStartScreenPos.x, e.clientY - dragStartScreenPos.y);
        if (dist > 4) {
            isDragging = true;
        }
    }

    if (!isDragging) {
        const hovered = MyProjectNodeManager.getNodeAtPosition(x, y);
        const prevHovered = MyProjectCanvasRenderer.hoveredNode;
        if (hovered !== prevHovered) {
            MyProjectCanvasRenderer.setHoveredNode(hovered);
            canvas.style.cursor = hovered ? 'pointer' : 'default';
            draw();
        }
        return;
    }

    const dx = x - lastMousePosition.x;
    const dy = y - lastMousePosition.y;
    const scale = MyProjectStateManager.getScale();

    const selectedNode = MyProjectStateManager.getSelectedNode();
    if (selectedNode) { // Dragging a node
        selectedNode.x += dx / scale;
        selectedNode.y += dy / scale;
        canvas.style.cursor = 'grabbing';
    } else { // Panning the canvas
        MyProjectStateManager.setOffsetX(MyProjectStateManager.getOffsetX() - dx / scale);
        MyProjectStateManager.setOffsetY(MyProjectStateManager.getOffsetY() - dy / scale);
        canvas.style.cursor = 'grabbing';
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
                    MyProjectStateManager.setCurrentNodes(selectedNode.children || []);
                    MyProjectUIManager.updateUIChrome();
                    if (window.MyProjectUIManager && typeof window.MyProjectUIManager.fitNodesToView === 'function') {
                        window.MyProjectUIManager.fitNodesToView(80);
                    }
                    draw();
                }
            }
            break;
        case 'Backspace':
            if (viewStack.length > 0) {
                const popped = MyProjectStateManager.popFromViewStack();
                const newCurrentNodes = viewStack.length > 0 ? viewStack[viewStack.length - 1].children : MyProjectStateManager.getRootNodes();
                MyProjectStateManager.setCurrentNodes(newCurrentNodes);
                if (popped) {
                    MyProjectStateManager.setSelectedNode(popped);
                }
                MyProjectUIManager.updateUIChrome();
                if (window.MyProjectUIManager && typeof window.MyProjectUIManager.fitNodesToView === 'function') {
                    window.MyProjectUIManager.fitNodesToView(80);
                }
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
                e.preventDefault();
                MyProjectUIManager.openCompendium();
            }
            break;
        case 't':
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                if (window.MyProjectUIManager && typeof window.MyProjectUIManager.autoTidyDesk === 'function') {
                    window.MyProjectUIManager.autoTidyDesk();
                }
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
    if (!nodeId && path && path.id) {
        nodeId = path.id;
        path = [path];
    }
    const node = MyProjectNodeManager.findNodeByIdPath(nodeId, MyProjectStateManager.getRootNodes());
    if (node) {
        MyProjectStateManager.setViewStack(path);
        MyProjectStateManager.setCurrentNodes(node.children || []);
        MyProjectUIManager.updateUIChrome();
        if (window.MyProjectUIManager && typeof window.MyProjectUIManager.fitNodesToView === 'function') {
            window.MyProjectUIManager.fitNodesToView(80);
        }
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
