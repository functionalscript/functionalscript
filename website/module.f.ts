import { htmlToString, type Element } from '../html/module.f.ts'
import { type NodeOperations, writeFile, type NodeProgram } from '../types/effect/node/module.f.ts'
import { utf8 } from '../text/module.f.ts'

const html: Element = ['body',
    ['a', { href: 'https://github.com/functionalscript/functionalscript' }, 'GitHub Repository']
]

const program = writeFile<NodeOperations>('index.html', utf8(htmlToString(html)))
    .map(() => 0)

export const run: NodeProgram = () => program
