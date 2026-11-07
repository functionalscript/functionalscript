import { assert, assertEq } from '../../asserts/module.f.js'
import { importsOf, isModuleFile, join, main, marker, reached, split } from './module.f.mjs'

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
}
