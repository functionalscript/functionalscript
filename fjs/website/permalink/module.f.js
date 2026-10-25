/**
 * Shared heading links and progressive clipboard controls. README headings
 * avoid the identifiers reserved by page sections and the directory drawer.
 * @module
 * @import { Element, Node } from '../../media/html/types.ts'
 */

/** @type {readonly string[]} */
export const reservedIds = ['demo', 'emergent-testing', 'directory-drawer', 'drawer-title']

/** @type {(inputs?: boolean) => Element} */
const linkIcon = (inputs = false) => ['svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    ['path', { d: 'M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }],
    ['path', { d: 'M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' }],
    ...(inputs ? [/** @type {Element} */ (['circle', { cx: '20', cy: '20', r: '4', fill: 'var(--bg)', stroke: 'none' }]),
        /** @type {Element} */ (['circle', { 'data-input-link-dot': '', cx: '20', cy: '20', r: '2.6', fill: 'currentColor', stroke: 'none' }])] : []),
]

/** A native anchor without JavaScript; a copy control once the runtime binds.
 * @type {(id: string, label: string, demo?: boolean) => Element}
 */
export const permalink = (id, label, demo = false) => ['span', { 'data-permalink': '' },
    ['a', { href: `#${id}`, 'aria-label': `Link to ${label}` }, linkIcon()],
    ['button', { type: 'button', hidden: '',
        ...(demo ? { 'data-copy-demo-section': id, 'aria-label': 'Copy section link', title: 'Copy section link' }
            : { 'data-copy-fragment': id, 'aria-label': `Copy link to ${label}`, title: 'Copy link' }) },
        linkIcon(),
        ['span', { 'data-copy-status': '', 'aria-live': 'polite' }],
    ],
    ...(demo ? [/** @type {Element} */ (['button', { type: 'button', hidden: '', 'data-copy-demo': '', 'aria-label': 'Copy link with inputs', title: 'Copy link with inputs' },
        linkIcon(true),
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
