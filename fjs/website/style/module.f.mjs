/**
 * The website's one stylesheet, held as data so the generator can write it
 * once as `_main.css` and every page can link it.
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
 *
 * @import { Element } from '../../media/html/types.ts'
 */

/**
 * Where the generator writes the stylesheet, as the root-relative URL every
 * page links it by.
 *
 * Root-relative and not `./_main.css`: pages sit at every depth of the tree
 * and there is one stylesheet, so the href cannot depend on where the page
 * that writes it happens to be.
 *
 * @type {string}
 */
export const stylesheetPath = '/_main.css'

/**
 * The `<link>` every page carries, so that no page spells the path itself.
 *
 * @type {Element}
 */
export const stylesheetLink = ['link', { rel: 'stylesheet', href: stylesheetPath }]

/**
 * The stylesheet, verbatim.
 *
 * @type {string}
 */
export const stylesheet = `:root { color-scheme: light dark; --bg: white; --text: black; --pass: #137333; --fail: #b3261e }
@media (prefers-color-scheme: dark) {
    :root { --bg: #121212; --text: #f1f1f1; --pass: #81c995; --fail: #f28b82 }
}
body { background-color: var(--bg); color: var(--text); font: 16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; margin: 3rem auto; max-width: 48rem; padding: 0 1rem }
[data-state="passed"] [data-test-summary] { color: var(--pass) }
[data-state="failed"] [data-test-summary], [data-state="infrastructure-error"] [data-test-summary] { color: var(--fail) }
[data-test-results] { color: var(--text) }
[data-status="passed"]::marker { color: var(--pass) }
[data-status="failed"] { color: var(--fail) }
/* Some elements do not inherit the page's font on their own. A browser's rule
   for pre names a monospace family, and naming one is what triggers the legacy
   shrink to 13.33px; a form control is given the platform's UI face outright,
   so Run was Arial at 13.33px on a page set in monospace at 16px. Inheriting
   is what makes "one face" true of the whole page rather than of its text.

   Every control, not only the ones the site has today: a demo's field is an
   input, and it was Arial the moment the first demo landed. A list that has to
   be extended for each new control is a rule that is wrong between the element
   arriving and somebody noticing. */
button, input, pre { font: inherit }
pre { white-space: pre-wrap }
/* Every section of a page is a disclosure, so a reader can fold away what
   they are not reading — the platform's own collapsible, and no script on a
   site that is static files. Its summary is the section's heading, and is
   sized like one. */
[data-section] { margin: 1.5rem 0 }
/* A demo that is waiting on a command says so, and the word is general because
   the runtime that sets it runs every demo: the next may be waiting on a
   network rather than on arithmetic. The message is the attribute's, not the
   demo's, so no demo can forget it.
   The attribute's value is the one part a demo supplies — how long this
   particular turn will be, which the runtime cannot know. It is empty for
   almost every turn, and an empty attr() adds nothing, so the general case
   renders exactly the word above. */
[data-demo-working]::after { content: "Working…" attr(data-demo-working); display: block; margin-top: .5rem }
[data-demo-working] button { cursor: default }
[data-section] > summary { cursor: pointer; font-size: 1.25rem; font-weight: 600 }
[data-section] > ul { margin-top: .5rem }
`
