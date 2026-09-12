/**
 * @import { Unknown } from '../djs/types.ts'
 * @import { Accept, Document } from '../media/datajs/vectors/types.ts'
 */

import { exitCode } from '../effects/node/module.f.mjs'
import { compile } from './module.f.mjs'
import { transpile } from './transpiler/module.f.mjs'
import { run } from './ast/module.f.mjs'
import { parseFromTokens } from './parser/module.f.mjs'
import { tokenize } from './tokenizer/module.f.mjs'
import { stringify } from '../djs/serializer/module.f.mjs'
import { bytes, difference } from '../media/datajs/vectors/module.f.mjs'
import { virtual, emptyState } from '../effects/node/virtual/module.f.mjs'
import { utf8, utf8ToString } from '../text/module.f.mjs'
import { fromVec } from '../text/utf8/module.f.mjs'
import { stringToList } from '../text/utf16/module.f.mjs'
import { fromEntries, isObject, sort } from '../types/object/module.f.mjs'
import { toVec } from '../types/uint8array/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.mjs'
import accept from '../../spec/datajs/vectors/accept/data.f.mjs'

/** The DataJS accept corpus, typed at the import since a data module carries no annotations. */
const acceptSet = /** @type {readonly Accept[]} */ (accept)

/**
 * A vector's document as the front end reads it: a string as it is, and a
 * byte-form document decoded — the front end takes code units, as
 * `transpile` feeds it, so a byte document reaches it the way it reaches any
 * code-unit reader, through a decoder that refuses what is not UTF-8. Every
 * accept document is UTF-8, so `null` here is a corpus defect, not a case.
 *
 * @type {(document: Document) => string | null}
 */
const documentText = document => {
    if (typeof document === 'string') { return document }
    const octets = bytes(document[1])
    return octets === null ? null : fromVec(toVec(new Uint8Array(octets)))
}

/**
 * What the front end makes of a source: the graph the module denotes, or
 * the error it reports. Tokenizer, parser and evaluator over the code units
 * of the text, with no imports to resolve — a DataJS document has none —
 * which is what `transpile` does behind the file system.
 *
 * @type {(source: string) => readonly ['ok', Unknown] | readonly ['error', string]}
 */
const evaluate = source => {
    const [tag, value] = parseFromTokens(tokenize(stringToList(source))(''))
    return tag === 'error' ? ['error', value.message] : ['ok', run(value[1])([])]
}

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
    assertEq(exitCode(code), 0, state.stderr)
    return readOutput(state.root, outputFileName)
}

const { getPrototypeOf, is, prototype: objectPrototype } = Object

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
    -0,
    -1.5,
    NaN,
    Infinity,
    -Infinity,
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
            assertEq(exitCode(code), 1)
            assert(state.stderr.includes('Requires 2 or more arguments'), state.stderr)
        },
        oneArg: () => {
            const [state, code] = virtual(emptyState)(compile(['input.f.js']))
            assertEq(exitCode(code), 1)
            assert(state.stderr.includes('Requires 2 or more arguments'), state.stderr)
        },
    },
    success: () => {
        const root = { 'input.f.js': [utf8('export default 42;')] }
        const [state, code] = virtual({ ...emptyState, root })(compile(['input.f.js', 'output.f.js']))
        assertEq(exitCode(code), 0)
        const content = readOutput(state.root, 'output.f.js')
        assertEq(content, 'export default 42;')
    },
    jsonOutput: () => {
        const root = { 'input.f.js': [utf8('export default 42;')] }
        const [state, code] = virtual({ ...emptyState, root })(compile(['input.f.js', 'output.json']))
        assertEq(exitCode(code), 0)
        const content = readOutput(state.root, 'output.json')
        assertEq(content, '42')
    },
    // An error with no token to point at names the file being compiled, not
    // `undefined:undefined:undefined`. Each language reports its own missing
    // file: the module reader and the JSON reader read their inputs
    // separately.
    fileNotFound: {
        module: () => {
            const [state, code] = virtual(emptyState)(compile(['missing.f.js', 'output.f.js']))
            assertEq(exitCode(code), 1)
            assertEq(state.stderr.trim(), 'missing.f.js - error: file not found')
            assertEq(state.root['output.f.js'], undefined)
        },
        json: () => {
            const [state, code] = virtual(emptyState)(compile(['missing.json', 'output.f.js']))
            assertEq(exitCode(code), 1)
            assertEq(state.stderr.trim(), 'missing.json - error: file not found')
            assertEq(state.root['output.f.js'], undefined)
        },
    },
    // A parse error prints where it is — and, when the error knows how far the
    // offending source runs, how far: `path:line:column-column` on one line,
    // `path:line:column-line:column` across several, the plain point otherwise.
    // These pin the rendering, so they are the proof that a lexical span
    // survives the whole trip: tokenizer → parser → `errorLocation`.
    parseError: {
        spanOneLine: () => {
            const root = { 'bad.f.js': [utf8('export default @')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(['bad.f.js', 'output.f.js']))
            assertEq(exitCode(code), 1)
            assertEq(state.stderr.trim(), 'bad.f.js:1:16-17 - error: unexpected token')
            assertEq(state.root['output.f.js'], undefined)
        },
        spanAcrossLines: () => {
            // an unterminated string swallowing a newline: the far end names its
            // own line, because repeating the start's would place it wrongly
            const root = { 'bad.f.js': [utf8('export default "a\nb"')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(['bad.f.js', 'output.f.js']))
            assertEq(exitCode(code), 1)
            assertEq(state.stderr.trim(), 'bad.f.js:1:16-2:3 - error: unexpected token')
            assertEq(state.root['output.f.js'], undefined)
        },
        point: () => {
            // a *grammar* failure points at one token and has no span — see
            // `ParseError` in fjs/fsc/parser/types.ts for why
            const root = { 'bad.f.js': [utf8('export default ]')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(['bad.f.js', 'output.f.js']))
            assertEq(exitCode(code), 1)
            assertEq(state.stderr.trim(), 'bad.f.js:1:16 - error: unexpected token')
            assertEq(state.root['output.f.js'], undefined)
        },
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
    // The subset law, FunctionalScript's half: every DataJS accept document
    // is a FunctionalScript module, and the front end reads it to the graph
    // its vector asserts — sharing and key order included, which is what
    // `difference` compares. The corpus proves the other half against a
    // JavaScript engine; this is the one stage 5 was done for, and it runs
    // over the whole set, the eight documents holding an unpaired surrogate
    // included, since the front end takes code units and owes no byte
    // encoding. Two things it found: the parser used to sort an object's
    // keys, and it used to be fed code points by the proofs where
    // `transpile` feeds it code units.
    subsetLaw: acceptSet.map(({ id, document, graph }) => () => {
        const source = documentText(document)
        assert(source !== null, `${id}: the document is not UTF-8`)
        const [tag, value] = evaluate(source)
        assert(tag === 'ok', `${id}: the front end refused the document: ${value}`)
        const d = difference(graph)(value)
        assert(d === null, `${id}: the front end's graph is not the vector's: ${d}`)
    }),
    // The three numbers JSON cannot spell, end to end: read as the values
    // they name, written back as the same words. `NaN` is checked by
    // `Object.is` directly, which is what `structurallySame` compares leaves
    // by too — so the corpus below carries it and `-0` as well.
    specialNumbers: {
        value: () => {
            const root = { 'input.f.js': [utf8('export default [NaN, Infinity, -Infinity];')] }
            const [, result] = virtual({ ...emptyState, root })(transpile('input.f.js'))
            assert(result[0] === 'ok', result[1])
            const value = result[1]
            assert(value instanceof Array && value.length === 3, value)
            assert(is(value[0], NaN), value[0])
            assertEq(value[1], Infinity)
            assertEq(value[2], -Infinity)
        },
        moduleRoundTrip: () => {
            const source = 'export default [NaN,Infinity,-Infinity];'
            assertEq(compileSource(source)('output.f.js'), source)
        },
        // The `.json` output spells them as the same words, as it spells
        // `undefined` and a bigint: not JSON, and not a substitute `null`
        // either — refusing them there is the policy json-bigint-serialization
        // records for the whole class.
        jsonOutput: () => {
            assertEq(compileSource('export default [NaN,Infinity,-Infinity];')('output.json'), '[NaN,Infinity,-Infinity]')
        },
    },
    // Negative zero end to end: the tokenizer pins the `-0` lexeme,
    // `parseFloat` keeps the sign, and the serializer writes it back as
    // `-0` — where `String(-0)` is `"0"`, which is why only `Object.is` can
    // state this and why the round trip is pinned rather than assumed.
    negativeZero: {
        value: () => {
            const root = { 'input.f.js': [utf8('export default -0;')] }
            const [, result] = virtual({ ...emptyState, root })(transpile('input.f.js'))
            assert(result[0] === 'ok', result[1])
            assert(is(result[1], -0), result[1])
        },
        moduleRoundTrip: () => {
            assertEq(compileSource('export default -0;')('output.f.js'), 'export default -0;')
            assertEq(compileSource('export default [0, -0];')('output.f.js'), 'export default [0,-0];')
        },
        // `-0` is a JSON number too, so the tree output keeps it
        jsonOutput: () => {
            assertEq(compileSource('export default -0;')('output.json'), '-0')
        },
    },
    // The `__proto__` key end to end: one value, two output languages, and one
    // spelling of the key in each (#2480).
    protoKey: {
        // The module output uses the computed form, which is also the only
        // input spelling — so the emitter's output is an input that means the
        // same value, and compiling it again is the identity.
        moduleRoundTrip: () => {
            const source = 'export default {["__proto__"]:{"a":42}};'
            const output = compileSource(source)('output.f.js')
            assertEq(output, source)
            assertEq(compileSource(output)('output.f.js'), source)
        },
        // The JSON output keeps the plain key: the computed form is a
        // JavaScript spelling that no JSON parser accepts.
        jsonOutput: () => {
            assertEq(
                compileSource('export default {["__proto__"]:{"a":42}};')('output.json'),
                '{"__proto__":{"a":42}}')
        },
        // `fjs compile proto.json a.js` — the two languages meeting. The input
        // is a JSON document, where `"__proto__"` is an ordinary data key, and
        // the output is a JavaScript module, where only the computed form
        // denotes one. Each hop uses its own language's spelling of the key.
        jsonInput: () => {
            const root = { 'proto.json': [utf8('{"__proto__":5}')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(['proto.json', 'a.js']))
            assertEq(exitCode(code), 0, state.stderr)
            assertEq(readOutput(state.root, 'a.js'), 'export default {["__proto__"]:5};')
        },
        // …and back, byte for byte: a JSON document survives the loop
        // `proto.json → a.js → out.json` with no `["__proto__"]:` artifact,
        // which no JSON parser would accept.
        jsonInputRoundTrip: () => {
            const document = '{"__proto__":{"a":42}}'
            const root = { 'proto.json': [utf8(document)] }
            const [state, code] = virtual({ ...emptyState, root })(compile(['proto.json', 'a.js']))
            assertEq(exitCode(code), 0, state.stderr)
            const module = readOutput(state.root, 'a.js')
            assertEq(module, 'export default {["__proto__"]:{"a":42}};')
            assertEq(compileSource(module)('out.json'), document)
        },
        // The extension speaks for the file named on the command line and for
        // no other: an import is resolved as a FunctionalScript module, and a
        // JSON document is not one — a statement never begins with a value —
        // so importing JSON fails until an import can say
        // `with { type: "json" }` (spec/todo/2140).
        jsonImportRejected: () => {
            const root = {
                'main.f.js': [utf8('import a from "./a.json";\nexport default [a];')],
                'a.json': [utf8('{"a":42}')],
            }
            const [state, code] = virtual({ ...emptyState, root })(compile(['main.f.js', 'out.json']))
            assertEq(exitCode(code), 1)
            assert(state.stderr.includes('a.json:1:1 - error: unexpected token'), state.stderr)
            assertEq(state.root['out.json'], undefined)
        },
        // A `.json` input is read as JSON, and an identifier key is no JSON
        // document's key — so this one fails in the JSON reader, which names
        // the code unit it failed at rather than a line and column, and is
        // named by its file instead.
        jsonInputIdKeyRejected: () => {
            const root = { 'proto.json': [utf8('{__proto__:5}')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(['proto.json', 'a.js']))
            assertEq(exitCode(code), 1)
            assertEq(state.stderr.trim(), 'proto.json - error: unexpected symbol at 1')
            assertEq(state.root['a.js'], undefined)
        },
        // The `.json` reader is JSON, not DJS with a JSON flag: a bigint is
        // not JSON, whatever DJS makes of it.
        jsonInputRejectsDjsExtensions: () => {
            const root = { 'a.json': [utf8('{"a":1n}')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(['a.json', 'a.js']))
            assertEq(exitCode(code), 1)
            assertEq(state.root['a.js'], undefined)
        },
        // The statement behind the textual assertions: the property is an
        // ordinary own property and the prototype is untouched. A textual test
        // alone would also pass for a spelling that merely looks right.
        value: () => {
            const root = { 'input.f.js': [utf8('export default {["__proto__"]:{"a":42}};')] }
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
            const root = { 'input.f.js': [utf8('export default {__proto__:{"a":42}};')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(['input.f.js', 'output.f.js']))
            assertEq(exitCode(code), 1)
            assert(state.stderr.includes('__proto__ requires the computed key form'), state.stderr)
            assertEq(state.root['output.f.js'], undefined)
        },
        stringKeyRejected: () => {
            const root = { 'input.f.js': [utf8('export default {"__proto__":{"a":42}};')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(['input.f.js', 'output.f.js']))
            assertEq(exitCode(code), 1)
            assert(state.stderr.includes('__proto__ requires the computed key form'), state.stderr)
            assertEq(state.root['output.f.js'], undefined)
        },
    },
}
