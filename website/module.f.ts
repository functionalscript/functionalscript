/**
 * Static website generation program for project landing content.
 *
 * @module
 */
import { htmlToString, type Element } from '../html/module.f.ts'
import { type NodeOp, writeFile } from '../types/effects/node/module.f.ts'
import { utf8 } from '../text/module.f.ts'
import { begin, pure, type Effect } from '../types/effects/module.f.ts'

const html: Element = ['body',
    ['a', { href: 'https://github.com/functionalscript/functionalscript' }, 'GitHub Repository']
]

const program: Effect<NodeOp, number> = begin
    .step(() => writeFile('index.html', utf8(htmlToString(html))))
    .step(() => pure(0))

export default () => program
