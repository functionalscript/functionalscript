import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { cycleOf, decode, dirOf, encode, importsOf, isFileName, lastImports, main, outsideImports, reached, targetOf, twiceLoaded } from './module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'

/** @type {(value: unknown) => string} */
const json = value => JSON.stringify(value)

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
        for (const name of ['m.f.js', 'm.f.mjs', 'd.json', 'lib/m.f.js', 'dep', 'dep.mjs']) { assert(isFileName(name), name) }
        for (const name of [main, './m.f.js', '/m.f.js', '../m.f.js', 'lib/../m.f.js', 'a:b.f.js', '']) {
            assert(!isFileName(name), name)
        }
    },
    importsOf: {
        resolved: () => assertEq(json(importsOf('lib/b.f.mjs')(
            "import a from '../a.f.js'\nimport { x } from './c'\nimport y from '../a.f.js'\nimport r from '/r.mjs'\nexport default [a, x, y, r]")),
            json(['ok', ['a.f.js', 'lib/c', 'r.mjs']])),
        leftToTheCompiler: () => assertEq(json(importsOf(main)([
            "import p from 'functionalscript/fjs/a.f.mjs'",
            "import u from '../up.f.js'",
            'export default [p, u]',
        ].join('\n'))), json(['ok', []])),
        json: () => assertEq(json(importsOf('d.json')('{ "x": 1 }')), json(['ok', []])),
        refused: () => assertEq(json(importsOf(main)('export default "\\x41";')), json(['error', 'unexpected token'])),
    },
    reached: {
        tree: () => assertEq(json(reached(none)(shared)), json([main, 'a.f.js', 'lib/b.f.mjs', 'shared.json'])),
        missingFileIsEmpty: () => assertEq(
            json(reached(none)([[main, "import m from './m'\nexport default m"]])),
            json([main, 'm'])),
        notImported: () => assertEq(
            json(reached(none)([[main, 'export default 1'], ['m.f.js', 'export default 2']])),
            json([main])),
        cycle: () => assertEq(
            json(reached(none)([[main, "import m from './m.f.js'\nexport default m"], ['m.f.js', "import i from './input.f.js'\nexport default i"]])),
            json([main, 'm.f.js'])),
        halfTyped: () => {
            /** @type {(name: string) => readonly string[]} */
            const previous = name => name === main ? ['m.f.js'] : []
            assertEq(json(reached(previous)([[main, "import m from './m.f.js'\nexport default m +"]])), json([main, 'm.f.js']))
        },
    },
    lastImports: {
        parsed: () => assertEq(json(lastImports([])(shared)), json([
            [main, ['a.f.js', 'lib/b.f.mjs']],
            ['a.f.js', ['shared.json']],
            ['lib/b.f.mjs', ['shared.json']],
            ['shared.json', []],
        ])),
        halfTyped: () => {
            const before = lastImports([])([[main, "import m from './m.f.js'\nexport default m"]])
            const after = lastImports(before)([[main, "import m from './m.f.js'\nexport default m +"]])
            assertEq(json(after), json([[main, ['m.f.js']], ['m.f.js', []]]))
            assertEq(json(lastImports([])([[main, 'export default +']])), json([[main, []]]))
        },
    },
    cycleOf: {
        none: () => {
            assertEq(cycleOf(shared), null)
            assertEq(cycleOf([[main, 'export default 1']]), null)
            assertEq(cycleOf([[main, "import m from './m.f.js'\nexport default m"]]), null)
        },
        toMain: () => assertEq(json(cycleOf([[main, "import m from './m.f.js'\nexport default m"], ['m.f.js', "import i from '/input.f.js'\nexport default i"]])),
            json([main, 'm.f.js', main])),
        self: () => assertEq(json(cycleOf([[main, "import a from './a.f.js'\nexport default a"], ['a.f.js', "import a from './a.f.js'\nexport default a"]])),
            json(['a.f.js', 'a.f.js'])),
        afterAnAcyclicBranch: () => assertEq(json(cycleOf([
            [main, "import d from './d.json' with { type: 'json' }\nimport a from './a.f.js'\nexport default [d, a]"],
            ['d.json', '1'],
            ['a.f.js', "import b from './b.f.js'\nexport default b"],
            ['b.f.js', "import a from './a.f.js'\nexport default a"],
        ])), json(['a.f.js', 'b.f.js', 'a.f.js'])),
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
            assertEq(json(decode(encode(files))), json(['ok', files]))
            assertEq(json(decode('[]')), json(['ok', []]))
        },
        refusals: () => {
            assertEq(json(decode('[')), json(['error', 'files: unexpected end']))
            assertEq(json(decode('{}')), json(['error', 'files: not a list']))
            for (const text of ['[1]', '[["a.f.js"]]', '[[1, "x"]]', '[["a.f.js", 1]]']) {
                assertEq(json(decode(text)), json(['error', 'files: an entry is not a [name, text] pair']), text)
            }
            assertEq(json(decode('[["input.f.js", "x"]]')), json(['error', 'files: input.f.js is not a file name a program can hold']))
            assertEq(json(decode('[["../x.f.js", "x"]]')), json(['error', 'files: ../x.f.js is not a file name a program can hold']))
            assertEq(json(decode('[["a.f.js", "x"], ["a.f.js", "y"]]')), json(['error', 'files: a.f.js is written twice']))
        },
    },
    outsideImports: {
        none: () => {
            assertEq(json(outsideImports([[main, "import a from './a.f.js'\nexport default a"], ['a/x.f.js', '']])), '[]')
            assertEq(json(outsideImports([[main, 'export default +']])), '[]')
        },
        rootedAndAbove: () => assertEq(json(outsideImports([
            [main, "import a from './a/x.f.js'\nimport u from '../up.f.js'\nimport d from './d.json' with { type: 'json' }\nimport p from 'pkg'\nimport b from './a:b.f.js'\nexport default [a, u, d, p, b]"],
            ['a/x.f.js', "import r from '/lib/r.mjs'\nimport s from '../s.f.js'\nexport default [r, s]"],
            ['d.json', '{}'],
        ])), json([[main, '../up.f.js'], ['a/x.f.js', '/lib/r.mjs']])),
    },
    twiceLoaded: {
        sharedFixture: () => assertEq(json(twiceLoaded(shared)), json(['shared.json'])),
        none: () => {
            assertEq(json(twiceLoaded([[main, "import a from './lib/d.mjs'\nimport b from './lib/d.mjs'\nexport default [a, b]"]])), '[]')
            assertEq(json(twiceLoaded([[main, "import a from '/lib/d.mjs'\nimport b from '/lib/./d.mjs'\nexport default [a, b]"]])), '[]')
            assertEq(json(twiceLoaded([[main, 'export default +']])), '[]')
        },
        bothWays: () => assertEq(json(twiceLoaded([
            [main, "import x from './a/x.f.js'\nimport d from './lib/d.mjs'\nimport p from 'pkg'\nexport default [x, d, p]"],
            ['a/x.f.js', "import d from '/lib/d.mjs'\nimport m from '/input.f.js'\nexport default [d, m]"],
        ])), json([main, 'lib/d.mjs'])),
    },
}
