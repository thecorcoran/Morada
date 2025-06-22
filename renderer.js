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
const timerDurationInput = document.getElementById('timer-duration-input');
const timerStartBtn = document.getElementById('timer-start-btn');
const writingTimerDisplay = document.getElementById('writing-timer-display');
const etymologyModal = document.getElementById('etymology-modal');
const etymologyWord = document.getElementById('etymology-word');
const etymologyResultArea = document.getElementById('etymology-result-area');
const closeEtymologyBtn = document.getElementById('close-etymology-btn');
const certifyWordModal = document.getElementById('certify-word-modal');
const certifySelectedWordSpan = document.getElementById('certify-selected-word');
const certifyDefinitionInput = document.getElementById('certify-definition-input');
const closeCertifyWordBtn = document.getElementById('close-certify-word-btn');
const saveCertificationBtn = document.getElementById('save-certification-btn');
const cancelCertificationBtn = document.getElementById('cancel-certification-btn');
const certifiedWordTooltip = document.getElementById('certified-word-tooltip');
const wordGoalCurrentSpan = document.getElementById('word-goal-current');
const wordGoalInput = document.getElementById('word-goal-input');
const editorMetadata = document.getElementById('editor-metadata'); // Get the container for the tools pane


let currentWordToCertify = null; // To store the word being certified

// --- STATE MANAGEMENT ---
let scale = 1, offsetX = 0, offsetY = 0, rootNodes = [], viewStack = [];
const dataPath = path.join(__dirname, 'morada-data.json');
const backupDataPath = path.join(__dirname, 'morada-data.json.bak');
let isPanning = false, isDragging = false, selectedNode = null;
let dragOffsetX = 0, dragOffsetY = 0, lastMouseX = 0, lastMouseY = 0;
const NODE_WIDTH = 250, NODE_HEIGHT = 150;
let tinymceEditor;
let manuscriptList = [];
let sortableInstance = null;

// Timer State
let timerInterval = null;
let timerSecondsElapsed = 0;
let timerTargetSeconds = 0;
let isTimerRunning = false;

// --- CORE DATA & DRAWING ---
function getCurrentNodes() { if (viewStack.length === 0) return rootNodes; return viewStack[viewStack.length - 1].children; }

function saveNodes() {
    console.log("Attempting to save nodes. Node count:", rootNodes.length);
    try {
        const data = JSON.stringify(rootNodes, null, 2);
        const tempPath = dataPath + '.tmp';

        // Create a backup of the current data file before overwriting
        if (fs.existsSync(dataPath)) {
            fs.copyFileSync(dataPath, backupDataPath);
            console.log("Backup created at:", backupDataPath);
        }

        fs.writeFileSync(tempPath, data, 'utf8');
        fs.renameSync(tempPath, dataPath);
        console.log("Nodes saved successfully to:", dataPath);
    } catch (err) {
        console.error("!!! CRITICAL: Error saving nodes:", err);
        // Optionally, try to restore backup if save failed partway?
        // For now, just log the error.
        alert("Critical error saving data. Please check console and consider manual backup of morada-data.json if possible.");
    }
}

function loadNodes() {
    console.log("Attempting to load nodes from:", dataPath);
    let data;
    try {
        if (fs.existsSync(dataPath)) {
            data = fs.readFileSync(dataPath, 'utf8');
            rootNodes = JSON.parse(data);
            normalizeNodes(rootNodes);
            console.log("Nodes loaded successfully. Node count:", rootNodes.length);
            // If successful, remove old backup as current file is good.
            if (fs.existsSync(backupDataPath)) {
                fs.unlinkSync(backupDataPath);
            }
        } else if (fs.existsSync(backupDataPath)) {
            console.warn("Main data file not found. Attempting to load from backup:", backupDataPath);
            alert("Main data file was missing. Attempting to restore from backup.");
            data = fs.readFileSync(backupDataPath, 'utf8');
            rootNodes = JSON.parse(data);
            normalizeNodes(rootNodes);
            // If backup load is successful, save it back to the main file path
            fs.writeFileSync(dataPath, data, 'utf8'); 
            console.log("Nodes loaded successfully from backup. Restored to main data file. Node count:", rootNodes.length);
        } else {
            console.log("No data file or backup file found. Initializing with empty rootNodes.");
            rootNodes = [];
        }
    } catch (err) {
        console.error("!!! CRITICAL: Error loading nodes from dataPath:", dataPath, err);
        alert(`Error loading data: ${err.message}. Trying to load from backup if available.`);
        try {
            if (fs.existsSync(backupDataPath)) {
                console.warn("Attempting to load from backup due to previous error:", backupDataPath);
                data = fs.readFileSync(backupDataPath, 'utf8');
                rootNodes = JSON.parse(data);
                normalizeNodes(rootNodes);
                // If backup load is successful, save it back to the main file path
                fs.writeFileSync(dataPath, data, 'utf8');
                console.log("Nodes loaded successfully from backup after primary load failed. Restored to main data file.");
                alert("Successfully loaded data from backup.");
            } else {
                console.error("No backup file found to restore from. Data may be lost.");
                alert("No backup file available. Initializing with empty data. Please check morada-data.json manually if you have important data.");
                rootNodes = [];
            }
        } catch (backupErr) {
            console.error("!!! CRITICAL: Error loading nodes from backupDataPath:", backupDataPath, backupErr);
            alert(`CRITICAL: Failed to load data from primary source and backup: ${backupErr.message}. Data may be lost. Please check morada-data.json manually.`);
            rootNodes = []; // Initialize to empty if all fails
        }
    }
    // Ensure normalizeNodes is always called if rootNodes might be populated, even from backup
    if (rootNodes && rootNodes.length > 0 && !data) { // If rootNodes got populated by a path that didn't call normalize yet
        normalizeNodes(rootNodes);
    }
}

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
        if (!node.certifiedWords) node.certifiedWords = []; // Initialize certifiedWords array
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
            const deleteBtn = document.createElement('button'); deleteBtn.className = 'tag-delete-btn'; deleteBtn.textContent = 'Remove'; // Changed from '×'
            deleteBtn.onclick = () => { node.tags = node.tags.filter(t => t !== tag); saveNodes(); renderTags(node); };
            tagPill.appendChild(deleteBtn);
            tagList.appendChild(tagPill);
        });
    }
}

function calculateNodesBoundingBox(nodes) {
    if (!nodes || nodes.length === 0) {
        // Return a default box that represents the initial view if no nodes are present
        // This helps prevent extreme zoom levels if the canvas starts empty.
        const defaultSize = Math.min(canvas.width, canvas.height) || 500; // Or some other sensible default
        return { minX: -defaultSize / 2, minY: -defaultSize / 2, maxX: defaultSize / 2, maxY: defaultSize / 2, width: defaultSize, height: defaultSize };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(node => {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
    });
    // Handle cases where all nodes are at the same point (width/height is 0)
    const width = (maxX - minX) || NODE_WIDTH; // Use default node width if calculated is 0
    const height = (maxY - minY) || NODE_HEIGHT; // Use default node height if calculated is 0
    return { minX, minY, maxX, maxY, width, height };
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

    // Reset timer state for the new editor session
    if (isTimerRunning) {
        stopTimer(true); // Stop and fully reset if it was running
    } else { // If not running, still ensure display is reset
        timerSecondsElapsed = 0;
        updateTimerDisplay();
    }
    writingTimerDisplay.classList.remove('timer-ended');
    timerDurationInput.disabled = false;
    timerStartBtn.textContent = 'Start Timer';
    // Consider resetting timerDurationInput.value to default or last user setting if appropriate

    const editor = tinymce.get('main-editor');
    if (editor) {
        // Set content first, then apply highlights
        editor.setContent(node.content || '');
        applyAndRefreshCertifiedWordHighlights(editor); // Apply after content is set

        editorWordCount.textContent = `Words: ${getWordCount(node.content)}`; // Word count based on raw content
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
    // Stop and reset timer when editor closes
    if (isTimerRunning) {
        stopTimer(true); // Pass true to reset the timer completely
    }
    timerSecondsElapsed = 0; // Ensure it's reset
    timerTargetSeconds = 0; // Ensure target is reset
    updateTimerDisplay(); // Update display to 00:00 and default color
    writingTimerDisplay.classList.remove('timer-ended'); // Explicitly remove red color
    timerDurationInput.disabled = false; // Re-enable input
    timerStartBtn.textContent = 'Start Timer'; // Reset button text

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

// --- CERTIFIED WORD FUNCTIONS ---

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function applyAndRefreshCertifiedWordHighlights(editor) {
    if (!editor || !selectedNode || !selectedNode.certifiedWords || selectedNode.certifiedWords.length === 0) {
        // If no certified words, ensure no highlights remain (e.g. if all were removed)
        if(editor && editor.dom) { // Check editor and dom exist
            const existingHighlights = editor.dom.select('span.certified-word');
            existingHighlights.forEach(span => editor.dom.replace(span, span.childNodes)); // Unwrap
            editor.nodeChanged(); // Notify editor of DOM change
        }
        return;
    }

    let content = editor.getContent({ format: 'html' });

    // First, unwrap any existing certified-word spans to avoid nested spans or outdated definitions
    // This is a bit crude; a more sophisticated approach would be to diff, but this is simpler.
    const tempDoc = new DOMParser().parseFromString(content, 'text/html');
    tempDoc.querySelectorAll('span.certified-word').forEach(span => {
        while (span.firstChild) {
            span.parentNode.insertBefore(span.firstChild, span);
        }
        span.parentNode.removeChild(span);
    });
    content = tempDoc.body.innerHTML;
    
    selectedNode.certifiedWords.forEach(cw => {
        const wordRegex = new RegExp(`\\b(${escapeRegExp(cw.text)})\\b`, 'gi'); // 'gi' for global, case-insensitive
        // Sanitize definition for data attribute
        const sanitizedDefinition = cw.definition.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        content = content.replace(wordRegex, (match) => {
            // Avoid re-wrapping if inside certain tags already or if it's part of an attribute
            // This is a simplified check. More robust parsing might be needed for complex HTML.
            return `<span class="certified-word" data-definition="${sanitizedDefinition}">${match}</span>`;
        });
    });

    const currentBookmark = editor.selection.getBookmark(); // Preserve selection/cursor
    editor.setContent(content);
    editor.selection.moveToBookmark(currentBookmark);
    editor.nodeChanged(); // Important to let TinyMCE know of changes
}

function setupCertifiedWordHover(editor) {
    if (!editor || !certifiedWordTooltip) return;

    editor.on('mousemove', (e) => {
        const target = e.target;
        if (target.classList && target.classList.contains('certified-word')) {
            const definition = target.getAttribute('data-definition');
            if (definition) {
                certifiedWordTooltip.innerHTML = definition;
                certifiedWordTooltip.classList.remove('hidden');
                // Position tooltip near mouse, within editor bounds
                const editorRect = editor.getContainer().getBoundingClientRect();
                let x = e.clientX + 15; 
                let y = e.clientY + 15;

                // Adjust if tooltip goes out of editor bounds (simplified)
                if (x + certifiedWordTooltip.offsetWidth > editorRect.right) {
                    x = e.clientX - certifiedWordTooltip.offsetWidth - 10;
                }
                if (y + certifiedWordTooltip.offsetHeight > editorRect.bottom) {
                    y = e.clientY - certifiedWordTooltip.offsetHeight - 10;
                }
                // Position relative to document, not viewport, as TinyMCE might be scrolled
                x += window.scrollX;
                y += window.scrollY;

                certifiedWordTooltip.style.left = `${x}px`;
                certifiedWordTooltip.style.top = `${y}px`;
            }
        }
    });

    editor.on('mouseout', (e) => {
        // Hide tooltip if mouse leaves a certified word or the editor body
        if (e.target.classList && e.target.classList.contains('certified-word') || e.target === editor.getBody()) {
           if (certifiedWordTooltip && !certifiedWordTooltip.matches(':hover')) { // Don't hide if mouse moved onto tooltip itself
             certifiedWordTooltip.classList.add('hidden');
           }
        }
    });
     // Also hide if cursor leaves editor area entirely
    editor.on('mouseleave', () => {
        if (certifiedWordTooltip && !certifiedWordTooltip.matches(':hover')) {
            certifiedWordTooltip.classList.add('hidden');
        }
    });
}


// --- ETYMOLOGY FUNCTIONS ---
async function fetchEtymologyFromWiktionary(word) {
    const url = `https://en.wiktionary.org/w/api.php?action=query&prop=extracts&format=json&explaintext=true&titles=${encodeURIComponent(word)}&origin=*`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const data = await response.json();
        const pages = data.query.pages;
        const pageId = Object.keys(pages)[0];
        if (pageId === "-1") { // Word not found
            return "<p>Word not found in Wiktionary.</p>";
        }
        const extract = pages[pageId].extract;
        if (!extract) {
            return "<p>No extract found for this word. It might be a redirect or a very short entry.</p>";
        }
        return extract;
    } catch (error) {
        console.error("Error fetching etymology:", error);
        return `<p>Error fetching etymology: ${error.message}. Please check your internet connection.</p>`;
    }
}

function parseWiktionaryExtract(extract, word) {
    if (extract.startsWith("<p>Word not found") || extract.startsWith("<p>No extract found") || extract.startsWith("<p>Error fetching")) {
        return extract; // Return error messages directly
    }

    // Try to find the "Etymology" section for English.
    // Wiktionary structure: ==Language== ... ===Etymology N=== ...
    // We are using explaintext=true, so we get plain text, not HTML.
    
    let etymologyContent = "";
    const languageSectionRegex = /^==\s*English\s*==/im;
    const languageMatch = extract.match(languageSectionRegex);

    if (!languageMatch) {
        return `<p>Could not find the English section for "${word}". The word might exist in other languages.</p>`;
    }

    const englishSectionText = extract.substring(languageMatch.index + languageMatch[0].length);
    
    // Regex to find "Etymology" or "Etymology N" sections and capture content until next "===" or "==" heading or end of section.
    const etymologyRegex = /===\s*Etymology(?:\s*\d+)?\s*===\s*([\s\S]*?)(?=(?:===[^=])|(?:==[^=])|$)/gi;
    let match;
    let etymologyFound = false;

    while ((match = etymologyRegex.exec(englishSectionText)) !== null) {
        etymologyFound = true;
        let content = match[1].trim();
        // Clean up common Wiktionary artifacts like "[edit]" links if any slip through explaintext
        content = content.replace(/\[edit\]/gi, '');
        // Convert newlines to <br> for HTML display, and wrap paragraphs.
        content = content.split('\n').map(p => p.trim()).filter(p => p.length > 0).map(p => `<p>${p}</p>`).join('');
        etymologyContent += `<h4>Etymology ${etymologyFound && etymologyContent ? (etymologyRegex.lastIndex / 1000).toFixed(0) : ''}</h4>${content}`;
    }

    if (!etymologyFound) {
        // Fallback: Try to find a simpler "Etymology" if the primary regex fails or if no "Etymology N" subsections.
        const simpleEtymologyRegex = /^\s*Etymology\s*\n([\s\S]*?)(?=\n\n[A-Z]|$)/im; // Look for "Etymology" followed by content until a new major section
        const simpleMatch = englishSectionText.match(simpleEtymologyRegex);
        if (simpleMatch && simpleMatch[1]) {
            etymologyFound = true;
            let content = simpleMatch[1].trim().replace(/\[edit\]/gi, '');
            content = content.split('\n').map(p => p.trim()).filter(p => p.length > 0).map(p => `<p>${p}</p>`).join('');
            etymologyContent = `<h4>Etymology</h4>${content}`;
        }
    }
    
    if (!etymologyFound) {
        return `<p>No specific etymology section found for "${word}" in the English entry. The entry might be structured differently or lack this information.</p><p><b>Raw Extract (first 500 chars):</b></p><p>${extract.substring(0,500).replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'})[c])}...</p>`;
    }
    
    // Basic styling for list items if any (Wiktionary uses * for lists)
    etymologyContent = etymologyContent.replace(/<p>\*(.*?)<\/p>/g, '<ul><li>$1</li></ul>');
    etymologyContent = etymologyContent.replace(/<\/ul>\s*<ul>/g, ''); // Merge adjacent lists

    return etymologyContent || `<p>Etymology information for "${word}" could not be parsed clearly.</p><p><b>Raw Extract (first 500 chars):</b></p><p>${extract.substring(0,500).replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'})[c])}...</p>`;
}


async function showEtymologyFor(word) {
    if (!etymologyModal || !etymologyWord || !etymologyResultArea) return;

    etymologyWord.textContent = `Etymology for "${word}"`;
    etymologyResultArea.innerHTML = '<p>Loading etymology...</p>';
    etymologyModal.classList.remove('hidden');

    const rawExtract = await fetchEtymologyFromWiktionary(word);
    const parsedContent = parseWiktionaryExtract(rawExtract, word);
    
    etymologyResultArea.innerHTML = parsedContent;
}


// --- TIMER FUNCTIONS ---
function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateTimerDisplay() {
    writingTimerDisplay.textContent = `Time: ${formatTime(timerSecondsElapsed)}`;
    if (timerSecondsElapsed >= timerTargetSeconds) {
        writingTimerDisplay.classList.add('timer-ended');
        // Optionally, play a sound or show a more prominent notification
    } else {
        writingTimerDisplay.classList.remove('timer-ended');
    }
}

function stopTimer(reset = false) {
    clearInterval(timerInterval);
    isTimerRunning = false;
    timerStartBtn.textContent = 'Start Timer';
    timerDurationInput.disabled = false;
    if (reset) {
        timerSecondsElapsed = 0;
        updateTimerDisplay();
    }
}

function startTimer() {
    if (isTimerRunning) {
        stopTimer();
        return;
    }

    const durationMinutes = parseInt(timerDurationInput.value, 10);
    if (isNaN(durationMinutes) || durationMinutes <= 0) {
        alert("Please enter a valid duration for the timer.");
        return;
    }
    timerTargetSeconds = durationMinutes * 60;
    timerSecondsElapsed = 0; // Or resume from where it was if that's desired. User request implies count up to X.
    isTimerRunning = true;
    timerStartBtn.textContent = 'Stop Timer';
    timerDurationInput.disabled = true;
    writingTimerDisplay.classList.remove('timer-ended'); // Ensure it's green at start

    updateTimerDisplay(); // Show 00:00 immediately

    timerInterval = setInterval(() => {
        timerSecondsElapsed++;
        updateTimerDisplay();
        if (timerSecondsElapsed >= timerTargetSeconds) {
            stopTimer(false); // Stop but don't reset, so user sees it ended at red.
            // alert("Time's up!"); // Optional: more prominent notification
        }
    }, 1000);
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
        const newPath = [...currentPath, node];
        let isMatch = false;
        let snippet = '';
        const SNIPPET_RADIUS = 70; // Characters before and after term

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = node.content; // Use original HTML content for snippet context
        const plainTextContent = (tempDiv.textContent || tempDiv.innerText || '').trim();
        const lowerPlainTextContent = plainTextContent.toLowerCase();
        const lowerNodeTitle = node.title.toLowerCase();

        if (isTagSearch) {
            if (node.tags && node.tags.some(tag => tag.toLowerCase().includes(searchTerm))) {
                isMatch = true;
            }
        } else {
            let matchIndex = -1;
            if (lowerNodeTitle.includes(searchTerm)) {
                isMatch = true;
                // Snippet could be title itself, or we can indicate match in title
                snippet = `Matches in title.`;
            }
            // Check content only if not already matched in title or if we want content snippets regardless
            if (!isMatch || (isMatch && snippet === `Matches in title.`)) { // Allow content snippet even if title matches
                 matchIndex = lowerPlainTextContent.indexOf(searchTerm);
                 if (matchIndex !== -1) {
                    isMatch = true;
                    const startIndex = Math.max(0, matchIndex - SNIPPET_RADIUS);
                    const endIndex = Math.min(plainTextContent.length, matchIndex + searchTerm.length + SNIPPET_RADIUS);
                    snippet = (startIndex > 0 ? '...' : '') +
                              plainTextContent.substring(startIndex, endIndex) +
                              (endIndex < plainTextContent.length ? '...' : '');
                 }
            }
        }

        if (isMatch) {
            results.push({ ...node, path: newPath, snippet: snippet });
        }
        results = results.concat(search(query, node.children, newPath));
    }
    return results;
}
function displayResults(results, searchTerm, isTagSearch) { // Added searchTerm and isTagSearch
    searchResults.innerHTML = '';
    results.forEach(result => {
        const resultEl = document.createElement('div');
        resultEl.className = 'search-result-item';
        const pathString = ['The Grounds', ...result.path.map(p => p.title)].join(' / ');
        
        let snippetHTML = '';
        if (result.snippet) {
            let displaySnippet = result.snippet;
            // Only attempt to bold if it's not a tag search and the snippet isn't the generic "Matches in title"
            if (!isTagSearch && searchTerm && result.snippet !== 'Matches in title.') {
                const escapedSearchTerm = escapeRegExp(searchTerm); // Use the same escape function as for certified words
                const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
                // Sanitize displaySnippet before bolding to prevent issues if snippet contains HTML-like chars
                const tempDiv = document.createElement('div');
                tempDiv.textContent = displaySnippet;
                displaySnippet = tempDiv.innerHTML; // Now it's HTML-safe text
                
                displaySnippet = displaySnippet.replace(regex, '<strong>$1</strong>');
            }
            
            const snippetDiv = document.createElement('div');
            snippetDiv.className = 'result-snippet';
            snippetDiv.innerHTML = displaySnippet; // Use .innerHTML because we added <strong>
            snippetHTML = snippetDiv.outerHTML;
        }
        
        resultEl.innerHTML = `<div class="result-text">${result.title}</div><div class="result-path">${pathString}</div>${snippetHTML}`;
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
if(timerStartBtn) { // Ensure button exists before adding listener (robustness)
    timerStartBtn.addEventListener('click', startTimer);
}

canvas.addEventListener('mousedown', (e) => { const clickedNode = getNodeAtPosition(e.offsetX, e.offsetY); if(selectedNode){selectedNode.selected = false;} if (clickedNode) { clickedNode.selected = true; selectedNode = clickedNode; isDragging = true; isPanning = false; const worldX = (e.offsetX - canvas.clientWidth / 2) / scale + canvas.width / 2 + offsetX; const worldY = (e.offsetY - canvas.clientHeight / 2) / scale + canvas.height / 2 + offsetY; dragOffsetX = worldX - clickedNode.x; dragOffsetY = worldY - clickedNode.y; } else { selectedNode = null; isDragging = false; isPanning = true; lastMouseX = e.offsetX; lastMouseY = e.offsetY; } draw(); });
canvas.addEventListener('mouseup', () => { if (isDragging) saveNodes(); isPanning = false; isDragging = false; });
canvas.addEventListener('mousemove', (e) => { if(isDragging && selectedNode) { const worldX = (e.offsetX - canvas.clientWidth / 2) / scale + canvas.width / 2 + offsetX; const worldY = (e.offsetY - canvas.clientHeight / 2) / scale + canvas.height / 2 + offsetY; selectedNode.x = worldX - dragOffsetX; selectedNode.y = worldY - dragOffsetY; draw(); return; } if (!isPanning) return; const dx = e.offsetX - lastMouseX; const dy = e.offsetY - lastMouseY; offsetX -= dx / scale; offsetY -= dy / scale; lastMouseX = e.offsetX; lastMouseY = e.offsetY; draw(); });
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomIntensity = 0.1;
    const scrollDirection = e.deltaY < 0 ? 1 : -1; // 1 for zoom in, -1 for zoom out
    const zoomFactor = Math.exp(scrollDirection * zoomIntensity);
    let newScale = scale * zoomFactor;

    const currentNodes = getCurrentNodes();
    const bbox = calculateNodesBoundingBox(currentNodes); // Ensure this function is defined

    if (bbox && bbox.width > 0 && bbox.height > 0) {
        const viewportArea = canvas.width * canvas.height;
        const nodesArea = bbox.width * bbox.height;

        if (nodesArea > 0) {
            // minNewScale: an area up to 2x the total area of the nodes.
            // (canvas.width / minNewScale) * (canvas.height / minNewScale) = 2 * nodesArea
            // viewportArea / minNewScale^2 = 2 * nodesArea
            // minNewScale^2 = viewportArea / (2 * nodesArea)
            const minAllowedScale = Math.sqrt(viewportArea / (2 * nodesArea));

            // maxNewScale: an area down to 0.5x (half) the total area of the nodes.
            // (canvas.width / maxNewScale) * (canvas.height / maxNewScale) = 0.5 * nodesArea
            // viewportArea / maxNewScale^2 = 0.5 * nodesArea
            // maxNewScale^2 = viewportArea / (0.5 * nodesArea)
            const maxAllowedScale = Math.sqrt(viewportArea / (0.5 * nodesArea));
            
            // Apply clamping
            if (newScale < minAllowedScale && scrollDirection < 0) { // Trying to zoom out further than allowed
                newScale = minAllowedScale;
            } else if (newScale > maxAllowedScale && scrollDirection > 0) { // Trying to zoom in further than allowed
                newScale = maxAllowedScale;
            }
        }
    }
    
    // Ensure scale does not become excessively small or large, or NaN/Infinity
    newScale = Math.max(0.05, Math.min(newScale, 20.0)); 
    if (isNaN(newScale) || !isFinite(newScale)) {
        newScale = scale; // Revert to old scale if calculation is problematic
    }

    if (newScale === scale) return; // No change in scale, no need to recalculate offset or redraw

    const worldX = (e.offsetX - canvas.width / 2) / scale + canvas.width / 2 + offsetX;
    const worldY = (e.offsetY - canvas.height / 2) / scale + canvas.height / 2 + offsetY;
    
    scale = newScale;
    
    offsetX = worldX - (e.offsetX - canvas.width / 2) / scale - canvas.width / 2;
    offsetY = worldY - (e.offsetY - canvas.height / 2) / scale - canvas.height / 2;
    
    draw();
});
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
searchInput.addEventListener('input', () => {
    const query = searchInput.value;
    if (query.length > 1 || (query.startsWith('#') && query.length > 1)) {
        const isTagSearch = query.startsWith('#');
        const searchTerm = (isTagSearch ? query.substring(1) : query).toLowerCase();
        const results = search(query, rootNodes, []); // search function itself uses the query to derive its own searchTerm
        displayResults(results, searchTerm, isTagSearch); // Pass searchTerm and isTagSearch here
    } else {
        searchResults.innerHTML = '';
    }
});
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
  // Load word goal from localStorage
  if (wordGoalInput && localStorage.getItem('wordGoal')) {
    wordGoalInput.value = localStorage.getItem('wordGoal');
  }

  tinymce.init({
    selector: '#main-editor',
    plugins: 'lists link wordcount contextmenu fullscreen', // Added fullscreen
    toolbar: 'undo redo | bold italic underline | bullist numlist | link | toggleToolsPane | fullscreen', // Added fullscreen
    menubar: false,
    contextmenu_never_use_native: true, 
    contextmenu: 'getetymology certifyword | link image table', 
    statusbar: true,
    content_css: false,
    content_style: ` body { font-family: 'Vollkorn', serif; font-size: 18px; line-height: 1.6; background-color: #fdf5e6; padding: 2em; } .certified-word { background-color: #e6ffed; /* Light green highlight */ } `,
    height: "100%", width: "100%",
    setup: function (editor) {
        editor.on('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); closeEditorMode(); } });
        editor.on('input', () => {
            const wordCountPlugin = editor.plugins.wordcount;
            if(selectedNode && wordCountPlugin) {
                const wordCount = wordCountPlugin.body.getWordCount();
                editorWordCount.textContent = `Words: ${wordCount}`;
                if (wordGoalCurrentSpan) wordGoalCurrentSpan.textContent = wordCount; // Update current words for goal
                checkWordGoal(); // Check if goal is met
            }
        });
        
        editor.ui.registry.addButton('toggleToolsPane', {
            text: 'Tools',
            tooltip: 'Toggle Tools Pane',
            onAction: function () {
                console.log("Tools button clicked.");
                console.log("editorMetadata element:", editorMetadata);
                if (editorMetadata) {
                    console.log("Classes before toggle:", editorMetadata.classList.toString());
                    editorMetadata.classList.toggle('hidden');
                    console.log("Classes after toggle:", editorMetadata.classList.toString());
                } else {
                    console.error("editorMetadata element not found!");
                }
            }
        });

        editor.ui.registry.addMenuItem('getetymology', {
            text: 'Get Etymology',
            icon: 'info', // Or some other suitable icon like 'help'
            onAction: async function () {
                const selectedText = editor.selection.getContent({ format: 'text' }).trim();
                if (selectedText && selectedText.split(/\s+/).length === 1) { // Only for single words
                    await showEtymologyFor(selectedText);
                } else {
                    alert('Please select a single word to get its etymology.');
                }
            },
            onSetup: function(api) { // Disable if no text selected or more than one word
                const selectionChangeHandler = () => {
                    const selectedText = editor.selection.getContent({ format: 'text' }).trim();
                    api.setEnabled(!(selectedText === '' || selectedText.split(/\s+/).length !== 1)); // Corrected: setEnabled
                };
                editor.on('SelectionChange NodeChange', selectionChangeHandler);
                return () => editor.off('SelectionChange NodeChange', selectionChangeHandler);
            }
        });

        editor.ui.registry.addMenuItem('certifyword', {
            text: 'Certify Word',
            icon: 'bookmark', // Or 'edit', 'tag'
            onAction: function () {
                const selectedText = editor.selection.getContent({ format: 'text' }).trim();
                // Basic normalization: convert to lowercase for storage/matching, but display original casing.
                // More advanced normalization (e.g., stemming) could be done but adds complexity.
                currentWordToCertify = selectedText.toLowerCase(); 
                
                if (certifyWordModal && certifySelectedWordSpan && certifyDefinitionInput) {
                    certifySelectedWordSpan.textContent = selectedText; // Show original casing in modal
                    
                    // Check if word is already certified and load its definition
                    const existingCertification = selectedNode.certifiedWords.find(cw => cw.text.toLowerCase() === currentWordToCertify);
                    certifyDefinitionInput.value = existingCertification ? existingCertification.definition : '';
                    
                    certifyWordModal.classList.remove('hidden');
                    certifyDefinitionInput.focus();
                }
            },
            onSetup: function(api) {
                const selectionChangeHandler = () => {
                    const selectedText = editor.selection.getContent({ format: 'text' }).trim();
                    api.setEnabled(!(selectedText === '' || selectedText.split(/\s+/).length !== 1 || !selectedNode)); // Corrected: setEnabled
                };
                editor.on('SelectionChange NodeChange', selectionChangeHandler);
                // Also update on selectedNode change, as certifiedWords depends on it.
                // This might need a custom event or check if selectedNode changes elsewhere.
                // For now, NodeChange should cover most editor context changes.
                return () => editor.off('SelectionChange NodeChange', selectionChangeHandler);
            }
        });
        setupCertifiedWordHover(editor); // Initialize hover listeners
    }
  });

  if(closeEtymologyBtn) {
    closeEtymologyBtn.addEventListener('click', () => {
        if(etymologyModal) etymologyModal.classList.add('hidden');
    });
  }
  // Close modal if clicked outside content (optional)
  if(etymologyModal) {
    etymologyModal.addEventListener('click', (event) => {
        if (event.target === etymologyModal) {
            etymologyModal.classList.add('hidden');
        }
    });
  }

  // --- Certify Word Modal Event Listeners ---
  if(closeCertifyWordBtn) {
    closeCertifyWordBtn.addEventListener('click', () => {
        if(certifyWordModal) certifyWordModal.classList.add('hidden');
        currentWordToCertify = null;
    });
  }
  if(cancelCertificationBtn) {
    cancelCertificationBtn.addEventListener('click', () => {
        if(certifyWordModal) certifyWordModal.classList.add('hidden');
        currentWordToCertify = null;
    });
  }
  if(certifyWordModal) {
    certifyWordModal.addEventListener('click', (event) => {
        if (event.target === certifyWordModal) {
            certifyWordModal.classList.add('hidden');
            currentWordToCertify = null;
        }
    });
  }
  if(saveCertificationBtn) {
    saveCertificationBtn.addEventListener('click', () => {
        if (!selectedNode || !currentWordToCertify || !certifyDefinitionInput) return;

        const definition = certifyDefinitionInput.value.trim();
        if (!definition) {
            // Option to remove certification if definition is cleared
            const existingIndex = selectedNode.certifiedWords.findIndex(cw => cw.text.toLowerCase() === currentWordToCertify);
            if (existingIndex > -1) {
                selectedNode.certifiedWords.splice(existingIndex, 1);
                console.log(`Certification removed for: ${currentWordToCertify}`);
            }
        } else {
            const existingCertification = selectedNode.certifiedWords.find(cw => cw.text.toLowerCase() === currentWordToCertify);
            if (existingCertification) {
                existingCertification.definition = definition;
                console.log(`Certification updated for: ${currentWordToCertify}`);
            } else {
                // Use original casing of the word for storage if preferred, but match lowercase
                // For simplicity, storing the lowercase version for matching, but could store original too.
                selectedNode.certifiedWords.push({ text: currentWordToCertify, definition: definition });
                console.log(`Word certified: ${currentWordToCertify}`);
            }
        }
        
        saveNodes();
        applyAndRefreshCertifiedWordHighlights(tinymce.get('main-editor')); // Refresh highlights in editor
        if(certifyWordModal) certifyWordModal.classList.add('hidden');
        currentWordToCertify = null;
    });
  }

  // --- Word Goal Logic ---
  function checkWordGoal() {
    if (!wordGoalInput || !wordGoalCurrentSpan || !editorWordCount) return;
    const currentVal = parseInt(wordGoalCurrentSpan.textContent, 10);
    const targetVal = parseInt(wordGoalInput.value, 10);
    if (!isNaN(currentVal) && !isNaN(targetVal) && targetVal > 0) {
        if (currentVal >= targetVal) {
            wordGoalCurrentSpan.classList.add('goal-met');
            wordGoalInput.classList.add('goal-met'); // Optionally style input too
        } else {
            wordGoalCurrentSpan.classList.remove('goal-met');
            wordGoalInput.classList.remove('goal-met');
        }
    } else { // Clear styles if target is 0 or invalid
        wordGoalCurrentSpan.classList.remove('goal-met');
        wordGoalInput.classList.remove('goal-met');
    }
  }

  if (wordGoalInput) {
    wordGoalInput.addEventListener('input', () => {
        localStorage.setItem('wordGoal', wordGoalInput.value);
        checkWordGoal();
    });
    // Initial check in case values are pre-filled
    checkWordGoal(); 
  }
  
  // Ensure editorMetadata (Tools Pane) is initially hidden by default as per new UX
  if(editorMetadata) {
      editorMetadata.classList.add('hidden');
  }

  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  loadNodes();
  draw();
}
window.addEventListener('DOMContentLoaded', initialize)