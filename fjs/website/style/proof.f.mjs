import { assert } from '../../asserts/module.f.mjs'
import { stylesheet } from './module.f.mjs'

/**
 * The selectors the browser test runner's report is styled through. The
 * runner sets these attributes; the stylesheet is what gives them a colour,
 * so a rule that lost one of them would leave a passed or failed run looking
 * like an idle one.
 */
const runnerSelectors = [
    '[data-state="passed"] [data-test-summary]',
    '[data-state="failed"] [data-test-summary]',
    '[data-state="infrastructure-error"] [data-test-summary]',
    '[data-test-results]',
    '[data-status="passed"]::marker',
    '[data-status="failed"]',
]

export const proof = {
    // Both schemes define the same four variables, so a rule written against
    // `var(--pass)` reads in the dark as in the light.
    definesBothSchemes: () => {
        assert(stylesheet.includes('color-scheme: light dark'), stylesheet)
        assert(stylesheet.includes('@media (prefers-color-scheme: dark)'), stylesheet)
        for (const variable of ['--bg', '--text', '--pass', '--fail']) {
            assert(stylesheet.split(`${variable}:`).length === 3, `expected ${variable} once per scheme`)
        }
    },
    stylesTheRunnerReport: () => {
        for (const selector of runnerSelectors) {
            assert(stylesheet.includes(selector), `expected a rule for ${selector}`)
        }
    },
    endsWithNewline: () => {
        assert(stylesheet.endsWith('\n'), 'a written file ends with a newline')
    },
}
