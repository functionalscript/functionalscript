/**
 * A changelog entry's Markdown, as the spans it denotes.
 *
 * The grammar is [`fjs/ebnf/lib/markdown`](../../ebnf/lib/markdown/module.f.mjs)
 * and the subset it recognises is described there. This module is its two
 * halves of processing: the block layer that decides what one entry's text
 * is, which runs **before** the grammar, and the fold from a match to
 * {@link Inline} spans, which runs after.
 *
 * **The block layer cannot be grammar work.** A release file is a list of
 * `- ` items whose wrapped lines are indented by two spaces, and a code span
 * may open on one line and close on the next — twenty lines in the tree
 * carry an odd number of backticks for that reason. So the lines are joined
 * first, with a single space where the source had a break, and the grammar
 * reads whole entries. A reader that fed it lines would split those spans
 * with no way to rejoin them.
 *
 * **A reference is not resolved here.** A bare `(#1807)` stays inside a
 * `text` span: deriving its link needs a repository the parser has no
 * business knowing, and leaving it as text is what lets the grammar avoid
 * telling a reference from parenthesised prose.
 *
 * @module
 *
 * @import { Utf16 } from '../../ebnf/utf16/types.ts'
 * @import { RewriteSet } from '../../ebnf/ll1/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Align, Block, Blocks, Document, Entry, Inline, Label } from './types.ts'
 */

import { unmapped } from '../../ebnf/ast/module.f.js'
import { entry as entryRule } from '../../ebnf/lib/markdown/module.f.mjs'
import { eof } from '../../ebnf/module.f.mjs'
import { parser } from '../../ebnf/ll1/module.f.mjs'
import { lexeme, units } from '../../ebnf/utf16/module.f.mjs'
import { error, ok } from '../../types/result/module.f.js'
import { charIs, isDigit, isLatinLetter } from '../../text/ascii/module.f.js'

/** @type {RewriteSet<Utf16, never>} */
const nothing = []

/**
 * One whole entry. `eof` is what makes a refusal a refusal: without it a
 * prefix matches and the rest of the entry is dropped in silence.
 */
const parseEntry = parser([entryRule, eof], nothing)

/** @type {(node: unknown) => readonly unknown[]} */
const arr = node => unmapped(/** @type {readonly unknown[]} */(node))

/**
 * A code span's text. A single-backtick body is the code as written. A
 * double-backtick body runs through the two backticks that close it, and
 * CommonMark strips one space from each end when both ends have one and
 * the body is not all spaces, so
 * ``` `` f`x` `` ``` is the code `` f`x` ``.
 *
 * @type {(node: unknown) => string}
 */
const codeText = node => {
    const [kind, body] = arr(arr(node)[1])
    if (kind === 'single') { return lexeme(arr(body)[0]) }
    const text = lexeme(arr(body)[1]).slice(0, -2)
    return text.trim() !== '' && text.startsWith(' ') && text.endsWith(' ') ? text.slice(1, -1) : text
}

/**
 * Text and code alternating, as a link's label and a bold body hold them:
 * the leading run, if any, then each code span and the run after it.
 *
 * @type {(lead: unknown, pairs: unknown) => readonly Label[]}
 */
const labelsOf = (lead, pairs) => {
    /** @type {readonly Label[]} */
    const head = lead === undefined || arr(lead).length === 0 ? [] : [['text', lexeme(lead)]]
    return [...head, ...arr(pairs).flatMap(pair => {
        const [code, tail] = arr(pair)
        /** @type {readonly Label[]} */
        const after = arr(tail).length === 0 ? [] : [['text', lexeme(tail)]]
        return [/** @type {Label} */(['code', codeText(code)]), ...after]
    })]
}

/** A link's label as its spans. @type {(node: unknown) => readonly Label[]} */
const labelOf = node => {
    const [lead, rest] = arr(node)
    return labelsOf(lead, rest)
}

/**
 * A bold or emphasised body as its spans, by the branch the grammar took:
 * one opening with text, or one opening with a code span.
 *
 * @type {(node: unknown) => readonly Label[]}
 */
const emphasisOf = node => {
    const [tag, body] = arr(node)
    if (tag === 'code') { return labelsOf(undefined, body) }
    const [lead, rest] = arr(body)
    return labelsOf(lead, rest)
}

/**
 * One delimited span, by the branch the grammar took. Each case indexes the
 * rule's own tuple: `strong` is the body after the two asterisks it opens
 * with, `em` the body before the one it closes with, and a `link` its label
 * and the two parts of its target.
 *
 * @type {(node: unknown) => Inline}
 */
const spanOf = node => {
    const [tag, body] = arr(node)
    if (tag === 'code') { return ['code', codeText(body)] }
    if (tag === 'link') {
        const l = arr(body)
        // A target is its first symbol, which may not open the angle-bracket
        // form, then the rest of it.
        return ['link', labelOf(l[1]), lexeme([l[3], l[4]])]
    }
    const [kind, inner] = arr(arr(body)[1])
    return kind === 'strong'
        ? ['strong', emphasisOf(arr(inner)[1])]
        : ['em', emphasisOf(arr(inner)[0])]
}

/**
 * A matched entry as its spans: the leading run of text where there is one,
 * then each span and the run of text after it. Both runs are optional in the
 * rule, so an absent one contributes nothing rather than an empty `text`.
 *
 * @type {(node: unknown) => Entry}
 */
const entryOf = node => {
    const [lead, rest] = arr(node)
    /** @type {readonly Inline[]} */
    const head = arr(lead).length === 0 ? [] : [['text', lexeme(lead)]]
    return [...head, ...arr(rest).flatMap(pair => {
        const [span, tail] = arr(pair)
        /** @type {readonly Inline[]} */
        const after = arr(tail).length === 0 ? [] : [['text', lexeme(tail)]]
        return [spanOf(span), ...after]
    })]
}

/**
 * The entries of a release file, as text, with each entry's wrapped lines
 * joined by one space.
 *
 * A `- ` opens an entry, two spaces continue the one before it, and a line
 * with nothing on it closes nothing — the trailing newline every released
 * file ends with is the only such line in the tree.
 *
 * **Any other line is refused, rather than passed over.** A line that is
 * neither — a continuation someone failed to indent, a heading nobody
 * meant — carries words that belong to the release, and dropping it
 * answers with a changelog quietly missing them: the plausible wrong
 * value [`DESIGN.md` §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
 * refuses. The inline half already refuses what it cannot read — that is
 * what pairing its rule with `eof` buys — and this half now says so too.
 *
 * A continuation before any entry is refused for the same reason: it has
 * words and nothing to attach them to.
 *
 * @type {(text: string) => Result<readonly string[], string>}
 */
export const entryTexts = text => {
    // A carriage return is a line ending, not content. A file written on
    // Windows carries one at every break, and refusing it would fail a
    // build over the editor a contributor happened to use.
    const lines = text.split('\n').map(line =>
        line.endsWith('\r') ? line.slice(0, -1) : line)
    /** @type {readonly string[]} */
    let out = []
    let blankAt = -1
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const refuse = /** @type {(why: string) => Result<readonly string[], string>} */(
            why => error(`line ${i + 1}: ${why}`))
        if (line.trim() === '') { blankAt = blankAt === -1 ? i : blankAt }
        else if (blankAt !== -1) {
            // The only blank a released file has is the newline it ends
            // with. A blank anywhere else separates paragraphs inside an
            // entry, or loosens the list between two — either way a
            // structure the entries cannot carry, and joining across it
            // answers with one where the source had two.
            // Named for the blank rather than for the line that followed it:
            // the line here is valid, and the one to delete is the one above.
            return error(
                `line ${blankAt + 1}: a blank line, which only the end of a file may be`)
        }
        else if (line.startsWith('- ')) {
            // **The marker is the dash and the spaces after it.** A second
            // space is indentation, not the first character of the entry:
            // `changelog/0.44.0.md` has one, and keeping it gave that entry
            // a leading `['text', ' ']` span that CommonMark strips and no
            // reader of the page could see.
            const content = line.slice(2)
            // Four more spaces make the rest an indented code block inside
            // the item — CommonMark allows at most four between the marker
            // and the text — and `Entry` has no room for a block of code.
            // Trimming them would answer with prose where GitHub shows code.
            if (content.startsWith('    ') && content.trim() !== '') {
                return refuse('an indented code block opening an entry')
            }
            out = [...out, content.trimStart()]
        }
        else if (line.startsWith('  ') && out.length !== 0) {
            const content = line.trim()
            // An indented marker opens a nested list, which CommonMark
            // reads as a list inside the item and `Entry` cannot hold.
            // Joining it would make one line of prose out of two items.
            if (content.startsWith('- ') || content.startsWith('* ') || content.startsWith('+ ')) {
                return refuse('a nested list item')
            }
            out = [...out.slice(0, -1), `${out[out.length - 1]} ${content}`]
        }
        else { return refuse('neither an entry nor a continuation of one') }
    }
    return ok(out)
}

/**
 * Whether an exclamation mark ends a text span that a link follows, which
 * is an image written in the one way the grammar cannot see.
 *
 * **The grammar reads `!` as ordinary text**, and correctly: an entry ending
 * "and it throws!" is prose. It is only an image when a link follows it
 * immediately, and a rule cannot look that far ahead with the one symbol
 * the backend has. So it is asked here, after recognition, in the place
 * DataJS's own reader asks what its grammar could not
 * ([`ebnf/lib/datajs`](../../ebnf/lib/datajs/module.f.mjs)).
 *
 * CommonMark reads `![alt](u)` as an image; recognised a span at a time it is
 * a `!` and a link, which is a different document rather than a different
 * rendering of one.
 *
 * @type {(entry: Entry) => boolean}
 */
const hasImage = entry => entry.some((span, i) => {
    const next = entry[i + 1]
    return span[0] === 'text' && span[1].endsWith('!')
        && next !== undefined && next[0] === 'link'
})

/** Whether a character is a letter or a digit, in any script. @type {(c: string | undefined) => boolean} */
const isWordChar = c => c !== undefined
    && (charIs(isDigit)(c) || charIs(isLatinLetter)(c) || c.toLowerCase() !== c.toUpperCase())

/** The schemes an autolink is read with here. */
const autolinkSchemes = ['https://', 'http://']

/**
 * Whether an `&` at `i` opens an entity: a name or a number and a `;`.
 *
 * @type {(text: string, i: number) => boolean}
 */
const entityAt = (text, i) => {
    if (text[i] !== '&') { return false }
    const semi = text.indexOf(';', i)
    const name = semi === -1 ? '' : text.slice(i + 1, semi)
    const body = name.startsWith('#') ? name.slice(1) : name
    return body !== '' && [...body].every(isWordChar)
}

/** Whether a character may stand in an email address's domain. @type {(c: string | undefined) => boolean} */
const isDomainChar = c => c !== undefined && (charIs(isDigit)(c) || charIs(isLatinLetter)(c) || c === '-' || c === '_')

/**
 * Whether an `@` at `i` is the middle of an email address GitHub links: a
 * local part's character before it, and a domain of at least two labels
 * after it.
 *
 * @type {(text: string, i: number) => boolean}
 */
const emailAt = (text, i) => {
    const before = text[i - 1]
    if (before === undefined || !(isDomainChar(before) || '.+'.includes(before))) { return false }
    let j = i + 1
    while (isDomainChar(text[j])) { j++ }
    return j > i + 1 && text[j] === '.' && isDomainChar(text[j + 1])
}

/**
 * What GitHub reads in a run of prose that the grammar reads as text, found
 * in one scan after recognition — the place {@link hasImage} asks what a
 * rule with one symbol of lookahead cannot.
 *
 * **Each is refused, or read as GitHub reads it; none is passed through as
 * text.** Passed through, each is a document GitHub does not build
 * ([`commonmark-constructs`](../../ebnf/lib/markdown/todo/commonmark-constructs.md)):
 *
 * - `_` opens or closes emphasis there unless a letter or digit stands on
 *   both sides of it, so only `snake_case` is admitted;
 * - two `~` are GitHub's strikethrough, so a run holds one at most — the
 *   "about" of `~100`;
 * - `&` before a name or a number and a `;` is an entity, read as the
 *   character it names;
 * - `<` before a letter, `/`, `!` or `?` is raw HTML — unless it opens an
 *   `http` autolink, the one form read here, as the link it is;
 * - a bare `http://`, `https://` or `www.` is a link there too.
 *
 * `autolinks` says whether this run may hold an autolink: a link's label is
 * prose too, but a link inside a link is a reading neither side has.
 *
 * @type {(autolinks: boolean) => (text: string) => Result<readonly Inline[], string>}
 */
export const proseSpans = autolinks => text => {
    /** @type {readonly Inline[]} */
    let out = []
    let start = 0
    for (let i = 0; i < text.length; i++) {
        const c = text[i]
        const rest = text.slice(i)
        if (c === '_' && !(isWordChar(text[i - 1]) && isWordChar(text[i + 1]))) {
            return error(`an underscore that GitHub may read as emphasis at ${i}`)
        }
        if (c === '~' && text.indexOf('~', i + 1) !== -1) { return error(`a tilde pair, which GitHub reads as strikethrough, at ${i}`) }
        if (entityAt(text, i)) { return error(`an entity, which GitHub reads as the character it names, at ${i}`) }
        if (autolinks && c === '@' && emailAt(text, i)) { return error(`an email address, which GitHub reads as a link, at ${i}`) }
        if (rest.startsWith('http://') || rest.startsWith('https://') || rest.startsWith('www.')) {
            if (text[i - 1] !== '<') { return error(`a bare URL, which GitHub reads as a link, at ${i}`) }
        }
        if (c === '<') {
            const close = text.indexOf('>', i)
            const target = close === -1 ? '' : text.slice(i + 1, close)
            if (autolinks && autolinkSchemes.some(scheme => target.startsWith(scheme))
                && !target.includes(' ') && !target.includes('<')) {
                out = [...out, ...(i === start ? [] : [/** @type {Inline} */(['text', text.slice(start, i)])]),
                    ['link', [['text', target]], target]]
                start = close + 1
                i = close
                continue
            }
            const next = text[i + 1]
            if (next !== undefined && (charIs(isLatinLetter)(next) || '/!?'.includes(next))) {
                return error(`raw HTML at ${i}`)
            }
        }
    }
    return ok([...out, ...(start === text.length ? [] : [/** @type {Inline} */(['text', text.slice(start)])])])
}

/** Whether a character is ASCII punctuation. @type {(c: string) => boolean} */
const isAsciiPunctuation = c => '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'.includes(c)

/** A span's first character, as the delimiter before it sees it. @type {(span: Inline) => string} */
const firstChar = span => span[0] === 'text' ? span[1][0] : span[0] === 'code' ? '`' : span[0] === 'link' ? '[' : '*'

/** A span's last character, as the delimiter after it sees it. @type {(span: Inline) => string} */
const lastChar = span => span[0] === 'text' ? span[1][span[1].length - 1] : span[0] === 'code' ? '`' : span[0] === 'link' ? ')' : '*'

/**
 * Whether an asterisk run between `outer` and `inner` fails to open or close
 * emphasis on GitHub: punctuation inside it with a word character outside
 * it, as in `a*"b"*`. A character outside ASCII that is no cased letter
 * counts as punctuation inside and as a word character outside, so a run
 * whose reading is unsure is refused.
 *
 * @type {(outer: string | undefined) => (inner: string) => boolean}
 */
const unflanked = outer => inner => !isWordChar(inner) && inner !== ' '
    && outer !== undefined && outer !== ' ' && !isAsciiPunctuation(outer)

/**
 * An entry's spans with every prose run read by {@link proseSpans}: a text
 * run may become text and autolinks, a bold, emphasised or label run is
 * checked and kept. A link with an empty label is refused here, the one
 * place the grammar's alternation cannot.
 *
 * @type {(entry: Entry) => Result<Entry, string>}
 */
const readProse = entry => {
    /** @type {readonly Inline[]} */
    let out = []
    for (const [i, span] of entry.entries()) {
        if (span[0] === 'code') { out = [...out, span]; continue }
        if ((span[0] === 'strong' || span[0] === 'em')
            && (unflanked(i === 0 ? undefined : lastChar(entry[i - 1]))(firstChar(span[1][0]))
                || unflanked(i === entry.length - 1 ? undefined : firstChar(entry[i + 1]))(lastChar(span[1][span[1].length - 1])))) {
            return error('bold or emphasis that GitHub does not read as one, with punctuation inside and a letter outside')
        }
        if (span[0] === 'text') {
            const read = proseSpans(true)(span[1])
            if (read[0] === 'error') { return read }
            out = [...out, ...read[1]]
            continue
        }
        const texts = span[1].flatMap(l => l[0] === 'text' ? [l[1]] : [])
        if (span[0] === 'link' && span[1].length === 0) { return error('a link with an empty label') }
        // CommonMark reads an asterisk with a space inside it as no
        // delimiter at all, so `a * b * c` is prose there and a body
        // padded with a space is refused here, not read as emphasis.
        const first = span[1][0]
        const last = span[1][span[1].length - 1]
        if (span[0] !== 'link' && ((first[0] === 'text' && first[1].startsWith(' ')) || (last[0] === 'text' && last[1].endsWith(' ')))) {
            return error('bold or emphasis padded with a space')
        }
        // CommonMark reads an entity in a destination as the character it
        // names, and the page would keep it as written.
        if (span[0] === 'link' && [...span[2]].some((_, i) => entityAt(span[2], i))) {
            return error('an entity in a link target')
        }
        // A link's label holds no link; bold and emphasis may, and an
        // autolink there is a link the kept span would drop.
        for (const t of texts) {
            const read = proseSpans(span[0] !== 'link')(t)
            if (read[0] === 'error') { return error(read[1]) }
            if (read[1].some(s => s[0] === 'link')) { return error('an autolink inside bold or emphasis') }
        }
        out = [...out, span]
    }
    return ok(out)
}

/**
 * One entry's joined text as its spans, or the position it stopped at.
 *
 * @type {(text: string) => Result<Entry, string>}
 */
export const tryParseEntry = text => {
    const match = parseEntry(units(text))
    if (match[0] === 'error') { return error(`entry: unexpected symbol at ${match[1]}`) }
    const entry = entryOf(arr(arr(match[1])[0])[0])
    return hasImage(entry) ? error('an image, which an entry does not hold') : readProse(entry)
}

/**
 * A release file as its entries, or the first that does not parse. The
 * version is the file name and never appears inside the file, so it is no
 * part of what this reads.
 *
 * @type {(text: string) => Result<Document, string>}
 */
export const tryParse = text => {
    const texts = entryTexts(text)
    if (texts[0] === 'error') { return texts }
    /** @type {readonly Entry[]} */
    let out = []
    for (const [i, t] of texts[1].entries()) {
        const one = tryParseEntry(t)
        if (one[0] === 'error') { return error(`entry ${i}: ${one[1]}`) }
        out = [...out, one[1]]
    }
    return ok(out)
}

/**
 * The level of an ATX heading, `# ` through `###### `, or `0` for a line that
 * opens none: a `#` run with a word after it is prose in CommonMark, and
 * seven of them are too; a space or a tab after it opens the heading. A
 * run that ends the line is an empty heading there, so it opens one here
 * too, for the reader to refuse.
 *
 * @type {(line: string) => number}
 */
const headingLevel = line => {
    let level = 0
    while (line[level] === '#') { level++ }
    return level >= 1 && level <= 6 && (line[level] === ' ' || line[level] === '\t' || line.length === level) ? level : 0
}

/** Whether a line opens a fenced code block. @type {(line: string) => boolean} */
const isFence = line => line.startsWith('```')

/**
 * What GitHub reads a line as when it starts a block this reader has no
 * room for, or `null` for a line it reads as these do.
 *
 * **Each is refused, not read as prose.** A block quote, a table row, raw
 * HTML, a numbered list, another bullet, an indented code block, a
 * fence, heading or list item indented by up to three spaces, a
 * thematic break and a heading's underline are each a structure on GitHub,
 * and prose here would be the README GitHub does not show.
 *
 * @type {(line: string) => string | null}
 */
const foreignBlock = line => {
    const trimmed = line.trim()
    if (line.startsWith('    ')) { return 'an indented code block' }
    // A tab stops at the next fourth column, so where its block starts
    // depends on columns this reader does not count.
    if (line.slice(0, line.length - line.trimStart().length).includes('\t')) { return 'a tab in an indent' }
    if (trimmed.startsWith('>')) { return 'a block quote' }
    if (trimmed.startsWith('|')) { return 'a table' }
    // A table's delimiter row: its header row need not open with a pipe, so
    // the row under it is where a table is told from a paragraph.
    if (trimmed.includes('|') && trimmed.includes('-') && [...trimmed].every(c => '-:| '.includes(c))) {
        return 'a table'
    }
    // An autolink opens a paragraph on GitHub, not an HTML block: its
    // scheme's `:` is no tag name's character.
    if (trimmed.startsWith('<') && !autolinkSchemes.some(scheme => trimmed.startsWith(`<${scheme}`))) { return 'raw HTML' }
    if (trimmed.startsWith('~~~')) { return 'a tilde code fence' }
    // Indented by up to three spaces, each of these is still the block it
    // opens on GitHub; unindented, the reader reads it before asking here.
    if (trimmed.startsWith('```')) { return 'an indented code fence' }
    if (headingLevel(trimmed) !== 0) { return 'an indented heading' }
    if (trimmed.startsWith('- ')) { return 'an indented list item' }
    // A marker that ends its line opens an empty item.
    if ((trimmed[0] === '*' || trimmed[0] === '+') && (trimmed.length === 1 || trimmed[1] === ' ' || trimmed[1] === '\t')) {
        return 'a list marked other than with `- `'
    }
    let digits = 0
    while (charIs(isDigit)(trimmed[digits] ?? '')) { digits++ }
    if (digits !== 0 && (trimmed[digits] === '.' || trimmed[digits] === ')')
        && (trimmed[digits + 1] === ' ' || trimmed.length === digits + 1)) { return 'a numbered list' }
    if (trimmed.length !== 0 && '-=*_'.includes(trimmed[0])
        && [...trimmed].every(c => c === trimmed[0] || c === ' ')) {
        return 'a thematic break or a heading underline'
    }
    if (line.endsWith('  ')) { return 'a hard line break' }
    return null
}

/**
 * One block's inline text as its spans, refused with the line it began on.
 *
 * @type {(line: number, text: string) => Result<Entry, string>}
 */
const inlineAt = (line, text) => {
    const spans = tryParseEntry(text)
    return spans[0] === 'error' ? error(`line ${line}: ${spans[1]}`) : spans
}

/**
 * A table row's cells as their text: the row without the pipes that open
 * and close it, split at every pipe between. A pipe inside a code span
 * splits it too, as it does on GitHub, which is why a cell's text is read
 * only once it is a cell.
 *
 * @type {(row: string) => readonly string[]}
 */
const cells = row => {
    const t = row.trim()
    return t.slice(1, t.endsWith('|') && t.length > 1 ? -1 : t.length).split('|').map(c => c.trim())
}

/**
 * A delimiter cell's alignment, or `undefined` for a cell that is not one:
 * a run of `-` with an optional `:` at either end.
 *
 * @type {(cell: string) => Align | undefined}
 */
const alignOf = cell => {
    const left = cell.startsWith(':')
    const right = cell.endsWith(':') && cell.length > 1
    const dashes = cell.slice(left ? 1 : 0, right ? -1 : cell.length)
    if (dashes === '' || [...dashes].some(c => c !== '-')) { return undefined }
    return left && right ? 'center' : left ? 'left' : right ? 'right' : null
}

/**
 * The column alignments a header row and the line under it open a table
 * with, or `null` where GitHub reads no table: the row must open with a
 * pipe, and the line under it be a delimiter row with as many cells.
 *
 * @type {(header: string, delimiter: string | undefined) => readonly Align[] | null}
 */
const tableAligns = (header, delimiter) => {
    if (!header.startsWith('|') || delimiter === undefined || !delimiter.startsWith('|')) { return null }
    const aligns = cells(delimiter).map(alignOf)
    if (aligns.some(a => a === undefined) || aligns.length !== cells(header).length) { return null }
    return /** @type {readonly Align[]} */(aligns)
}

/**
 * A run of lines as its blocks, each with the indexes of its first and last
 * line, or the first line GitHub reads as something these blocks cannot
 * hold. `base` is the source line the run starts after, so that a refusal
 * inside a list item names the line in the file; `inItem` says the run is
 * a list item's, where a heading is refused.
 *
 * @type {(base: number, inItem: boolean) => (lines: readonly string[]) => Result<readonly (readonly [Block, number, number])[], string>}
 */
const readBlocks = (base, inItem) => lines => {
    /** @type {readonly (readonly [Block, number, number])[]} */
    let out = []
    let i = 0
    /** @type {(at: number, why: string) => Result<readonly (readonly [Block, number, number])[], string>} */
    const refuseAt = (at, why) => error(`line ${base + at + 1}: ${why}`)
    while (i < lines.length) {
        const line = lines[i]
        const at = base + i + 1
        if (line.trim() === '') { i++; continue }
        if (isFence(line)) {
            const info = line.slice(3)
            if (info.includes('`') || info.includes(' ')) { return refuseAt(i, 'a code fence whose info string is not one word') }
            const close = lines.indexOf('```', i + 1)
            if (close === -1) { return refuseAt(i, 'a code fence that is never closed') }
            out = [...out, [['code', info, lines.slice(i + 1, close).join('\n')], i, close]]
            i = close + 1
            continue
        }
        const level = headingLevel(line)
        if (level !== 0) {
            // A heading inside an item has no anchor GitHub would give it
            // the same way, so it is not read as one.
            if (inItem) { return refuseAt(i, 'a heading inside a list item') }
            const content = line.slice(level + 1).trim()
            if (content === '' || content.endsWith('#')) { return refuseAt(i, 'a heading that is empty or closed by `#`') }
            const spans = inlineAt(at, content)
            if (spans[0] === 'error') { return spans }
            out = [...out, [['heading', level, spans[1]], i, i]]
            i++
            continue
        }
        if (line.startsWith('- ')) {
            /** @type {readonly Blocks[]} */
            let items = []
            let loose = false
            let j = i
            let more = true
            while (more) {
                const start = j
                const first = lines[j].slice(2)
                // A marker with nothing after it, or with more than one
                // space, sets the item's text at a column its other lines
                // would have to match; every item here is written `- text`.
                if (first.trim() === '' || first.startsWith(' ')) {
                    return refuseAt(j, 'a list item whose text does not follow its marker')
                }
                /** @type {readonly string[]} */
                let body = [first]
                j++
                while (j < lines.length && !lines[j].startsWith('- ')) {
                    const l = lines[j]
                    if (l.trim() === '') {
                        // A blank line stays in the item when an indented
                        // line follows it, and ends the list otherwise.
                        let k = j
                        while (k < lines.length && lines[k].trim() === '') { k++ }
                        if (k === lines.length || !lines[k].startsWith('  ')) { break }
                        body = [...body, ...lines.slice(j, k).map(() => '')]
                        j = k
                        continue
                    }
                    if (!l.startsWith('  ')) {
                        return refuseAt(j, 'a line that GitHub reads as part of the list item above it')
                    }
                    body = [...body, l.slice(2)]
                    j++
                }
                const read = readBlocks(base + start, true)(body)
                if (read[0] === 'error') { return read }
                const placed = read[1]
                // A blank line between two blocks of one item loosens it.
                loose = loose || placed.some((p, k) => k !== 0 && p[1] > placed[k - 1][2] + 1)
                items = [...items, placed.map(p => p[0])]
                let k = j
                while (k < lines.length && lines[k].trim() === '') { k++ }
                more = k < lines.length && lines[k].startsWith('- ')
                // So does one between two items.
                loose = loose || (more && k !== j)
                j = more ? k : start + body.length
            }
            out = [...out, [['list', loose, items], i, j - 1]]
            i = j
            continue
        }
        const aligns = tableAligns(line, lines[i + 1])
        if (aligns !== null) {
            let end = i + 2
            while (end < lines.length && lines[end].trim() !== '') { end++ }
            const rows = lines.slice(i, end)
            /** @type {(readonly Entry[])[]} */
            let read = []
            for (const [r, row] of rows.entries()) {
                if (r === 1) { continue }
                // An escaped pipe is a cell's content on GitHub, and a
                // split here.
                if (row.includes('\\|')) { return refuseAt(i + r, 'an escaped pipe in a table') }
                if (!row.startsWith('|')) { return refuseAt(i + r, 'a table row that does not open with a pipe') }
                const texts = cells(row)
                if (texts.length !== aligns.length) { return refuseAt(i + r, 'a table row whose cells do not match its header') }
                /** @type {readonly Entry[]} */
                let entries = []
                for (const t of texts) {
                    const spans = inlineAt(at + r, t)
                    if (spans[0] === 'error') { return spans }
                    entries = [...entries, spans[1]]
                }
                read = [...read, entries]
            }
            out = [...out, [['table', aligns, read[0], read.slice(1)], i, end - 1]]
            i = end
            continue
        }
        const foreign = foreignBlock(line)
        if (foreign !== null) { return refuseAt(i, foreign) }
        let end = i + 1
        while (end < lines.length && lines[end].trim() !== ''
            && headingLevel(lines[end]) === 0 && !isFence(lines[end]) && !lines[end].startsWith('- ')) {
            const continued = foreignBlock(lines[end].trimStart())
            if (continued !== null) { return refuseAt(end, continued) }
            end++
        }
        const spans = inlineAt(at, lines.slice(i, end).map(l => l.trim()).join(' '))
        if (spans[0] === 'error') { return spans }
        out = [...out, [['paragraph', spans[1]], i, end - 1]]
        i = end
    }
    return ok(out)
}

/**
 * A README as its blocks, or the first line GitHub reads as something these
 * blocks cannot hold
 * ([`render-readme`](../../website/todo/render-readme.md)).
 *
 * The blocks are the ones a README is written in: an ATX heading, a
 * paragraph, a code fence opened by three backticks, a list of `- ` items,
 * each holding blocks of its own indented by two spaces, and a table whose
 * rows open with a pipe.
 *
 * **What GitHub reads differently is refused, not approximated.** A line
 * after a list item with no blank before it and no indentation continues
 * GitHub's item lazily; a heading closed by `#`s loses them there. Each
 * would be a different page here, so each is the refusal that keeps the
 * README a link to GitHub instead.
 *
 * @type {(text: string) => Result<Blocks, string>}
 */
export const tryParseBlocks = text => {
    const read = readBlocks(0, false)(text.split('\n').map(line => line.endsWith('\r') ? line.slice(0, -1) : line))
    return read[0] === 'error' ? read : ok(read[1].map(p => p[0]))
}
