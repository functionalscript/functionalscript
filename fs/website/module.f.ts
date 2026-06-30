/**
 * Static website generation program for project landing content.
 *
 * @module
 */
import { htmlUtf8 } from '../html/module.f.ts'
import { writeFile, type WriteFile } from '../effects/node/module.f.ts'
import { pure, type Effect } from '../effects/module.f.ts'
import { unwrap } from '../types/nullable/module.f.ts'
import type { Vec } from '../types/bit_vec/module.f.ts'

// Fixed source-literal content, so its UTF-8 encoding is well within the cap.
const html: Vec = unwrap(htmlUtf8()(
    ['a',
        { href: 'https://github.com/functionalscript/functionalscript' },
        'GitHub Repository'
    ]))

const program: Effect<WriteFile, number> =
    writeFile('index.html', html)
    .step(() => pure(0))

export const main = () => program
