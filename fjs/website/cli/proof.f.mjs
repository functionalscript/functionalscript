/**
 * @import { Commands } from '../../cli/types.ts'
 * @import { NodeOp, NodeProgram } from '../../effects/node/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { commands } from '../../module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'
import { element } from '../../media/html/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { utf8ToString } from '../../text/module.f.mjs'
import { anchor, catalogue, cliPage, commandSection, guides } from './module.f.mjs'

const local = /** @type {const} */ ({ commit: null, branch: null, funding: [] })
/** @type {NodeProgram} */
const handler = () => pureOk(0)

export const proof = {
    catalogue: {
        empty: () => assertStructurallySame(catalogue([]), [
            { path: ['help'], aliases: ['h', '?'], description: 'Print this help message' },
        ]),
        nestingAndAliases: () => {
            /** @type {Commands<NodeOp>} */
            const table = [{ names: ['group', 'g', 'grp'], description: 'Group', handler: [
                { names: ['nested', 'n'], description: 'Nested', handler: [
                    { names: ['leaf', 'l', 'lf'], description: 'Leaf', handler },
                ] },
            ] }]
            assertStructurallySame(catalogue(table).map(({ path, aliases }) => [path, aliases]), [
                [['group'], ['g', 'grp']],
                [['group', 'nested'], ['group n']],
                [['group', 'nested', 'leaf'], ['group nested l', 'group nested lf']],
                [['group', 'nested', 'help'], ['group nested h', 'group nested ?']],
                [['group', 'help'], ['group h', 'group ?']],
                [['help'], ['h', '?']],
            ])
        },
        currentCommands: () => {
            const entries = catalogue(commands)
            // Literal expectations make additions/removals and changed alias order visible.
            assertStructurallySame(entries.map(({ path, aliases }) => [path.join(' '), aliases]), [
                ['test', ['t']], ['compile', ['c']], ['cas', ['s']],
                ['cas add', []], ['cas get', []], ['cas list', []],
                ['cas help', ['cas h', 'cas ?']], ['mcp', ['m']], ['ci', ['i']],
                ['web', ['w']], ['run', ['r']], ['help', ['h', '?']],
            ])
            assertStructurallySame(entries.map(({ path }) => path.join(' ')).toSorted(),
                guides.map(({ name }) => name).toSorted())
            assert(guides.every(({ usage, examples, docs }) => usage.length > 0 && examples.length > 0 && docs.startsWith('fjs/')), 'every command has usage, examples and docs')
        },
    },
    anchor: () => assertEq(anchor({ path: ['a #', 'b?'], aliases: [], description: '' }), 'a%20%23-b%3F'),
    section: {
        escapesText: () => {
            const html = concat(element(commandSection(local)(
                { path: ['<cmd>'], aliases: ['<&alias'], description: '<script>&"' })(
                { name: '<cmd>', usage: 'fjs <file> & "value"\nnext', examples: ['fjs <example>'], note: '<note>', docs: 'fjs/a #/README.md' })))
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
                { path: ['cas', 'list'], aliases: [], description: 'List' })(guides[5])))
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
        for (const entry of catalogue(commands)) {
            assert(html.includes(`href="#${anchor(entry)}"`), html)
            assert(html.includes(`id="${anchor(entry)}"`), html)
        }
        for (const guide of guides) {
            assert(html.includes(`href="/${guide.docs}"`), html)
        }
        assert(html.includes('src="/fjs/website/cli-runtime.mjs"'), html)
    },
}
