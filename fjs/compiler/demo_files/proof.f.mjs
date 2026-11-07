import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { cycleOf, dirOf, importsOf, isModuleFile, join, lastImports, main, mainOf, marker, reached, split } from './module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'

/** @type {(value: unknown) => string} */
const json = value => JSON.stringify(value)

/** A program of four files: the main module imports two, which share one. */
const shared = [
    "import a from './a.f.js'",
    "import b from './lib/b.f.mjs'",
    'export default [a, b]',
    `${marker}a.f.js`,
    "import s from './shared.json' with { type: 'json' }",
    'export default { s }',
    `${marker}lib/b.f.mjs`,
    "import s from '../shared.json' with { type: 'json' }",
    'export default { s }',
    `${marker}shared.json`,
    '{ "name": "shared object" }',
].join('\n')

/** Nothing before a module parses. */
const none = () => []

export const proof = {
    main: () => assertEq(main, 'input.f.js'),
    isModuleFile: () => {
        for (const name of ['m.f.js', 'm.f.mjs', 'd.json', 'lib/m.f.js']) { assert(isModuleFile(name), name) }
        for (const name of ['m.js', 'm.mjs', './m.f.js', '/m.f.js', '../m.f.js', 'lib/../m.f.js', 'a:b.f.js', '']) {
            assert(!isModuleFile(name), name)
        }
    },
    split: {
        oneModule: () => {
            assertEq(json(split('export default 1')), json(['ok', [[main, 'export default 1']]]))
            assertEq(json(split('')), json(['ok', [[main, '']]]))
        },
        files: () => assertEq(json(split(shared)), json(['ok', [
            [main, "import a from './a.f.js'\nimport b from './lib/b.f.mjs'\nexport default [a, b]"],
            ['a.f.js', "import s from './shared.json' with { type: 'json' }\nexport default { s }"],
            ['lib/b.f.mjs', "import s from '../shared.json' with { type: 'json' }\nexport default { s }"],
            ['shared.json', '{ "name": "shared object" }'],
        ]])),
        emptyFiles: () => assertEq(json(split(`${marker}a.f.js\n${marker}b.f.js`)),
            json(['ok', [[main, ''], ['a.f.js', ''], ['b.f.js', '']]])),
        refusals: () => {
            assertEq(json(split(`x\n${marker}${main}\ny`)),
                json(['error', 'input.f.js is the main module, the text before the first marker']))
            assertEq(json(split(`x\n${marker}m.js`)),
                json(['error', 'm.js is not a module file name: a relative path ending in .f.js, .f.mjs or .json']))
            assertEq(json(split(`${marker}m.f.js\n${marker}m.f.js`)), json(['error', 'm.f.js is written twice']))
            assertEq(json(split(`x\n  ${marker}m.f.js`)), json(['error', 'a marker must start its line: // @filename: m.f.js']))
            assertEq(json(split('x\n//  @filename: m.f.js')), json(['ok', [[main, 'x\n//  @filename: m.f.js']]]))
        },
    },
    join: {
        roundTrip: () => {
            for (const text of [shared, '', 'export default 1', `${marker}a.f.js\n${marker}b.f.js`, `x\n${marker}a.f.js\n\n`]) {
                const files = split(text)
                assert(files[0] === 'ok', text)
                assertEq(join(files[1]), text)
            }
        },
        emptyMain: () => {
            const files = split(`\n${marker}a.f.js\nexport default 1`)
            assert(files[0] === 'ok', 'empty main')
            assertEq(join(files[1]), `${marker}a.f.js\nexport default 1`)
            assertEq(json(split(join(files[1]))), json(files))
        },
    },
    importsOf: {
        relative: () => assertEq(json(importsOf('lib/b.f.mjs')(
            "import a from '../a.f.js'\nimport { x } from './c.f.js'\nimport y from '../a.f.js'\nexport default [a, x, y]")),
            json(['ok', ['a.f.js', 'lib/c.f.js']])),
        leftToTheCompiler: () => assertEq(json(importsOf(main)([
            "import p from 'functionalscript/fjs/a.f.mjs'",
            "import r from '/r.f.js'",
            "import j from './j.js'",
            "import u from '../up.f.js'",
            'export default [p, r, j, u]',
        ].join('\n'))), json(['ok', []])),
        json: () => assertEq(json(importsOf('d.json')('{ "x": 1 }')), json(['ok', []])),
        refused: () => assertEq(json(importsOf(main)('export default "\\x41";')), json(['error', 'unexpected token'])),
    },
    reached: {
        tree: () => {
            const files = split(shared)
            assert(files[0] === 'ok', 'shared')
            assertEq(json(reached(none)(files[1])), json([main, 'a.f.js', 'lib/b.f.mjs', 'shared.json']))
        },
        missingFileIsEmpty: () => assertEq(
            json(reached(none)([[main, "import m from './m.f.js'\nexport default m"]])),
            json([main, 'm.f.js'])),
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
    mainOf: () => {
        assertEq(mainOf(shared), "import a from './a.f.js'\nimport b from './lib/b.f.mjs'\nexport default [a, b]")
        assertEq(mainOf('export default 1'), 'export default 1')
        const refused = `x\n${marker}m.js`
        assertEq(mainOf(refused), refused)
    },
    dirOf: {
        nested: () => assertStructurallySame(dirOf([[main, 'm'], ['lib/a.f.js', 'a'], ['lib/b.f.js', 'b'], ['lib/x/c.json', 'c']]),
            { [main]: [utf8('m')], lib: { 'a.f.js': [utf8('a')], 'b.f.js': [utf8('b')], x: { 'c.json': [utf8('c')] } } }),
        laterFileWins: () => assertStructurallySame(dirOf([['a.f.js', 'a'], ['a.f.js/b.f.js', 'b']]),
            { 'a.f.js': { 'b.f.js': [utf8('b')] } }),
    },
    lastImports: {
        parsed: () => {
            const files = split(shared)
            assert(files[0] === 'ok', 'shared')
            assertEq(json(lastImports([])(files[1])), json([
                [main, ['a.f.js', 'lib/b.f.mjs']],
                ['a.f.js', ['shared.json']],
                ['lib/b.f.mjs', ['shared.json']],
                ['shared.json', []],
            ]))
        },
        halfTyped: () => {
            const before = lastImports([])([[main, "import m from './m.f.js'\nexport default m"]])
            const after = lastImports(before)([[main, "import m from './m.f.js'\nexport default m +"]])
            assertEq(json(after), json([[main, ['m.f.js']], ['m.f.js', []]]))
            assertEq(json(lastImports([])([[main, 'export default +']])), json([[main, []]]))
        },
    },
    cycleOf: {
        none: () => {
            const files = split(shared)
            assert(files[0] === 'ok', 'shared')
            assertEq(cycleOf(files[1]), null)
            assertEq(cycleOf([[main, 'export default 1']]), null)
            assertEq(cycleOf([[main, "import m from './m.f.js'\nexport default m"]]), null)
        },
        toMain: () => assertEq(json(cycleOf([[main, "import m from './m.f.js'\nexport default m"], ['m.f.js', "import i from './input.f.js'\nexport default i"]])),
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
}
