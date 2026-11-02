/**
 * Shared heading anchors and the demo's input-link control. README headings
 * avoid the identifiers reserved by page sections and the directory drawer.
 * @module
 * @import { Element, Node } from '../../media/html/types.ts'
 */

/** @type {readonly string[]} */
export const reservedIds = ['demo', 'emergent-testing', 'directory-drawer', 'drawer-title']

/** @type {Element} */
const linkIcon = ['svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    ['path', { d: 'M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }],
    ['path', { d: 'M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' }],
]

/** A native anchor, as on GitHub: it sits in the heading's left margin and
 * shows on hover or focus. A click scrolls to the heading and puts its
 * fragment in the address bar; copying the link is the browser's own menu.
 * A demo heading adds **Copy with inputs**, shown once the runtime binds.
 * @type {(id: string, label: string, demo?: boolean) => Element}
 */
export const permalink = (id, label, demo = false) => ['span', { 'data-permalink': '' },
    ['a', { href: `#${id}`, 'aria-label': `Link to ${label}`, 'data-heading-anchor': '' }, linkIcon],
    ...(demo ? [/** @type {Element} */ (['button', { type: 'button', hidden: '', 'data-copy-demo': '', 'aria-label': 'Copy with inputs', title: 'Copy link with inputs' },
        linkIcon,
        ['span', { 'data-input-link-label': '' }, 'Copy with inputs'],
        ['span', { 'data-copy-status': '', 'aria-live': 'polite' }],
    ])] : []),
]

/** Keep the controls beside the heading, outside its accessible name.
 * @type {(level: number, id: string, label: string, content: readonly Node[]) => Element}
 */
export const linkedHeading = (level, id, label, content) => ['div', { 'data-linked-heading': '' },
    [`h${level}`, { id }, ...content],
    permalink(id, label),
]
