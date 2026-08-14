/**
 * Static website generation program for project landing content.
 *
 * @module
 *
 * @import { WriteFile } from '../effects/node/types.ts'
 * @import { Effect } from '../effects/types.ts'
 */

import { htmlUtf8 } from '../media/html/module.f.mjs'
import { writeFile } from '../effects/node/module.f.mjs'
import { pure, step } from '../effects/module.f.mjs'

const html = htmlUtf8()(
    ['a',
        { href: 'https://github.com/functionalscript/functionalscript' },
        'GitHub Repository'
    ])

/** @type {Effect<WriteFile, number>} */
const program = step(
    writeFile('index.html', html),
    () => pure(0))

export const main = () => program
