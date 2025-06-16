const fs = require('fs');
const path = require('path');
const Sortable = require('sortablejs');

// --- DOM ELEMENT GETTERS ---
const canvas = document.getElementById('nest-canvas'); const ctx = canvas.getContext('2d');
const breadcrumbBar = document.getElementById('breadcrumb-bar'); const viewTitle = document.getElementById('view-title');
const editorMode = document.getElementById('editor-mode'); const editorWordCount = document.getElementById('editor-word-count');
const tagList = document.getElementById('tag-list'); const tagInput = document.getElementById('tag-input');
const searchPalette = document.getElementById('search-palette'); const searchInput = document.getElementById('search-input'); const searchResults = document.getElementById('search-results');
const compendiumModal = document.getElementById('compendium-modal');
const closeCompendiumBtn = document.getElementById('close-compendium-btn');
const compendiumLibrary = document.getElementById('compendium-library');
const compendiumManuscript = document.getElementById('compendium-manuscript');
const generateBtn = document.getElementById('generate-btn');
const compendiumFilter = document.getElementById('compendium-filter');

// --- STATE MANAGEMENT ---
let scale = 1, offsetX = 0, offsetY = 0, rootNodes = [], viewStack = [];
const dataPath = path.join(__dirname, 'morada-data.json');
let isPanning = false, isDragging = false, selectedNode = null;
let dragOffsetX = 0, dragOffsetY = 0, lastMouseX = 0, lastMouseY = 0;
const NODE_WIDTH = 250, NODE_HEIGHT = 150;
let tinymceEditor;
let manuscriptList = [];
let sortableInstance = null;

// --- CORE DATA & DRAWING ---
function getCurrentNodes() { if (viewStack.length === 0) return rootNodes; return viewStack[viewStack.length - 1].children; }
function saveNodes() { const data = JSON.stringify(rootNodes, null, 2); fs.writeFileSync(dataPath, data); }
function loadNodes() { try { if (fs.existsSync(dataPath)) { const data = fs.readFileSync(dataPath); rootNodes = JSON.parse(data); normalizeNodes(rootNodes); } } catch (err) { console.error("Error loading nodes:", err); rootNodes = []; } }

function draw() {
    updateUIChrome();
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2); ctx.scale(scale, scale); ctx.translate(-canvas.width / 2 - offsetX, -canvas.height / 2 - offsetY);
    const allLevels = [rootNodes, ...viewStack.map(n => n.children)];
    allLevels.forEach((levelNodes) => {
        const isCurrentLevel = levelNodes === getCurrentNodes();
        const isAncestor = (node) => viewStack.includes(node);
        levelNodes.forEach(node => {
            const nodeColor = node.type === 'text' ? '#fdf5e6' : '#f5f5f5';
            let fillAlpha = 0.1, textAlpha = 0.7, strokeStyle = null, strokeWidth = 2 / scale;
            if (isCurrentLevel) {
                fillAlpha = 1.0; textAlpha = 1.0;
                if (node.selected) { strokeStyle = '#007bff'; strokeWidth = 4 / scale; }
            } else if (isAncestor(node)) {
                fillAlpha = 0.25; strokeStyle = nodeColor; textAlpha = 0.6;
            }
            ctx.globalAlpha = fillAlpha; ctx.fillStyle = nodeColor; ctx.beginPath(); ctx.roundRect(node.x, node.y, node.width, node.height, 15); ctx.fill();
            if (strokeStyle) { ctx.strokeStyle = strokeStyle; ctx.lineWidth = strokeWidth; ctx.stroke(); }
            if (!node.isEditing) {
                ctx.globalAlpha = textAlpha;
                ctx.fillStyle = '#333'; ctx.font = `bold 16px 'Vollkorn', serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(node.title, node.x + node.width / 2, node.y + node.height / 2);
                if (node.type === 'text') {
                    const wordCount = getWordCount(node.content);
                    ctx.font = `12px 'Vollkorn', serif`;
                    ctx.textAlign = 'right';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(`${wordCount} words`, node.x + node.width - 10, node.y + node.height - 10);
                }
            }
        });
    });
    ctx.restore();
}

// --- HELPER FUNCTIONS ---
function updateUIChrome() { let path = 'The Grounds'; viewStack.forEach(node => { path += ` / ${node.title}`; }); breadcrumbBar.textContent = path; if (viewStack.length === 0) { viewTitle.textContent = 'The Castle Grounds'; } else { viewTitle.textContent = viewStack[viewStack.length - 1].title; } }
function getWordCount(content) { if (!content) return 0; const tempDiv = document.createElement('div'); tempDiv.innerHTML = content; const text = tempDiv.textContent || tempDiv.innerText || ''; return text.trim() ? text.trim().split(/\s+/).length : 0; }
function normalizeNodes(nodesToNormalize) {
    nodesToNormalize.forEach(node => {
        if (!node.children) node.children = [];
        if (!node.type) node.type = 'container';
        if (node.title === undefined) node.title = 'Untitled';
        if (node.content === undefined) node.content = '';
        if (!node.tags) node.tags = [];
        node.isExpanded = false;
        node.width = NODE_WIDTH;
        node.height = NODE_HEIGHT;
        node.selected = false;
        normalizeNodes(node.children);
    });
}
function renderTags(node) {
    tagList.innerHTML = '';
    if (node && node.tags) {
        node.tags.forEach(tag => {
            const tagPill = document.createElement('div'); tagPill.className = 'tag-pill'; tagPill.textContent = tag;
            const deleteBtn = document.createElement('button'); deleteBtn.className = 'tag-delete-btn'; deleteBtn.textContent = '×';
            deleteBtn.onclick = () => { node.tags = node.tags.filter(t => t !== tag); saveNodes(); renderTags(node); };
            tagPill.appendChild(deleteBtn);
            tagList.appendChild(tagPill);
        });
    }
}
function getNodeAtPosition(mouseX, mouseY) { const worldX = (mouseX - canvas.clientWidth / 2) / scale + canvas.width / 2 + offsetX; const worldY = (mouseY - canvas.clientHeight / 2) / scale + canvas.height / 2 + offsetY; const currentNodes = getCurrentNodes(); for (let i = currentNodes.length - 1; i >= 0; i--) { const node = currentNodes[i]; if (worldX >= node.x && worldX <= node.x + node.width && worldY >= node.y && worldY <= node.y + node.height) { return node; } } return null; }
function createTitleEditor(node) {
    node.isEditing = true; draw();
    const editor = document.createElement('input'); editor.type = 'text'; editor.className = 'node-editor'; editor.value = node.title;
    const screenX = (node.x - offsetX - canvas.clientWidth / 2) * scale + canvas.clientWidth / 2; const screenY = (node.y - offsetY - canvas.clientHeight / 2) * scale + canvas.clientHeight / 2;
    editor.style.left = `${screenX}px`; editor.style.top = `${screenY}px`; editor.style.width = `${node.width * scale}px`; editor.style.fontSize = `${16 * scale}px`;
    document.body.appendChild(editor); editor.focus(); editor.select();
    const saveAndRemove = () => { node.title = editor.value; node.isEditing = false; document.body.removeChild(editor); saveNodes(); draw(); };
    editor.addEventListener('blur', saveAndRemove);
    editor.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.stopPropagation(); editor.removeEventListener('blur', saveAndRemove); saveAndRemove(); } });
}
function openEditorMode(node) {
    selectedNode = node;
    editorMode.classList.remove('hidden');
    const editor = tinymce.get('main-editor');
    if (editor) {
        editor.setContent(node.content || '');
        editorWordCount.textContent = `Words: ${getWordCount(node.content)}`;
        renderTags(node);
        editor.focus();
    }
}
function closeEditorMode() {
    const editor = tinymce.get('main-editor');
    if (selectedNode && editor) {
        selectedNode.content = editor.getContent();
        saveNodes();
    }
    editorMode.classList.add('hidden');
    draw();
}
function openCompendium() { manuscriptList = []; refreshCompendiumView(); compendiumModal.classList.remove('hidden'); }
function closeCompendium() { compendiumModal.classList.add('hidden'); }
function refreshCompendiumView() {
    const filterTerm = compendiumFilter.value;
    compendiumLibrary.innerHTML = '';
    buildTree(rootNodes, compendiumLibrary, filterTerm);
    renderManuscript();
}
function renderManuscript() {
    compendiumManuscript.innerHTML = '';
    if (manuscriptList.length === 0) { if (sortableInstance) { sortableInstance.destroy(); sortableInstance = null; } return; }
    const ol = document.createElement('ol');
    manuscriptList.forEach(node => {
        const li = document.createElement('li');
        const titleSpan = document.createElement('span'); titleSpan.textContent = node.title;
        li.appendChild(titleSpan);
        if (node.type === 'container') {
            const label = document.createElement('label'); label.className = 'include-notes-label';
            const checkbox = document.createElement('input'); checkbox.type = 'checkbox';
            checkbox.checked = node.includeNotes || false;
            checkbox.onchange = () => { node.includeNotes = checkbox.checked; };
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(' Include Notes'));
            li.appendChild(label);
        }
        ol.appendChild(li);
    });
    compendiumManuscript.appendChild(ol);
    if (sortableInstance) sortableInstance.destroy();
    sortableInstance = Sortable.create(ol, { animation: 150, onEnd: (evt) => { const item = manuscriptList.splice(evt.oldIndex, 1)[0]; manuscriptList.splice(evt.newIndex, 0, item); renderManuscript(); } });
}
function filterTree(nodes, searchTerm, isTagSearch) {
    return nodes.reduce((acc, node) => {
        const children = (node.children && node.children.length > 0) ? filterTree(node.children, searchTerm, isTagSearch) : [];
        let isMatch = false;
        if (isTagSearch) {
            if (node.tags && node.tags.some(tag => tag.toLowerCase().includes(searchTerm))) { isMatch = true; }
        } else {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = node.content;
            const plainTextContent = tempDiv.textContent || tempDiv.innerText || '';
            if (node.title.toLowerCase().includes(searchTerm) || plainTextContent.toLowerCase().includes(searchTerm)) {
                isMatch = true;
            }
        }
        if (isMatch || children.length > 0) {
            acc.push({ ...node, children: children, isExpanded: true });
        }
        return acc;
    }, []);
}
function buildTree(nodes, parentElement, filterTerm = '') {
    const ul = document.createElement('ul');
    let nodesToDisplay = nodes;
    if (filterTerm.trim()) {
        const isTagSearch = filterTerm.startsWith('#');
        const searchTerm = (isTagSearch ? filterTerm.substring(1) : filterTerm).toLowerCase();
        if (searchTerm) { nodesToDisplay = filterTree(nodes, searchTerm, isTagSearch); }
    }
    nodesToDisplay.forEach(node => {
        const li = document.createElement('li');
        li.dataset.nodeId = node.id;
        if (manuscriptList.find(item => item.id === node.id)) { li.classList.add('selected-for-compile'); }
        const toggle = document.createElement('span'); toggle.className = 'tree-toggle';
        if (node.type === 'container' && node.children && node.children.length > 0) {
            const isExpanded = filterTerm ? true : node.isExpanded; // Auto-expand filtered results
            toggle.textContent = isExpanded ? '▾ ' : '▸ ';
            if (!isExpanded) li.classList.add('collapsed');
            toggle.addEventListener('click', (e) => { e.stopPropagation(); node.isExpanded = !node.isExpanded; refreshCompendiumView(); });
        } else {
            toggle.innerHTML = '&nbsp;&nbsp;';
        }
        const label = document.createElement('span');
        label.className = 'tree-item-label';
        label.textContent = node.title;
        li.appendChild(toggle); li.appendChild(label);
        li.addEventListener('click', (e) => { e.stopPropagation(); if (e.target === toggle) return; const existingIndex = manuscriptList.findIndex(item => item.id === node.id); if (existingIndex > -1) { manuscriptList.splice(existingIndex, 1); } else { manuscriptList.push(node); } refreshCompendiumView(); });
        if (node.type === 'container' && node.children && node.children.length > 0) {
            buildTree(node.children, li, filterTerm);
        }
        ul.appendChild(li);
    });
    parentElement.appendChild(ul);
}
function compileAndDownload() {
    let output = '';
    const tempDiv = document.createElement('div');
    manuscriptList.forEach(node => {
        if (node.type === 'container') { output += `\n\n## ${node.title.toUpperCase()} ##\n\n`; if (node.includeNotes && node.content) { tempDiv.innerHTML = node.content; output += `${tempDiv.textContent || tempDiv.innerText || ''}\n\n`; } }
        else if (node.type === 'text') { output += `### ${node.title} ###\n\n`; if (node.content) { tempDiv.innerHTML = node.content; output += `${tempDiv.textContent || tempDiv.innerText || ''}\n\n`; } }
    });
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Morada_Export.txt';
    a.click();
    URL.revokeObjectURL(url);
}
function openSearch() { searchPalette.classList.remove('hidden'); searchInput.value = ''; searchResults.innerHTML = ''; searchInput.focus(); }
function closeSearch() { searchPalette.classList.add('hidden'); }
function search(query, nodesToSearch, currentPath) {
    let results = [];
    const isTagSearch = query.startsWith('#');
    const searchTerm = (isTagSearch ? query.substring(1) : query).toLowerCase();
    if (searchTerm.length === 0) return [];
    for (const node of nodesToSearch) {
        const newPath = [...currentPath, node]; let isMatch = false;
        const tempDiv = document.createElement('div'); tempDiv.innerHTML = node.content; const plainTextContent = tempDiv.textContent || tempDiv.innerText || '';
        if (isTagSearch) {
            if (node.tags && node.tags.some(tag => tag.toLowerCase().includes(searchTerm))) { isMatch = true; }
        } else {
            const nodeText = `${node.title} ${plainTextContent}`.toLowerCase();
            if (nodeText.includes(searchTerm)) { isMatch = true; }
        }
        if (isMatch) { results.push({ ...node, path: newPath }); }
        results = results.concat(search(query, node.children, newPath));
    }
    return results;
}
function displayResults(results) {
    searchResults.innerHTML = '';
    results.forEach(result => {
        const resultEl = document.createElement('div');
        resultEl.className = 'search-result-item';
        const pathString = ['The Grounds', ...result.path.map(p => p.title)].join(' / ');
        resultEl.innerHTML = `<div class="result-text">${result.title}</div><div class="result-path">${pathString}</div>`;
        resultEl.addEventListener('click', () => {
            viewStack = result.path.slice(0, -1);
            draw();
            const targetNode = getCurrentNodes().find(n => n.id === result.id);
            if (targetNode) {
                getCurrentNodes().forEach(n => n.selected = false);
                targetNode.selected = true; selectedNode = targetNode;
                offsetX = targetNode.x; offsetY = targetNode.y; scale = 1.2;
                draw();
            }
            closeSearch();
        });
        searchResults.appendChild(resultEl);
    });
}

// --- EVENT LISTENERS ---
canvas.addEventListener('mousedown', (e) => { const clickedNode = getNodeAtPosition(e.offsetX, e.offsetY); if(selectedNode){selectedNode.selected = false;} if (clickedNode) { clickedNode.selected = true; selectedNode = clickedNode; isDragging = true; isPanning = false; const worldX = (e.offsetX - canvas.clientWidth / 2) / scale + canvas.width / 2 + offsetX; const worldY = (e.offsetY - canvas.clientHeight / 2) / scale + canvas.height / 2 + offsetY; dragOffsetX = worldX - clickedNode.x; dragOffsetY = worldY - clickedNode.y; } else { selectedNode = null; isDragging = false; isPanning = true; lastMouseX = e.offsetX; lastMouseY = e.offsetY; } draw(); });
canvas.addEventListener('mouseup', () => { if (isDragging) saveNodes(); isPanning = false; isDragging = false; });
canvas.addEventListener('mousemove', (e) => { if(isDragging && selectedNode) { const worldX = (e.offsetX - canvas.clientWidth / 2) / scale + canvas.width / 2 + offsetX; const worldY = (e.offsetY - canvas.clientHeight / 2) / scale + canvas.height / 2 + offsetY; selectedNode.x = worldX - dragOffsetX; selectedNode.y = worldY - dragOffsetY; draw(); return; } if (!isPanning) return; const dx = e.offsetX - lastMouseX; const dy = e.offsetY - lastMouseY; offsetX -= dx / scale; offsetY -= dy / scale; lastMouseX = e.offsetX; lastMouseY = e.offsetY; draw(); });
canvas.addEventListener('wheel', (e) => { e.preventDefault(); const zoomIntensity = 0.1; const scroll = e.deltaY < 0 ? 1 : -1; const zoom = Math.exp(scroll * zoomIntensity); const worldX = (e.offsetX - canvas.clientWidth / 2) / scale + canvas.width / 2 + offsetX; const worldY = (e.offsetY - canvas.clientHeight / 2) / scale + canvas.height / 2 + offsetY; scale *= zoom; offsetX = worldX - (e.offsetX - canvas.width / 2) / scale - canvas.width / 2; offsetY = worldY - (e.offsetY - canvas.height / 2) / scale - canvas.height / 2; draw(); });
canvas.addEventListener('dblclick', (e) => {
  const clickedNode = getNodeAtPosition(e.offsetX, e.offsetY);
  if (clickedNode) {
    if (e.ctrlKey) { createTitleEditor(clickedNode); }
    else if (clickedNode.type === 'container') { viewStack.push(clickedNode); offsetX = 0; offsetY = 0; scale = 1; selectedNode = null; }
    else if (clickedNode.type === 'text') { openEditorMode(clickedNode); }
  } else {
    const worldX = (e.offsetX - canvas.clientWidth / 2) / scale + canvas.width / 2 + offsetX;
    const worldY = (e.offsetY - canvas.clientHeight / 2) / scale + canvas.height / 2 + offsetY;
    const newNode = { id: Date.now() + Math.random(), x: worldX - NODE_WIDTH/2, y: worldY - NODE_HEIGHT/2, width: NODE_WIDTH, height: NODE_HEIGHT, selected: false, isEditing: false, children: [], type: e.shiftKey ? 'text' : 'container', title: e.shiftKey ? 'New Scriptorium' : 'New Chamber', content: '', tags: [] };
    getCurrentNodes().push(newNode);
    saveNodes();
  }
  draw();
});
tagInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && selectedNode) { e.preventDefault(); const newTag = tagInput.value.trim(); if (newTag && !selectedNode.tags.includes(newTag)) { selectedNode.tags.push(newTag); saveNodes(); renderTags(selectedNode); } tagInput.value = ''; } });
closeCompendiumBtn.addEventListener('click', closeCompendium);
generateBtn.addEventListener('click', compileAndDownload);
searchInput.addEventListener('input', () => { const query = searchInput.value; if (query.length > 1 || (query.startsWith('#') && query.length > 1)) { const results = search(query, rootNodes, []); displayResults(results); } else { searchResults.innerHTML = ''; } });
compendiumFilter.addEventListener('input', refreshCompendiumView);
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'k') { e.preventDefault(); openSearch(); return; }
  if (e.key === 'F3') { e.preventDefault(); if (compendiumModal.classList.contains('hidden')) { openCompendium(); } else { closeCompendium(); } return; }
  if (e.key === 'Escape') {
    if (!searchPalette.classList.contains('hidden')) { closeSearch(); return; }
    if (!compendiumModal.classList.contains('hidden')) { closeCompendium(); return; }
    if (!editorMode.classList.contains('hidden')) { return; }
    const titleEditor = document.querySelector('.node-editor');
    if (titleEditor) { titleEditor.blur(); return; }
    if (viewStack.length > 0) { viewStack.pop(); offsetX = 0; offsetY = 0; scale = 1; selectedNode = null; draw(); }
    return;
  }
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') { return; }
  if (selectedNode && (e.key === 'Delete' || e.key === 'Backspace')) {
    let currentNodes = getCurrentNodes(); let newNodes = currentNodes.filter(node => node.id !== selectedNode.id);
    if (viewStack.length === 0) { rootNodes = newNodes; } else { viewStack[viewStack.length - 1].children = newNodes; }
    selectedNode = null; saveNodes(); draw();
  }
});
window.addEventListener('resize', () => { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; draw(); });

// --- INITIALIZATION ---
function initialize() {
  tinymce.init({
    selector: '#main-editor',
    plugins: 'lists link wordcount',
    toolbar: 'undo redo | bold italic underline | bullist numlist | link',
    menubar: false,
    statusbar: true,
    content_css: false,
    content_style: ` body { font-family: 'Vollkorn', serif; font-size: 18px; line-height: 1.6; background-color: #fdf5e6; padding: 2em; }`,
    height: "100%", width: "100%",
    setup: function (editor) {
        editor.on('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); closeEditorMode(); } });
        editor.on('input', () => {
            const editor = tinymce.get('main-editor');
            if(selectedNode && editor && editor.plugins.wordcount) {
                const wordCount = editor.plugins.wordcount.body.getWordCount();
                editorWordCount.textContent = `Words: ${wordCount}`;
            }
        });
    }
  });
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  loadNodes();
  draw();
}
window.addEventListener('DOMContentLoaded', initialize);