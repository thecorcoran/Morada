# Morada

A desktop writing app organized as an open canvas rather than a traditional file tree.

Morada is built for drafting long-form prose—novels, essays, and stories. Instead of managing documents in a nested sidebar list, work is arranged on a two-dimensional board using two basic building blocks:

- **Portfolios**: Folders for acts, chapters, or reference material. Double-click to open.
- **Sheets**: Cards where you write individual scenes or notes.

Files are saved locally as plain JSON. There are no user accounts, cloud sync dependencies, or analytics.

---

## Overview

### The desk
- Arrange chapters and scenes visually across the board.
- Nest scenes inside chapter portfolios, or keep research notes floating nearby.
- A tidy tool cleans up card spacing when the workspace gets crowded.
- An archive drawer lets you move draft fragments or cut scenes out of view without deleting them.

### The editor
- Plain-text writing area focused on typing speed and clear serif typography.
- Full-screen mode (<kbd>F11</kbd> or <kbd>Ctrl+Shift+F</kbd>) to hide toolbars while drafting.
- Right-click context menu to add footnotes, check word definitions on Wiktionary, or format text.
- Export individual sheets or compiled manuscripts directly to Microsoft Word (`.docx`).

### The craft drawer
A collapsible side panel with reference tools for drafting and revision:
- **Scenic Maxims**: 55 short craft reminders on pacing, scene construction, and concrete detail drawn from Henry James, Caroline Gordon, and Flannery O'Connor.
- **Warm-Up Passages**: Brief excerpts from writers such as G.K. Chesterton, Willa Cather, and Herman Melville for a quick five-minute typing exercise before drafting.
- **Draft Metrics**: Word counts, reading-grade estimates, and highlights for potential passive constructions and adverbs.
- **Diction Notes**: Save definitions and word notes alongside your project.

### Local saving
- Saves automatically to your local disk as you type.
- Backup files (`.bak`) are created alongside the main project file to protect against sudden power loss or crashes.

---

## Downloads

Binaries are available on the [releases page](https://github.com/thecorcoran/Morada/releases):

- **Windows**: `Morada-Setup-<version>.exe`
- **macOS**: `Morada-<version>.dmg` (Universal for Intel & Apple Silicon)
- **Linux**: `Morada-<version>.AppImage` or `morada_<version>_amd64.deb`

---

## Keyboard shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Esc</kbd> | Close sheet / step back to parent portfolio |
| <kbd>Ctrl</kbd> + <kbd>T</kbd> | Tidy cards on the desk |
| <kbd>F11</kbd> / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd> | Toggle full-screen mode |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd> | Toggle Craft Drawer |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd> | Open Archive |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> | Focus card search |
| <kbd>Ctrl</kbd> + <kbd>M</kbd> | Add footnote |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>E</kbd> | Look up Wiktionary etymology |

---

## Building from source

Requirements: Node.js (v18 or v20+) and npm.

```bash
git clone https://github.com/thecorcoran/Morada.git
cd Morada
npm install
npm start
```

Run test suite:
```bash
npm test
```

Package installers:
```bash
npm run dist:win      # Windows installer (.exe)
npm run dist:mac      # macOS disk image (.dmg)
npm run dist:linux    # Linux AppImage & Debian package
```

---

## License

Open source under the [ISC License](LICENSE).
