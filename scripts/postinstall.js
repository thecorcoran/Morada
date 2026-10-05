const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const assetsDir = path.join(rootDir, 'assets');

try {
  fs.mkdirSync(assetsDir, { recursive: true });
} catch (err) {
  // Directory already exists or created
}

const copyDir = (src, dest) => {
  if (fs.existsSync(src)) {
    try {
      fs.cpSync(src, dest, { recursive: true, force: true });
    } catch (err) {
      console.warn(`[postinstall] Warning copying ${src} to ${dest}:`, err.message);
    }
  }
};

copyDir(
  path.join(rootDir, 'node_modules', 'tinymce', 'skins'),
  path.join(assetsDir, 'skins')
);
copyDir(
  path.join(rootDir, 'node_modules', 'tinymce', 'themes'),
  path.join(assetsDir, 'themes')
);

console.log('[postinstall] TinyMCE assets copied successfully.');
