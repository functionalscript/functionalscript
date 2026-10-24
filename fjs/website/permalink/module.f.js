/**
 * Shared heading links and progressive clipboard controls. README headings
 * avoid the identifiers reserved by page sections and the directory drawer.
 * @module
 * @import { Element, Node } from '../../media/html/types.ts'
 */

/** @type {readonly string[]} */
export const reservedIds = ['demo', 'emergent-testing', 'directory-drawer', 'drawer-title']

/** A native anchor without JavaScript; a copy control once the runtime binds.
 * @type {(id: string, label: string) => Element}
 */
export const permalink = (id, label) => ['span', { 'data-permalink': '' },
    ['a', { href: `#${id}`, 'aria-label': `Link to ${label}` }, '#'],
    ['button', { type: 'button', hidden: '', 'data-copy-fragment': id, 'aria-label': `Copy link to ${label}` },
        'Copy link',
        ['span', { 'data-copy-status': '', 'aria-live': 'polite' }],
    ],
]

/** Keep the controls beside the heading, outside its accessible name.
 * @type {(level: number, id: string, label: string, content: readonly Node[]) => Element}
 */
export const linkedHeading = (level, id, label, content) => ['div', { 'data-linked-heading': '' },
    [`h${level}`, { id }, ...content],
    permalink(id, label),
]
