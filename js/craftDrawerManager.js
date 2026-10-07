// js/craftDrawerManager.js
// Craft Drawer sidebar: Strunk & White live metrics, Scenic Maxims, and 5-minute warm-up copywork.

if (typeof window === 'undefined') {
    global.window = global;
}

window.CraftDrawerManager = {
    /**
     * Initializes DOM events and controls for the Craft Drawer.
     */
    initCraftDrawer: function() {
        if (this._craftDrawerInitialized) return;
        this._craftDrawerInitialized = true;

        const toggleBtn = document.getElementById('toggle-craft-drawer-btn');
        const closeBtn = document.getElementById('close-craft-drawer-btn');
        const passiveToggle = document.getElementById('toggle-passive-voice');
        const adverbsToggle = document.getElementById('toggle-adverbs');
        const craftCertifyBtn = document.getElementById('craft-certify-btn');
        const craftEtymologyBtn = document.getElementById('craft-etymology-btn');
        const craftEtymologyInput = document.getElementById('craft-etymology-input');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleCraftDrawer());
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.toggleCraftDrawer(false));
        }
        if (passiveToggle) {
            passiveToggle.addEventListener('change', () => this.applyStrunkHighlights());
        }
        if (adverbsToggle) {
            adverbsToggle.addEventListener('change', () => this.applyStrunkHighlights());
        }
        if (craftCertifyBtn) {
            craftCertifyBtn.addEventListener('click', () => this.certifySelection());
        }
        if (craftEtymologyBtn) {
            craftEtymologyBtn.addEventListener('click', () => {
                const query = craftEtymologyInput ? craftEtymologyInput.value.trim() : '';
                if (query) {
                    if (this.uiManager && typeof this.uiManager.showEtymologyFor === 'function') {
                        this.uiManager.showEtymologyFor(query);
                    }
                } else {
                    this.lookupEtymologyAtSelection();
                }
            });
        }
        const fullviewBtn = document.getElementById('editor-fullview-btn');
        const exitFullviewBtn = document.getElementById('exit-fullview-btn');
        const scenicShuffleBtn = document.getElementById('scenic-shuffle-btn');
        const scenicInsertBtn = document.getElementById('scenic-insert-btn');
        const scenicSearchInput = document.getElementById('scenic-search-input');
        const scenicCategoryFilter = document.getElementById('scenic-category-filter');

        if (fullviewBtn) {
            fullviewBtn.addEventListener('click', () => this.toggleFullView());
        }
        if (exitFullviewBtn) {
            exitFullviewBtn.addEventListener('click', () => this.toggleFullView(false));
        }
        if (scenicShuffleBtn) {
            scenicShuffleBtn.addEventListener('click', () => this.drawRandomMaxim());
        }
        if (scenicInsertBtn) {
            scenicInsertBtn.addEventListener('click', () => this.insertCurrentMaximIntoSheet());
        }
        if (scenicSearchInput) {
            scenicSearchInput.addEventListener('input', () => this.renderScenicMaximsList());
        }
        if (scenicCategoryFilter) {
            scenicCategoryFilter.addEventListener('change', () => {
                this.drawRandomMaxim();
                this.renderScenicMaximsList();
            });
        }

        // 5-Minute Warm-Up Controls (Craft Drawer)
        const warmupNextBtn = document.getElementById('warmup-next-btn');
        const warmupCopyBtn = document.getElementById('warmup-copy-btn');
        const warmupTimerBtn = document.getElementById('warmup-timer-btn');
        const warmupInsertBtn = document.getElementById('warmup-insert-btn');

        if (warmupNextBtn) {
            warmupNextBtn.addEventListener('click', () => this.drawRandomWarmUpPassage());
        }
        if (warmupCopyBtn) {
            warmupCopyBtn.addEventListener('click', () => this.copyCurrentWarmUpPassage());
        }
        if (warmupTimerBtn) {
            warmupTimerBtn.addEventListener('click', () => this.startWarmUpTimer());
        }
        if (warmupInsertBtn) {
            warmupInsertBtn.addEventListener('click', () => this.insertWarmUpIntoSheet());
        }

        this.initCollapsibleAndReorderableSections();

        if (!this._documentKeyListenersAttached && typeof document !== 'undefined') {
            this._documentKeyListenersAttached = true;
            document.addEventListener('keydown', (e) => {
                if (!this.isEditorOpen()) return;
                if (e.key === 'F11' || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f')) {
                    e.preventDefault();
                    this.toggleFullView();
                } else if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
                    e.preventDefault();
                    const activeModal = document.querySelector('.modal:not(.hidden), #archive-modal:not(.hidden), #compendium-modal:not(.hidden)');
                    if (activeModal) {
                        const closeBtn = activeModal.querySelector('.close-button, .close-btn, .modal-close-btn, .craft-close-btn, #close-comment-modal, #close-certify-word-btn, #close-etymology-btn, #close-compendium-btn, #close-archive-btn');
                        if (closeBtn) {
                            closeBtn.click();
                            return;
                        } else {
                            activeModal.classList.add('hidden');
                            return;
                        }
                    }
                    if (this.isFullView) {
                        this.toggleFullView(false);
                    } else {
                        this.closeEditorMode();
                    }
                }
            });
        }
    },

    /**
     * Toggles the Craft Drawer sidebar open or closed.
     * When open, the top toolbar toggle button disappears. When closed, it reappears.
     * @param {boolean} [forceState]
     */
    toggleCraftDrawer: function(forceState) {
        const sidebar = (this.uiManager && this.uiManager.editorInspectorSidebar)
            ? this.uiManager.editorInspectorSidebar
            : document.getElementById('editor-inspector-sidebar');
        if (!sidebar) return;

        const isCurrentlyHidden = sidebar.classList.contains('hidden');
        const shouldShow = typeof forceState === 'boolean' ? forceState : isCurrentlyHidden;

        if (shouldShow) {
            sidebar.classList.remove('hidden');
            this.initCollapsibleAndReorderableSections();
            const selectedNode = this.stateManager ? this.stateManager.getSelectedNode() : null;
            if (selectedNode) {
                this.renderCraftCertifiedList(selectedNode);
                const currentContent = (this.tinymceEditor && this.tinyMCEAvailable)
                    ? this.tinymceEditor.getContent()
                    : (selectedNode.content || '');
                this.updateStrunkMetrics(currentContent);
            }
        } else {
            sidebar.classList.add('hidden');
        }

        // Hide Craft Drawer button from top toolbar when drawer is open, show when closed
        const toggleBtn = document.getElementById('toggle-craft-drawer-btn');
        if (toggleBtn) {
            if (shouldShow) {
                toggleBtn.classList.add('hidden');
            } else {
                toggleBtn.classList.remove('hidden');
                toggleBtn.textContent = 'Craft Drawer ▾';
            }
        }

        if (this._tinymceCraftDrawerApi && typeof this._tinymceCraftDrawerApi.setActive === 'function') {
            this._tinymceCraftDrawerApi.setActive(shouldShow);
        }
    },

    /**
     * Enhances Craft Drawer sections with collapsibility and drag-and-drop reordering.
     * Persists collapse states and custom section order in localStorage.
     */
    initCollapsibleAndReorderableSections: function() {
        if (typeof document === 'undefined') return;
        const sidebar = (this.uiManager && this.uiManager.editorInspectorSidebar)
            ? this.uiManager.editorInspectorSidebar
            : (typeof document.getElementById === 'function' ? document.getElementById('editor-inspector-sidebar') : null);
        if (!sidebar || typeof sidebar.querySelectorAll !== 'function') return;

        // 1. Restore saved section order
        try {
            const savedOrderRaw = (typeof localStorage !== 'undefined') ? localStorage.getItem('morada_craft_section_order') : null;
            if (savedOrderRaw) {
                const savedOrder = JSON.parse(savedOrderRaw);
                if (Array.isArray(savedOrder) && savedOrder.length > 0 && typeof sidebar.querySelector === 'function') {
                    savedOrder.forEach(secId => {
                        const secEl = sidebar.querySelector(`#${secId}`);
                        if (secEl && typeof sidebar.appendChild === 'function') {
                            sidebar.appendChild(secEl);
                        }
                    });
                }
            }
        } catch (e) {
            console.warn('[craft-drawer] restoring section order failed', e);
        }

        // 2. Load saved collapse states
        let collapsedMap = {};
        try {
            if (typeof localStorage !== 'undefined') {
                const raw = localStorage.getItem('morada_craft_section_collapsed');
                if (raw) collapsedMap = JSON.parse(raw) || {};
            }
        } catch (e) {}

        const sections = sidebar.querySelectorAll('.craft-section');
        if (!sections || !sections.forEach) return;
        sections.forEach(section => {
            const header = section.querySelector('.craft-section-header');
            if (!header) return;

            // Apply saved collapse state
            if (section.id && collapsedMap[section.id] === true) {
                section.classList.add('collapsed');
            }

            if (!header._hasCollapseInit) {
                header._hasCollapseInit = true;

                // Add drag grip and toggle caret to header if not present
                if (!header.querySelector('.craft-drag-handle')) {
                    const grip = document.createElement('span');
                    grip.className = 'craft-drag-handle';
                    grip.innerHTML = '&#8942;&#8942;';
                    grip.title = 'Drag to reorder section';
                    header.insertBefore(grip, header.firstChild);
                }

                if (!header.querySelector('.craft-collapse-toggle')) {
                    const caret = document.createElement('span');
                    caret.className = 'craft-collapse-toggle';
                    caret.textContent = '▾';
                    caret.title = 'Click to collapse/expand section';
                    header.appendChild(caret);
                }

                header.addEventListener('click', (e) => {
                    // Ignore clicks on buttons/inputs/selects inside the header
                    if (e.target.closest('button, input, select, a, .craft-drag-handle')) return;
                    section.classList.toggle('collapsed');

                    // Save state
                    if (section.id && typeof localStorage !== 'undefined') {
                        try {
                            const raw = localStorage.getItem('morada_craft_section_collapsed');
                            const map = raw ? JSON.parse(raw) : {};
                            map[section.id] = section.classList.contains('collapsed');
                            localStorage.setItem('morada_craft_section_collapsed', JSON.stringify(map));
                        } catch (err) {}
                    }
                });
            }
        });

        // 3. Initialize Sortable drag-and-drop
        try {
            const SortableLib = (typeof Sortable !== 'undefined') ? Sortable : (window.Sortable || null);
            if (SortableLib && typeof SortableLib.create === 'function') {
                if (this._sortableInstance && typeof this._sortableInstance.destroy === 'function') {
                    try { this._sortableInstance.destroy(); } catch (e) {}
                }
                this._sortableInstance = SortableLib.create(sidebar, {
                    handle: '.craft-drag-handle',
                    draggable: '.craft-section',
                    animation: 160,
                    ghostClass: 'craft-section-ghost',
                    chosenClass: 'craft-section-chosen',
                    onEnd: () => {
                        try {
                            const secEls = sidebar.querySelectorAll('.craft-section');
                            const order = Array.from(secEls).map(s => s.id).filter(Boolean);
                            if (typeof localStorage !== 'undefined') {
                                localStorage.setItem('morada_craft_section_order', JSON.stringify(order));
                            }
                        } catch (err) {}
                    }
                });
            }
        } catch (err) {
            console.warn('[craft-drawer] Sortable init failed', err);
        }
    },

    /**
     * Computes real-time Flesch-Kincaid readability scoring and passive/adverb counts.
     * @param {string} rawContent
     */
    updateStrunkMetrics: function(rawContent) {
        if (!window.MyProjectStrunkEngine) return;
        const text = rawContent || '';
        const readability = window.MyProjectStrunkEngine.calculateReadability(text);
        const passives = window.MyProjectStrunkEngine.findPassiveVoice(text);
        const adverbs = window.MyProjectStrunkEngine.findAdverbs(text);

        const gradeEl = document.getElementById('flesch-grade');
        const easeEl = document.getElementById('flesch-ease');
        const summaryEl = document.getElementById('readability-summary');
        const passiveCountEl = document.getElementById('passive-voice-count');
        const adverbCountEl = document.getElementById('adverb-count');

        if (gradeEl) gradeEl.textContent = readability.words > 0 ? readability.grade : '--';
        if (easeEl) easeEl.textContent = readability.words > 0 ? readability.ease : '--';
        if (summaryEl) summaryEl.textContent = readability.words > 0 ? readability.label : 'Draft text to analyze';
        if (passiveCountEl) passiveCountEl.textContent = passives.length;
        if (adverbCountEl) adverbCountEl.textContent = adverbs.length;
    },

    /**
     * Schedules a debounced refresh of in-editor Strunk highlights during typing.
     */
    _scheduleStrunkHighlightRefresh: function() {
        const passiveToggle = document.getElementById('toggle-passive-voice');
        const adverbsToggle = document.getElementById('toggle-adverbs');
        const isPassiveActive = passiveToggle && passiveToggle.checked;
        const isAdverbsActive = adverbsToggle && adverbsToggle.checked;

        if (!isPassiveActive && !isAdverbsActive) return;

        if (this._strunkDebounceTimer) {
            clearTimeout(this._strunkDebounceTimer);
        }
        this._strunkDebounceTimer = setTimeout(() => {
            this.applyStrunkHighlights();
        }, 900);
    },

    /**
     * Applies non-destructive Strunk highlight underlines to the editor document.
     */
    applyStrunkHighlights: function() {
        if (!window.MyProjectStrunkEngine) return;
        const passiveToggle = document.getElementById('toggle-passive-voice');
        const adverbsToggle = document.getElementById('toggle-adverbs');
        const passiveOn = passiveToggle ? passiveToggle.checked : false;
        const adverbsOn = adverbsToggle ? adverbsToggle.checked : false;

        if (this.tinyMCEAvailable && this.tinymceEditor) {
            const rawContent = this.tinymceEditor.getContent();
            const clean = window.MyProjectStrunkEngine.cleanStrunkMarkers(rawContent);

            if (!passiveOn && !adverbsOn) {
                if (rawContent !== clean) {
                    let bm = null;
                    try { bm = this.tinymceEditor.selection ? this.tinymceEditor.selection.getBookmark(2, true) : null; } catch {}
                    this.tinymceEditor.setContent(clean);
                    if (bm && this.tinymceEditor.selection) {
                        try { this.tinymceEditor.selection.moveToBookmark(bm); } catch {}
                    }
                }
                return;
            }

            const highlighted = window.MyProjectStrunkEngine.applyHighlights(clean, {
                passive: passiveOn,
                adverbs: adverbsOn
            });

            if (highlighted !== rawContent) {
                let bm = null;
                try { bm = this.tinymceEditor.selection ? this.tinymceEditor.selection.getBookmark(2, true) : null; } catch {}
                this.tinymceEditor.setContent(highlighted);
                if (bm && this.tinymceEditor.selection) {
                    try { this.tinymceEditor.selection.moveToBookmark(bm); } catch {}
                }
            }
        }
    },

    /**
     * Renders the Percy Certified Lexicon list inside the Craft Drawer for the given node.
     * @param {Object} node
     */
    renderCraftCertifiedList: function(node) {
        const container = document.getElementById('craft-certified-list');
        if (!container) return;
        container.innerHTML = '';

        if (!node || !Array.isArray(node.certifiedWords) || node.certifiedWords.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'craft-empty-state';
            if (empty.style) {
                empty.style.color = 'var(--color-text-muted)';
                empty.style.fontStyle = 'italic';
                empty.style.padding = '4px 0';
            }
            empty.textContent = 'No words certified in this Sheet.';
            container.appendChild(empty);
            return;
        }

        node.certifiedWords.forEach(cw => {
            const item = document.createElement('div');
            item.className = 'craft-certified-item';
            const word = cw.word || cw.text || '';
            const def = cw.definition || '';
            item.title = `Click to locate "${word}" in editor, double-click to edit`;
            item.innerHTML = `
                <span class="craft-certified-word">${word}</span>
                <span class="craft-certified-def" title="${def}">${def}</span>
            `;
            item.addEventListener('click', () => {
                if (cw.spanId) {
                    this.focusSpan(cw.spanId);
                }
            });
            item.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                if (this.uiManager && typeof this.uiManager.openCertifyModal === 'function') {
                    this.uiManager.openCertifyModal(cw.spanId, word);
                }
            });
            container.appendChild(item);
        });
    },

    /**
     * Initializes the Scenic Maxims component inside the Craft Drawer.
     */
    initScenicMaxims: function() {
        if (!window.MyProjectScenicMaxims) return;
        if (!this._currentFeaturedMaxim) {
            this.drawRandomMaxim();
        } else {
            this.renderFeaturedMaxim(this._currentFeaturedMaxim);
        }
        this.renderScenicMaximsList();
    },

    /**
     * Draws and renders a new random maxim for inspiration.
     */
    drawRandomMaxim: function() {
        if (!window.MyProjectScenicMaxims) return;
        const categoryFilter = document.getElementById('scenic-category-filter');
        const cat = categoryFilter ? categoryFilter.value : 'all';
        const maxim = window.MyProjectScenicMaxims.getRandomMaxim(cat);
        this._currentFeaturedMaxim = maxim;
        this.renderFeaturedMaxim(maxim);
    },

    /**
     * Displays a featured maxim on the card.
     * @param {Object} maxim
     */
    renderFeaturedMaxim: function(maxim) {
        if (!maxim) return;
        const quoteEl = document.getElementById('scenic-featured-quote');
        const metaEl = document.getElementById('scenic-featured-meta');
        if (quoteEl) quoteEl.textContent = `“${maxim.text}”`;
        if (metaEl) metaEl.textContent = `Maxim #${maxim.id} · ${maxim.categoryLabel}`;
    },

    /**
     * Inserts the current featured maxim into the sheet editor.
     */
    insertCurrentMaximIntoSheet: function() {
        const maxim = this._currentFeaturedMaxim;
        if (!maxim) return;
        const insertHtml = `<blockquote><em>“${maxim.text}”</em> &mdash; <small>Scenic Method Maxim #${maxim.id}</small></blockquote><p></p>`;

        if (this.tinyMCEAvailable && this.tinymceEditor) {
            try {
                this.tinymceEditor.insertContent(insertHtml);
                return;
            } catch (err) {
                console.warn('[editor] insertContent into TinyMCE failed', err);
            }
        }

        try {
            const ta = (this.getTextareaElement && this.getTextareaElement()) || document.getElementById('main-editor') || document.getElementById('main-editor-fallback');
            if (ta) {
                const start = ta.selectionStart || ta.value.length;
                const end = ta.selectionEnd || ta.value.length;
                const textToInsert = `\n> "${maxim.text}" — Scenic Method Maxim #${maxim.id}\n\n`;
                ta.value = ta.value.substring(0, start) + textToInsert + ta.value.substring(end);
            }
        } catch (err) {
            console.error('[editor] fallback insert maxim failed', err);
        }
    },

    _getCheckedMaximsForNode: function(nodeId) {
        if (!nodeId) return new Set();
        try {
            if (typeof localStorage !== 'undefined') {
                const raw = localStorage.getItem(`morada_scenic_checks_${nodeId}`);
                if (raw) {
                    const arr = JSON.parse(raw);
                    if (Array.isArray(arr)) return new Set(arr);
                }
            } else if (this._scenicChecksMemory) {
                const arr = this._scenicChecksMemory[nodeId];
                if (Array.isArray(arr)) return new Set(arr);
            }
        } catch {}
        return new Set();
    },

    _saveCheckedMaximsForNode: function(nodeId, checkedSet) {
        if (!nodeId) return;
        try {
            const arr = Array.from(checkedSet);
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(`morada_scenic_checks_${nodeId}`, JSON.stringify(arr));
            } else {
                if (!this._scenicChecksMemory) this._scenicChecksMemory = {};
                this._scenicChecksMemory[nodeId] = arr;
            }
        } catch {}
    },

    toggleScenicMaximCheck: function(maximId) {
        const selNode = this.stateManager ? this.stateManager.getSelectedNode() : null;
        if (!selNode) return;
        const checkedSet = this._getCheckedMaximsForNode(selNode.id);
        if (checkedSet.has(maximId)) {
            checkedSet.delete(maximId);
        } else {
            checkedSet.add(maximId);
        }
        this._saveCheckedMaximsForNode(selNode.id, checkedSet);
        this.renderScenicMaximsList();
    },

    renderScenicMaximsList: function() {
        const container = document.getElementById('scenic-maxims-list');
        if (!container || !window.MyProjectScenicMaxims) return;
        container.innerHTML = '';

        const categoryFilter = document.getElementById('scenic-category-filter');
        const searchInput = document.getElementById('scenic-search-input');
        const selectedCat = categoryFilter ? categoryFilter.value : 'all';
        const query = searchInput ? searchInput.value.trim() : '';

        let list = (selectedCat && selectedCat !== 'all')
            ? window.MyProjectScenicMaxims.getMaximsByCategory(selectedCat)
            : window.MyProjectScenicMaxims.getAllMaxims();

        if (query) {
            list = window.MyProjectScenicMaxims.searchMaxims(query).filter(m => {
                return selectedCat === 'all' || m.category === selectedCat;
            });
        }

        const selNode = this.stateManager ? this.stateManager.getSelectedNode() : null;
        const checkedSet = this._getCheckedMaximsForNode(selNode ? selNode.id : null);

        if (list.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'craft-empty-state';
            empty.textContent = 'No matching maxims found.';
            container.appendChild(empty);
            return;
        }

        list.forEach(maxim => {
            const isChecked = checkedSet.has(maxim.id);
            const isCurrentlyFeatured = this._currentFeaturedMaxim && this._currentFeaturedMaxim.id === maxim.id;
            const item = document.createElement('div');
            item.className = 'scenic-maxim-item' + (isChecked ? ' applied' : '') + (isCurrentlyFeatured ? ' active-featured' : '');
            item.title = 'Click to feature this maxim at top. Check box to track as applied to scene.';

            const chkWrap = document.createElement('label');
            chkWrap.className = 'scenic-chk-wrap';
            chkWrap.title = isChecked ? 'Marked applied to scene (click to uncheck)' : 'Check off when applied to this scene';

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.className = 'scenic-chk-box';
            chk.checked = isChecked;
            chk.addEventListener('change', (e) => {
                e.stopPropagation();
                this.toggleScenicMaximCheck(maxim.id);
            });

            chkWrap.appendChild(chk);

            const num = document.createElement('span');
            num.className = 'scenic-maxim-num';
            num.textContent = `#${maxim.id}`;

            const textSpan = document.createElement('span');
            textSpan.className = 'scenic-maxim-text';
            textSpan.textContent = maxim.text;

            item.appendChild(chkWrap);
            item.appendChild(num);
            item.appendChild(textSpan);

            item.addEventListener('click', (e) => {
                if (e.target === chk || e.target === chkWrap) return;
                this._currentFeaturedMaxim = maxim;
                this.renderFeaturedMaxim(maxim);
                this.renderScenicMaximsList();
            });

            container.appendChild(item);
        });
    },

    drawRandomWarmUpPassage: function(passageId) {
        if (!window.MyProjectWarmUp) return;
        const currentId = this._currentWarmUpPassage ? this._currentWarmUpPassage.id : null;
        const passage = passageId
            ? window.MyProjectWarmUp.getPassageById(passageId)
            : window.MyProjectWarmUp.getRandomPassage(currentId);
        if (!passage) return;
        this._currentWarmUpPassage = passage;

        const authorWorkEl = document.getElementById('warmup-author-work');
        const quoteEl = document.getElementById('warmup-quote-text');

        if (authorWorkEl) {
            authorWorkEl.textContent = `${passage.author} — ${passage.work}`;
        }
        if (quoteEl) {
            quoteEl.textContent = `"${passage.text}"`;
        }
    },

    copyCurrentWarmUpPassage: function() {
        if (!this._currentWarmUpPassage && window.MyProjectWarmUp) {
            this.drawRandomWarmUpPassage();
        }
        if (!this._currentWarmUpPassage) return;

        const text = `"${this._currentWarmUpPassage.text}"\n— ${this._currentWarmUpPassage.author}, ${this._currentWarmUpPassage.work}`;
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                navigator.clipboard.writeText(text);
            }
        } catch (e) {
            console.warn('[editor] Failed to copy to clipboard:', e);
        }

        const copyBtn = document.getElementById('warmup-copy-btn');
        if (copyBtn) {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✓ Copied!';
            setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
        }
    },

    startWarmUpTimer: function() {
        if (this.uiManager && typeof this.uiManager.startTimer === 'function') {
            this.uiManager.startTimer(5);
        }
        const timerBtn = document.getElementById('warmup-timer-btn');
        if (timerBtn) {
            const originalText = timerBtn.textContent;
            timerBtn.textContent = '⏱ 5m Running…';
            setTimeout(() => { timerBtn.textContent = originalText; }, 3000);
        }
    },

    insertWarmUpIntoSheet: function() {
        if (!this._currentWarmUpPassage && window.MyProjectWarmUp) {
            this.drawRandomWarmUpPassage();
        }
        if (!this._currentWarmUpPassage) return;

        const passage = this._currentWarmUpPassage;
        const text = window.MyProjectWarmUp.generateSheetContent(passage);

        if (this.tinyMCEAvailable && this.tinymceEditor) {
            this.tinymceEditor.insertContent(text);
        } else {
            const ta = document.getElementById('main-editor-fallback') || document.getElementById('main-editor');
            if (ta) {
                const start = ta.selectionStart || ta.value.length;
                const end = ta.selectionEnd || ta.value.length;
                const prefix = (start > 0 && !ta.value.slice(0, start).endsWith('\n\n')) ? '\n\n' : '';
                const toInsert = prefix + text;
                ta.value = ta.value.substring(0, start) + toInsert + ta.value.substring(end);
                ta.dispatchEvent(new Event('input'));
            }
        }

        const insertBtn = document.getElementById('warmup-insert-btn');
        if (insertBtn) {
            const originalText = insertBtn.textContent;
            insertBtn.textContent = '✓ Inserted!';
            setTimeout(() => { insertBtn.textContent = originalText; }, 2000);
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.CraftDrawerManager;
}
