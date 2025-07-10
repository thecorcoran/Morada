import { modalManager } from './modalManager.js';

// Mock the global fetch API for etymology tests
global.fetch = jest.fn();
// Mock the global confirm dialog for delete actions
global.confirm = jest.fn();

describe('ModalManager', () => {
  let mockSelectedNodeRef, mockRootNodesRef, mockSaveNodes, mockEditorManager;

  // Setup the mock DOM and dependencies before each test
  beforeEach(() => {
    // Reset all mocks to ensure test isolation
    jest.clearAllMocks();
    fetch.mockClear();
    confirm.mockClear();

    // Create a mock DOM structure based on index.html
    document.body.innerHTML = `
      <div id="comment-modal" class="modal hidden">
        <div class="modal-content">
          <span id="comment-selected-text"></span>
          <textarea id="comment-textarea"></textarea>
          <button id="save-comment-btn"></button>
          <button id="delete-comment-btn" class="delete-button"></button>
          <span class="close-button" id="close-comment-modal"></span>
        </div>
      </div>
      <div id="certify-word-modal" class="modal hidden">
        <div class="modal-content">
            <span id="certify-selected-word"></span>
            <textarea id="certify-definition-input"></textarea>
            <button id="save-certification-btn"></button>
            <button id="cancel-certification-btn"></button>
            <span class="close-button" id="close-certify-word-btn"></span>
        </div>
      </div>
      <div id="etymology-modal" class="modal hidden">
        <div class="modal-content">
            <h3 id="etymology-word"></h3>
            <div id="etymology-result-area"></div>
            <span class="close-button" id="close-etymology-btn"></span>
        </div>
      </div>
    `;

    // Create mock dependencies
    mockSelectedNodeRef = {
      node: {
        id: 'node1',
        comments: [{ id: 'comment1', text: 'Existing comment' }],
        certifiedWords: [{ text: 'story', definition: 'A narrative' }],
      },
    };
    mockRootNodesRef = { nodes: [] };
    mockSaveNodes = jest.fn().mockResolvedValue(undefined);
    mockEditorManager = {
      refreshUI: jest.fn(),
      removeCommentHighlight: jest.fn(),
      applyAndRefreshCertifiedWordHighlights: jest.fn(),
    };

    // Initialize the manager for each test
    modalManager.init({
      selectedNodeRef: mockSelectedNodeRef,
      rootNodesRef: mockRootNodesRef,
      saveNodesFunction: mockSaveNodes,
      editorManager: mockEditorManager,
    });
  });

  describe('Initialization', () => {
    it('should get all DOM elements on init', () => {
      expect(modalManager.commentModal).not.toBeNull();
      expect(modalManager.certifyWordModal).not.toBeNull();
      expect(modalManager.etymologyModal).not.toBeNull();
    });

    it('should assign all dependencies on init', () => {
      expect(modalManager.selectedNodeRef).toBe(mockSelectedNodeRef);
      expect(modalManager.saveNodesFunction).toBe(mockSaveNodes);
      expect(modalManager.editorManager).toBe(mockEditorManager);
    });
  });

  describe('Comment Modal', () => {
    it('should show the comment modal with existing text', () => {
      modalManager.showCommentModal('comment1', 'selected text');
      expect(modalManager.commentModal.classList.contains('hidden')).toBe(false);
      expect(modalManager.commentSelectedTextSpan.textContent).toBe('selected text');
      expect(modalManager.commentTextarea.value).toBe('Existing comment');
      expect(modalManager.currentCommentBeingEdited.id).toBe('comment1');
    });

    it('should save an updated comment', async () => {
      modalManager.showCommentModal('comment1', 'selected text');
      modalManager.commentTextarea.value = 'Updated comment text';
      
      await modalManager.saveComment();

      expect(mockSelectedNodeRef.node.comments[0].text).toBe('Updated comment text');
      expect(mockSaveNodes).toHaveBeenCalled();
      expect(mockEditorManager.refreshUI).toHaveBeenCalled();
      expect(modalManager.commentModal.classList.contains('hidden')).toBe(true);
    });

    it('should delete a comment after confirmation', async () => {
      confirm.mockReturnValue(true); // User clicks "OK"
      modalManager.showCommentModal('comment1', 'selected text');
      
      await modalManager.deleteComment();

      expect(confirm).toHaveBeenCalled();
      expect(mockSelectedNodeRef.node.comments).toHaveLength(0);
      expect(mockSaveNodes).toHaveBeenCalled();
      expect(mockEditorManager.removeCommentHighlight).toHaveBeenCalledWith('comment1');
      expect(modalManager.commentModal.classList.contains('hidden')).toBe(true);
    });

    it('should not delete a comment if confirmation is cancelled', async () => {
        confirm.mockReturnValue(false); // User clicks "Cancel"
        modalManager.showCommentModal('comment1', 'selected text');
        
        await modalManager.deleteComment();
  
        expect(confirm).toHaveBeenCalled();
        expect(mockSelectedNodeRef.node.comments).toHaveLength(1); // Not deleted
        expect(mockSaveNodes).not.toHaveBeenCalled();
      });
  });

  describe('Certification Modal', () => {
    it('should show the modal and populate existing definition', () => {
      modalManager.showCertifyWordModal('story');
      expect(modalManager.certifyWordModal.classList.contains('hidden')).toBe(false);
      expect(modalManager.certifySelectedWordSpan.textContent).toBe('story');
      expect(modalManager.certifyDefinitionInput.value).toBe('A narrative');
    });

    it('should add a new certification', async () => {
      modalManager.showCertifyWordModal('new-word');
      modalManager.certifyDefinitionInput.value = 'A brand new definition';

      await modalManager.saveCertification();

      expect(mockSelectedNodeRef.node.certifiedWords).toHaveLength(2);
      const newWord = mockSelectedNodeRef.node.certifiedWords.find(cw => cw.text === 'new-word');
      expect(newWord.definition).toBe('A brand new definition');
      expect(mockSaveNodes).toHaveBeenCalled();
      expect(mockEditorManager.applyAndRefreshCertifiedWordHighlights).toHaveBeenCalled();
    });

    it('should update an existing certification', async () => {
        modalManager.showCertifyWordModal('story');
        modalManager.certifyDefinitionInput.value = 'An updated narrative';
  
        await modalManager.saveCertification();
  
        expect(mockSelectedNodeRef.node.certifiedWords).toHaveLength(1);
        expect(mockSelectedNodeRef.node.certifiedWords[0].definition).toBe('An updated narrative');
        expect(mockSaveNodes).toHaveBeenCalled();
      });

    it('should remove a certification if definition is cleared', async () => {
        modalManager.showCertifyWordModal('story');
        modalManager.certifyDefinitionInput.value = ''; // Empty definition
  
        await modalManager.saveCertification();
  
        expect(mockSelectedNodeRef.node.certifiedWords).toHaveLength(0);
        expect(mockSaveNodes).toHaveBeenCalled();
      });
  });

  describe('Etymology Modal', () => {
    it('should fetch and display etymology successfully', async () => {
        const mockApiResponse = {
            query: {
              pages: {
                '12345': {
                  extract: '==English==\n\n===Etymology 1===\nFrom Old English.'
                }
              }
            }
          };
        fetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockApiResponse),
        });

        await modalManager.showEtymologyFor('word');

        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('titles=word'));
        expect(modalManager.etymologyModal.classList.contains('hidden')).toBe(false);
        expect(modalManager.etymologyResultArea.innerHTML).toContain('<h4>Etymology 1</h4><p>From Old English.</p>');
    });

    it('should handle word not found from API', async () => {
        const mockApiResponse = {
            query: { pages: { '-1': {} } }
        };
        fetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockApiResponse),
        });

        await modalManager.showEtymologyFor('nonexistent');
        expect(modalManager.etymologyResultArea.innerHTML).toBe('<p>Word not found in Wiktionary.</p>');
    });

    it('should handle a fetch network error', async () => {
        fetch.mockRejectedValue(new Error('Network failed'));

        await modalManager.showEtymologyFor('word');
        expect(modalManager.etymologyResultArea.innerHTML).toBe('<p>Error fetching etymology: Network failed.</p>');
    });
  });
});