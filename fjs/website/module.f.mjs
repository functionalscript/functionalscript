/**
 * Static website generation program for project landing content.
 *
 * @module
 *
 * @import { All, Write, WriteFile } from '../effects/node/types.ts'
 * @import { Effect } from '../effects/types.ts'
 */

import { htmlUtf8 } from '../media/html/module.f.mjs'
import { utf8 } from '../text/module.f.mjs'
import { allOk, exitStep, writeFile } from '../effects/node/module.f.mjs'
import { mapStep } from '../effects/module.f.mjs'

const html = htmlUtf8(
    ['title', 'FunctionalScript browser tests'],
    ['style', `
body { color: #202124; font: 16px system-ui; margin: 3rem auto; max-width: 48rem; padding: 0 1rem }
[data-state="loading"] [data-test-summary]::before { content: "Loading…" }
[data-state="running"] [data-test-summary]::before { content: "Running…" }
[data-state="passed"] { color: #137333 }
[data-state="failed"], [data-state="infrastructure-error"] { color: #b3261e }
[data-test-results] { color: #202124 }
[data-status="passed"]::marker { color: #137333 }
[data-status="failed"] { color: #b3261e }
pre { white-space: pre-wrap }
`]
)(
    ['main', { 'data-browser-tests': '', 'data-state': 'loading' },
        ['h1', 'FunctionalScript browser tests'],
        ['p', { 'data-test-summary': '' }],
        ['button', { type: 'button', 'data-test-run': '' }, 'Run again'],
        ['pre', ['ol', { 'data-test-results': '' }]],
        ['p', ['a',
            { href: 'https://github.com/functionalscript/functionalscript' },
            'GitHub Repository'
        ]]
    ],
    ['script', { type: 'module', src: './browser-test-entry.mjs' }]
)

const entry = utf8(`import { startBrowserTestSources } from './fjs/emergent_testing/browser.mjs'
import { browserProofSources } from './fjs/emergent_testing/browser-suite.mjs'

const root = /** @type {Element} */ (document.querySelector('[data-browser-tests]'))
const sources = [...browserProofSources, './fjs/website/browser.mjs']
const start = () => startBrowserTestSources(root, sources, source => import(source))
const runButton = /** @type {Element} */ (document.querySelector('[data-test-run]'))
runButton.addEventListener('click', start)
if (new URL(location.href).searchParams.get('run') !== 'false') { start() }
`)

/** @type {Effect<WriteFile | Write | All, 0, number>} */
const program = exitStep(mapStep(allOk(
    writeFile('index.html', html),
    writeFile('browser-test-entry.mjs', entry)
), () => undefined))

export const main = () => program
