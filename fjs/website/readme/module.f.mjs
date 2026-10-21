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
 * @import { Align, Block, Blocks, Inline, Label } from '../../media/markdown/types.ts'
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
    const joined = path.startsWith('/') ? path.slice(1) : pathConcat(dir)(path)
    if (escapes(joined)) { return error(`a link that leaves the repository: ${href}`) }
    const target = normalize(joined)
    if (isPage(target)) { return ok(`${pageHref(target)}${fragment}`) }
    const owner = parent(target)
    if (basename(target) === readmeName && isPage(owner)) { return ok(`${pageHref(owner)}${fragment}`) }
    return ok(`${fileHref(commit)('.')(target)}${fragment}`)
}

/** A span's words, as a heading's anchor is made of them. @type {(span: Inline | Label) => string} */
const words = span => span[0] === 'link' || span[0] === 'strong' || span[0] === 'em'
    ? span[1].map(words).join('')
    : span[1]

/**
/**
 * Whether a character outside ASCII stays in an anchor: a letter, a mark or
 * a digit of any script, cased or not. GitHub drops punctuation and symbols,
 * which outside ASCII are the blocks from General Punctuation to
 * Miscellaneous Symbols and Arrows, the CJK symbols and punctuation, the
 * fullwidth forms' punctuation, and the emoji planes; everything else is a
 * script's own character.
 *
 * @type {(c: string) => boolean}
 */
const keptBeyondAscii = c => {
    const code = /** @type {number} */(c.codePointAt(0))
    return code > 0x7f
        && !(code >= 0x2000 && code <= 0x2bff)
        && !(code >= 0x3000 && code <= 0x303f)
        && !(code >= 0xff00 && code <= 0xff0f)
        && code < 0x1f000
}

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
        : c === '-' || c === '_' || charIs(isDigit)(c) || charIs(isLatinLetter)(c) || keptBeyondAscii(c) ? [c]
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

/** A label's span as a node: code, or its text. @type {(label: Label) => Node} */
const labelNode = label => label[0] === 'code' ? ['code', label[1]] : label[1]

/**
 * A README as the elements of its page, or the first link it cannot place.
 *
 * **A heading is one level below the README's own.** The page's `h1` is its
 * breadcrumb, and its sections are `h2`, so the README's title is an `h2`
 * beside them and its sections `h3`; an `h6` stays an `h6`.
 *
 * **A list item is its blocks**, and in a tight list a paragraph is its bare
 * text, as GitHub writes it: `<li>text</li>` where a loose list has
 * `<li><p>text</p></li>`. A table column's alignment is its cells' `align`.
 *
 * @type {(href: (href: string) => Result<string, string>) => (blocks: Blocks) => Result<readonly Element[], string>}
 */
export const readmeNodes = href => blocks => {
    const ids = anchors(blocks)
    /** @type {(span: Inline) => Result<Node, string>} */
    const node = span => {
        const kind = span[0]
        if (kind === 'code') { return ok(['code', span[1]]) }
        if (kind === 'strong') { return ok(['strong', ...span[1].map(labelNode)]) }
        if (kind === 'em') { return ok(['em', ...span[1].map(labelNode)]) }
        if (kind === 'link') {
            const target = href(span[2])
            if (target[0] === 'error') { return target }
            return ok(['a', { href: target[1] }, ...span[1].map(labelNode)])
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
    /** @type {(cell: 'th' | 'td', aligns: readonly Align[]) => (row: readonly (readonly Inline[])[]) => Result<Element, string>} */
    const row = (cell, aligns) => cellsOf => {
        /** @type {readonly Element[]} */
        let read = []
        for (const [k, spans] of cellsOf.entries()) {
            const n = nodes(spans)
            if (n[0] === 'error') { return n }
            const align = aligns[k]
            read = [...read, align === null ? [cell, ...n[1]] : [cell, { align }, ...n[1]]]
        }
        return ok(['tr', ...read])
    }
    /** @type {(tight: boolean) => (blocks: Blocks) => Result<readonly Node[], string>} */
    const blockNodes = tight => blocks => {
        /** @type {readonly Node[]} */
        let out = []
        let heading = 0
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
                for (const item of b[2]) {
                    const n = blockNodes(!b[1])(item)
                    if (n[0] === 'error') { return n }
                    items = [...items, ['li', ...n[1]]]
                }
                out = [...out, ['ul', ...items]]
                continue
            }
            if (b[0] === 'table') {
                const head = row('th', b[1])(b[2])
                if (head[0] === 'error') { return head }
                /** @type {readonly Element[]} */
                let body = []
                for (const cellsOf of b[3]) {
                    const r = row('td', b[1])(cellsOf)
                    if (r[0] === 'error') { return r }
                    body = [...body, r[1]]
                }
                out = [...out, ['table', ['thead', head[1]], ...(body.length === 0 ? [] : [/** @type {Element} */(['tbody', ...body])])]]
                continue
            }
            const n = nodes(b[0] === 'heading' ? b[2] : b[1])
            if (n[0] === 'error') { return n }
            if (b[0] === 'heading') {
                out = [...out, [`h${Math.min(b[1] + 1, 6)}`, { id: ids[heading] }, ...n[1]]]
                heading++
                continue
            }
            out = tight ? [...out, ...n[1]] : [...out, ['p', ...n[1]]]
        }
        return ok(out)
    }
    // A README's own blocks are never a tight list's, so each is an element.
    return /** @type {Result<readonly Element[], string>} */(blockNodes(false)(blocks))
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
