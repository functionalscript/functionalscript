/**
 * `fjs compile`: a FunctionalScript module read, its imports resolved and
 * inlined, and written out in the language the output name declares — JSON
 * for `.json`, normalized DataJS for `.data.js`, FunctionalScript for any
 * other `.js`, the EDAG the program compiles to for `.edag.data.js` (a
 * DataJS document of the graph), or a generated Rust module calling the
 * `nanvm-lib` API for `.rs`
 * ([fjs-nanvm-integration](../../todo/fjs-nanvm-integration.md)). An output
 * whose extension declares no such language is refused.
 *
 * @module
 *
 * @import { List } from '../types/list/types.ts'
 * @import { Result } from '../types/result/types.ts'
 * @import { Unknown } from '../media/datajs/types.ts'
 * @import { _CompileOp } from './types.ts'
 * @import { Denotation } from './ast/types.ts'
 * @import { ParseError } from './parser/types.ts'
 * @import { Effect } from '../effects/types.ts'
 * @import { ReadFile, ResolveFileModule } from '../effects/node/types.ts'
 */

import { _transpileDefault } from './transpiler/module.f.mjs'
import { resolve } from './edag/module.f.mjs'
import { toRust } from './rust/module.f.mjs'
import { _numberSerialize, tryStringify } from '../media/datajs/serializer/module.f.mjs'
import { tryStringify as fjsStringify, tryModuleStringify } from './serializer/module.f.mjs'
import { arrayWrap, boolSerialize, colon, nullSerialize, objectWrap, stringSerialize } from '../media/json/serializer/module.f.mjs'
import { flat, map } from '../types/list/module.f.mjs'
import { error, mapOk, ok, okList } from '../types/result/module.f.mjs'
import { concat } from '../types/string/module.f.mjs'
import { serialize as bigintSerialize } from '../types/bigint/module.f.mjs'
import { sort } from '../types/object/module.f.mjs'
import { mapStep, resultStep } from '../effects/module.f.mjs'
import { errorExit, exitStep, writeUtf8File } from '../effects/node/module.f.mjs'

const { entries } = Object

/**
 * Where an error happened, as much of it as is known: the token's
 * `path:line:column` when the reader tracks positions; otherwise the file
 * the error names, when it names one — a missing import, a cycle, a body
 * that fails to evaluate, in an imported module as readily as in the input;
 * and otherwise the name of the file being compiled — which nothing
 * `compile` runs produces any more, every reader naming its file, and
 * which the parser's one contract failure, a token list with no end,
 * still can; exported for that case's proof, the `_` saying so.
 *
 * An error that knows how far the offending source runs renders as a span,
 * `path:line:column-column` within one line and `path:line:column-line:column`
 * across several. Only lexical errors carry one today; a grammar failure points
 * at a single token and prints the point form.
 *
 * @type {(inputFileName: string) => (parseError: ParseError) => string}
 */
export const _errorLocation = inputFileName => ({ metadata, end, path }) => {
    if (metadata === null) { return path ?? inputFileName }
    const start = `${metadata.path}:${metadata.line}:${metadata.column}`
    if (end === undefined) { return start }
    // the path is printed once — a token does not straddle files — and the
    // line is dropped from the far end when the span stays on one line, so the
    // common case reads `a.js:1:1-7` rather than repeating `1:`
    const far = end.line === metadata.line
        ? `${end.column}`
        : `${end.line}:${end.column}`
    return `${start}-${far}`
}

// ── JSON output ───────────────────────────────────────────────────────────────

/**
 * Why a value cannot be written as JSON. The wording names the thing JSON
 * has no spelling for, because that is the whole reason: nothing here is
 * malformed, and the same value writes as a module without complaint.
 *
 * @type {(what: string) => Result<never, string>}
 */
const noJson = what => error(`no JSON spelling for ${what}`)

/**
 * A leaf in JSON, or the refusal. `undefined`, a bigint and the three
 * non-finite numbers are refused rather than approximated: `JSON.stringify`
 * writes `null` for `NaN` and drops an `undefined` member, and the extended
 * codec would write `1n` as `1`, which the standard reader takes back as
 * the *number* `1` — each a different value read back without a word. A
 * finite number is written by the DataJS rule, which is `ToString` with
 * `-0` kept, since `-0` is a JSON number that `JSON.stringify` alone loses.
 *
 * @type {(value: Unknown) => Result<List<string>, string>}
 */
const jsonLeaf = value => {
    switch (typeof value) {
        case 'boolean': { return ok(boolSerialize(value)) }
        case 'string': { return ok(stringSerialize(value)) }
        case 'number': { return isFinite(value) ? ok(_numberSerialize(value)) : noJson(`${value}`) }
        case 'bigint': { return noJson(`${value}n`) }
        case 'undefined': { return noJson('undefined') }
        default: { return ok(nullSerialize) }
    }
}

/** @type {(member: readonly [string, Unknown]) => Result<List<string>, string>} */
const jsonMember = ([key, value]) => mapOk(
    /** @type {(chunks: List<string>) => List<string>} */
    (chunks => flat([stringSerialize(key), colon, chunks]))
)(jsonValue(value))

/**
 * A value in JSON, or the refusal of a leaf. Members are written in the
 * order the object carries them, the order the DataJS output keeps too — the
 * other value output, and the one this walk shares its input with.
 * Sharing is not this walk's question: the front end answers it from the
 * module's syntax, so the walk carries no state.
 *
 * @type {(value: Unknown) => Result<List<string>, string>}
 */
const jsonValue = value => {
    if (value === null || typeof value !== 'object') { return jsonLeaf(value) }
    return value instanceof Array
        ? mapOk(arrayWrap)(okList(value.map(jsonValue)))
        : mapOk(objectWrap)(okList(entries(value).map(jsonMember)))
}

/**
 * The value as one JSON text, when it has one: every leaf spelled by JSON.
 * The value is a tree by the front end's word — {@link Denotation} says
 * whether two references reach one node, decided from the module's syntax
 * rather than by walking the value by identity — so this walk carries no
 * state and asks no question about sharing. Exported for the proofs, which
 * refuse one leaf at a time; `compile` is what a caller runs, and the `_`
 * says so.
 *
 * @type {(value: Unknown) => Result<string, string>}
 */
export const _tryJson = value => mapOk(concat)(jsonValue(value))

/**
 * A denotation as JSON. JSON denotes a tree, so a value with a node two
 * references reach is refused: writing the node twice would read back as
 * two nodes, and a document denoting a different graph is the silent
 * substitution the module output exists to avoid.
 *
 * @type {(denotation: Denotation) => Result<string, string>}
 */
const jsonText = ({ value, shared }) => shared ? noJson('a shared node') : _tryJson(value)

/** A denotation as a DataJS document, which denotes a graph and refuses nothing the front end builds. @type {(denotation: Denotation) => Result<string, string>} */
const dataJsText = ({ value }) => tryStringify(value)

// ── the route ─────────────────────────────────────────────────────────────────

/** Whether an output name ends with one of the suffixes. @type {(suffixes: readonly string[]) => (outputFileName: string) => boolean} */
const named = suffixes => outputFileName => suffixes.some(suffix => outputFileName.endsWith(suffix))

/**
 * Whether an output name asks for the EDAG: `.edag.data.js` or
 * `.edag.data.mjs`, a DataJS document like the DataJS output, so the
 * extension alone cannot tell them apart and the infix says which graph it
 * holds. Tested before {@link isDataJs}, whose suffix it ends with.
 *
 * Two names and no more, where {@link isFjs} takes every JavaScript name:
 * the EDAG is a specialized intermediate artifact, so what reaches it is
 * asked for exactly, never fallen into. And it is a DataJS document — a
 * document *of* a graph, not a program — so `.data` is the infix it belongs
 * under. It was `.edag.f.js` while every JavaScript name was written as
 * DataJS, which was wrong on both counts: it spent the language's own
 * extension on a data artifact, and it read as `.edag` modifying
 * FunctionalScript rather than DataJS. That spelling is retired and is now a
 * JavaScript name like any other, which the FunctionalScript writer takes —
 * no rule of its own, since a rule of its own is what this route is built
 * without.
 *
 * @type {(outputFileName: string) => boolean}
 */
const isEdag = named(['.edag.data.js', '.edag.data.mjs'])

/**
 * Whether an output name asks for DataJS: the two extensions its
 * specification recognizes
 * ([spec/datajs](../../spec/datajs/README.md#files-and-media-type)). `.d.js`
 * was DJS's spelling and went with the name, so it is a JavaScript module
 * like any other here and takes the writer {@link isFjs} names.
 *
 * Tested before {@link isFjs}, whose suffix it ends with: a DataJS document
 * is FunctionalScript too, so the narrower name is what picks the narrower
 * writer, the one that refuses a function.
 *
 * @type {(outputFileName: string) => boolean}
 */
const isDataJs = named(['.data.js', '.data.mjs'])

/**
 * Whether an output name asks for FunctionalScript: any JavaScript module,
 * since that is what a FunctionalScript module is. `.f.js` says which subset
 * a *source* file keeps to, and needs no rule here: an output the compiler
 * writes is in that subset whatever it is called.
 *
 * @type {(outputFileName: string) => boolean}
 */
const isFjs = named(['.js', '.mjs'])

/**
 * The program at `path` as the text of its EDAG: linked by `./edag` into
 * one graph, and written as a DataJS document in normalized form — the
 * graph is arrays, strings and numbers, and a node two references reach is
 * hoisted into a `const` as any shared node is, so the document reads back
 * as the same graph. The writer refuses nothing an EDAG holds.
 *
 * @type {(path: string) => Effect<ReadFile | ResolveFileModule, Result<string, string>, ParseError>}
 */
const edagText = path => mapStep(resolve(path), tryStringify)

/**
 * The program at `path` as the text of its `.rs` output: linked by `./edag`
 * into one graph, the same as {@link edagText}, and printed against the
 * `nanvm-lib` API by `./rust` rather than serialized as a DataJS document.
 *
 * @type {(path: string) => Effect<ReadFile | ResolveFileModule, Result<string, string>, ParseError>}
 */
const rustText = path => mapStep(resolve(path), toRust)

/**
 * The program at `path` as the text of the FunctionalScript module it is:
 * linked by `./edag` into one graph, the same as {@link edagText}, and
 * written back as source by `./serializer` rather than as a document of the
 * graph. This route does not evaluate the module — it rewrites the graph —
 * so a module holding a function compiles, and one whose value the readers
 * would refuse, a read of `null`, compiles too, the failure being the
 * program's to make when it runs.
 *
 * @type {(path: string) => Effect<ReadFile | ResolveFileModule, Result<string, string>, ParseError>}
 */
const fjsText = path => mapStep(resolve(path), graph => path.endsWith('.json') ? fjsStringify(graph) : tryModuleStringify(graph))

/**
 * Write the default export of a module, or the whole document for a direct
 * JSON input. Input language decides the boundary, never an object's keys.
 *
 * @type {(write: (denotation: Denotation) => Result<string, string>) => (path: string) => Effect<ReadFile | ResolveFileModule, Result<string, string>, ParseError>}
 */
const denotedText = write => path => mapStep(_transpileDefault(path), write)

/**
 * The text an output name asks for, from the input, or `null` when the name
 * declares no language this compiler writes. An output is the language its
 * extension names, as an input is, matched by the longest suffix first, so
 * that `x.edag.data.js` is the EDAG route, `x.data.js` the DataJS one, and
 * `x.js` FunctionalScript. The three are nested rather than disjoint — every
 * DataJS document is a JavaScript module, and so is the EDAG's — so the
 * order is what picks the narrowest writer the name asks for.
 *
 * A refusal of the output — a value JSON cannot spell, a graph the
 * FunctionalScript writer has no spelling for, a node shape the Rust printer
 * has no `nanvm-lib` spelling for — is the inner `Result`; a failure of the
 * input is the effect's; and a name with no language here is neither, since
 * there is nothing to read the input for.
 *
 * @type {(outputFileName: string) => ((inputFileName: string) => Effect<ReadFile | ResolveFileModule, Result<string, string>, ParseError>) | null}
 */
const outputText = outputFileName => {
    if (outputFileName.endsWith('.json')) { return denotedText(jsonText) }
    if (isEdag(outputFileName)) { return edagText }
    if (isDataJs(outputFileName)) { return denotedText(dataJsText) }
    if (isFjs(outputFileName)) { return fjsText }
    if (outputFileName.endsWith('.rs')) { return rustText }
    return null
}

/**
 * Why an output name is refused: it names no language, so there is no
 * writing it — the alternative, falling through to one of the writers,
 * would answer a name the compiler does not understand with a document in a
 * language the name does not declare.
 */
const unknownOutput = 'no output language for this extension: expected .json, .rs, .js, .mjs, .data.js, .data.mjs, .edag.data.js or .edag.data.mjs'

// ── the proofs' dump ──────────────────────────────────────────────────────────

/** @type {(member: readonly [string, Unknown]) => List<string>} */
const treeMember = ([key, value]) => flat([stringSerialize(key), colon, treeValue(value)])

/** @type {(value: Unknown) => List<string>} */
const treeValue = value => {
    switch (typeof value) {
        case 'boolean': { return boolSerialize(value) }
        case 'string': { return stringSerialize(value) }
        case 'number': { return _numberSerialize(value) }
        case 'bigint': { return [bigintSerialize(value)] }
        case 'undefined': { return ['undefined'] }
        default: {
            if (value === null) { return nullSerialize }
            return value instanceof Array
                ? arrayWrap(map(treeValue)(value))
                : objectWrap(map(treeMember)(sort(entries(value))))
        }
    }
}

/**
 * A value as one line a proof can pin: JSON's shape over the compiler's
 * leaves, with an object's members sorted by key. Neither output above is
 * that line — the module output hoists a shared node and keeps the members'
 * order, and the JSON output refuses what JSON cannot spell — so this walk
 * writes a shared node wherever it is reached, a bigint with its `n`, a
 * number as DataJS spells it, and `undefined` as a leaf, a member holding
 * it included. Nothing but proofs read it, which the `_` says: the token
 * streams and syntax trees they compare carry bigints, which
 * `JSON.stringify` cannot write.
 *
 * @type {(value: Unknown) => string}
 */
export const _stringifyTree = value => concat(treeValue(value))

// ── the command ───────────────────────────────────────────────────────────────

/**
 * Compiles the FunctionalScript module `args[0]` into `args[1]`, in the
 * language `args[1]`'s extension declares: JSON for `.json`, a generated
 * Rust module calling the `nanvm-lib` API for `.rs`, the program's EDAG for
 * `.edag.data.js` and `.edag.data.mjs`, a DataJS document for `.data.js`
 * and `.data.mjs`, and a FunctionalScript module for every other `.js` and
 * `.mjs`.
 * Each of the three module outputs is in normalized form — one line, shared
 * nodes hoisted into `$0`, `$1`, … and an object's members in the order the
 * module gave them. The DataJS and JSON outputs are the default export
 * (the document itself for a direct JSON input); the FunctionalScript output
 * is the linked graph written back as source, so it holds a function, which no value does; the EDAG output is
 * that graph, including the module's complete export object, as a DataJS
 * document; and the `.rs` output prints it as `let`
 * bindings and a `pub fn module<A: IVm>() -> Result<Any<A>, Any<A>>`.
 *
 * Returns the process exit code: `0` once the output file is written, `1` on
 * every failure — too few arguments, an output extension naming no language,
 * a missing input file, a parse error, a `.json` output asked of a value
 * JSON cannot spell, a `.js` output asked of a graph the writer has no
 * spelling for, an EDAG asked of a program whose export does not reach every
 * import and `const`, or a `.rs` output asked of a node shape it has no
 * `nanvm-lib` spelling for — so a caller can detect a failed compile from the
 * exit status alone. A refused output is reported against the output file,
 * since the module itself is sound; a refused program is reported against
 * the input, as a parse error is.
 *
 * @type {(args: readonly string[]) => Effect<_CompileOp, 0, number>}
 */
export const compile = args => {
    if (args.length < 2) {
        return errorExit('Error: Requires 2 or more arguments')
    }
    const inputFileName = args[0]
    const outputFileName = args[1]
    const text = outputText(outputFileName)
    if (text === null) {
        return errorExit(`${outputFileName} - error: ${unknownOutput}`)
    }
    return resultStep(
        text(inputFileName),
        /** @type {(result: Result<Result<string, string>, ParseError>) => Effect<_CompileOp, 0, number>} */
        (result) => {
            if (result[0] === 'error') {
                return errorExit(`${_errorLocation(inputFileName)(result[1])} - error: ${result[1].message}`)
            }
            const [tag, content] = result[1]
            return tag === 'error'
                ? errorExit(`${outputFileName} - error: ${content}`)
                : exitStep(writeUtf8File(outputFileName, content))
        })
}
