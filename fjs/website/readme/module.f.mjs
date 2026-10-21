/**
 * A directory's `README.md` as the top of its page
 * ([render-readme](../todo/render-readme.md)).
 *
 * **Rendered at build time, not in the browser.** A README is prose rather
 * than source, and written into the page it reaches a reader without
 * JavaScript and a search engine without running one — the page carries its
 * text the way it carries its demo's first view.
 *
 * **A README the reader refuses keeps its page, and the page says why.** The
 * refusal is the block reader's
 * ([`media/markdown`](../../media/markdown/module.f.mjs)'s `tryParseBlocks`):
 * one line GitHub reads as something these blocks cannot hold. A rendering
 * that differs from GitHub's is the plausible wrong value
 * [DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
 * refuses, so the README stays the file link to GitHub it was, with the
 * reason beside it.
 *
 * @module
 *
 * @import { Block, Blocks, Inline, Label } from '../../media/markdown/types.ts'
 * @import { Element, Node } from '../../media/html/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { charIs, isDigit, isLatinLetter } from '../../text/ascii/module.f.js'
import { basename, concat as pathConcat, escapes, normalize, parent } from '../../path/module.f.mjs'
import { error, ok } from '../../types/result/module.f.js'
import { fileHref, pageHref } from '../page/module.f.mjs'

/** The file a directory documents itself in. @type {string} */
export const readmeName = 'README.md'

/**
 * The schemes a README's absolute link may carry. Any other — `javascript:`
 * above all, which would run in the site's origin when clicked — is
 * refused rather than written into the page.
 */
const schemes = ['https:', 'http:', 'mailto:']

/**
 * Where a README's link goes, from the directory the README is in.
 *
 * - An absolute `https`, `http` or `mailto` link, and a `#fragment` of the
 *   README itself, stay as written; a query and a fragment stay on the
 *   address they follow.
 * - A link to a directory with a page of its own opens that page, and so
 *   does a link to that directory's `README.md`: the page is where it is
 *   rendered.
 * - Any other file opens where the same file's catalogue link opens it,
 *   through `fileHref` — one rule, so a file never opens in two places
 *   depending on which page linked it.
 *
 * A link that leaves the repository has nowhere to go here and on GitHub
 * alike, and is refused rather than written as a dead link.
 *
 * @type {(commit: string | null) => (isPage: (path: string) => boolean) => (dir: string) => (href: string) => Result<string, string>}
 */
export const resolveHref = commit => isPage => dir => href => {
    const colon = href.indexOf(':')
    const slash = href.indexOf('/')
    if (href.startsWith('#')) { return ok(href) }
    // A network-path reference is absolute on GitHub, with no scheme to check.
    if (href.startsWith('//')) { return error(`a link with no scheme: ${href}`) }
    if (colon > 0 && (slash === -1 || colon < slash)) {
        const scheme = href.slice(0, colon + 1).toLowerCase()
        return schemes.includes(scheme) ? ok(href) : error(`a link with a scheme a page does not open: ${scheme}`)
    }
    const end = [href.indexOf('?'), href.indexOf('#')].filter(i => i !== -1)
    const cut = end.length === 0 ? href.length : Math.min(...end)
    const path = href.slice(0, cut)
    const fragment = href.slice(cut)
    // A percent escape names one file on GitHub and another once the path
    // is encoded again for the page.
    if (path.includes('%')) { return error(`a link with a percent escape: ${href}`) }
    const joined = path.startsWith('/') ? path.slice(1) : pathConcat(dir)(path)
    if (escapes(joined)) { return error(`a link that leaves the repository: ${href}`) }
    const target = normalize(joined)
    if (isPage(target)) { return ok(`${pageHref(target)}${fragment}`) }
    const owner = parent(target)
    if (basename(target) === readmeName && isPage(owner)) { return ok(`${pageHref(owner)}${fragment}`) }
    return ok(`${fileHref(commit)('.')(target)}${fragment}`)
}

/** A span's words, as a heading's anchor is made of them. @type {(span: Inline | Label) => string} */
const words = span => span[0] === 'link' ? span[1].map(words).join('') : span[1]

/**
/**
 * What GitHub's anchor does with a character outside ASCII: keeps a letter
 * of any script, and drops punctuation and symbols. A cased letter and the
 * Han, kana and Hangul blocks are letters; Latin-1's punctuation and its
 * `×` and `÷`, General Punctuation to
 * Miscellaneous Symbols and Arrows, CJK symbols and punctuation, fullwidth
 * punctuation and the emoji planes are dropped. Anything else is `unknown`:
 * telling an Arabic comma from an Arabic letter takes the Unicode tables
 * GitHub's slugger reads, so such a heading is refused rather than given an
 * anchor that may differ.
 *
 * @type {(c: string) => 'keep' | 'drop' | 'unknown'}
 */
const anchorChar = c => {
    const code = /** @type {number} */(c.codePointAt(0))
    const within = /** @type {(from: number, to: number) => boolean} */((from, to) => code >= from && code <= to)
    if (within(0xa0, 0xbf) || code === 0xd7 || code === 0xf7 || within(0x2000, 0x2bff) || within(0x3000, 0x303f) || within(0xff00, 0xff0f) || code >= 0x1f000) { return 'drop' }
    if (c.toLowerCase() !== c.toUpperCase()
        || within(0x3040, 0x30ff) || within(0x3400, 0x4dbf) || within(0x4e00, 0x9fff) || within(0xac00, 0xd7a3)) {
        return 'keep'
    }
    return 'unknown'
}

/**
 * The first character of a heading whose anchor this cannot make as GitHub
 * does, or `undefined`.
 *
 * @type {(spans: readonly Inline[]) => string | undefined}
 */
const unknownAnchorChar = spans => [...spans.map(words).join('')]
    .find(c => /** @type {number} */(c.codePointAt(0)) > 0x7f && anchorChar(c) === 'unknown')

/**
 * A heading's anchor as GitHub makes it: its words lowercased, spaces as
 * `-`, and every character but a letter, a digit, `-` and `_` dropped. So a
 * `#fragment` written against the README on GitHub finds the same heading
 * here, `# 中文` included.
 *
 * @type {(spans: readonly Inline[]) => string}
 */
export const slug = spans => [...spans.map(words).join('').toLowerCase()]
    .flatMap(c => c === ' ' ? ['-']
        : c === '-' || c === '_' || charIs(isDigit)(c) || charIs(isLatinLetter)(c)
            || (/** @type {number} */(c.codePointAt(0)) > 0x7f && anchorChar(c) === 'keep') ? [c]
        : [])
    .join('')

/**
 * Every heading's anchor, in order. A repeated one gets the first of `-1`,
 * `-2` and so on that no heading before it has, as GitHub numbers them.
 *
 * @type {(blocks: Blocks) => readonly string[]}
 */
export const anchors = blocks => {
    /** @type {readonly string[]} */
    let used = []
    for (const block of blocks) {
        if (block[0] !== 'heading') { continue }
        const id = slug(block[2])
        let n = 0
        // A suffixed anchor another heading already has is skipped, as
        // GitHub's slugger skips it: `A`, `A-1`, `A` are `a`, `a-1`, `a-2`.
        while (used.includes(n === 0 ? id : `${id}-${n}`)) { n++ }
        used = [...used, n === 0 ? id : `${id}-${n}`]
    }
    return used
}

/**
 * A README as the elements of its page, or the first link it cannot place.
 *
 * **A heading is one level below the README's own.** The page's `h1` is its
 * breadcrumb, and its sections are `h2`, so the README's title is an `h2`
 * beside them and its sections `h3`; an `h6` stays an `h6`.
 *
 * @type {(href: (href: string) => Result<string, string>) => (blocks: Blocks) => Result<readonly Element[], string>}
 */
export const readmeNodes = href => blocks => {
    for (const block of blocks) {
        const c = block[0] === 'heading' ? unknownAnchorChar(block[2]) : undefined
        if (c !== undefined) { return error(`a heading character whose anchor GitHub may make otherwise: ${c}`) }
    }
    const ids = anchors(blocks)
    /** @type {readonly Element[]} */
    let out = []
    let heading = 0
    /** @type {(span: Inline | Label) => Result<Node, string>} */
    const node = span => {
        const kind = span[0]
        if (kind === 'code') { return ok(['code', span[1]]) }
        if (kind === 'strong') { return ok(['strong', span[1]]) }
        if (kind === 'em') { return ok(['em', span[1]]) }
        if (kind === 'link') {
            const target = href(span[2])
            if (target[0] === 'error') { return target }
            return ok(['a', { href: target[1] }, ...span[1].map(l => /** @type {Node} */(l[0] === 'code' ? ['code', l[1]] : l[1]))])
        }
        return ok(span[1])
    }
    /** @type {(spans: readonly Inline[]) => Result<readonly Node[], string>} */
    const nodes = spans => {
        /** @type {readonly Node[]} */
        let read = []
        for (const span of spans) {
            const n = node(span)
            if (n[0] === 'error') { return n }
            read = [...read, n[1]]
        }
        return ok(read)
    }
    for (const block of blocks) {
        /** @type {Block} */
        const b = block
        if (b[0] === 'code') {
            /** @type {Element} */
            const code = b[1] === '' ? ['code', b[2]] : ['code', { class: `language-${b[1]}` }, b[2]]
            out = [...out, ['pre', code]]
            continue
        }
        if (b[0] === 'list') {
            /** @type {readonly Element[]} */
            let items = []
            for (const entry of b[1]) {
                const n = nodes(entry)
                if (n[0] === 'error') { return n }
                items = [...items, ['li', ...n[1]]]
            }
            out = [...out, ['ul', ...items]]
            continue
        }
        const n = nodes(b[0] === 'heading' ? b[2] : b[1])
        if (n[0] === 'error') { return n }
        if (b[0] === 'heading') {
            out = [...out, [`h${Math.min(b[1] + 1, 6)}`, { id: ids[heading] }, ...n[1]]]
            heading++
            continue
        }
        out = [...out, ['p', ...n[1]]]
    }
    return ok(out)
}

/**
 * A README's place on its page: its rendering, or the note that it is not
 * rendered here and why, linking the file on GitHub.
 *
 * @type {(file: string) => (readme: Result<readonly Element[], string>) => readonly Element[]}
 */
export const readmeSection = file => readme => readme[0] === 'ok'
    ? [['article', { 'data-readme': '' }, ...readme[1]]]
    : [['p', { 'data-readme-refused': '' },
        ['a', { href: file }, readmeName], ` is not rendered here: ${readme[1]}.`]]
