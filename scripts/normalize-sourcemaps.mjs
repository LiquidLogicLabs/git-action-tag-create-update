import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(repoRoot, 'dist');

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

function normalizeSource(source, mapDir) {
  if (typeof source !== 'string') return source;
  if (!source.startsWith('file://')) return source;

  let fsPath;
  try {
    fsPath = fileURLToPath(source);
  } catch {
    return source;
  }

  const rel = path.relative(mapDir, fsPath);
  // Ensure stable, POSIX-style paths in sourcemaps.
  return rel.split(path.sep).join('/');
}

async function normalizeMapFile(mapFile) {
  const raw = await fs.readFile(mapFile, 'utf8');
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    return;
  }

  if (!Array.isArray(json.sources)) return;

  const mapDir = path.dirname(mapFile);
  const normalized = json.sources.map(s => normalizeSource(s, mapDir));

  // Only write if changed.
  let changed = false;
  for (let i = 0; i < normalized.length; i++) {
    if (normalized[i] !== json.sources[i]) {
      changed = true;
      break;
    }
  }
  if (!changed) return;

  json.sources = normalized;
  await fs.writeFile(mapFile, JSON.stringify(json), 'utf8');
}

async function main() {
  try {
    await fs.access(distRoot);
  } catch {
    return;
  }

  for await (const file of walk(distRoot)) {
    if (!file.endsWith('.map')) continue;
    await normalizeMapFile(file);
  }
}

await main();
