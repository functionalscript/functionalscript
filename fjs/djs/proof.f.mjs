/**
 * @import { Unknown } from './types.ts'
 */

import { compile } from './module.f.mjs'
import { transpile } from './transpiler/module.f.mjs'
import { stringify } from './serializer/module.f.mjs'
import { virtual, emptyState } from '../effects/node/virtual/module.f.mjs'
import { utf8, utf8ToString } from '../text/module.f.mjs'
import { fromEntries, isObject, sort } from '../types/object/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.mjs'

/** @type {(root: typeof emptyState.root, path: string) => string} */
const readOutput = (root, path) => {
    const file = root[path]
    if (!Array.isArray(file) || file.length === 0) { throw `${path} is not a file` }
    return utf8ToString(file[0])
}

/** @type {(source: string) => (outputFileName: string) => string} */
const compileSource = source => outputFileName => {
    const root = { 'input.f.js': [utf8(source)] }
    const [state, code] = virtual({ ...emptyState, root })(compile(['input.f.js', outputFileName]))
    assertEq(code, 0, state.stderr)
    return readOutput(state.root, outputFileName)
}

const { getPrototypeOf, prototype: objectPrototype } = Object

/** The value every `protoKey` test below denotes. */
const protoValue = fromEntries([['__proto__', { a: 42 }]])

const sharedArray = [1, 2]

/**
 * Values the module emitter must be able to write as source that evaluates
 * back to them. It covers every leaf type, both containers, the shared values
 * that become a `const`, and the `__proto__` key in both positions — the key
 * whose obvious spelling evaluates to something else entirely.
 *
 * @type {readonly Unknown[]}
 */
const roundTripCorpus = [
    null,
    true,
    false,
    undefined,
    0,
    -1.5,
    42n,
    'a"b\n\\',
    [],
    {},
    [1, [2, [3, []]]],
    { a: 1, 'b c': [true, undefined, 3n], d: {} },
    [sharedArray, sharedArray],
    { a: 'dup', b: 'dup' },
    protoValue,
    fromEntries([['__proto__', 3]]),
    [protoValue, protoValue],
    { a: protoValue },
]

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
    // serialize → evaluate → structurally the same, one test per corpus value.
    // The emitter is only correct if its output is an input denoting the value
    // it was given, which no assertion on the text alone can state.
    roundTrip: roundTripCorpus.map(value => () => {
        const source = stringify(sort)(value)
        const root = { 'input.f.js': [utf8(source)] }
        const [, result] = virtual({ ...emptyState, root })(transpile('input.f.js'))
        assert(result[0] === 'ok', result[1])
        assertStructurallySame(result[1], value, source)
    }),
    // The `__proto__` key end to end: one value, two output languages, and one
    // spelling of the key in each (#2480).
    protoKey: {
        // The module output uses the computed form, which is also the only
        // input spelling — so the emitter's output is an input that means the
        // same value, and compiling it again is the identity.
        moduleRoundTrip: () => {
            const source = 'export default {["__proto__"]:{"a":42}}'
            const output = compileSource(source)('output.f.js')
            assertEq(output, source)
            assertEq(compileSource(output)('output.f.js'), source)
        },
        // The JSON output keeps the plain key: the computed form is a
        // JavaScript spelling that no JSON parser accepts.
        jsonOutput: () => {
            assertEq(
                compileSource('export default {["__proto__"]:{"a":42}}')('output.json'),
                '{"__proto__":{"a":42}}')
        },
        // The documented exception to "JSON is a subset of FunctionalScript":
        // `fjs compile` reads every input as FunctionalScript, so a JSON
        // document carrying a `__proto__` key is rejected as input even though
        // it is what the compiler *writes* for that value.
        jsonDocumentRejected: () => {
            const root = { 'input.json': [utf8('{"__proto__":{"a":42}}')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(['input.json', 'output.json']))
            assertEq(code, 1)
            assert(state.stderr.includes('__proto__ requires the computed key form'), state.stderr)
            assertEq(state.root['output.json'], undefined)
        },
        // The statement behind the textual assertions: the property is an
        // ordinary own property and the prototype is untouched. A textual test
        // alone would also pass for a spelling that merely looks right.
        value: () => {
            const root = { 'input.f.js': [utf8('export default {["__proto__"]:{"a":42}}')] }
            const [, result] = virtual({ ...emptyState, root })(transpile('input.f.js'))
            assert(result[0] === 'ok', result[1])
            const value = result[1]
            assert(isObject(value), value)
            assertStructurallySame(value, protoValue)
            assertEq(getPrototypeOf(value), objectPrototype)
        },
        // The two spellings JavaScript reads as a prototype assignment are
        // compilation errors, not silently accepted properties.
        idKeyRejected: () => {
            const root = { 'input.f.js': [utf8('export default {__proto__:{"a":42}}')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(['input.f.js', 'output.f.js']))
            assertEq(code, 1)
            assert(state.stderr.includes('__proto__ requires the computed key form'), state.stderr)
            assertEq(state.root['output.f.js'], undefined)
        },
        stringKeyRejected: () => {
            const root = { 'input.f.js': [utf8('export default {"__proto__":{"a":42}}')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(['input.f.js', 'output.f.js']))
            assertEq(code, 1)
            assert(state.stderr.includes('__proto__ requires the computed key form'), state.stderr)
            assertEq(state.root['output.f.js'], undefined)
        },
    },
}
