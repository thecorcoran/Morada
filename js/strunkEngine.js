// js/strunkEngine.js
// The Strunk "Vigorous" Editor Engine
// Provides non-destructive grammar auditing (passive voice, -ly adverbs)
// and real-time Flesch-Kincaid readability scoring.
if (typeof window === 'undefined') {
    global.window = global;
}
console.log("strunkEngine.js loaded");

window.MyProjectStrunkEngine = {
    irregularParticiples: new Set([
        'seen', 'written', 'taken', 'chosen', 'known', 'given', 'made', 'found',
        'built', 'held', 'done', 'brought', 'thought', 'born', 'lost', 'struck',
        'hidden', 'frozen', 'broken', 'spoken', 'driven', 'begun', 'drawn',
        'shown', 'thrown', 'slain', 'forgotten', 'eaten', 'shot', 'spent',
        'caught', 'taught', 'led', 'read', 'told', 'paid', 'heard', 'met',
        'cut', 'hit', 'hurt', 'set', 'shut', 'spread', 'split', 'bent', 'bound',
        'sold', 'sent', 'spent', 'slept', 'felt', 'kept', 'left', 'meant'
    ]),

    nonAdverbs: new Set([
        'only', 'early', 'lonely', 'lovely', 'daily', 'weekly', 'monthly', 'yearly',
        'friendly', 'silly', 'ugly', 'holy', 'jelly', 'belly', 'family', 'lily',
        'apply', 'reply', 'supply', 'comply', 'fly', 'rely', 'rally', 'ally',
        'italy', 'bully', 'folly', 'gully', 'chilly', 'deadly', 'lively'
    ]),

    /**
     * Estimates syllable count for an English word using standard linguistic heuristics.
     * @param {string} word
     * @returns {number}
     */
    countSyllables: function(word) {
        if (!word) return 0;
        const clean = word.toLowerCase().replace(/[^a-z]/g, '');
        if (!clean) return 0;
        if (clean.length <= 3) return 1;

        let formatted = clean
            .replace(/(?:[^laeiouy]|ed|es|e)$/, '')
            .replace(/^y/, '');

        const matches = formatted.match(/[aeiouy]{1,2}/g);
        return matches ? Math.max(1, matches.length) : 1;
    },

    /**
     * Calculates Flesch-Kincaid Grade Level and Flesch Reading Ease for given text or HTML.
     * @param {string} rawText
     * @returns {{ words: number, sentences: number, syllables: number, grade: number, ease: number, label: string }}
     */
    calculateReadability: function(rawText) {
        if (!rawText) return { words: 0, sentences: 0, syllables: 0, grade: 0, ease: 100, label: 'N/A' };

        // Strip HTML tags and normalize spacing
        const clean = rawText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!clean) return { words: 0, sentences: 0, syllables: 0, grade: 0, ease: 100, label: 'N/A' };

        const words = clean.match(/\b[a-zA-Z0-9'-]+\b/g) || [];
        if (words.length === 0) return { words: 0, sentences: 0, syllables: 0, grade: 0, ease: 100, label: 'N/A' };

        const sentences = clean.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const sentenceCount = Math.max(1, sentences.length);

        let syllableCount = 0;
        words.forEach(w => {
            syllableCount += this.countSyllables(w);
        });

        const w = words.length;
        const s = sentenceCount;
        const l = syllableCount;

        // Flesch formulas
        let grade = 0.39 * (w / s) + 11.8 * (l / w) - 15.59;
        let ease = 206.835 - 1.015 * (w / s) - 84.6 * (l / w);

        grade = Math.max(0, Math.round(grade * 10) / 10);
        ease = Math.max(0, Math.min(100, Math.round(ease * 10) / 10));

        let label = 'Standard';
        if (ease >= 80) label = 'Easy';
        else if (ease >= 65) label = 'Plain English';
        else if (ease >= 50) label = 'Fairly Difficult';
        else label = 'Academic / Dense';

        return { words: w, sentences: s, syllables: l, grade, ease, label };
    },

    /**
     * Identifies passive voice occurrences in text.
     * Looks for auxiliary verbs (be/get) followed by past participles.
     * @param {string} text
     * @returns {Array<{ phrase: string, aux: string, verb: string, index: number }>}
     */
    findPassiveVoice: function(text) {
        if (!text) return [];
        const clean = text.replace(/<[^>]*>/g, ' ');
        const matches = [];
        const regex = /\b(am|is|are|was|were|be|been|being|get|gets|got|gotten)\s+(?:([a-zA-Z]+ly)\s+)?([a-zA-Z]+)/gi;
        let m;

        while ((m = regex.exec(clean)) !== null) {
            const aux = m[1];
            const verb = m[3].toLowerCase();
            if (verb.endsWith('ed') || this.irregularParticiples.has(verb)) {
                matches.push({
                    phrase: m[0],
                    aux: aux,
                    verb: m[3],
                    index: m.index
                });
            }
        }
        return matches;
    },

    /**
     * Identifies -ly adverbs in text (excluding common non-adverbs).
     * @param {string} text
     * @returns {Array<{ word: string, index: number }>}
     */
    findAdverbs: function(text) {
        if (!text) return [];
        const clean = text.replace(/<[^>]*>/g, ' ');
        const matches = [];
        const regex = /\b([a-zA-Z]+ly)\b/gi;
        let m;

        while ((m = regex.exec(clean)) !== null) {
            const word = m[1].toLowerCase();
            if (!this.nonAdverbs.has(word)) {
                matches.push({
                    word: m[1],
                    index: m.index
                });
            }
        }
        return matches;
    },

    /**
     * Cleans all temporary Strunk highlight spans from HTML string,
     * restoring pristine manuscript content.
     * @param {string} html
     * @returns {string}
     */
    cleanStrunkMarkers: function(html) {
        if (!html) return '';
        return html
            .replace(/<span class="strunk-(?:passive|adverb)"[^>]*>(.*?)<\/span>/gi, '$1')
            .replace(/<span class="strunk-[^"]*"[^>]*>(.*?)<\/span>/gi, '$1');
    },

    /**
     * Non-destructively wraps passive voice constructions and/or -ly adverbs
     * in temporary highlight spans for in-editor inspection.
     * @param {string} html
     * @param {{ passive?: boolean, adverbs?: boolean }} options
     * @returns {string}
     */
    applyHighlights: function(html, options = {}) {
        if (!html) return '';
        let result = this.cleanStrunkMarkers(html);

        if (!options.passive && !options.adverbs) {
            return result;
        }

        // We apply highlights to text nodes without breaking HTML tags
        // Parse into DOM or regex across text segments outside of tags
        if (options.passive) {
            result = result.replace(/(<[^>]*>)|(\b(?:am|is|are|was|were|be|been|being|get|gets|got|gotten)\s+(?:[a-zA-Z]+ly\s+)?[a-zA-Z]+)/gi, (match, tag, phrase) => {
                if (tag) return tag;
                if (!phrase) return match;
                const parts = phrase.trim().split(/\s+/);
                const lastWord = parts[parts.length - 1].toLowerCase();
                if (lastWord.endsWith('ed') || this.irregularParticiples.has(lastWord)) {
                    return `<span class="strunk-passive" title="Passive Voice: consider an active construction">${phrase}</span>`;
                }
                return phrase;
            });
        }

        if (options.adverbs) {
            result = result.replace(/(<[^>]*>)|(\b[a-zA-Z]+ly\b)/gi, (match, tag, word) => {
                if (tag) return tag;
                if (!word) return match;
                if (this.nonAdverbs.has(word.toLowerCase())) return word;
                return `<span class="strunk-adverb" title="-ly Adverb: consider a stronger verb">${word}</span>`;
            });
        }

        return result;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.MyProjectStrunkEngine;
}
