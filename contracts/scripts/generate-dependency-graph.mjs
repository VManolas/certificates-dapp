// contracts/scripts/generate-dependency-graph.mjs
//
// Walks the Solidity import graph starting from contracts/contracts/**/*.sol,
// following imports into node_modules (e.g. @openzeppelin), and renders it
// as an SVG so it's clear which files Hardhat actually compiles and why.
// Run automatically as part of `npm run compile` (see package.json).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { instance } from '@viz-js/viz';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACTS_DIR = path.join(ROOT, 'contracts');
const OUT_DIR = path.join(ROOT, 'reports');

const IMPORT_RE = /^\s*import\s+(?:[^"';]+from\s+)?["']([^"']+)["']/gm;

function resolveImport(fromFile, importPath) {
  const base = importPath.startsWith('.')
    ? path.join(path.dirname(fromFile), importPath)
    : path.join(ROOT, 'node_modules', importPath);
  return path.normalize(base);
}

function isProjectFile(absPath) {
  return absPath.startsWith(CONTRACTS_DIR + path.sep);
}

function label(absPath) {
  const rel = path.relative(ROOT, absPath);
  return rel.startsWith('node_modules' + path.sep) ? rel.slice('node_modules/'.length) : rel;
}

function listSolFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSolFiles(full));
    else if (entry.name.endsWith('.sol')) out.push(full);
  }
  return out;
}

const visited = new Set();
const edges = [];
const queue = listSolFiles(CONTRACTS_DIR);

while (queue.length) {
  const file = queue.pop();
  if (visited.has(file) || !fs.existsSync(file)) continue;
  visited.add(file);

  const src = fs.readFileSync(file, 'utf8');
  for (const match of src.matchAll(IMPORT_RE)) {
    const target = resolveImport(file, match[1]);
    edges.push([file, target]);
    queue.push(target);
  }
}

const projectFiles = [...visited].filter(isProjectFile).sort();
const externalFiles = [...visited].filter((f) => !isProjectFile(f)).sort();

console.log(`Project .sol files:    ${projectFiles.length}`);
console.log(`External .sol files:   ${externalFiles.length} (pulled in via node_modules imports)`);
console.log(`Total files in graph:  ${visited.size}`);
console.log(`Import edges:          ${edges.length}`);

function dotId(p) {
  return JSON.stringify(label(p));
}

const dotLines = [
  'digraph SolidityDependencies {',
  '  rankdir="LR";',
  '  node [shape=box, fontsize=10, fontname="Courier", margin="0.15,0.09"];',
  ...projectFiles.map((f) => `  ${dotId(f)} [style=filled, fillcolor="#cfe8ff"];`),
  ...externalFiles.map((f) => `  ${dotId(f)} [style=filled, fillcolor="#eeeeee"];`),
  ...edges.map(([from, to]) => `  ${dotId(from)} -> ${dotId(to)};`),
  '}',
];
const dot = dotLines.join('\n');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'dependency-graph.dot'), dot);

const viz = await instance();
const svg = viz.renderString(dot, { format: 'svg' });
fs.writeFileSync(path.join(OUT_DIR, 'dependency-graph.svg'), svg);

console.log(`Dependency graph written to reports/dependency-graph.svg`);
