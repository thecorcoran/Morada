// js/searchManager.js
// Search palette, in-memory indexing, and navigation results.

if (typeof window === 'undefined') {
    global.window = global;
}

window.SearchManager = {
    /**
     * Build an in-memory search index for nodes to accelerate lookups.
     */
    _buildSearchIndex: function() {
        try {
            this._searchIndex = Object.create(null);
            const walk = (nodes) => {
                (nodes || []).forEach(n => {
                    try {
                        const parts = [];
                        if (n.title) parts.push(n.title);
                        if (Array.isArray(n.tags)) parts.push(n.tags.join(' '));
                        if (n.content) {
                            parts.push(typeof this.getPlainText === 'function' ? this.getPlainText(n.content) : n.content);
                        }
                        this._searchIndex[n.id] = parts.join(' ').toLowerCase();
                        if (n.children && n.children.length) walk(n.children);
                    } catch {}
                });
            };
            if (this.stateManager && typeof this.stateManager.getRootNodes === 'function') {
                walk(this.stateManager.getRootNodes() || []);
            }
        } catch (e) {
            console.warn('buildSearchIndex failed', e);
        }
    },

    openSearch: function() {
        if (!this.searchPalette || !this.searchInput) return;
        this.searchPalette.classList.remove('hidden');
        this.searchInput.focus();
        this.searchInput.value = '';
        this.clearSearchResults();
        if (typeof this._buildSearchIndex === 'function') {
            this._buildSearchIndex();
        }
    },

    closeSearch: function() {
        if (!this.searchPalette) return;
        this.searchPalette.classList.add('hidden');
    },

    clearSearchResults: function() {
        if (this.searchResults) {
            this.searchResults.innerHTML = '';
        }
    },

    search: function(query, nodesToSearch, currentPath) {
        let results = [];
        const isTagSearch = query.startsWith('#');
        const searchTerm = (isTagSearch ? query.substring(1) : query).toLowerCase();
        if (searchTerm.length === 0) return results;

        for (const node of nodesToSearch) {
            const newPath = [...currentPath, node];
            let isMatch = false;
            try {
                if (isTagSearch) {
                    if (node.tags && node.tags.some(tag => tag.toLowerCase().includes(searchTerm))) isMatch = true;
                } else if (this._searchIndex && this._searchIndex[node.id]) {
                    if (this._searchIndex[node.id].includes(searchTerm)) isMatch = true;
                } else {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = node.content;
                    const plainTextContent = tempDiv.textContent || tempDiv.innerText || '';
                    if ((node.title && node.title.toLowerCase().includes(searchTerm)) || plainTextContent.toLowerCase().includes(searchTerm)) isMatch = true;
                }
            } catch {
                try {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = node.content;
                    const plainTextContent = tempDiv.textContent || tempDiv.innerText || '';
                    if ((node.title && node.title.toLowerCase().includes(searchTerm)) || plainTextContent.toLowerCase().includes(searchTerm)) isMatch = true;
                } catch {}
            }
            if (isMatch) results.push({ ...node, path: newPath });
            if (node.children && node.children.length > 0) {
                results = results.concat(this.search(query, node.children, newPath));
            }
        }
        return results;
    },

    displayResults: function(results) {
        if (!this.searchResults || !this.navigateToNodeFunction) return;
        this.searchResults.innerHTML = '';
        results.forEach(result => {
            const resultEl = this._createSearchResultItemElement(result);
            this.searchResults.appendChild(resultEl);
        });
    },

    isSearchOpen: function() {
        return Boolean(this.searchPalette && !this.searchPalette.classList.contains('hidden'));
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.SearchManager;
}
