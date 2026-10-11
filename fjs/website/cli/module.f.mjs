/**
 * The static CLI reference, derived from the dispatcher's actual command table.
 * Importing the table constructs effects; it never runs any command handlers.
 * Every reference field belongs to the command definition beside its handler.
 *
 * @module
 *
 * @import { DocumentedCommands } from '../../cli/types.ts'
 * @import { NodeOp } from '../../effects/node/types.ts'
 * @import { Element } from '../../media/html/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Build } from '../page/types.ts'
 * @import { Entry } from './types.ts'
 */

import { commands } from '../../module.f.mjs'
import { helpMeta, helpReference } from '../../cli/module.f.mjs'
import { fileHref, shell } from '../page/module.f.mjs'
import { codeBlock } from '../demo/code/module.f.mjs'

/**
 * Preorder command catalogue, including help at every declared table level.
 * Aliases keep their declared order and the canonical parent path.
 * @type {(table: DocumentedCommands<NodeOp>, parent?: readonly string[]) => readonly Entry[]}
 */
export const catalogue = (table, parent = []) => [
    ...table.flatMap(({ names: [name, ...aliases], description, handler, usage, examples, note, docs }) => {
        const path = [...parent, name]
        return [
            { path, aliases: aliases.map(alias => [...parent, alias].join(' ')), description, usage, examples, note, docs },
            ...(typeof handler === 'function' ? [] : catalogue(handler, path)),
        ]
    }),
    {
        path: [...parent, helpMeta.names[0]],
        aliases: helpMeta.names.slice(1).map(alias => [...parent, alias].join(' ')),
        description: helpMeta.description,
        ...helpReference(parent),
    },
]

/** Stable anchors from canonical path segments, encoded individually.
 * @type {(entry: Entry) => string}
 */
export const anchor = ({ path }) => path.map(encodeURIComponent).join('-')

/** An anchored detail section; all provider text goes through media/html.
 * @type {(build: Build) => (entry: Entry) => Element}
 */
export const commandSection = build => entry => ['section', { id: anchor(entry), 'data-cli-command': '' },
    ['h2', ['a', { href: `#${encodeURIComponent(anchor(entry))}` }, `fjs ${entry.path.join(' ')}`]],
    ['p', entry.description],
    ['p', 'Aliases: ', entry.aliases.length === 0 ? 'none' : entry.aliases.map(alias => `fjs ${alias}`).join(', ')],
    ['h3', 'Usage'],
    codeBlock(entry.usage, `Copy ${entry.path.join(' ')} usage`),
    ['p', entry.note],
    ['h3', 'Examples'],
    ...entry.examples.map(text => codeBlock(text, `Copy ${entry.path.join(' ')} example`)),
    ['p', ['a', { href: fileHref(build.commit)('.')(entry.docs) }, 'Complete documentation']],
]

/** @type {(entry: Entry) => Element} */
const commandLink = entry => ['li',
    ['a', { href: `#${encodeURIComponent(anchor(entry))}`, 'data-cli-link': '', 'data-cli-search': [entry.path.join(' '), ...entry.aliases, entry.description].join(' ') },
        ['strong', `fjs ${entry.path.join(' ')}`], ['span', entry.description]]]

/** The page is readable without JavaScript; search, selection and copy controls are enhanced.
 * The built-in command table requires all reference fields at the type level.
 * @type {(build: Build) => Vec}
 */
export const cliPage = build => {
    const entries = catalogue(commands)
    return shell(build)('FunctionalScript CLI')(['main', { 'data-cli': '' },
        ['h1', 'FunctionalScript CLI'],
        ['p', 'Install FunctionalScript to test and compile modules, manage content-addressable storage, and run local tools. Choose a command below for usage and documentation.'],
        ['h2', 'Install and run'],
        codeBlock('npm install -g functionalscript', 'Copy installation command'),
        codeBlock('npx functionalscript <command> [args]', 'Copy package invocation'),
        codeBlock('fjs <command> [args]', 'Copy installed invocation'),
        ['p', 'npx functionalscript invokes the package; fjs is the installed executable. Replace angle-bracket placeholders with your values; square brackets mark optional arguments.'],
        ['p', 'Examples execute locally. This website is a reference, not an online shell.'],
        ['div', { 'data-cli-explorer': '' },
            ['nav', { 'aria-label': 'CLI commands' },
                ['h2', 'Commands'],
                ['div', { 'data-cli-controls': '', hidden: '' },
                    ['label', { for: 'cli-search' }, 'Search commands'],
                    ['div', { 'data-cli-search-row': '' },
                        ['input', { id: 'cli-search', type: 'search', placeholder: 'Search commands…', autocomplete: 'off' }],
                        ['button', { type: 'button', 'data-cli-clear': '', 'aria-label': 'Clear search' }, 'Clear']],
                    ['p', { 'data-cli-count': '', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }, '']],
                ['ul', { 'data-links': '' }, ...entries.map(commandLink)]],
            ['div', { 'data-cli-details': '' }, ...entries.map(commandSection(build))],
        ],
        ['script', { type: 'module', src: '/fjs/website/cli-runtime.mjs' }],
    ])
}
