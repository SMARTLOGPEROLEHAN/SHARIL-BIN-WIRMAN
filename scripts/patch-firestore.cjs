const fs = require('fs');
const path = require('path');

function patchFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Pattern 1: Minified ESM / CJS / RN (ca9 / 3241)
    // this.ve -= 1, __PRIVATE_hardAssert(this.ve >= 0, 3241, {
    if (content.includes('3241')) {
      const updated = content.replace(
        /this\.ve\s*-=\s*1\s*,\s*__PRIVATE_hardAssert\s*\(\s*this\.ve\s*>=\s*0\s*,\s*3241/g,
        'this.ve = Math.max(0, this.ve - 1), __PRIVATE_hardAssert(true, 3241'
      );
      if (updated !== content) {
        content = updated;
        changed = true;
      }
    }

    // Pattern 2: Unminified / Node CJS & MJS (0x0ca9)
    // hardAssert(this.pendingResponses >= 0, 0x0ca9, { pendingResponses: this.pendingResponses });
    if (content.includes('0x0ca9')) {
      const updated = content.replace(
        /this\.pendingResponses\s*-=\s*1;\s*hardAssert\s*\(\s*this\.pendingResponses\s*>=\s*0\s*,\s*0x0ca9/g,
        'this.pendingResponses = Math.max(0, this.pendingResponses - 1); hardAssert(true, 0x0ca9'
      );
      if (updated !== content) {
        content = updated;
        changed = true;
      }
    }

    // Pattern 3: Minified AsyncQueue failure (b815 / 47125)
    // this.nc && fail(47125, {
    if (content.includes('47125')) {
      const updated = content.replace(
        /this\.nc\s*&&\s*fail\s*\(\s*47125\s*,\s*\{/g,
        'this.nc && (console.warn("[Firestore AsyncQueue] Recovered:", this.nc), this.nc = null) && !fail(47125, {'
      );
      if (updated !== content) {
        content = updated;
        changed = true;
      }
    }

    // Pattern 4: Unminified AsyncQueue failure (0xb815)
    // fail(0xb815, {
    if (content.includes('0xb815')) {
      const updated = content.replace(
        /if\s*\(\s*this\.failure\s*\)\s*\{\s*fail\s*\(\s*0xb815/g,
        'if (this.failure) { console.warn("[Firestore AsyncQueue] Recovered:", this.failure); this.failure = null; return; } if (false) { fail(0xb815'
      );
      if (updated !== content) {
        content = updated;
        changed = true;
      }
    }

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`[patch-firestore] Patched assertions in: ${path.basename(filePath)}`);
    }
  } catch (err) {
    console.warn(`[patch-firestore] Skip ${filePath}: ${err.message}`);
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs') || entry.name.endsWith('.cjs'))) {
      patchFile(fullPath);
    }
  }
}

// 1. Patch files in node_modules/@firebase/firestore/dist
const firestoreDist = path.join(__dirname, '..', 'node_modules', '@firebase', 'firestore', 'dist');
walkDir(firestoreDist);

// 2. Clear Vite pre-bundled deps cache so Vite rebuilds with patched Firestore
const viteDepsDir = path.join(__dirname, '..', 'node_modules', '.vite');
if (fs.existsSync(viteDepsDir)) {
  try {
    fs.rmSync(viteDepsDir, { recursive: true, force: true });
    console.log('[patch-firestore] Cleared .vite cache directory');
  } catch (err) {
    console.warn('[patch-firestore] Could not remove .vite cache:', err.message);
  }
}

console.log('[patch-firestore] Firestore patching complete.');
