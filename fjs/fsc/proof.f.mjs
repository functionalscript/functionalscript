/**
 * @import { Unknown } from '../media/datajs/types.ts'
 * @import { Accept, Document, Normalize } from '../media/datajs/vectors/types.ts'
 */

import { exitCode } from '../effects/node/module.f.mjs'
import { _errorLocation, _tryJson, compile } from './module.f.mjs'
import { parse, transpile } from './transpiler/module.f.mjs'
import { run } from './ast/module.f.mjs'
import { tryParse as parseDataJs, tryStringify } from '../media/datajs/module.f.mjs'
import { bytes, difference } from '../media/datajs/vectors/module.f.mjs'
import { virtual, emptyState } from '../effects/node/virtual/module.f.mjs'
import { utf8, utf8ToString } from '../text/module.f.mjs'
import { fromVec } from '../text/utf8/module.f.mjs'
import { invert, unwrap } from '../types/result/module.f.mjs'
import { fromEntries, isObject } from '../types/object/module.f.mjs'
import { toVec } from '../types/uint8array/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.mjs'
import accept from '../../spec/datajs/vectors/accept/data.f.mjs'
import normalize from '../../spec/datajs/vectors/normalize/data.f.mjs'

/** The DataJS accept corpus, typed at the import since a data module carries no annotations. */
const acceptSet = /** @type {readonly Accept[]} */ (accept)

/** The normalized-form corpus, typed the same way. */
const normalizeSet = /** @type {readonly Normalize[]} */ (normalize)

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
 * the error it reports. The transpiler's own `parse`, then its evaluator,
 * with no imports to resolve — a DataJS document has none — which is what
 * `transpile` does behind the file system; the parts are the compiler's,
 * not a second assembly of them.
 *
 * @type {(source: string) => readonly ['ok', Unknown] | readonly ['error', string]}
 */
const evaluate = source => {
    const [tag, value] = parse('')(source)
    return tag === 'error' ? ['error', value.message] : run(value[1])([])
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

/**
 * What `fjs compile` prints when compiling `input.f.js` to a module fails
 * over `root`: the exit code is `1`, nothing is written, and the message
 * names the file that failed.
 *
 * @type {(root: typeof emptyState.root) => string}
 */
const stderrOf = root => {
    const [state, code] = virtual({ ...emptyState, root })(compile(['input.f.js', 'output.f.js']))
    assertEq(exitCode(code), 1)
    assertEq(state.root['output.f.js'], undefined)
    return state.stderr.trim()
}

/** What `fjs compile` prints when the module itself fails: {@link stderrOf} over the one source. @type {(source: string) => string} */
const moduleRefused = source => stderrOf({ 'input.f.js': [utf8(source)] })

/** The one module importing `m.f.js`, for a failure to be found there. @type {typeof emptyState.root} */
const importing = { 'input.f.js': [utf8('import m from "./m.f.js"; export default [m];')] }

/** A source over `cfg`, an object of two arrays and a leaf. @type {(source: string) => string} */
const withCfg = source => `const cfg = { a: [1], b: [2], c: 3 }; ${source}`

/** A source over `a`, whose `other` member shares a node its `selected` member does not reach. @type {(source: string) => string} */
const withSelected = source => `const x = []; const a = { selected: 1, other: [x, x] }; ${source}`

/**
 * What `fjs compile` prints when it refuses to write `.json` for a module:
 * the exit code is `1`, nothing is written, and the message names the output
 * file, because the module is sound and the output is what cannot be.
 *
 * @type {(source: string) => string}
 */
const jsonRefused = source => {
    const root = { 'input.f.js': [utf8(source)] }
    const [state, code] = virtual({ ...emptyState, root })(compile(['input.f.js', 'output.json']))
    assertEq(exitCode(code), 1, state.stderr)
    assertEq(state.root['output.json'], undefined)
    return state.stderr.trim()
}

/** Whether the front end finds a shared node in the module at `path`. @type {(root: typeof emptyState.root) => (path: string) => boolean} */
const sharedOf = root => path => {
    const [, result] = virtual({ ...emptyState, root })(transpile(path))
    assert(result[0] === 'ok', result[1])
    return result[1].shared
}

/** The module `fjs compile` writes for a value. @type {(value: Unknown) => string} */
const moduleText = value => unwrap(tryStringify(value))

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
    // The EDAG output: the program linked into one graph and written as a
    // DataJS document, its shared node hoisted as the module output hoists
    // one — the README's example, in both forms, side by side.
    edagOutput: {
        graph: () => {
            const root = {
                'input.f.js': [utf8('import c from "./m.f.js"; const a = 1; export default [a, a, c, { x: c }];')],
                'm.f.js': [utf8('export default ["text"];')],
            }
            const [state, code] = virtual({ ...emptyState, root })(compile(['input.f.js', 'output.edag.f.js']))
            assertEq(exitCode(code), 0, state.stderr)
            assertEq(readOutput(state.root, 'output.edag.f.js'), 'const $0=["[]",["text"]];export default ["[]",[1,1,$0,["{}",[[":","x",$0]]]]];')
            const [moduleState, moduleCode] = virtual({ ...emptyState, root })(compile(['input.f.js', 'output.f.js']))
            assertEq(exitCode(moduleCode), 0, moduleState.stderr)
            assertEq(readOutput(moduleState.root, 'output.f.js'), 'const $0=["text"];export default [1,1,$0,{"x":$0}];')
        },
        // `.edag.f.mjs` asks for the same; `.f.mjs` alone is the module output
        extension: () => {
            const root = { 'input.f.js': [utf8('export default { a: undefined };')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(['input.f.js', 'output.edag.f.mjs']))
            assertEq(exitCode(code), 0, state.stderr)
            assertEq(readOutput(state.root, 'output.edag.f.mjs'), 'export default ["{}",[[":","a",["undefined"]]]];')
            const [moduleState, moduleCode] = virtual({ ...emptyState, root })(compile(['input.f.js', 'output.f.mjs']))
            assertEq(exitCode(moduleCode), 0, moduleState.stderr)
            assertEq(readOutput(moduleState.root, 'output.f.mjs'), 'export default {"a":undefined};')
        },
        // a property access compiles to the EDAG as the operation, and to
        // the value outputs as what it reads
        access: () => {
            const root = { 'input.f.js': [utf8('const a = { b: 1 }; export default a.b;')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(['input.f.js', 'output.edag.f.js']))
            assertEq(exitCode(code), 0, state.stderr)
            assertEq(readOutput(state.root, 'output.edag.f.js'), 'export default [".",["{}",[[":","b",1]]],"b"];')
            assertEq(compileSource('const a = { b: 1 }; export default a.b;')('output.f.js'), 'export default 1;')
            assertEq(compileSource('const a = { b: 1 }; export default a.b;')('output.json'), '1')
        },
        // what the export does not reach is anchored by the comma operation,
        // so the graph holds it where the value outputs refuse the module or
        // drop the value: `n.x` on a `null` fails `run`, and is a node here
        anchored: () => {
            assertEq(compileSource('const a = []; export default 1;')('output.edag.f.js'), 'export default [",",[["[]",[]],1]];')
            assertEq(compileSource('const n = null; const check = n.x; export default 1;')('output.edag.f.js'), 'export default [",",[[".",null,"x"],1]];')
            assertEq(moduleRefused('const n = null; const check = n.x; export default 1;'), 'input.f.js - error: cannot read property "x" of null')
        },
        // a program the linker refuses is reported against the input, as a
        // parse error is, and nothing is written: a missing import
        refused: () => {
            const missing = { 'input.f.js': [utf8('import m from "./m.f.js"; export default [m];')] }
            const [missingState, missingCode] = virtual({ ...emptyState, root: missing })(compile(['input.f.js', 'output.edag.f.js']))
            assertEq(exitCode(missingCode), 1)
            assertEq(missingState.stderr.trim(), 'm.f.js - error: file not found')
        },
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
        const source = moduleText(value)
        const root = { 'input.f.js': [utf8(source)] }
        const [, result] = virtual({ ...emptyState, root })(transpile('input.f.js'))
        assert(result[0] === 'ok', result[1])
        assertStructurallySame(result[1].value, value, source)
    }),
    // The subset law, FunctionalScript's half: every DataJS accept document
    // is a FunctionalScript module, and the front end reads it to the graph
    // its vector asserts — sharing and key order included, which is what
    // `difference` compares. The corpus proves the other half against a
    // JavaScript engine; this is the one the front end's move was done
    // for, and it runs over the whole set, the eight documents holding an
    // unpaired surrogate included, since the front end takes code units and
    // owes no byte encoding. Two things it found: the parser used to sort
    // an object's keys, and it used to be fed code points by the proofs
    // where `transpile` feeds it code units.
    subsetLaw: acceptSet.map(({ id, document, graph }) => () => {
        const source = documentText(document)
        assert(source !== null, `${id}: the document is not UTF-8`)
        const [tag, value] = evaluate(source)
        assert(tag === 'ok', `${id}: the front end refused the document: ${value}`)
        const d = difference(graph)(value)
        assert(d === null, `${id}: the front end's graph is not the vector's: ${d}`)
    }),
    // The normalizer's loop: the document `fjs compile` writes for a module
    // is read by the DataJS reader to the graph the module denotes, over the
    // whole accept set. It runs on the compiler's parts as `subsetLaw` does,
    // since the eight byte-form documents cannot be fed to the file system as
    // UTF-8 — the output side is a document in every case, the writer
    // escaping what it cannot encode. `normalizeSet` below runs the file
    // system route.
    normalizeLoop: acceptSet.map(({ id, document, graph }) => () => {
        const source = documentText(document)
        assert(source !== null, `${id}: the document is not UTF-8`)
        const [tag, value] = evaluate(source)
        assert(tag === 'ok', `${id}: the front end refused the document: ${value}`)
        const normalized = unwrap(tryStringify(value))
        const d = difference(graph)(unwrap(parseDataJs(normalized)))
        assert(d === null, `${id}: the normalized document does not denote the vector's graph: ${d}`)
    }),
    // Normalized form is a fixed point of the compiler: `fjs compile` on a
    // normalized document writes the same bytes back, for every text the
    // corpus pins. This is the whole command, file system included.
    normalizeFixedPoint: normalizeSet.map(({ id, text }) => () => {
        assertEq(compileSource(text)('output.f.js'), text, id)
    }),
    // Sharing is decided from the module's syntax, not by walking the value:
    // a container `const` or import that the export reaches twice, or an
    // import whose own value is shared. A leaf referenced twice is not a
    // node, an unreachable `const` is not part of the value, and an inline
    // literal is a fresh node every time it is written.
    sharing: {
        constTwice: () => { assert(sharedOf({ 'a.f.js': [utf8('const a = [1]; export default [a, a];')] })('a.f.js')) },
        // an access on a literal selects the item the key names, and the
        // rest of the literal is not part of the value
        literal: () => {
            assertEq(jsonRefused('const x = []; export default [[x, x], 0][0];'), 'output.json - error: no JSON spelling for a shared node')
            assertEq(jsonRefused('const x = []; export default { a: [x, x], b: 1 }.a;'), 'output.json - error: no JSON spelling for a shared node')
            assertEq(compileSource('const x = []; export default [[x, x], 0][1];')('output.json'), '0')
            assertEq(compileSource('const x = []; export default [[x, x], 0][0][1];')('output.json'), '[]')
            assertEq(compileSource('const x = []; export default [x, [x]][1];')('output.json'), '[[]]')
            assertEq(compileSource('const x = []; export default { a: [x, x], a: 1 }.a;')('output.json'), '1')
            assertEq(compileSource('const x = []; export default [[x, x]].length;')('output.json'), '1')
            // an item selected from a literal may be an access itself, on a
            // literal or on a reference, and is read on to what it names
            assertEq(jsonRefused('const x = []; const z = [x, x]; export default [{ a: z }.a][0];'), 'output.json - error: no JSON spelling for a shared node')
            assertEq(jsonRefused('const x = []; export default [[{ a: [x, x] }.a]][0][0];'), 'output.json - error: no JSON spelling for a shared node')
            assertEq(jsonRefused('const x = []; const z = { a: [x, x] }; export default [z.a][0];'), 'output.json - error: no JSON spelling for a shared node')
            assertEq(compileSource('const x = []; const z = [x, x]; export default [{ a: z, b: 1 }.b][0];')('output.json'), '1')
            assertEq(compileSource('const x = []; const z = { a: [x, x], b: 2 }; export default [z.b][0];')('output.json'), '2')
        },
        leafTwice: () => {
            assert(!sharedOf({ 'a.f.js': [utf8('const a = 1; export default [a, a];')] })('a.f.js'))
            assertEq(compileSource('const a = 1; export default [a, a];')('output.json'), '[1,1]')
        },
        unreachable: () => {
            assert(!sharedOf({ 'a.f.js': [utf8('const a = []; const b = [a, a]; export default [a];')] })('a.f.js'))
            assertEq(compileSource('const a = []; const b = [a, a]; export default [a];')('output.json'), '[[]]')
        },
        alias: () => { assert(sharedOf({ 'a.f.js': [utf8('const a = []; const b = a; export default [a, b];')] })('a.f.js')) },
        nested: () => { assert(sharedOf({ 'a.f.js': [utf8('const a = []; export default [a, [a]];')] })('a.f.js')) },
        member: () => { assert(sharedOf({ 'a.f.js': [utf8('const a = {}; export default {"x": a, "y": {"z": a}};')] })('a.f.js')) },
        literals: () => { assert(!sharedOf({ 'a.f.js': [utf8('export default [[1], [1], {"a": {}}];')] })('a.f.js')) },
        // A member a later duplicate shadows is not in the value, so a
        // reference in it is not a reference to the node: `{x: a, x: 0, y: a}`
        // holds `a` once, and `{a: s, a: s}` once, along a const or an import.
        shadowed: () => {
            assert(!sharedOf({ 'a.f.js': [utf8('const a = {}; export default {"x": a, "x": 0, "y": a};')] })('a.f.js'))
            assertEq(compileSource('const a = {}; export default {"x": a, "x": 0, "y": a};')('output.json'), '{"x":0,"y":{}}')
            assert(!sharedOf({ 'a.f.js': [utf8('const s = [1]; export default {"a": s, "a": s};')] })('a.f.js'))
            assert(!sharedOf({ 'a.f.js': [utf8('import m from "./m.f.js"; export default {"a": m, "a": m};')], 'm.f.js': [utf8('export default [1];')] })('a.f.js'))
            assert(sharedOf({ 'a.f.js': [utf8('const a = {}; export default {"x": 0, "x": a, "y": a};')] })('a.f.js'))
        },
        importTwice: () => {
            assert(sharedOf({ 'a.f.js': [utf8('import c from "./c.f.js"; export default [c, c];')], 'c.f.js': [utf8('export default [1];')] })('a.f.js'))
            assert(!sharedOf({ 'a.f.js': [utf8('import c from "./c.f.js"; export default [c, c];')], 'c.f.js': [utf8('export default 1;')] })('a.f.js'))
        },
        importShared: () => {
            const root = { 'c.f.js': [utf8('const a = []; export default [a, a];')] }
            assert(sharedOf({ ...root, 'a.f.js': [utf8('import c from "./c.f.js"; export default [c];')] })('a.f.js'))
            // an import the export never reaches contributes nothing
            assert(!sharedOf({ ...root, 'a.f.js': [utf8('import c from "./c.f.js"; const x = 1; export default [x];')] })('a.f.js'))
        },
        json: () => { assert(!sharedOf({ 'a.json': [utf8('[[1],[1]]')] })('a.json')) },
        // one module reached along two import edges is one node reached
        // twice, however the edges are spelled: two import statements, two
        // spellings of one path, or a diamond through a third module — which
        // is what a module's `reaches` list is for
        moduleTwice: () => {
            const m = { 'm.f.js': [utf8('export default [1];')] }
            assert(sharedOf({ ...m, 'a.f.js': [utf8('import m from "./m.f.js"; import m2 from "./m.f.js"; export default [m, m2];')] })('a.f.js'))
            assert(sharedOf({ ...m, 'a.f.js': [utf8('import m from "./m.f.js"; import m2 from "./sub/../m.f.js"; export default [m, m2];')] })('a.f.js'))
        },
        diamond: () => {
            const root = {
                'm.f.js': [utf8('export default [1];')],
                'b.f.js': [utf8('import m from "./m.f.js"; export default [m];')],
                'a.f.js': [utf8('import m from "./m.f.js"; import b from "./b.f.js"; export default [m, b];')],
            }
            assert(sharedOf(root)('a.f.js'))
            const [state, code] = virtual({ ...emptyState, root })(compile(['a.f.js', 'output.json']))
            assertEq(exitCode(code), 1)
            assertEq(state.stderr.trim(), 'output.json - error: no JSON spelling for a shared node')
            // and the same module reached along one edge each by two
            // *different* modules is still one node reached twice
            assert(sharedOf({ ...root, 'c.f.js': [utf8('import m from "./m.f.js"; export default {"m": m};')], 'a.f.js': [utf8('import b from "./b.f.js"; import c from "./c.f.js"; export default [b, c];')] })('a.f.js'))
            // a leaf module along two edges is two copies of a leaf
            assert(!sharedOf({ ...root, 'm.f.js': [utf8('export default 1;')] })('a.f.js'))
        },
        // what a module reaches is listed once each, and not at all once it
        // is shared, so the lists stay sets however the modules join
        reaches: () => {
            const root = {
                'm.f.js': [utf8('export default [1];')],
                'b.f.js': [utf8('import m from "./m.f.js"; export default [m];')],
                'a.f.js': [utf8('import b from "./b.f.js"; export default [b, [b]];')],
            }
            const [, b] = virtual({ ...emptyState, root })(transpile('b.f.js'))
            assert(b[0] === 'ok', b[1])
            assertStructurallySame(b[1].reaches, ['m.f.js'])
            const [, a] = virtual({ ...emptyState, root })(transpile('a.f.js'))
            assert(a[0] === 'ok', a[1])
            assertEq(a[1].shared, true)
            assertStructurallySame(a[1].reaches, [])
        },
        // a node doubled at every `const`: two to the twenty-fourth references
        // in the value, and one `const` per line in the syntax the answer is
        // read from — refused at once, where a walk over the value's paths
        // would not return
        doubling: () => {
            const consts = Array.from({ length: 24 }, (_, i) => `const a${i + 1} = [a${i}, a${i}];`).join(' ')
            assertEq(jsonRefused(`const a0 = [1]; ${consts} export default a24;`), 'output.json - error: no JSON spelling for a shared node')
        },
    },
    // A property access on the value path: an own property, never the
    // prototype chain — the property-accessor spec's rule, a prototype's
    // name being refused by the parser — `undefined` where there is none,
    // and the failure JavaScript throws for on a `null` or `undefined` base.
    access: {
        own: () => {
            assertEq(compileSource('const a = { b: [1, 2] }; export default [a.b, a["b"][1], a.b.length];')('output.f.js'), 'export default [[1,2],2,2];')
            // a literal takes accesses as a reference does
            assertEq(compileSource('export default [[1, 2].length, "ab"[1], { a: 3 }.a, true.x];')('output.f.js'), 'export default [2,"b",3,undefined];')
            assertEq(moduleRefused('export default 1 .x;'), 'input.f.js:1:19 - error: access on a numeric literal')
            assertEq(moduleRefused('export default null.x;'), 'input.f.js - error: cannot read property "x" of null')
            assertEq(compileSource('const s = "ab"; export default [s[0], s["1"], s.length];')('output.json'), '["a","b",2]')
            assertEq(compileSource('const a = { b: 1 }; export default [a.c, a.b.x];')('output.f.js'), 'export default [undefined,undefined];')
            assertEq(moduleRefused('const a = { b: 1 }; export default a.toString;'), 'input.f.js:1:38 - error: prohibited property name')
            assertEq(compileSource('const n = 1; const b = true; const g = 2n; export default [n.x, b.x, g.x];')('output.f.js'), 'export default [undefined,undefined,undefined];')
        },
        failure: () => {
            assertEq(moduleRefused('const a = null; export default a.x;'), 'input.f.js - error: cannot read property "x" of null')
            assertEq(moduleRefused('const a = { b: 1 }; export default a.c.d;'), 'input.f.js - error: cannot read property "d" of undefined')
        },
        // a failure with no token and no file names the file being compiled
        // — the parser's contract failure, which no reader `compile` runs
        // produces, is the one such error left
        noFile: () => {
            assertEq(_errorLocation('input.f.js')({ message: 'missing end-of-input token', metadata: null }), 'input.f.js')
            assertEq(_errorLocation('input.f.js')({ message: 'file not found', metadata: null, path: 'm.f.js' }), 'm.f.js')
        },
        // a failure with no token names the file it is in: an imported
        // module's body, a missing import, a cycle met at an import
        failureInImport: () => {
            assertEq(stderrOf({ ...importing, 'm.f.js': [utf8('const n = null; export default n.a;')] }), 'm.f.js - error: cannot read property "a" of null')
            assertEq(stderrOf(importing), 'm.f.js - error: file not found')
            assertEq(stderrOf({ ...importing, 'm.f.js': [utf8('import i from "./input.f.js"; export default [i];')] }), 'input.f.js - error: circular dependency')
            assertEq(stderrOf({ ...importing, 'm.f.js': [utf8('export default @')] }), 'm.f.js:1:16-17 - error: unexpected token')
            // a malformed JSON module likewise, under both readers
            const json = { 'input.f.js': [utf8('import d from "./d.json" with { type: "json" }; export default [d];')], 'd.json': [utf8('{')] }
            const [edagState, edagCode] = virtual({ ...emptyState, root: json })(compile(['input.f.js', 'output.edag.f.js']))
            assertEq(exitCode(edagCode), 1)
            assertEq(edagState.stderr.trim(), 'd.json - error: unexpected end')
            assertEq(stderrOf(json), 'd.json - error: unexpected end')
        },
        // a JSON module is imported `with { type: "json" }`, as JavaScript
        // has it; a `.json` file imported without the attribute, or a module
        // imported with it, is refused under both readers
        jsonImport: () => {
            const root = { 'input.f.js': [utf8('import d from "./d.json" with { type: "json" }; export default [d, 1];')], 'd.json': [utf8('{"a": [null]}')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(['input.f.js', 'output.json']))
            assertEq(exitCode(code), 0)
            assertEq(readOutput(state.root, 'output.json'), '[{"a":[null]},1]')
            const [edagState, edagCode] = virtual({ ...emptyState, root })(compile(['input.f.js', 'output.edag.f.js']))
            assertEq(exitCode(edagCode), 0)
            assertEq(readOutput(edagState.root, 'output.edag.f.js'), 'export default ["[]",[["{}",[[":","a",["[]",[null]]]]],1]];')
            const missing = { ...root, 'input.f.js': [utf8('import d from "./d.json"; export default [d, 1];')] }
            assertEq(stderrOf(missing), 'd.json - error: a JSON module needs the import attribute with { type: "json" }')
            const [missingState, missingCode] = virtual({ ...emptyState, root: missing })(compile(['input.f.js', 'output.edag.f.js']))
            assertEq(exitCode(missingCode), 1)
            assertEq(missingState.stderr.trim(), 'd.json - error: a JSON module needs the import attribute with { type: "json" }')
            const incompatible = { 'input.f.js': [utf8('import m from "./m.f.js" with { type: "json" }; export default [m];')], 'm.f.js': [utf8('export default 1;')] }
            assertEq(stderrOf(incompatible), 'm.f.js - error: only a JSON module is imported with { type: "json" }')
            const [incompatibleState, incompatibleCode] = virtual({ ...emptyState, root: incompatible })(compile(['input.f.js', 'output.edag.f.js']))
            assertEq(exitCode(incompatibleCode), 1)
            assertEq(incompatibleState.stderr.trim(), 'm.f.js - error: only a JSON module is imported with { type: "json" }')
            // a file met before is refused all the same when a later import
            // misspells it: the contract is the import's, not the file's
            const twice = { ...root, 'input.f.js': [utf8('import d from "./d.json" with { type: "json" }; import e from "./d.json"; export default [d, e];')] }
            assertEq(stderrOf(twice), 'd.json - error: a JSON module needs the import attribute with { type: "json" }')
            const [twiceState, twiceCode] = virtual({ ...emptyState, root: twice })(compile(['input.f.js', 'output.edag.f.js']))
            assertEq(exitCode(twiceCode), 1)
            assertEq(twiceState.stderr.trim(), 'd.json - error: a JSON module needs the import attribute with { type: "json" }')
        },
        // the sweep reads an access by its keys: `cfg.a` beside `cfg.b` is a
        // tree, `cfg.a` twice or `cfg` beside `cfg.a` is not, and a leaf
        // reached twice is two copies of a leaf
        sharing: () => {
            assertEq(compileSource(withCfg('export default { first: cfg.a, second: cfg.b };'))('output.json'), '{"first":[1],"second":[2]}')
            assertEq(jsonRefused(withCfg('export default [cfg.a, cfg.a];')), 'output.json - error: no JSON spelling for a shared node')
            assertEq(compileSource(withCfg('export default [cfg.a, cfg.a];'))('output.f.js'), 'const $0=[1];export default [$0,$0];')
            assertEq(jsonRefused(withCfg('export default [cfg, cfg.a];')), 'output.json - error: no JSON spelling for a shared node')
            assertEq(compileSource(withCfg('export default [cfg.c, cfg.c, cfg.a[0], cfg.a.length];'))('output.json'), '[3,3,1,1]')
            assertEq(jsonRefused('const o = []; const cfg = { a: o, b: o }; export default [cfg.a, cfg.b];'), 'output.json - error: no JSON spelling for a shared node')
            assertEq(jsonRefused('const a = [[]]; export default [a[0], a["0"]];'), 'output.json - error: no JSON spelling for a shared node')
            // `"00"` is not an index's spelling, so it reaches no node: the
            // refusal is `undefined`'s, not a shared node's — and the route
            // into the literal stops there, so the reference at index 0 is
            // reached once, not twice
            assertEq(jsonRefused('const x = []; const a = [x]; export default [a[0], a["00"]];'), 'output.json - error: no JSON spelling for undefined')
            // an entry reached only through an access is in the value only
            // where the access selects: sharing under another member is
            // nothing to it, and a route through a reference follows it
            assertEq(compileSource(withSelected('export default a.selected;'))('output.json'), '1')
            assertEq(compileSource(withSelected('export default a.other[0];'))('output.json'), '[]')
            // a key that is not an index's canonical spelling names no element
            assertEq(compileSource(withSelected('export default [a.other["01"], a.other[1.5], a.other[-1], a.other["1e0"]];'))('output.f.js'), 'export default [undefined,undefined,undefined,undefined];')
            assertEq(jsonRefused(withSelected('export default a.other;')), 'output.json - error: no JSON spelling for a shared node')
            assertEq(jsonRefused(withSelected('export default [a.selected, a.other];')), 'output.json - error: no JSON spelling for a shared node')
            assertEq(jsonRefused(withSelected('export default [a.other[0], a.other[1]];')), 'output.json - error: no JSON spelling for a shared node')
            assertEq(compileSource('const b = { y: [] }; const a = { x: b }; export default a.x.y;')('output.json'), '[]')
            assertEq(jsonRefused('const b = { y: [] }; const a = { x: b }; export default [a.x.y, b.y];'), 'output.json - error: no JSON spelling for a shared node')
            // a `const` and a module are two groups however they are named:
            // an import resolved to the path `0` is not `const` 0
            /** @type {typeof emptyState.root} */
            const zero = { 'a.f.js': [utf8('import m from "./0"; const c = []; export default [c, m];')], 0: [utf8('export default [];')] }
            const [zeroState, zeroCode] = virtual({ ...emptyState, root: zero })(compile(['a.f.js', 'output.json']))
            assertEq(exitCode(zeroCode), 0, zeroState.stderr)
            assertEq(readOutput(zeroState.root, 'output.json'), '[[],[]]')
            /** @type {typeof emptyState.root} */
            const m = { 'm.f.js': [utf8('export default { x: [1], y: [2], z: 3 };')] }
            assert(!sharedOf({ ...m, 'a.f.js': [utf8('import m from "./m.f.js"; export default [m.x, m.y, m.z, m.z];')] })('a.f.js'))
            assert(sharedOf({ ...m, 'a.f.js': [utf8('import m from "./m.f.js"; export default [m.x, m.x];')] })('a.f.js'))
            assert(sharedOf({ ...m, 'a.f.js': [utf8('import m from "./m.f.js"; export default [m, m.x];')] })('a.f.js'))
            assert(!sharedOf({ ...m, 'a.f.js': [utf8('import m from "./m.f.js"; export default [m, m.z];')] })('a.f.js'))
            // a module whose own value holds a shared node is shared under
            // any route into it — the coarse answer, in the safe direction
            /** @type {typeof emptyState.root} */
            const partly = { 'm.f.js': [utf8('const x = []; export default { selected: [], other: [x, x] };')] }
            assert(sharedOf({ ...partly, 'a.f.js': [utf8('import m from "./m.f.js"; export default m.selected;')] })('a.f.js'))
            // and the modules a module reaches count under any route too
            /** @type {typeof emptyState.root} */
            const reaching = { 'n.f.js': [utf8('export default [];')], 'm.f.js': [utf8('import n from "./n.f.js"; export default { selected: [], other: n };')] }
            assert(sharedOf({ ...reaching, 'a.f.js': [utf8('import m from "./m.f.js"; import n from "./n.f.js"; export default [m.selected, n];')] })('a.f.js'))
            // reached through two modules, an import's node is one node: the
            // importer of both sees the module twice
            assert(sharedOf({ ...m, 'b.f.js': [utf8('import m from "./m.f.js"; export default { p: m.x };')], 'a.f.js': [utf8('import b from "./b.f.js"; import m from "./m.f.js"; export default [b, m.y];')] })('a.f.js'))
        },
    },
    // The three numbers JSON cannot spell, end to end: read as the values
    // they name, written back as the same words. `NaN` is checked by
    // `Object.is` directly, which is what `structurallySame` compares leaves
    // by too — so the corpus below carries it and `-0` as well.
    specialNumbers: {
        value: () => {
            const root = { 'input.f.js': [utf8('export default [NaN, Infinity, -Infinity];')] }
            const [, result] = virtual({ ...emptyState, root })(transpile('input.f.js'))
            assert(result[0] === 'ok', result[1])
            const { value } = result[1]
            assert(value instanceof Array && value.length === 3, value)
            assert(is(value[0], NaN), value[0])
            assertEq(value[1], Infinity)
            assertEq(value[2], -Infinity)
        },
        moduleRoundTrip: () => {
            const source = 'export default [NaN,Infinity,-Infinity];'
            assertEq(compileSource(source)('output.f.js'), source)
        },
        // The `.json` output refuses them, each by name: `JSON.stringify`'s
        // `null` would read back as a different value, and the word would
        // not read back at all.
        jsonOutput: () => {
            assertEq(jsonRefused('export default NaN;'), 'output.json - error: no JSON spelling for NaN')
            assertEq(jsonRefused('export default Infinity;'), 'output.json - error: no JSON spelling for Infinity')
            assertEq(jsonRefused('export default -Infinity;'), 'output.json - error: no JSON spelling for -Infinity')
        },
    },
    // What JSON cannot spell, refused wherever it sits — at the root, as an
    // element, as a member's value — and nothing written. A bigint is
    // refused even though its digits are JSON: the standard reader would
    // take `1` back as the number `1`, a change of type the extended codec's
    // output exists to signal and a `.json` file cannot. Sharing is refused
    // too, since JSON denotes a tree and writing the node twice denotes a
    // different graph. `-0` is a JSON number and stays one.
    jsonRefusals: {
        undefinedRoot: () => { assertEq(jsonRefused('export default undefined;'), 'output.json - error: no JSON spelling for undefined') },
        undefinedElement: () => { assertEq(jsonRefused('export default [1, undefined];'), 'output.json - error: no JSON spelling for undefined') },
        undefinedMember: () => { assertEq(jsonRefused('export default {"a": undefined};'), 'output.json - error: no JSON spelling for undefined') },
        bigintRoot: () => { assertEq(jsonRefused('export default 42n;'), 'output.json - error: no JSON spelling for 42n') },
        bigintElement: () => { assertEq(jsonRefused('export default [42n];'), 'output.json - error: no JSON spelling for 42n') },
        bigintMember: () => { assertEq(jsonRefused('export default {"a": 42n};'), 'output.json - error: no JSON spelling for 42n') },
        nanElement: () => { assertEq(jsonRefused('export default [NaN];'), 'output.json - error: no JSON spelling for NaN') },
        nanMember: () => { assertEq(jsonRefused('export default {"a": NaN};'), 'output.json - error: no JSON spelling for NaN') },
        sharedNode: () => {
            assertEq(jsonRefused('const a = [1]; export default [a, a];'), 'output.json - error: no JSON spelling for a shared node')
            assertEq(jsonRefused('const a = {}; export default {"x": a, "y": a};'), 'output.json - error: no JSON spelling for a shared node')
        },
        // two equal containers are two nodes, and a tree is a tree
        equalNotShared: () => {
            assertEq(compileSource('export default [[1], [1]];')('output.json'), '[[1],[1]]')
        },
        // the whole tree is written once the first refusal is found: nothing
        // after it is reported, and nothing before it is written
        firstRefusal: () => {
            assertEq(jsonRefused('export default [1, undefined, 2n];'), 'output.json - error: no JSON spelling for undefined')
        },
        // the module output takes every one of them
        moduleOutput: () => {
            assertEq(compileSource('export default [undefined, 42n, NaN];')('output.f.js'), 'export default [undefined,42n,NaN];')
            assertEq(compileSource('const a = [1]; export default [a, a];')('output.f.js'), 'const $0=[1];export default [$0,$0];')
        },
        // and `_tryJson` itself, on a value rather than a file, for the leaf
        // JSON has a spelling for and the container order it keeps
        value: () => {
            assertEq(unwrap(_tryJson({ b: -0, a: [true, null, 'x'] })), '{"b":-0,"a":[true,null,"x"]}')
            assertEq(unwrap(invert(_tryJson(undefined))), 'no JSON spelling for undefined')
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
            assert(is(result[1].value, -0), result[1])
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
        // A JSON module imported `with { type: "json" }` is read by the JSON
        // reader too, so its `"__proto__"` key is the data key `JSON.parse`
        // makes of it, through the import and out again.
        jsonImportRoundTrip: () => {
            const root = {
                'main.f.js': [utf8('import a from "./a.json" with { type: "json" };\nexport default [a];')],
                'a.json': [utf8('{"__proto__":{"a":42}}')],
            }
            const [state, code] = virtual({ ...emptyState, root })(compile(['main.f.js', 'out.json']))
            assertEq(exitCode(code), 0, state.stderr)
            assertEq(readOutput(state.root, 'out.json'), '[{"__proto__":{"a":42}}]')
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
            const { value } = result[1]
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
