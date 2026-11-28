/** Shared reader behavior stays independent of module execution. */

/**
 * @import { _Load } from './types.ts'
 */

import { _attributeError, _importSources, _jsonModule, _missingExport, _parseJson, _parseModule, _program, _programOver, _rootSource, _walk, jsonValue, parse, readSource } from './module.f.js'
import { pureError, pureOk } from '../../effects/module.f.js'
import { ok } from '../../types/result/module.f.js'
import { virtual, virtualAt, emptyState } from '../../effects/node/virtual/module.f.js'
import { partialRun } from '../../effects/mock/module.f.js'
import { nodeCommands } from '../../effects/node/module.f.js'
import { u8ListToVecMsb } from '../../types/bit_vec/module.f.js'
import { utf8 } from '../../text/module.f.js'
import { assert, assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.js'

const source = { id: 'main.f.js', path: 'main.f.js', json: false }
const imported = { specifier: './dep.f.js', json: false, name: 'default' }

export const proof = {
    sourceText: () => {
        // Whole-source reads retain a UTF-8 sequence crossing chunk boundaries.
        const [, result] = virtualAt({
            'source.f.mjs': [
                u8ListToVecMsb([0xf0, 0x9f]),
                u8ListToVecMsb([0x98, 0x80]),
            ],
        })(readSource('source.f.mjs'))
        assertStructurallySame(result, ['ok', '😀'])
    },
    module: () => {
        const text = 'export default 7;'
        const run = virtualAt({ 'main.f.js': [utf8(text)] })
        assertStructurallySame(run(_parseModule('main.f.js'))[1], parse('main.f.js')(text))
        assertEq(parse('main.f.js')('not a module')[0], 'error')
        const [, invalid] = virtualAt({ 'bad.f.js': [u8ListToVecMsb([0xff])] })(_parseModule('bad.f.js'))
        assertStructurallySame(invalid, ['error', { message: 'not UTF-8 text', metadata: null, path: 'bad.f.js' }])
        const [, missing] = virtual(emptyState)(_parseModule('missing'))
        assertStructurallySame(missing, ['error', { message: 'file not found', metadata: null, path: 'missing' }])
        // Any other failure keeps the host's words: the file may be there.
        const [, directory] = virtualAt({ dir: {} })(_parseModule('dir'))
        assertStructurallySame(directory, ['error', { message: 'dir is not a regular file', metadata: null, path: 'dir' }])
        const [, unsupported] = partialRun(nodeCommands)({})(null)(_parseModule('main.f.js'))
        assertStructurallySame(unsupported, ['error', { message: 'operation not implemented: readWhole', metadata: null, path: 'main.f.js' }])
    },
    json: () => {
        const run = virtualAt({ 'data.json': [utf8('{"x":[1]}')], 'bad.json': [utf8('[')] })
        assertStructurallySame(run(_parseJson('data.json'))[1], ['ok', { x: [1] }])
        const [, invalid] = run(_parseJson('bad.json'))
        assertEq(invalid[0], 'error')
        if (invalid[0] === 'error') { assertEq(invalid[1].path, 'bad.json') }
    },
    root: () => {
        const run = virtual(emptyState)
        assertStructurallySame(run(_rootSource('main.f.js'))[1], ['ok', source])
        assertStructurallySame(run(_rootSource('data.json'))[1], ['ok', { id: 'data.json', path: 'data.json', json: true }])
        const [, missingHost] = partialRun(nodeCommands)({})(null)(_rootSource('main.f.js'))
        assertEq(missingHost[0], 'error')
        if (missingHost[0] === 'error') { assert(missingHost[1].message.startsWith('module resolution failed:')) }
    },
    // A JSON document imported as a module is its value under `default`.
    jsonModule: () => {
        assertStructurallySame(_jsonModule({ x: [1] }), ['{}', [[':', 'default', jsonValue({ x: [1] })]]])
        assertStructurallySame(jsonValue({ x: [1] }), ['{}', [[':', 'x', ['[]', [1]]]]])
    },
    // The root route: a `.json` root is its document's value and never runs
    // the loader; a module root is walked with the loaded `_Load`, and the
    // walked module passed through `finish`.
    program: () => {
        /** @type {_Load<readonly unknown[], readonly unknown[], never>} */
        const load = {
            json: value => ['json', value],
            select: module => module,
            module: ({ path }, imports) => ok(['module', path, imports]),
        }
        const run = virtualAt({
            'main.f.js': [utf8('import d from "./data.json" with { type: "json" }; export default d;')],
            'data.json': [utf8('{"x":[1]}')],
        })
        /** @type {(module: readonly unknown[]) => unknown} */
        const finish = module => ['finished', module]
        assertStructurallySame(run(_program(pureOk(load), finish)('main.f.js'))[1],
            ['ok', ['finished', ['module', 'main.f.js', [['json', { x: [1] }]]]]])
        assertStructurallySame(run(_program(pureOk(load), finish)('data.json'))[1], ['ok', jsonValue({ x: [1] })])
        // The loader runs for a module root alone.
        assertStructurallySame(run(_program(pureError('no loader'), finish)('data.json'))[1], ['ok', jsonValue({ x: [1] })])
        assertStructurallySame(run(_program(pureError('no loader'), finish)('main.f.js'))[1], ['error', 'no loader'])
    },
    // A program walked over the modules an earlier one completed reuses them
    // as they were: the module is the same object, and its file is not read
    // again, which a second file system that does not hold it shows.
    programOver: () => {
        /** @type {_Load<readonly unknown[], readonly unknown[], never>} */
        const load = {
            json: value => ['json', value],
            select: module => module,
            module: ({ path }, imports) => ok(['module', path, imports]),
        }
        /** @type {(module: readonly unknown[]) => readonly unknown[]} */
        const finish = module => module
        const over = _programOver(pureOk(load), finish)
        const shared = 'export default 1;'
        const first = assertOk(virtualAt({
            'a.f.js': [utf8('import s from "./s.f.js"; export default s;')],
            's.f.js': [utf8(shared)],
        })(over('a.f.js', null))[1])
        const [complete, a] = first
        assertStructurallySame(a, ['module', 'a.f.js', [['module', 's.f.js', []]]])
        // `s.f.js` is held, but empty: read again, it would export nothing
        const second = assertOk(virtualAt({
            'b.f.js': [utf8('import s from "./s.f.js"; export default [s];')],
            's.f.js': [utf8('')],
        })(over('b.f.js', complete))[1])
        const [after, b] = second
        /** The first import a walked module was completed over. @type {(module: unknown) => unknown} */
        const firstImport = module => /** @type {readonly (readonly unknown[])[]} */ (module)[2][0]
        assertEq(firstImport(b), firstImport(a))
        // a root already complete is answered as it was
        assertEq(assertOk(virtualAt({ 'a.f.js': [utf8('')] })(over('a.f.js', after))[1])[1], a)
        // a JSON root completes no module
        const json = assertOk(virtualAt({ 'd.json': [utf8('[1]')] })(over('d.json', after))[1])
        assertEq(json[0], after)
        assertStructurallySame(json[1], jsonValue([1]))
    },
    imports: () => {
        const run = virtual(emptyState)
        assertStructurallySame(run(_importSources(source)([]))[1], ['ok', []])
        assertStructurallySame(run(_importSources(source)([imported]))[1], ['ok', [{ id: 'dep.f.js', path: 'dep.f.js', json: false, name: 'default' }]])
        assertStructurallySame(run(_importSources(source)([
            { ...imported, name: null },
            { ...imported, name: 'answer' },
        ]))[1], ['ok', [
            { id: 'dep.f.js', path: 'dep.f.js', json: false, name: null },
            { id: 'dep.f.js', path: 'dep.f.js', json: false, name: 'answer' },
        ]])
        assertStructurallySame(run(_importSources(source)([{ ...imported, specifier: 'package' }]))[1], ['error', {
            message: 'unsupported import specifier "package": expected ./, ../, or /', metadata: null, path: 'main.f.js',
        }])
        assertEq(run(_importSources(source)([{ ...imported, specifier: './bad%ZZ' }]))[1][0], 'error')
        assertEq(run(_importSources(source)([{ ...imported, specifier: '../dep.f.js' }]))[1][0], 'ok')
        assertEq(run(_importSources(source)([{ ...imported, specifier: '/dep.f.js' }]))[1][0], 'ok')
    },
    walk: () => {
        /** @type {_Load<readonly unknown[], readonly unknown[], never>} */
        const load = {
            json: value => ['json', value],
            select: (module, name) => name === 'missing' ? undefined : module,
            module: ({ path }, imports) => ok([path, ...imports]),
        }
        const empty = /** @type {const} */ ({ complete: null, stack: null, latest: null })
        const run = virtualAt({ 'main.f.js': [utf8('export default 1;')] })
        const [complete, module] = assertOk(run(_walk(load)(source)(empty))[1])
        // Repeated imports reuse the module instance and the completed context.
        const [same, reused] = assertOk(run(_walk(load)(source)(complete))[1])
        assertEq(same, complete)
        assertEq(reused, module)
        // A diamond completes the shared module once, retaining import order
        // and admitting an empty import with its null selection.
        const [, diamond] = virtualAt({
            'main.f.js': [utf8('import left from "./left.f.js"; import right from "./right.f.js"; export default [left, right];')],
            'left.f.js': [utf8('import {} from "./dep.f.js"; export default 0;')],
            'right.f.js': [utf8('import shared from "./dep.f.js"; export default shared;')],
            'dep.f.js': [utf8('export default 1;')],
        })(_walk(load)(source)(empty))
        const [, diamondModule] = assertOk(diamond)
        assertStructurallySame(diamondModule, ['main.f.js', ['left.f.js', ['dep.f.js']], ['right.f.js', ['dep.f.js']]])
        const [, left, right] = diamondModule
        assert(left instanceof Array && right instanceof Array)
        assertEq(left[1], right[1])
        // An import attribute is checked even when the module was already loaded.
        assertStructurallySame(run(_walk(load)({ ...source, json: true })(complete))[1], ['error', {
            message: 'only a JSON module is imported with { type: "json" }', metadata: null, path: 'main.f.js',
        }])
        const [, cyclic] = virtualAt({
            'main.f.js': [utf8('import self from "./main.f.js"; export default self;')],
        })(_walk(load)(source)(empty))
        assertStructurallySame(cyclic, ['error', {
            message: 'circular dependency', metadata: null, path: 'main.f.js',
        }])
        // A missing selection is reported before a later import is attempted.
        const [, missing] = virtualAt({
            'main.f.js': [utf8('import { missing } from "./dep.f.js"; import later from "./absent.f.js"; export default missing;')],
            'dep.f.js': [utf8('export default 1;')],
        })(_walk(load)(source)(empty))
        assertStructurallySame(missing, ['error', {
            message: 'module has no missing export', metadata: null, path: 'dep.f.js',
        }])
    },
    attributes: () => {
        assertEq(_attributeError(source), null)
        assertEq(_attributeError({ ...source, path: 'data.json', json: true }), null)
        assertStructurallySame(_attributeError({ ...source, path: 'data.json' }), {
            message: 'a JSON module needs the import attribute with { type: "json" }', metadata: null, path: 'data.json',
        })
        assertStructurallySame(_attributeError({ ...source, json: true }), {
            message: 'only a JSON module is imported with { type: "json" }', metadata: null, path: 'main.f.js',
        })
        assertStructurallySame(_missingExport({ ...source, name: 'answer' }), {
            message: 'module has no answer export', metadata: null, path: 'main.f.js',
        })
    },
}
