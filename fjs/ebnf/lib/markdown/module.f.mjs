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
 * **Emphasis holds text and nothing else, and refuses what it cannot
 * hold.** All 346 emphasised spans in the tree are plain — none nests, none
 * contains code, none contains a link — so the rules say so. Where
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
 * here.
 */
const opening = '`*['

/** A run of plain text: at least one symbol that opens no span. */
export const text = repeatFrom1(remove(any, set(opening)))

/**
 * An inline code span. Its body admits every symbol but the backtick that
 * ends it, which is what makes code bind tightest.
 *
 * **The body is non-empty, which refuses a longer delimiter.** CommonMark
 * opens a code span with a run of backticks and closes it with a run of the
 * same length, so ```x``` is one span holding `x` — a form a writer needs
 * when the code itself holds a backtick. Read one backtick at a time, that
 * text is an empty span, an `x`, and another empty span: accepted, and a
 * different document from the one GitHub builds. An empty span is worth
 * nothing on its own, so refusing it is what stops the longer delimiter
 * being misread.
 */
export const code = /**@type {const}*/(['`', repeatFrom1(remove(any, set('`'))), '`'])

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
 * Nothing in the tree is refused by it: of its 346 emphasised spans, none
 * holds a backtick or a bracket. Supporting the nesting CommonMark defines
 * is `todo/commonmark-constructs.md`.
 */
const emphasised = repeatFrom1(remove(any, set('*`[')))

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
 * **Its label holds no span opener and its target no parenthesis**, both
 * for the reason the emphasis body excludes them: CommonMark reads more
 * here than this subset does, and admitting the symbols as text would give
 * one source two readings.
 *
 * A label is where it shows: GitHub renders `[**details**](u)` as a link
 * whose words are bold, and reading the asterisks as label text would print
 * them. A target is where it bites: a destination may hold balanced
 * parentheses, so GitHub reads `[x](a(b)c)` as a link to `a(b)c`, while
 * stopping at the first `)` gives a link to `a(b)` — not a stray rendering
 * but the wrong address, and nothing on the page would say so.
 */
export const link = /**@type {const}*/([
    '[', repeatFrom1(remove(any, set('][*`'))),
    '](', repeatFrom1(remove(any, set(')('))), ')',
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
