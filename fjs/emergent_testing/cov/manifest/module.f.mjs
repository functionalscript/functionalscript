/**
 * Content hashes of the sources one isolated coverage process loads.
 * Unsupported dependency graphs are refused so callers can run uncached.
 *
 * @module
 * @import { NodeOp } from '../../../effects/node/types.ts'
 * @import { Effect, IoChannel } from '../../../effects/types.ts'
 * @import { Unknown } from '../../../media/json/types.ts'
 * @import { _Source } from '../../../compiler/source/types.ts'
 * @import { List } from '../../../types/list/types.ts'
 * @import { Manifest } from './types.ts'
 * @import { _State } from './private.ts'
 */

import { vecToCBase32 } from '../../../basen/cbase32/module.f.mjs'
import { _attributeError, _rootSource } from '../../../compiler/source/module.f.mjs'
import { computeSync, sha256 } from '../../../crypto/sha2/module.f.mjs'
import { dependencies } from '../../../deps/module.f.mjs'
import { isAuthored } from '../../../dev/module.f.mjs'
import { catchStep, foldStep, history, historyStep, mapStep, pureError, pureOk, refuse, step } from '../../../effects/module.f.mjs'
import { isNotFound, readWholeBytes, readdir } from '../../../effects/node/module.f.mjs'
import { normalize, parent, under } from '../../../path/module.f.js'
import { u8ListToMaxVecChunksMsb } from '../../../types/bit_vec/module.f.mjs'
import { definedEntries } from '../../../types/object/module.f.mjs'
import { cmp } from '../../../types/string/module.f.js'
import { validate } from './ast/module.f.mjs'

const digest = computeSync(sha256)
/** @type {(a: string, b: string) => number} */
const compare = (a, b) => cmp(a)(b)
const rejected = refuse('ERR_COVERAGE_MANIFEST')
/** @type {(bytes: List<number>) => string} */
const hash = bytes => vecToCBase32(digest(u8ListToMaxVecChunksMsb(bytes)))

/**
 * Every immediate authored sibling is a root: the shallow proof loader imports
 * those sources even when they do not export a proof themselves.
 *
 * @type {(root: string, directory: string, targets: readonly string[], contract: Unknown) => Effect<NodeOp, Manifest, IoChannel>}
 */
export const manifest = (root, directory, targets, contract) => {
    const base = normalize(root)
    const prefix = base.endsWith('/') ? base : `${base}/`
    const selected = normalize(directory)
    if (selected !== base && !selected.startsWith(prefix)) {
        return rejected(`coverage directory is outside the repository: ${directory}`)
    }
    /** The nearest package scope can change how Node interprets an authored .js file.
     * @type {(path: string, state: _State) => Effect<NodeOp, _State, IoChannel>}
     */
    const packageScopes = (path, state) => {
        /** @type {readonly string[]} */
        let directories = []
        let directory = parent(path)
        while (directory !== base) {
            directories = [...directories, directory]
            directory = parent(directory)
        }
        return foldStep(pureOk(directories), state, directory => state => {
            if (state.scopes.includes(directory)) { return pureOk(state) }
            const path = under(directory, 'package.json')
            const bytes = catchStep(readWholeBytes(path), error => isNotFound(error) ? pureOk(null) : pureError(error))
            return mapStep(bytes, bytes => ({
                ...state,
                scopes: [...state.scopes, directory],
                files: bytes === null ? state.files : { ...state.files, [path.slice(prefix.length)]: hash(bytes) },
            }))
        })
    }
    /** @type {(source: _Source) => (state: _State) => Effect<NodeOp, _State, IoChannel>} */
    const visit = source => state => {
        const path = normalize(source.path)
        if (!path.startsWith(prefix)) { return rejected(`coverage dependency is outside the repository: ${path}`) }
        if (state.seen.includes(source.id) && _attributeError(source) === null) { return pureOk(state) }
        const read = history(readWholeBytes(path))
        const children = historyStep(read, () => catchStep(dependencies(source, validate), error => rejected(`${path}: ${error.message}`)))
        const entered = mapStep(children, ([children, bytes]) => ({
            children,
            state: {
                seen: [...state.seen, source.id],
                scopes: state.scopes,
                files: { ...state.files, [path.slice(prefix.length)]: hash(bytes) },
            },
        }))
        const scoped = historyStep(history(entered), ({ state }) => packageScopes(path, state))
        return step(scoped, ([state, { children }]) => foldStep(pureOk(children), state, visit))
    }
    const discovered = mapStep(readdir(selected, {}), entries => entries
        .filter(({ name, isDirectory }) => !isDirectory && !name.startsWith('.') && isAuthored(name))
        .map(({ name }) => under(selected, name))
        .toSorted(compare))
    // Without a repository package boundary Node can inherit a package scope
    // outside the repository, which this manifest cannot certify.
    const rootPackage = mapStep(readWholeBytes(under(base, 'package.json')), bytes => ({
        seen: [], scopes: [base], files: { 'package.json': hash(bytes) },
    }))
    const planned = historyStep(history(rootPackage), () => discovered)
    const loaded = step(planned, ([files, initial]) => foldStep(pureOk(files), /** @type {_State} */ (initial), path => state => {
        const source = catchStep(_rootSource(path), error => rejected(`${path}: ${error.message}`))
        return step(source, source => {
            const visited = visit(source)(state)
            // Distinct sibling names can resolve to one canonical source. The
            // shallow runner still loads both names, so retain their inventory.
            return normalize(path) === normalize(source.path) ? visited : step(visited, state =>
                mapStep(readWholeBytes(path), bytes => ({
                    ...state,
                    files: { ...state.files, [normalize(path).slice(prefix.length)]: hash(bytes) },
                })))
        })
    }))
    return mapStep(loaded, ({ files }) => ({
        version: 1,
        directory: selected.slice(prefix.length) || '.',
        targets: targets.toSorted(compare),
        files: Object.fromEntries(definedEntries(files).toSorted(([a], [b]) => compare(a, b))),
        contract,
    }))
}
