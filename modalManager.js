// modalManager.js
// This module is responsible for managing all modal dialogs in the application,
// including Comments, Etymology, and Word Certification.
console.log("modalManager.js loaded");

export const modalManager = {
    // --- DOM ELEMENT GETTERS (to be initialized in init) ---
    etymologyModal: null, etymologyWord: null, etymologyResultArea: null, closeEtymologyBtn: null,
    certifyWordModal: null, certifySelectedWordSpan: null, certifyDefinitionInput: null,
    closeCertifyWordBtn: null, saveCertificationBtn: null, cancelCertificationBtn: null,
    commentModal: null, closeCommentModalBtn: null, commentSelectedTextSpan: null,
    commentTextarea: null, saveCommentBtn: null, deleteCommentBtn: null,

    // --- STATE & DEPENDENCIES (to be initialized) ---
    selectedNodeRef: null,
    rootNodesRef: null,
    saveNodesFunction: null,
    editorManager: null,

    // --- Internal State ---
    currentCommentBeingEdited: null,
    currentWordToCertify: null,

    /**
     * Initializes the ModalManager with necessary DOM elements and dependencies.
     * @param {Object} config - Configuration object.
     * @param {{ node: Object|null }} config.selectedNodeRef - Reference object for the selected node.
     * @param {{ nodes: Array<Object> }} config.rootNodesRef - Reference object for the root nodes array.
     * @param {Function} config.saveNodesFunction - Callback to save all node data.
     * @param {Object} config.editorManager - A direct reference to the MyProjectEditorManager.
     */
    init: function(config) {
        // Assign dependencies
        this.selectedNodeRef = config.selectedNodeRef;
        this.rootNodesRef = config.rootNodesRef;
        this.saveNodesFunction = config.saveNodesFunction;
        this.editorManager = config.editorManager;

        // Get all DOM elements
        this.etymologyModal = document.getElementById('etymology-modal');
        this.etymologyWord = document.getElementById('etymology-word');
        this.etymologyResultArea = document.getElementById('etymology-result-area');
        this.closeEtymologyBtn = document.getElementById('close-etymology-btn');
        this.certifyWordModal = document.getElementById('certify-word-modal');
        this.certifySelectedWordSpan = document.getElementById('certify-selected-word');
        this.certifyDefinitionInput = document.getElementById('certify-definition-input');
        this.closeCertifyWordBtn = document.getElementById('close-certify-word-btn');
        this.saveCertificationBtn = document.getElementById('save-certification-btn');
        this.cancelCertificationBtn = document.getElementById('cancel-certification-btn');
        this.commentModal = document.getElementById('comment-modal');
        this.closeCommentModalBtn = document.getElementById('close-comment-modal');
        this.commentSelectedTextSpan = document.getElementById('comment-selected-text');
        this.commentTextarea = document.getElementById('comment-textarea');
        this.saveCommentBtn = document.getElementById('save-comment-btn');
        this.deleteCommentBtn = document.getElementById('delete-comment-btn');

        // Setup all event listeners for the modals
        this._setupEventListeners();
    },

    _setupEventListeners: function() {
        // Comment Modal Listeners
        if (this.closeCommentModalBtn) this.closeCommentModalBtn.addEventListener('click', () => this.hideCommentModal());
        if (this.saveCommentBtn) this.saveCommentBtn.addEventListener('click', () => this.saveComment());
        if (this.deleteCommentBtn) this.deleteCommentBtn.addEventListener('click', () => this.deleteComment());
        if (this.commentModal) this.commentModal.addEventListener('click', (e) => { if (e.target === this.commentModal) this.hideCommentModal(); });

        // Etymology Modal Listeners
        if (this.closeEtymologyBtn) this.closeEtymologyBtn.addEventListener('click', () => this.etymologyModal.classList.add('hidden'));
        if (this.etymologyModal) this.etymologyModal.addEventListener('click', (e) => { if (e.target === this.etymologyModal) this.etymologyModal.classList.add('hidden'); });

        // Certification Modal Listeners
        const closeCertify = () => {
            if (this.certifyWordModal) this.certifyWordModal.classList.add('hidden');
            this.currentWordToCertify = null;
        };
        if (this.closeCertifyWordBtn) this.closeCertifyWordBtn.addEventListener('click', closeCertify);
        if (this.cancelCertificationBtn) this.cancelCertificationBtn.addEventListener('click', closeCertify);
        if (this.saveCertificationBtn) this.saveCertificationBtn.addEventListener('click', () => this.saveCertification());
        if (this.certifyWordModal) this.certifyWordModal.addEventListener('click', (e) => { if (e.target === this.certifyWordModal) closeCertify(); });
    },

    // --- Comment Modal Methods ---
    showCommentModal: function(commentId, selectedTextContent) {
        const selectedNode = this.selectedNodeRef.node;
        if (!this.commentModal || !selectedNode) return;

        const comment = selectedNode.comments.find(c => c.id === commentId);
        if (!comment) return;

        this.currentCommentBeingEdited = comment;
        this.commentSelectedTextSpan.textContent = selectedTextContent;
        this.commentTextarea.value = comment.text;
        this.deleteCommentBtn.classList.toggle('hidden', !comment.text.trim());
        this.commentModal.classList.remove('hidden');
        this.commentTextarea.focus();
    },

    hideCommentModal: function() {
        if (this.commentModal) this.commentModal.classList.add('hidden');
        this.currentCommentBeingEdited = null;
    },

    async saveComment() {
        if (!this.selectedNodeRef.node || !this.currentCommentBeingEdited) return;
        this.currentCommentBeingEdited.text = this.commentTextarea.value.trim();
        await this.saveNodesFunction(); // This is now an alias for saveData
        this.hideCommentModal();
        // After saving a comment, the highlight is already there. We just need to refresh the UI (footnotes).
        if (this.editorManager) this.editorManager.refreshUI();
    },

    async deleteComment() {
        const selectedNode = this.selectedNodeRef.node;
        if (!selectedNode || !this.currentCommentBeingEdited) return;
        if (!confirm('Are you sure you want to delete this comment?')) return;

        const commentIdToDelete = this.currentCommentBeingEdited.id;
        selectedNode.comments = selectedNode.comments.filter(c => c.id !== commentIdToDelete);

        if (this.editorManager) {
            this.editorManager.removeCommentHighlight(commentIdToDelete);
        }

        await this.saveNodesFunction(); // This is now an alias for saveData
        this.hideCommentModal();
        if (this.editorManager) this.editorManager.refreshUI();
    },

    // --- Certification Modal Methods ---
    showCertifyWordModal: function(wordText) {
        const selectedNode = this.selectedNodeRef.node;
        if (!this.certifyWordModal || !selectedNode) return;

        this.currentWordToCertify = wordText;
        this.certifySelectedWordSpan.textContent = wordText;

        const existingCert = selectedNode.certifiedWords.find(cw => cw.text.toLowerCase() === wordText.toLowerCase());
        this.certifyDefinitionInput.value = existingCert ? existingCert.definition : '';

        this.certifyWordModal.classList.remove('hidden');
        this.certifyDefinitionInput.focus();
    },

    async saveCertification() {
        const selectedNode = this.selectedNodeRef.node;
        if (!selectedNode || !this.currentWordToCertify) return;

        const definition = this.certifyDefinitionInput.value.trim();
        const wordText = this.currentWordToCertify;

        const existingIndex = selectedNode.certifiedWords.findIndex(cw => cw.text.toLowerCase() === wordText.toLowerCase());

        if (!definition) { // If definition is empty, remove certification
            if (existingIndex > -1) {
                selectedNode.certifiedWords.splice(existingIndex, 1);
            }
        } else { // If definition exists, add or update
            if (existingIndex > -1) {
                selectedNode.certifiedWords[existingIndex].definition = definition;
            } else {
                selectedNode.certifiedWords.push({ text: wordText, definition: definition });
            }
        }

        await this.saveNodesFunction(); // This is now an alias for saveData
        if (this.editorManager) {
            this.editorManager.applyAndRefreshCertifiedWordHighlights();
        }

        if (this.certifyWordModal) this.certifyWordModal.classList.add('hidden');
        this.currentWordToCertify = null;
    },

    // --- Etymology Modal Methods ---
    showEtymologyFor: async function(word) {
        if (!this.etymologyModal) return;

        this.etymologyWord.textContent = `Etymology for "${word}"`;
        this.etymologyResultArea.innerHTML = '<p>Loading etymology...</p>';
        this.etymologyModal.classList.remove('hidden');

        const rawExtract = await this._fetchEtymologyFromWiktionary(word);
        const parsedContent = this._parseWiktionaryExtract(rawExtract, word);

        this.etymologyResultArea.innerHTML = parsedContent;
    },

    _fetchEtymologyFromWiktionary: async function(word) {
        // Using a more specific API endpoint and adding 'redirects' to handle page redirects.
        // This can help find entries even if the initial word has a slightly different canonical form.
        const url = `https://en.wiktionary.org/w/api.php?action=query&prop=extracts&exlimit=1&explaintext=true&titles=${encodeURIComponent(word)}&format=json&redirects=true&origin=*`;

        console.log(`Fetching etymology for "${word}" from: ${url}`);

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
            const data = await response.json();
            const pages = data.query.pages;
            const pageId = Object.keys(pages)[0];
            if (pageId === "-1") return "<p>Word not found in Wiktionary.</p>";
            const extract = pages[pageId].extract;
            return extract || "<p>No extract found for this word.</p>";
        } catch (error) {
            // Log the full error for better debugging, including in the Electron console
            console.error("Error fetching etymology:", error);
            return `<p>Error fetching etymology: ${error.message}.</p>`;
        }
    },

    _parseWiktionaryExtract: function(extract, word) {
        if (extract.startsWith("<p>")) return extract; // Return error messages directly

        const languageSectionRegex = /^==\s*English\s*==/im;
        const languageMatch = extract.match(languageSectionRegex);
        if (!languageMatch) return `<p>Could not find the English section for "${word}".</p>`;

        const englishSectionText = extract.substring(languageMatch.index + languageMatch[0].length);
        const etymologyRegex = /===\s*Etymology(?:\s*\d+)?\s*===\s*([\s\S]*?)(?=(?:===[^=])|(?:==[^=])|$)/gi;

        // Find all etymology sections first to determine if numbering is needed.
        const allMatches = [...englishSectionText.matchAll(etymologyRegex)];
        let etymologyContent = "";

        if (allMatches.length === 0) {
            return `<p>No specific etymology section found for "${word}".</p>`;
        }

        allMatches.forEach((match, index) => {
            let content = match[1].trim().replace(/\[edit\]/gi, '');
            content = content.split('\n').map(p => p.trim()).filter(Boolean).map(p => `<p>${p}</p>`).join('');

            const headerText = allMatches.length > 1 ? `Etymology ${index + 1}` : 'Etymology';
            etymologyContent += `<h4>${headerText}</h4>${content}`;
        });

        etymologyContent = etymologyContent.replace(/<p>\*(.*?)<\/p>/g, '<ul><li>$1</li></ul>').replace(/<\/ul>\s*<ul>/g, '');
        return etymologyContent;
    }
};
console.log("modalManager.js loaded.");