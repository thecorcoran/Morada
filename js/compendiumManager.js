// js/compendiumManager.js
// Manuscript compilation, compendium panel, and export handling.

if (typeof window === 'undefined') {
    global.window = global;
}

window.CompendiumManager = {
    openCompendium: function() {
        if (!this.compendiumModal) return;
        this.refreshCompendiumView();
        this.compendiumModal.classList.remove('hidden');
        try { this._attachModalBehavior(this.compendiumModal, { close: () => this.closeCompendium() }); } catch (err) { console.warn(err); }
    },

    closeCompendium: function() {
        if (!this.compendiumModal) return;
        this.compendiumModal.classList.add('hidden');
        try { if (this.compendiumModal._detachModalBehavior) this.compendiumModal._detachModalBehavior(); } catch (e) {}
    },

    refreshCompendiumView: function() {
        if (!this.compendiumLibrary || !this.compendiumFilter) return;
        const filterTerm = this.compendiumFilter.value;
        this.compendiumLibrary.innerHTML = '';
        this.buildTree(this.stateManager.getRootNodes(), this.compendiumLibrary, filterTerm);
        this.renderManuscript();
    },

    filterTree: function(nodes, searchTerm, isTagSearch) {
        return nodes.reduce((acc, node) => {
            const children = (node.children && node.children.length > 0) ? this.filterTree(node.children, searchTerm, isTagSearch) : [];
            let isMatch = false;
            if (isTagSearch) {
                if (node.tags && node.tags.some(tag => tag.toLowerCase().includes(searchTerm))) isMatch = true;
            } else {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = node.content;
                const plainTextContent = tempDiv.textContent || tempDiv.innerText || '';
                if (node.title.toLowerCase().includes(searchTerm) || plainTextContent.toLowerCase().includes(searchTerm)) isMatch = true;
            }
            if (isMatch || children.length > 0) {
                acc.push({ ...node, children: children, isExpanded: true });
            }
            return acc;
        }, []);
    },

    buildTree: function(nodes, parentElement, filterTerm = '') {
        const ul = document.createElement('ul');
        let nodesToDisplay = nodes;
        if (filterTerm.trim()) {
            const isTagSearch = filterTerm.startsWith('#');
            const searchTerm = (isTagSearch ? filterTerm.substring(1) : filterTerm).toLowerCase();
            if (searchTerm) nodesToDisplay = this.filterTree(nodes, searchTerm, isTagSearch);
        }

        nodesToDisplay.forEach(node => {
            const li = this._createTreeItemElement(node, filterTerm);
            if (node.type === 'container' && node.children && node.children.length > 0) {
                if (filterTerm ? true : node.isExpanded) {
                    this.buildTree(node.children, li, filterTerm);
                }
            }
            ul.appendChild(li);
        });
        parentElement.appendChild(ul);
    },

    renderManuscript: function() {
        if (!this.compendiumManuscript) return;
        this.compendiumManuscript.innerHTML = '';
        const manuscriptList = window.MyProjectDataStorage.getManuscriptList();
        this.updateManuscriptStats();

        if (manuscriptList.length === 0) {
            if (this.sortableInstance) { this.sortableInstance.destroy(); this.sortableInstance = null; }
            return;
        }
        const ol = document.createElement('ol');
        manuscriptList.forEach(node => {
            const li = this._createManuscriptItemElement(node);
            ol.appendChild(li);
        });
        this.compendiumManuscript.appendChild(ol);

        if (this.sortableInstance) this.sortableInstance.destroy();
        if (typeof Sortable !== 'undefined') {
            this.sortableInstance = Sortable.create(ol, {
                animation: 150,
                onEnd: (evt) => {
                    const currentList = window.MyProjectDataStorage.getManuscriptList();
                    const item = currentList.splice(evt.oldIndex, 1)[0];
                    if (item) currentList.splice(evt.newIndex, 0, item);
                    this.renderManuscript(); // Re-render
                }
            });
        } else {
            console.warn("Sortable.js not found. Manuscript items will not be sortable.");
        }
    },

    /**
     * Export a CSV of all tags found across nodes. Columns: tag, nodeId, nodeTitle
     */
    _processNodeContentForExport: function(node, includeComments, includeCertifiedWords, masterGlossary) {
        if (!node || !node.content) return '';

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = node.content;

        const sectionComments = [];
        const sectionGlossary = new Map();

        // 1. Process inline comments if enabled
        if (includeComments) {
            const commentSpans = Array.from(tempDiv.querySelectorAll('.comment-highlight'));
            commentSpans.forEach((span, idx) => {
                const fnNum = idx + 1;
                const quoteText = (span.textContent || '').trim();
                const matchedComment = Array.isArray(node.comments)
                    ? node.comments.find(c => c.id === span.id || c.spanId === span.id)
                    : null;
                const commentText = matchedComment
                    ? matchedComment.text
                    : (span.getAttribute('data-comment') || '');

                const marker = document.createTextNode(` [^${fnNum}]`);
                if (span.nextSibling) {
                    span.parentNode.insertBefore(marker, span.nextSibling);
                } else {
                    span.parentNode.appendChild(marker);
                }

                sectionComments.push({
                    num: fnNum,
                    quote: quoteText,
                    text: commentText,
                    spanId: span.id
                });
            });

            // Capture any comments on the node that are not highlighted in text
            if (Array.isArray(node.comments)) {
                node.comments.forEach(c => {
                    const alreadyIncluded = sectionComments.some(sc => sc.spanId === c.id || sc.spanId === c.spanId);
                    if (!alreadyIncluded && c.text && c.text.trim()) {
                        const fnNum = sectionComments.length + 1;
                        sectionComments.push({
                            num: fnNum,
                            quote: '',
                            text: c.text.trim(),
                            spanId: c.id || c.spanId
                        });
                    }
                });
            }
        }

        // 2. Process certified words if enabled
        if (includeCertifiedWords) {
            const certSpans = Array.from(tempDiv.querySelectorAll('.certified-word'));
            certSpans.forEach(span => {
                const word = (span.textContent || '').trim();
                if (!word) return;
                const matchedCert = Array.isArray(node.certifiedWords)
                    ? node.certifiedWords.find(cw => cw.spanId === span.id || cw.id === span.id ||
                        (cw.word && cw.word.toLowerCase() === word.toLowerCase()) ||
                        (cw.text && cw.text.toLowerCase() === word.toLowerCase()))
                    : null;
                const definition = matchedCert
                    ? matchedCert.definition
                    : (span.getAttribute('data-definition') || '');

                if (definition) {
                    const key = word.toLowerCase();
                    if (!sectionGlossary.has(key)) {
                        sectionGlossary.set(key, { word: word, definition: definition });
                    }
                    if (masterGlossary && !masterGlossary.has(word)) {
                        masterGlossary.set(word, definition);
                    }
                }
            });

            // Also check any certified words on node not in spans
            if (Array.isArray(node.certifiedWords)) {
                node.certifiedWords.forEach(cw => {
                    const w = cw.word || cw.text;
                    if (w && cw.definition) {
                        const key = w.toLowerCase();
                        if (!sectionGlossary.has(key)) {
                            sectionGlossary.set(key, { word: w, definition: cw.definition });
                        }
                        if (masterGlossary && !masterGlossary.has(w)) {
                            masterGlossary.set(w, cw.definition);
                        }
                    }
                });
            }
        }

        const bodyText = (tempDiv.textContent || tempDiv.innerText || '').trim();
        let sectionOutput = bodyText ? `${bodyText}\n\n` : '';

        if (includeComments && sectionComments.length > 0) {
            sectionOutput += `--- Comments & Notes ---\n`;
            sectionComments.forEach(sc => {
                if (sc.quote) {
                    sectionOutput += `[^${sc.num}] "${sc.quote}": ${sc.text}\n`;
                } else {
                    sectionOutput += `[^${sc.num}] ${sc.text}\n`;
                }
            });
            sectionOutput += `\n`;
        }

        if (includeCertifiedWords && sectionGlossary.size > 0) {
            sectionOutput += `--- Certified Lexicon ---\n`;
            sectionGlossary.forEach(item => {
                sectionOutput += `• ${item.word}: ${item.definition}\n`;
            });
            sectionOutput += `\n`;
        }

        return sectionOutput;
    },

    updateManuscriptStats: function() {
        const list = (window.MyProjectDataStorage && typeof window.MyProjectDataStorage.getManuscriptList === 'function') ? window.MyProjectDataStorage.getManuscriptList() : [];
        let totalWords = 0;
        list.forEach(n => {
            if (n.content) totalWords += this.getWordCount(n.content);
        });
        const readTime = Math.max(1, Math.ceil(totalWords / 225));
        const docCountEl = this.compendiumDocCount || (typeof document !== 'undefined' ? document.getElementById('compendium-doc-count') : null);
        const wordCountEl = this.compendiumWordCount || (typeof document !== 'undefined' ? document.getElementById('compendium-word-count') : null);
        const readTimeEl = this.compendiumReadTime || (typeof document !== 'undefined' ? document.getElementById('compendium-read-time') : null);

        if (docCountEl) docCountEl.textContent = `${list.length} ${list.length === 1 ? 'document' : 'documents'}`;
        if (wordCountEl) wordCountEl.textContent = `${totalWords.toLocaleString()} words`;
        if (readTimeEl) readTimeEl.textContent = `~${readTime} min read`;
    },

    compileManuscript: function(format = 'markdown', options = {}) {
        const currentManuscriptList = (window.MyProjectDataStorage && typeof window.MyProjectDataStorage.getManuscriptList === 'function') ? window.MyProjectDataStorage.getManuscriptList() : [];
        const includeComments = options.includeComments !== undefined ? options.includeComments : (this.includeCommentsCheckbox ? this.includeCommentsCheckbox.checked : (typeof document !== 'undefined' && document.getElementById('include-comments-checkbox')?.checked || false));
        const includeCertifiedWords = options.includeCertifiedWords !== undefined ? options.includeCertifiedWords : (this.includeCertifiedWordsCheckbox ? this.includeCertifiedWordsCheckbox.checked : (typeof document !== 'undefined' && document.getElementById('include-certified-words-checkbox')?.checked || false));
        const includeCover = options.includeCover !== undefined ? options.includeCover : (this.includeCoverCheckbox ? this.includeCoverCheckbox.checked : (typeof document !== 'undefined' && document.getElementById('include-cover-checkbox')?.checked || false));
        const includeToc = options.includeToc !== undefined ? options.includeToc : (this.includeTocCheckbox ? this.includeTocCheckbox.checked : (typeof document !== 'undefined' && document.getElementById('include-toc-checkbox')?.checked || false));
        const title = options.title || 'Manuscript';

        const masterGlossary = new Map();
        let totalWordCount = 0;
        currentManuscriptList.forEach(n => {
            if (n.content) totalWordCount += this.getWordCount(n.content);
        });

        const compileOptions = {
            title,
            includeComments,
            includeCertifiedWords,
            includeCover,
            includeToc,
            totalWordCount,
            masterGlossary
        };

        if (format === 'docx' || format === 'doc') {
            return this._compileToDocx(currentManuscriptList, compileOptions);
        } else if (format === 'html') {
            return this._compileToHtml(currentManuscriptList, compileOptions);
        } else if (format === 'txt' || format === 'text') {
            return this._compileToPlainText(currentManuscriptList, compileOptions);
        } else {
            return this._compileToMarkdown(currentManuscriptList, compileOptions);
        }
    },

    _compileToMarkdown: function(nodes, options) {
        let output = '';
        const title = options.title || 'Manuscript';
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        if (options.includeCover) {
            output += `# ${title}\n\n`;
            output += `*Compiled on ${dateStr} · Word Count: ${options.totalWordCount.toLocaleString()} words*\n\n`;
            output += `---\n\n`;
        }

        if (options.includeToc && nodes.length > 0) {
            output += `## Table of Contents\n\n`;
            nodes.forEach((node, i) => {
                const prefix = node.type === 'container' ? `${i + 1}. ` : `   - `;
                const anchor = (node.title || 'untitled').toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                output += `${prefix}[${node.title || 'Untitled'}](#${anchor})\n`;
            });
            output += `\n---\n\n`;
        }

        nodes.forEach(node => {
            if (node.type === 'container') {
                output += `\n# ${node.title.toUpperCase()}\n\n`;
                if (node.includeNotes && node.content) {
                    output += this._processNodeContentForExport(node, options.includeComments, options.includeCertifiedWords, options.masterGlossary);
                }
            } else if (node.type === 'text') {
                output += `\n## ${node.title}\n\n`;
                if (node.content) {
                    output += this._processNodeContentForExport(node, options.includeComments, options.includeCertifiedWords, options.masterGlossary);
                }
            }
        });

        if (options.includeCertifiedWords && options.masterGlossary.size > 0) {
            output += `\n---\n\n`;
            output += `## Appendix: Certified Lexicon & Glossary\n\n`;
            const sortedWords = Array.from(options.masterGlossary.keys()).sort((a, b) => a.localeCompare(b));
            sortedWords.forEach(w => {
                output += `* **${w}**: ${options.masterGlossary.get(w)}\n`;
            });
            output += `\n`;
        }

        return output;
    },

    _compileToHtml: function(nodes, options) {
        const title = this._escapeHtml(options.title || 'Manuscript');
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        let bodyContent = '';

        if (options.includeCover) {
            bodyContent += `<header class="manuscript-cover">\n`;
            bodyContent += `  <h1>${title}</h1>\n`;
            bodyContent += `  <p class="cover-meta">Compiled on ${dateStr} &middot; ${options.totalWordCount.toLocaleString()} words</p>\n`;
            bodyContent += `</header>\n<hr class="manuscript-divider" />\n`;
        }

        if (options.includeToc && nodes.length > 0) {
            bodyContent += `<nav class="manuscript-toc">\n  <h2>Table of Contents</h2>\n  <ul>\n`;
            nodes.forEach(node => {
                const nodeTitle = this._escapeHtml(node.title || 'Untitled');
                bodyContent += `    <li class="toc-${node.type}"><a href="#node-${node.id}">${nodeTitle}</a></li>\n`;
            });
            bodyContent += `  </ul>\n</nav>\n<hr class="manuscript-divider" />\n`;
        }

        nodes.forEach(node => {
            const nodeTitle = this._escapeHtml(node.title || 'Untitled');
            const cleanContent = node.content || '';
            if (node.type === 'container') {
                bodyContent += `<section class="portfolio-section" id="node-${node.id}">\n`;
                bodyContent += `  <h2>${nodeTitle}</h2>\n`;
                if (node.includeNotes && cleanContent) {
                    bodyContent += `  <div class="portfolio-content">${cleanContent}</div>\n`;
                }
                bodyContent += `</section>\n`;
            } else if (node.type === 'text') {
                bodyContent += `<article class="sheet-article" id="node-${node.id}">\n`;
                bodyContent += `  <h3>${nodeTitle}</h3>\n`;
                if (cleanContent) {
                    bodyContent += `  <div class="sheet-content">${cleanContent}</div>\n`;
                }
                if (options.includeComments && Array.isArray(node.comments) && node.comments.length > 0) {
                    bodyContent += `  <aside class="sheet-footnotes">\n    <h4>Notes</h4>\n    <ol>\n`;
                    node.comments.forEach(c => {
                        bodyContent += `      <li>${this._escapeHtml(c.text)}</li>\n`;
                    });
                    bodyContent += `    </ol>\n  </aside>\n`;
                }
                bodyContent += `</article>\n`;
            }
            if (options.includeCertifiedWords && Array.isArray(node.certifiedWords)) {
                node.certifiedWords.forEach(cw => {
                    if (cw.word && cw.definition) options.masterGlossary.set(cw.word, cw.definition);
                });
            }
        });

        if (options.includeCertifiedWords && options.masterGlossary.size > 0) {
            bodyContent += `<section class="manuscript-glossary">\n  <h2>Appendix: Certified Lexicon</h2>\n  <dl>\n`;
            const sortedWords = Array.from(options.masterGlossary.keys()).sort((a, b) => a.localeCompare(b));
            sortedWords.forEach(w => {
                bodyContent += `    <dt>${this._escapeHtml(w)}</dt>\n    <dd>${this._escapeHtml(options.masterGlossary.get(w))}</dd>\n`;
            });
            bodyContent += `  </dl>\n</section>\n`;
        }

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: 'Vollkorn', Georgia, serif; max-width: 760px; margin: 40px auto; padding: 0 24px; line-height: 1.7; color: #282828; background: #fffcf9; }
    h1, h2, h3 { font-family: 'Vollkorn', Georgia, serif; color: #1d2021; }
    h1 { font-size: 2.2em; margin-bottom: 6px; }
    .cover-meta { color: #7c6f64; font-style: italic; margin-bottom: 24px; }
    .manuscript-divider { border: none; border-top: 1px solid #d5c4a1; margin: 30px 0; }
    .manuscript-toc { background: #f4ece1; padding: 18px 24px; border-radius: 6px; margin: 24px 0; }
    .manuscript-toc ul { list-style: none; padding-left: 0; }
    .manuscript-toc li { margin-bottom: 6px; }
    .manuscript-toc a { color: #076678; text-decoration: none; }
    .manuscript-toc a:hover { text-decoration: underline; }
    .toc-text { padding-left: 20px; }
    .sheet-article { margin: 40px 0; padding-bottom: 20px; border-bottom: 1px solid #f4ece1; }
    .sheet-footnotes { background: #fdf6e2; padding: 12px 18px; border-radius: 4px; font-size: 0.9em; margin-top: 18px; }
    .manuscript-glossary { margin-top: 50px; padding: 24px; background: #f4ece1; border-radius: 6px; }
    .manuscript-glossary dt { font-weight: bold; color: #076678; margin-top: 10px; }
    .manuscript-glossary dd { margin-left: 18px; margin-bottom: 10px; }
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`;
    },

    _compileToDocx: function(nodes, options) {
        const title = options.title || 'Manuscript';
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        let bodyContent = '';

        if (options.includeCover) {
            bodyContent += `
  <div class="cover-page">
    <h1 class="title">${this._escapeHtml(title)}</h1>
    <p class="subtitle">Compiled on ${dateStr} &bull; ${options.totalWordCount.toLocaleString()} Words</p>
    <div class="page-break"></div>
  </div>`;
        }

        if (options.includeToc && nodes.length > 0) {
            bodyContent += `
  <div class="toc-container">
    <h2>Table of Contents</h2>
    <ul class="toc-list">`;
            nodes.forEach((node) => {
                const nodeTitle = this._escapeHtml(node.title || 'Untitled');
                const isContainer = node.type === 'container';
                bodyContent += `
      <li class="${isContainer ? 'toc-portfolio' : 'toc-sheet'}">
        <strong>${nodeTitle}</strong>
      </li>`;
            });
            bodyContent += `
    </ul>
    <div class="page-break"></div>
  </div>`;
        }

        nodes.forEach((node) => {
            const nodeTitle = this._escapeHtml(node.title || 'Untitled');
            const cleanContent = (node.content || '').trim();

            if (node.type === 'container') {
                bodyContent += `
  <div class="chapter-container">
    <h2 class="portfolio-heading">${nodeTitle}</h2>
    ${node.includeNotes && cleanContent ? `<div class="content">${cleanContent}</div>` : ''}
  </div>`;
            } else if (node.type === 'text') {
                bodyContent += `
  <div class="sheet-container">
    <h3 class="sheet-heading">${nodeTitle}</h3>
    ${cleanContent ? `<div class="content">${cleanContent}</div>` : ''}
  `;
                if (options.includeComments && Array.isArray(node.comments) && node.comments.length > 0) {
                    bodyContent += `
    <div class="footnotes">
      <h4>Notes & Annotations</h4>
      <ol>`;
                    node.comments.forEach(c => {
                        bodyContent += `<li>${this._escapeHtml(c.text)}</li>`;
                    });
                    bodyContent += `
      </ol>
    </div>`;
                }
                bodyContent += `</div><div class="page-break"></div>`;
            }

            if (options.includeCertifiedWords && Array.isArray(node.certifiedWords)) {
                node.certifiedWords.forEach(cw => {
                    if (cw.word && cw.definition) options.masterGlossary.set(cw.word, cw.definition);
                });
            }
        });

        if (options.includeCertifiedWords && options.masterGlossary.size > 0) {
            bodyContent += `
  <div class="glossary-container">
    <h2>Appendix: Certified Lexicon</h2>
    <table class="lexicon-table">
      <thead>
        <tr>
          <th style="width: 30%;">Certified Word</th>
          <th>Living Definition</th>
        </tr>
      </thead>
      <tbody>`;
            const sortedWords = Array.from(options.masterGlossary.keys()).sort((a, b) => a.localeCompare(b));
            sortedWords.forEach(w => {
                bodyContent += `
        <tr>
          <td><strong>${this._escapeHtml(w)}</strong></td>
          <td>${this._escapeHtml(options.masterGlossary.get(w))}</td>
        </tr>`;
            });
            bodyContent += `
      </tbody>
    </table>
  </div>`;
        }

        return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${this._escapeHtml(title)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page {
      size: 8.5in 11in;
      margin: 1.0in 1.0in 1.0in 1.0in;
      mso-header-margin: 0.5in;
      mso-footer-margin: 0.5in;
    }
    body {
      font-family: 'Georgia', 'Vollkorn', serif;
      font-size: 12pt;
      line-height: 1.7;
      color: #1a1a1a;
    }
    h1.title {
      font-size: 28pt;
      text-align: center;
      margin-top: 140pt;
      margin-bottom: 20pt;
      color: #111111;
    }
    p.subtitle {
      text-align: center;
      font-size: 13pt;
      font-style: italic;
      color: #555555;
    }
    .page-break {
      page-break-before: always;
      mso-special-character: line-break;
    }
    h2.portfolio-heading {
      font-size: 20pt;
      color: #2c2523;
      border-bottom: 2pt solid #8c6d46;
      padding-bottom: 6pt;
      margin-top: 30pt;
      margin-bottom: 16pt;
    }
    h3.sheet-heading {
      font-size: 16pt;
      color: #333333;
      margin-top: 20pt;
      margin-bottom: 12pt;
    }
    .content p {
      margin-bottom: 12pt;
      text-indent: 0.25in;
    }
    .footnotes {
      margin-top: 24pt;
      padding-top: 10pt;
      border-top: 1pt solid #bbbbbb;
      font-size: 10pt;
      color: #444444;
    }
    .lexicon-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 14pt;
    }
    .lexicon-table th, .lexicon-table td {
      border: 1pt solid #cccccc;
      padding: 8pt 10pt;
      text-align: left;
    }
    .lexicon-table th {
      background-color: #f7f2e7;
      font-weight: bold;
    }
    .toc-list {
      list-style: none;
      padding-left: 0;
    }
    .toc-portfolio {
      font-size: 14pt;
      margin-top: 10pt;
      color: #2c2523;
    }
    .toc-sheet {
      font-size: 12pt;
      margin-left: 20pt;
      margin-top: 4pt;
      color: #444444;
    }
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`;
    },

    _compileToPlainText: function(nodes, options) {
        let output = '';
        const title = options.title || 'Manuscript';
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        if (options.includeCover) {
            output += `${'='.repeat(70)}\n`;
            output += `MANUSCRIPT: ${title.toUpperCase()}\n`;
            output += `Compiled: ${dateStr} · Total Words: ${options.totalWordCount.toLocaleString()}\n`;
            output += `${'='.repeat(70)}\n\n`;
        }

        if (options.includeToc && nodes.length > 0) {
            output += `TABLE OF CONTENTS\n`;
            output += `${'-'.repeat(40)}\n`;
            nodes.forEach((node, i) => {
                const prefix = node.type === 'container' ? `${i + 1}. ` : `   - `;
                output += `${prefix}${node.title || 'Untitled'}\n`;
            });
            output += `\n${'='.repeat(70)}\n\n`;
        }

        nodes.forEach(node => {
            if (node.type === 'container') {
                output += `\n\n## ${node.title.toUpperCase()} ##\n\n`;
                if (node.includeNotes && node.content) {
                    output += this._processNodeContentForExport(node, options.includeComments, options.includeCertifiedWords, options.masterGlossary);
                }
            } else if (node.type === 'text') {
                output += `\n\n### ${node.title} ###\n\n`;
                if (node.content) {
                    output += this._processNodeContentForExport(node, options.includeComments, options.includeCertifiedWords, options.masterGlossary);
                }
            }
        });

        if (options.includeCertifiedWords && options.masterGlossary.size > 0) {
            output += `\n${'='.repeat(70)}\n`;
            output += `MANUSCRIPT GLOSSARY & CERTIFIED LEXICON\n`;
            output += `${'='.repeat(70)}\n\n`;
            const sortedWords = Array.from(options.masterGlossary.keys()).sort((a, b) => a.localeCompare(b));
            sortedWords.forEach(w => {
                output += `• ${w}: ${options.masterGlossary.get(w)}\n`;
            });
            output += `\n`;
        }

        return output;
    },

    compileAndDownload: async function() {
        const formatSelect = this.compendiumFormatSelect || (typeof document !== 'undefined' ? document.getElementById('compendium-format-select') : null);
        const format = formatSelect ? formatSelect.value : 'markdown';

        if (format === 'docx') {
            const currentManuscriptList = (window.MyProjectDataStorage && typeof window.MyProjectDataStorage.getManuscriptList === 'function') ? window.MyProjectDataStorage.getManuscriptList() : [];
            const includeComments = this.includeCommentsCheckbox ? this.includeCommentsCheckbox.checked : (typeof document !== 'undefined' && document.getElementById('include-comments-checkbox')?.checked || false);
            const includeCertifiedWords = this.includeCertifiedWordsCheckbox ? this.includeCertifiedWordsCheckbox.checked : (typeof document !== 'undefined' && document.getElementById('include-certified-words-checkbox')?.checked || false);
            const includeCover = this.includeCoverCheckbox ? this.includeCoverCheckbox.checked : (typeof document !== 'undefined' && document.getElementById('include-cover-checkbox')?.checked || false);
            const includeToc = this.includeTocCheckbox ? this.includeTocCheckbox.checked : (typeof document !== 'undefined' && document.getElementById('include-toc-checkbox')?.checked || false);
            let totalWordCount = 0;
            currentManuscriptList.forEach(n => {
                if (n.content) totalWordCount += (typeof this.getWordCount === 'function' ? this.getWordCount(n.content) : 0);
            });
            const compileOptions = {
                title: 'Manuscript',
                includeComments,
                includeCertifiedWords,
                includeCover,
                includeToc,
                totalWordCount,
                masterGlossary: new Map()
            };

            try {
                let base64 = null;
                if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.exportDocx === 'function') {
                    base64 = await window.electronAPI.exportDocx(currentManuscriptList, compileOptions);
                } else if (typeof window !== 'undefined' && window.DocxExporter && window.DocxExporter.isAvailable()) {
                    base64 = await window.DocxExporter.generateBase64(currentManuscriptList, compileOptions);
                }

                if (base64) {
                    const byteChars = atob(base64);
                    const byteNumbers = new Array(byteChars.length);
                    for (let i = 0; i < byteChars.length; i++) {
                        byteNumbers[i] = byteChars.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'Morada_Export.docx';
                    a.click();
                    URL.revokeObjectURL(url);
                    return;
                }
            } catch (err) {
                console.warn('Real docx export failed, falling back to Word XML:', err);
            }
        }

        const output = this.compileManuscript(format);

        const mimeMap = {
            docx: 'application/msword;charset=utf-8',
            doc: 'application/msword;charset=utf-8',
            markdown: 'text/markdown;charset=utf-8',
            html: 'text/html;charset=utf-8',
            txt: 'text/plain;charset=utf-8'
        };
        const extMap = {
            docx: 'doc',
            doc: 'doc',
            markdown: 'md',
            html: 'html',
            txt: 'txt'
        };

        const mime = mimeMap[format] || 'text/plain;charset=utf-8';
        const ext = extMap[format] || 'txt';

        const blob = new Blob([output], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Morada_Export.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
    },

    copyManuscriptToClipboard: async function() {
        const formatSelect = this.compendiumFormatSelect || (typeof document !== 'undefined' ? document.getElementById('compendium-format-select') : null);
        const format = formatSelect ? formatSelect.value : 'markdown';
        const output = this.compileManuscript(format);
        const copyBtn = this.copyManuscriptBtn || (typeof document !== 'undefined' ? document.getElementById('copy-manuscript-btn') : null);

        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(output);
            }
            if (copyBtn) {
                const origText = copyBtn.textContent;
                copyBtn.textContent = 'Copied to Clipboard!';
                setTimeout(() => { copyBtn.textContent = origText; }, 1800);
            }
        } catch (err) {
            console.warn('Copy manuscript to clipboard failed', err);
            if (typeof alert === 'function') alert('Could not copy to clipboard automatically.');
        }
    },

    isCompendiumOpen: function() {
        return this.compendiumModal && !this.compendiumModal.classList.contains('hidden');
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.CompendiumManager;
}
