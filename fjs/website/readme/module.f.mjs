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
 * **A Mermaid flowchart is drawn, as on GitHub,** by the site's own graph
 * renderer ([`mermaid`](../mermaid/module.f.mjs)). A `mermaid` fence it
 * cannot draw stays its source, as every fence did before: the author's
 * own text, not a wrong picture.
 *
 * **A code fence copies, as on GitHub.** It is the demos' code block
 * ([`demo/code`](../demo/code/module.f.js)): its button copies the fence's
 * text, and the page shows the button once its runtime can copy.
 *
 * **A code fence in a language the site can read is coloured.** Its text
 * goes through the tokenizer the demos colour a typed example with
 * ([`js/marked`](../../js/marked/module.f.mjs), drawn by
 * [`demo/highlight`](../demo/highlight/module.f.mjs)), and a TypeScript
 * fence through the same tokenizer with TypeScript's own keywords, so the
 * colours are the demos' and the text is the fence's, character for
 * character. A fence in any other language, or one the tokenizer refuses,
 * stays plain: no colour is honest where a guessed one is not.
 *
 * @module
 *
 * @import { Align, Block, Blocks, Image, Inline, Label } from '../../media/markdown/types.ts'
 * @import { Element, Node } from '../../media/html/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { StringMap } from '../../types/object/types.ts'
 */

import { charIs, isDigit, isLatinLetter } from '../../text/ascii/module.f.js'
import { basename, concat as pathConcat, escapes, normalize, parent } from '../../path/module.f.js'
import { error, ok } from '../../types/result/module.f.js'
import { linkedHeading, reservedIds } from '../permalink/module.f.js'
import { fileHref, pageHref } from '../page/module.f.mjs'
import { highlight, tsHighlight } from '../demo/highlight/module.f.mjs'
import { flowchartSvg } from '../mermaid/module.f.mjs'
import { codeBlock } from '../demo/code/module.f.js'
import { at } from '../../types/object/module.f.mjs'

const { length: reservedIdCount } = reservedIds

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
    const normal = normalize(joined)
    // The repository's root is the page `.`, not an empty path.
    const target = normal === '' ? '.' : normal
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
 * What GitHub's anchor does with a character outside ASCII: keeps a letter
 * of any script, and drops punctuation and symbols. A cased letter and the
 * Han (with its supplementary planes), kana and Hangul blocks are letters;
 * Latin-1's punctuation and its `×` and `÷`, General Punctuation to
 * Miscellaneous Symbols and Arrows, CJK symbols and punctuation, fullwidth
 * punctuation, the kana block's punctuation and the emoji blocks are
 * dropped. Anything else is `unknown`:
 * telling an Arabic comma from an Arabic letter takes the Unicode tables
 * GitHub's slugger reads, so such a heading is refused rather than given an
 * anchor that may differ.
 *
 * @type {(c: string) => 'keep' | 'drop' | 'unknown'}
 */
const anchorChar = c => {
    const code = /** @type {number} */(c.codePointAt(0))
    const within = /** @type {(from: number, to: number) => boolean} */((from, to) => code >= from && code <= to)
    // Latin-1's ordinal indicators and micro sign are letters amid symbols.
    if (code === 0xaa || code === 0xb5 || code === 0xba) { return 'keep' }
    // Letterlike Symbols mixes letters with symbols; refuse rather than
    // drop letters such as ℂ. See todo/unicode-anchors.md.
    if (within(0x2100, 0x214f)) { return 'unknown' }
    if (within(0xa0, 0xbf) || code === 0xd7 || code === 0xf7 || within(0x2000, 0x2bff) || within(0x3000, 0x303f) || within(0xff00, 0xff0f) || within(0x1f000, 0x1faff)
        // Kana's sound marks, double hyphen and middle dot.
        || code === 0x309b || code === 0x309c || code === 0x30a0 || code === 0x30fb) { return 'drop' }
    if (c.toLowerCase() !== c.toUpperCase()
        || within(0x3040, 0x30ff) || within(0x3400, 0x4dbf) || within(0x4e00, 0x9fff) || within(0xac00, 0xd7a3) || within(0x20000, 0x323af)) {
        return 'keep'
    }
    return 'unknown'
}

/**
 * A heading's words, lowercased, one character at a time: what its anchor
 * is made of, and so what is asked about it. `İ` lowercases to `i` and a
 * combining dot.
 *
 * @type {(spans: readonly Inline[]) => readonly string[]}
 */
const anchorSource = spans => [...spans.map(words).join('').toLowerCase()]

/**
 * {@link anchorChar} of a character outside ASCII, or `undefined` for one
 * in it, whose fate the anchor's own rule decides.
 *
 * @type {(c: string) => 'keep' | 'drop' | 'unknown' | undefined}
 */
const nonAsciiAnchorChar = c => /** @type {number} */(c.codePointAt(0)) > 0x7f ? anchorChar(c) : undefined

/**
 * The first character of a heading whose anchor this cannot make as GitHub
 * does, or `undefined`.
 *
 * @type {(spans: readonly Inline[]) => string | undefined}
 */
const unknownAnchorChar = spans => anchorSource(spans).find(c => nonAsciiAnchorChar(c) === 'unknown')

/**
 * A heading's anchor as GitHub makes it: its words lowercased, spaces as
 * `-`, and every character but a letter, a digit, `-` and `_` dropped. So a
 * `#fragment` written against the README on GitHub finds the same heading
 * here, `# 中文` included.
 *
 * @type {(spans: readonly Inline[]) => string}
 */
export const slug = spans => anchorSource(spans)
    .flatMap(c => c === ' ' ? ['-']
        : c === '-' || c === '_' || charIs(isDigit)(c) || charIs(isLatinLetter)(c)
            || nonAsciiAnchorChar(c) === 'keep' ? [c]
        : [])
    .join('')

/**
 * Every heading's anchor, in order. A repeated one gets the first of `-1`,
 * `-2` and so on that no heading before it has, as GitHub numbers them.
 * Page-section and drawer IDs are reserved;
 * an empty slug starts at `section`. All other heading anchors stay unchanged.
 *
 * @type {(blocks: Blocks) => readonly string[]}
 */
export const anchors = blocks => {
    /** @type {readonly string[]} */
    let used = reservedIds
    for (const block of blocks) {
        if (block[0] !== 'heading') { continue }
        const id = slug(block[2]) || 'section'
        let n = 0
        // A suffixed anchor another heading already has is skipped, as
        // GitHub's slugger skips it: `A`, `A-1`, `A` are `a`, `a-1`, `a-2`.
        while (used.includes(n === 0 ? id : `${id}-${n}`)) { n += 1 }
        used = [...used, n === 0 ? id : `${id}-${n}`]
    }
    return used.slice(reservedIdCount)
}

/**
 * How a fence is coloured, by the name GitHub reads its language under:
 * JavaScript and JSON by the JavaScript tokenizer, TypeScript by the same
 * tokenizer with TypeScript's own keywords. GitHub matches the name in any
 * case.
 *
 * @type {StringMap<(text: string) => readonly Node[]>}
 */
const highlighters = {
    js: highlight, javascript: highlight, json: highlight, jsonc: highlight,
    ts: tsHighlight, typescript: tsHighlight,
}

/**
 * A code fence's text as the nodes of its `code` element: coloured when
 * its language has one of the {@link highlighters}, its bare text
 * otherwise.
 *
 * @type {(language: string) => (text: string) => readonly Node[]}
 */
const fenceNodes = language => text => {
    const colour = at(language.toLowerCase())(highlighters)
    return colour === null ? [text] : colour(text)
}

/** A label's span as a node: code, or its text. @type {(label: Label) => Node} */
const labelNode = label => label[0] === 'code' ? ['code', label[1]] : label[1]

/**
 * An image as its element, or why it is not drawn. Its source must be an
 * `https` address, which a page loads as it is: GitHub serves a relative
 * source from the repository and an `http` one through its own proxy, and
 * this page can do neither, so either would be an image GitHub shows and
 * this page breaks.
 *
 * @type {(image: Image) => Result<Element, string>}
 */
const imageNode = ([, alt, src]) => src.toLowerCase().startsWith('https://')
    ? ok(['img', { src, alt }])
    : error(`an image whose source is not an https address: ${src}`)

/** Whether a heading shows an image. @type {(spans: readonly Inline[]) => boolean} */
const hasImage = spans => spans.some(span => span[0] === 'image' || (span[0] === 'link' && span[1].some(l => l[0] === 'image')))

/**
 * A README as the elements of its page, or the first link it cannot place.
 *
 * **A heading is one level below the README's own.** The page's `h1` is its
 * breadcrumb, and its sections are `h2`, so the README's title is an `h2`
 * beside them and its sections `h3`; an `h6` stays an `h6`.
 *
 * **A list item is its blocks**, in a `ul`, or an `ol` for a numbered
 * list, and in a tight list a paragraph is its bare
 * text, as GitHub writes it: `<li>text</li>` where a loose list has
 * `<li><p>text</p></li>`. A task item's checkbox is a disabled `input`
 * opening its first paragraph, and its `li` is a `task-list-item`, as
 * GitHub writes both. A table column's alignment is its cells' `align`. A
 * block quote is a `blockquote` of its blocks.
 *
 * @type {(href: (href: string) => Result<string, string>) => (blocks: Blocks) => Result<readonly Element[], string>}
 */
export const readmeNodes = href => blocks => {
    for (const block of blocks) {
        const c = block[0] === 'heading' ? unknownAnchorChar(block[2]) : undefined
        if (c !== undefined) { return error(`a heading character whose anchor GitHub may make otherwise: ${c}`) }
        // An image's words are not its alternative text in GitHub's anchor.
        if (block[0] === 'heading' && hasImage(block[2])) { return error('an image in a heading, whose anchor GitHub may make otherwise') }
    }
    const ids = anchors(blocks)
    /** @type {(span: Inline) => Result<Node, string>} */
    const node = span => {
        const kind = span[0]
        if (kind === 'code') { return ok(['code', span[1]]) }
        if (kind === 'strong') { return ok(['strong', ...span[1].map(labelNode)]) }
        if (kind === 'em') { return ok(['em', ...span[1].map(labelNode)]) }
        if (kind === 'image') { return imageNode(span) }
        if (kind === 'link') {
            const target = href(span[2])
            if (target[0] === 'error') { return target }
            /** @type {readonly Node[]} */
            let label = []
            for (const l of span[1]) {
                const n = l[0] === 'image' ? imageNode(l) : ok(labelNode(l))
                if (n[0] === 'error') { return n }
                label = [...label, n[1]]
            }
            return ok(['a', { href: target[1] }, ...label])
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
        /** @type {readonly Node[]} */
        let checkbox = []
        for (const block of blocks) {
            /** @type {Block} */
            const b = block
            if (b[0] === 'task') {
                checkbox = [b[1]
                    ? ['input', { type: 'checkbox', disabled: '', checked: '' }]
                    : ['input', { type: 'checkbox', disabled: '' }], ' ']
                continue
            }
            if (b[0] === 'code') {
                const drawn = b[1] === 'mermaid' ? flowchartSvg(b[2]) : null
                if (drawn !== null && drawn[0] === 'ok') {
                    out = [...out, drawn[1]]
                    continue
                }
                const text = fenceNodes(b[1])(b[2])
                /** @type {Element} */
                const code = b[1] === '' ? ['code', ...text] : ['code', { class: `language-${b[1]}` }, ...text]
                // The copy is the fence's text without the newline that ends
                // its last line, as GitHub copies it: a pasted command does
                // not run before the reader has read it.
                out = [...out, codeBlock(b[2].endsWith('\n') ? b[2].slice(0, -1) : b[2], 'Copy code', [code])]
                continue
            }
            if (b[0] === 'list' || b[0] === 'olist') {
                const [loose, list] = b[0] === 'list' ? [b[1], b[2]] : [b[2], b[3]]
                /** @type {readonly Element[]} */
                let items = []
                for (const item of list) {
                    const n = blockNodes(!loose)(item)
                    if (n[0] === 'error') { return n }
                    items = [...items, item.length !== 0 && item[0][0] === 'task' ? ['li', { class: 'task-list-item' }, ...n[1]] : ['li', ...n[1]]]
                }
                // An ordered list starts at its first item's number, which
                // `ol` takes as `start` where it is not the 1 it defaults to.
                out = [...out, b[0] === 'list' ? ['ul', ...items]
                    : b[1] === 1 ? ['ol', ...items] : ['ol', { start: String(b[1]) }, ...items]]
                continue
            }
            // A quote's paragraphs are each a `p`, whatever holds the quote.
            if (b[0] === 'quote') {
                const n = blockNodes(false)(b[1])
                if (n[0] === 'error') { return n }
                out = [...out, ['blockquote', ...n[1]]]
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
                out = [...out, linkedHeading(Math.min(b[1] + 1, 6), ids[heading], b[2].map(words).join(''), n[1])]
                heading += 1
                continue
            }
            const text = [...checkbox, ...n[1]]
            checkbox = []
            out = tight ? [...out, ...text] : [...out, ['p', ...text]]
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
