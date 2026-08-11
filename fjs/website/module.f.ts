/**
 * Static website generation program for project landing content.
 *
 * @module
 */
import { htmlUtf8 } from '../media/html/module.f.mjs'
import { writeFile, type WriteFile } from '../effects/node/module.f.ts'
import { pure, step } from '../effects/module.f.mjs'
import type { Effect } from '../effects/types.ts'
import type { Vec } from '../types/bit_vec/types.ts'

const html: Vec = htmlUtf8()(
    ['a',
        { href: 'https://github.com/functionalscript/functionalscript' },
        'GitHub Repository'
    ])

const program: Effect<WriteFile, number> = step(
    writeFile('index.html', html),
    () => pure(0))

export const main = () => program
