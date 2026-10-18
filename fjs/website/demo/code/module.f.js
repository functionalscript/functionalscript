/**
 * Copyable code blocks for website demos; shell arguments are `../../../text/shell`'s.
 * @module
 * @import { Element, Node } from '../../../media/html/types.ts'
 */

import { codeMarker } from '../../style/module.f.js'

/** Copy plain text while optionally displaying its highlighted nodes.
 * @type {(text: string, label: string, content?: readonly Node[]) => Element}
 */
export const codeBlock = (text, label, content = [text]) => ['div', { [codeMarker]: '', 'data-code-block': '' },
    ['pre', ...content],
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
