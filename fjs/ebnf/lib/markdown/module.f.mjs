/**
 * The Markdown subset a changelog entry is written in.
 *
 * `changelog/README.md` fixes that subset deliberately — "no Markdown beyond
 * paragraphs, list items, inline code, and bold, so the website can render
 * entries with a small self-hosted parser" — and this grammar is the subset,
 * not Markdown at large. It recognises the spans of **one entry**, and the
 * entry reaches it as a single line of text.
 *
 * **The block structure is resolved before this grammar sees anything, and
 * cannot be resolved by it.** An entry is a `- ` list item whose wrapped
 * continuation lines are indented by two spaces, and a code span may open on
 * one of those lines and close on the next — twenty lines in the tree carry
 * an odd number of backticks for that reason. A grammar reading the file
 * line by line would split those spans with no way to rejoin them, so the
 * lines are joined first and this grammar reads the result.
 *
 * **Code binds tightest, which the alternation below spells as an ordering
 * of first symbols rather than as a precedence rule.** An inline code span
 * carries the very characters the other spans are delimited by: `*` is an
 * operator inside code in six entries, and `[` opens an array type —
 * `readonly T[]` — in forty-three. Because `code` is a branch of `inline`
 * and its body admits every symbol but the backtick, those characters are
 * consumed as code content and never reach the emphasis or link rules.
 *
 * **Emphasis holds text and code, and refuses what it cannot hold.** No
 * emphasised span in the tree nests or holds a link, and a README sets a
 * name in bold as `` **`Object` is reserved** ``, so the rules say so. Where
 * CommonMark would nest, this refuses rather than reading the delimiters as
 * text: the same file is read on GitHub too, and a body that swallowed them
 * would give the two renderings different answers about one source.
 *
 * What this grammar does **not** do, and what processing must do after it:
 * derive a link from a bare `(#NNN)` pull request reference, which is
 * ordinary text here so that the rules never have to tell it from
 * parenthesised prose.
 *
 * @module
 *
 * @import { Const, DataRule, Rule } from '../../types.ts'
 */

import { option, range, remove, repeatFrom0, repeatFrom1, set, unicodeMax } from '../../module.f.mjs'

/**
 * Every symbol a span may hold: space through the last code point, as
 * JSON's `character` rule takes it. An entry is one joined line by the time
 * it is read, so no rule below has to admit a line break.
 */
const any = range(` ${unicodeMax}`)

/**
 * The three symbols that open a span. Everything else is text, which is why
 * a parenthesis, a bracket that closes one and a digit are all ordinary
 * here. The backslash is not a span opener at all: it escapes the next
 * punctuation mark in CommonMark, so `\\*a\\*` is the literal `*a*` there
 * and would be emphasis here. Nothing in this subset reads it, so it is
 * refused rather than read as the character it is not.
 */
const opening = '`*[\\'

/**
 * A body that neither begins nor ends with a space: runs of ordinary
 * symbols separated by runs of spaces.
 *
 * **Padding is refused, for two readings it would otherwise invent.**
 * CommonMark does not read an asterisk with a space beside it as emphasis
 * at all — GitHub leaves `a * b * c` as the three words and two asterisks
 * they are, where a body admitting the spaces makes an `em` span out of
 * prose. And a code span's one leading and trailing space is stripped, so
 * `` code `` reads as `code` there and would read as ` code ` here.
 * Neither is a rendering that merely looks different; both are a different
 * document.
 *
 * It also refuses an empty body, which is what a longer delimiter looks
 * like one symbol at a time.
 *
 * @type {(openers: string) => Rule}
 */
const unpadded = openers => {
    const inner = repeatFrom1(remove(any, set(`${openers} `)))
    return [inner, repeatFrom0([repeatFrom1(' '), inner])]
}

/** A run of plain text: at least one symbol that opens no span. */
export const text = repeatFrom1(remove(any, set(opening)))

/** A run of symbols other than a backtick. */
const notTicks = repeatFrom1(remove(any, set('`')))

/**
 * The body of a code span opened by two backticks, through the two that
 * close it: runs of symbols other than a backtick, each followed by one
 * backtick that either closes the span, with a second one, or continues it.
 *
 * **Two backticks open a span that may hold one**, which is the form a
 * README names a backtick-holding expression in: ``` `` f`x` `` ```. A run of
 * three is refused, as it would open a different span on GitHub, and so is a
 * body that opens with a backtick. The one space CommonMark strips from each
 * end is stripped where the span is read.
 *
 * The body names itself, so it is a thunk, and `const` says the thunk yields
 * a data rule, as JSON's `value` does.
 *
 * @type {Const<DataRule>}
 */
export const doubleBody = () => ['const', [notTicks, '`', { end: '`', more: doubleBody }]]

/**
 * An inline code span. Its body admits every symbol but the backtick that
 * ends it, which is what makes code bind tightest.
 *
 * **Two backticks open the {@link doubleBody} form; one opens a non-empty
 * body.** CommonMark opens a code span with a run of backticks and closes it
 * with a run of the same length — a form a writer needs when the code itself
 * holds a backtick. A run of two is read as that; a run of three, read one
 * backtick at a time, would be an empty span, an `x`, and another empty
 * span, a different document from the one GitHub builds, so a single body
 * is non-empty and a double one may not open with a backtick.
 */
export const code = /**@type {const}*/(['`', {
    double: ['`', doubleBody],
    single: [unpadded('`'), '`'],
}])


/** A run of a link label's text: no bracket, asterisk, backtick or backslash. */
const labelText = repeatFrom1(remove(any, set('][*`\\')))

/** A run of an emphasis body's text: no asterisk, backtick, bracket or backslash. */
const emphasisText = repeatFrom1(remove(any, set('*`[\\')))

/** A code span inside emphasis, and the run of text after it, if any. */
const emphasisCode = [code, option(emphasisText)]

/**
 * A body of emphasis: text with none of the symbols that open a span.
 *
 * **The exclusions are a refusal, not an oversight.** CommonMark nests —
 * GitHub renders `**see [details](url)**` as bold around a working link, and
 * every released file here is read there as well as on the site. A body that
 * admitted those symbols as ordinary text would put the two renderings of one
 * file at odds: a link on GitHub, its own brackets on the site. Refusing
 * leaves one reading, and the author is told at build time rather than a
 * reader left to notice.
 *
 * A code span is the one span it holds, read as code, which is the form a
 * README sets a name in bold with. A body opens with text or with code,
 * the two branches told apart by their first symbol. Its padding — a space
 * just inside an asterisk — is matched here and refused after, in
 * [`media/markdown`](../../../media/markdown/module.f.mjs): with code inside,
 * "no space before the closing asterisk" is no longer a choice one symbol
 * of lookahead can make. Supporting the rest of the nesting CommonMark
 * defines is `todo/commonmark-constructs.md`.
 */
const emphasised = {
    text: [emphasisText, repeatFrom0(emphasisCode)],
    code: repeatFrom1(emphasisCode),
}

/**
 * Bold or emphasis, **factored through the asterisk they share**. Written as
 * two alternatives, `** … **` and `* … *`, both would begin with the same
 * symbol and the backend could not choose between them with the one symbol
 * of lookahead it has. So the opening asterisk is consumed first and the
 * choice is made on the symbol after it: another asterisk is `strong`, and
 * anything else is the first symbol of `em`'s body. That body is non-empty
 * for the same reason — an empty one would let `em` begin with the asterisk
 * `strong` begins with.
 */
export const emphasis = /**@type {const}*/(['*', {
    strong: ['*', emphasised, '**'],
    em: [emphasised, '*'],
}])

/**
 * An inline link.
 *
 * **Its label holds text and code and no other span opener, and its target
 * no parenthesis**, both for the reason the emphasis body excludes them:
 * CommonMark reads more here than this subset does, and admitting the
 * symbols as text would give one source two readings.
 *
 * A label is where it shows: GitHub renders `[**details**](u)` as a link
 * whose words are bold, and reading the asterisks as label text would print
 * them. A code span is the one span a label holds — a README names a file
 * as ``[`module.f.js`](./module.f.js)`` — and it is read as the code it is,
 * text and code alternating as they do in {@link entry}. An empty label is
 * matched here and refused after, since the alternation cannot say "at
 * least one" without the conflict {@link entry} describes. A target is where it bites: a destination may hold balanced
 * parentheses, so GitHub reads `[x](a(b)c)` as a link to `a(b)c`, while
 * stopping at the first `)` gives a link to `a(b)` — not a stray rendering
 * but the wrong address, and nothing on the page would say so.
 *
 * **A space in the target is refused for the same reason.** CommonMark
 * ends an unbracketed destination at the first space and reads what
 * follows as the link's title, so `[x](u "t")` links to `u` there and
 * would link to `u "t"` here — the wrong address again, and the form a
 * writer reaches for when captioning a link.
 *
 * **A backslash is refused wherever it would escape something.**
 * CommonMark escapes a punctuation mark with one, so `[x](a\\)b)` is a link
 * to `a)b` — the closing parenthesis is content, not the end of the
 * destination. Read without escapes the destination ends early and the
 * link points somewhere else, the same wrong-address failure the
 * parenthesis and the space are refused for. The label refuses one too,
 * and so does a text run, where `\\*a\\*` would otherwise become emphasis
 * the source does not have.
 *
 * **A target that opens with `<` is refused.** CommonMark reads
 * `[x](<u>)` as a link to `u`, the angle brackets delimiting the
 * destination rather than belonging to it, and read here they would be
 * part of the address — the wrong address once more. Only the first symbol
 * decides that form, so a `<` later in a target is the character it looks
 * like to both readers and stays admitted.
 */
export const link = /**@type {const}*/([
    '[', [option(labelText), repeatFrom0([code, option(labelText)])],
    '](', remove(any, set(')( \\<')), repeatFrom0(remove(any, set(')( \\'))), ')',
])

/**
 * One delimited span. The three branches open with disjoint symbols — a
 * backtick, an asterisk, a bracket — so one symbol of lookahead picks
 * between them. Plain text is deliberately not a branch here; see
 * {@link entry}.
 */
export const span = /**@type {const}*/({ code, emphasis, link })

/**
 * One entry: a run of text, then any number of spans each followed by a run
 * of text.
 *
 * **Text alternates with spans rather than being a fourth branch repeated
 * beside them.** Written the obvious way — a repetition of "code, emphasis,
 * link or text" — the grammar is not LL(1) and the backend refuses it: after
 * one symbol of a text run the machine must choose between continuing that
 * run and ending it to begin a new one, and both continue with the same
 * symbols. Alternating makes the choice a real one, because whatever follows
 * a text run can only be a backtick, an asterisk or a bracket, and whatever
 * follows a span is text or the end.
 *
 * Empty is a match. `changelog/README.md` allows a released file that
 * records no notable change, and an entry that is only text is the common
 * case rather than a shape worth a rule of its own — both fall out of the
 * two optional runs rather than needing one.
 */
export const entry = /**@type {const}*/([option(text), repeatFrom0([span, option(text)])])
