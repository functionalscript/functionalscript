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
export const stylesheet = `:root { color-scheme: light dark; --bg: white; --text: black; --muted: #5f6368; --border: #dadce0; --pass: #137333; --pass-bg: #e6f4ea; --fail: #b3261e; --fail-bg: #fce8e6 }
@media (prefers-color-scheme: dark) {
    :root { --bg: #121212; --text: #f1f1f1; --muted: #9aa0a6; --border: #3c4043; --pass: #81c995; --pass-bg: #0f2417; --fail: #f28b82; --fail-bg: #2a1414 }
}
/* Nearly every word on this site is a path, and a path has no space for a line
   to break at. On a phone a page's title, a proof's name or a digest is wider
   than the screen, and with nowhere to break it the whole page scrolls
   sideways, or the report's panel clips the line. So any line may break inside
   a word: an identifier split across two lines is still read, and one cut off
   is not. */
body { background-color: var(--bg); color: var(--text); font: 16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; margin: 3rem auto; max-width: 48rem; overflow-wrap: anywhere; padding: 0 1rem }
[data-state="passed"] [data-test-summary] { color: var(--pass) }
[data-state="failed"] [data-test-summary], [data-state="infrastructure-error"] [data-test-summary] { color: var(--fail) }
[data-test-results] { color: var(--text) }
[data-status="passed"]::marker { color: var(--pass) }
[data-status="failed"] { color: var(--fail) }
/* The report is one framed panel: a group per module, divided by rules, each
   line a chevron, a dot for its verdict, the module's path, and its counts at
   the right edge. A group that passed folds and recedes; one that failed stays
   open with a red dot. A failure's error is a tinted, bordered box in the
   ordinary text colour, so a stack is readable rather than a wall of red. The
   panel is not drawn until a run has put something in it. The runner's demo
   draws the same report into its own container, so both are the panel.
   Where a line has no room for both, the counts move under the path rather
   than squeezing it into a column a few characters wide. */
[data-test-results], [data-example-report] { border: 1px solid var(--border); border-radius: 10px; margin-top: .5rem; overflow: hidden }
[data-test-results]:empty, [data-example-report]:empty { display: none }
[data-test-module] { color: var(--text) }
[data-test-module] + [data-test-module] { border-top: 1px solid var(--border) }
[data-test-module] > summary { align-items: center; cursor: pointer; display: flex; flex-wrap: wrap; gap: .5rem; list-style: none; padding: .4rem .75rem }
[data-test-module] > summary::-webkit-details-marker { display: none }
[data-test-module] > summary::before { color: var(--muted); content: "▸"; display: inline-block; flex: none; transition: transform .15s; width: 1ch }
[data-test-module][open] > summary::before { transform: rotate(90deg) }
[data-dot] { background: var(--muted); border-radius: 50%; flex: none; height: .5rem; width: .5rem }
[data-status="passed"] > summary > [data-dot] { background: var(--pass) }
[data-status="failed"] > summary > [data-dot] { background: var(--fail) }
[data-path] { flex: 1 1 16ch }
[data-counts] { color: var(--muted); margin-left: auto; white-space: nowrap }
[data-test-module] > ol { margin: 0 0 .5rem; padding: 0 .75rem 0 3rem }
li[data-status="passed"] { color: var(--muted) }
[data-test-error] { background: var(--fail-bg); border: 1px solid color-mix(in srgb, var(--fail) 40%, transparent); border-radius: 6px; color: var(--text); margin: .25rem 0 .5rem; padding: .5rem .6rem }
/* The run's counts sit in the section's own title — green for what passed,
   red for what failed, and the time at the right edge — so they stay in sight
   with the section folded. The line under the title keeps only what the title
   cannot say, and is not drawn when it has nothing to say. */
[data-test-counts], [data-example-counts] { font-size: .8rem; font-weight: 600 }
[data-count-passed], [data-count-failed] { border-radius: 999px; margin-left: .5rem; padding: .1rem .5rem; vertical-align: middle }
[data-count-passed] { background: var(--pass-bg); color: var(--pass) }
[data-count-failed] { background: var(--fail-bg); color: var(--fail) }
[data-duration] { color: var(--muted); float: right; font-weight: 400; line-height: 1.9rem }
[data-test-summary]:empty { display: none }
/* Before a run, the list of proof sources is the only view of what the page
   will run. Once the report has anything in it, a runnable source that
   produced results is a group above it, so its entry is hidden rather than
   repeated. Two kinds of entry have no group and stay: a blocked proof, which
   never runs, and a proof that ran and reported no tests, which the runner
   marks after the run. Hiding either would let a green count read as the whole
   subtree tested. The list itself is hidden only when it has neither left to
   show. It hides as the first group lands and returns when a new run empties
   the report. */
[data-test-results]:not(:empty) ~ [data-test-sources] > li:not([data-blocked]):not([data-no-tests]) { display: none }
[data-test-results]:not(:empty) ~ [data-test-sources]:not(:has([data-blocked], [data-no-tests])) { display: none }
[data-no-tests]::after { color: var(--muted); content: " — no tests reported" }
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
/* A finger is wider than a pointer. A listed file or directory is one line of
   text with the next directly under it, so on a touch screen each link is
   padded to a target a finger can pick without taking its neighbour. */
@media (pointer: coarse) {
    [data-section] > ul a { display: inline-block; padding-block: .25rem }
}
`
