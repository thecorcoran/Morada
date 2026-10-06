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
let lastClickTime = 0;
let lastClickedNodeId = null;

// --- Initialization ---
async function init() {
    try {
        // Initialize DataStorage first
        await MyProjectDataStorage.init();

        // Load Data into StateManager
        const loadedNodes = await MyProjectDataStorage.loadNodes();
    MyProjectStateManager.setRootNodes(loadedNodes);

    // Initialize CanvasRenderer before UIManager so draw calls succeed immediately
    MyProjectCanvasRenderer.init(canvas, MyProjectUIManager.getWordCount);

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

    // Initial draw
    resizeCanvas();
    draw();

    // Fit nodes into view so they're visible and clustered at start
    try { if (window.MyProjectUIManager && typeof window.MyProjectUIManager.fitNodesToView === 'function') window.MyProjectUIManager.fitNodesToView(); } catch (e) { console.warn('fitNodesToView initial call failed', e); }

    // Event Listeners
    setupEventListeners();
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
    canvas.addEventListener('dblclick', (e) => {
        onMouseDown(e);
    });

    let lastTouchTime = 0;
    let lastTouchPos = { x: 0, y: 0 };
    let pinchStartDist = 0;
    let pinchStartScale = 1;

    canvas.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length === 1) {
            const touch = e.touches[0];
            const now = Date.now();
            const dist = Math.hypot(touch.clientX - lastTouchPos.x, touch.clientY - lastTouchPos.y);
            const isDoubleTap = (now - lastTouchTime < 380) && (dist < 35);
            lastTouchTime = now;
            lastTouchPos = { x: touch.clientX, y: touch.clientY };

            const syntheticEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY,
                detail: isDoubleTap ? 2 : 1,
                button: 0,
                type: isDoubleTap ? 'dblclick' : 'mousedown',
                preventDefault: () => { try { if (e.cancelable) e.preventDefault(); } catch (err) {} }
            };
            onMouseDown(syntheticEvent);
        } else if (e.touches && e.touches.length === 2) {
            pinchStartDist = Math.hypot(
                e.touches[1].clientX - e.touches[0].clientX,
                e.touches[1].clientY - e.touches[0].clientY
            );
            pinchStartScale = MyProjectStateManager.getScale();
        }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
        if (window.MyProjectEditorManager && typeof window.MyProjectEditorManager.isEditorOpen === 'function' && window.MyProjectEditorManager.isEditorOpen()) {
            isDragging = false;
            isPotentialDrag = false;
            return;
        }
        if (e.touches && e.touches.length === 1) {
            const touch = e.touches[0];
            lastTouchPos = { x: touch.clientX, y: touch.clientY };
            const syntheticEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => { try { if (e.cancelable) e.preventDefault(); } catch (err) {} }
            };
            onMouseMove(syntheticEvent);
            if (isDragging && e.cancelable) {
                e.preventDefault();
            }
        } else if (e.touches && e.touches.length === 2 && pinchStartDist > 0) {
            const currentDist = Math.hypot(
                e.touches[1].clientX - e.touches[0].clientX,
                e.touches[1].clientY - e.touches[0].clientY
            );
            const ratio = currentDist / pinchStartDist;
            const newScale = Math.min(Math.max(pinchStartScale * ratio, 0.2), 3.0);
            MyProjectStateManager.setScale(newScale);
            draw();
            if (e.cancelable) e.preventDefault();
        }
    }, { passive: false });

    window.addEventListener('touchend', () => {
        if (window.MyProjectEditorManager && typeof window.MyProjectEditorManager.isEditorOpen === 'function' && window.MyProjectEditorManager.isEditorOpen()) {
            pinchStartDist = 0;
            isDragging = false;
            isPotentialDrag = false;
            return;
        }
        pinchStartDist = 0;
        const syntheticEvent = {
            clientX: lastTouchPos.x,
            clientY: lastTouchPos.y,
            preventDefault: () => {}
        };
        onMouseUp(syntheticEvent);
    }, { passive: true });

    window.addEventListener('touchcancel', () => {
        pinchStartDist = 0;
        isDragging = false;
        isPotentialDrag = false;
    }, { passive: true });

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

    const scale = MyProjectStateManager.getScale();
    const offsetX = MyProjectStateManager.getOffsetX();
    const offsetY = MyProjectStateManager.getOffsetY();
    const worldPos = MyProjectCanvasRenderer.getCanvasWorldPosition(e.clientX, e.clientY, canvas, scale, offsetX, offsetY);

    const clickedNode = MyProjectNodeManager.getNodeAtPosition(x, y);

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
                            isPotentialDrag = false;
                            isDragging = false;
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

                const archiveOpt = document.getElementById('archive-node-option');
                if (archiveOpt) {
                    archiveOpt.onclick = (evt) => {
                        evt.stopPropagation();
                        menu.classList.add('hidden');
                        try {
                            if (clickedNode && window.MyProjectUIManager && typeof window.MyProjectUIManager.archiveNode === 'function') {
                                window.MyProjectUIManager.archiveNode(clickedNode);
                            }
                        } catch (err) { console.warn('archive handler failed', err); }
                    };
                }

                const deleteOpt = document.getElementById('delete-node-option');
                if (deleteOpt) {
                    deleteOpt.onclick = (evt) => {
                        evt.stopPropagation();
                        menu.classList.add('hidden');
                        try {
                            if (clickedNode && window.MyProjectUIManager && typeof window.MyProjectUIManager.confirmAndDeleteNode === 'function') {
                                window.MyProjectUIManager.confirmAndDeleteNode(clickedNode);
                            }
                        } catch (err) { console.warn('delete handler failed', err); }
                    };
                }
            }
        } catch (err) { console.warn('show context menu failed', err); }
        e.preventDefault();
        return;
    }

    const now = Date.now();
    const isQuickSecondTap = Boolean(lastClickTime && (now - lastClickTime < 400) && lastClickedNodeId === (clickedNode ? clickedNode.id : '__desk__'));
    const isDoubleAction = Boolean(e.detail === 2 || e.type === 'dblclick' || isQuickSecondTap);
    lastClickTime = now;
    lastClickedNodeId = clickedNode ? clickedNode.id : '__desk__';

    if (clickedNode) {
        const selectedNode = MyProjectStateManager.getSelectedNode();
        if (selectedNode && selectedNode.isEditing && selectedNode.id !== clickedNode.id) {
            const existing = document.querySelector('.node-editor');
            if (existing) {
                try { existing.blur(); } catch (err) {}
            }
        }
        MyProjectStateManager.setSelectedNode(clickedNode);
        if (window.MyProjectUIManager && typeof window.MyProjectUIManager.updateUIChrome === 'function') {
            window.MyProjectUIManager.updateUIChrome();
        }

        // Double-click / Double-tap action
        if (isDoubleAction) {
            isPotentialDrag = false;
            isDragging = false;

            // 1. Double-clicking specifically on the card's Title text triggers inline title rename:
            // Title is drawn at innerX = node.x + 18, innerY = node.y + 36 (font size 17px, line height ~22px).
            // Title boundary: y from node.y + 30 to node.y + 60, x from node.x + 14 to min(node.x + node.width - 18, node.x + titleWidth + 24).
            const titleText = clickedNode.title || 'Untitled';
            const approxCharW = 11;
            const titleTextWidth = Math.max(60, Math.min(clickedNode.width - 36, titleText.length * approxCharW + 24));
            const isClickOnTitleText = (
                worldPos.y >= clickedNode.y + 30 &&
                worldPos.y <= clickedNode.y + 60 &&
                worldPos.x >= clickedNode.x + 14 &&
                worldPos.x <= clickedNode.x + 18 + titleTextWidth
            );

            if (isClickOnTitleText) {
                if (window.MyProjectUIManager && typeof window.MyProjectUIManager.createTitleEditor === 'function') {
                    window.MyProjectUIManager.createTitleEditor(clickedNode);
                    return;
                }
            }

            // 2. Double-clicking anywhere else on the card opens the sheet into editor or enters the portfolio:
            if (clickedNode.type === 'text') {
                MyProjectEditorManager.openEditorMode(clickedNode);
                return;
            } else if (clickedNode.type === 'container') {
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
        if (window.MyProjectUIManager && typeof window.MyProjectUIManager.updateUIChrome === 'function') {
            window.MyProjectUIManager.updateUIChrome();
        }
        const existing = document.querySelector('.node-editor');
        if (existing) {
            try { existing.blur(); } catch (err) {}
        }
        try { const m = document.getElementById('node-inspector-modal'); if (m) m.remove(); } catch (e) {}

        if (isDoubleAction) {
            // Double click empty space: create a new node
            // Shift + double-click -> Sheet (text)
            // Normal double-click -> Portfolio (container)
            const isText = !!e.shiftKey;
            const id = 'node-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
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
            if (window.MyProjectUIManager && typeof window.MyProjectUIManager.createTitleEditor === 'function') {
                window.MyProjectUIManager.createTitleEditor(newNode);
            }
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
    if (MyProjectEditorManager.isEditorOpen() || MyProjectUIManager.isCompendiumOpen() || MyProjectUIManager.isSearchOpen() || (window.MyProjectUIManager && typeof window.MyProjectUIManager.isArchiveModalOpen === 'function' && window.MyProjectUIManager.isArchiveModalOpen())) {
        return; // Modals handle their own events
    }

    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
        return;
    }

    const selectedNode = MyProjectStateManager.getSelectedNode();
    const viewStack = MyProjectStateManager.getViewStack();

    switch (e.key) {
        case 'a':
        case 'A':
            if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
                e.preventDefault();
                if (window.MyProjectUIManager && typeof window.MyProjectUIManager.openArchiveModal === 'function') {
                    window.MyProjectUIManager.openArchiveModal();
                }
            } else if (selectedNode && !e.ctrlKey && !e.metaKey && !e.altKey && !selectedNode.isEditing) {
                e.preventDefault();
                if (window.MyProjectUIManager && typeof window.MyProjectUIManager.archiveNode === 'function') {
                    window.MyProjectUIManager.archiveNode(selectedNode);
                }
            }
            break;
        case 'F2':
            if (selectedNode && !selectedNode.isEditing) {
                e.preventDefault();
                if (window.MyProjectUIManager && typeof window.MyProjectUIManager.createTitleEditor === 'function') {
                    window.MyProjectUIManager.createTitleEditor(selectedNode);
                }
            }
            break;
        case 'Enter':
            if (selectedNode) {
                if (selectedNode.type === 'text') {
                    isPotentialDrag = false;
                    isDragging = false;
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
        case 'Escape':
            {
                // 1. Close any visible modal, vault, search, or dialog
                const activeModal = document.querySelector(
                    '.modal:not(.hidden), #compendium-modal:not(.hidden), #archive-modal:not(.hidden), #search-palette:not(.hidden)'
                );
                if (activeModal) {
                    try {
                        const closeBtn = activeModal.querySelector(
                            '.close-button, .modal-close-btn, .close-btn, .craft-close-btn, #close-compendium-btn, #close-archive-btn, #close-comment-modal, #close-certify-word-btn, #close-etymology-btn'
                        );
                        if (closeBtn) {
                            closeBtn.click();
                            break;
                        } else {
                            activeModal.classList.add('hidden');
                            break;
                        }
                    } catch (e) {}
                }

                // 2. Hide context menu
                const ctxMenu = document.getElementById('canvas-context-menu');
                if (ctxMenu && !ctxMenu.classList.contains('hidden')) {
                    ctxMenu.classList.add('hidden');
                    break;
                }

                // 3. Clear canvas tag filter if active
                if (window.MyProjectCanvasRenderer && typeof window.MyProjectCanvasRenderer.getActiveTagFilter === 'function' && window.MyProjectCanvasRenderer.getActiveTagFilter()) {
                    if (window.MyProjectUIManager && typeof window.MyProjectUIManager.clearCanvasFilter === 'function') {
                        window.MyProjectUIManager.clearCanvasFilter();
                    }
                    draw();
                    break;
                }

                // 4. If inside a portfolio (viewStack > 0), navigate up to parent portfolio or desk root
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
                } else if (selectedNode) {
                    // 5. Clear selection if on root desk
                    MyProjectStateManager.setSelectedNode(null);
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
    canvas.width = canvas.clientWidth || window.innerWidth;
    canvas.height = canvas.clientHeight || window.innerHeight;
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
