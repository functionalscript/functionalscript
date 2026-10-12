/**
 * @import { DocumentedCommands } from '../../cli/types.ts'
 * @import { NodeOp, NodeProgram } from '../../effects/node/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { helpReference } from '../../cli/module.f.mjs'
import { commands } from '../../module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'
import { element } from '../../media/html/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { utf8ToString } from '../../text/module.f.mjs'
import { anchor, catalogue, cliPage, commandSection } from './module.f.mjs'

const reference = { usage: 'fjs example', examples: ['fjs example'], note: 'Example note', docs: 'fjs/example/README.md' }

const local = /** @type {const} */ ({ commit: null, branch: null, funding: [] })
/** @type {NodeProgram} */
const handler = () => pureOk(0)

export const proof = {
    catalogue: {
        empty: () => assertStructurallySame(catalogue([]), [
            { path: ['help'], aliases: ['h', '?'], description: 'Print this help message', ...helpReference([]) },
        ]),
        nestingAndAliases: () => {
            /** @type {DocumentedCommands<NodeOp>} */
            const table = [{ names: ['group', 'g', 'grp'], description: 'Group', ...reference, handler: [
                { names: ['nested', 'n'], description: 'Nested', ...reference, handler: [
                    { names: ['leaf', 'l', 'lf'], description: 'Leaf', ...reference, handler },
                ] },
            ] }]
            assertStructurallySame(catalogue(table).map(({ path, aliases }) => [path, aliases]), [
                [['group'], ['g', 'grp']],
                [['group', 'nested'], ['group n', 'g nested', 'g n', 'grp nested', 'grp n']],
                [['group', 'nested', 'leaf'], ['group nested l', 'group nested lf',
                    'group n leaf', 'group n l', 'group n lf',
                    'g nested leaf', 'g nested l', 'g nested lf', 'g n leaf', 'g n l', 'g n lf',
                    'grp nested leaf', 'grp nested l', 'grp nested lf', 'grp n leaf', 'grp n l', 'grp n lf']],
                [['group', 'nested', 'help'], ['group nested h', 'group nested ?',
                    'group n help', 'group n h', 'group n ?',
                    'g nested help', 'g nested h', 'g nested ?', 'g n help', 'g n h', 'g n ?',
                    'grp nested help', 'grp nested h', 'grp nested ?', 'grp n help', 'grp n h', 'grp n ?']],
                [['group', 'help'], ['group h', 'group ?', 'g help', 'g h', 'g ?', 'grp help', 'grp h', 'grp ?']],
                [['help'], ['h', '?']],
            ])
        },
        referenceChangesFlowThrough: () => {
            const entry = catalogue([{ names: ['example'], description: 'Updated description',
                ...reference, usage: 'fjs example <updated>', examples: ['fjs example new-input'],
                note: 'Updated note', docs: 'fjs/updated/README.md', handler }])[0]
            const html = concat(element(commandSection(local)(entry)))
            assert(html.includes('fjs example &lt;updated&gt;'), html)
            assert(html.includes('fjs example new-input'), html)
            assert(html.includes('Updated note'), html)
            assert(html.includes('href="/fjs/updated/README.md"'), html)
        },
        currentCommands: () => {
            const entries = catalogue(commands)
            // Literal expectations make additions/removals and changed alias order visible.
            assertStructurallySame(entries.map(({ path, aliases }) => [path.join(' '), aliases]), [
                ['test', ['t']], ['compile', ['c']], ['cas', ['s']],
                ['cas add', ['s add']], ['cas get', ['s get']], ['cas list', ['s list']],
                ['cas help', ['cas h', 'cas ?', 's help', 's h', 's ?']], ['mcp', ['m']], ['ci', ['i']],
                ['web', ['w']], ['run', ['r']], ['help', ['h', '?']],
            ])
            assert(entries.every(({ usage, examples, docs }) => usage.length > 0 && examples.length > 0 && docs.startsWith('fjs/')), 'every command has usage, examples and docs')
            const compile = commands[1]
            const entry = entries[1]
            assertEq(entry.usage, compile.usage)
            assertStructurallySame(entry.examples, compile.examples)
            assertEq(entry.note, compile.note)
            assertEq(entry.docs, compile.docs)
        },
    },
    anchor: () => assertEq(anchor({ path: ['a #', 'b?'], aliases: [], description: '', ...reference }), 'a%20%23-b%3F'),
    section: {
        escapesText: () => {
            const html = concat(element(commandSection(local)(
                { path: ['<cmd>'], aliases: ['<&alias'], description: '<script>&"', usage: 'fjs <file> & "value"\nnext', examples: ['fjs <example>'], note: '<note>', docs: 'fjs/a #/README.md' })))
            assert(html.includes('fjs &lt;cmd&gt;'), html)
            assert(html.includes('&lt;script&gt;&amp;'), html)
            assert(html.includes('fjs &lt;&amp;alias'), html)
            assert(html.includes('<pre>fjs &lt;file&gt; &amp; &quot;value&quot;\nnext</pre>'), html)
            assert(html.includes('data-copy="fjs &lt;file&gt; &amp; &quot;value&quot;\nnext"'), html)
            assert(html.includes('&lt;note&gt;'), html)
            assert(html.includes('/fjs/a%20%23/README.md'), html)
            assert(html.includes('id="%3Ccmd%3E"'), html)
            assert(html.includes('href="#%253Ccmd%253E"'), html)
            assert(!html.includes('<script>&'), html)
        },
        noAliasesAndCommitDocs: () => {
            const html = concat(element(commandSection({ ...local, commit: '0123456789abcdef0123456789abcdef01234567' })(
                { ...catalogue(commands)[5], aliases: [] })))
            assert(html.includes('Aliases: none'), html)
            assert(html.includes('/blob/0123456789abcdef0123456789abcdef01234567/fjs/cas/cli/module.f.mjs'), html)
        },
    },
    page: () => {
        const html = utf8ToString(cliPage(local))
        assert(html.includes('<title>FunctionalScript CLI</title>'), html)
        assert(html.includes('<header>') && html.includes('href="/_main.css"'), html)
        assert(html.includes('npm install -g functionalscript'), html)
        assert(html.includes('npx functionalscript &lt;command&gt; [args]'), html)
        assert(!html.includes('npx fjs'), html)
        assert(html.includes('aria-label="CLI commands"'), html)
        assert(!html.includes('data-demo='), html)
        assert(html.includes('Aliases: fjs s add'), html)
        assert(html.includes('data-cli-search="cas add s add Store file content and print its hash"'), html)
        assert(html.includes('fjs s h'), html)
        for (const entry of catalogue(commands)) {
            assert(html.includes(`href="#${anchor(entry)}"`), html)
            assert(html.includes(`id="${anchor(entry)}"`), html)
        }
        for (const guide of catalogue(commands)) {
            assert(html.includes(`href="/${guide.docs}"`), html)
        }
        assert(html.includes('src="/fjs/website/cli-runtime.mjs"'), html)
    },
}
