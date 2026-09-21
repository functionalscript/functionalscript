/**
 * The Markdown subset a changelog entry is written in, as a value.
 *
 * The subset is a convention rather than an accident: `changelog/README.md`
 * constrains an entry to "paragraphs, list items, inline code, and bold, so
 * the website can render entries with a small self-hosted parser". These
 * types are that subset, fixed against every release file in the tree — 103
 * of them, 789 entries — rather than against Markdown at large.
 *
 * What the corpus does **not** contain, and these types therefore cannot
 * express: headings, code fences, numbered lists, nested lists, block
 * quotes, tables, and interior blank lines. A release file is a flat list of
 * entries and nothing else.
 *
 * @module
 */

/**
 * One span of an entry's text.
 *
 * **`code` binds tightest, and that is a fact about the corpus rather than a
 * preference.** An inline code span carries the characters every other span
 * is delimited by: `` `*` `` is an operator in 6 entries, `` `readonly T[]` ``
 * an array type in 43. Recognise emphasis or a link first and those entries
 * parse as garbage; recognise code first and the remainder is balanced in
 * all 789.
 *
 * **`strong` and `em` hold text and nothing else.** Every one of the 336
 * bold spans and 10 emphasised spans in the tree is plain — none nests, none
 * contains code, none contains a link — so neither carries {@link Inline}.
 * A nested shape would be a generality the format has never used, and the
 * parser would owe it a meaning.
 */
export type Inline =
    | readonly ['text', string]
    | readonly ['code', string]
    | readonly ['strong', string]
    | readonly ['em', string]
    | readonly ['link', string, string]

/**
 * One entry — a Markdown list item — as its spans.
 *
 * **An entry's wrapped lines are joined before any of this exists.** A code
 * span may open on one source line and close on the next: 20 lines in the
 * tree carry an odd number of backticks and are only balanced once their
 * entry is whole. A parser that reads line by line splits those spans and
 * cannot put them back, which is why the line structure is resolved first
 * and never appears here.
 */
export type Entry = readonly Inline[]

/**
 * One release file: its entries in the order written, which
 * `changelog/README.md` fixes as order of importance rather than of merge.
 *
 * The version is the file name and never appears inside the file, so it is
 * not part of this type — a reader of a `Document` has it already.
 */
export type Document = readonly Entry[]
