if (typeof window === 'undefined') {
  global.window = global;
}

/**
 * The 55 Maxims of the Scenic Method
 * Derived from Henry James, Caroline Gordon, and Flannery O'Connor.
 * Dedicated to the discipline of rendering dramatic scenes with sensory fidelity.
 */
const SCENIC_MAXIMS = [
  { id: 1, text: "Create a Fictional Dream and never wake the reader up.", category: "dream", categoryLabel: "The Fictional Dream" },
  { id: 2, text: "Render, never report.", category: "dream", categoryLabel: "The Fictional Dream" },
  { id: 3, text: "Show, do not tell.", category: "dream", categoryLabel: "The Fictional Dream" },
  { id: 4, text: "Efface the narrator completely.", category: "voice", categoryLabel: "Narrative Voice & Effacement" },
  { id: 5, text: "Appeal to the five senses in every paragraph.", category: "dream", categoryLabel: "The Fictional Dream" },
  { id: 6, text: "Trust the concrete detail; despise the abstract noun.", category: "dream", categoryLabel: "The Fictional Dream" },
  { id: 7, text: "Filter all information through the senses of a single character.", category: "dream", categoryLabel: "The Fictional Dream" },
  { id: 8, text: 'Do not "head hop" from one mind to another.', category: "dream", categoryLabel: "The Fictional Dream" },
  { id: 9, text: "Establish the specific time and place immediately.", category: "conflict", categoryLabel: "Scene & Conflict" },
  { id: 10, text: "Ground the reader in the physical geography of the scene.", category: "dream", categoryLabel: "The Fictional Dream" },
  { id: 11, text: "Make every scene have a conflict.", category: "conflict", categoryLabel: "Scene & Conflict" },
  { id: 12, text: "Make every scene have a resolution that leads to the next conflict.", category: "conflict", categoryLabel: "Scene & Conflict" },
  { id: 13, text: "Connect scenes by strict cause and effect.", category: "conflict", categoryLabel: "Scene & Conflict" },
  { id: 14, text: "Do not summarize years when you can render a moment.", category: "conflict", categoryLabel: "Scene & Conflict" },
  { id: 15, text: "Use dialogue as action, not conversation.", category: "dialogue", categoryLabel: "Dialogue as Action" },
  { id: 16, text: 'Never use dialogue to "dump" information for the reader.', category: "dialogue", categoryLabel: "Dialogue as Action" },
  { id: 17, text: "Anchor dialogue in physical stage business (doing while talking).", category: "dialogue", categoryLabel: "Dialogue as Action" },
  { id: 18, text: 'Avoid "thinking" verbs (he thought, he felt, he remembered).', category: "voice", categoryLabel: "Narrative Voice & Effacement" },
  { id: 19, text: "Instead, show the physical action that proves the thought.", category: "voice", categoryLabel: "Narrative Voice & Effacement" },
  { id: 20, text: "Let the setting reflect the interior state of the character.", category: "dream", categoryLabel: "The Fictional Dream" },
  { id: 21, text: 'Use the "Objective Correlative"—let objects carry the emotion.', category: "dream", categoryLabel: "The Fictional Dream" },
  { id: 22, text: "Cut the first paragraph if it is just throat-clearing.", category: "revision", categoryLabel: "Revision & Discipline" },
  { id: 23, text: "Cut the last paragraph if it explains the moral.", category: "revision", categoryLabel: "Revision & Discipline" },
  { id: 24, text: "Use strong verbs; kill the adverbs.", category: "style", categoryLabel: "Prose Style & Strong Verbs" },
  { id: 25, text: "Avoid the passive voice; make the subject do the action.", category: "style", categoryLabel: "Prose Style & Strong Verbs" },
  { id: 26, text: "Do not lecture the reader.", category: "voice", categoryLabel: "Narrative Voice & Effacement" },
  { id: 27, text: "Do not judge your characters; reveal them.", category: "voice", categoryLabel: "Narrative Voice & Effacement" },
  { id: 28, text: "Make the protagonist want something desperately.", category: "conflict", categoryLabel: "Scene & Conflict" },
  { id: 29, text: "Put obstacles in the protagonist's way immediately.", category: "conflict", categoryLabel: "Scene & Conflict" },
  { id: 30, text: "If a character looks at something, describe the thing, not the looking.", category: "dream", categoryLabel: "The Fictional Dream" },
  { id: 31, text: "Use flashbacks only when triggered by a sensory cue in the present.", category: "dream", categoryLabel: "The Fictional Dream" },
  { id: 32, text: "Return from the flashback immediately to the present action.", category: "dream", categoryLabel: "The Fictional Dream" },
  { id: 33, text: "Keep the timeline tight and visible.", category: "conflict", categoryLabel: "Scene & Conflict" },
  { id: 34, text: 'Remove the "Dear Reader" voice.', category: "voice", categoryLabel: "Narrative Voice & Effacement" },
  { id: 35, text: "Do not use fifty words when five will do.", category: "style", categoryLabel: "Prose Style & Strong Verbs" },
  { id: 36, text: "Hunt down clichés and destroy them without mercy.", category: "style", categoryLabel: "Prose Style & Strong Verbs" },
  { id: 37, text: "Read the masters (Flaubert, James, Ford, Chekhov, Joyce).", category: "revision", categoryLabel: "Revision & Discipline" },
  { id: 38, text: "Read them again.", category: "revision", categoryLabel: "Revision & Discipline" },
  { id: 39, text: "Do not cherish your \"pretty\" sentences; if they stall the action, cut them.", category: "revision", categoryLabel: "Revision & Discipline" },
  { id: 40, text: "Leave no \"orphans\" (unresolved actions or objects) in the scene.", category: "conflict", categoryLabel: "Scene & Conflict" },
  { id: 41, text: "If a gun is on the wall, it must be used; if it is not used, take it down.", category: "conflict", categoryLabel: "Scene & Conflict" },
  { id: 42, text: "Respect the intelligence of the reader to infer the meaning.", category: "voice", categoryLabel: "Narrative Voice & Effacement" },
  { id: 43, text: "Do not over-explain the joke or the tragedy.", category: "voice", categoryLabel: "Narrative Voice & Effacement" },
  { id: 44, text: "Let the grotesque sit next to the beautiful.", category: "style", categoryLabel: "Prose Style & Strong Verbs" },
  { id: 45, text: "Ensure the character changes by the end of the story.", category: "conflict", categoryLabel: "Scene & Conflict" },
  { id: 46, text: "If the character does not change, the situation must change.", category: "conflict", categoryLabel: "Scene & Conflict" },
  { id: 47, text: "Listen to the rhythm of the sentence; read it aloud.", category: "style", categoryLabel: "Prose Style & Strong Verbs" },
  { id: 48, text: "Punctuate for breath and pacing, not just for grammar.", category: "style", categoryLabel: "Prose Style & Strong Verbs" },
  { id: 49, text: "Accept criticism without defending yourself.", category: "revision", categoryLabel: "Revision & Discipline" },
  { id: 50, text: "Rewrite until the seams of your labor disappear.", category: "revision", categoryLabel: "Revision & Discipline" },
  { id: 51, text: "Be specific: not \"a bird,\" but \"a nuthatch\"; not \"a tree,\" but \"a sycamore.\"", category: "dream", categoryLabel: "The Fictional Dream" },
  { id: 52, text: "Let the physical world be the limit of your description.", category: "dream", categoryLabel: "The Fictional Dream" },
  { id: 53, text: "Do not intrude to tell us what is \"true.\"", category: "voice", categoryLabel: "Narrative Voice & Effacement" },
  { id: 54, text: "Finish what you start.", category: "revision", categoryLabel: "Revision & Discipline" },
  { id: 55, text: "Serve the vision of the story, not your own ego.", category: "revision", categoryLabel: "Revision & Discipline" }
];

const CATEGORIES = [
  { id: "all", label: "All 55 Maxims" },
  { id: "dream", label: "The Fictional Dream & Sensory Grounding" },
  { id: "conflict", label: "Scene, Conflict & Cause-and-Effect" },
  { id: "dialogue", label: "Dialogue as Action & Stage Business" },
  { id: "voice", label: "Narrative Voice & Effacement" },
  { id: "style", label: "Prose Style & Strong Verbs" },
  { id: "revision", label: "Revision, Discipline & Craft" }
];

window.MyProjectScenicMaxims = {
  maxims: SCENIC_MAXIMS,
  categories: CATEGORIES,

  /**
   * Returns all 55 maxims.
   * @returns {Array<Object>}
   */
  getAllMaxims: function() {
    return this.maxims;
  },

  /**
   * Returns a maxim by its 1-indexed ID (1-55).
   * @param {number} id
   * @returns {Object|null}
   */
  getMaximById: function(id) {
    const num = Number(id);
    return this.maxims.find(m => m.id === num) || null;
  },

  /**
   * Returns all maxims belonging to a specific category.
   * If category is 'all' or empty, returns all maxims.
   * @param {string} category
   * @returns {Array<Object>}
   */
  getMaximsByCategory: function(category) {
    if (!category || category === 'all') {
      return this.maxims;
    }
    return this.maxims.filter(m => m.category === category);
  },

  /**
   * Returns a random maxim from the collection.
   * @param {string} [category] - Optional category filter.
   * @returns {Object}
   */
  getRandomMaxim: function(category) {
    const list = this.getMaximsByCategory(category);
    if (!list.length) return this.maxims[0];
    const randomIndex = Math.floor(Math.random() * list.length);
    return list[randomIndex];
  },

  /**
   * Searches maxims by free text across text and category labels.
   * @param {string} query
   * @returns {Array<Object>}
   */
  searchMaxims: function(query) {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return this.maxims;
    }
    const q = query.trim().toLowerCase();
    return this.maxims.filter(m => {
      return m.text.toLowerCase().includes(q) ||
             m.categoryLabel.toLowerCase().includes(q) ||
             m.category.toLowerCase().includes(q) ||
             String(m.id).includes(q);
    });
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.MyProjectScenicMaxims;
}
