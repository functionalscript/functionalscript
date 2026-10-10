/**
 * @import { Unknown } from '../media/datajs/types.ts'
 * @import { Accept, Document, Normalize } from '../media/datajs/vectors/types.ts'
 * @import { Analysis } from '../edag/analysis/types.ts'
 * @import { Vec } from '../types/bit_vec/types.ts'
 * @import { NodeOp } from '../effects/node/types.ts'
 * @import { Commands } from '../effects/types.ts'
 * @import { CompileValue } from '../edag/value/to_unknown/types.ts'
 */

import { exitCode, readUtf8File, nodeCommands } from '../effects/node/module.f.mjs'
import { compile, outputText } from './module.f.mjs'
import { transpile } from './transpiler/module.f.mjs'
import { parse } from './source/module.f.mjs'
import { resolve, unresolved } from './edag/module.f.mjs'
import { analysis } from '../edag/analysis/module.f.mjs'
import { memo } from '../edag/memo/module.f.mjs'
import { read } from '../edag/value/property/module.f.mjs'
import { toData, compileCommands } from '../edag/value/to_unknown/module.f.mjs'
import { tryParse as parseDataJs, tryStringify } from '../media/datajs/module.f.mjs'
import { bytes, difference } from '../media/datajs/vectors/module.f.mjs'
import { virtual, virtualOperationMap, emptyState, nodeProgramOptions } from '../effects/node/virtual/module.f.mjs'
import { partialRun } from '../effects/mock/module.f.mjs'
import { utf8, utf8ToString } from '../text/module.f.mjs'
import { fromVec } from '../text/utf8/module.f.mjs'
import { unwrap } from '../types/result/module.f.mjs'
import { fromEntries, isObject } from '../types/object/module.f.mjs'
import { toVec } from '../types/uint8array/module.f.mjs'
import { assert, assertEq, assertOk, assertNotNullish, assertStructurallySame } from '../asserts/module.f.mjs'
import { _compiled, _written, demo, outputs } from './demo.f.mjs'
import { disagreement } from '../website/demo/highlight/module.f.mjs'
import { textOfResult } from '../text/marked/module.f.mjs'
import { examples } from './examples/module.f.js'
import { htmlToString } from '../media/html/module.f.mjs'
import { maxLengthBytes } from '../types/bit_vec/module.f.mjs'
import accept from '../../spec/datajs/vectors/accept/data.f.js'
import normalize from '../../spec/datajs/vectors/normalize/data.f.js'

/** @type {Commands<NodeOp | CompileValue>} */
const runtimeCommands = [...nodeCommands, ...compileCommands]
export const runtime = partialRun(runtimeCommands)(virtualOperationMap)

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
    if (tag === 'error') { return ['error', value.message] }
    const result = read(memo(unwrap(analysis(unresolved(value).edag)))({ args: [] }), 'default')
    return result[0] === 'error' ? ['error', 'module initialization failed'] : toData(result[1])
}

/** The complete module result has an own default export. @type {(value: unknown) => unknown} */
export const defaultValue = value => {
    assert(isObject(value))
    return value.default
}

/** @type {(root: typeof emptyState.root, path: string) => string} */
export const readOutput = (root, path) => {
    const file = root[path]
    if (!Array.isArray(file) || file.length === 0) { throw `${path} is not a file` }
    return utf8ToString(file[0])
}

/** @type {(source: string) => (outputFileName: string) => string} */
export const compileSource = source => outputFileName => {
    const root = { 'input.f.js': [utf8(source)] }
    const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', outputFileName])))
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
export const stderrOf = root => {
    const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.data.js'])))
    assertEq(exitCode(code), 1)
    assertEq(state.root['output.data.js'], undefined)
    return state.stderr.trim()
}

/** What `fjs compile` prints when the module itself fails: {@link stderrOf} over the one source. @type {(source: string) => string} */
export const moduleRefused = source => stderrOf({ 'input.f.js': [utf8(source)] })

/** The one module importing `m.f.js`, for a failure to be found there. @type {typeof emptyState.root} */
export const importing = { 'input.f.js': [utf8('import m from "./m.f.js"; export default [m];')] }

/** A source over `cfg`, an object of two arrays and a leaf. @type {(source: string) => string} */
export const withCfg = source => `const cfg = { a: [1], b: [2], c: 3 }; ${source}`

/** A source over `a`, whose `other` member shares a node its `selected` member does not reach. @type {(source: string) => string} */
export const withSelected = source => `const x = []; const a = { selected: 1, other: [x, x] }; ${source}`

/**
 * What `fjs compile` prints when it refuses to write `.json` for a module:
 * the exit code is `1`, nothing is written, and the message names the output
 * file, because the module is sound and the output is what cannot be.
 *
 * @type {(source: string) => string}
 */
export const jsonRefused = source => {
    const root = { 'input.f.js': [utf8(source)] }
    const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.json'])))
    assertEq(exitCode(code), 1, state.stderr)
    assertEq(state.root['output.json'], undefined)
    return state.stderr.trim()
}

/**
 * What `fjs compile` prints when it refuses to write `.f.js` for a module:
 * the exit code is `1`, nothing is written, and the message names the output
 * file, since the module is sound and the output is what cannot be.
 *
 * @type {(root: typeof emptyState.root) => string}
 */
const fjsRefused = root => {
    const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.f.js'])))
    assertEq(exitCode(code), 1, state.stderr)
    assertEq(state.root['output.f.js'], undefined)
    return state.stderr.trim()
}

/**
 * The table of the graph `fjs compile` links a one-file module into: the
 * compiler's own linker, not a second assembly of it, so that the round trip
 * below compares what the compiler compiles.
 *
 * @type {(source: string) => Analysis}
 */
const graphOf = source => {
    const root = { 'input.f.js': [utf8(source)] }
    const [, result] = virtual({ ...emptyState, root })(resolve('input.f.js'))
    assert(result[0] === 'ok', result[1])
    return assertOk(analysis(result[1]))
}

/**
 * The `.f.js` output of a module, once compiling that output again gives the
 * same graph the module itself compiles to — the tables compared whole:
 * root, nodes, scopes and shared. That equality is the writer's whole claim
 * at the command level: the text is FunctionalScript the compiler reads back,
 * and it denotes the program it was written from. The names and the places a
 * value is written are the writer's to choose, which is why the tables are
 * compared and not the texts.
 *
 * @type {(source: string) => string}
 */
export const fjsRoundTrip = source => {
    const output = compileSource(source)('output.f.js')
    assertStructurallySame(graphOf(output), graphOf(source), output)
    return output
}

/**
 * Modules the FunctionalScript writer accepts, one per thing it has a
 * spelling for that a value output has none of or writes differently: a
 * function in every position, an anchor, an access left unevaluated, and the
 * leaves and sharing the DataJS corpus covers too, for the two routes to be
 * compared on the same graph.
 *
 * @type {readonly string[]}
 */
const fjsCorpus = [
    'export default 1;',
    'export default [undefined, 42n, NaN, Infinity, -Infinity, -0];',
    'export default {["__proto__"]:{"a":42}};',
    'const a = [1]; export default [a, a];',
    'const a = { b: [1, 2] }; export default [a.b, a["b"][1], a.b.length];',
    'export default (...a) => a;',
    'export default (...a) => [a, a];',
    'export default (...a) => (...b) => b;',
    'export default [(...a) => a, (...a) => a];',
    'export default (...a) => { return { x: a }; };',
    'export default () => 1;',
    'export default () => (...a) => a;',
    'const f = (...a) => 1; export default 2;',
    'const a = []; export default 1;',
    'const n = null; const check = n.x; export default 1;',
    'export default {b:1,"0":2,a:3,b:4};',
    'const x = []; export default {a: x, a: 1};',
    'export default (a, b) => (a + b) * 2 - (-a) ** 2 & ~b;',
    'export default (a, b) => a ? b : c => a ?? (b || c);',
    'export default (...a) => { const o = []; return a[0] ? [o, o] : a.at(0)(1); };',
    'const a = [1]; export default [...a, 0, ...a, ..."ab",];',
    'const f = (...r) => r; export default (...r) => f(...r);',
    'const o = { m: (...r) => r }; export default (...r) => o.m(...r, 1);',
    'const o = { a: 1 }; export default [{ x: 0, ...o }, { ...o, x: 0 }, { ...o, ...o, }, (...r) => ({ ...r })];',
]

/** The `.json` document `fjs compile` writes for the module `a.f.js` in `root`. @type {(root: typeof emptyState.root) => string} */
export const jsonOf = root => {
    const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['a.f.js', 'output.json'])))
    assertEq(exitCode(code), 0, state.stderr)
    return readOutput(state.root, 'output.json')
}

/** The module `fjs compile` writes for a value. @type {(value: Unknown) => string} */
const moduleText = value => unwrap(tryStringify(value))

/** The value every `protoKey` test below denotes. */
export const protoValue = fromEntries([['__proto__', { a: 42 }]])

const sharedArray = [1, 2]

/**
 * Values the DataJS emitter must be able to write as source that evaluates
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
    namedRestOutput: () => {
        const source = 'export default (a,b,c,...x)=>[a,b,c,x];'
        assert(compileSource(source)('parameters.edag.data.mjs').includes('["=>",3,[],'))
        const written = compileSource(source)('parameters.f.mjs')
        assertEq(parse('parameters.f.mjs')(written)[0], 'ok')
        /** @type {(length: number) => string} */
        const large = length => `export default (${Array.from({ length }, (_, i) => `a${i},`).join('')}...x)=>x;`
        assert(compileSource(large(16))('large.edag.data.mjs').includes('["=>",16,[],'))
        assertEq(parse('large.f.mjs')(compileSource(large(16))('large.f.mjs'))[0], 'ok')
        assert(moduleRefused(large(17)).includes('more than 16 fixed parameters'))
    },
    namedExports: {
        values: () => {
            assertEq(compileSource('export const a=5; export default 7;')('output.json'), '7')
            assertEq(compileSource('export const a=5;')('output.data.js'), 'export default undefined;')
            assertEq(jsonRefused('export const a=5;'), 'output.json - error: no JSON spelling for undefined')
            assertEq(compileSource('export const a=[]; export default a;')('output.json'), '[]')
            assertEq(compileSource('const x=[]; export const a=[x,x]; export default 7;')('output.json'), '7')
            assertEq(compileSource('export const a=[]; export default [a,a];')('output.json'), '[[],[]]')
            assertEq(compileSource('export const a=undefined; export default undefined;')('output.data.js'), 'export default undefined;')
        },
        imports: () => {
            const input = 'import a from "./dep.f.js"; export default a;'
            const root = { 'input.f.js': [utf8(input)], 'dep.f.js': [utf8('export const x=[]; export default x;')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.json'])))
            assertEq(exitCode(code), 0, state.stderr)
            assertEq(readOutput(state.root, 'output.json'), '[]')
            const [source, sourceCode] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.f.js'])))
            assertEq(exitCode(sourceCode), 0, source.stderr)
            assertStructurallySame(evaluate(readOutput(source.root, 'output.f.js')), ['ok', []])
            assertEq(stderrOf({ ...root, 'dep.f.js': [utf8('export const x=7;')] }), 'dep.f.js - error: module has no default export')
            assertEq(stderrOf({ ...root, 'dep.f.js': [utf8('export const bad=null.x; export default 7;')] }), 'dep.f.js - error: module initialization failed')
            const [defined, definedCode] = virtual({ ...emptyState, root: { ...root, 'dep.f.js': [utf8('export const x=1; export default undefined;')] } })(compile(nodeProgramOptions(['input.f.js', 'output.data.js'])))
            assertEq(exitCode(definedCode), 0, defined.stderr)
            assertEq(readOutput(defined.root, 'output.data.js'), 'export default undefined;')
        },
        sourceAndRust: () => {
            const source = 'export const z=5; export const a=z; export default 7;'
            assertEq(compileSource(source)('output.f.js'), 'export const a=5;export const z=5;export default 7;')
            const rust = compileSource(source)('output.rs')
            assert(rust.includes('string_key("a")'))
            assert(rust.includes('string_key("z")'))
            assert(rust.includes('string_key("default")'))
        },
    },
    moduleBoundary: {
        fixedPoint: () => {
            for (const source of ['export default 7;', 'export default {"default":7};', 'export default undefined;']) {
                for (const output of ['output.data.js', 'output.f.js']) {
                    const once = compileSource(source)(output)
                    assertEq(once, source)
                    assertEq(compileSource(once)(output), source)
                }
            }
            assertEq(compileSource('export default 7;')('output.json'), '7')
        },
        jsonDocuments: () => {
            for (const document of ['7', 'null', '{"default":7}']) {
                for (const output of ['output.json', 'output.data.js', 'output.f.js']) {
                    const root = { 'input.json': [utf8(document)] }
                    const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.json', output])))
                    assertEq(exitCode(code), 0, state.stderr)
                    const expected = output.endsWith('.json') ? document : `export default ${document};`
                    assertEq(readOutput(state.root, output), expected)
                }
            }
        },
    },
    tooFewArgs: {
        oneArg: () => {
            const [state, code] = virtual(emptyState)(compile(nodeProgramOptions(['input.f.js'])))
            assertEq(exitCode(code), 1)
            assert(state.stderr.includes('Requires 2 arguments'), state.stderr)
        },
    },
    // `fjs compile` with no arguments is the check: every `.f.js` under the
    // source root compiled through the pipeline every output begins with, and
    // nothing written. The `.f.js` extension promises the compiler of the same
    // revision accepts the module, and only this check keeps that promise —
    // `tsc` accepts source the compiler refuses.
    check: {
        everyFileAccepted: () => {
            // Discovery descends into subdirectories, and the count on `stdout`
            // says how many files the walk found: `0 checked` from a
            // misplaced root would pass the exit code alone.
            const root = {
                'a.f.js': [utf8('export default 1;')],
                'sub': { 'b.f.js': [utf8('export default (...x) => x;')] },
            }
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions([])))
            assertEq(exitCode(code), 0, state.stderr)
            assertEq(state.stdout.trim(), '.f.js: 2 checked')
            assertEq(state.stderr, '')
        },
        nothingToCheck: () => {
            // A tree with no `.f.js` passes, and says so, rather than failing a
            // repository that has not renamed its first module yet.
            const [state, code] = virtual({ ...emptyState, root: {} })(compile(nodeProgramOptions([])))
            assertEq(exitCode(code), 0, state.stderr)
            assertEq(state.stdout.trim(), '.f.js: 0 checked')
        },
        reportsEveryRefusal: () => {
            // Two refused among an accepted one: both are named, each with the
            // diagnostic the command would print for it, so a run that stopped
            // at the first would fail this. Nothing is written, and the last
            // line counts what the walk saw.
            const root = {
                'ok.f.js': [utf8('export default 1;')],
                'bad.f.js': [utf8('export default @;')],
                'sub': { 'worse.f.js': [utf8('export default {')] },
            }
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions([])))
            assertEq(exitCode(code), 1)
            const lines = state.stderr.trim().split('\n')
            assertEq(lines.length, 3, state.stderr)
            assert(lines.some(line => line.startsWith('./bad.f.js:1:16-18 - error: ')), state.stderr)
            assert(lines.some(line => line.startsWith('./sub/worse.f.js:1:17 - error: ')), state.stderr)
            assertEq(lines[2], '.f.js: 3 checked, 2 refused')
            assertEq(state.stdout, '')
            assertEq(Object.keys(state.root).toSorted().join(','), 'bad.f.js,ok.f.js,sub')
        },
        checksAuthoredOnly: () => {
            // An `.f.mjs` states intent and promises nothing, so a refused one
            // beside an accepted `.f.js` is no failure; a hidden directory and
            // `node_modules` are not walked, as the test runner's discovery
            // does not walk them.
            const root = {
                'ok.f.js': [utf8('export default 1;')],
                'refused.f.mjs': [utf8('export default @;')],
                '.hidden': { 'a.f.js': [utf8('export default @;')] },
                'node_modules': { 'b.f.js': [utf8('export default @;')] },
            }
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions([])))
            assertEq(exitCode(code), 0, state.stderr)
            assertEq(state.stdout.trim(), '.f.js: 1 checked')
        },
        followsImports: () => {
            // The check links the program as a compile does, so an `.f.js`
            // whose import the compiler refuses is refused with it: the
            // promise is about the module as compiled, dependencies included,
            // and the diagnostic names the module the error is in.
            const root = {
                'main.f.js': [utf8('import d from "./dep.f.mjs"; export default d;')],
                'dep.f.mjs': [utf8('export default @;')],
            }
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions([])))
            assertEq(exitCode(code), 1)
            assert(state.stderr.startsWith('dep.f.mjs:1:16-18 - error: '), state.stderr)
            assert(state.stderr.trim().endsWith('.f.js: 1 checked, 1 refused'), state.stderr)
        },
        startsAtInitCwd: () => {
            // Under `npm run`, `INIT_CWD` is where the command was invoked, so
            // the check scopes to that subtree as `fjs test` does: the refused
            // file above it is not seen.
            const root = {
                'a.f.js': [utf8('export default @;')],
                'sub': { 'b.f.js': [utf8('export default 1;')] },
            }
            const options = { ...nodeProgramOptions([]), env: { INIT_CWD: 'sub' } }
            const [state, code] = virtual({ ...emptyState, root })(compile(options))
            assertEq(exitCode(code), 0, state.stderr)
            assertEq(state.stdout.trim(), '.f.js: 1 checked')
        },
        unreadableRoot: () => {
            // A tree that cannot be listed is a failed check, reported in the
            // host's words, not a pass over zero files.
            const options = { ...nodeProgramOptions([]), env: { INIT_CWD: 'missing' } }
            const [state, code] = virtual({ ...emptyState, root: {} })(compile(options))
            assertEq(exitCode(code), 1)
            assertEq(state.stderr.trim(), 'invalid path')
            assertEq(state.stdout, '')
        },
    },
    malformedUtf8: () => {
        // A source that is not correct UTF-8 is refused, naming the file,
        // rather than decoded: a lenient decoder gives a raw `FF` in a
        // string U+00FF where a JavaScript host reads U+FFFD — a different
        // successful value (DESIGN.md §10).
        /** @type {(text: string) => readonly number[]} */
        const ascii = text => Array.from(text, c => c.charCodeAt(0))
        /** @type {(before: string, bad: readonly number[], after: string) => Vec} */
        const source = (before, bad, after) => toVec(new Uint8Array([...ascii(before), ...bad, ...ascii(after)]))
        const sequences = [[0xff], [0xc2], [0xc0, 0xaf], [0xed, 0xa0, 0x80]]
        for (const bad of sequences) {
            /** @type {readonly (readonly [string, Vec, string])[]} */
            const cases = [
                ['input.f.js', source('export default "a', bad, 'b";'), 'input.f.js'],
                ['input.f.js', source('export default { "a', bad, '": 1 };'), 'input.f.js'],
                ['input.f.js', source('// a', bad, '\nexport default 1;'), 'input.f.js'],
                ['input.json', source('"a', bad, '"'), 'input.json'],
            ]
            for (const [input, bytes, named] of cases) {
                const root = { [input]: [bytes] }
                const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions([input, 'output.json'])))
                assertEq(exitCode(code), 1, state.stderr)
                assert(state.stderr.includes(`${named} - error: not UTF-8 text`), state.stderr)
                assertEq(state.root['output.json'], undefined)
            }
            const root = {
                'input.f.js': [utf8('import a from "./a.json" with { type: "json" };\nexport default a;')],
                'a.json': [source('"a', bad, '"')],
            }
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.json'])))
            assertEq(exitCode(code), 1, state.stderr)
            assert(state.stderr.includes('a.json - error: not UTF-8 text'), state.stderr)
        }
        // Correct UTF-8 beyond ASCII still reads, a four-byte sequence included.
        const root = { 'input.f.js': [utf8('export default "é中😀";')] }
        const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.json'])))
        assertEq(exitCode(code), 0, state.stderr)
        assertEq(readOutput(state.root, 'output.json'), '"é中😀"')
    },
    tooManyArgs: () => {
        // A third argument is refused and named, not dropped: nothing reads
        // it, so a success would claim work the command line asked for and
        // never did (DESIGN.md §10). No output is written.
        const root = { 'input.f.js': [utf8('export default 42;')] }
        const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.json', '--tree'])))
        assertEq(exitCode(code), 1)
        assert(state.stderr.includes('unexpected argument --tree'), state.stderr)
        assertEq(state.root['output.json'], undefined)
    },
    success: () => {
        const root = { 'input.f.js': [utf8('export default 42;')] }
        const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.data.js'])))
        assertEq(exitCode(code), 0)
        const content = readOutput(state.root, 'output.data.js')
        assertEq(content, 'export default 42;')
    },
    // The output's directory is created when it does not exist, however deep.
    missingDirectory: () => {
        const root = { 'input.f.js': [utf8('export default 42;')] }
        const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'gen.out/sub/output.data.js'])))
        assertEq(exitCode(code), 0, state.stderr)
        const [, read] = virtual(state)(readUtf8File('gen.out/sub/output.data.js'))
        assertStructurallySame(read, ['ok', 'export default 42;'])
    },
    jsonOutput: () => {
        const root = { 'input.f.js': [utf8('export default 42;')] }
        const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.json'])))
        assertEq(exitCode(code), 0)
        const content = readOutput(state.root, 'output.json')
        assertEq(content, '42')
    },
    // An output is the language its extension declares, as an input is,
    // matched by the longest suffix first. The JavaScript names are nested
    // rather than disjoint — a DataJS document is a JavaScript module, and
    // so is the EDAG's — so the order is what picks the narrowest writer the
    // name asks for.
    interpretedData: () => {
        const source = 'export const f = x => x; export default 7;'
        assertEq(compileSource(source)('output.json'), '7')
        assertEq(compileSource(source)('output.data.js'), 'export default 7;')
        assertEq(compileSource('const f = x => x + 2; export default f(3);')('output.json'), '5')
        assertEq(compileSource('const f = x => y => x + y; export default f(2)(3);')('output.data.js'), 'export default 5;')
        assertEq(compileSource('export default [1, 2].map(x => x + 1);')('output.json'), '[2,3]')
        assertEq(jsonRefused('export const unused = null.x; export default 7;'), 'input.f.js - error: module initialization failed')
    },
    outputRoute: {
        // one module, every route it has a spelling in
        languages: () => {
            const source = 'const a = [1]; export default [a, a];'
            const dataJs = 'const $0=[1];export default [$0,$0];'
            assertEq(compileSource(source)('out.data.js'), dataJs)
            assertEq(compileSource(source)('out.data.mjs'), dataJs)
            assertEq(compileSource(source)('out.js'), dataJs)
            assertEq(compileSource(source)('out.mjs'), dataJs)
            const edag = 'const $0=["[]",[1]];export default ["{}",[[":","default",["[]",[$0,$0]]]]];'
            assertEq(compileSource(source)('out.edag.data.js'), edag)
            assertEq(compileSource(source)('out.edag.data.mjs'), edag)
            // JSON denotes a tree, so the shared node is written where each
            // reference reaches it
            assertEq(compileSource(source)('out.json'), '[[1],[1]]')
        },
        // The order of these is the claim: the longer suffix wins, so the
        // EDAG route and the DataJS one are both reachable although every
        // name here ends `.js`. A function tells the three apart, having a
        // spelling in the widest writer alone.
        longestSuffix: () => {
            assertEq(compileSource('export default [1];')('x.edag.data.js'), 'export default ["{}",[[":","default",["[]",[1]]]]];')
            assertEq(compileSource('export default [1];')('x.data.js'), 'export default [1];')
            assertEq(compileSource('export default [1];')('x.js'), 'export default [1];')
            assertEq(compileSource('export default (...a) => a;')('x.js'), 'export default (...$0)=>$0;')
            assertEq(compileSource('export default (...a) => a;')('x.edag.data.js'), 'export default ["{}",[[":","default",["=>",0,[],["rest"]]]]];')
            assertEq(moduleRefused('export default (...a) => a;'), 'output.data.js - error: callable materialization requires a target compile/load boundary')
        },
        // Any other JavaScript name is FunctionalScript: `.f.js` says which
        // subset a source is written in, and an output the compiler writes
        // is in that subset whatever it is called. `.d.js` is one of them:
        // it was DJS's spelling and went with the name.
        anyJavaScriptName: () => {
            assertEq(compileSource('export default (...a) => a;')('out.f.js'), 'export default (...$0)=>$0;')
            assertEq(compileSource('export default (...a) => a;')('out.f.mjs'), 'export default (...$0)=>$0;')
            assertEq(compileSource('export default (...a) => a;')('out.d.js'), 'export default (...$0)=>$0;')
            assertEq(compileSource('export default (...a) => a;')('a.js'), 'export default (...$0)=>$0;')
        },
        // A name declaring no language is refused, naming the eight — and
        // the input is not read at all, since there is nothing to read it
        // for. This is where the old fall-through went: every name that was
        // not `.json` used to be written as DataJS.
        unknown: () => {
            const expected = 'no output language for this extension: expected .json, .rs, .js, .mjs, .data.js, .data.mjs, .edag.data.js or .edag.data.mjs'
            /** @type {(outputFileName: string) => string} */
            const refused = outputFileName => {
                const root = { 'input.f.js': [utf8('export default 1;')] }
                const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', outputFileName])))
                assertEq(exitCode(code), 1)
                assertEq(state.root[outputFileName], undefined)
                return state.stderr.trim()
            }
            assertEq(refused('out.txt'), `out.txt - error: ${expected}`)
            assertEq(refused('out.ts'), `out.ts - error: ${expected}`)
            assertEq(refused('out'), `out - error: ${expected}`)
            // the input is never read: a missing one is refused the same way
            const [state, code] = virtual(emptyState)(compile(nodeProgramOptions(['missing.f.js', 'out.txt'])))
            assertEq(exitCode(code), 1)
            assertEq(state.stderr.trim(), `out.txt - error: ${expected}`)
        },
    },
    // The FunctionalScript output: the linked graph written back as source,
    // rather than the value the program denotes. This route preserves code
    // without evaluating module initializers.
    fjsOutput: {
        // the same sources, side by side, in the two module outputs: an
        // access is read by the value output and stays an access here, a
        // selected function has no DataJS document, and an anchor is
        // a `const` in both
        graph: () => {
            assertEq(fjsRoundTrip('const a = { b: 1 }; export default a.b;'), 'export default {"b":1}.b;')
            assertEq(compileSource('const a = { b: 1 }; export default a.b;')('output.data.js'), 'export default 1;')
            assertEq(fjsRoundTrip('export default (...a) => a;'), 'export default (...$0)=>$0;')
            assertEq(moduleRefused('export default (...a) => a;'), 'output.data.js - error: callable materialization requires a target compile/load boundary')
            assertEq(fjsRoundTrip('const f = (...a) => 1; export default 2;'), 'const $0=()=>1;export default 2;')
            // an empty parameter list reaches here as the node a rest
            // parameter's function does, the AST carrying no parameter, and
            // the writer names the rest parameter only where the body reads
            // it — so both lists are written `()`, one node, one text
            assertEq(fjsRoundTrip('export default () => 1;'), 'export default ()=>1;')
            // a function's own name is its `self`, written as the `const` it read
            assertEq(fjsRoundTrip('const f = () => f();\nexport default f;'), 'const $0=()=>$0();export default $0;')
            // a shorthand member is written as the member it denotes
            assertEq(fjsRoundTrip('const a = [1];\nexport default { a, b: a };'), 'const $0=[1];export default {"a":$0,"b":$0};')
            // an unused alias of the name is dropped with the `const`, as an alias of a capture is
            assertEq(fjsRoundTrip('const f = () => { const g = f; return 1; };\nexport default f;'), 'export default ()=>1;')
        },
        // The lazy operators and the conditional, and the block a lazy
        // operand opens where it needs one: a call of a parameterless
        // function written at the call, which the lowering inlines, so
        // the text reads back as the graph it was written from — the same
        // graph, not the same text: `(() => [1, 2])()` is the array.
        lazy: () => {
            assertEq(fjsRoundTrip('export default (...a) => (a[0] && a[1] || a[2]) ?? a[3];'), 'export default (...$0)=>($0[0]&&$0[1]||$0[2])??$0[3];')
            assertEq(fjsRoundTrip('export default (...a) => a[0] ? a[1] ? 1 : 2 : a[2] ? 3 : 4;'), 'export default (...$0)=>$0[0]?$0[1]?1:2:$0[2]?3:4;')
            assertEq(fjsRoundTrip('export default (() => [1, 2])();'), 'export default [1,2];')
            assertEq(fjsRoundTrip('export default (() => { const x = [1]; return [x, x]; })();'), 'const $0=[1];export default [$0,$0];')
            assertEq(fjsRoundTrip('export default (...a) => a[0] ? (() => { const x = [1]; return [x, x]; })() : 4;'), 'export default (...$0)=>$0[0]?(()=>{const $1=[1];return [$1,$1];})():4;')
            assertEq(fjsRoundTrip('export default (...a) => a[0] && (() => { const x = null.x; return 1; })();'), 'export default (...$0)=>$0[0]&&(()=>{const $1=null.x;return 1;})();')
            assertEq(fjsRoundTrip('export default (...a) => [(() => { const x = null.x; return 1; })()];'), 'export default ()=>{const $0=null.x;return [1];};')
            assertEq(fjsRoundTrip('export default (...a) => a[0] ? (() => { const x = [1]; return [a[1] && x, a[2] && x]; })() : 4;'), 'export default (...$0)=>$0[0]?(()=>{const $1=[1];return [$0[1]&&$1,$0[2]&&$1];})():4;')
            assertEq(fjsRoundTrip('export default (...a) => a[0] ? (() => { const x = [1]; return [x, x, (() => { const y = [2]; return a[1] ? [y, y] : 1; })()]; })() : 4;'), 'export default (...$0)=>$0[0]?(()=>{const $1=[2];const $2=[1];return [$2,$2,$0[1]?[$1,$1]:1];})():4;')
            assertEq(fjsRoundTrip('const c = []; export default (...a) => [a[0] && c, a[1] && c];'), 'const $0=[];export default (...$1)=>[$1[0]&&$0,$1[1]&&$0];')
            assertEq(fjsRoundTrip('export default (...a) => { const y = a[0] ? [] : 1; return [y, y]; };'), 'export default (...$0)=>{const $1=$0[0]?[]:1;return [$1,$1];};')
            // an unused alias of a capture leaves no slot behind, in a body
            // or in a call inlined into one; the `const` is anchored instead
            assertEq(fjsRoundTrip('const c = [1]; export default (...a) => { const x = c; return 1; };'), 'const $0=[1];export default ()=>1;')
            assertEq(fjsRoundTrip('const c = null.x; export default (...a) => (() => { const x = c; return 1; })();'), 'const $0=null.x;export default ()=>1;')
            assertEq(fjsRoundTrip('const c = [1]; export default (...a) => { const x = c; return [x, c]; };'), 'const $0=[1];export default ()=>[$0,$0];')
            assertEq(fjsRoundTrip('export const f = (...a) => a[0] ? (() => { const x = [1]; return [x, x]; })() : 4; export default 1;'), 'const $0=(...$1)=>$1[0]?(()=>{const $2=[1];return [$2,$2];})():4;export const f=$0;export default 1;')
        },
        // Stage A's operators, with the parentheses JavaScript's own
        // precedence and associativity ask for and no more, so that the
        // text reads back as the graph: a group the source wrote that
        // changed nothing is gone, and one it needed is written again.
        operators: () => {
            assertEq(fjsRoundTrip('export default 1 + 2 * 3;'), 'export default 1+2*3;')
            assertEq(fjsRoundTrip('export default (1 + 2) * 3;'), 'export default (1+2)*3;')
            assertEq(fjsRoundTrip('export default (1 + 2) + 3;'), 'export default 1+2+3;')
            assertEq(fjsRoundTrip('export default 1 - (2 - 3);'), 'export default 1-(2-3);')
            assertEq(fjsRoundTrip('export default 2 ** 3 ** 2;'), 'export default 2**3**2;')
            assertEq(fjsRoundTrip('export default (2 ** 3) ** 2;'), 'export default (2**3)**2;')
            assertEq(fjsRoundTrip('export default (-2) ** 2;'), 'export default (-2)**2;')
            assertEq(fjsRoundTrip('export default -(2 ** 2);'), 'export default -(2**2);')
            assertEq(fjsRoundTrip('export default 2 ** -2;'), 'export default 2**-2;')
            assertEq(fjsRoundTrip('export default 1 - -2;'), 'export default 1- -2;')
            assertEq(fjsRoundTrip('export default 1 << 2 + 3 < 5 === true & 1 ^ 2 | 3;'), 'export default 1<<2+3<5===true&1^2|3;')
            assertEq(fjsRoundTrip('export default ((1 << 2) + 3 < 5) === (true & (1 ^ (2 | 3)));'), 'export default (1<<2)+3<5===(true&(1^(2|3)));')
            assertEq(fjsRoundTrip('export default ~1 + -[] * 1n;'), 'export default ~1+-[]*1n;')
            assertEq(fjsRoundTrip('export default !(1 + 2) === !!-[];'), 'export default !(1+2)===!!-[];')
            assertEq(fjsRoundTrip('export default typeof (1 + 2) === typeof typeof [];'), 'export default typeof (1+2)===typeof typeof [];')
            assertEq(fjsRoundTrip('export default Number(" 4 ") + Number(1n) * -Number([7]);'), 'export default Number(" 4 ")+Number(1n)*-Number([7]);')
            assertEq(compileSource('export default Number("0x10");')('output.json'), '16')
            assert(compileSource('export default Number("0x10");')('output.rs').includes('(Any::number(string_any("0x10")))?;\n'))
            assertEq(fjsRoundTrip('export default (1 + 2).x;'), 'export default (1+2).x;')
            assertEq(fjsRoundTrip('export default (-[1])[0];'), 'export default (-[1])[0];')
            assertEq(fjsRoundTrip('export default -((...a) => 1);'), 'export default -(()=>1);')
            assertEq(fjsRoundTrip('export default (...a) => (a[0] + 1) && a[1] + (a[2] ? 1 : 2);'), 'export default (...$0)=>$0[0]+1&&$0[1]+($0[2]?1:2);')
            assertEq(fjsRoundTrip('const o = []; export default [o + 1, o + 1];'), 'const $0=[];export default [$0+1,$0+1];')
            assertEq(compileSource('export default 1 + 2 * 3;')('x.edag.data.js'), 'export default ["{}",[[":","default",["+",1,["*",2,3]]]]];')
            assertEq(compileSource('export default 1 + 2;')('output.data.js'), 'export default 3;')
        },
        // An object's members are the graph's here and the value's there, so
        // the two outputs order them differently and hold a different number
        // of them: the value output writes the object JavaScript builds from
        // the literal — array-index keys first, a repeated key keeping its
        // first position and its last value — and this one writes the
        // literal's members as the node holds them.
        //
        // The last pair is the sharpest: a member a later duplicate shadows
        // is in the graph and not in the value, so the `[]` is written here
        // and nowhere else. Dropping it would make a different node, which
        // is why the round trip holds over all three.
        members: () => {
            assertEq(fjsRoundTrip('export default {b:1,"0":2,a:3,b:4};'), 'export default {"b":1,"0":2,"a":3,"b":4};')
            assertEq(compileSource('export default {b:1,"0":2,a:3,b:4};')('output.data.js'), 'export default {"0":2,"b":4,"a":3};')
            assertEq(fjsRoundTrip('export default {"2":1,"1":2,a:3};'), 'export default {"2":1,"1":2,"a":3};')
            assertEq(compileSource('export default {"2":1,"1":2,a:3};')('output.data.js'), 'export default {"1":2,"2":1,"a":3};')
            assertEq(fjsRoundTrip('const x = []; export default {a: x, a: 1};'), 'export default {"a":[],"a":1};')
            assertEq(compileSource('const x = []; export default {a: x, a: 1};')('output.data.js'), 'export default {"a":1};')
        },
        // the module is not evaluated, so a program whose value the readers
        // refuse — a read of `null`, which the DataJS output reports against
        // the input — is written: the failure is the program's to make when
        // it runs
        unevaluated: () => {
            assertEq(fjsRoundTrip('const n = null; const check = n.x; export default 1;'), 'const $0=null.x;export default 1;')
            assertEq(moduleRefused('const n = null; const check = n.x; export default 1;'), 'input.f.js - error: module initialization failed')
        },
        // Imported evaluation sequences use the same ordered declaration
        // writer needed when a mixed module's default is selected.
        importedSequence: () => {
            const root = {
                'input.f.js': [utf8('import m from "./m.f.js"; export default [m];')],
                'm.f.js': [utf8('const u = []; export default 1;')],
            }
            const [output, outputCode] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.f.js'])))
            assertEq(exitCode(outputCode), 0, output.stderr)
            assertStructurallySame(evaluate(readOutput(output.root, 'output.f.js')), ['ok', [1]])
            // the EDAG holds it, the comma being a node like any other
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.edag.data.js'])))
            assertEq(exitCode(code), 0, state.stderr)
            assertEq(readOutput(state.root, 'output.edag.data.js'), 'export default ["{}",[[":","default",["[]",[[",",[["[]",[]],1]]]]]]];')
        },
        // the input's own failures stay the input's, this route reading it
        // through the same linker the EDAG route does
        input: () => {
            assertEq(fjsRefused({ 'input.f.js': [utf8('export default @')] }), 'input.f.js:1:16-17 - error: unexpected token')
            assertEq(fjsRefused({ 'input.f.js': [utf8('import m from "./m.f.js"; export default [m];')] }), 'm.f.js - error: file not found')
        },
        // a `.json` input reaches this route too, as it reaches the others
        jsonInput: () => {
            const root = { 'a.json': [utf8('{"a":[1]}')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['a.json', 'out.f.js'])))
            assertEq(exitCode(code), 0, state.stderr)
            assertEq(readOutput(state.root, 'out.f.js'), 'export default {"a":[1]};')
        },
    },
    // The round trip through the compiler: compile to `.f.js`, compile the
    // output again, and the two graphs are one — the law the writer's own
    // proof states over generated graphs, here over the command, file system
    // and linker included.
    fjsRoundTrip: fjsCorpus.map(source => () => { fjsRoundTrip(source) }),
    // Normalized form is a fixed point of the `.f.js` route as well as the
    // `.data.js` one, over the whole corpus: the two writers agree on every
    // document DataJS can spell, so a data module compiles to the same bytes
    // under either name, and they part only where a graph holds what no
    // value does.
    fjsFixedPoint: normalizeSet.map(({ id, text }) => () => {
        assertEq(compileSource(text)('output.f.js'), text, id)
    }),
    // The EDAG output: the program linked into one graph and written as a
    // DataJS document, its shared node hoisted as the DataJS output hoists
    // one — the README's example, in both forms, side by side.
    edagOutput: {
        graph: () => {
            const root = {
                'input.f.js': [utf8('import c from "./m.f.js"; const a = 1; export default [a, a, c, { x: c }];')],
                'm.f.js': [utf8('export default ["text"];')],
            }
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.edag.data.js'])))
            assertEq(exitCode(code), 0, state.stderr)
            assertEq(readOutput(state.root, 'output.edag.data.js'), 'const $0=["[]",["text"]];export default ["{}",[[":","default",["[]",[1,1,$0,["{}",[[":","x",$0]]]]]]]];')
            const [moduleState, moduleCode] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.data.js'])))
            assertEq(exitCode(moduleCode), 0, moduleState.stderr)
            assertEq(readOutput(moduleState.root, 'output.data.js'), 'const $0=["text"];export default [1,1,$0,{"x":$0}];')
        },
        // `.edag.data.mjs` asks for the same; `.data.mjs` alone is DataJS
        extension: () => {
            const root = { 'input.f.js': [utf8('export default { a: undefined };')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.edag.data.mjs'])))
            assertEq(exitCode(code), 0, state.stderr)
            assertEq(readOutput(state.root, 'output.edag.data.mjs'), 'export default ["{}",[[":","default",["{}",[[":","a",["undefined"]]]]]]];')
            const [moduleState, moduleCode] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.data.mjs'])))
            assertEq(exitCode(moduleCode), 0, moduleState.stderr)
            assertEq(readOutput(moduleState.root, 'output.data.mjs'), 'export default {"a":undefined};')
        },
        // a property access compiles to the EDAG as the operation, and to
        // the value outputs as what it reads
        access: () => {
            const root = { 'input.f.js': [utf8('const a = { b: 1 }; export default a.b;')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.edag.data.js'])))
            assertEq(exitCode(code), 0, state.stderr)
            assertEq(readOutput(state.root, 'output.edag.data.js'), 'export default ["{}",[[":","default",[".",["{}",[[":","b",1]]],"b"]]]];')
            assertEq(compileSource('const a = { b: 1 }; export default a.b;')('output.data.js'), 'export default 1;')
            assertEq(compileSource('const a = { b: 1 }; export default a.b;')('output.json'), '1')
        },
        // what the export does not reach is anchored by the comma operation,
        // so the graph holds it where the value outputs refuse the module or
        // drop the value: `n.x` on a `null` fails `run`, and is a node here
        anchored: () => {
            assertEq(compileSource('const a = []; export default 1;')('output.edag.data.js'), 'export default [",",[["[]",[]],["{}",[[":","default",1]]]]];')
            assertEq(compileSource('const n = null; const check = n.x; export default 1;')('output.edag.data.js'), 'export default [",",[[".",null,"x"],["{}",[[":","default",1]]]]];')
            assertEq(moduleRefused('const n = null; const check = n.x; export default 1;'), 'input.f.js - error: module initialization failed')
        },
        // a function is written as its EDAG: its arguments one node, hoisted
        // where the body reaches them twice, and two functions sharing none;
        // Data outputs refuse a selected function after interpretation.
        func: () => {
            assertEq(compileSource('export default (...a) => a;')('output.edag.data.js'), 'export default ["{}",[[":","default",["=>",0,[],["rest"]]]]];')
            assertEq(compileSource('export default (...a) => [a, a];')('output.edag.data.js'), 'const $0=["rest"];export default ["{}",[[":","default",["=>",0,[],["[]",[$0,$0]]]]]];')
            assertEq(compileSource('export default [(...a) => a, (...a) => a];')('output.edag.data.js'), 'export default ["{}",[[":","default",["[]",[["=>",0,[],["rest"]],["=>",0,[],["rest"]]]]]]];')
            assertEq(compileSource('const f = (...a) => 1; export default 2;')('output.edag.data.js'), 'export default [",",[["=>",0,[],1],["{}",[[":","default",2]]]]];')
            assertEq(moduleRefused('export default (...a) => a;'), 'output.data.js - error: callable materialization requires a target compile/load boundary')
            assertEq(compileSource('const f = (...a) => 1; export default 2;')('output.data.js'), 'export default 2;')
            assertEq(jsonRefused('export default (...a) => a;'), 'output.json - error: callable materialization requires a target compile/load boundary')
        },
        // A body `const` compiles: the shared node it names is one node in
        // the graph, and an entry the returned value does not reach is
        // anchored by a comma inside the body — the first comma the
        // compiler emits anywhere but a module's root.
        bodyConst: () => {
            assertEq(compileSource('export default (...a) => { const x = [1]; return [x, x]; };')('output.edag.data.js'), 'const $0=["[]",[1]];export default ["{}",[[":","default",["=>",0,[],["[]",[$0,$0]]]]]];')
            assertEq(compileSource('export default (...a) => { const x = []; return 1; };')('output.edag.data.js'), 'export default ["{}",[[":","default",["=>",0,[],[",",[["[]",[]],1]]]]]];')
            // the value outputs refuse the module for its function, as ever
            assertEq(moduleRefused('export default (...a) => { const x = 1; return x; };'), 'output.data.js - error: callable materialization requires a target compile/load boundary')
            // and the FunctionalScript output writes the body back as a
            // body, `const`s and all: the round trip is the claim, and the
            // text is pinned because the names are the writer's to choose
            assertEq(fjsRoundTrip('export default (...a) => { const x = [1]; return [x, x]; };'), 'export default ()=>{const $0=[1];return [$0,$0];};')
            assertEq(fjsRoundTrip('export default (...a) => { const x = []; return 1; };'), 'export default ()=>{const $0=[];return 1;};')
            // a `const` the body does not need is not written: one naming a
            // value reached once is that value in place, as at the module
            // level
            assertEq(fjsRoundTrip('export default (...a) => { const x = 1; return x; };'), 'export default ()=>1;')
            // One counter spans the module and both bodies, so no two
            // scopes declare a generated name with the same spelling.
            assertEq(fjsRoundTrip('const m = [1]; export default [m, m, (...a) => { const x = [2]; return [x, x]; }];'), 'const $0=[1];export default [$0,$0,()=>{const $1=[2];return [$1,$1];}];')
            assertEq(fjsRoundTrip('export default (...a) => { const f = (...b) => { const y = [1]; return [y, y]; }; return f; };'), 'export default ()=>()=>{const $0=[1];return [$0,$0];};')
            // a body's `const` may name the arguments, which no module `const` can
            assertEq(fjsRoundTrip('export default (...a) => { const x = [a]; return [x, x]; };'), 'export default (...$0)=>{const $1=[$0];return [$1,$1];};')
        },
        // Calls execute for data outputs and remain code for code outputs.
        call: () => {
            assertEq(compileSource('const f = (...a) => 1; export default f(1);')('output.edag.data.js'), 'export default ["{}",[[":","default",["()",["=>",0,[],1],[1]]]]];')
            assertEq(compileSource('const o = { b: 1 }; export default o.b(2);')('output.edag.data.js'), 'export default ["{}",[[":","default",[".",["{}",[[":","b",1]]],"b",["|()",[2]]]]]];')
            // a member function `fjs/js/prototype`'s `allowedCalls` names is
            // a method call like any other, where the same name is refused
            // as a read; one its `prohibitedCalls` names is refused at the key
            assertEq(compileSource('export default [1, 2].at(0);')('output.edag.data.js'), 'export default ["{}",[[":","default",[".",["[]",[1,2]],"at",["|()",[0]]]]]];')
            assertEq(moduleRefused('export default [1, 2].at;'), 'input.f.js:1:23 - error: prohibited property name')
            assertEq(moduleRefused('export default [1, 2].push(0);'), 'input.f.js:1:23 - error: prohibited member function')
            // Calling a number fails during initialization.
            assertEq(moduleRefused('export default [1][0](2);'), 'input.f.js - error: module initialization failed')
            assertEq(jsonRefused('export default [1][0](2);'), 'input.f.js - error: module initialization failed')
            // the writer spells both forms: the plain call, and the method
            // call on its access
            assertEq(fjsRoundTrip('const f = (...a) => 1; export default f(1);'), 'const $0=()=>1;export default $0(1);')
            assertEq(fjsRoundTrip('export default [1][0](2);'), 'export default [1][0](2);')
        },
        // The optional chains: each spelling reads back as the graph it
        // was written from, a group kept where it closed a region, and the
        // value outputs answer as JavaScript does — `undefined` for a
        // nullish base, the steps after it skipped.
        chains: () => {
            const o = 'const a = { b: { c: 1, d: (...x) => x } }; const n = null; '
            assertEq(compileSource(`${o}export default [a?.b.c, n?.b.c, a?.b?.c, (a?.b).c];`)('output.data.js'), 'export default [1,undefined,1,1];')
            assertEq(compileSource(`${o}export default [a?.b.d(1, 2), n?.b.d(1), a.b?.d(3), n?.(1), n?.b.d((() => { throw 0; })())];`)('output.data.js'), 'export default [[1,2],undefined,[3],undefined,undefined];')
            assertEq(compileSource(`${o}export default [(a?.b)?.d?.(1), a?.b.d?.(1).length, (a?.b.d)(2)];`)('output.data.js'), 'export default [[1],1,[2]];')
            assertEq(compileSource('const a = [1]; export default [a?.at(0), a?.length, a?.[0], a?.["length"]];')('output.data.js'), 'export default [1,1,1,1];')
            // a group ends the region: `.c` of `undefined` throws
            assertEq(moduleRefused('const n = null; export default (n?.b).c;'), 'input.f.js - error: module initialization failed')
            assertEq(compileSource('const n = null; export default n?.b.c;')('output.edag.data.js'), 'export default ["{}",[[":","default",["?.",null,"b",["|.","c"]]]]];')
            assertEq(compileSource('const f = (...x) => x; export default f?.(1).length;')('output.edag.data.js'), 'export default ["{}",[[":","default",["?.()",["=>",0,[],["rest"]],[1],["|.","length"]]]]];')
            assertEq(fjsRoundTrip(`${o}export default [a?.b.c, (a?.b).c, a?.b?.c, a?.b.d(1).length, (a?.b.d)(1), a?.b?.d?.(1), a.b?.d(1), (a.b?.d(1))(2), n?.(1)?.(2), (n?.(1))(2)];`), 'const $0={"b":{"c":1,"d":(...$1)=>$1}};export default [$0?.b.c,($0?.b).c,$0?.b?.c,$0?.b.d(1).length,($0?.b.d)(1),$0?.b?.d?.(1),$0.b?.d(1),($0.b?.d(1))(2),null?.(1)?.(2),(null?.(1))(2)];')
            assertEq(fjsRoundTrip('export default (...x) => [x?.[0], x?.["a b"], x[0]?.y, 1?.x];'), 'export default (...$0)=>{const $1=1;return [$0?.[0],$0?.["a b"],$0[0]?.y,$1?.x];};')
            // a key is judged as an access's: refused at the key, through a step too
            assertEq(moduleRefused('export default [1, 2]?.at;'), 'input.f.js:1:24 - error: prohibited property name')
            assertEq(moduleRefused('export default [1, 2]?.push(0);'), 'input.f.js:1:24 - error: prohibited member function')
            assertEq(moduleRefused('export default [[1]]?.at(0).push(0);'), 'input.f.js:1:29 - error: prohibited member function')
        },
        // a program the linker refuses is reported against the input, as a
        // parse error is, and nothing is written: a missing import
        refused: () => {
            const missing = { 'input.f.js': [utf8('import m from "./m.f.js"; export default [m];')] }
            const [missingState, missingCode] = virtual({ ...emptyState, root: missing })(compile(nodeProgramOptions(['input.f.js', 'output.edag.data.js'])))
            assertEq(exitCode(missingCode), 1)
            assertEq(missingState.stderr.trim(), 'm.f.js - error: file not found')
        },
    },
    // The `.rs` output: the linked EDAG printed as a generated Rust module
    // against the `nanvm-lib` API, by `fjs/compiler/rust/module.f.mjs`'s shared
    // printer — see `fjs/edag/rust/module.f.mjs`.
    rustOutput: {
        // Property access on an object literal, the same source the EDAG
        // and value outputs above compile, to a `pub fn module<A: IVm>()`.
        graph: () => {
            assertEq(
                compileSource('const a = { b: 1 }; export default a.b;')('output.rs'),
                `// @generated by \`fjs compile\`. Do not edit: recompile the source module instead.

use nanvm_lib::vm::unstable::{f64_any, string_any, string_key};
use nanvm_lib::vm::{Any, IVm, ToAny, ToObject};

#[rustfmt::skip]
pub fn module<A: IVm>() -> Result<Any<A>, Any<A>> {
    let c0: Any<A> = [(string_key("b"), f64_any(0x3ff0000000000000))].to_object().to_any();
    let c1: Any<A> = Any::dot(c0, string_any("b")).end()?;
    Ok([(string_key("default"), c1)].to_object().to_any())
}
`)
        },
        // Indexing an array literal — refused until `nanvm-lib` could read
        // an array — now prints like any other property access.
        indexingAnArrayLiteral: () => {
            assertEq(
                compileSource('const a = [1]; export default a[0];')('output.rs'),
                `// @generated by \`fjs compile\`. Do not edit: recompile the source module instead.

use nanvm_lib::vm::unstable::{f64_any, string_key};
use nanvm_lib::vm::{Any, IVm, ToAny, ToArray, ToObject};

#[rustfmt::skip]
pub fn module<A: IVm>() -> Result<Any<A>, Any<A>> {
    let c0: Any<A> = [f64_any(0x3ff0000000000000)].to_array().to_any();
    let c1: Any<A> = Any::dot(c0, f64_any(0x0000000000000000)).end()?;
    Ok([(string_key("default"), c1)].to_object().to_any())
}
`)
        },
        // An output past one `Vec`, 128 KiB, is written whole, in several
        // chunks, where it once ended the compile with a bare `assertion failed`.
        largeOutput: () => {
            const source = `export default [${Array.from({ length: 5000 }, (_, i) => i).join(', ')}];`
            const root = { 'input.f.js': [utf8(source)] }
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.rs'])))
            assertEq(exitCode(code), 0, state.stderr)
            const file = state.root['output.rs']
            assert(Array.isArray(file), file)
            assert(file.length > 1, file.length)
            const text = file.map(utf8ToString).join('')
            assert(text.length > Number(maxLengthBytes), text.length)
            assert(text.endsWith('}\n'), text.slice(-20))
        },
        // A property read on a nullish base compiles: the `.rs` output is a
        // program, and the read throws when it runs, as JavaScript throws —
        // the compiler predicts nothing of a program it writes, where the
        // data outputs evaluate the module and report the throw as theirs.
        nullishBase: () => {
            assert(compileSource('const a = null; export default a.x;')('output.rs')
                .includes('Any::dot(Nullish::Null.to_any(), string_any("x")).end()?'))
        },
        // A bigint outside `i64` is written as its sign and `u64` words,
        // which a literal's own text cannot be.
        wideBigint: () => {
            assert(compileSource('export default 9223372036854775808n;')('output.rs')
                .includes('bigint_any_words(false, &[0x8000000000000000])'))
        },
        // Every eager operator prints as a temporary, its `let` followed
        // by `?`: `pub fn module` answers the `Result` a throw lands in, so
        // the temporary is an `Any<A>`, referenced by name in the export
        // object. A negated *literal* never reaches the printer as a node —
        // the lowering folds it into the number — and prints as it always
        // did.
        operators: () => {
            /** The lines of the module's body. @type {(source: string) => readonly string[]} */
            const body = source => compileSource(source)('output.rs').split('\n').filter(line => line.startsWith('    '))
            /** @type {(source: string, value: string) => void} */
            const expect = (source, value) => assertStructurallySame(body(source), [
                `    let c0: Any<A> = ${value};`,
                '    Ok([(string_key("default"), c0)].to_object().to_any())',
            ])
            const one = 'f64_any(0x3ff0000000000000)'
            const two = 'f64_any(0x4000000000000000)'
            expect('export default 1 + 2;', `(${one} + ${two})?`)
            expect('export default 1 - 2;', `(${one} - ${two})?`)
            expect('export default 1 * 2;', `(${one} * ${two})?`)
            expect('export default 1 / 2;', `(${one} / ${two})?`)
            expect('export default 1 % 2;', `(${one} % ${two})?`)
            expect('export default 1 ** 2;', `(Any::pow(${one}, ${two}))?`)
            expect('export default 1 === 2;', `(strict_eq(${one}, ${two}))?`)
            expect('export default 1 !== 2;', `(strict_ne(${one}, ${two}))?`)
            expect('export default 1 < 2;', `(Any::lt(${one}, ${two}))?`)
            expect('export default 1 <= 2;', `(Any::le(${one}, ${two}))?`)
            expect('export default 1 > 2;', `(Any::gt(${one}, ${two}))?`)
            expect('export default 1 >= 2;', `(Any::ge(${one}, ${two}))?`)
            expect('export default 1 & 2;', `(${one} & ${two})?`)
            expect('export default 1 | 2;', `(${one} | ${two})?`)
            expect('export default 1 ^ 2;', `(${one} ^ ${two})?`)
            expect('export default 1 << 2;', `(${one} << ${two})?`)
            expect('export default 1 >> 2;', `(${one} >> ${two})?`)
            expect('export default 1 >>> 2;', `(Any::unsigned_right_shift(${one}, ${two}))?`)
            expect('export default ~1;', `(Any::bitwise_not(${one}))?`)
            expect('export default -"a";', '(-(string_any("a")))?')
            // an operand with operands of its own is a temporary before the
            // operation, referenced by name: a literal array, an inner
            // operation
            assertStructurallySame(body('export default -[1];'), [
                `    let c0: Any<A> = [${one}].to_array().to_any();`,
                '    let c1: Any<A> = (-(c0))?;',
                '    Ok([(string_key("default"), c1)].to_object().to_any())',
            ])
            assertStructurallySame(body('export default 1 + 2 * 1;'), [
                `    let c0: Any<A> = (${two} * ${one})?;`,
                `    let c1: Any<A> = (${one} + c0)?;`,
                '    Ok([(string_key("default"), c1)].to_object().to_any())',
            ])
            // `===` and `!==` import their helpers, as every literal does its own
            assertEq(
                compileSource('export default 1 === 2;')('output.rs').split('\n')[2],
                'use nanvm_lib::vm::unstable::{f64_any, strict_eq, string_key};')
            // the folded negations print as the leaves they lower to
            expect(
                'export default [-1, -1n, - -1, -Infinity, -0];',
                '[f64_any(0xbff0000000000000), bigint_any(-1), f64_any(0x3ff0000000000000), f64_any(0xfff0000000000000), f64_any(0x8000000000000000)].to_array().to_any()')
        },
        // A lazy operator's conditionally established operand prints as
        // the thunk `nanvm-lib` takes — `|| Ok(…)` around a value, an
        // operation's own line bound to a closure — so the `1n / 0n` a
        // `&&` never reaches, or the arm a `?:` does not select, is never
        // run: `nanvm-harness/fixtures/lazy.mjs` runs each against the VM.
        lazyOperators: () => {
            /** The lines of the module's body. @type {(source: string) => readonly string[]} */
            const body = source => compileSource(source)('output.rs').split('\n').filter(line => line.startsWith('    '))
            const one = 'f64_any(0x3ff0000000000000)'
            const two = 'f64_any(0x4000000000000000)'
            assertStructurallySame(body('export default 1 && 2;'), [
                `    let c0: Any<A> = (Any::logical_and(${one}, || Ok(${two})))?;`,
                '    Ok([(string_key("default"), c0)].to_object().to_any())',
            ])
            assertStructurallySame(body('export default false || 1n / 0n;'), [
                '    let c0 = || bigint_any(1) / bigint_any(0);',
                '    let c1: Any<A> = (Any::logical_or(false.to_any(), c0))?;',
                '    Ok([(string_key("default"), c1)].to_object().to_any())',
            ])
            assertStructurallySame(body('export default null ?? 1;'), [
                `    let c0: Any<A> = (Any::nullish_coalescing(Nullish::Null.to_any(), || Ok(${one})))?;`,
                '    Ok([(string_key("default"), c0)].to_object().to_any())',
            ])
            assertStructurallySame(body('export default true ? 1 : 2;'), [
                `    let c0: Any<A> = (Any::conditional(true.to_any(), || Ok(${one}), || Ok(${two})))?;`,
                '    Ok([(string_key("default"), c0)].to_object().to_any())',
            ])
            // a `const` reached only lazily is anchored — a `let` before
            // the root, as JavaScript establishes a `const` at its
            // declaration — and each thunk clones it
            assertStructurallySame(body('const c = [1]; export default [false && c, true && c];'), [
                `    let c0: Any<A> = [${one}].to_array().to_any();`,
                '    let c1: Any<A> = (Any::logical_and(false.to_any(), || Ok(c0.clone())))?;',
                '    let c2: Any<A> = (Any::logical_and(true.to_any(), || Ok(c0.clone())))?;',
                '    let c3: Any<A> = [c1, c2].to_array().to_any();',
                '    Ok([(string_key("default"), c3)].to_object().to_any())',
            ])
            // a function's arguments reached only lazily are no `const`
            // to anchor and need none: the parameter is bound already, so
            // the body binds it once and each thunk clones it
            assertStructurallySame(body('export default (...a) => true ? a : a;'), [
                '    let c0: Any<A> = A::static_function(|_self, args| {',
                '        let rest = args.clone().into_iter().to_array();',
                '        let c0 = || Ok(rest.clone().to_any());',
                '        Any::conditional(true.to_any(), c0, c0)',
                '    }, 0, Array::default(), Some("(...$0)=>true?$0:$0")).to_any();',
                '    Ok([(string_key("default"), c0)].to_object().to_any())',
            ])
            assertStructurallySame(body('export default (...a) => true ? [a] : [a, a];'), [
                '    let c0: Any<A> = A::static_function(|_self, args| {',
                '        let rest = args.clone().into_iter().to_array();',
                '        let c0: Any<A> = rest.clone().to_any();',
                '        let c1 = || Ok([c0.clone()].to_array().to_any());',
                '        let c2 = || Ok([c0.clone(), c0.clone()].to_array().to_any());',
                '        Any::conditional(true.to_any(), c1, c2)',
                '    }, 0, Array::default(), Some("(...$0)=>true?[$0]:[$0,$0]")).to_any();',
                '    Ok([(string_key("default"), c0)].to_object().to_any())',
            ])
        },
        // A shared operation is established once, in its `let`, with the
        // same `?`; each reference clones the value it produced, where a
        // value referenced once — the array — is moved.
        // A `const` inside an arm — a call inlined by the lowering — is a
        // shared node the arm alone reaches, bound in the arm's own block
        // and so established exactly when the arm is taken. Through the
        // whole of `fjs compile`, as the review of the design asked, so
        // that the shape's Rust is pinned by the compiler and not by the
        // corpus.
        inlinedCall: () => {
            assert(compileSource('const f = () => [1]; export default (...a) => a[0] ? (() => { const x = f(); return [x, x]; })() : 4;')('output.rs').includes([
                '        let c1 = || {',
                '            let c2: Any<A> = Any::call(A::frame(self_)[0].clone(), Array::default().to_any())?;',
                '            Ok([c2.clone(), c2.clone()].to_array().to_any())',
                '        };',
                '        Any::conditional(c0, c1, || Ok(f64_any(0x4010000000000000)))',
            ].join('\n')))
            // and one at an eager position, its anchor floated to the
            // scope's root, prints as an anchored `const` does
            assert(compileSource('export default [(() => { const x = null.x; return 1; })()];')('output.rs').includes([
                '    let _: Any<A> = Any::dot(Nullish::Null.to_any(), string_any("x")).end()?;',
                '    let c0: Any<A> = [f64_any(0x3ff0000000000000)].to_array().to_any();',
            ].join('\n')))
        },
        sharedOperation: () => {
            assertStructurallySame(
                compileSource('const a = 1 + 2; export default [a, a];')('output.rs').split('\n').filter(line => line.startsWith('    ')),
                [
                    '    let c0: Any<A> = (f64_any(0x3ff0000000000000) + f64_any(0x4000000000000000))?;',
                    '    let c1: Any<A> = [c0.clone(), c0.clone()].to_array().to_any();',
                    '    Ok([(string_key("default"), c1)].to_object().to_any())',
                ])
        },
    },
    // An error with no token to point at names the file being compiled, not
    // `undefined:undefined:undefined`. Each language reports its own missing
    // file: the module reader and the JSON reader read their inputs
    // separately.
    fileNotFound: {
        module: () => {
            const [state, code] = virtual(emptyState)(compile(nodeProgramOptions(['missing.f.js', 'output.data.js'])))
            assertEq(exitCode(code), 1)
            assertEq(state.stderr.trim(), 'missing.f.js - error: file not found')
            assertEq(state.root['output.data.js'], undefined)
        },
        json: () => {
            const [state, code] = virtual(emptyState)(compile(nodeProgramOptions(['missing.json', 'output.data.js'])))
            assertEq(exitCode(code), 1)
            assertEq(state.stderr.trim(), 'missing.json - error: file not found')
            assertEq(state.root['output.data.js'], undefined)
        },
        // A file that is there is never reported missing: the read's own
        // failure is what the error says.
        directory: () => {
            const [state, code] = virtual({ ...emptyState, root: { 'dir.f.js': {} } })(compile(nodeProgramOptions(['dir.f.js', 'output.data.js'])))
            assertEq(exitCode(code), 1)
            assertEq(state.stderr.trim(), 'dir.f.js - error: dir.f.js is not a regular file')
        },
    },
    // A source past one `Vec`, 128 KiB, is read whole, in several chunks,
    // where it was once refused as `file not found`.
    largeInput: () => {
        const comment = `// ${'x'.repeat(80000)}\n`
        const root = { 'input.f.js': [utf8(comment), utf8(`${comment}export default 7;`)] }
        const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.data.js'])))
        assertEq(exitCode(code), 0, state.stderr)
        assertEq(readOutput(state.root, 'output.data.js'), 'export default 7;')
    },
    // A parse error prints where it is — and, when the error knows how far the
    // offending source runs, how far: `path:line:column-column` on one line,
    // `path:line:column-line:column` across several, the plain point otherwise.
    // These pin the rendering, so they are the proof that a lexical span
    // survives the whole trip: tokenizer → parser → `errorLocation`.
    parseError: {
        spanOneLine: () => {
            const root = { 'bad.f.js': [utf8('export default @')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['bad.f.js', 'output.data.js'])))
            assertEq(exitCode(code), 1)
            assertEq(state.stderr.trim(), 'bad.f.js:1:16-17 - error: unexpected token')
            assertEq(state.root['output.data.js'], undefined)
        },
        spanAcrossLines: () => {
            // an unterminated string swallowing a newline: the far end names its
            // own line, because repeating the start's would place it wrongly
            const root = { 'bad.f.js': [utf8('export default "a\nb"')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['bad.f.js', 'output.data.js'])))
            assertEq(exitCode(code), 1)
            assertEq(state.stderr.trim(), 'bad.f.js:1:16-2:3 - error: unexpected token')
            assertEq(state.root['output.data.js'], undefined)
        },
        point: () => {
            // a *grammar* failure points at one token and has no span — see
            // `ParseError` in fjs/compiler/parser/types.ts for why
            const root = { 'bad.f.js': [utf8('export default ]')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['bad.f.js', 'output.data.js'])))
            assertEq(exitCode(code), 1)
            assertEq(state.stderr.trim(), 'bad.f.js:1:16 - error: unexpected token')
            assertEq(state.root['output.data.js'], undefined)
        },
    },
    // serialize → evaluate → structurally the same, one test per corpus value.
    // The emitter is only correct if its output is an input denoting the value
    // it was given, which no assertion on the text alone can state.
    roundTrip: roundTripCorpus.map(value => () => {
        const source = moduleText(value)
        const root = { 'input.f.js': [utf8(source)] }
        const [, result] = runtime({ ...emptyState, root })(transpile('input.f.js'))
        assert(result[0] === 'ok', result[1])
        assertStructurallySame(result[1], { default: value }, source)
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
        assertEq(compileSource(text)('output.data.js'), text, id)
    }),
    demo: {
        examples: () => {
            /** @type {Readonly<Record<string, string>>} */
            const expected = {
                'Overview': 'xxooo',
                'Primitives': 'xoooo',
                'String escapes': 'ooooo',
                'Comments': 'ooooo',
                'Objects': 'ooooo',
                'A repeated object key': 'ooooo',
                'Sharing: a const used twice': 'ooooo',
                'Sharing: a repeated expression': 'ooooo',
                'Arithmetic': 'ooooo',
                'Operator precedence': 'ooooo',
                'Logical not': 'ooooo',
                'typeof': 'ooooo',
                'instanceof': 'ooooo',
                'Number conversion': 'ooooo',
                'Laziness': 'ooooo',
                'Laziness: && || ??': 'xxooo',
                'Laziness: ?:': 'xxooo',
                'Function with a rest parameter': 'xxooo',
                'Closure': 'xxooo',
                'Recursion': 'ooooo',
                'Throw': 'xxooo',
                'Early return': 'xxooo',
                'Shorthand members': 'ooooo',
                'Methods and properties': 'ooooo',
                'Optional chaining': 'xoooo',
                'The entry helper': 'ooooo',
                'Named exports': 'ooooo',
                'A failure at run time': 'xxooo',
                'An import': 'xxxxx',
                'A named import and a call': 'xxxxx',
                'Hex escape': 'xxxxx',
                'Parse error': 'xxxxx',
            }
            assertEq(Object.keys(expected).length, examples.length)
            for (const [name, source] of examples) {
                assertEq(outputs.map(([, file]) => _compiled(source)(file)[0] === 'ok' ? 'o' : 'x').join(''), expected[name])
            }
            assertEq(textOfResult(_compiled('export default 1;')('output.json')), '1')
            assertEq(textOfResult(_compiled('const fact = n => n < 2 ? 1 : n * fact(n - 1);\nexport default fact(5);')('output.json')), '120')
            assertEq(textOfResult(_compiled('export default "\\x41";')('output.json')), 'unexpected token')
        },
        // A pane shows what `fjs compile` writes: the whole of `compile` over
        // the same file system answers the same text, or the same refusal.
        // And what a pane marks, the tokenizer agrees with, for the languages
        // it reads; Rust is unmarked until its printer says what it wrote.
        panesAreTheFiles: () => {
            assertEq(outputText('output.txt'), null)
            for (const [name, source] of examples) {
                for (const [label, file] of outputs) {
                    const shown = _compiled(source)(file)
                    const written = _written(source)(file)
                    const route = assertNotNullish(outputText(file))
                    const [, routed] = virtual({ ...emptyState, root: { 'input.f.js': [utf8(source)] } })(route('input.f.js'))
                    if (routed[0] === 'ok') {
                        const [kind, text] = routed[1]
                        assertEq(written[0], kind, `${name} ${label} text route`)
                        assertEq(written[1], kind === 'ok' ? text : `${file} - error: ${text}`, `${name} ${label} text route`)
                    }
                    assertEq(shown[0], written[0], `${name} ${label}`)
                    // a refusal is the command's line without its location
                    assert(shown[0] === 'ok' ? textOfResult(shown) === written[1] : written[1].endsWith(` - error: ${shown[1]}`), `${name} ${label}`)
                    if (shown[0] === 'ok' && label !== '.rs') {
                        assertEq(disagreement(shown[1]), null, `${name} ${label}`)
                    }
                }
            }
        },
        view: () => {
            const shown = htmlToString(demo.view(demo.init))
            assert(shown.includes('<h3>.rs</h3>'), shown)
            assert(shown.includes('<pre data-code="">'), shown)
            assert(shown.includes('callable materialization requires a target compile/load boundary</pre>'), shown)
            assert(!shown.includes(' - error:'), shown)
            const refused = htmlToString(demo.view('export default {bad'))
            assert(refused.includes('Refused:</p><pre data-result="error">unexpected end</pre>'), refused)
            assert(!refused.includes(' - error:'), refused)
            const unsupported = htmlToString(demo.view('export default undefined;'))
            assert(unsupported.includes('Refused:</p><pre data-result="error">no JSON spelling for undefined</pre>'), unsupported)
            assert(!unsupported.includes(' - error:'), unsupported)
        },
    },
}
