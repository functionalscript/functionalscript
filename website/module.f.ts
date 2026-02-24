import { htmlToString, type Element } from '../html/module.f.ts'
import { type NodeEffect, writeFile } from '../types/effect/node/module.f.ts'
import { utf8 } from '../text/module.f.ts'

const html: Element = ['body',
    ['a', { href: 'https://github.com/functionalscript/functionalscript' }, 'GitHub Repository']
]

const program: NodeEffect<number> = writeFile('index.html', utf8(htmlToString(html)))
    .map(() => 0)

export default () => program
