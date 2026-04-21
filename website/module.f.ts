/**
 * Static website generation program for project landing content.
 *
 * @module
 */
import { htmlUtf8 } from '../html/module.f.ts'
import { type NodeOp, writeFile } from '../types/effects/node/module.f.ts'
import { begin, pure, type Effect } from '../types/effects/module.f.ts'
import type { Vec } from '../types/bit_vec/module.f.ts'

const html: Vec = htmlUtf8()(
    ['a',
        { href: 'https://github.com/functionalscript/functionalscript' },
        'GitHub Repository'
    ])

const program =
    writeFile('index.html', html)
    .step(() => pure(0))

export default () => program
