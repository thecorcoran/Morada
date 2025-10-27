# Morada

Morada is a visual, node-based organizational tool designed for personal knowledge management and creative writing. It allows users to create a hierarchy of "Chambers" (container nodes) and "Scriptoriums" (text nodes) to structure their thoughts and ideas.

## Architecture

The application is built with web technologies (HTML, CSS, JavaScript) and is packaged as a desktop application using Electron.

The core components of the application are:

*   **`canvasRenderer.js`**: The rendering engine that draws the node-based interface on an HTML5 canvas.
*   **`nodeManager.js`**: Manages the lifecycle of nodes, including creation, deletion, and title editing.
*   **`uiManager.js`**: Controls the main user interface elements outside of the canvas, such as navigation, search, and the manuscript compilation view.
*   **`editorManager.js`**: Manages the TinyMCE rich text editor for editing the content of "Scriptorium" nodes.
*   **`dataStorage.js`**: Handles data persistence, saving the node tree to a local JSON file.
*   **`constants.js`**: A centralized store for application-wide constants.

## Features

*   **Node-based interface**: Visually organize information in a graph-like structure.
*   **Rich text editing**: Write and format text within "Scriptorium" nodes using a TinyMCE editor.
*   **Hierarchical organization**: Create nested structures of "Chambers" and "Scriptoriums".
*   **Search**: Full-text and tag-based search to find nodes quickly.
*   **Manuscript compilation**: Select and order nodes to compile them into a single text document.
*   **Local data storage**: All data is stored locally on your machine.

## Running the Application

To run the application, you will need to have [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed.

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/thecorcoran/Morada.git
    cd Morada
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```
    This will also run the `postinstall` script which copies some assets for the TinyMCE editor.

3.  **Start the application**:
    ```bash
    npm start
    ```

## Building the Application

To build the application for your platform, you can use [Electron Builder](https://www.electron.build/).

```bash
npm run dist
```

This will build the application for your current platform. You can find the executable in the `dist` directory.

## Testing the Application

The project uses [Jest](https://jestjs.io/) for testing. To run the tests, use the following command:

```bash
npm test
```