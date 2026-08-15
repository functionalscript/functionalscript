/**
 * @import { Vec } from '../types/bit_vec/types.ts'
 */

import { compile } from './module.f.mjs'
import { virtual, emptyState } from '../effects/node/virtual/module.f.mjs'
import { utf8, utf8ToString } from '../text/module.f.mjs'
import { assert, assertEq } from '../asserts/module.f.mjs'

/** @type {(root: typeof emptyState.root, path: string) => string} */
const readOutput = (root, path) => {
    const file = root[path]
    if (!Array.isArray(file) || file.length === 0) { throw `${path} is not a file` }
    return utf8ToString(file[0])
}

export const proof = {
    tooFewArgs: {
        noArgs: () => {
            const [state, code] = virtual(emptyState)(compile([]))
            assertEq(code, 1)
            assert(state.stderr.includes('Requires 2 or more arguments'), state.stderr)
        },
        oneArg: () => {
            const [state, code] = virtual(emptyState)(compile(['input.f.js']))
            assertEq(code, 1)
            assert(state.stderr.includes('Requires 2 or more arguments'), state.stderr)
        },
    },
    success: () => {
        const root = { 'input.f.js': [utf8('export default 42')] }
        const [state, code] = virtual({ ...emptyState, root })(compile(['input.f.js', 'output.f.js']))
        assertEq(code, 0)
        const content = readOutput(state.root, 'output.f.js')
        assertEq(content, 'export default 42')
    },
    jsonOutput: () => {
        const root = { 'input.f.js': [utf8('export default 42')] }
        const [state, code] = virtual({ ...emptyState, root })(compile(['input.f.js', 'output.json']))
        assertEq(code, 0)
        const content = readOutput(state.root, 'output.json')
        assertEq(content, '42')
    },
    fileNotFound: () => {
        const [state, code] = virtual(emptyState)(compile(['missing.f.js', 'output.f.js']))
        assertEq(code, 1)
        assert(state.stderr.includes('file not found'), state.stderr)
        assertEq(state.root['output.f.js'], undefined)
    },
    parseError: () => {
        const root = { 'bad.f.js': [utf8('export default @')] }
        const [state, code] = virtual({ ...emptyState, root })(compile(['bad.f.js', 'output.f.js']))
        assertEq(code, 1)
        assert(state.stderr !== '', 'expected error output')
        assertEq(state.root['output.f.js'], undefined)
    },
}
