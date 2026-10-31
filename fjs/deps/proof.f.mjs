/**
 * @import { NodeProgramOptions } from '../effects/node/types.ts'
 * @import { Dir } from '../effects/node/virtual/types.ts'
 */

import { assert, assertEq } from '../asserts/module.f.js'
import { exitCode, nodeCommands } from '../effects/node/module.f.mjs'
import { ioError } from '../effects/module.f.mjs'
import { partialRun } from '../effects/mock/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, virtualAt, virtualOperationMap } from '../effects/node/virtual/module.f.mjs'
import { utf8 } from '../text/module.f.mjs'
import { vec8 } from '../types/bit_vec/module.f.mjs'
import { error } from '../types/result/module.f.js'
import { main } from './module.f.mjs'

/**
 * @param {Dir} root
 * @param {Partial<NodeProgramOptions>} [options]
 */
const execute = (root, options = {}) => virtualAt(root)(main({ ...defaultNodeProgramOptions, ...options }))

/** Only implementation entry points are analyzed; other source names may be invalid. */
const sources = /** @type {const} */ ({
    'module.f.js': [utf8('export default notDefined;')],
    'proof.f.mjs': [utf8('not valid syntax')],
    nested: {
        'module.f.mjs': [utf8('throw "must not execute";')],
        deeper: {
            'module.f.js': [utf8('import missing from "./absent.f.mjs"; export default missing;')],
        },
        'demo.f.mjs': [utf8('not valid syntax')],
        'helper.f.js': [utf8('not valid syntax')],
        'proof.f.js': [vec8(0xffn)],
        'notmodule.f.js': [utf8('not valid syntax')],
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
    sourceDiscovery: () => {
        const [state, result] = execute(sources)
        assertEq(exitCode(result), 0, state.stderr)
        assertEq(state.stdout, 'AST: 3 parsed, 0 failed, 3 total\n')
        assertEq(state.stderr, '')
    },
    invocationDirectory: () => {
        const [state, result] = execute(sources, { env: { INIT_CWD: 'nested' } })
        assertEq(exitCode(result), 0, state.stderr)
        assertEq(state.stdout, 'AST: 2 parsed, 0 failed, 2 total\n')
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
