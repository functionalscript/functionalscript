/**
 * `fjs compile`: a FunctionalScript module read, its imports resolved and
 * inlined, and written out in the language the output name declares — JSON
 * for `.json`, normalized DataJS for `.data.js`, FunctionalScript for any
 * other `.js`, the EDAG the program compiles to for `.edag.data.js` (a
 * DataJS document of the graph), or a generated Rust module calling the
 * `nanvm-lib` API for `.rs`
 * ([fjs-nanvm-integration](../../todo/fjs-nanvm-integration.md)). An output
 * whose extension declares no such language is refused. With no arguments
 * it is the check instead: every authored `.f.js` under the current
 * directory compiled and nothing written ({@link check}).
 *
 * @module
 *
 * @import { List } from '../types/list/types.ts'
 * @import { Result } from '../types/result/types.ts'
 * @import { Unknown } from '../media/datajs/types.ts'
 * @import { _Checked, _CompileOp } from './types.ts'
 * @import { Denotation } from './ast/types.ts'
 * @import { ParseError } from './parser/types.ts'
 * @import { Effect, IoChannel } from '../effects/types.ts'
 * @import { Env, Program, ReadFile, ResolveFileModule, Write } from '../effects/node/types.ts'
 */

import { _transpileDefault } from './transpiler/module.f.mjs'
import { resolve } from './edag/module.f.mjs'
import { toRust } from './rust/module.f.mjs'
import { _numberSerialize, tryJsonStringify, tryStringify } from '../media/datajs/serializer/module.f.mjs'
import { tryStringify as fjsStringify, tryModuleStringify } from './serializer/module.f.mjs'
import { arrayWrap, boolSerialize, colon, nullSerialize, objectWrap, stringSerialize } from '../media/json/serializer/module.f.mjs'
import { flat, map } from '../types/list/module.f.mjs'
import { error, mapOk, ok } from '../types/result/module.f.mjs'
import { concat } from '../types/string/module.f.mjs'
import { serialize as bigintSerialize } from '../types/bigint/module.f.mjs'
import { sort } from '../types/object/module.f.mjs'
import { errorMessage, foldStep, mapStep, pureOk, resultMapStep, resultStep, step } from '../effects/module.f.mjs'
import { error as errorLine, errorExit, exitStep, log, mkdir, writeUtf8File } from '../effects/node/module.f.mjs'
import { concat as pathConcat } from '../path/module.f.mjs'
import { allFiles, sourceRoot } from '../dev/module.f.mjs'

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
 * A denotation as JSON: the tree the value is to JSON, which has no
 * identity to carry, as `JSON.stringify` writes it. What JSON cannot spell
 * — `undefined`, a `bigint`, `NaN`, an infinity — is refused. The writer is
 * the DataJS writer's, since a JSON document is the tree a DataJS graph
 * unfolds to.
 *
 * @type {(denotation: Denotation) => Result<string, string>}
 */
const jsonText = ({ value }) => tryJsonStringify(value)

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
 * The directory an output file goes in: `a/b` for `a/b/x.rs`, and `.` for a
 * bare file name, whose parent folds to the empty path `mkdir` refuses.
 *
 * @type {(outputFileName: string) => string}
 */
const outputDirectory = outputFileName => {
    const directory = pathConcat(outputFileName)('..')
    return directory === '' ? '.' : directory
}

/**
 * The `path:line:column - error: message` line a failed compile reports:
 * where the error is, as far as {@link _errorLocation} knows it, then the
 * message. One spelling for the command and the check, so a diagnostic reads
 * the same whichever asked for it.
 *
 * @type {(inputFileName: string) => (parseError: ParseError) => string}
 */
const diagnostic = inputFileName => parseError =>
    `${_errorLocation(inputFileName)(parseError)} - error: ${parseError.message}`

/**
 * Whether a path is authored FunctionalScript the compiler promises to
 * accept: the stage-2 `.f.js` marker
 * ([`README.md`](./README.md#stage-2-mark-compiler-compatible-functionalscript)).
 * An `.f.mjs` states the intent and makes no such promise, so the check
 * leaves it alone.
 *
 * @type {(path: string) => boolean}
 */
const isAuthored = path => path.endsWith('.f.js')

/** Nothing checked yet. @type {_Checked} */
const noneChecked = { checked: 0, refused: 0 }

/**
 * Checks one `.f.js`: linked by `./edag` into its graph, as every output
 * begins, and nothing written. A refusal is reported on `stderr` where the
 * command would report it, and counted rather than returned, so the check
 * goes on to the next file and a run names every file that fails, not the
 * first.
 *
 * @type {(path: string) => (count: _Checked) => Effect<ReadFile | ResolveFileModule | Write, _Checked, IoChannel>}
 */
const checkOne = path => ({ checked, refused }) => resultStep(
    resolve(path),
    result => result[0] === 'ok'
        ? pureOk({ checked: checked + 1, refused })
        : mapStep(errorLine(diagnostic(path)(result[1])), () => ({ checked: checked + 1, refused: refused + 1 })))

/**
 * `fjs compile` with no arguments: every `.f.js` under the source root —
 * `INIT_CWD` under `npm run`, the current directory otherwise, hidden
 * entries and `node_modules` skipped, as the test runner discovers proofs —
 * compiled by the pipeline every output shares and written nowhere. The
 * `.f.js` extension promises that the compiler of the same revision accepts
 * the module, and `tsc` cannot keep that promise for it, so this is the
 * check that does.
 *
 * Every refusal is reported as the command reports one, then one line counts
 * them. Exit `0` with `.f.js: N checked` on `stdout` when every file
 * compiles — the count is the evidence that the walk found the files it was
 * meant to — and `1` when one was refused or the tree could not be read.
 *
 * @type {(env: Env) => Effect<_CompileOp, 0, number>}
 */
const check = env => resultStep(
    foldStep(allFiles(sourceRoot(env), isAuthored), noneChecked, checkOne),
    result => {
        if (result[0] === 'error') { return errorExit(errorMessage(result[1])) }
        const { checked, refused } = result[1]
        // Bound rather than returned inline, as `exitStep` binds its two
        // branches: `Effect<Write, 0, never>` and `Effect<Write, never, number>`
        // are both this type, and the conditional alone infers neither. The
        // summary's own write outcome is discarded as `errorExit` discards its
        // report's: the check has passed, and a `stdout` that would not take
        // the line is not a refused module.
        /** @type {Effect<Write, 0, number>} */
        const code = refused === 0
            ? resultMapStep(log(`.f.js: ${checked} checked`), () => ok(0))
            : errorExit(`.f.js: ${checked} checked, ${refused} refused`)
        return code
    })

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
 * The output's directory is created first, so a compile can write into a
 * directory that does not exist yet — a deleted `gen.*` directory, say.
 *
 * With no arguments it is {@link check} instead: every `.f.js` under the
 * source root compiled and nothing written.
 *
 * Returns the process exit code: `0` once the output file is written, `1` on
 * every failure — one argument or more than two, an output extension naming no
 * language,
 * a missing input file, a parse error, a `.json` output asked of a value
 * JSON cannot spell, a `.js` output asked of a graph the writer has no
 * spelling for, an EDAG asked of a program whose export does not reach every
 * import and `const`, or a `.rs` output asked of a node shape it has no
 * `nanvm-lib` spelling for — so a caller can detect a failed compile from the
 * exit status alone. A refused output is reported against the output file,
 * since the module itself is sound; a refused program is reported against
 * the input, as a parse error is.
 *
 * @type {Program<_CompileOp>}
 */
export const compile = ({ args, env }) => {
    if (args.length === 0) {
        return check(env)
    }
    if (args.length < 2) {
        return errorExit('Error: Requires 2 arguments: fjs compile <input> <output>')
    }
    if (args.length > 2) {
        return errorExit(`Error: unexpected argument ${args[2]}: fjs compile <input> <output>`)
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
                return errorExit(diagnostic(inputFileName)(result[1]))
            }
            const [tag, content] = result[1]
            if (tag === 'error') {
                return errorExit(`${outputFileName} - error: ${content}`)
            }
            const directoryReady = mkdir(outputDirectory(outputFileName), { recursive: true })
            const written = step(directoryReady, () => writeUtf8File(outputFileName, content))
            return exitStep(written)
        })
}
