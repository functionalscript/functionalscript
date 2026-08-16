/**
 * Static website generation program for project landing content.
 *
 * @module
 *
 * @import { Write, WriteFile } from '../effects/node/types.ts'
 * @import { Effect } from '../effects/types.ts'
 */

import { htmlUtf8 } from '../media/html/module.f.mjs'
import { exitStep, writeFile } from '../effects/node/module.f.mjs'

const html = htmlUtf8()(
    ['a',
        { href: 'https://github.com/functionalscript/functionalscript' },
        'GitHub Repository'
    ])

/** @type {Effect<WriteFile | Write, number>} */
const program = exitStep(writeFile('index.html', html))

export const main = () => program
