/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Builds the wizard's browser files into the module's view directory (or `--out <dir>`):
 *
 *   wizard.js                      the shell and its steps (src/main.tsx)
 *   sdk.js                         what the shell shares with step plugins (src/sdk/index.ts)
 *   vendor/preact.js               preact
 *   vendor/preact-hooks.js         preact/hooks, importing the bare `preact`
 *   vendor/preact-jsx-runtime.js   preact/jsx-runtime, importing the bare `preact`
 *
 * and copies the wizard's typeface into view/adminhtml/web/fonts/source-sans-3/ (or `--fonts-out <dir>`): the
 * latin subset of Source Sans 3 in the three weights the stylesheet declares, with its SIL Open Font License. The
 * admin loads the font from the module's own static files, never from a font service.
 *
 * Preact and the SDK are external everywhere, so the page holds exactly one copy of each and a plugin's hooks read
 * the very contexts the shell provides. Externals match whole specifiers only: esbuild's own `external` option
 * would also externalize every subpath (`preact` would swallow `preact/hooks`), leaving the vendor files empty.
 *
 * Every cross-file import is a bare specifier the page's import map resolves: a relative one would break once the
 * files are published under minified names. And no source file may end up in both wizard.js and sdk.js: a module
 * the shell reached by relative path instead of through the SDK specifier would be a second copy, with contexts no
 * provider fills and classes `instanceof` does not recognise. The build fails naming such a file. The output is deterministic (no metafile written, no timestamps), so
 * verify-build can compare it byte for byte.
 */
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = resolve(ROOT, '../../view/adminhtml/web/js/setup');
const DEFAULT_FONTS_OUT = resolve(ROOT, '../../view/adminhtml/web/fonts/source-sans-3');
const SHARED = ['preact', 'preact/hooks', 'preact/jsx-runtime', '@hryvinskyi/datalayer-setup'];

const FONT_PACKAGE = join(ROOT, 'node_modules/@fontsource/source-sans-3');
const FONT_FILES = [
    ...['400', '600', '700'].map((weight) => {
        const file = `source-sans-3-latin-${weight}-normal.woff2`;
        return { file, source: join(FONT_PACKAGE, 'files', file) };
    }),
    { file: 'OFL.txt', source: join(FONT_PACKAGE, 'LICENSE') },
];

const reexport = (specifier) => ({
    stdin: { contents: `export * from '${specifier}';`, resolveDir: ROOT, loader: 'js', sourcefile: `${specifier}.js` },
});

const OUTPUTS = [
    { file: 'wizard.js', input: { entryPoints: ['src/main.tsx'] }, external: SHARED },
    { file: 'sdk.js', input: { entryPoints: ['src/sdk/index.ts'] }, external: SHARED },
    { file: 'vendor/preact.js', input: reexport('preact'), external: [] },
    { file: 'vendor/preact-hooks.js', input: reexport('preact/hooks'), external: ['preact'] },
    { file: 'vendor/preact-jsx-runtime.js', input: reexport('preact/jsx-runtime'), external: ['preact'] },
];

/**
 * Keeps exactly the listed specifiers out of the bundle.
 *
 * @param {string[]} specifiers
 * @returns {import('esbuild').Plugin}
 */
const exactExternals = (specifiers) => ({
    name: 'exact-externals',
    setup(builder) {
        builder.onResolve({ filter: /.*/ }, (args) => (specifiers.includes(args.path) ? { path: args.path, external: true } : undefined));
    },
});

const isBare = (specifier) => !specifier.startsWith('.') && !specifier.startsWith('/') && !/^[a-z]+:/i.test(specifier);

/**
 * Builds one output in memory and refuses it when it imports anything but a bare specifier.
 *
 * @param {string} outDir
 * @param {{file: string, input: object, external: string[]}} output
 * @returns {Promise<{contents: Uint8Array, inputs: string[]}>}
 */
async function buildOne(outDir, output) {
    const result = await build({
        ...output.input,
        absWorkingDir: ROOT,
        tsconfig: join(ROOT, 'tsconfig.json'),
        outfile: join(outDir, output.file),
        plugins: [exactExternals(output.external)],
        bundle: true,
        format: 'esm',
        platform: 'browser',
        target: 'es2022',
        minify: true,
        splitting: false,
        legalComments: 'eof',
        charset: 'utf8',
        metafile: true,
        write: false,
        logLevel: 'warning',
    });
    for (const meta of Object.values(result.metafile.outputs)) {
        const relative = meta.imports.filter((item) => !item.external || !isBare(item.path));
        if (relative.length > 0) {
            throw new Error(`${output.file} imports ${relative.map((item) => item.path).join(', ')}; only bare specifiers are allowed`);
        }
    }
    const [file] = result.outputFiles;
    if (file === undefined || result.outputFiles.length !== 1) {
        throw new Error(`${output.file}: expected exactly one output file`);
    }
    return { contents: file.contents, inputs: Object.keys(result.metafile.inputs) };
}

/**
 * Refuses source files bundled into both the shell and the SDK.
 *
 * @param {Map<string, string[]>} inputs output file → the source files it bundles
 */
function refuseSharedSources(inputs) {
    const sdk = new Set(inputs.get('sdk.js') ?? []);
    const shared = (inputs.get('wizard.js') ?? []).filter((input) => sdk.has(input));
    if (shared.length > 0) {
        throw new Error(`wizard.js bundles ${shared.join(', ')}, which sdk.js bundles too: import it through @hryvinskyi/datalayer-setup`);
    }
}

const { values } = parseArgs({ options: { out: { type: 'string' }, 'fonts-out': { type: 'string' } } });
const outDir = resolve(values.out ?? DEFAULT_OUT);
const fontsDir = resolve(values['fonts-out'] ?? DEFAULT_FONTS_OUT);

const built = new Map();
for (const output of OUTPUTS) {
    built.set(output.file, await buildOne(outDir, output));
}
refuseSharedSources(new Map([...built].map(([file, result]) => [file, result.inputs])));
for (const [file, result] of built) {
    const target = join(outDir, file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, result.contents);
}
await mkdir(fontsDir, { recursive: true });
for (const font of FONT_FILES) {
    await writeFile(join(fontsDir, font.file), await readFile(font.source));
}
console.log(`Built ${OUTPUTS.length} files into ${outDir} and copied ${FONT_FILES.length} font files into ${fontsDir}`);
