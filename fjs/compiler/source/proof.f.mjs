/** Shared reader behavior stays independent of module execution. */

import { _attributeError, _importSources, _missingExport, _parseJson, _parseModule, _rootSource, parse } from './module.f.mjs'
import { virtual, emptyState } from '../../effects/node/virtual/module.f.mjs'
import { partialRun } from '../../effects/mock/module.f.mjs'
import { nodeCommands } from '../../effects/node/module.f.mjs'
import { toVec } from '../../types/uint8array/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

const source = { id: 'main.f.js', path: 'main.f.js', json: false }
const imported = { specifier: './dep.f.js', json: false, name: 'default' }

export const proof = {
    module: () => {
        const text = 'export default 7;'
        const run = virtual({ ...emptyState, root: { 'main.f.js': [utf8(text)] } })
        assertStructurallySame(run(_parseModule('main.f.js'))[1], parse('main.f.js')(text))
        assertEq(parse('main.f.js')('not a module')[0], 'error')
        const [, invalid] = virtual({ ...emptyState, root: { 'bad.f.js': [toVec(new Uint8Array([255]))] } })(_parseModule('bad.f.js'))
        assertStructurallySame(invalid, ['error', { message: 'not UTF-8 text', metadata: null, path: 'bad.f.js' }])
        const [, missing] = virtual(emptyState)(_parseModule('missing'))
        assertStructurallySame(missing, ['error', { message: 'file not found', metadata: null, path: 'missing' }])
        // Any other failure keeps the host's words: the file may be there.
        const [, directory] = virtual({ ...emptyState, root: { dir: {} } })(_parseModule('dir'))
        assertStructurallySame(directory, ['error', { message: 'dir is not a regular file', metadata: null, path: 'dir' }])
        const [, unsupported] = partialRun(nodeCommands)({})(null)(_parseModule('main.f.js'))
        assertStructurallySame(unsupported, ['error', { message: 'operation not implemented: readWhole', metadata: null, path: 'main.f.js' }])
    },
    json: () => {
        const run = virtual({ ...emptyState, root: { 'data.json': [utf8('{"x":[1]}')], 'bad.json': [utf8('[')] } })
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
    imports: () => {
        const run = virtual(emptyState)
        assertStructurallySame(run(_importSources(source)([]))[1], ['ok', []])
        assertStructurallySame(run(_importSources(source)([imported]))[1], ['ok', [{ id: 'dep.f.js', path: 'dep.f.js', json: false, name: 'default' }]])
        assertStructurallySame(run(_importSources(source)([{ ...imported, specifier: 'package' }]))[1], ['error', {
            message: 'unsupported import specifier "package": expected ./, ../, or /', metadata: null, path: 'main.f.js',
        }])
        assertEq(run(_importSources(source)([{ ...imported, specifier: './bad%ZZ' }]))[1][0], 'error')
        assertEq(run(_importSources(source)([{ ...imported, specifier: '../dep.f.js' }]))[1][0], 'ok')
        assertEq(run(_importSources(source)([{ ...imported, specifier: '/dep.f.js' }]))[1][0], 'ok')
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
