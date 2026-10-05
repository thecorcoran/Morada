#!/usr/bin/env node
/**
 * Verifies a published GitHub Release actually contains every installer the
 * Pages site links to. Run by the release workflow after all builds finish,
 * and usable locally:  node scripts/verify-release.js v1.0.0-beta.2
 *
 * Exits non-zero (failing the workflow) if any download would 404.
 */
const pkg = require('../package.json');

const tag = process.argv[2] || process.env.GITHUB_REF_NAME || `v${pkg.version}`;
const repo = process.env.GITHUB_REPOSITORY || 'thecorcoran/Morada';
const version = tag.replace(/^v/, '');

// Must stay in sync with ASSETS in docs/index.html and artifactName in package.json.
const expected = [
  `Morada-Setup-${version}.exe`,
  `Morada-${version}.dmg`,
  `Morada-${version}.AppImage`,
  `morada_${version}_amd64.deb`,
];

async function main() {
  const headers = { Accept: 'application/vnd.github+json' };
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;

  const res = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, { headers });
  if (!res.ok) throw new Error(`No release found for ${tag} (HTTP ${res.status})`);
  const release = await res.json();

  const problems = [];
  if (release.draft) problems.push('release is still a draft (site links cannot reach it)');
  if (release.prerelease && !tag.includes('-')) {
    problems.push('stable release is unexpectedly marked as prerelease');
  }

  const names = new Set((release.assets || []).map(a => a.name));
  for (const file of expected) {
    if (!names.has(file)) problems.push(`missing asset: ${file}`);
  }

  if (problems.length) {
    console.error(`Release ${tag} is NOT ready:\n  - ${problems.join('\n  - ')}`);
    console.error(`Assets present: ${[...names].join(', ') || '(none)'}`);
    process.exit(1);
  }
  console.log(`Release ${tag} OK: all ${expected.length} site downloads exist.`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
