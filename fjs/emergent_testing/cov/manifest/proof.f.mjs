/** @import { Dir } from '../../../effects/node/virtual/types.ts' */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { vecToCBase32 } from '../../../basen/cbase32/module.f.mjs'
import { computeSync, sha256 } from '../../../crypto/sha2/module.f.mjs'
import { partialRun } from '../../../effects/mock/module.f.mjs'
import { ioError, nodeCommands } from '../../../effects/node/module.f.mjs'
import { emptyState, virtualAt, virtualOperationMap } from '../../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../../text/module.f.mjs'
import { stringToU8List } from '../../../text/utf8/module.f.mjs'
import { u8ListToMaxVecChunksMsb, vec8 } from '../../../types/bit_vec/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.js'
import { buildGraph, graphManifest, manifest, validateGraph } from './module.f.mjs'

const digest = computeSync(sha256)
/** @type {(text: string) => string} */
const hash = text => vecToCBase32(digest(u8ListToMaxVecChunksMsb(stringToU8List(text))))
const contract = /** @type {const} */ ({ node: 'test-runtime', args: ['--test'] })

const implementation = 'import value from "../shared.f.mjs"; export default value;'
const proofSource = 'import value from "./module.f.js"; import data from "../data.json" with { type: "json" }; export const proof = () => value;'
const shared = 'import main from "./unit/module.f.js"; export default main;'
const json = '{"value":1}'
const packageJson = '{"type":"module"}'

/** @type {Dir} */
const root = {
    repo: {
        'package.json': [utf8(packageJson)],
        unit: {
            'proof.f.mjs': [utf8(proofSource)],
            'module.f.js': [utf8(implementation)],
            'helper.f.mjs': [utf8('export default 3;')],
            '.hidden.f.mjs': [utf8('invalid hidden source')],
            'ordinary.mjs': [utf8('invalid unrelated source')],
            nested: { 'proof.f.mjs': [utf8('invalid descendant source')] },
        },
        'shared.f.mjs': [utf8(shared)],
        'data.json': [utf8(json)],
    },
}

/** @type {(files: Dir, directory?: string, targets?: readonly string[]) => import('../../../types/result/types.ts').Result<import('./types.ts').Manifest, import('../../../effects/types.ts').IoChannel>} */
const execute = (files, directory = '/repo/unit', targets = ['module.f.js']) => {
    const repo = files.repo
    const configured = typeof repo === 'object' && !(repo instanceof Array)
        ? { ...files, repo: { 'package.json': [utf8(packageJson)], ...repo } } : files
    const [, result] = virtualAt(configured)(manifest('/repo', directory, targets, contract))
    return result
}

/** Record filesystem and resolver work in the virtual runner's unused output. */
const traced = partialRun(nodeCommands)({
    ...virtualOperationMap,
    readWhole: path => state => {
        const [next, result] = virtualOperationMap.readWhole(path)(state)
        return [{ ...next, stdout: `${next.stdout}read ${path}\n` }, result]
    },
    readdir: (path, options) => state => {
        const [next, result] = virtualOperationMap.readdir(path, options)(state)
        return [{ ...next, stdout: `${next.stdout}directory ${path}\n` }, result]
    },
    resolveFileModule: (name, parent) => state => {
        const [next, result] = virtualOperationMap.resolveFileModule(name, parent)(state)
        return [{ ...next, stdout: `${next.stdout}resolve ${name} from ${parent ?? '<root>'}\n` }, result]
    },
})

/** @type {(trace: string, entry: string) => number} */
const count = (trace, entry) => trace.split('\n').filter(line => line === entry).length

const sharedEntry = 'import value from "../shared/module.f.js"; export default value;'
const sharedModule = 'import value from "./leaf.f.mjs"; export default value;'
const leaf = 'export default 1;'
const sharedTree = {
    'package.json': [utf8(packageJson)],
    a: { 'module.f.js': [utf8(sharedEntry)] },
    b: { 'module.f.js': [utf8(sharedEntry)] },
    shared: { 'module.f.js': [utf8(sharedModule)], 'leaf.f.mjs': [utf8(leaf)] },
}

export const proof = {
    sharedGraphReadsAndDerivesOnce: () => {
        const [state, result] = traced({ ...emptyState, root: { repo: sharedTree } })(
            buildGraph('/repo', ['/repo/a', '/repo/b'], { framework: '/repo/shared/module.f.js' }))
        const graph = assertOk(result)
        for (const path of ['/repo/package.json', '/repo/a/module.f.js', '/repo/b/module.f.js',
            '/repo/shared/module.f.js', '/repo/shared/leaf.f.mjs']) {
            assertEq(count(state.stdout, `read ${path}`), 1)
        }
        // A shared module's parsed import is resolved once even though both
        // selected directories reach it. Each source is read for that parse
        // and its hash together, rather than read again by dependencies().
        assertEq(count(state.stdout, 'resolve ./leaf.f.mjs from /repo/shared/module.f.js'), 1)
        assertEq(graph.opaqueFiles.framework, hash(sharedModule))
        const pure = partialRun(nodeCommands)({})
        const [, first] = pure(null)(graphManifest(graph, '/repo/a', ['module.f.js'], contract))
        const [, second] = pure(null)(graphManifest(graph, '/repo/b', ['module.f.js'], contract))
        assertStructurallySame(assertOk(first).files, {
            'a/module.f.js': hash(sharedEntry),
            'package.json': hash(packageJson),
            'shared/leaf.f.mjs': hash(leaf),
            'shared/module.f.js': hash(sharedModule),
        })
        assertEq(assertOk(second).files['shared/module.f.js'], assertOk(first).files['shared/module.f.js'])
        assertEq(assertOk(second).files['b/module.f.js'], hash(sharedEntry))
        assert(assertOk(second).files['a/module.f.js'] === undefined)
        assertError(pure(null)(graphManifest(graph, '/repo/not-selected', [], contract))[1])
        assertEq(assertOk(pure(null)(validateGraph(graph, '/repo/not-selected'))[1]), false)
    },
    sharedGraphValidationUsesSnapshots: () => {
        const [state, result] = traced({ ...emptyState, root: { repo: sharedTree } })(buildGraph('/repo', ['/repo/a', '/repo/b']))
        const graph = assertOk(result)
        const [validated, valid] = traced({ ...state, stdout: '' })(validateGraph(graph, '/repo/a'))
        assertEq(assertOk(valid), true)
        for (const path of ['/repo/package.json', '/repo/a/module.f.js', '/repo/shared/module.f.js', '/repo/shared/leaf.f.mjs']) {
            assertEq(count(validated.stdout, `read ${path}`), 1)
        }
        assertEq(count(validated.stdout, 'read /repo/b/module.f.js'), 0)
        assertEq(count(validated.stdout, 'resolve ./leaf.f.mjs from /repo/shared/module.f.js'), 1)
        // Validation compares the saved bytes and stored resolver edges. A
        // changed, syntactically invalid source is a stale snapshot, not a
        // new parse failure, and never becomes a new graph in this run.
        for (const changed of [
            { ...sharedTree, a: { 'module.f.js': [utf8('not valid syntax')] } },
            { ...sharedTree, shared: { ...sharedTree.shared, 'leaf.f.mjs': [utf8('export default 2;')] } },
            { ...sharedTree, a: { ...sharedTree.a, 'split.proof.f.js': [utf8('export const proof = () => 1;')] } },
            { ...sharedTree, a: { ...sharedTree.a, 'package.json': [utf8(packageJson)] } },
            { ...sharedTree, shared: { ...sharedTree.shared, 'package.json': [utf8(packageJson)] } },
            { ...sharedTree, 'package.json': [utf8('{"type":"commonjs"}')] },
            { ...sharedTree, a: {} },
        ]) {
            assertEq(assertOk(virtualAt({ repo: changed })(validateGraph(graph, '/repo/a'))[1]), false)
        }
        // A sibling in another selected directory and ignored files do not
        // change what this directory's shallow proof runner loads.
        const unrelated = {
            ...sharedTree,
            a: { ...sharedTree.a, '.hidden.f.js': [utf8('invalid hidden source')], 'ordinary.mjs': [utf8('unrelated')] },
            b: { ...sharedTree.b, 'split.proof.f.js': [utf8('export const proof = () => 1;')] },
        }
        assertEq(assertOk(virtualAt({ repo: unrelated })(validateGraph(graph, '/repo/a'))[1]), true)
        assertEq(assertOk(virtualAt({ repo: unrelated })(validateGraph(graph, '/repo/b'))[1]), false)
        // The saved graph still answers the original manifest after a failed
        // revalidation; callers cannot accidentally cache the edited inputs.
        assertEq(assertOk(virtualAt({})(graphManifest(graph, '/repo/a', ['module.f.js'], contract))[1])
            .files['shared/leaf.f.mjs'], hash(leaf))
    },
    sharedGraphValidationIgnoresReadChunkBoundaries: () => {
        const source = 'export default "😀";'
        const whole = { repo: {
            'package.json': [utf8(packageJson)], unit: { 'module.f.js': [utf8(source)] },
        }, 'framework.mjs': [utf8('framework bytes')] }
        const chunks = { ...whole,
            repo: { ...whole.repo, unit: { 'module.f.js': [
                utf8('export default "'), vec8(0xf0n), vec8(0x9fn), vec8(0x98n), vec8(0x80n), utf8('";'),
            ] } },
            'framework.mjs': [utf8('frame'), utf8('work bytes')],
        }
        // Filesystem reads may split a Unicode scalar between chunks. Those
        // boundaries are transport details, independent of the source bytes.
        for (const [before, after] of [[whole, chunks], [chunks, whole]]) {
            const [, result] = virtualAt(before)(buildGraph('/repo', ['/repo/unit'], { runtime: '/framework.mjs' }))
            const graph = assertOk(result)
            assertEq(graph.opaqueFiles.runtime, hash('framework bytes'))
            assertEq(assertOk(virtualAt(after)(validateGraph(graph, '/repo/unit'))[1]), true)
            assertEq(assertOk(virtualAt({})(graphManifest(graph, '/repo/unit', ['module.f.js'], contract))[1])
                .files['unit/module.f.js'], hash(source))
        }
        const [, result] = virtualAt(whole)(buildGraph('/repo', ['/repo/unit']))
        const changed = { ...chunks, repo: { ...chunks.repo, unit: { 'module.f.js': [
            utf8('export default "'), vec8(0xf0n), vec8(0x9fn), vec8(0x98n), vec8(0x81n), utf8('";'),
        ] } } }
        assertEq(assertOk(virtualAt(changed)(validateGraph(assertOk(result), '/repo/unit'))[1]), false)
    },
    sharedGraphErrorsStayWithTheirDirectories: () => {
        const files = { repo: {
            ...sharedTree,
            bad: {
                'module.f.js': [utf8('export default process.env.VALUE;')],
                'split.proof.f.js': [utf8('export const proof = () => 1;')],
            },
            affected: { 'module.f.js': [utf8('import bad from "../bad/module.f.js"; import good from "../shared/module.f.js"; export default good;')] },
        } }
        const [, result] = virtualAt(files)(buildGraph('/repo', ['/repo/a', '/repo/bad', '/repo/affected', '/repo/missing']))
        const graph = assertOk(result)
        assertOk(virtualAt(files)(graphManifest(graph, '/repo/a', ['module.f.js'], contract))[1])
        for (const directory of ['/repo/bad', '/repo/affected', '/repo/missing']) {
            assertError(virtualAt(files)(graphManifest(graph, directory, ['module.f.js'], contract))[1])
            assertEq(assertOk(virtualAt(files)(validateGraph(graph, directory))[1]), false)
        }
        const [, missingPackage] = virtualAt({ repo: { a: sharedTree.a } })(buildGraph('/repo', ['/repo/a']))
        assertError(virtualAt({})(graphManifest(assertOk(missingPackage), '/repo/a', ['module.f.js'], contract))[1])
        const denied = partialRun(nodeCommands)({
            ...virtualOperationMap,
            readWhole: path => path === '/repo/bad/module.f.js'
                ? state => [state, error(ioError({ code: 'EACCES', message: 'one source denied' }))]
                : virtualOperationMap.readWhole(path),
        })
        const [, inaccessible] = denied({ ...emptyState, root: files })(buildGraph('/repo', ['/repo/a', '/repo/bad']))
        const partial = assertOk(inaccessible)
        assertOk(virtualAt({})(graphManifest(partial, '/repo/a', ['module.f.js'], contract))[1])
        assertError(virtualAt({})(graphManifest(partial, '/repo/bad', ['module.f.js'], contract))[1])
    },
    sharedGraphDetectsResolverAndScopeChanges: () => {
        const files = { repo: { ...sharedTree, a: { ...sharedTree.a, 'package.json': [utf8(packageJson)] } } }
        const [, built] = virtualAt(files)(buildGraph('/repo', ['/repo/a']))
        const graph = assertOk(built)
        const changedResolver = partialRun(nodeCommands)({
            ...virtualOperationMap,
            resolveFileModule: (name, parent) => state => {
                const [next, result] = virtualOperationMap.resolveFileModule(name, parent)(state)
                return [next, result[0] === 'ok' ? ok({ ...result[1], id: `${result[1].id}?changed` }) : result]
            },
        })
        assertEq(assertOk(changedResolver({ ...emptyState, root: files })(validateGraph(graph, '/repo/a'))[1]), false)
        assertEq(assertOk(virtualAt({ repo: sharedTree })(validateGraph(graph, '/repo/a'))[1]), false)
        const denied = partialRun(nodeCommands)({
            ...virtualOperationMap,
            readWhole: () => state => [state, error(ioError({ code: 'EACCES', message: 'snapshot read denied' }))],
        })
        assertEq(assertOk(denied({ ...emptyState, root: files })(validateGraph(graph, '/repo/a'))[1]), false)
        const unresolved = partialRun(nodeCommands)({
            ...virtualOperationMap,
            resolveFileModule: () => state => [state, error(ioError({ message: 'resolution unavailable' }))],
        })
        assertEq(assertOk(unresolved({ ...emptyState, root: files })(validateGraph(graph, '/repo/a'))[1]), false)
    },
    sharedGraphRetainsAliasesAndOpaqueInputs: () => {
        const contents = 'export default 0;'
        const files = { repo: { 'package.json': [utf8(packageJson)], unit: {
            'module.f.js': [utf8(contents)], 'alias.proof.f.mjs': [utf8(contents)],
        } }, 'framework.mjs': [utf8('framework bytes')] }
        const aliases = partialRun(nodeCommands)({
            ...virtualOperationMap,
            resolveFileModule: (name, parent) => virtualOperationMap.resolveFileModule(
                name.endsWith('/alias.proof.f.mjs') ? '/repo/unit/module.f.js' : name, parent),
        })
        const [, result] = aliases({ ...emptyState, root: files })(buildGraph('/repo', ['/repo/unit'], { framework: '/framework.mjs' }))
        const graph = assertOk(result)
        assertEq(graph.opaqueFiles.framework, hash('framework bytes'))
        const value = assertOk(virtualAt({})(graphManifest(graph, '/repo/unit', ['module.f.js'], contract))[1])
        assertEq(value.files['unit/alias.proof.f.mjs'], hash(contents))
        assertEq(value.files['unit/module.f.js'], hash(contents))
        assertEq(assertOk(aliases({ ...emptyState, root: files })(validateGraph(graph, '/repo/unit'))[1]), true)
        assertEq(assertOk(virtualAt(files)(validateGraph(graph, '/repo/unit'))[1]), false)
        const changedAlias = { ...files, repo: { ...files.repo, unit: {
            ...files.repo.unit, 'alias.proof.f.mjs': [utf8('changed alias bytes')],
        } } }
        assertEq(assertOk(aliases({ ...emptyState, root: changedAlias })(validateGraph(graph, '/repo/unit'))[1]), false)
        const changedFramework = { ...files, 'framework.mjs': [utf8('changed framework bytes')] }
        assertEq(assertOk(aliases({ ...emptyState, root: changedFramework })(validateGraph(graph, '/repo/unit'))[1]), false)
        assertError(virtualAt(files)(buildGraph('/repo', ['/repo/unit'], { missing: '/missing-framework.mjs' }))[1])
    },
    sharedGraphReusesPhysicalSourceAcrossIdentities: () => {
        const contents = 'export default 0;'
        const files = { repo: { 'package.json': [utf8(packageJson)], unit: {
            'module.f.js': [utf8(contents)], 'alias.proof.f.mjs': [utf8(contents)],
        } } }
        const aliases = partialRun(nodeCommands)({
            ...virtualOperationMap,
            resolveFileModule: (name, parent) => state => {
                const alias = name.endsWith('/alias.proof.f.mjs')
                const [next, result] = virtualOperationMap.resolveFileModule(alias ? '/repo/unit/module.f.js' : name, parent)(state)
                return [next, result[0] === 'ok' && alias ? ok({ ...result[1], id: `${result[1].id}#alias` }) : result]
            },
        })
        const [, built] = aliases({ ...emptyState, root: files })(buildGraph('/repo', ['/repo/unit', '/repo/./unit']))
        const graph = assertOk(built)
        const value = assertOk(virtualAt({})(graphManifest(graph, '/repo/unit', ['module.f.js'], contract))[1])
        assertEq(value.files['unit/module.f.js'], hash(contents))
        assertEq(value.files['unit/alias.proof.f.mjs'], hash(contents))
        assertEq(assertOk(aliases({ ...emptyState, root: files })(validateGraph(graph, '/repo/unit'))[1]), true)
    },
    transitive: () => {
        const value = assertOk(execute(root))
        assertStructurallySame(value, {
            version: 1,
            directory: 'unit',
            targets: ['module.f.js'],
            contract,
            files: {
                'data.json': hash(json),
                'package.json': hash(packageJson),
                'shared.f.mjs': hash(shared),
                'unit/helper.f.mjs': hash('export default 3;'),
                'unit/module.f.js': hash(implementation),
                'unit/proof.f.mjs': hash(proofSource),
            },
        })
        assertStructurallySame(Object.keys(value.files), ['data.json', 'package.json', 'shared.f.mjs', 'unit/helper.f.mjs', 'unit/module.f.js', 'unit/proof.f.mjs'])
    },
    deterministic: () => {
        const source = 'export default 1;'
        const first = { repo: { unit: { 'proof.f.js': [utf8(source)], 'module.f.js': [utf8(source)], 'demo.f.mjs': [utf8(source)] } } }
        const second = { repo: { unit: { 'demo.f.mjs': [utf8(source)], 'module.f.js': [utf8(source)], 'proof.f.js': [utf8(source)] } } }
        assertStructurallySame(assertOk(execute(first, '/repo/./unit', ['module.f.js', 'demo.f.mjs'])),
            assertOk(execute(second, '/repo/unit', ['demo.f.mjs', 'module.f.js'])))
    },
    changedBytesAndProofInventory: () => {
        const before = assertOk(execute({ repo: { unit: { 'module.f.js': [utf8('export default 1;')] } } }))
        const edited = assertOk(execute({ repo: { unit: { 'module.f.js': [utf8('export default 2;')] } } }))
        assert(before.files['unit/module.f.js'] !== edited.files['unit/module.f.js'])
        const added = assertOk(execute({ repo: { unit: {
            'module.f.js': [utf8('export default 1;')],
            'split.proof.f.js': [utf8('export const proof = () => 1;')],
        } } }))
        assertEq(Object.keys(added.files).length, 3)
        assert(added.files['unit/split.proof.f.js'] !== undefined)
    },
    canonicalSiblingAliasesRetainInventory: () => {
        const contents = 'export default 0;'
        const run = partialRun(nodeCommands)({
            ...virtualOperationMap,
            resolveFileModule: (name, parent) => virtualOperationMap.resolveFileModule(
                name.endsWith('/alias.proof.f.mjs') ? '/repo/unit/module.f.js' : name, parent),
        })
        const [, result] = run({ ...emptyState, root: { repo: { 'package.json': [utf8(packageJson)], unit: {
            'module.f.js': [utf8(contents)],
            'alias.proof.f.mjs': [utf8(contents)],
        } } } })(manifest('/repo', '/repo/unit', ['module.f.js'], contract))
        assertStructurallySame(assertOk(result).files, {
            'package.json': hash(packageJson),
            'unit/alias.proof.f.mjs': hash(contents),
            'unit/module.f.js': hash(contents),
        })
    },
    roots: () => {
        const [, value] = virtualAt({ 'package.json': [utf8(packageJson)], 'module.f.js': [utf8('export default 0;')] })(manifest('/', '/', ['module.f.js'], contract))
        assertEq(assertOk(value).directory, '.')
        assertEq(assertOk(value).files['module.f.js'], hash('export default 0;'))
        const [, windows] = virtualAt({ repo: { 'package.json': [utf8(packageJson)], 'module.f.js': [utf8('export default 0;')] } })(manifest('C:/repo', 'C:/repo', ['module.f.js'], contract))
        assertEq(assertOk(windows).directory, '.')
        assertStructurallySame(assertOk(execute({ repo: { unit: {} } })).files, { 'package.json': hash(packageJson) })
    },
    packageScopes: () => {
        const source = 'export default 0;'
        const bare = { repo: { unit: { 'module.f.js': [utf8(source)] } } }
        const initial = assertOk(execute(bare))
        const rootChanged = assertOk(execute({ repo: { ...bare.repo, 'package.json': [utf8('{"type":"commonjs"}')] } }))
        assert(initial.files['package.json'] !== rootChanged.files['package.json'])
        const nested = assertOk(execute({ repo: { unit: { ...bare.repo.unit, 'package.json': [utf8(packageJson)] } } }))
        assertEq(nested.files['unit/package.json'], hash(packageJson))
        assert(initial.files['unit/package.json'] === undefined)
        const nestedChanged = assertOk(execute({ repo: { unit: { ...bare.repo.unit, 'package.json': [utf8('{"type":"commonjs"}')] } } }))
        assert(nested.files['unit/package.json'] !== nestedChanged.files['unit/package.json'])
        assertStructurallySame(assertOk(execute(bare)), initial)
        const dependencyScope = assertOk(execute({ repo: {
            unit: { 'module.f.js': [utf8('import value from "../lib/deep/module.f.js"; export default value;')] },
            lib: { 'package.json': [utf8(packageJson)], deep: { 'module.f.js': [utf8(source)] } },
        } }))
        assertEq(dependencyScope.files['lib/package.json'], hash(packageJson))
        const [, missingRoot] = virtualAt(bare)(manifest('/repo', '/repo/unit', ['module.f.js'], contract))
        assertError(missingRoot)
    },
    packageReadErrorsAreNotAbsence: () => {
        const run = partialRun(nodeCommands)({
            ...virtualOperationMap,
            readWhole: path => path === '/repo/unit/package.json'
                ? state => [state, error(ioError({ code: 'EACCES', message: 'denied package scope' }))]
                : virtualOperationMap.readWhole(path),
        })
        const [, result] = run({ ...emptyState, root })(manifest('/repo', '/repo/unit', ['module.f.js'], contract))
        assertError(result)
    },
    dynamicInputsAreUncacheable: () => {
        for (const expression of ['import("./helper.f.mjs")', 'import.meta.url', 'require("./helper.f.mjs")', 'process.env.VALUE', 'globalThis.value']) {
            assertError(execute({ repo: { unit: {
                'module.f.mjs': [utf8(`export const proof = () => ${expression};`)],
                'helper.f.mjs': [utf8('export default 1;')],
            } } }))
        }
    },
    outside: () => {
        const outside = assertError(execute(root, '/repo-other'))
        assert(outside[0] === 'ioError' && outside[1].message.includes('outside the repository'))
        const imported = assertError(execute({ repo: { unit: {
            'module.f.js': [utf8('import value from "../../outside.f.js"; export default value;')],
        } }, 'outside.f.js': [utf8('export default 0;')] }))
        assert(imported[0] === 'ioError' && imported[1].message.includes('outside the repository'))
    },
    refused: () => {
        for (const source of [
            'not valid syntax',
            'import value from "./missing.f.js"; export default value;',
            'import value from "package"; export default value;',
            'import a from "../data.json" with {type:"json"}; import b from "../data.json"; export default b;',
        ]) {
            assertError(execute({ repo: { unit: { 'module.f.js': [utf8(source)] }, 'data.json': [utf8('{}')] } }))
        }
        assertError(execute({}))
        assertError(execute({ repo: { unit: { 'module.f.js': [vec8(0xffn)] } } }))
        const denied = partialRun(nodeCommands)({
            ...virtualOperationMap,
            readWhole: () => state => [state, error(ioError({ code: 'EACCES', message: 'denied' }))],
        })
        const [, result] = denied({ ...emptyState, root })(manifest('/repo', '/repo/unit', ['module.f.js'], contract))
        assertError(result)
        const unresolved = partialRun(nodeCommands)({
            ...virtualOperationMap,
            resolveFileModule: () => state => [state, error(ioError({ message: 'unresolved' }))],
        })
        const [, resolution] = unresolved({ ...emptyState, root })(manifest('/repo', '/repo/unit', ['module.f.js'], contract))
        assertError(resolution)
    },
}
