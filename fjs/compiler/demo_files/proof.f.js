import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { cycleOf, decode, dirOf, encode, fileOf, identityOf, importsOf, isFileName, lastImports, main, outsideImports, reached, targetOf, twiceLoaded } from './module.f.js'
import { utf8 } from '../../text/module.f.js'
import { generate } from '../../types/array/module.f.js'

/**
 * A program of four files: the main module imports two, which share one,
 * reached by a relative path from one and a rooted one from the other.
 *
 * @type {import('./types.ts').Files}
 */
const shared = [
    [main, "import a from './a.f.js'\nimport b from './lib/b.f.mjs'\nexport default [a, b]"],
    ['a.f.js', "import s from './shared.json' with { type: 'json' }\nexport default { s }"],
    ['lib/b.f.mjs', "import s from '/shared.json' with { type: 'json' }\nexport default { s }"],
    ['shared.json', '{ "name": "shared object" }'],
]

/** Nothing before a module parses. */
const none = () => []

export const proof = {
    main: () => assertEq(main, 'input.f.js'),
    targetOf: {
        relative: () => {
            assertEq(targetOf(main)('./m.f.js'), 'm.f.js')
            assertEq(targetOf('lib/b.f.js')('../a.f.js'), 'a.f.js')
            assertEq(targetOf('lib/b.f.js')('./c'), 'lib/c')
            assertEq(targetOf(main)('./lib/./c.mjs'), 'lib/c.mjs')
        },
        rooted: () => {
            assertEq(targetOf('lib/b.f.js')('/a.f.js'), 'a.f.js')
            assertEq(targetOf(main)('/lib/c.f.js'), 'lib/c.f.js')
        },
        none: () => {
            for (const specifier of ['m.f.js', 'functionalscript/fjs/a.f.mjs', '../up.f.js', '/', './', '//host/a.f.js', './a:b.f.js']) {
                assertEq(targetOf(main)(specifier), null, specifier)
            }
        },
    },
    isFileName: () => {
        for (const name of ['m.f.js', 'm.f.mjs', 'd.json', 'lib/m.f.js', 'dep', 'dep.mjs', 'dep?.f.js', 'dep?#%.mjs']) { assert(isFileName(name), name) }
        for (const name of [main, './m.f.js', '/m.f.js', '../m.f.js', 'lib/../m.f.js', 'C:/x.f.js', 'a\\b.f.js', '//x', 'lib/', '.', '']) {
            assert(!isFileName(name), name)
        }
        // a name an import's escapes decode to is one a program can hold
        assertEq(targetOf(main)('./dep%3F%23%25.mjs'), 'dep?#%.mjs')
        assert(isFileName('dep?#%.mjs'), 'decoded')
    },
    importsOf: {
        resolved: () => assertStructurallySame(importsOf('lib/b.f.mjs')(
            "import a from '../a.f.js'\nimport { x } from './c'\nimport y from '../a.f.js'\nimport r from '/r.mjs'\nexport default [a, x, y, r]"),
            ['ok', ['a.f.js', 'lib/c', '/r.mjs']]),
        leftToTheCompiler: () => assertStructurallySame(importsOf(main)([
            "import p from 'functionalscript/fjs/a.f.mjs'",
            "import u from '../up.f.js'",
            'export default [p, u]',
        ].join('\n')), ['ok', []]),
        json: () => assertStructurallySame(importsOf('d.json')('{ "x": 1 }'), ['ok', []]),
        refused: () => assertStructurallySame(importsOf(main)('export default "\\x41";'), ['error', 'unexpected token']),
    },
    reached: {
        tree: () => assertStructurallySame(reached(none)(shared), [main, 'a.f.js', 'lib/b.f.mjs', 'shared.json']),
        missingFileIsEmpty: () => assertStructurallySame(
            reached(none)([[main, "import m from './m'\nexport default m"]]),
            [main, 'm']),
        notImported: () => assertStructurallySame(
            reached(none)([[main, 'export default 1'], ['m.f.js', 'export default 2']]),
            [main]),
        cycle: () => assertStructurallySame(
            reached(none)([[main, "import m from './m.f.js'\nexport default m"], ['m.f.js', "import i from './input.f.js'\nexport default i"]]),
            [main, 'm.f.js']),
        halfTyped: () => {
            /** @type {(name: string) => readonly string[]} */
            const previous = name => name === main ? ['m.f.js'] : []
            assertStructurallySame(reached(previous)([[main, "import m from './m.f.js'\nexport default m +"]]), [main, 'm.f.js'])
        },
    },
    lastImports: {
        parsed: () => assertStructurallySame(lastImports([])(shared), [
            [main, ['a.f.js', 'lib/b.f.mjs']],
            ['a.f.js', ['shared.json']],
            ['lib/b.f.mjs', ['/shared.json']],
            ['shared.json', []],
            ['/shared.json', []],
        ]),
        halfTyped: () => {
            const before = lastImports([])([[main, "import m from './m.f.js'\nexport default m"]])
            const after = lastImports(before)([[main, "import m from './m.f.js'\nexport default m +"]])
            assertStructurallySame(after, [[main, ['m.f.js']], ['m.f.js', []]])
            assertStructurallySame(lastImports([])([[main, 'export default +']]), [[main, []]])
        },
    },
    identityOf: {
        // a rooted importer resolves its relative imports from the root, where `..` stays
        rooted: () => {
            assertEq(identityOf('/a.f.js')('../x.f.js'), '/x.f.js')
            assertEq(identityOf('a.f.js')('../x.f.js'), null)
            assertEq(identityOf('/lib/b.f.js')('./c.f.js'), '/lib/c.f.js')
            assertEq(identityOf(main)('/lib/./d.mjs'), '/lib/d.mjs')
            assertEq(fileOf('/lib/d.mjs'), 'lib/d.mjs')
        },
    },
    walk: {
        upwardFromARootedImporter: () => assertStructurallySame(reached(none)([
            [main, "import a from '/a.f.js'\nexport default a"],
            ['a.f.js', "import x from '../x.f.js'\nexport default x"],
        ]), [main, 'a.f.js', 'x.f.js']),
    },
    cycleOf: {
        none: () => {
            assertEq(cycleOf(shared), null)
            assertEq(cycleOf([[main, 'export default 1']]), null)
            assertEq(cycleOf([[main, "import m from './m.f.js'\nexport default m"]]), null)
        },
        toMain: () => assertStructurallySame(cycleOf([[main, "import m from './m.f.js'\nexport default m"], ['m.f.js', "import i from '/input.f.js'\nexport default i"]]),
            ['/input.f.js', '/m.f.js', '/input.f.js']),
        self: () => assertStructurallySame(cycleOf([[main, "import a from './a.f.js'\nexport default a"], ['a.f.js', "import a from './a.f.js'\nexport default a"]]),
            ['a.f.js', 'a.f.js']),
        afterAnAcyclicBranch: () => assertStructurallySame(cycleOf([
            [main, "import d from './d.json' with { type: 'json' }\nimport a from './a.f.js'\nexport default [d, a]"],
            ['d.json', '1'],
            ['a.f.js', "import b from './b.f.js'\nexport default b"],
            ['b.f.js', "import a from './a.f.js'\nexport default a"],
        ]), ['a.f.js', 'b.f.js', 'a.f.js']),
        // files sharing their imports are walked once each: twenty layers of a
        // diamond would be a million paths
        layeredDiamond: () => {
            /** @type {(i: number) => string} */
            const layer = i => i === 20 ? 'export default 0' : `import a from './l${i + 1}a.f.js'\nimport b from './l${i + 1}b.f.js'\nexport default [a, b]`
            /** @type {import('./types.ts').Files} */
            const files = [[main, layer(-1)], ...generate(21, i => i).flatMap(i => [
                /** @type {import('./types.ts').File} */ ([`l${i}a.f.js`, layer(i)]),
                /** @type {import('./types.ts').File} */ ([`l${i}b.f.js`, layer(i)]),
            ])]
            assertEq(cycleOf(files), null)
            assertStructurallySame(cycleOf([...files.slice(0, -1), ['l20b.f.js', "import m from './input.f.js'\nexport default m"]]),
                [main, 'l0a.f.js', 'l1a.f.js', 'l2a.f.js', 'l3a.f.js', 'l4a.f.js', 'l5a.f.js', 'l6a.f.js', 'l7a.f.js', 'l8a.f.js', 'l9a.f.js',
                    'l10a.f.js', 'l11a.f.js', 'l12a.f.js', 'l13a.f.js', 'l14a.f.js', 'l15a.f.js', 'l16a.f.js', 'l17a.f.js', 'l18a.f.js', 'l19a.f.js', 'l20b.f.js', main])
        },
        throughARootedImporter: () => assertStructurallySame(cycleOf([
            [main, "import a from '/a.f.js'\nexport default a"],
            ['a.f.js', "import x from '../input.f.js'\nexport default x"],
        ]), ['/a.f.js', '/input.f.js', '/a.f.js']),
        unparsedImportsNothing: () => assertEq(
            cycleOf([[main, "import a from './a.f.js'\nexport default a"], ['a.f.js', "import i from './input.f.js'\nexport default i +"]]),
            null),
    },
    dirOf: {
        nested: () => assertStructurallySame(dirOf([[main, 'm'], ['lib/a.f.js', 'a'], ['lib/b.f.js', 'b'], ['lib/x/c.json', 'c']]),
            { [main]: [utf8('m')], lib: { 'a.f.js': [utf8('a')], 'b.f.js': [utf8('b')], x: { 'c.json': [utf8('c')] } } }),
        laterFileWins: () => assertStructurallySame(dirOf([['a.f.js', 'a'], ['a.f.js/b.f.js', 'b']]),
            { 'a.f.js': { 'b.f.js': [utf8('b')] } }),
    },
    encode: () => {
        assertEq(encode([]), '[]')
        assertEq(encode([['a.f.js', 'export default "// @filename: x";\n  // @filename: y']]),
            '[["a.f.js","export default \\"// @filename: x\\";\\n  // @filename: y"]]')
    },
    decode: {
        roundTrip: () => {
            const [, ...files] = shared
            assertStructurallySame(decode(encode(files)), ['ok', files])
            assertStructurallySame(decode('[]'), ['ok', []])
        },
        refusals: () => {
            assertStructurallySame(decode('['), ['error', 'files: unexpected end'])
            assertStructurallySame(decode('{}'), ['error', 'files: not a list'])
            for (const text of ['[1]', '[["a.f.js"]]', '[[1, "x"]]', '[["a.f.js", 1]]']) {
                assertStructurallySame(decode(text), ['error', 'files: an entry is not a [name, text] pair'], text)
            }
            assertStructurallySame(decode('[["input.f.js", "x"]]'), ['error', 'files: input.f.js is not a file name a program can hold'])
            assertStructurallySame(decode('[["../x.f.js", "x"]]'), ['error', 'files: ../x.f.js is not a file name a program can hold'])
            assertStructurallySame(decode('[["a.f.js", "x"], ["a.f.js", "y"]]'), ['error', 'files: a.f.js is written twice'])
        },
    },
    outsideImports: {
        none: () => {
            assertStructurallySame(outsideImports([[main, "import a from './a.f.js'\nexport default a"], ['a/x.f.js', '']]), [])
            assertStructurallySame(outsideImports([[main, 'export default +']]), [])
        },
        rootedAndAbove: () => assertStructurallySame(outsideImports([
            [main, "import a from './a/x.f.js'\nimport u from '../up.f.js'\nimport d from './d.json' with { type: 'json' }\nimport p from 'pkg'\nimport b from './a:b.f.js'\nexport default [a, u, d, p, b]"],
            ['a/x.f.js', "import r from '/lib/r.mjs'\nimport s from '../s.f.js'\nexport default [r, s]"],
            ['d.json', '{}'],
        ]), [[main, '../up.f.js'], ['a/x.f.js', '/lib/r.mjs']]),
        refusedByTheCompiler: () => assertStructurallySame(outsideImports([
            [main, "import h from '//host/a.f.js'\nimport c from '/a:b.f.js'\nimport p from '/bad%'\nimport d from '/lib/d.mjs'\nexport default [h, c, p, d]"],
        ]), [[main, '/lib/d.mjs']]),
    },
    twiceLoaded: {
        sharedFixture: () => assertStructurallySame(twiceLoaded(shared), ['shared.json']),
        none: () => {
            assertStructurallySame(twiceLoaded([[main, "import a from './lib/d.mjs'\nimport b from './lib/d.mjs'\nexport default [a, b]"]]), [])
            assertStructurallySame(twiceLoaded([[main, "import a from '/lib/d.mjs'\nimport b from '/lib/./d.mjs'\nexport default [a, b]"]]), [])
            assertStructurallySame(twiceLoaded([[main, 'export default +']]), [])
        },
        bothWays: () => assertStructurallySame(twiceLoaded([
            [main, "import x from './a/x.f.js'\nimport d from './lib/d.mjs'\nimport p from 'pkg'\nexport default [x, d, p]"],
            ['a/x.f.js', "import d from '/lib/d.mjs'\nimport m from '/input.f.js'\nexport default [d, m]"],
        ]), [main, 'a/x.f.js', 'lib/d.mjs']),
        throughARootedImporter: () => assertStructurallySame(twiceLoaded([
            [main, "import a from '/a.f.js'\nimport b from './b.f.js'\nexport default [a, b]"],
            ['a.f.js', "import b from './b.f.js'\nimport u from '../up.f.js'\nimport d from './d.json' with { type: 'json' }\nimport h from './half.f.js'\nexport default b"],
            ['b.f.js', 'export default {}'],
            ['d.json', '{}'],
            ['half.f.js', 'export default +'],
        ]), ['b.f.js']),
    },
}
