/**
 * Syntax highlighting for the code a demo prints: marked text as HTML nodes,
 * each run with a kind wrapped in a `span` marked `data-token`, every other
 * run left as plain text. {@link render} draws runs a producer supplied;
 * {@link highlight} and {@link tsHighlight} draw a text with no producer
 * behind it, by the runs [`js/marked`](../../../js/marked/module.f.mjs) finds
 * in it. {@link codeOutput} is the view a demo that prints code ends in: the
 * drawn runs in a copyable block, or the producer's refusal.
 *
 * What marked text is, and why: [`fjs/text/marked`](../../../text/marked/README.md).
 *
 * **Highlighting never changes the text.** The nodes' text, concatenated, is
 * the input exactly, so a copy button next to the block copies what the
 * reader sees; a text the tokenizer refuses is returned plain.
 *
 * Classes, the values of `data-token`: `keyword`, `literal` (`true`,
 * `false`, `null`, `undefined`, `NaN`, `Infinity`), `string`, `number` (a
 * bigint included), `comment` and `identifier`. Punctuation stays plain.
 * The stylesheet owns the colours.
 *
 * @module
 *
 * @import { Node } from '../../../media/html/types.ts'
 * @import { Marked, Span } from '../../../text/marked/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 */

import { spansOf, tsSpansOf } from '../../../js/marked/module.f.mjs'
import { fromSpans, toText } from '../../../text/marked/module.f.mjs'
import { unwrap } from '../../../types/result/module.f.js'
import { codeBlock } from '../code/module.f.js'
import { caption, refusal } from '../module.f.mjs'

/**
 * Marked text as nodes: a run with a kind as a classed `span`, a run
 * without one as its bare string, an empty run as nothing.
 *
 * @type {(marked: Marked) => readonly Node[]}
 */
export const render = marked => marked.flatMap(([text, kind]) =>
    text === '' ? [] : [kind === undefined ? text : ['span', { 'data-token': kind }, text]])

/**
 * A producer's answer as a demo shows it: marked text under `title`, in a
 * code block whose copy button, named `label`, copies the plain text; or
 * the producer's refusal, in its own words.
 *
 * @type {(title: string, label: string) => (result: Result<Marked, string>) => readonly Node[]}
 */
export const codeOutput = (title, label) => ([kind, value]) => kind === 'ok'
    ? [caption(title), codeBlock(toText(value), label, render(value))]
    : [refusal(value)]

/** `text` as nodes, by the spans `spansOf` finds in it. @type {(spansOf: (text: string) => readonly Span[]) => (text: string) => readonly Node[]} */
const highlightWith = spansOf => text => render(unwrap(fromSpans(text)(spansOf(text))))

/**
 * JavaScript `text` as nodes, by tokenizing it: plain strings and classed
 * spans whose text, joined, is `text`.
 *
 * @type {(text: string) => readonly Node[]}
 */
export const highlight = highlightWith(spansOf)

/**
 * TypeScript `text` as nodes, by tokenizing it with `tsSpansOf`.
 *
 * @type {(text: string) => readonly Node[]}
 */
export const tsHighlight = highlightWith(tsSpansOf)
