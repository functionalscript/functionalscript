/**
 * Copyable code blocks and literal POSIX shell arguments for website demos.
 * @module
 * @import { Element } from '../../../media/html/types.ts'
 */

/** @type {(text: string, label: string) => Element} */
export const codeBlock = (text, label) => ['div', { 'data-code': '', 'data-code-block': '' },
    ['pre', text],
    ['button', { type: 'button', 'data-copy': text, 'aria-label': label, title: label },
        ['svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'aria-hidden': 'true' },
            ['path', { d: 'M6 9H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2' }],
            ['rect', { x: '9', y: '3', width: '12', height: '12', rx: '1' }],
        ],
        ['svg', { 'data-copy-check': '', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
            ['path', { d: 'm5 12 4 4 10-10' }],
        ],
        ['span', { 'data-copy-status': '', 'aria-live': 'polite' }],
    ],
]

/** A literal POSIX shell argument, or null for NUL, which shell arguments cannot contain.
 * This is a permanent shell limitation; the caller must explain the refusal.
 * @type {(text: string) => string | null}
 */
export const tryShellQuote = text => text.includes('\0') ? null : `'${text.replaceAll("'", "'\\''")}'`
