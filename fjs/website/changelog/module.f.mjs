/**
 * The changelog as the website shows it: a reference turned into the link it
 * names, and releases in the order they shipped.
 *
 * The entries themselves are read by [`media/markdown`](../../media/markdown/module.f.mjs),
 * which leaves a reference inside a `text` span on purpose — deriving its
 * link needs a repository, which a parser has no business knowing, and
 * leaving it as text is what lets that grammar avoid telling `(#1807)` from
 * parenthesised prose. This module is where the repository is known.
 *
 * **A reference is derived, not written.** `changelog/README.md` says an
 * entry "ends with the numbers it came from in parentheses — `(#1807,
 * #1813, #1825, #1831)` — and the renderer derives each link". Both styles
 * it allows are recognised here: a pull request number, and a short commit
 * SHA for a change whose commit carried no number, which the same
 * parentheses may mix.
 *
 * **The parentheses stay text.** Only the reference inside them becomes a
 * link, so an entry reads as it was written rather than acquiring brackets
 * the author did not type.
 *
 * @module
 *
 * @import { Document, Entry, Inline } from '../../media/markdown/types.ts'
 * @import { Element, Node } from '../../media/html/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 */

import { htmlUtf8 } from '../../media/html/module.f.mjs'
import { repository } from '../page/module.f.mjs'
import { faviconLinks, stylesheetLink } from '../style/module.f.mjs'

const zero = 0x30
const nine = 0x39
const a = 0x61
const f = 0x66

/** @type {(c: string) => boolean} */
const isDigit = c => { const u = c.charCodeAt(0); return u >= zero && u <= nine }

/** A short commit SHA is lower-case hex, as `git log --format=%h` prints it. @type {(c: string) => boolean} */
const isHex = c => { const u = c.charCodeAt(0); return isDigit(c) || (u >= a && u <= f) }

/**
 * The shortest SHA the repository's own entries carry. Shorter than this and
 * a hex word is more likely to be prose — `cafe` is a word, `deadbee` is
 * not — so the run has to be at least this long to read as a reference.
 */
const shaMin = 7

/**
 * One reference's text and where it points, or `null` where the run is
 * neither form.
 *
 * A `#` and digits is a pull request. A run of hex of at least
 * {@link shaMin} is a commit: `changelog/README.md` says an entry whose
 * commit carried no number cites the commit instead, "by short SHA in the
 * same parentheses". **No entry in the tree uses that form** — the README
 * cites `0.41.0`, whose two entries both end in ordinary links — so it is
 * supported against the documented format rather than against data, and a
 * release author who uses it gets a link rather than a bare word.
 *
 * @type {(word: string) => Inline | null}
 */
export const _reference = word => {
    if (word.length === 0) { return null }
    if (word[0] === '#') {
        const digits = word.slice(1)
        return digits.length !== 0 && [...digits].every(isDigit)
            ? ['link', word, `${repository}/pull/${digits}`]
            : null
    }
    // **A run of hex is a SHA only if it is neither a number nor a word.**
    // Every digit is hex, so a plain decimal — `(4294967295)` in a note about
    // integer limits — would otherwise link to a commit that does not exist,
    // and so would `(defaced)`. A 404 a reader cannot tell from a real link
    // is worse than a reference left as the text it is, so a SHA must carry
    // both a letter and a digit. A real short SHA of one or the other is
    // possible and rare, and loses a link rather than gaining a wrong one.
    const chars = [...word]
    return word.length >= shaMin && chars.every(isHex)
        && chars.some(isDigit) && chars.some(c => !isDigit(c))
        ? ['link', word, `${repository}/commit/${word}`]
        : null
}

/**
 * The references in one parenthesised group, or `null` where any word in it
 * is not one — in which case the group is ordinary prose and nothing in it
 * is touched.
 *
 * Separated by `", "`, which is how every group in the tree is written and
 * what the format's own example shows. A group whose separator differs
 * fails here rather than being guessed at.
 *
 * @type {(inner: string) => readonly Inline[] | null}
 */
export const _group = inner => {
    const words = inner.split(', ')
    const out = words.map(_reference)
    if (out.some(x => x === null)) { return null }
    return /** @type {readonly Inline[]} */(out).flatMap(
        (link, i) => i === 0 ? [link] : [/** @type {Inline} */(['text', ', ']), link])
}

/**
 * One `text` span with every reference group in it turned into links, the
 * parentheses left as the text they are.
 *
 * Scanned rather than matched: a regular expression is not FunctionalScript,
 * and the shape is small enough that the scan says what it looks for.
 *
 * @type {(text: string) => readonly Inline[]}
 */
export const _linked = text => {
    const open = text.indexOf('(')
    if (open === -1) { return [['text', text]] }
    const close = text.indexOf(')', open)
    if (close === -1) { return [['text', text]] }
    const group = _group(text.slice(open + 1, close))
    const head = text.slice(0, open + 1)
    return group === null
        // Not a reference: the parenthesis is prose. The scan resumes just
        // after it rather than after the closing one, so the words between
        // them are kept and a later group among them is still found.
        ? _merged([['text', head], ..._linked(text.slice(open + 1))])
        : _merged([['text', head], ...group, ..._linked(text.slice(close))])
}

/**
 * Adjacent `text` spans folded into one.
 *
 * The parser never answers two in a row — its rules alternate a run of text
 * with a span — and a scan that walks past a prose parenthesis would
 * otherwise break that, handing a consumer a difference with no meaning
 * behind it.
 *
 * @type {(spans: readonly Inline[]) => readonly Inline[]}
 */
export const _merged = spans => spans.reduce(
    (acc, span) => {
        const last = acc[acc.length - 1]
        return span[0] === 'text' && last !== undefined && last[0] === 'text'
            ? [...acc.slice(0, -1), /** @type {Inline} */(['text', `${last[1]}${span[1]}`])]
            : [...acc, span]
    },
    /** @type {readonly Inline[]} */([]))

/**
 * One entry with its references linked. Only `text` spans are scanned: a
 * parenthesis inside code is code, and a link is already one.
 *
 * @type {(entry: Entry) => Entry}
 */
export const linked = entry => _merged(entry.flatMap(
    span => span[0] === 'text' ? _linked(span[1]) : [span]))

/**
 * Whether a name is a version: three numbers separated by dots, which is
 * what Semantic Versioning defines and what every released file in the tree
 * is named.
 *
 * **A leading digit is not enough.** `0.51.O.md` — a letter for the last
 * zero — begins with one, and accepting it publishes a release whose last
 * number is `NaN`, which orders against every other version as neither
 * before nor after. A typo would become a page rather than a refusal, which
 * is the plausible wrong value `DESIGN.md` §10 rules out.
 *
 * @type {(name: string) => boolean}
 */
export const isVersion = name => {
    const parts = name.split('.')
    return parts.length === 3
        && parts.every(part => part.length !== 0 && [...part].every(isDigit))
}

/**
 * A version as its numbers, for ordering.
 *
 * **Releases do not sort by their names.** `0.11.10` precedes `0.11.2` as
 * text and follows it as a version, and `0.1.608` lands nowhere sensible
 * among the `0.10.x` files at all. Every index that lists them has to
 * compare the numbers.
 *
 * @type {(version: string) => readonly number[]}
 */
export const numbers = version => version.split('.').map(Number)

/**
 * Newest first, which is the order a reader wants a release list in.
 *
 * @type {(versions: readonly string[]) => readonly string[]}
 */
export const descending = versions => versions.toSorted((x, y) => {
    const [p, q] = [numbers(x), numbers(y)]
    const n = Math.max(p.length, q.length)
    for (let i = 0; i < n; i++) {
        const d = (q[i] ?? 0) - (p[i] ?? 0)
        if (d !== 0) { return d }
    }
    return 0
})

/**
 * One span as the element it denotes. `text` is a string rather than an
 * element: a span of prose has no tag of its own, and wrapping it in one
 * would put a `span` around two thirds of every entry.
 *
 * @type {(span: Inline) => Node}
 */
export const spanNode = span => {
    const kind = span[0]
    if (kind === 'code') { return ['code', span[1]] }
    if (kind === 'strong') { return ['strong', span[1]] }
    if (kind === 'em') { return ['em', span[1]] }
    if (kind === 'link') { return ['a', { href: span[2] }, span[1]] }
    return span[1]
}

/**
 * One entry as a list item, its references linked.
 *
 * @type {(entry: Entry) => Element}
 */
export const entryNode = entry => ['li', ...linked(entry).map(spanNode)]

/**
 * A release's page path, and the URL that reaches it.
 *
 * **Underscore-prefixed, because that is what a generated file is called
 * here.** `.gitignore` keeps `index.html` and the `_`-prefixed files out of
 * the tree, and those are the only two names a generator may write — the
 * site serves the repository folder itself, so anything else it emitted
 * would be an untracked file a contributor has to notice. A release is not a
 * directory and cannot take the `index.html` name, so it takes the other
 * one, as `_main.css` does.
 *
 * @type {(version: string) => string}
 */
export const releasePath = version => `changelog/_${version}.html`

/** @type {(version: string) => string} */
export const releaseHref = version => `/${releasePath(version)}`

/** The breadcrumb every changelog page carries. @type {(tail: readonly Node[]) => Element} */
const nav = tail => ['nav',
    ['a', { href: '/index.html' }, 'root'],
    ' / ',
    ['a', { href: '/changelog/index.html' }, 'changelog'],
    ...tail,
]

/**
 * One release's page: its entries, in the order the file writes them, which
 * `changelog/README.md` fixes as order of importance rather than of merge.
 *
 * An empty file is a release that shipped no notable change — the README
 * says so — and says that rather than showing an empty list, which would
 * read as a page that failed to load.
 *
 * @type {(version: string) => (document: Document) => Vec}
 */
export const releasePage = version => document => htmlUtf8(
    ['title', `FunctionalScript ${version}`],
    stylesheetLink,
    ...faviconLinks,
)(
    ['main',
        nav([' / ', version]),
        ['h1', version],
        ...(document.length === 0
            ? [/** @type {Element} */(['p', 'This release shipped no notable change.'])]
            : [/** @type {Element} */(['ul', ...document.map(entryNode)])]),
    ],
)

/**
 * The release index: every release, newest first.
 *
 * It is the `changelog/` directory's own page, replacing the file listing a
 * directory would otherwise get. A reader who opens the changelog wants the
 * releases, not the file names they are stored under, and the files are one
 * click away on GitHub where every other file of the repository is.
 *
 * @type {(versions: readonly string[]) => Vec}
 */
export const indexPage = versions => htmlUtf8(
    ['title', 'FunctionalScript releases'],
    stylesheetLink,
    ...faviconLinks,
)(
    ['main',
        nav([]),
        ['h1', 'Releases'],
        ['ul', ...descending(versions).map(version =>
            /** @type {Element} */(['li', ['a', { href: releaseHref(version) }, version]]))],
    ],
)
