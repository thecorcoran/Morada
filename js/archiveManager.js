// js/archiveManager.js
// Velvet Archives Vault: archiving, restoring, and modal management.

if (typeof window === 'undefined') {
    global.window = global;
}

window.ArchiveManager = {
    /**
     * Archive a node (removes it from the desk canvas into the velvet archives vault).
     * @param {Object} node - The node to archive.
     */
    archiveNode: function(node) {
        if (!node) return;
        if (window.MyProjectNodeManager && typeof window.MyProjectNodeManager.archiveNode === 'function') {
            window.MyProjectNodeManager.archiveNode(node);
        } else {
            node.archived = true;
            node.archivedAt = new Date().toISOString();
            node.selected = false;
        }

        // If currently selected, clear selection
        if (this.stateManager) {
            const sel = this.stateManager.getSelectedNode();
            if (sel && sel.id === node.id) {
                this.stateManager.setSelectedNode(null);
            }
        }

        // If editor mode is currently open for this node, close editor
        try {
            if (window.MyProjectEditorManager && typeof window.MyProjectEditorManager.isEditorOpen === 'function' && window.MyProjectEditorManager.isEditorOpen()) {
                const sel = this.stateManager ? this.stateManager.getSelectedNode() : null;
                if (!sel || sel.id === node.id) {
                    window.MyProjectEditorManager.closeEditorMode();
                }
            }
        } catch {}

        // Persist and redraw
        if (this.saveNodesFunction) this.saveNodesFunction();
        if (this.drawFunction) this.drawFunction();
        if (this.outlinerSidebar && !this.outlinerSidebar.classList.contains('hidden')) {
            this.renderOutliner();
        }
        if (typeof this.fitNodesToView === 'function' && this._autoFit) {
            this.fitNodesToView();
        }
        this.updateArchiveBadge();

        // If archives modal happens to be open, refresh its list
        if (this.isArchiveModalOpen()) {
            this.renderArchiveList();
        }

        // Show undo toast
        const typeLabel = node.type === 'container' ? 'Portfolio' : 'Sheet';
        const undoFn = () => {
            this.unarchiveNode(node, false);
        };
        this._showUndoToast(`Archived ${typeLabel} "${node.title || '(untitled)'}"`, undoFn, 10000);
    },

    /**
     * Unarchive a node, restoring it back to the desk.
     * @param {Object} node - The node to restore.
     * @param {boolean} [showToast=true] - Whether to show a confirmation toast.
     */
    unarchiveNode: function(node, showToast = true) {
        if (!node) return;
        if (window.MyProjectNodeManager && typeof window.MyProjectNodeManager.unarchiveNode === 'function') {
            window.MyProjectNodeManager.unarchiveNode(node);
        } else {
            node.archived = false;
            delete node.archivedAt;
        }

        if (this.saveNodesFunction) this.saveNodesFunction();
        if (this.drawFunction) this.drawFunction();
        if (this.outlinerSidebar && !this.outlinerSidebar.classList.contains('hidden')) {
            this.renderOutliner();
        }
        this.updateArchiveBadge();

        if (this.isArchiveModalOpen()) {
            this.renderArchiveList();
        }

        if (typeof this.ensureNodeVisible === 'function') {
            this.ensureNodeVisible(node);
        } else if (typeof this.fitNodesToView === 'function' && this._autoFit) {
            this.fitNodesToView();
        }

        if (showToast) {
            const typeLabel = node.type === 'container' ? 'Portfolio' : 'Sheet';
            this._showUndoToast(`Restored ${typeLabel} "${node.title || '(untitled)'}" to desk`, () => {
                this.archiveNode(node);
            }, 6000);
        }
    },

    /**
     * Permanently deletes an archived node from the project data.
     * @param {Object} node - The archived node to permanently delete.
     */
    deleteArchivedNodePermanently: function(node) {
        if (!node) return;
        const typeLabel = node.type === 'container' ? 'Portfolio' : 'Sheet';
        const confirmed = (typeof confirm === 'function')
            ? confirm(`Permanently delete ${typeLabel} "${node.title || '(untitled)'}"?\nThis action cannot be undone.`)
            : true;
        if (!confirmed) return;

        const rootNodes = this.stateManager ? this.stateManager.getRootNodes() : [];
        if (window.MyProjectNodeManager && typeof window.MyProjectNodeManager.deleteNodeRecursively === 'function') {
            const newRoots = window.MyProjectNodeManager.deleteNodeRecursively(node.id, rootNodes);
            if (this.stateManager) {
                this.stateManager.setRootNodes(newRoots);
                const current = this.stateManager.getCurrentNodes() || [];
                this.stateManager.setCurrentNodes(window.MyProjectNodeManager.deleteNodeRecursively(node.id, current));
            }
        }

        if (this.saveNodesFunction) this.saveNodesFunction();
        if (this.drawFunction) this.drawFunction();
        this.updateArchiveBadge();
        this.renderArchiveList();
    },

    /**
     * Restores all archived nodes back to the desk.
     */
    restoreAllArchivedNodes: function() {
        const rootNodes = this.stateManager ? this.stateManager.getRootNodes() : [];
        const archivedItems = (window.MyProjectNodeManager && typeof window.MyProjectNodeManager.getAllArchivedNodes === 'function')
            ? window.MyProjectNodeManager.getAllArchivedNodes(rootNodes)
            : [];

        if (archivedItems.length === 0) {
            if (typeof alert === 'function') alert('The Archives Vault is currently empty.');
            return;
        }

        const confirmed = (typeof confirm === 'function')
            ? confirm(`Restore all ${archivedItems.length} archived item(s) back to the desk?`)
            : true;
        if (!confirmed) return;

        archivedItems.forEach(item => {
            if (item && item.node) {
                if (window.MyProjectNodeManager && typeof window.MyProjectNodeManager.unarchiveNode === 'function') {
                    window.MyProjectNodeManager.unarchiveNode(item.node);
                } else {
                    item.node.archived = false;
                    delete item.node.archivedAt;
                }
            }
        });

        if (this.saveNodesFunction) this.saveNodesFunction();
        if (this.drawFunction) this.drawFunction();
        if (this.outlinerSidebar && !this.outlinerSidebar.classList.contains('hidden')) {
            this.renderOutliner();
        }
        if (typeof this.fitNodesToView === 'function') {
            this.fitNodesToView();
        }
        this.updateArchiveBadge();
        this.renderArchiveList();

        this._showUndoToast(`Restored ${archivedItems.length} item(s) to the desk`, () => {}, 5000);
    },

    /**
     * Updates the count badge in the Archives button on the masthead.
     */
    updateArchiveBadge: function() {
        const rootNodes = this.stateManager ? this.stateManager.getRootNodes() : [];
        const archivedItems = (window.MyProjectNodeManager && typeof window.MyProjectNodeManager.getAllArchivedNodes === 'function')
            ? window.MyProjectNodeManager.getAllArchivedNodes(rootNodes)
            : [];
        const count = archivedItems.length;

        if (this.archiveCountBadge) {
            this.archiveCountBadge.textContent = String(count);
        }

        if (this.openArchiveBtn) {
            if (count > 0) {
                this.openArchiveBtn.classList.add('has-archives');
            } else {
                this.openArchiveBtn.classList.remove('has-archives');
            }
        }
    },

    /**
     * Opens the Archives Vault modal.
     */
    openArchiveModal: function() {
        if (!this.archiveModal) return;
        this.archiveModal.classList.remove('hidden');
        this._archiveActiveFilter = 'all';
        if (this.archiveSearchInput) this.archiveSearchInput.value = '';

        try {
            if (typeof document !== 'undefined' && document.querySelectorAll) {
                const tabs = document.querySelectorAll('.archive-tab');
                tabs.forEach(t => {
                    t.classList.toggle('active', (t.dataset.filter || 'all') === 'all');
                });
            }
        } catch {}

        this.renderArchiveList();
        if (this.archiveSearchInput) {
            setTimeout(() => { try { this.archiveSearchInput.focus(); } catch {} }, 50);
        }
    },

    /**
     * Closes the Archives Vault modal.
     */
    closeArchiveModal: function() {
        if (!this.archiveModal) return;
        this.archiveModal.classList.add('hidden');
    },

    /**
     * Checks if the Archives Vault modal is open.
     * @returns {boolean}
     */
    isArchiveModalOpen: function() {
        return Boolean(this.archiveModal && !this.archiveModal.classList.contains('hidden'));
    },

    /**
     * Renders the list of archived items in the modal.
     */
    renderArchiveList: function() {
        if (!this.archiveList) return;
        this.archiveList.innerHTML = '';

        const rootNodes = this.stateManager ? this.stateManager.getRootNodes() : [];
        const allArchived = (window.MyProjectNodeManager && typeof window.MyProjectNodeManager.getAllArchivedNodes === 'function')
            ? window.MyProjectNodeManager.getAllArchivedNodes(rootNodes)
            : [];

        // Count per type for tabs
        const totalCount = allArchived.length;
        const portfolioCount = allArchived.filter(item => item.node && item.node.type === 'container').length;
        const sheetCount = allArchived.filter(item => item.node && item.node.type === 'text').length;

        const countAllEl = (typeof document !== 'undefined') ? document.getElementById('archive-tab-all-count') : null;
        const countPortfoliosEl = (typeof document !== 'undefined') ? document.getElementById('archive-tab-portfolios-count') : null;
        const countSheetsEl = (typeof document !== 'undefined') ? document.getElementById('archive-tab-sheets-count') : null;
        if (countAllEl) countAllEl.textContent = String(totalCount);
        if (countPortfoliosEl) countPortfoliosEl.textContent = String(portfolioCount);
        if (countSheetsEl) countSheetsEl.textContent = String(sheetCount);

        // Filter by active tab
        const activeFilter = this._archiveActiveFilter || 'all';
        let filtered = allArchived;
        if (activeFilter === 'container' || activeFilter === 'text') {
            filtered = filtered.filter(item => item.node && item.node.type === activeFilter);
        }

        // Filter by search query
        const query = (this.archiveSearchInput ? this.archiveSearchInput.value : '').trim().toLowerCase();
        if (query) {
            filtered = filtered.filter(item => {
                const node = item.node;
                if (!node) return false;
                const title = (node.title || '').toLowerCase();
                const content = (node.content || '').toLowerCase();
                const tags = Array.isArray(node.tags) ? node.tags.join(' ').toLowerCase() : '';
                return title.includes(query) || content.includes(query) || tags.includes(query);
            });
        }

        if (filtered.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'archive-empty-state';
            if (totalCount === 0) {
                emptyEl.innerHTML = `
                    <div class="archive-empty-icon">📦</div>
                    <h4>The Archives Vault is empty</h4>
                    <p>Archive any portfolio or sheet from the desk using the right-click menu or the <code>A</code> key to safely remove it from view.</p>
                `;
            } else {
                emptyEl.innerHTML = `
                    <div class="archive-empty-icon">🔍</div>
                    <h4>No matching archived items</h4>
                    <p>No archived cards match "${this._escapeHtml ? this._escapeHtml(query) : query}" in this view.</p>
                `;
            }
            this.archiveList.appendChild(emptyEl);
            return;
        }

        filtered.forEach(item => {
            const node = item.node;
            const parent = item.parent;
            if (!node) return;

            const card = document.createElement('div');
            card.className = `archive-item-card archive-type-${node.type}`;

            const leftCol = document.createElement('div');
            leftCol.className = 'archive-card-main';

            const headerRow = document.createElement('div');
            headerRow.className = 'archive-card-header';

            const iconSpan = document.createElement('span');
            iconSpan.className = 'archive-card-icon';
            iconSpan.textContent = node.type === 'container' ? '📁' : '📄';

            const titleEl = document.createElement('h4');
            titleEl.className = 'archive-card-title';
            titleEl.textContent = node.title || '(Untitled)';

            const badge = document.createElement('span');
            badge.className = `archive-type-badge badge-${node.type}`;
            badge.textContent = node.type === 'container' ? 'Portfolio' : 'Sheet';

            headerRow.appendChild(iconSpan);
            headerRow.appendChild(titleEl);
            headerRow.appendChild(badge);

            const metaRow = document.createElement('div');
            metaRow.className = 'archive-card-meta';

            if (node.type === 'text') {
                const words = this.getWordCount ? this.getWordCount(node.content || '') : 0;
                const wordsSpan = document.createElement('span');
                wordsSpan.className = 'archive-meta-item';
                wordsSpan.textContent = `${words} words`;
                metaRow.appendChild(wordsSpan);
            } else if (node.type === 'container') {
                const childCount = Array.isArray(node.children) ? node.children.length : 0;
                const countSpan = document.createElement('span');
                countSpan.className = 'archive-meta-item';
                countSpan.textContent = `${childCount} item${childCount === 1 ? '' : 's'}`;
                metaRow.appendChild(countSpan);
            }

            if (parent) {
                const parentSpan = document.createElement('span');
                parentSpan.className = 'archive-meta-item archive-parent-location';
                parentSpan.textContent = `inside "${parent.title || 'Portfolio'}"`;
                metaRow.appendChild(parentSpan);
            }

            if (node.archivedAt) {
                try {
                    const d = new Date(node.archivedAt);
                    const dateSpan = document.createElement('span');
                    dateSpan.className = 'archive-meta-item archive-date';
                    dateSpan.textContent = `Archived ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
                    metaRow.appendChild(dateSpan);
                } catch {}
            }

            leftCol.appendChild(headerRow);
            leftCol.appendChild(metaRow);

            if (node.type === 'text' && node.content) {
                const snippet = document.createElement('div');
                snippet.className = 'archive-card-snippet';
                const plainText = (node.content || '').replace(/<[^>]*>/g, '').trim();
                snippet.textContent = plainText.length > 120 ? plainText.substring(0, 120) + '…' : plainText;
                if (plainText) leftCol.appendChild(snippet);
            }

            const actionsCol = document.createElement('div');
            actionsCol.className = 'archive-card-actions';

            const restoreBtn = document.createElement('button');
            restoreBtn.type = 'button';
            restoreBtn.className = 'archive-restore-btn';
            restoreBtn.textContent = '↩ Restore to Desk';
            restoreBtn.title = 'Restore this card back to the desk canvas';
            restoreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.unarchiveNode(node);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'archive-delete-btn';
            deleteBtn.textContent = '🗑️ Delete Forever';
            deleteBtn.title = 'Permanently delete this card';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteArchivedNodePermanently(node);
            });

            actionsCol.appendChild(restoreBtn);
            actionsCol.appendChild(deleteBtn);

            card.appendChild(leftCol);
            card.appendChild(actionsCol);

            this.archiveList.appendChild(card);
        });
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.ArchiveManager;
}
