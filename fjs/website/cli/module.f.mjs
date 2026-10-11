/**
 * The static CLI reference, derived from the dispatcher's actual command table.
 * Importing the table constructs effects; it never runs any command handlers.
 * Usage and examples are a separate curated layer until parameters are metadata.
 *
 * @module
 *
 * @import { Commands } from '../../cli/types.ts'
 * @import { NodeOp } from '../../effects/node/types.ts'
 * @import { Element } from '../../media/html/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Build } from '../page/types.ts'
 * @import { Entry, Guide } from './types.ts'
 */

import { commands } from '../../module.f.mjs'
import { helpMeta } from '../../cli/module.f.mjs'
import { assertNotNullish } from '../../asserts/module.f.mjs'
import { fileHref, shell } from '../page/module.f.mjs'
import { codeBlock } from '../demo/code/module.f.mjs'

/**
 * Preorder command catalogue, including help at every declared table level.
 * Aliases keep their declared order and the canonical parent path.
 * @type {(table: Commands<NodeOp>, parent?: readonly string[]) => readonly Entry[]}
 */
export const catalogue = (table, parent = []) => [
    ...table.flatMap(({ names: [name, ...aliases], description, handler }) => {
        const path = [...parent, name]
        return [
            { path, aliases: aliases.map(alias => [...parent, alias].join(' ')), description },
            ...(typeof handler === 'function' ? [] : catalogue(handler, path)),
        ]
    }),
    {
        path: [...parent, helpMeta.names[0]],
        aliases: helpMeta.names.slice(1).map(alias => [...parent, alias].join(' ')),
        description: helpMeta.description,
    },
]

/**
 * Examples create their inputs or name existing files where a checkout is required. The CAS restore
 * example stores its own input first, so no invented content hash is needed.
 * @type {readonly Guide[]}
 */
export const guides = [
    { name: 'test', usage: 'fjs test', examples: ['fjs test'],
        note: 'Run from the directory whose proofs you want to test.', docs: 'fjs/emergent_testing/README.md' },
    { name: 'compile', usage: 'fjs compile\nfjs compile <input> <output>',
        examples: ['fjs compile', "printf 'export default 42;\\n' > example.f.js\nfjs compile ./example.f.js ./example.json"],
        note: 'With no arguments, check every .f.js under the current directory. The POSIX shell example writes example.f.js and example.json in the current directory. The output extension selects its format.', docs: 'fjs/compiler/README.md' },
    { name: 'cas', usage: 'fjs cas <command> [args]', examples: ['fjs help cas'],
        note: 'Choose add, get or list below. Content is stored under ~/.cas/.', docs: 'fjs/cas/README.md' },
    { name: 'cas add', usage: 'fjs cas add <path>', examples: ['fjs cas add ./README.md'],
        note: 'Store an existing file and print its hash; this example uses a repository checkout.', docs: 'fjs/cas/cli/module.f.mjs' },
    { name: 'cas get', usage: 'fjs cas get <hash> <path>',
        examples: ['hash=$(fjs cas add ./README.md)\nfjs cas get "$hash" ./restored-README.md'],
        note: 'Restore a stored hash to a file. This POSIX shell example requires a repository checkout and writes restored-README.md.', docs: 'fjs/cas/cli/module.f.mjs' },
    { name: 'cas list', usage: 'fjs cas list', examples: ['fjs cas list'],
        note: 'Print all hashes in the local store.', docs: 'fjs/cas/cli/module.f.mjs' },
    { name: 'cas help', usage: 'fjs cas help', examples: ['fjs help cas'],
        note: 'Both invocations list the CAS subcommands and their aliases.', docs: 'fjs/README.md' },
    { name: 'mcp', usage: 'fjs mcp', examples: ['npx functionalscript mcp'],
        note: 'Start the stdio server from an MCP client. It waits for protocol input rather than printing an interactive prompt.', docs: 'fjs/mcp/README.md' },
    { name: 'ci', usage: 'fjs ci', examples: ['fjs ci'],
        note: 'Run in the project whose GitHub Actions workflows you want to generate. This writes .github/workflows/gen.ci.yml and gen.npm-publish.yml.', docs: 'fjs/ci/README.md' },
    { name: 'web', usage: 'fjs web [root] [port]', examples: ['fjs web', 'fjs web . 3000'],
        note: 'Defaults to the current directory and port 8080 on loopback. Both arguments are positional.', docs: 'fjs/web/README.md' },
    { name: 'run', usage: 'fjs run <module> [args...]', examples: ['fjs run ./fjs/website/module.f.mjs'],
        note: 'The module must export main as a program or command table. This repository-checkout example generates the website locally.', docs: 'fjs/README.md' },
    { name: 'help', usage: 'fjs help [command]', examples: ['fjs help', 'fjs help cas'],
        note: 'A command table target lists its subcommands. For a program target, help lists the top-level commands; it does not describe positional parameters.', docs: 'fjs/README.md' },
]

/** Stable anchors from canonical path segments, encoded individually.
 * @type {(entry: Entry) => string}
 */
export const anchor = ({ path }) => path.map(encodeURIComponent).join('-')

/** An anchored detail section; all provider text goes through media/html.
 * @type {(build: Build) => (entry: Entry) => (guide: Guide) => Element}
 */
export const commandSection = build => entry => guide => ['section', { id: anchor(entry), 'data-cli-command': '' },
    ['h2', ['a', { href: `#${encodeURIComponent(anchor(entry))}` }, `fjs ${entry.path.join(' ')}`]],
    ['p', entry.description],
    ['p', 'Aliases: ', entry.aliases.length === 0 ? 'none' : entry.aliases.map(alias => `fjs ${alias}`).join(', ')],
    ['h3', 'Usage'],
    codeBlock(guide.usage, `Copy ${guide.name} usage`),
    ['p', guide.note],
    ['h3', 'Examples'],
    ...guide.examples.map(text => codeBlock(text, `Copy ${guide.name} example`)),
    ['p', ['a', { href: fileHref(build.commit)('.')(guide.docs) }, 'Complete documentation']],
]

/** @type {(entry: Entry) => Element} */
const commandLink = entry => ['li',
    ['a', { href: `#${encodeURIComponent(anchor(entry))}` }, `fjs ${entry.path.join(' ')}`], ' — ', entry.description]

/** The page is readable without JavaScript; only copy controls are enhanced.
 * A missing curated guide stops the build rather than silently omitting a command.
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
        ['nav', { 'aria-label': 'CLI commands' },
            ['h2', 'Commands'],
            ['ul', { 'data-links': '' }, ...entries.map(commandLink)]],
        ...entries.map(entry => commandSection(build)(entry)(assertNotNullish(
            guides.find(guide => guide.name === entry.path.join(' ')),
            `No CLI guide for ${entry.path.join(' ')}`))),
        ['script', { type: 'module', src: '/fjs/website/cli-runtime.mjs' }],
    ])
}
