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
 * @import { Align, Block, Blocks, Document, Entry, Image, Inline, Label, LinkLabel, ListMarker } from './types.ts'
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

/** A plain link's label as its spans. @type {(node: unknown) => readonly Label[]} */
const labelOf = node => {
    const [lead, rest] = arr(node)
    return labelsOf(lead, rest)
}

/**
 * A link's target, from the rule's own tuple: its first symbol, which may
 * not open the angle-bracket form, then the rest of it.
 *
 * @type {(link: readonly unknown[]) => string}
 */
const targetOf = l => lexeme([l[3], l[4]])

/** A plain link's label and target. @type {(node: unknown) => readonly [readonly Label[], string]} */
const plainLinkOf = node => {
    const l = arr(node)
    return [labelOf(l[1]), targetOf(l)]
}

/**
 * The text before an image's `!`, where `span`, the span before a link,
 * ends with one; `null` where it does not, so the link is no image.
 *
 * @type {(span: Inline | LinkLabel | undefined) => readonly Label[] | null}
 */
const beforeBang = span => {
    if (span === undefined || span[0] !== 'text' || !span[1].endsWith('!')) { return null }
    const rest = span[1].slice(0, -1)
    return rest === '' ? [] : [['text', rest]]
}

/**
 * An image of a plain link: its words, code included, are its alternative
 * text. GitHub reads the label as prose before it drops the markup, so
 * `&amp;` there is `&`, and two code spans side by side are one; the label
 * is read as a link's is, whole and span by span, and what that refuses is
 * refused.
 *
 * @type {(link: readonly [readonly Label[], string]) => Result<Image, string>}
 */
const imageOf = ([label, src]) => {
    if (codeSideBySide(label)) { return error('two code spans side by side, which GitHub reads as one') }
    if (proseTildePair(label)) { return error('a tilde pair in a span body, which GitHub may read as strikethrough') }
    for (const [kind, t] of label) {
        const read = kind === 'text' ? proseSpans(false)(t) : ok([])
        if (read[0] === 'error') { return read }
    }
    return ok(['image', label.map(([, t]) => t).join(''), src])
}

/**
 * A link's label as its spans: text and code, and an image where an `!`
 * comes before a link inside it. Any other link inside a label is refused,
 * as GitHub never nests one link in another.
 *
 * @type {(node: unknown) => Result<readonly LinkLabel[], string>}
 */
const linkLabelOf = node => {
    const [lead, rest] = arr(node)
    /** @type {readonly LinkLabel[]} */
    let out = arr(lead).length === 0 ? [] : [['text', lexeme(lead)]]
    for (const part of arr(rest)) {
        const [tag, body] = arr(part)
        const [span, tail] = arr(body)
        /** @type {readonly LinkLabel[]} */
        const after = arr(tail).length === 0 ? [] : [['text', lexeme(tail)]]
        if (tag === 'code') {
            out = [...out, ['code', codeText(span)], ...after]
            continue
        }
        const before = beforeBang(out[out.length - 1])
        if (before === null) { return error('a link inside a link') }
        const image = imageOf(plainLinkOf(span))
        if (image[0] === 'error') { return image }
        out = [...out.slice(0, -1), ...before, image[1], ...after]
    }
    return ok(out)
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
 * @type {(node: unknown) => Result<Inline, string>}
 */
const spanOf = node => {
    const [tag, body] = arr(node)
    if (tag === 'code') { return ok(['code', codeText(body)]) }
    if (tag === 'link') {
        const l = arr(body)
        const label = linkLabelOf(l[1])
        if (label[0] === 'error') { return label }
        return ok(['link', label[1], targetOf(l)])
    }
    const [kind, inner] = arr(arr(body)[1])
    return ok(kind === 'strong'
        ? ['strong', emphasisOf(arr(inner)[1])]
        : ['em', emphasisOf(arr(inner)[0])])
}

/**
 * A matched entry as its spans: the leading run of text where there is one,
 * then each span and the run of text after it. Both runs are optional in the
 * rule, so an absent one contributes nothing rather than an empty `text`.
 *
 * **A link after an `!` is an image**, as CommonMark reads `![alt](u)`; the
 * grammar reads the `!` as text, since only a link right after it makes it
 * more, which one symbol of lookahead cannot see. An image of a link that
 * shows an image is refused: its alternative text would be an image's.
 *
 * @type {(node: unknown) => Result<Entry, string>}
 */
const entryOf = node => {
    const [lead, rest] = arr(node)
    /** @type {readonly Inline[]} */
    let out = arr(lead).length === 0 ? [] : [['text', lexeme(lead)]]
    for (const pair of arr(rest)) {
        const [node, tail] = arr(pair)
        /** @type {readonly Inline[]} */
        const after = arr(tail).length === 0 ? [] : [['text', lexeme(tail)]]
        const span = spanOf(node)
        if (span[0] === 'error') { return span }
        const s = span[1]
        const before = s[0] === 'link' ? beforeBang(out[out.length - 1]) : null
        if (s[0] !== 'link' || before === null) {
            out = [...out, s, ...after]
            continue
        }
        if (s[1].some(l => l[0] === 'image')) { return error('an image inside an image') }
        const image = imageOf([/** @type {readonly Label[]} */(s[1]), s[2]])
        if (image[0] === 'error') { return image }
        out = [...out.slice(0, -1), ...before, image[1], ...after]
    }
    return ok(out)
}

/** Whether an entry shows an image, as itself or in a link's label. @type {(entry: Entry) => boolean} */
const hasImage = entry => entry.some(span => span[0] === 'image' || (span[0] === 'link' && span[1].some(l => l[0] === 'image')))

/**
 * The entries of a release file, as text, with each entry's wrapped lines
 * joined by one space.
 *
 * A `- ` opens an entry; its padding sets the continuation indent. A line
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
    let contentIndent = 2
    for (let i = 0; i < lines.length; i += 1) {
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
            contentIndent = content.trim() === '' ? 2 : 2 + content.length - content.trimStart().length
            out = [...out, content.trimStart()]
        }
        else if (line.startsWith('  ') && out.length !== 0) {
            // The marker's padding sets this item's layout width. Remove
            // only that width; further spaces may belong to a code span.
            const leading = line.length - line.trimStart().length
            const content = line.slice(Math.min(contentIndent, leading))
            const marker = content.trimStart()
            // An indented marker opens a nested list, which CommonMark
            // reads as a list inside the item and `Entry` cannot hold.
            // Joining it would make one line of prose out of two items.
            if (marker.startsWith('- ') || marker.startsWith('* ') || marker.startsWith('+ ')) {
                return refuse('a nested list item')
            }
            out = [...out.slice(0, -1), `${out[out.length - 1]} ${content}`]
        }
        else { return refuse('neither an entry nor a continuation of one') }
    }
    return ok(out)
}

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

/**
 * Refuse shortcode candidates rather than maintain a copy of GitHub's emoji
 * catalogue. Code spans and link destinations are checked outside prose.
 *
 * @type {(text: string, i: number) => boolean}
 */
const shortcodeAt = (text, i) => {
    if (text[i] !== ':') { return false }
    const end = text.indexOf(':', i + 1)
    return end > i + 1 && [...text.slice(i + 1, end)].every(c => isWordChar(c) || c === '_' || c === '+' || c === '-')
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
    while (isDomainChar(text[j])) { j += 1 }
    return j > i + 1 && text[j] === '.' && isDomainChar(text[j + 1])
}

/** What GitHub drops from the end of an extended autolink. */
const urlTrailing = '?!.,:*_~\'"'

/**
 * The `http://` or `https://` URL `text` opens, as GitHub's extended
 * autolink reads it: up to the first space or `<`, less the punctuation
 * GitHub leaves after a link — `?!.,:*_~'"`, and a `)` that closes no `(`
 * of the URL's own. `null` where GitHub would read it otherwise: a host with
 * no dot, or a character outside letters, digits, `.`, `-` and `_`, or an
 * end like an entity, `&name;`.
 *
 * @type {(text: string) => string | null}
 */
export const bareUrl = text => {
    let end = 0
    while (end < text.length && text[end] !== ' ' && text[end] !== '\t' && text[end] !== '<') { end += 1 }
    let url = text.slice(0, end)
    let trimmed = true
    while (trimmed) {
        trimmed = false
        const last = url[url.length - 1]
        if (last !== undefined && urlTrailing.includes(last)) {
            url = url.slice(0, -1)
            trimmed = true
        } else if (last === ')' && url.split(')').length > url.split('(').length) {
            url = url.slice(0, -1)
            trimmed = true
        }
    }
    if (url.endsWith(';')) { return null }
    const scheme = url.indexOf('://') + 3
    const hostEnd = [...url.slice(scheme)].findIndex(c => c === '/' || c === '?' || c === '#')
    const host = url.slice(scheme, hostEnd === -1 ? url.length : scheme + hostEnd)
    if (!host.includes('.') || [...host].some(c => !(isWordChar(c) || c === '.' || c === '-' || c === '_'))) { return null }
    return url
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
 *   `http` autolink, which is read as the link it is;
 * - a bare `http://` or `https://` URL is a link there too, GitHub's
 *   extended autolink, and is read as one where it stands after a space,
 *   a `(` or nothing and its host has a dot ({@link bareUrl}); a bare
 *   `www.`, and a bare URL anywhere else, is refused.
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
    for (let i = 0; i < text.length; i += 1) {
        const c = text[i]
        const rest = text.slice(i)
        if (c === '_' && !(isWordChar(text[i - 1]) && isWordChar(text[i + 1]))) {
            return error(`an underscore that GitHub may read as emphasis at ${i}`)
        }
        if (c === '~' && text.indexOf('~', i + 1) !== -1) { return error(`a tilde pair, which GitHub reads as strikethrough, at ${i}`) }
        if (entityAt(text, i)) { return error(`an entity, which GitHub reads as the character it names, at ${i}`) }
        if (shortcodeAt(text, i)) { return error(`an emoji shortcode candidate at ${i}`) }
        if (autolinks && c === '@' && emailAt(text, i)) { return error(`an email address, which GitHub reads as a link, at ${i}`) }
        if (rest.startsWith('http://') || rest.startsWith('https://') || rest.startsWith('www.')) {
            if (text[i - 1] !== '<') {
                const before = text[i - 1]
                const url = autolinks && !rest.startsWith('www.') && (before === undefined || before === ' ' || before === '(') ? bareUrl(rest) : null
                if (url === null) { return error(`a bare URL, which GitHub reads as a link, at ${i}`) }
                out = [...out, ...(i === start ? [] : [/** @type {Inline} */(['text', text.slice(start, i)])]),
                    ['link', [['text', url]], url]]
                start = i + url.length
                i = start - 1
                continue
            }
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
const firstChar = span => span[0] === 'text' ? span[1][0] : span[0] === 'code' ? '`' : span[0] === 'link' ? '[' : span[0] === 'image' ? '!' : '*'

/**
 * A span's last character, as the delimiter after it sees it. Bold or
 * emphasis right before emphasis is refused before this is asked, so any
 * other span is a link.
 *
 * @type {(span: Inline) => string}
 */
const lastChar = span => span[0] === 'text' ? span[1][span[1].length - 1] : span[0] === 'code' ? '`' : ')'

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
 * Whether two code spans stand side by side: that is `a``b` between single
 * backticks, and CommonMark reads the double run as content of one span.
 *
 * @type {(spans: readonly (Inline | Label)[]) => boolean}
 */
const codeSideBySide = spans => spans.some((s, i) => i !== 0 && s[0] === 'code' && spans[i - 1][0] === 'code')

/**
 * Tilde delimiters can surround other spans. Code contents and link targets
 * are not prose; link labels and emphasis bodies are checked separately
 * in their own scopes.
 *
 * @type {(spans: readonly (Inline | Label)[]) => boolean}
 */
const proseTildePair = spans => {
    const text = spans.flatMap(s => s[0] === 'text' ? [s[1]] : []).join('')
    const first = text.indexOf('~')
    return first !== -1 && text.indexOf('~', first + 1) !== -1
}

/** Whether a link's or an image's address holds an entity. @type {(address: string) => boolean} */
const entityIn = address => [...address].some((_, i) => entityAt(address, i))

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
    if (codeSideBySide(entry)) { return error('two code spans side by side, which GitHub reads as one') }
    if (proseTildePair(entry)) { return error('a tilde pair, which GitHub may read as strikethrough') }
    for (const [i, span] of entry.entries()) {
        if (span[0] === 'code') { out = [...out, span]; continue }
        // `*a**b*` is one emphasis holding `**` in CommonMark, not two.
        if ((span[0] === 'strong' || span[0] === 'em') && i !== 0 && (entry[i - 1][0] === 'strong' || entry[i - 1][0] === 'em')) {
            return error('bold or emphasis side by side, which GitHub reads otherwise')
        }
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
        // CommonMark reads an entity in a source as the character it names.
        if (span[0] === 'image') {
            if (entityIn(span[2])) { return error('an entity in an image source') }
            out = [...out, span]
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
        // A label's code spans side by side are one span in CommonMark too.
        if (codeSideBySide(span[1])) { return error('two code spans side by side, which GitHub reads as one') }
        if (proseTildePair(span[1])) { return error('a tilde pair in a span body, which GitHub may read as strikethrough') }
        // CommonMark reads an entity in a destination as the character it
        // names, and the page would keep it as written.
        if (span[0] === 'link' && entityIn(span[2])) { return error('an entity in a link target') }
        if (span[0] === 'link' && span[1].some(l => l[0] === 'image' && entityIn(l[2]))) { return error('an entity in an image source') }
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
 * One run of inline text as its spans, or where it stopped: a release
 * entry's, or a README block's, which alone may show images.
 *
 * @type {(images: boolean) => (text: string) => Result<Entry, string>}
 */
const parseInline = images => text => {
    const match = parseEntry(units(text))
    if (match[0] === 'error') { return error(`entry: unexpected symbol at ${match[1]}`) }
    const entry = entryOf(arr(arr(match[1])[0])[0])
    if (entry[0] === 'error') { return entry }
    return !images && hasImage(entry[1]) ? error('an image, which an entry does not hold') : readProse(entry[1])
}

/**
 * One release entry's joined text as its spans, or the position it stopped
 * at. An entry holds no image.
 *
 * @type {(text: string) => Result<Entry, string>}
 */
export const tryParseEntry = parseInline(false)

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
    while (line[level] === '#') { level += 1 }
    return level >= 1 && level <= 6 && (line[level] === ' ' || line[level] === '\t' || line.length === level) ? level : 0
}

/** Whether a line opens a fenced code block. @type {(line: string) => boolean} */
const isFence = line => line.startsWith('```')

/** A closing fence permits up to three leading spaces and trailing whitespace. @type {(line: string) => boolean} */
const isClosingFence = line => {
    let indent = 0
    while (line[indent] === ' ') { indent += 1 }
    let end = line.length
    while (line[end - 1] === ' ' || line[end - 1] === '\t') { end -= 1 }
    const fence = line.slice(indent, end)
    return indent <= 3 && fence.length >= 3 && [...fence].every(c => c === '`')
}

/**
 * What GitHub reads a line as when it starts a block this reader has no
 * room for, or `null` for a line it reads as these do.
 *
 * **Each is refused, not read as prose.** An indented block quote, a table row, raw
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
    if (trimmed.startsWith('>')) { return 'an indented block quote' }
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
    if (trimmed.startsWith('-\t')) { return 'a tab-delimited list item' }
    // A marker that ends its line opens an empty item.
    if ((trimmed[0] === '*' || trimmed[0] === '+') && (trimmed.length === 1 || trimmed[1] === ' ' || trimmed[1] === '\t')) {
        return 'a list marked other than with `- `'
    }
    let digits = 0
    while (charIs(isDigit)(trimmed[digits] ?? '')) { digits += 1 }
    if (digits !== 0 && (trimmed[digits] === '.' || trimmed[digits] === ')')
        && (trimmed[digits + 1] === ' ' || trimmed[digits + 1] === '\t' || trimmed.length === digits + 1)) { return 'a numbered list' }
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
    const spans = parseInline(true)(text)
    return spans[0] === 'error' ? error(`line ${line}: ${spans[1]}`) : spans
}

/**
 * A table row's cells as their text: the row without the pipes that open
 * and close it, split at every pipe between. A pipe inside a code span
 * splits it too, as it does on GitHub, which is why a cell's text is read
 * only once it is a cell. An escaped pipe, `\|`, splits nothing and is a
 * `|` of the cell's text, in a code span too, as GitHub reads it.
 *
 * @type {(row: string) => readonly string[]}
 */
const cells = row => {
    const t = row.trim()
    const inner = t.slice(1, t.endsWith('|') && !t.endsWith('\\|') && t.length > 1 ? -1 : t.length)
    /** @type {readonly string[]} */
    let out = []
    let cell = ''
    for (let k = 0; k < inner.length; k += 1) {
        if (inner[k] === '\\' && inner[k + 1] === '|') {
            cell = `${cell}|`
            k += 1
        } else if (inner[k] === '|') {
            out = [...out, cell.trim()]
            cell = ''
        } else {
            cell = `${cell}${inner[k]}`
        }
    }
    return [...out, cell.trim()]
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
 * The marker a list item opens `line` with: `- `, or a number of one to
 * nine digits, its `.` or `)` and a space, GitHub's ordered list item. Its
 * delimiter, which a list's items share; the number, for an ordered item;
 * and the columns it takes, where the item's other lines are indented.
 *
 * @type {(line: string) => ListMarker | null}
 */
const listMarker = line => {
    if (line.startsWith('- ')) { return { delimiter: '-', start: null, width: 2 } }
    let digits = 0
    while (digits < 10 && charIs(isDigit)(line[digits] ?? '')) { digits += 1 }
    const delimiter = line[digits]
    if (digits === 0 || digits > 9 || (delimiter !== '.' && delimiter !== ')') || line[digits + 1] !== ' ') { return null }
    return { delimiter, start: Number(line.slice(0, digits)), width: digits + 2 }
}

/**
 * A task item's checkbox, `[ ]` or `[x]` and the space after it, opening a
 * list item's text: whether it is checked, or `null` where the text opens
 * with something else. GitHub reads `[X]` as checked too.
 *
 * @type {(text: string) => boolean | null}
 */
const taskMarker = text =>
    text[0] !== '[' || text[2] !== ']' || text[3] !== ' ' ? null
    : text[1] === ' ' ? false
    : text[1] === 'x' || text[1] === 'X' ? true
    : null

/**
 * A run of lines as its blocks, each with the indexes of its first and last
 * line, or the first line GitHub reads as something these blocks cannot
 * hold. `base` is the source line the run starts after, so that a refusal
 * inside a list item or a block quote names the line in the file;
 * `container` names what holds the run, `a list item` or `a block quote`,
 * where a heading is refused, or is `null` for the README's own blocks.
 *
 * @type {(base: number, container: string | null) => (lines: readonly string[]) => Result<readonly (readonly [Block, number, number])[], string>}
 */
const readBlocks = (base, container) => lines => {
    /** @type {readonly (readonly [Block, number, number])[]} */
    let out = []
    let i = 0
    /** @type {(at: number, why: string) => Result<readonly (readonly [Block, number, number])[], string>} */
    const refuseAt = (at, why) => error(`line ${base + at + 1}: ${why}`)
    while (i < lines.length) {
        const line = lines[i]
        const at = base + i + 1
        if (line.trim() === '') { i += 1; continue }
        if (isFence(line)) {
            const info = line.slice(3)
            if (info.includes('`') || info.includes(' ') || info.includes('\t')) { return refuseAt(i, 'a code fence whose info string is not one word') }
            if (info.includes('\\')) { return refuseAt(i, 'a code fence whose info string contains a backslash escape') }
            if ([...info].some((_, index) => entityAt(info, index))) { return refuseAt(i, 'an entity in a code fence info string') }
            const close = lines.findIndex((candidate, index) => index > i && isClosingFence(candidate))
            if (close === -1) { return refuseAt(i, 'a code fence that is never closed') }
            out = [...out, [['code', info, close === i + 1 ? '' : lines.slice(i + 1, close).join('\n') + '\n'], i, close]]
            i = close + 1
            continue
        }
        const level = headingLevel(line)
        if (level !== 0) {
            // A heading inside an item or a quote has no anchor GitHub
            // would give it the same way, so it is not read as one.
            if (container !== null) { return refuseAt(i, `a heading inside ${container}`) }
            const content = line.slice(level + 1).trim()
            if (content === '' || content.endsWith('#')) { return refuseAt(i, 'a heading that is empty or closed by `#`') }
            const spans = inlineAt(at, content)
            if (spans[0] === 'error') { return spans }
            out = [...out, [['heading', level, spans[1]], i, i]]
            i += 1
            continue
        }
        if (line.startsWith('>')) {
            // Each line drops its `>` and the one space after it, as
            // GitHub's quote reads it; the rest are the quote's own lines.
            let end = i
            /** @type {readonly string[]} */
            let body = []
            while (end < lines.length && lines[end].startsWith('>')) {
                const rest = lines[end].slice(1)
                // A tab after the marker counts columns this reader does not.
                if (rest.startsWith('\t')) { return refuseAt(end, 'a tab after a block quote marker') }
                body = [...body, rest.startsWith(' ') ? rest.slice(1) : rest]
                end += 1
            }
            // GitHub continues a quote's paragraph on a line with no `>`.
            if (end < lines.length && lines[end].trim() !== '') {
                return refuseAt(end, 'a line right after a block quote, which GitHub may read as part of it')
            }
            const read = readBlocks(base + i, 'a block quote')(body)
            if (read[0] === 'error') { return read }
            out = [...out, [['quote', read[1].map(p => p[0])], i, end - 1]]
            i = end
            continue
        }
        const marker = listMarker(line)
        if (marker !== null) {
            /** @type {(l: string) => ListMarker | null} */
            const sameList = l => {
                const m = listMarker(l)
                return m !== null && m.delimiter === marker.delimiter ? m : null
            }
            /** @type {readonly Blocks[]} */
            let items = []
            let loose = false
            let j = i
            let more = true
            while (more) {
                const start = j
                const width = /** @type {ListMarker} */ (sameList(lines[j])).width
                const indent = ' '.repeat(width)
                const marked = lines[j].slice(width)
                // A marker with nothing after it, or with more than one
                // space, sets the item's text at a column its other lines
                // would have to match; every item here is written `- text`.
                if (marked.trim() === '' || marked.startsWith(' ')) {
                    return refuseAt(j, 'a list item whose text does not follow its marker')
                }
                const checked = taskMarker(marked)
                const first = checked === null ? marked : marked.slice(4)
                if (checked !== null && (first.trim() === '' || first.startsWith(' '))) {
                    return refuseAt(j, 'a task item whose text does not follow its checkbox')
                }
                /** @type {readonly string[]} */
                let body = [first]
                j += 1
                while (j < lines.length && sameList(lines[j]) === null) {
                    const l = lines[j]
                    if (l.slice(0, l.length - l.trimStart().length).includes('\t')) { return refuseAt(j, 'a tab in an indent') }
                    if (l.trim() === '') {
                        // A blank line stays in the item when an indented
                        // line follows it, and ends the list otherwise.
                        let k = j
                        while (k < lines.length && lines[k].trim() === '') { k += 1 }
                        if (k === lines.length || !lines[k].startsWith(indent)) { break }
                        body = [...body, ...lines.slice(j, k).map(() => '')]
                        j = k
                        continue
                    }
                    if (!l.startsWith(indent)) {
                        return refuseAt(j, 'a line that GitHub reads as part of the list item above it')
                    }
                    body = [...body, l.slice(width)]
                    j += 1
                }
                const read = readBlocks(base + start, 'a list item')(body)
                if (read[0] === 'error') { return read }
                const placed = read[1]
                // The checkbox sits in the item's first paragraph on GitHub;
                // a fence or a table after it would be text there.
                if (checked !== null && placed[0][0][0] !== 'paragraph') {
                    return refuseAt(start, 'a task item whose text is not a paragraph')
                }
                // A blank line between two blocks of one item loosens it.
                loose = loose || placed.some((p, k) => k !== 0 && p[1] > placed[k - 1][2] + 1)
                /** @type {Blocks} */
                const task = checked === null ? [] : [['task', checked]]
                items = [...items, [...task, ...placed.map(p => p[0])]]
                let k = j
                while (k < lines.length && lines[k].trim() === '') { k += 1 }
                more = k < lines.length && sameList(lines[k]) !== null
                // So does one between two items.
                loose = loose || (more && k !== j)
                j = more ? k : start + body.length
            }
            /** @type {Block} */
            const list = marker.start === null ? ['list', loose, items] : ['olist', marker.start, loose, items]
            out = [...out, [list, i, j - 1]]
            i = j
            continue
        }
        const aligns = tableAligns(line, lines[i + 1])
        if (aligns !== null) {
            let end = i + 2
            while (end < lines.length && lines[end].trim() !== '') { end += 1 }
            const rows = lines.slice(i, end)
            /** @type {(readonly Entry[])[]} */
            let read = []
            for (const [r, row] of rows.entries()) {
                if (r === 1) { continue }
                // A backslash before an escaped pipe leaves which of the
                // two the escape is to GitHub's reading of backslashes.
                if (row.includes('\\\\|')) { return refuseAt(i + r, 'a backslash before an escaped pipe in a table') }
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
            && headingLevel(lines[end]) === 0 && !isFence(lines[end]) && !lines[end].startsWith('- ')
            // A quote ends a paragraph, as GitHub reads it.
            && !lines[end].startsWith('>')) {
            const continued = foreignBlock(lines[end].trimStart())
            if (continued !== null) { return refuseAt(end, continued) }
            end += 1
        }
        // A line ending becomes one space even inside code; surrounding
        // spaces are content there, so trimming each line would change it.
        const spans = inlineAt(at, lines.slice(i, end).join(' '))
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
 * each holding blocks of its own indented by two spaces and opening with a
 * GitHub task checkbox or not, a table whose rows open with a pipe, and a
 * block quote, its lines opening with `>`, holding blocks of its own.
 *
 * **What GitHub reads differently is refused, not approximated.** A line
 * after a list item with no blank before it and no indentation continues
 * GitHub's item lazily; a heading closed by `#`s loses them there. Each
 * would be a different page here, so each is the refusal that keeps the
 * README a link to GitHub instead. So is a line right after a quote with no
 * `>` and no blank before it, which GitHub may read as the quote's.
 *
 * @type {(text: string) => Result<Blocks, string>}
 */
export const tryParseBlocks = text => {
    const read = readBlocks(0, null)(text.split('\n').map(line => line.endsWith('\r') ? line.slice(0, -1) : line))
    return read[0] === 'error' ? read : ok(read[1].map(p => p[0]))
}
