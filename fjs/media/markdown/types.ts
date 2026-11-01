/**
 * The Markdown subset a changelog entry is written in, as a value.
 *
 * The subset is a convention rather than an accident: `changelog/README.md`
 * constrains an entry to "paragraphs, list items, inline code, and bold, so
 * the website can render entries with a small self-hosted parser". These
 * types are that subset, fixed against every release file in the tree — 103
 * of them, 789 entries — rather than against Markdown at large.
 *
 * What the corpus does **not** contain, and {@link Document} therefore
 * cannot express: headings, code fences, numbered lists, nested lists, block
 * quotes, tables, and interior blank lines. A release file is a flat list of
 * entries and nothing else. A README is more, and {@link Blocks} is the
 * part of it this reads: headings, paragraphs, code fences and flat lists.
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
 * **`strong` and `em` hold {@link Emphasised} spans**: text and code, as a
 * link's label does, and links. A README sets a name in bold as
 * `` **`Object` is a reserved word** `` and links from bold as
 * `**[capl.md](./capl.md)**`. Neither holds another emphasis, so neither
 * carries {@link Inline}: a nested shape would be a generality no file
 * uses, and the parser would owe it a meaning.
 */
export type Inline =
    | readonly ['text', string]
    | readonly ['code', string]
    | readonly ['strong', readonly Emphasised[]]
    | readonly ['em', readonly Emphasised[]]
    | readonly ['link', readonly LinkLabel[], string]
    | Image

/**
 * One span of a link's label: text, or code. A README names a file as
 * ``[`module.f.js`](./module.f.js)``, so a label holds a code span; no label
 * in the tree holds emphasis or another link, and none may.
 */
export type Label = readonly ['text', string] | readonly ['code', string]

/**
 * One span of a bold or emphasised body: text, code, or a link whose label
 * holds text and code. An image, which a `!` before a link would make, is
 * refused there.
 */
export type Emphasised = Label | readonly ['link', readonly Label[], string]

/**
 * An image: its alternative text, then its source. GitHub reads `![alt](u)`
 * as one, and a README's badge is one inside a link,
 * `[![alt](u)](href)`. A README holds images; a release entry holds none.
 */
export type Image = readonly ['image', string, string]

/** One span of a link's label: text, code, or an image the link shows. */
export type LinkLabel = Label | Image

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

/**
 * A table column's alignment, from its delimiter cell: `:--`, `:-:`, `--:`,
 * or `null` for a plain `---`.
 */
export type Align = 'left' | 'center' | 'right' | null

/**
 * One block of a README: a heading with its level, a paragraph, a fenced
 * code block with its info string, a list, or a table — each a block a
 * README in the tree is written in and GitHub reads as this reads it.
 *
 * **A list item holds blocks**, as it does in CommonMark: paragraphs, code
 * fences and nested lists, written indented by the two columns its `- `
 * marker takes. A list is `loose` when a blank line separates two of its
 * items or two blocks of one item, and GitHub then sets each paragraph of
 * it in a `<p>`; a tight list's paragraphs are its items' bare text.
 *
 * **A numbered list is an `olist`**, with the number its first item
 * carries, which GitHub starts the list at; the numbers after it are not
 * read, as GitHub does not read them. Its items are as a list's.
 *
 * **A task item opens with a `task` block**, `true` when its checkbox is
 * checked: GitHub reads `- [ ] text` and `- [x] text` as a list item with
 * a checkbox before its first paragraph, which always follows the `task`.
 * **A table is GitHub's**: a header row, a delimiter row giving each
 * column's alignment, and body rows, every row's cells being inline spans.
 * **A block quote holds blocks**, as a list item does: the lines of the
 * quote, each without its `>`, read as a README's own, but for a heading.
 *
 * What a README may hold and these cannot express — raw HTML, a GitHub
 * alert — is refused by the reader rather than written as something else, so
 * the README stays a link to GitHub.
 */
export type Block =
    | readonly ['heading', number, readonly Inline[]]
    | readonly ['paragraph', readonly Inline[]]
    | readonly ['code', string, string]
    | readonly ['list', boolean, readonly Blocks[]]
    | readonly ['olist', number, boolean, readonly Blocks[]]
    | readonly ['table', readonly Align[], readonly Entry[], readonly (readonly Entry[])[]]
    | readonly ['task', boolean]
    | readonly ['quote', Blocks]

/** A README as its blocks, in order. */
export type Blocks = readonly Block[]

/**
 * A list item's marker: its delimiter, `-` or an ordered item's `.` or `)`,
 * which every item of one list shares; an ordered item's number, `null` for
 * `-`; and the columns the marker takes with its space.
 */
export type ListMarker = {
    readonly delimiter: '-' | '.' | ')'
    readonly start: number | null
    readonly width: number
}
