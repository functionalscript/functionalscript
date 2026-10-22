/**
 * The page of a JavaScript construct the language refuses by design: a spec
 * page whose status is "refused by design", such as
 * [`in`](../../../spec/operators/in/README.md). It is the negative of a
 * spec page's demo ([`function-page`](../../nanvm/demos/function-page/module.f.mjs)):
 * where that one shows every output `fjs compile` makes of an example, this
 * one shows that `fjs compile` makes none, and what JavaScript makes of the
 * same text instead.
 *
 * **The verdict comes first, and it is the compiler's.** The page fetches
 * the sample's text and compiles it in the page, as the compiler demo does
 * ([`../demo.f.mjs`](../demo.f.mjs)), so the banner, the line the command
 * prints and the token it marks are what this build's compiler answers for
 * the file beside the page, not a copy of an answer that could go stale.
 *
 * **JavaScript's answer is the reason.** The sample is a plain `.mjs`: valid
 * JavaScript the compiler refuses, so it cannot be an `.f.js`. The page
 * imports it as any module and shows its default export as `String` spells
 * it, which for a refused construct is usually the answer the specification
 * gives as the reason, such as `"toString" in {}` being `true`.
 *
 * **It proposes the message the refusal should print.** The compiler's
 * message says where it stopped, `unexpected token`, not why or what to
 * write instead. Below it the page shows the message it proposes, in the
 * same shape, at the same token: the reason in a line, then the allowed
 * spelling, which `alternative.f.js` beside the sample writes whole. The
 * page compiles the alternative too and shows what JavaScript answers for
 * it, so the suggestion is one the compiler accepts.
 *
 * **A page that outlives its refusal says so.** Where the compiler accepts
 * the sample, the banner is a notice that the page is out of date, not a
 * refusal the compiler no longer makes.
 *
 * @module
 *
 * @import { FetchText } from '../../effects/browser/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { Element, Node } from '../../media/html/types.ts'
 * @import { Marked } from '../../text/marked/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { OutputRefusal } from '../types.ts'
 * @import { ParseError } from '../parser/types.ts'
 * @import { RefusedSample, State, Suggestion } from './types.ts'
 */

import { fetchText } from '../../effects/browser/module.f.mjs'
import { errorMessage, mapStep, pureOk, resultStep, step } from '../../effects/module.f.mjs'
import { virtualAt } from '../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { error, unwrap } from '../../types/result/module.f.js'
import { caption } from '../../website/demo/module.f.mjs'
import { codeBlock } from '../../website/demo/code/module.f.js'
import { codeOutput, highlight } from '../../website/demo/highlight/module.f.mjs'
import { codeMarker, listingMarker, refusedMarker, resultMarker } from '../../website/style/module.f.js'
import { loadedView } from '../../nanvm/demos/page/module.f.mjs'
import { _outputMarked, noRuntime } from '../module.f.mjs'

/** The sample's file name, in its page's directory. */
export const sampleName = 'sample.mjs'

/** The allowed spelling's file name, beside the sample. */
export const alternativeName = 'alternative.f.js'

/** The output the page asks `fjs compile` for: a module, which needs no runtime. */
export const outputName = 'output.js'

/** @type {State} */
export const init = { source: ['loading'], alternative: ['loading'] }

/**
 * What `fjs compile <name> output.js` answers for `text` as the file
 * `name`: the module it writes, or why it writes none.
 *
 * @type {(name: string) => (text: string) => Result<Marked, OutputRefusal>}
 */
export const compileAs = name => text => unwrap(virtualAt({ [name]: [utf8(text)] })(
    _outputMarked(noRuntime)(name, outputName))[1])

/** {@link compileAs} the sample. */
export const report = compileAs(sampleName)

/**
 * The line `line` of `text`, counted from 1, and a caret line under it
 * from `column` for `width` characters, each prefixed as a compiler prints
 * a source excerpt.
 *
 * @type {(text: string, line: number, column: number, width: number) => string}
 */
export const excerpt = (text, line, column, width) => {
    const number = String(line)
    const gutter = ' '.repeat(number.length)
    return `${number} | ${text.split('\n')[line - 1] ?? ''}\n${gutter} | ${' '.repeat(column - 1)}${'^'.repeat(width)}`
}

/**
 * The line the command prints and, where the refusal is at a token of the
 * sample, the sample's line with that token marked.
 *
 * @type {(text: string) => (refusal: OutputRefusal) => string}
 */
export const reportText = text => ([, diagnostic, source]) => {
    const at = source?.metadata ?? null
    if (at === null) { return diagnostic }
    // a refusal at a token is a parse error, the one source error with a token
    const { end } = /** @type {ParseError} */ (source)
    const width = end !== undefined && end.line === at.line && end.column > at.column ? end.column - at.column : 1
    return `${diagnostic}\n${excerpt(text, at.line, at.column, width)}`
}

/**
 * The message `suggestion` proposes for the sample's refusal, at the token
 * the compiler refused, or at no token where the refusal is at none.
 *
 * @type {(suggestion: Suggestion) => (text: string) => (refusal: OutputRefusal) => string}
 */
export const suggestedText = ({ message, width, label, help, fix, note }) => text => ([, , source]) => {
    const at = source?.metadata ?? null
    const head = at === null
        ? `${sampleName} - error: ${message}`
        : `${at.path}:${at.line}:${at.column} - error: ${message}\n${excerpt(text, at.line, at.column, width)} ${label}`
    const gutter = ' '.repeat(at === null ? 0 : String(at.line).length)
    return `${head}\n${gutter} = help: ${help}\n${gutter}         ${fix}\n${gutter} = note: ${note}`
}

/** @type {readonly Node[]} */
const refusedBanner = [
    ['div', { [refusedMarker]: '' },
        ['strong', {}, 'Not allowed in FunctionalScript'],
        ['p', {}, 'This is valid JavaScript, and fjs compile refuses it, by design: it is not a FunctionalScript module.']],
]

/** @type {readonly Node[]} */
const acceptedBanner = [
    ['div', { role: 'status' },
        caption('This page is out of date:'),
        ['pre', { [resultMarker]: 'ok' }, 'fjs compile now accepts this sample, so the page no longer shows a refusal.']],
]

/** @type {(suggestion: Suggestion) => (text: string) => readonly Node[]} */
const verdictView = suggestion => text => {
    const r = report(text)
    return r[0] === 'ok' ? acceptedBanner : [
        ...refusedBanner,
        caption(`What fjs compile ${sampleName} ${outputName} prints:`),
        // unwrapped, so the carets stay under the token they mark
        ['div', { [codeMarker]: '', [resultMarker]: 'error', [listingMarker]: '' }, ['pre', reportText(text)(r[1])]],
        caption('What it should print instead, pointing to what FunctionalScript allows (proposed):'),
        ['div', { [codeMarker]: '', [listingMarker]: '' }, ['pre', suggestedText(suggestion)(text)(r[1])]],
    ]
}

/**
 * What `fjs compile` answers for `text` as the alternative, a refusal as the
 * line it prints.
 *
 * @type {(text: string) => Result<Marked, string>}
 */
const alternativeOutput = text => {
    const r = compileAs(alternativeName)(text)
    return r[0] === 'ok' ? r : error(r[1][1])
}

/** @type {(alternative: unknown) => (text: string) => readonly Node[]} */
const alternativeView = alternative => text => [
    codeBlock(text, 'Copy the alternative', highlight(text)),
    ...codeOutput(`What fjs compile ${alternativeName} ${outputName} writes:`, 'Copy the output')(alternativeOutput(text)),
    caption('What it answers, its default export:'),
    ['div', { [codeMarker]: '' }, ['pre', String(alternative)]],
]

/** @type {(entry: unknown) => readonly Node[]} */
const javaScriptView = entry => [
    caption('What JavaScript answers for the same module, its default export:'),
    ['div', { [codeMarker]: '' }, ['pre', String(entry)]],
]

/** @type {(sample: RefusedSample) => (state: State) => Element} */
export const view = ({ entry, alternative, suggestion }) => ({ source, alternative: text }) => ['div', {},
    ...loadedView(source, verdictView(suggestion)),
    caption(`JavaScript source, ${sampleName}:`),
    ...loadedView(source, text => [codeBlock(text, 'Copy the source', highlight(text))]),
    ...javaScriptView(entry),
    ['h3', {}, 'What to write instead'],
    caption(`The FunctionalScript spelling, ${alternativeName}:`),
    ...loadedView(text, alternativeView(alternative)),
]

/**
 * The text of the file `name` in `directory`, or why it did not arrive.
 *
 * @type {(directory: string, name: string) => Effect<FetchText, Result<string, string>, never>}
 */
const fetchFile = (directory, name) => resultStep(fetchText(`/${directory}/${name}`),
    r => pureOk(r[0] === 'ok' ? r : error(errorMessage(r[1]))))

/**
 * Fetches the sample's text and the alternative's on `start`; a file that
 * does not arrive is the reason the page does not show it.
 *
 * @type {(sample: RefusedSample) => (state: State) => (event: DemoEvent) => Effect<FetchText, State, never>}
 */
export const update = ({ directory }) => state => event => event.kind === 'start'
    ? step(fetchFile(directory, sampleName), source => mapStep(fetchFile(directory, alternativeName),
        /** @type {(alternative: Result<string, string>) => State} */ (alternative => ({ source, alternative }))))
    : pureOk(state)

/** @type {(sample: RefusedSample) => Demo<State, DemoEvent, FetchText>} */
export const refusedDemo = sample => ({ init, update: update(sample), view: view(sample) })
