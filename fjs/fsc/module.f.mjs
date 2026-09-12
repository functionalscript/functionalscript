/**
 * `fjs compile`: a FunctionalScript module read, its imports resolved and
 * inlined, and the value it denotes written out — as normalized DataJS, or
 * as JSON when the output name says so.
 *
 * @module
 *
 * @import { List } from '../types/list/types.ts'
 * @import { Result } from '../types/result/types.ts'
 * @import { Unknown, _CompileOp } from '../djs/types.ts'
 * @import { ParseError } from './parser/types.ts'
 * @import { Effect } from '../effects/types.ts'
 */

import { transpile } from './transpiler/module.f.mjs'
import { numberSerialize, tryStringify } from '../media/datajs/serializer/module.f.mjs'
import { arrayWrap, boolSerialize, colon, nullSerialize, objectWrap, stringSerialize } from '../media/json/serializer/module.f.mjs'
import { empty, flat } from '../types/list/module.f.mjs'
import { error, mapOk, ok, okThen } from '../types/result/module.f.mjs'
import { concat } from '../types/string/module.f.mjs'
import { resultStep } from '../effects/module.f.mjs'
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
        case 'number': { return isFinite(value) ? ok(numberSerialize(value)) : noJson(`${value}`) }
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

/** @type {(seen: Set<object>) => (member: readonly [string, Unknown]) => Result<List<string>, string>} */
const jsonMember = seen => ([key, value]) => mapOk(
    /** @type {(chunks: List<string>) => List<string>} */
    (chunks => flat([stringSerialize(key), colon, chunks]))
)(jsonValue(seen)(value))

/**
 * A value in JSON, or the refusal. JSON denotes a tree, so a container that
 * two references reach is refused as well: writing it twice would read back
 * as two nodes, and a document denoting a different graph is the silent
 * substitution the module output exists to avoid. Members are written in
 * the order the object carries them, the order the module output keeps too.
 *
 * @type {(seen: Set<object>) => (value: Unknown) => Result<List<string>, string>}
 */
const jsonValue = seen => value => {
    if (value === null || typeof value !== 'object') { return jsonLeaf(value) }
    if (seen.has(value)) { return noJson('a shared node') }
    seen.add(value)
    return value instanceof Array
        ? mapOk(arrayWrap)(all(value.map(jsonValue(seen))))
        : mapOk(objectWrap)(all(entries(value).map(jsonMember(seen))))
}

/**
 * The value as one JSON text, when it has one: every leaf spelled by JSON
 * and no node shared. Exported so the refusals can be proved one value at a
 * time; `compile` is what a caller runs.
 *
 * @type {(value: Unknown) => Result<string, string>}
 */
export const tryJson = value => mapOk(concat)(jsonValue(new Set())(value))

// ── the command ───────────────────────────────────────────────────────────────

/**
 * Compiles the FunctionalScript module `args[0]` into `args[1]`: JSON when
 * the output name ends with `.json`, and otherwise a DataJS document in
 * normalized form — one line, shared nodes hoisted into `$0`, `$1`, … and
 * an object's members in the order the module gave them.
 *
 * Returns the process exit code: `0` once the output file is written, `1` on
 * every failure — too few arguments, a missing input file, a parse error, or
 * a `.json` output asked of a value JSON cannot spell — so a caller can
 * detect a failed compile from the exit status alone. A refused output is
 * reported against the output file, since the module itself is sound.
 *
 * @type {(args: readonly string[]) => Effect<_CompileOp, 0, number>}
 */
export const compile = args => {
    if (args.length < 2) {
        return errorExit('Error: Requires 2 or more arguments')
    }
    const inputFileName = args[0]
    const outputFileName = args[1]
    const write = outputFileName.endsWith('.json') ? tryJson : tryStringify
    return resultStep(
        transpile(inputFileName),
        /** @type {(result: Result<Unknown, ParseError>) => Effect<_CompileOp, 0, number>} */
        (result) => {
            if (result[0] === 'error') {
                return errorExit(`${errorLocation(inputFileName)(result[1])} - error: ${result[1].message}`)
            }
            const [tag, content] = write(result[1])
            return tag === 'error'
                ? errorExit(`${outputFileName} - error: ${content}`)
                : exitStep(writeUtf8File(outputFileName, content))
        })
}
