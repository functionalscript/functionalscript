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
 * @import { RefusedSample, State } from './types.ts'
 */

import { fetchText } from '../../effects/browser/module.f.mjs'
import { errorMessage, pureOk, resultStep } from '../../effects/module.f.mjs'
import { virtualAt } from '../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { error, unwrap } from '../../types/result/module.f.js'
import { caption } from '../../website/demo/module.f.mjs'
import { codeBlock } from '../../website/demo/code/module.f.js'
import { highlight } from '../../website/demo/highlight/module.f.mjs'
import { codeMarker, refusedMarker, resultMarker } from '../../website/style/module.f.js'
import { loadedView } from '../../nanvm/demos/page/module.f.mjs'
import { _outputMarked, noRuntime } from '../module.f.mjs'

/** The sample's file name, in its page's directory. */
export const sampleName = 'sample.mjs'

/** The output the page asks `fjs compile` for: a module, which needs no runtime. */
export const outputName = 'output.js'

/** @type {State} */
export const init = ['loading']

/**
 * What `fjs compile sample.mjs output.js` answers for `text`: the module it
 * writes, or why it writes none.
 *
 * @type {(text: string) => Result<Marked, OutputRefusal>}
 */
export const report = text => unwrap(virtualAt({ [sampleName]: [utf8(text)] })(
    _outputMarked(noRuntime)(sampleName, outputName))[1])

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

/** @type {(text: string) => readonly Node[]} */
const verdictView = text => {
    const r = report(text)
    return r[0] === 'ok' ? acceptedBanner : [
        ...refusedBanner,
        caption(`What fjs compile ${sampleName} ${outputName} prints:`),
        ['div', { [codeMarker]: '', [resultMarker]: 'error' }, ['pre', reportText(text)(r[1])]],
    ]
}

/** @type {(entry: unknown) => readonly Node[]} */
const javaScriptView = entry => [
    caption('What JavaScript answers for the same module, its default export:'),
    ['div', { [codeMarker]: '' }, ['pre', String(entry)]],
]

/** @type {(sample: RefusedSample) => (state: State) => Element} */
export const view = ({ entry }) => state => ['div', {},
    ...loadedView(state, verdictView),
    caption(`JavaScript source, ${sampleName}:`),
    ...loadedView(state, text => [codeBlock(text, 'Copy the source', highlight(text))]),
    ...javaScriptView(entry),
]

/**
 * Fetches the sample's text on `start`; a file that does not arrive is the
 * reason the page shows no verdict.
 *
 * @type {(sample: RefusedSample) => (state: State) => (event: DemoEvent) => Effect<FetchText, State, never>}
 */
export const update = ({ directory }) => state => event => event.kind === 'start'
    ? resultStep(fetchText(`/${directory}/${sampleName}`), r => pureOk(/** @type {State} */ (r[0] === 'ok' ? r : error(errorMessage(r[1])))))
    : pureOk(state)

/** @type {(sample: RefusedSample) => Demo<State, DemoEvent, FetchText>} */
export const refusedDemo = sample => ({ init, update: update(sample), view: view(sample) })
