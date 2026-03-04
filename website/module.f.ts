/**
 * Static website generation program for project landing content.
 *
 * @module
 */
import { htmlToString, type Element } from '../html/module.f.ts'
import { type NodeEffect, writeFile } from '../types/effects/node/module.f.ts'
import { utf8 } from '../text/module.f.ts'
import { fluent } from '../types/effects/module.f.ts'

const html: Element = ['body',
    ['a', { href: 'https://github.com/functionalscript/functionalscript' }, 'GitHub Repository']
]

const program: NodeEffect<number> = fluent
    .step(() => writeFile('index.html', utf8(htmlToString(html))))
    .map(() => 0)
    .effect

export default () => program
