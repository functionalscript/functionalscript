/** @import { Dir } from '../../../effects/node/virtual/types.ts' */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { vecToCBase32 } from '../../../basen/cbase32/module.f.mjs'
import { computeSync, sha256 } from '../../../crypto/sha2/module.f.mjs'
import { partialRun } from '../../../effects/mock/module.f.mjs'
import { ioError, nodeCommands } from '../../../effects/node/module.f.mjs'
import { emptyState, virtualAt, virtualOperationMap } from '../../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../../text/module.f.mjs'
import { stringToU8List } from '../../../text/utf8/module.f.mjs'
import { u8ListToMaxVecChunksMsb } from '../../../types/bit_vec/module.f.mjs'
import { error } from '../../../types/result/module.f.js'
import { manifest } from './module.f.mjs'

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

export const proof = {
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
