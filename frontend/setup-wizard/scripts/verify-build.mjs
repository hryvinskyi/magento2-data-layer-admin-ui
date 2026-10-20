/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Proves the committed browser files are exactly what the sources build to: rebuilds into a temporary directory and
 * compares every file byte for byte with view/adminhtml/web/js/setup/ and with the copied typeface in
 * view/adminhtml/web/fonts/source-sans-3/. A file that differs, is missing, or is committed without the build
 * producing it fails the check (exit code 1). Both directories belong to the build alone.
 */
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = [
    { option: '--out', scratch: 'js', committed: resolve(ROOT, '../../view/adminhtml/web/js/setup') },
    { option: '--fonts-out', scratch: 'fonts', committed: resolve(ROOT, '../../view/adminhtml/web/fonts/source-sans-3') },
];

/**
 * Every file under a directory, as paths relative to it; none when the directory does not exist.
 *
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function filesIn(dir) {
    try {
        const entries = await readdir(dir, { recursive: true, withFileTypes: true });
        return entries
            .filter((entry) => entry.isFile())
            .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
            .sort();
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

/**
 * Compares what the build wrote into one scratch directory with its committed counterpart.
 *
 * @param {string} fresh the scratch directory
 * @param {string} committedDir the committed directory
 * @returns {Promise<string[]>} one line per problem
 */
async function compare(fresh, committedDir) {
    const found = [];
    const built = await filesIn(fresh);
    const committed = new Set(await filesIn(committedDir));
    for (const file of built) {
        if (!committed.has(file)) {
            found.push(`missing: ${join(committedDir, file)} is built but not committed`);
            continue;
        }
        const [rebuilt, kept] = await Promise.all([readFile(join(fresh, file)), readFile(join(committedDir, file))]);
        if (!rebuilt.equals(kept)) {
            found.push(`differs: ${join(committedDir, file)} does not match what its sources build to`);
        }
        committed.delete(file);
    }
    for (const file of committed) {
        found.push(`stale: ${join(committedDir, file)} is committed but the build no longer produces it`);
    }
    return found;
}

const scratch = await mkdtemp(join(tmpdir(), 'datalayer-setup-build-'));
const problems = [];
try {
    const args = TARGETS.flatMap((target) => [target.option, join(scratch, target.scratch)]);
    execFileSync(process.execPath, [join(ROOT, 'scripts/build.mjs'), ...args], { stdio: 'inherit' });
    for (const target of TARGETS) {
        problems.push(...(await compare(join(scratch, target.scratch), target.committed)));
    }
} finally {
    await rm(scratch, { recursive: true, force: true });
}

const committedDirs = TARGETS.map((target) => target.committed).join(' and ');
if (problems.length > 0) {
    console.error(`The committed build in ${committedDirs} is out of date. Run npm run build.\n  ${problems.join('\n  ')}`);
    process.exit(1);
}
console.log(`The committed build in ${committedDirs} matches its sources.`);
