import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { _buildIdentity } from '../module.f.mjs'
import { rustdocFooter, rustdocHead, rustdocHeader } from '../cargo-doc/module.f.mjs'
import { documentationBarsStylesheet } from '../style/module.f.js'
import { entrypoints, inputDir, outputDir, manifestName, stylesheetName, moduleSource, symbolSource, withSiteChrome, readManifest, moduleHref } from './module.f.mjs'

const sources = ['fjs/crypto/sha2/module.f.mjs', 'fjs/types/result/module.f.js', 'fjs/types/result/types.ts']

export const proof = {
    paths: () => {
        assertEq(inputDir, 'target/deno-doc')
        assertEq(outputDir, 'deno.doc')
        assertEq(manifestName, '_modules.txt')
        assertEq(stylesheetName, '_functional-script.css')
        assert(documentationBarsStylesheet.includes('body > header'), documentationBarsStylesheet)
        assertStructurallySame(_buildIdentity({}), { commit: null, branch: null })
    },
    discovery: () => assertStructurallySame(entrypoints([
        ...sources.toReversed(), 'module.f.mjs', 'fjs/module.f.mjs', 'other/a/types.ts',
        'fjs/crypto/sha2/proof.f.mjs', 'fjs/crypto/sha2/demo.f.mjs', 'fjs/crypto/sha2/private.ts',
        'fjs/crypto/sha2/module.mjs', 'fjs/ci/types.ts', 'fjs/dev/a/module.f.mjs',
        'fjs/website/a/module.f.js', 'fjs/crypto/todo/types.ts', 'fjs/compiler/examples/module.f.js',
        'fjs/crypto/gen.test/module.f.mjs', 'fjs/.hidden/types.ts', 'fjs/node_modules/a/types.ts', 'fjs/target/a/types.ts',
    ]), sources),
    moduleSource: () => {
        assertEq(moduleSource('<title>crypto&#x2F;sha2&#x2F;module.f.mjs - FunctionalScript documentation</title>')(sources), sources[0])
        assertEq(moduleSource('<title>fjs/types/result/types.ts - FunctionalScript documentation</title>')(sources), sources[2])
        assertEq(moduleSource('<title>FunctionalScript documentation</title>')(sources), null)
        assertEq(moduleSource('')(sources), null)
        assertEq(moduleSource('<title>sha2/module.f.mjs - FunctionalScript documentation</title>')(sources), sources[0])
        assertEq(moduleSource('<title>unknown - FunctionalScript documentation</title>')(sources), null)
    },
    symbolSource: () => {
        assertEq(symbolSource('<meta name="doc-current-file" content="crypto&#x2F;sha2&#x2F;module.f.mjs">')(sources), sources[0])
        assertEq(symbolSource('')(sources), null)
        assertEq(symbolSource('<meta name="doc-current-file" content="unknown">')(sources), null)
        const name = 'fjs/a&"\'<>/types.ts'
        assertEq(symbolSource('<meta name="doc-current-file" content="a&amp;&quot;&#x27;&lt;&gt;&#x2F;types.ts">')([name]), name)
    },
    siteChrome: () => {
        const build = /** @type {const} */ ({ commit: null, branch: null, funding: [{ description: 'Support', address: 'https://example.com/' }], jsApi: [[sources[0], 'sha2/index.html']] })
        const chrome = { head: rustdocHead, header: rustdocHeader(build), footer: rustdocFooter(build.funding) }
        const root = withSiteChrome(chrome)('<head><link href="styles.css"></head><body><div>Deno</div></body>')(null)
        assert(root.includes('<link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="icon" type="image/svg+xml" href="/fjs/website/favicon.svg"></head>'), root)
        assert(root.includes('<body>\n<header><nav aria-label="Site">'), root)
        assert(root.includes('<a href="/deno.doc/">JS API</a>'), root)
        assert(root.endsWith('<footer data-funding="">Support FunctionalScript: <a href="https://example.com/">Support<span aria-hidden="true"> ↗</span></a></footer></body>'), root)
        const html = withSiteChrome({ head: '', header: '<header></header>', footer: '<footer></footer>' })('<head></head><body>search and assets</body>')('fjs/a #/module.f.mjs')
        assert(html.includes('href="/fjs/a%20%23/">Source directory'), html)
        assert(html.endsWith('search and assets<footer></footer></body>'), html)
    },
    manifest: () => {
        const modules = readManifest(`${sources[2]}\tactual/types/index.html\n${sources[0]}\tactual/sha2/index.html\n${sources[1]}\tactual/result/index.html\n`)
        assertEq(moduleHref(modules)('fjs/crypto/sha2'), '/deno.doc/actual/sha2/index.html')
        assertEq(moduleHref(modules)('fjs/types/result'), '/deno.doc/actual/result/index.html')
        assertEq(moduleHref([[sources[2], 'a b/types/index.html']])('fjs/types/result'), '/deno.doc/a%20b/types/index.html')
        assertEq(moduleHref(modules)('fjs/missing'), null)
        assertStructurallySame(readManifest(''), [])
    },
    throw: {
        ambiguous: () => moduleSource('<title>a/types.ts - FunctionalScript documentation</title>')(['fjs/one/a/types.ts', 'fjs/other/a/types.ts']),
        headAbsent: () => withSiteChrome({ head: '', header: '', footer: '' })('<body></body>')(null),
        headRepeated: () => withSiteChrome({ head: '', header: '', footer: '' })('<head></head></head><body></body>')(null),
        bodyAbsent: () => withSiteChrome({ head: '', header: '', footer: '' })('<head></head>')(null),
        bodyRepeated: () => withSiteChrome({ head: '', header: '', footer: '' })('<head></head><body><body></body>')(null),
        bodyCloseRepeated: () => withSiteChrome({ head: '', header: '', footer: '' })('<head></head><body></body></body>')(null),
        missingField: () => readManifest(sources[0]),
        extraField: () => readManifest(`${sources[0]}\tx/index.html\textra`),
        privateSource: () => readManifest('fjs/a/private.ts\tx/index.html'),
        wrongPage: () => readManifest(`${sources[0]}\tx.html`),
        traversal: () => readManifest(`${sources[0]}\t../x/index.html`),
        absolute: () => readManifest(`${sources[0]}\t/x/index.html`),
        dot: () => readManifest(`${sources[0]}\t./x/index.html`),
    },
}
