/**
 * `fjs compile`: a FunctionalScript module read, its imports resolved and
 * inlined, and the value it denotes written out — as normalized DataJS, as
 * JSON when the output name says so, or as the EDAG the program compiles
 * to, a DataJS document of the graph.
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
 * @import { ReadFile } from '../effects/node/types.ts'
 */

import { transpile } from './transpiler/module.f.mjs'
import { resolve } from './edag/module.f.mjs'
import { _numberSerialize, tryStringify } from '../media/datajs/serializer/module.f.mjs'
import { arrayWrap, boolSerialize, colon, nullSerialize, objectWrap, stringSerialize } from '../media/json/serializer/module.f.mjs'
import { empty, flat, map } from '../types/list/module.f.mjs'
import { error, mapOk, ok, okThen } from '../types/result/module.f.mjs'
import { concat } from '../types/string/module.f.mjs'
import { serialize as bigintSerialize } from '../types/bigint/module.f.mjs'
import { sort } from '../types/object/module.f.mjs'
import { mapStep, resultStep } from '../effects/module.f.mjs'
import { errorExit, exitStep, writeUtf8File } from '../effects/node/module.f.mjs'

const { entries } = Object

/**
 * Where an error happened, as much of it as is known: the token's
 * `path:line:column` when the reader tracks positions, and otherwise the name
 * of the file being compiled. A `.json` input is read by `fjs/media/json`,
 * whose errors carry no position, and a missing file or a circular dependency
 * has no token to point at either.
 *
 * An error that knows how far the offending source runs renders as a span,
 * `path:line:column-column` within one line and `path:line:column-line:column`
 * across several. Only lexical errors carry one today; a grammar failure points
 * at a single token and prints the point form.
 *
 * @type {(inputFileName: string) => (parseError: ParseError) => string}
 */
const errorLocation = inputFileName => ({ metadata, end }) => {
    if (metadata === null) { return inputFileName }
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

/** @type {(list: List<List<string>>) => (chunk: List<string>) => List<List<string>>} */
const append = list => chunk => ({ head: list, tail: [chunk] })

/** @type {(acc: Result<List<List<string>>, string>, item: Result<List<string>, string>) => Result<List<List<string>>, string>} */
const collect = (acc, item) => okThen(
    /** @type {(list: List<List<string>>) => Result<List<List<string>>, string>} */
    (list => mapOk(append(list))(item))
)(acc)

/** @type {Result<List<List<string>>, string>} */
const none = ok(empty)

/** The chunks of every item, or the first refusal among them. @type {(items: readonly Result<List<string>, string>[]) => Result<List<List<string>>, string>} */
const all = items => items.reduce(collect, none)

/** @type {(member: readonly [string, Unknown]) => Result<List<string>, string>} */
const jsonMember = ([key, value]) => mapOk(
    /** @type {(chunks: List<string>) => List<string>} */
    (chunks => flat([stringSerialize(key), colon, chunks]))
)(jsonValue(value))

/**
 * A value in JSON, or the refusal of a leaf. Members are written in the
 * order the object carries them, the order the module output keeps too.
 * Sharing is not this walk's question: the front end answers it from the
 * module's syntax, so the walk carries no state.
 *
 * @type {(value: Unknown) => Result<List<string>, string>}
 */
const jsonValue = value => {
    if (value === null || typeof value !== 'object') { return jsonLeaf(value) }
    return value instanceof Array
        ? mapOk(arrayWrap)(all(value.map(jsonValue)))
        : mapOk(objectWrap)(all(entries(value).map(jsonMember)))
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
const moduleText = ({ value }) => tryStringify(value)

// ── EDAG output ───────────────────────────────────────────────────────────────

/**
 * Whether an output name asks for the EDAG: `.edag.f.js` or `.edag.f.mjs`,
 * a DataJS document like the module output, so the extension alone cannot
 * tell them apart and the name says which graph it holds.
 *
 * @type {(outputFileName: string) => boolean}
 */
const isEdag = outputFileName => outputFileName.endsWith('.edag.f.js') || outputFileName.endsWith('.edag.f.mjs')

/**
 * The program at `path` as the text of its EDAG: linked by `./edag` into
 * one graph, and written as a DataJS document in normalized form — the
 * graph is arrays, strings and numbers, and a node two references reach is
 * hoisted into a `const` as any shared node is, so the document reads back
 * as the same graph. The writer refuses nothing an EDAG holds.
 *
 * @type {(path: string) => Effect<ReadFile, Result<string, string>, ParseError>}
 */
const edagText = path => mapStep(resolve(path), tryStringify)

/**
 * The module at `path` as the text `write` makes of what it denotes.
 *
 * @type {(write: (denotation: Denotation) => Result<string, string>) => (path: string) => Effect<ReadFile, Result<string, string>, ParseError>}
 */
const denotedText = write => path => mapStep(transpile(path), write)

/**
 * The text an output name asks for, from the input: JSON for `.json`, the
 * EDAG for `.edag.f.js` and `.edag.f.mjs`, and otherwise the value as a
 * DataJS module. A refusal of the output — a value JSON cannot spell — is
 * the inner `Result`; a failure of the input is the effect's.
 *
 * @type {(outputFileName: string) => (inputFileName: string) => Effect<ReadFile, Result<string, string>, ParseError>}
 */
const outputText = outputFileName => {
    if (outputFileName.endsWith('.json')) { return denotedText(jsonText) }
    return isEdag(outputFileName) ? edagText : denotedText(moduleText)
}

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
 * Compiles the FunctionalScript module `args[0]` into `args[1]`: JSON when
 * the output name ends with `.json`, the program's EDAG when it ends with
 * `.edag.f.js` or `.edag.f.mjs`, and otherwise a DataJS document in
 * normalized form — one line, shared nodes hoisted into `$0`, `$1`, … and
 * an object's members in the order the module gave them. The EDAG output is
 * a DataJS document too, of the graph the program compiles to, with its
 * shared nodes hoisted the same way.
 *
 * Returns the process exit code: `0` once the output file is written, `1` on
 * every failure — too few arguments, a missing input file, a parse error, a
 * `.json` output asked of a value JSON cannot spell, or an EDAG asked of a
 * program whose export does not reach every import and `const` — so a caller
 * can detect a failed compile from the exit status alone. A refused output
 * is reported against the output file, since the module itself is sound; a
 * refused program is reported against the input, as a parse error is.
 *
 * @type {(args: readonly string[]) => Effect<_CompileOp, 0, number>}
 */
export const compile = args => {
    if (args.length < 2) {
        return errorExit('Error: Requires 2 or more arguments')
    }
    const inputFileName = args[0]
    const outputFileName = args[1]
    return resultStep(
        outputText(outputFileName)(inputFileName),
        /** @type {(result: Result<Result<string, string>, ParseError>) => Effect<_CompileOp, 0, number>} */
        (result) => {
            if (result[0] === 'error') {
                return errorExit(`${errorLocation(inputFileName)(result[1])} - error: ${result[1].message}`)
            }
            const [tag, content] = result[1]
            return tag === 'error'
                ? errorExit(`${outputFileName} - error: ${content}`)
                : exitStep(writeUtf8File(outputFileName, content))
        })
}
