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
 * @import { Entry, Inline } from '../../media/markdown/types.ts'
 */

import { repository } from '../page/module.f.mjs'

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
    return word.length >= shaMin && [...word].every(isHex)
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
export const descending = versions => [...versions].sort((x, y) => {
    const [p, q] = [numbers(x), numbers(y)]
    const n = Math.max(p.length, q.length)
    for (let i = 0; i < n; i++) {
        const d = (q[i] ?? 0) - (p[i] ?? 0)
        if (d !== 0) { return d }
    }
    return 0
})
