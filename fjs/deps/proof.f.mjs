/**
 * @import { NodeProgramOptions } from '../effects/node/types.ts'
 * @import { Dir } from '../effects/node/virtual/types.ts'
 */

import { assert, assertEq, assertOk, assertError, assertStructurallySame } from '../asserts/module.f.js'
import { exitCode, nodeCommands } from '../effects/node/module.f.mjs'
import { ioError } from '../effects/module.f.js'
import { partialRun } from '../effects/mock/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, virtual, virtualAt, virtualOperationMap } from '../effects/node/virtual/module.f.mjs'
import { utf8 } from '../text/module.f.mjs'
import { vec8 } from '../types/bit_vec/module.f.js'
import { error } from '../types/result/module.f.js'
import { readSource } from '../compiler/source/module.f.mjs'
import { dependencies, dependenciesFromSource, dependencyImports, resolveDependencies, main, _relativeGraph } from './module.f.mjs'

/**
 * @param {Dir} root
 * @param {Partial<NodeProgramOptions>} [options]
 */
const execute = (root, options = {}) => virtualAt(root)(main({ ...defaultNodeProgramOptions, ...options }))

/** Dependency text needs resolution alone: a read request would be refused by this runner. */
const resolveOnly = partialRun(nodeCommands)({ resolveFileModule: virtualOperationMap.resolveFileModule })

/** Every authored source is discovered; hidden, third-party and other suffixes stay excluded. */
const sources = /** @type {const} */ ({
    'module.f.js': [utf8('export default notDefined;')],
    'proof.f.mjs': [utf8('import value from "./module.f.js"; export const proof = () => value;')],
    nested: {
        'module.f.mjs': [utf8('throw "must not execute";')],
        deeper: {
            'absent.f.mjs': [utf8('export default 0;')],
            'module.f.js': [utf8('import missing from "./absent.f.mjs"; export default missing;')],
        },
        'demo.f.mjs': [utf8('export default unknownDemo;')],
        'helper.f.js': [utf8('export default unknownHelper;')],
        'proof.f.js': [utf8('import helper from "./helper.f.js"; export const proof = () => helper;')],
        'notmodule.f.js': [utf8('export default standalone;')],
        'module.f.mjs.bak': [utf8('not valid syntax')],
    },
    '.hidden.f.mjs': [utf8('not valid syntax')],
    '.hidden': { 'module.f.mjs': [utf8('not valid syntax')] },
    node_modules: { 'module.f.mjs': [utf8('not valid syntax')] },
    target: { 'module.f.mjs': [utf8('not valid syntax')] },
    'ordinary.mjs': [utf8('not valid syntax')],
    'types.ts': [utf8('not valid syntax')],
})

export const proof = /** @type {const} */ ({
    parsedImportsCanBeResolvedAgain: () => {
        const source = { id: '/pkg/module.f.mjs', path: '/diagnostics/module.f.mjs', json: false }
        const imports = assertOk(dependencyImports(source,
            'import value from "./helper%2ef.js"; import data from "../data.json" with {type:"json"}; export default value;'))
        assertStructurallySame(imports, [
            { specifier: './helper%2ef.js', json: false, name: null },
            { specifier: '../data.json', json: true, name: null },
        ])
        const [, original] = resolveOnly(emptyState)(resolveDependencies(source, imports))
        assertStructurallySame(assertOk(original), [
            { id: '/pkg/helper.f.js', path: '/pkg/helper.f.js', json: false, name: null },
            { id: '/data.json', path: '/data.json', json: true, name: null },
        ])
        const [, relocated] = resolveOnly(emptyState)(resolveDependencies({ ...source, id: '/elsewhere/pkg/module.f.mjs' }, imports))
        assertStructurallySame(assertOk(relocated), [
            { id: '/elsewhere/pkg/helper.f.js', path: '/elsewhere/pkg/helper.f.js', json: false, name: null },
            { id: '/elsewhere/data.json', path: '/elsewhere/data.json', json: true, name: null },
        ])
    },
    dependencyTextDoesNotReadFiles: () => {
        const source = { id: '/pkg/module.f.mjs', path: '/diagnostics/module.f.mjs', json: false }
        const [, result] = resolveOnly(emptyState)(dependenciesFromSource(source,
            'import value from "./helper.f.js"; import data from "../data.json" with {type:"json"}; export default unknown;'))
        assertStructurallySame(assertOk(result), [
            { id: '/pkg/helper.f.js', path: '/pkg/helper.f.js', json: false, name: null },
            { id: '/data.json', path: '/data.json', json: true, name: null },
        ])
        const [, noImports] = resolveOnly(emptyState)(dependenciesFromSource(source, 'export default unknown;'))
        assertStructurallySame(assertOk(noImports), [])
    },
    dependencyTextValidatesSyntax: () => {
        const source = /** @type {const} */ ({ id: '/module.f.mjs', path: '/diagnostics/module.f.mjs', json: false })
        const [, malformed] = resolveOnly(emptyState)(dependenciesFromSource(source, 'export default ;'))
        const failure = assertError(malformed)
        assertEq(failure.metadata?.path, source.path)
        assertEq(failure.message, 'unexpected token')
    },
    dependencyTextPreservesAttributeChecks: () => {
        const data = /** @type {const} */ ({ id: '/data.json', path: '/data.json', json: true })
        const [, json] = resolveOnly(emptyState)(dependenciesFromSource(data, 'neither JavaScript nor JSON'))
        assertStructurallySame(assertOk(json), [])
        const [, jsonFile] = resolveOnly(emptyState)(dependencies(data))
        assertStructurallySame(assertOk(jsonFile), [])
        for (const source of [{ ...data, json: false }, { id: '/module.f.mjs', path: '/module.f.mjs', json: true }]) {
            const expected = source.json
                ? 'only a JSON module is imported with { type: "json" }'
                : 'a JSON module needs the import attribute with { type: "json" }'
            const [, result] = resolveOnly(emptyState)(dependenciesFromSource(source, 'export default ;'))
            assertEq(assertError(result).message, expected)
            const [, file] = resolveOnly(emptyState)(dependencies(source))
            assertEq(assertError(file).message, expected)
        }
        for (const [attribute, expected] of [['wrong:"json"', 'unknown import attribute'], ['type:"wrong"', 'unknown import type']]) {
            const [, result] = resolveOnly(emptyState)(dependenciesFromSource(
                { id: '/module.f.mjs', path: '/module.f.mjs', json: false },
                `import data from "./data.json" with {${attribute}}; export default data;`))
            assertEq(assertError(result).message, expected)
        }
    },
    dependencyTextPreservesImportFailures: () => {
        const source = { id: '/module.f.mjs', path: '/diagnostics/module.f.mjs', json: false }
        for (const [specifier, expected] of [
            ['package', 'unsupported import specifier "package": expected ./, ../, or /'],
            ['./bad%zz.f.js', 'invalid module specifier: ./bad%zz.f.js'],
        ]) {
            const [, result] = resolveOnly(emptyState)(dependenciesFromSource(source,
                `import value from "${specifier}"; export default value;`))
            assertStructurallySame(assertError(result), { path: source.path, metadata: null, message: expected })
        }
        const denied = partialRun(nodeCommands)({
            resolveFileModule: () => state => [state, error(ioError({ code: 'EACCES', message: 'cannot resolve dependency' }))],
        })
        const [, result] = denied(emptyState)(dependenciesFromSource(source,
            'import value from "./helper.f.js"; export default value;'))
        assertStructurallySame(assertError(result), {
            path: source.path, metadata: null, message: 'module resolution failed: cannot resolve dependency',
        })
    },
    dynamicImportsDoNotAddStaticDependencies: () => {
        const files = /** @type {const} */ ({ 'module.f.mjs': [utf8('export const proof = () => import("./helper.f.mjs");')] })
        const [state, result] = execute(files)
        assertEq(exitCode(result), 0, state.stderr)
        const [, written] = virtual(state)(readSource('_deps.json'))
        assertStructurallySame(JSON.parse(assertOk(written)), { 'module.f.mjs': [] })
    },
    relativeGraphPaths: () => {
        assertEq(JSON.stringify(_relativeGraph('/repo/pkg', {
            '/repo/pkg/module.f.js': ['/repo/pkg/sub/helper.f.js', '/repo/pkg-other/shared.f.js'],
            '/repo/pkg/sub/helper.f.js': [],
            '/repo/pkg-other/shared.f.js': ['/repo/pkg/module.f.js'],
        })), JSON.stringify({
            'module.f.js': ['sub/helper.f.js', '../pkg-other/shared.f.js'],
            'sub/helper.f.js': [],
            '../pkg-other/shared.f.js': ['module.f.js'],
        }))
        assertEq(JSON.stringify(_relativeGraph('C:/repo', {
            'C:/repo/module.f.js': ['D:/shared.f.js'],
            'D:/shared.f.js': [],
        })), JSON.stringify({ 'module.f.js': ['D:/shared.f.js'], 'D:/shared.f.js': [] }))
        assertEq(JSON.stringify(_relativeGraph('/repo', { '/repo': [], '/': [] })), JSON.stringify({ '.': [], '..': [] }))
    },
    canonicalHostPathsBecomeRelative: () => {
        const run = partialRun(nodeCommands)({
            ...virtualOperationMap,
            resolveFileModule: (name, parent) => virtualOperationMap.resolveFileModule(parent === null ? `/${name}` : name, parent),
        })
        const [state, result] = run({ ...emptyState, root: {
            repo: { 'module.f.js': [utf8('import value from "../repo-other/helper.f.js"; export default value;')] },
            'repo-other': { 'helper.f.js': [utf8('export default missing;')] },
        } })(main({ ...defaultNodeProgramOptions, env: { INIT_CWD: 'repo' } }))
        assertEq(exitCode(result), 0, state.stderr)
        const [, written] = virtual(state)(readSource('repo/_deps.json'))
        assertEq(assertOk(written), `${JSON.stringify({
            'module.f.js': ['../repo-other/helper.f.js'],
            '../repo-other/helper.f.js': [],
        }, null, 2)}\n`)
    },
    graphOutput: () => {
        const [state, result] = execute({
            'module.f.js': [utf8('import { a, b } from "./shared.f.mjs"; import c from "./branch.f.mjs"; import {} from "./shared.f.mjs"; export default missing;')],
            'shared.f.mjs': [utf8('import main from "./module.f.js"; export default new Missing();')],
            'branch.f.mjs': [utf8('import shared from "./shared.f.mjs"; import data from "./data.json" with {type:"json"}; export default 0;')],
            'data.json': [utf8('{}')],
            '_deps.json': [utf8('stale')],
        })
        assertEq(exitCode(result), 0, state.stderr)
        const [, written] = virtual(state)(readSource('_deps.json'))
        assertStructurallySame(JSON.parse(assertOk(written)), {
            'module.f.js': ['shared.f.mjs', 'branch.f.mjs'],
            'shared.f.mjs': ['module.f.js'],
            'branch.f.mjs': ['shared.f.mjs', 'data.json'],
            'data.json': [],
        })
        assertEq(state.stdout, 'AST: 4 parsed, 0 failed, 4 total\n')
    },
    dependenciesOutsideEntrySubtree: () => {
        const [state, result] = execute({
            inside: { 'module.f.mjs': [utf8('import value from "../outside.f.mjs"; export default value;')] },
            'outside.f.mjs': [utf8('export default unknown;')],
        }, { env: { INIT_CWD: 'inside' } })
        assertEq(exitCode(result), 0, state.stderr)
        const [, written] = virtual(state)(readSource('inside/_deps.json'))
        assertEq(assertOk(written), `${JSON.stringify({
            'module.f.mjs': ['../outside.f.mjs'],
            '../outside.f.mjs': [],
        }, null, 2)}\n`)
    },
    importFailuresDoNotPublishPartialGraphs: () => {
        for (const source of [
            'import value from "./missing.f.js"; export default value;',
            'import value from "package"; export default value;',
            'import value from "./data.json"; export default value;',
            'import first from "./data.json" with {type:"json"}; import second from "./data.json"; export default second;',
            'import value from "./data.json" with {wrong:"json"}; export default value;',
            'import value from "./data.json" with {type:"wrong"}; export default value;',
        ]) {
            const [state, result] = execute({
                'module.f.js': [utf8(source)],
                'data.json': [utf8('{}')],
                '_deps.json': [utf8('previous graph')],
            })
            assertEq(exitCode(result), 1)
            assert(state.stderr.includes('error:'), state.stderr)
            const [, written] = virtual(state)(readSource('_deps.json'))
            assertEq(assertOk(written), 'previous graph')
        }
    },
    fileWriteFailure: () => {
        const run = partialRun(nodeCommands)({
            ...virtualOperationMap,
            writeFile: () => state => [state, error(ioError({ code: 'EACCES', message: 'access denied' }))],
        })
        const [state, result] = run(emptyState)(main(defaultNodeProgramOptions))
        assertEq(exitCode(result), 1)
        assert(state.stderr.includes('access denied'), state.stderr)
    },
    sourceDiscovery: () => {
        const [state, result] = execute(sources)
        assertEq(exitCode(result), 0, state.stderr)
        assertEq(state.stdout, 'AST: 9 parsed, 0 failed, 9 total\n')
        assertEq(state.stderr, '')
        const [, written] = virtual(state)(readSource('_deps.json'))
        const graph = JSON.parse(assertOk(written))
        assertEq(JSON.stringify(graph['proof.f.mjs']), '["module.f.js"]')
        assertEq(JSON.stringify(graph['nested/proof.f.js']), '["nested/helper.f.js"]')
        assertEq(JSON.stringify(graph['nested/demo.f.mjs']), '[]')
        assertEq(JSON.stringify(graph['nested/notmodule.f.js']), '[]')
    },
    invocationDirectory: () => {
        const [state, result] = execute(sources, { env: { INIT_CWD: 'nested' } })
        assertEq(exitCode(result), 0, state.stderr)
        assertEq(state.stdout, 'AST: 7 parsed, 0 failed, 7 total\n')
        const [, written] = virtual(state)(readSource('nested/_deps.json'))
        assert(assertOk(written).includes('module.f.mjs'))
        assert(!assertOk(written).includes('nested/'))
        const [, absent] = virtual(state)(readSource('_deps.json'))
        assertError(absent)
    },
    forOfSyntaxDoesNotRequireCompilationOrExecution: () => {
        const [state, result] = execute({
            'module.f.mjs': [utf8('for(const item of notDefined){throw "must not execute";}export default 0;')],
            nested: { 'module.f.js': [utf8('export default ()=>{for(let [key,value] of missing){continue;}return 0;};')] },
            imported: { 'absent.f.mjs': [utf8('export default 0;')], 'module.f.mjs': [utf8('import {of} from "./absent.f.mjs";export default ()=>{for(const {value} of of){return value;}return undefined;};')] },
        })
        assertEq(exitCode(result), 0, state.stderr)
        assertEq(state.stdout, 'AST: 4 parsed, 0 failed, 4 total\n')
        assertEq(state.stderr, '')
    },
    patternDefaultsDoNotResolveOrExecuteInitializers: () => {
        const [state, result] = execute({
            'module.f.mjs': [utf8('const { value = missing() } = {}; export default value;')],
            nested: { 'module.f.js': [utf8('export default ({ source: [value = null.x] = [] } = {}) => value;')] },
        })
        assertEq(exitCode(result), 0, state.stderr)
        assertEq(state.stdout, 'AST: 2 parsed, 0 failed, 2 total\n')
        assertEq(state.stderr, '')
    },
    constructorsDoNotRequireResolutionOrExecution: () => {
        const [state, result] = execute({
            'module.f.mjs': [utf8('export default new Missing(null.x);')],
            nested: { 'module.f.js': [utf8('const value=new absent.Constructor(...unresolved);export default value;')] },
            imported: { 'absent.f.js': [utf8('export default 0;')], 'module.f.mjs': [utf8('import Constructor from "./absent.f.js";export default new Constructor(missing());')] },
        })
        assertEq(exitCode(result), 0, state.stderr)
        assertEq(state.stdout, 'AST: 4 parsed, 0 failed, 4 total\n')
        assertEq(state.stderr, '')
    },
    numericObjectKeysDoNotExecuteTheirValues: () => {
        const [state, result] = execute({
            'module.f.mjs': [utf8('export default { 0x70: unknown(), 0b11: null.x };')],
            nested: { 'absent.f.js': [utf8('export default 0;')], 'module.f.js': [utf8('import value from "./absent.f.js"; const { 0: picked = missing() } = value; export default picked;')] },
        })
        assertEq(exitCode(result), 0, state.stderr)
        assertEq(state.stdout, 'AST: 3 parsed, 0 failed, 3 total\n')
        assertEq(state.stderr, '')
    },
    singleQuotedEscapesDecodeImportPathsWithoutExecution: () => {
        const [state, result] = execute({
            'module.f.mjs': [utf8("export default {'\\x61': unknown('\\v')};")],
            nested: { 'missing.f.js': [utf8('export default 0;')], 'module.f.js': [utf8("import value from './missing\\x2ef\\x2ejs'; export default [value,'\\x41'];")] },
        })
        assertEq(exitCode(result), 0, state.stderr)
        assertEq(state.stdout, 'AST: 3 parsed, 0 failed, 3 total\n')
        assertEq(state.stderr, '')
    },
    omittedLetInitializersNeedNoResolutionOrExecution: () => {
        const [state, result] = execute({
            'module.f.mjs': [utf8('let value;export default missing(value);')],
            nested: { 'module.f.js': [utf8('export default ()=>{let value;return value;};')] },
            loop: { 'module.f.mjs': [utf8('for(let value;unknown(value);value=missing){}export default 0;')] },
        })
        assertEq(exitCode(result), 0, state.stderr)
        assertEq(state.stdout, 'AST: 3 parsed, 0 failed, 3 total\n')
        assertEq(state.stderr, '')
    },
    proofDependenciesAllowImplicitFunctionEnds: () => {
        const [state, result] = execute({
            'module.f.js': [utf8('export default 0;')],
            'proof.f.mjs': [utf8('import value from "./module.f.js"; export const proof=()=>{value();};')],
        })
        assertEq(exitCode(result), 0, state.stderr)
        const [, written] = virtual(state)(readSource('_deps.json'))
        assertStructurallySame(JSON.parse(assertOk(written)), {
            'module.f.js': [],
            'proof.f.mjs': ['module.f.js'],
        })
    },
    prohibitedNulEscapesDoNotPublishGraphs: () => {
        for (const source of ["export default '\\0';", "export default `\\0`;"]) {
            const [state, result] = execute({
                'module.f.js': [utf8('export default 1;')],
                'proof.f.mjs': [utf8(source)],
                '_deps.json': [utf8('previous graph')],
            })
            assertEq(exitCode(result), 1)
            assert(state.stderr.includes('proof.f.mjs'), state.stderr)
            const [, written] = virtual(state)(readSource('_deps.json'))
            assertEq(assertOk(written), 'previous graph')
        }
    },
    malformedProofPreservesPreviousGraph: () => {
        const [state, result] = execute({
            'module.f.js': [utf8('export default 1;')],
            'proof.f.mjs': [utf8('export default ;')],
            '_deps.json': [utf8('previous graph')],
        })
        assertEq(exitCode(result), 1)
        assertEq(state.stdout, 'AST: 1 parsed, 1 failed, 2 total\n')
        assert(state.stderr.includes('proof.f.mjs:1:16 - error: unexpected token'), state.stderr)
        const [, written] = virtual(state)(readSource('_deps.json'))
        assertEq(assertOk(written), 'previous graph')
    },
    failuresContinue: () => {
        const [state, result] = execute({
            invalid: { 'module.f.mjs': [utf8('export default ;')] },
            malformed: { 'module.f.js': [vec8(0xffn)] },
            valid: { 'module.f.js': [utf8('export default 3;')] },
        })
        assertEq(exitCode(result), 1)
        assertEq(state.stdout, 'AST: 1 parsed, 2 failed, 3 total\n')
        assert(state.stderr.includes('invalid/module.f.mjs:1:16 - error: unexpected token'), state.stderr)
        assert(state.stderr.includes('malformed/module.f.js - error: not UTF-8 text'), state.stderr)
    },
    emptyTree: () => {
        const [state, result] = execute({})
        assertEq(exitCode(result), 0)
        assertEq(state.stdout, 'AST: 0 parsed, 0 failed, 0 total\n')
    },
    noArguments: () => {
        for (const args of [['file.f.js'], ['.', 'graph.data.js']]) {
            const [state, result] = execute(sources, { args })
            assertEq(exitCode(result), 1)
            assertEq(state.stdout, '')
            assertEq(state.stderr, 'Usage: fjs deps\n')
        }
    },
    discoveryFailure: () => {
        const [state, result] = execute(sources, { env: { INIT_CWD: 'absent' } })
        assertEq(exitCode(result), 1)
        assertEq(state.stdout, '')
        assert(state.stderr !== '')
    },
    entryResolutionFailure: () => {
        const run = partialRun(nodeCommands)({
            ...virtualOperationMap,
            resolveFileModule: () => state => [state, error(ioError({ code: 'EACCES', message: 'cannot resolve entry' }))],
        })
        const [state, result] = run({ ...emptyState, root: { 'module.f.js': [utf8('export default 1;')] } })(
            main(defaultNodeProgramOptions))
        assertEq(exitCode(result), 1)
        assertEq(state.stdout, 'AST: 0 parsed, 1 failed, 1 total\n')
        assert(state.stderr.includes('cannot resolve entry'), state.stderr)
    },
    unreadableFile: () => {
        const run = partialRun(nodeCommands)({
            ...virtualOperationMap,
            readWhole: () => state => [state, error(ioError({ code: 'EACCES', message: 'access denied' }))],
        })
        const [state, result] = run({ ...emptyState, root: { 'module.f.mjs': [utf8('export default 1;')] } })(
            main(defaultNodeProgramOptions))
        assertEq(exitCode(result), 1)
        assertEq(state.stdout, 'AST: 0 parsed, 1 failed, 1 total\n')
        assert(state.stderr.includes('module.f.mjs - error: access denied'), state.stderr)
    },
    outputFailure: () => {
        const run = partialRun(nodeCommands)({
            ...virtualOperationMap,
            write: () => state => [state, error(/** @type {const} */ (['notImplemented', 'write']))],
        })
        const [, result] = run(emptyState)(main(defaultNodeProgramOptions))
        assertEq(exitCode(result), 1)
    },
})
