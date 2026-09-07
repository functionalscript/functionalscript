/**
 * The website's one stylesheet, held as data so the generator can write it
 * once as `main.css` and every page can link it.
 *
 * It moved here from the root page's inline `<style>` unchanged: the light and
 * dark colour schemes, the page layout, and the `data-state` / `data-status`
 * colours the browser test runner's report relies on. A page that carries its
 * own copy of these rules is a page that drifts from the others, which is the
 * whole reason there is one file rather than one block per generator.
 *
 * A string rather than a structured rule list, because nothing reads the rules
 * back — they are written, not queried — and a structure would be a second
 * spelling of CSS with nothing to check it against.
 *
 * @module
 */

/**
 * The stylesheet, verbatim.
 *
 * @type {string}
 */
export const stylesheet = `:root { color-scheme: light dark; --bg: white; --text: black; --pass: #137333; --fail: #b3261e }
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
`
