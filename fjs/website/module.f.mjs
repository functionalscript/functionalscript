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
    ['title', 'Emergent Testing in the Browser'],
    ['style', `
:root { color-scheme: light dark; --bg: white; --text: black; --pass: #137333; --fail: #b3261e }
@media (prefers-color-scheme: dark) {
    :root { --bg: #121212; --text: #f1f1f1; --pass: #81c995; --fail: #f28b82 }
}
body { background-color: var(--bg); color: var(--text); font: 16px system-ui; margin: 3rem auto; max-width: 48rem; padding: 0 1rem }
[data-state="passed"] [data-test-summary] { color: var(--pass) }
[data-state="failed"] [data-test-summary], [data-state="infrastructure-error"] [data-test-summary] { color: var(--fail) }
[data-test-results] { color: var(--text) }
[data-status="passed"]::marker { color: var(--pass) }
[data-status="failed"] { color: var(--fail) }
pre { white-space: pre-wrap }
`]
)(
    ['main', { 'data-browser-tests': '', 'data-state': 'idle' },
        ['p', ['a',
            { href: 'https://github.com/functionalscript/functionalscript' },
            'GitHub Repository'
        ]],
        ['h1', 'Emergent Testing in the Browser'],
        ['p',
            'FunctionalScript derives this browser-native unit-test suite from exported proofs. ',
            ['a',
                { href: 'https://medium.com/javascript-in-plain-english/emergent-testing-in-javascript-e44760d71688' },
                'Read “Emergent Testing in JavaScript”'
            ],
            '.'
        ],
        ['p', { 'data-test-summary': '' }, 'Idle. Press Run to start the suite.'],
        ['button', { type: 'button', 'data-test-run': '' }, 'Run'],
        ['pre', ['ol', { 'data-test-results': '' }]]
    ],
    ['script', { type: 'module', src: './_browser-test-entry.mjs' }]
)

const entry = utf8(`import { startBrowserTestSources } from './fjs/emergent_testing/browser.mjs'
import { browserProofSources } from './fjs/emergent_testing/_browser-suite.mjs'

const root = /** @type {Element} */ (document.querySelector('[data-browser-tests]'))
const sources = [...browserProofSources, './fjs/website/browser.mjs']
const runButton = /** @type {Element} */ (document.querySelector('[data-test-run]'))
const start = () => startBrowserTestSources(root, sources, source => import(source))
runButton.addEventListener('click', start)
`)

/** @type {Effect<WriteFile | Write | All, 0, number>} */
const program = exitStep(mapStep(allOk(
    writeFile('index.html', html),
    writeFile('_browser-test-entry.mjs', entry)
), () => undefined))

export const main = () => program
