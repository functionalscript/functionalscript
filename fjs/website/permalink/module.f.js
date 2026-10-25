/**
 * Shared heading links and progressive clipboard controls. README headings
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

/** A native anchor without JavaScript; a copy control once the runtime binds.
 * @type {(id: string, label: string, demo?: boolean) => Element}
 */
export const permalink = (id, label, demo = false) => {
    const menuId = `copy-demo-link:${id.length}:${id}`
    return ['span', { 'data-permalink': '' },
        ['a', { href: `#${id}`, 'aria-label': `Link to ${label}` }, linkIcon],
        ['button', { type: 'button', hidden: '', 'data-copy-fragment': id,
            ...(demo ? { 'data-copy-demo': '', popovertarget: menuId, 'aria-label': 'Copy demo link options', title: 'Copy demo link options' }
                : { 'aria-label': `Copy link to ${label}`, title: 'Copy link' }) },
            linkIcon,
            ...(demo ? [/** @type {Element} */ (['svg', { 'data-demo-link-chevron': '', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'aria-hidden': 'true' }, ['path', { d: 'm6 9 6 6 6-6' }]])] : []),
            ['span', { 'data-copy-status': '', 'aria-live': 'polite' }],
        ],
        ...(demo ? [/** @type {Element} */ (['span', { id: menuId, hidden: '', popover: 'auto', 'data-demo-link-menu': '', role: 'group', 'aria-label': 'Copy demo link' },
            ['button', { type: 'button', 'data-copy-demo-section': '' }, ['strong', 'Copy section link'], ['small', 'Link to Demo without inputs']],
            ['button', { type: 'button', 'data-copy-demo-inputs': '' }, ['strong', 'Copy link with inputs'], ['small', 'Include the current example or custom inputs']],
        ])] : []),
    ]
}

/** Keep the controls beside the heading, outside its accessible name.
 * @type {(level: number, id: string, label: string, content: readonly Node[]) => Element}
 */
export const linkedHeading = (level, id, label, content) => ['div', { 'data-linked-heading': '' },
    [`h${level}`, { id }, ...content],
    permalink(id, label),
]
