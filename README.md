# Morada 📜🖋️
### *The Scholar's Desk for Deep Creative Writing*

[![Release](https://img.shields.io/badge/Release-v1.0.0--beta.1-d4a373.svg)](https://github.com/thecorcoran/Morada/releases)
[![License: ISC](https://img.shields.io/badge/License-ISC-8b5a2b.svg)](https://opensource.org/licenses/ISC)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-4a2810.svg)](https://thecorcoran.github.io/Morada/)
[![Tests](https://img.shields.io/badge/Tests-102%20Passed-27c93f.svg)](https://github.com/thecorcoran/Morada)

**Morada** is a visual, fractal writing environment engineered specifically for long-form literary prose, scene architecture, and stylistic rigor. Inspired by the tactile atmosphere of a scholar's mahogany desk, Morada replaces endless flat document lists with a two-dimensional graph of leather-bound **Portfolios** (containers/chapters) and vellum **Sheets** (scenes/notes).

---

## 🌟 Core Features (v1.0-Beta)

### 1. 🗂️ Fractal Portfolios & Sheets
- **Two-Tier Visual Graph**: Seamlessly nest scenes inside chapters and acts.
- **In-Place Title Renaming**: Double-click or double-tap directly on any card name to edit it instantly on the desk canvas.
- **Double-Tap Dive**: Double-click the body of a portfolio to enter its chamber; double-click a sheet to open the prose editor.
- **Auto-Tidy Desk**: Tidy your canvas automatically with golden-ratio card geometry, clean vertical shelf alignment, and intelligent tag filtering.

### 2. ⚡ 5-Minute Literary Warm-Up
- **Master Stylist Rotation**: Pre-populated copywork passages from G.K. Chesterton, Leo Tolstoy, Fyodor Dostoevsky, Cormac McCarthy, Willa Cather, Herman Melville, and Edith Wharton.
- **Cadence & Ear Tuning**: Copy masterwork sentences for 5 minutes before drafting to tune your inner ear to rhythm, concrete details, and active verbs.

### 3. 📜 The 55 Maxims of the Scenic Method
- Timeless craft maxims synthesized from **Henry James**, **Caroline Gordon**, and **Flannery O'Connor**.
- **Maxim of the Moment**: Shuffle randomized guiding wisdom directly in your writing drawer.
- **Applied Tracking**: Mark maxims as applied in each scene (e.g. *#2 Render, never report*, *#6 Trust the concrete detail*).

### 4. ✒️ Strunk & White Craft Engine
- **Live Stylistic Auditing**: Real-time detection of passive voice constructs and weak adverbs.
- **Readability Index**: Instant Flesch-Kincaid grade level and Reading Ease scoring.
- **Walker Percy Diction & Wiktionary**: Look up precise etymologies and certify literary word definitions without leaving your draft.

### 5. ⛶ Full View Writing & Focus Dimming
- **Zen Expanse**: Switch to true distraction-free full-screen writing with <kbd>F11</kbd> or <kbd>Ctrl+Shift+F</kbd>.
- **Ambient Desk Dimming**: Entering a portfolio gracefully blurs and dims the background desk to keep attention locked on the active chapter.

### 6. 📄 Clean Word (.docx) & Manuscript Press Export
- **Native Word Export**: Export individual sheets directly into standard Microsoft Word documents with 1-inch literary margins and styled serif typography.
- **Manuscript Press**: Assemble and reorder multiple chapters into a unified compendium manuscript.

### 7. 📦 Velvet Archives Vault
- **Non-Destructive Decluttering**: Move completed acts, old outlines, and experimental scenes into a private velvet vault.
- **Instant Restoration**: Browse archives with word count telemetry and restore them to the active desk with a single click.

### 8. 🛡️ 7-Layer Fail-Safe Auto-Save Architecture
- **Zero Data Loss Guarantee**: Continuous debounced editor auto-save, atomic file writes (`.tmp` + rename), automatic `.bak` rotation, and emergency browser local mirrors.

---

## 💻 Download & Installation

Visit the official portal at **[https://thecorcoran.github.io/Morada/](https://thecorcoran.github.io/Morada/)** or download directly from **[GitHub Releases](https://github.com/thecorcoran/Morada/releases/latest)**:

| Operating System | Package | Installation Notes |
| :--- | :--- | :--- |
| **Windows** | `Morada-Setup-1.0.0-beta.1.exe` | Standard setup wizard for Windows 10/11 |
| **macOS** | `Morada-1.0.0-beta.1.dmg` | Drag `Morada` to `Applications` (Apple Silicon & Intel) |
| **Linux (AppImage)** | `Morada-1.0.0-beta.1.AppImage` | `chmod +x Morada-*.AppImage && ./Morada-*.AppImage` |
| **Linux (Debian/Ubuntu)**| `morada_1.0.0-beta.1_amd64.deb` | `sudo dpkg -i morada_*.deb` |

---

## ⌨️ Keyboard Shortcuts Reference

| Shortcut | Action |
| :--- | :--- |
| <kbd>Esc</kbd> | Save & close sheet / Step back to parent portfolio |
| <kbd>Ctrl</kbd> + <kbd>T</kbd> | Auto-Tidy active desk |
| <kbd>F11</kbd> / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd> | Toggle Full View Zen writing mode |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd> | Toggle Craft Drawer (Scenic Maxims & Strunk stats) |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd> | Open Archives Vault |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> | Focus masthead search palette |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd> | Certify selected word (Percy Diction) |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>E</kbd> | Look up Wiktionary etymology |
| <kbd>Ctrl</kbd> + <kbd>M</kbd> | Insert scholarly margin comment |

---

## 🛠️ Development & Testing

### Prerequisites
- Node.js (v18 or v20+)
- npm

### Setup
```bash
git clone https://github.com/thecorcoran/Morada.git
cd Morada
npm install
```

### Launch Development App
```bash
npm start
```

### Run Automated Tests
Morada includes an exhaustive suite of unit and integration tests covering the state manager, auto-save persistence, Strunk engine, Scenic maxims, archives, and canvas interaction:
```bash
npm test
```

### Build Installers Locally
```bash
npm run dist:win      # Windows installer (.exe)
npm run dist:mac      # macOS disk image (.dmg)
npm run dist:linux    # Linux AppImage & Debian package
```

---

## 📜 License & Privacy

- **License**: Open source under the [ISC License](LICENSE).
- **100% Local-First**: No mandatory user accounts, no cloud lock-in, and zero telemetry. All writing remains strictly on your local machine in plain, open JSON.
