/**
 * One run's dependency graph and content hashes, shared by every coverage job.
 * Unsupported nodes refuse reuse only for the directories that reach them.
 * @module
 * @import { NodeOp } from '../../../effects/node/types.ts'
 * @import { Effect, IoChannel } from '../../../effects/types.ts'
 * @import { Unknown } from '../../../media/json/types.ts'
 * @import { _Source } from '../../../compiler/source/types.ts'
 * @import { List } from '../../../types/list/types.ts'
 * @import { Vec } from '../../../types/bit_vec/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Manifest, Graph, _Node, _Directory } from './types.ts'
 * @import { _Closure } from './private.ts'
 */

import { assertNotNullish, assertOk } from '../../../asserts/module.f.js'
import { vecToCBase32 } from '../../../basen/cbase32/module.f.js'
import { _attributeError, _rootSource } from '../../../compiler/source/module.f.mjs'
import { computeSync, sha256 } from '../../../crypto/sha2/module.f.js'
import { dependencyImports, resolveDependencies } from '../../../deps/module.f.mjs'
import { isAuthored } from '../../../dev/module.f.mjs'
import { foldStep, ioError, mapStep, pure, pureError, pureOk, resultStep, step } from '../../../effects/module.f.js'
import { isNotFound, readWhole, readdir } from '../../../effects/node/module.f.mjs'
import { normalize, parent, under } from '../../../path/module.f.js'
import { fromU8List } from '../../../text/utf8/module.f.mjs'
import { u8ListMsb } from '../../../types/bit_vec/module.f.js'
import { equal, flatMap, sameItems } from '../../../types/list/module.f.js'
import { error, ok } from '../../../types/result/module.f.js'
import { cmp } from '../../../types/string/module.f.js'

const digest = computeSync(sha256)
/** @type {(a: string, b: string) => number} */
const compare = (a, b) => cmp(a)(b)
/** @type {(chunks: readonly Vec[]) => string} */
const hash = chunks => vecToCBase32(digest(chunks))
/** Decode bytes only for parsing or when differing chunk boundaries need comparison. @type {(chunks: readonly Vec[]) => List<number>} */
const bytes = flatMap(u8ListMsb)
/** @type {(message: string) => IoChannel} */
const problem = message => ioError({ code: 'ERR_COVERAGE_MANIFEST', message })
/** @type {<T>(values: readonly T[]) => readonly T[]} */
const unique = values => values.filter((value, index) => values.indexOf(value) === index)
/** @type {(root: string, path: string) => boolean} */
const inside = (root, path) => path === root || path.startsWith(root.endsWith('/') ? root : `${root}/`)

/** Package scopes between a source and the repository's required root scope. @type {(root: string, path: string) => readonly string[]} */
const scopes = (root, path) => {
    let directory = parent(path)
    /** @type {readonly string[]} */
    let paths = []
    while (directory !== root) {
        paths = [...paths, under(directory, 'package.json')]
        directory = parent(directory)
    }
    return paths
}

/** Retain failures as well as bytes so each path is read and hashed only once. @type {(graph: Graph, path: string) => Effect<NodeOp, Graph, never>} */
const read = (graph, path) => graph.files[path] !== undefined ? pureOk(graph)
    : resultStep(readWhole(path), result => pureOk({
        ...graph,
        files: { ...graph.files, [path]: result[0] === 'error' ? result : ok({ chunks: result[1], bytes: bytes(result[1]), hash: hash(result[1]) }) },
    }))

/** @type {(graph: Graph, source: _Source, result: Result<_Node, IoChannel>) => Graph} */
const recordNode = (graph, source, result) => ({ ...graph, nodes: { ...graph.nodes, [source.id]: result } })

/** Parse by physical path, resolve by module identity, and record before descent for cycles. @type {(source: _Source) => (graph: Graph) => Effect<NodeOp, Graph, never>} */
const visit = source => graph => {
    const path = normalize(source.path)
    // Import attributes belong to each edge, even when its node was visited.
    if (_attributeError(source) !== null || graph.nodes[source.id] !== undefined) { return pureOk(graph) }
    if (!inside(graph.root, path)) {
        return pureOk(recordNode(graph, source, error(problem(`coverage dependency is outside the repository: ${path}`))))
    }
    return step(read(graph, path), graph => {
        const file = assertNotNullish(graph.files[path])
        if (file[0] === 'error') { return pureOk(recordNode(graph, source, file)) }
        const parsed = graph.imports[path] ?? (() => {
            const text = source.json ? '' : fromU8List(file[1].bytes)
            if (text === null) { return error(problem(`${path}: not UTF-8 text`)) }
            const result = dependencyImports(source, text)
            return result[0] === 'error' ? error(problem(`${path}: ${result[1].message}`)) : result
        })()
        /** @type {Graph} */
        const recorded = { ...graph, imports: { ...graph.imports, [path]: parsed } }
        if (parsed[0] === 'error') { return pureOk(recordNode(recorded, source, parsed)) }
        return resultStep(resolveDependencies(source, parsed[1]), result => {
            if (result[0] === 'error') {
                return pureOk(recordNode(recorded, source, error(problem(`${path}: ${result[1].message}`))))
            }
            const entered = recordNode(recorded, source, ok({ source, imports: parsed[1], children: result[1] }))
            const scoped = foldStep(pureOk(scopes(graph.root, path)), entered, path => graph => read(graph, path))
            return step(scoped, graph => foldStep(pureOk(result[1]), graph, visit))
        })
    })
}

/** The shallow proof loader imports every immediate authored sibling. @type {(directory: string) => Effect<NodeOp, readonly string[], IoChannel>} */
const inventory = directory => mapStep(readdir(directory, {}), entries => entries
    .filter(({ name, isDirectory }) => !isDirectory && !name.startsWith('.') && isAuthored(name))
    .map(({ name }) => under(directory, name)).toSorted(compare))

/** @type {(directory: string) => (graph: Graph) => Effect<NodeOp, Graph, never>} */
const directoryGraph = directory => graph => {
    const selected = normalize(directory)
    if (graph.directories[selected] !== undefined) { return pureOk(graph) }
    /** @type {(result: Result<_Directory, IoChannel>) => Graph} */
    const recorded = result => ({ ...graph, directories: { ...graph.directories, [selected]: result } })
    if (!inside(graph.root, selected)) {
        return pureOk(recorded(error(problem(`coverage directory is outside the repository: ${directory}`))))
    }
    const planned = step(inventory(selected), files => mapStep(
        foldStep(pureOk(files), /** @type {_Directory['roots']} */ ([]), path => roots =>
            resultStep(_rootSource(path), result => result[0] === 'error'
                ? pureError(problem(`${path}: ${result[1].message}`))
                : pureOk([...roots, { path, source: result[1] }]))),
        roots => ({ files, roots })))
    return resultStep(planned, result => {
        const next = recorded(result)
        if (result[0] === 'error') { return pureOk(next) }
        return foldStep(pureOk(result[1].roots), next, ({ path, source }) => graph =>
            mapStep(visit(source)(graph), graph => {
                // A sibling alias is another inventory name for the same bytes.
                const file = graph.files[normalize(source.path)]
                return path === normalize(source.path) || file === undefined ? graph
                    : { ...graph, files: { ...graph.files, [path]: file } }
            }))
    })
}

/**
 * Snapshot all selected directories together, sharing source reads and hashes.
 * @type {(root: string, directories: readonly string[]) => Effect<NodeOp, Graph, IoChannel>}
 */
export const buildGraph = (root, directories) => {
    /** @type {Graph} */
    const initial = {
        root: normalize(root), files: {}, imports: {}, nodes: {}, directories: {},
    }
    const rootScope = read(initial, under(initial.root, 'package.json'))
    return step(rootScope, graph => foldStep(pureOk(directories), graph, directoryGraph))
}

/** Derive a directory's reachable closure without filesystem work. @type {(graph: Graph, directory: string) => Result<_Closure, IoChannel>} */
const closure = (graph, directory) => {
    const selected = normalize(directory)
    const record = graph.directories[selected]
    if (record === undefined) { return error(problem(`coverage directory was not included in the graph: ${directory}`)) }
    if (record[0] === 'error') { return record }
    /** @type {(source: _Source, state: _Closure) => Result<_Closure, IoChannel>} */
    const collect = (source, state) => {
        const mismatch = _attributeError(source)
        if (mismatch !== null) { return error(problem(`${source.path}: ${mismatch.message}`)) }
        if (state.seen.includes(source.id)) { return ok(state) }
        const node = assertNotNullish(graph.nodes[source.id])
        if (node[0] === 'error') { return node }
        /** @type {_Closure} */
        const entered = {
            seen: [...state.seen, source.id], nodes: [...state.nodes, node[1]],
            required: [...state.required, normalize(source.path)],
            scopes: [...state.scopes, ...scopes(graph.root, normalize(source.path))],
        }
        return node[1].children.reduce((state, source) => state[0] === 'error' ? state : collect(source, state[1]),
            /** @type {Result<_Closure, IoChannel>} */ (ok(entered)))
    }
    const reached = record[1].roots.reduce((state, { source }) => state[0] === 'error' ? state : collect(source, state[1]),
        /** @type {Result<_Closure, IoChannel>} */ (ok({ seen: [], nodes: [], required: [under(graph.root, 'package.json'), ...record[1].files], scopes: [] })))
    if (reached[0] === 'error') { return reached }
    const value = reached[1]
    for (const path of unique([...value.required, ...value.scopes])) {
        const file = assertNotNullish(graph.files[path])
        if (file[0] === 'error' && (value.required.includes(path) || !isNotFound(file[1]))) { return file }
    }
    return ok({ ...value, required: unique(value.required), scopes: unique(value.scopes) })
}

/** Materialize content hashes and module relationships from the shared graph. @type {(graph: Graph, directory: string, targets: readonly string[], contract: Unknown) => Effect<NodeOp, Manifest, IoChannel>} */
export const graphManifest = (graph, directory, targets, contract) => {
    const reached = closure(graph, directory)
    if (reached[0] === 'error') { return pure(reached) }
    const sources = reached[1]
    const record = assertOk(assertNotNullish(graph.directories[normalize(directory)]))
    const paths = unique([...sources.required, ...sources.scopes]).toSorted(compare)
    const prefix = graph.root.endsWith('/') ? graph.root : `${graph.root}/`
    return pureOk({
        version: 2, directory: normalize(directory).slice(prefix.length) || '.',
        targets: targets.toSorted(compare), contract,
        files: Object.fromEntries(paths.flatMap(path => {
            const file = assertNotNullish(graph.files[path])
            return file[0] === 'error' ? [] : [[path.slice(prefix.length), file[1].hash]]
        })),
        // Closure order gives opaque host identities portable local names.
        // Hashes alone cannot distinguish equal-byte aliases that share an
        // instance from aliases that load different module instances.
        roots: Object.fromEntries(record.roots.map(({ path, source }) =>
            [path.slice(prefix.length), sources.seen.indexOf(source.id)])),
        modules: sources.nodes.map(({ source, children }) => ({
            path: normalize(source.path).slice(prefix.length), json: source.json,
            imports: children.map(source => sources.seen.indexOf(source.id)),
        })),
    })
}

/** @type {(a: _Source, b: _Source) => boolean} */
const sameSource = (a, b) => a.id === b.id && a.path === b.path && a.json === b.json
/**
 * Recheck bytes, inventories, package presence and resolved identities. No
 * source is hashed or parsed again; a changed graph is simply uncacheable.
 * @type {(graph: Graph, directory: string) => Effect<NodeOp, boolean, IoChannel>}
 */
export const validateGraph = (graph, directory) => {
    const reached = closure(graph, directory)
    if (reached[0] === 'error') { return pureOk(false) }
    const record = assertOk(assertNotNullish(graph.directories[normalize(directory)]))
    const paths = unique([...reached[1].required, ...reached[1].scopes])
    const checked = resultStep(inventory(normalize(directory)), result =>
        pureOk(result[0] === 'ok' && sameItems(record.files)(result[1])))
    const files = step(checked, valid => foldStep(pureOk(paths), valid, path => valid => !valid ? pureOk(false)
        : resultStep(readWhole(path), result => {
            const before = assertNotNullish(graph.files[path])
            return pureOk(before[0] === 'error'
                ? result[0] === 'error' && isNotFound(result[1])
                : result[0] === 'ok' && (sameItems(before[1].chunks)(result[1])
                    || sameItems(before[1].bytes)(bytes(result[1]))))
        })))
    const roots = step(files, valid => foldStep(pureOk(record.roots), valid, ({ path, source }) => valid => !valid ? pureOk(false)
        : resultStep(_rootSource(path), result => pureOk(result[0] === 'ok' && sameSource(source, result[1])))))
    return step(roots, valid => foldStep(pureOk(reached[1].nodes), valid, node => valid => !valid ? pureOk(false)
        : resultStep(resolveDependencies(node.source, node.imports), result =>
            pureOk(result[0] === 'ok' && equal(a => b => sameSource(a, b))(node.children)(result[1])))))
}

/** Build one directory for callers that do not share a run's graph. @type {(root: string, directory: string, targets: readonly string[], contract: Unknown) => Effect<NodeOp, Manifest, IoChannel>} */
export const manifest = (root, directory, targets, contract) =>
    step(buildGraph(root, [directory]), graph => graphManifest(graph, directory, targets, contract))
