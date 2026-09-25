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
 * The two `<link rel="icon">` elements every page carries, so that no page
 * spells the paths itself.
 *
 * Both, because declaring one ends the implicit lookup: `/favicon.ico` is
 * what a browser asks for when a document declares no icon at all, and once
 * a page declares the SVG, a browser that recognizes `rel="icon"` but cannot
 * render SVG has no reason to go looking for the `.ico` — the fallback would
 * never be requested in the one case it exists for. The `type` on the SVG
 * link is what lets a browser that can use it skip the other.
 *
 * @type {readonly [Element, Element]}
 */
export const faviconLinks = [
    ['link', { rel: 'icon', href: '/favicon.ico', sizes: '32x32' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/fjs/website/favicon.svg' }],
]

/**
 * The stylesheet, verbatim.
 *
 * @type {string}
 */
export const stylesheet = `:root { color-scheme: light dark; --bg: white; --text: black; --muted: #5f6368; --border: #dadce0; --link: #137333; --pass: #137333; --pass-bg: #e6f4ea; --fail: #b3261e; --fail-bg: #fce8e6; --value: #174ea6; --value-bg: #e8f0fe }
@media (prefers-color-scheme: dark) {
    :root { --bg: #121212; --text: #f1f1f1; --muted: #9aa0a6; --border: #3c4043; --link: #81c995; --pass: #81c995; --pass-bg: #0f2417; --fail: #f28b82; --fail-bg: #2a1414; --value: #8ab4f8; --value-bg: #172033 }
}
/* Every link on the site is coloured the same whether or not it has been
   opened: nearly every word here is a link into the tree, and the visited
   distinction says only where this reader has been, not what a file holds.
   --link is its own token, not an alias for --pass, even though it starts at
   the same values — moving one later must not drag the other with it. */
a, a:visited { color: var(--link) }
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
button, input, textarea, pre { font: inherit }
pre { white-space: pre-wrap }
/* A textarea's own baseline sits at its bottom edge, so a label before a
   multi-line field — the JSON demo's, the first of its kind — floated to the
   bottom of the box beside it rather than the top. A single-line input has
   no such seam: its one line of text already sits on the label's baseline. */
textarea { vertical-align: top }
/* A browser's own default width for a textarea is about twenty characters —
   a sliver of the page's column, for a field meant to hold a document.
   box-sizing keeps the 100% to the content width regardless of the border
   and padding a browser gives a textarea by default, so it does not overflow
   its own line. Resizable in height only: width has one right answer here,
   the column, so there is nothing to drag it away from — a browser's own
   resize otherwise sets an inline size the next render does not carry
   (nothing here re-renders a resize into what it drew, the same way it
   redraws focus and the caret), and a field a reader just widened would
   silently narrow back on the next keystroke. */
textarea { box-sizing: border-box; resize: vertical; width: 100% }
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
/* The summary holds the section's h2, so a screen reader lists every section
   among the page's headings. The h2 is inline and takes the summary's own
   size and weight: a block heading would push the disclosure triangle onto a
   line of its own, and a browser's h2 size and margins would make the title
   bigger than it has always been. */
[data-section] > summary > h2 { display: inline; font: inherit; margin: 0 }
[data-section] > ul { margin-top: .5rem }
/* A list of links, one per line — a section's catalogue, the release index —
   is marked data-links, and has nothing under WCAG 2.2's 24px minimum to tap:
   at d05b70ce, rendered at 390px, a listed link was 19px tall. The marker is
   what the rule matches rather than where the list sits, so a page that lists
   links outside a section, as the changelog does, is not left dense by
   accident. any-pointer, not pointer: a touch-screen laptop's primary pointer
   is its trackpad, which pointer: coarse would read as fine and leave the list
   untouched for the screen's own finger. A desktop with no coarse pointer at
   all keeps the dense list. */
@media (any-pointer: coarse) {
    [data-links] a { display: inline-block; padding-block: .25rem }
}
/* SVG text does not inherit the page's font on its own, unlike every
   ordinary element — the DataJS demo's graph is the first thing on the site
   to draw one. */
svg text { font: inherit }
/* A demo's graph: a rect per node, a line per index, key or operand role.
   Three looks, for the three things a node can be. A container or an
   operator is hollow — it is computed from what the edges below it reach.
   A leaf is dashed: a constant, reaching nothing because there is nothing
   to reach. A terminal is filled: it reaches nothing either, but for the
   opposite reason — a value arrives there from outside the scope, as the
   EDAG demo's args and frame do, and drawing it dashed would file an
   input with the constants. Two looks were enough while the DataJS demo
   was the only reader and a leaf and a container were the whole world.
   An edge that a demo marks draws dashed: the EDAG demo marks an operand
   its node may never evaluate, and a solid line there would say the value
   is always wanted. A node is drawn once however many edges reach it, so
   the marking has to be on the line rather than on the box.
   A node with outgoing edges carries a row of ports under its label, one
   cell per edge holding that edge's label, and the edge leaves from the
   bottom of its cell — so a label always sits in the box it names rather
   than over a line. A port is a thinner, unfilled cell inside the node's
   own border. A primitive — a number, null, undefined — is no node of its
   own: its value draws in a cell of the port that holds it, under the
   port's label, and no line leaves for it. A value is tinted and a key is
   grey, so the two differ by more than their order in the cell; in a node
   with a value row every port is split the same way, and an edge's lower
   cell is the empty socket it leaves from. No edge crosses a box — the layout routes one that skips a
   rank down a lane of its own — so a line needs no casing to stand out
   from a border it passes. */
[data-graph-node] { fill: var(--bg); stroke: var(--text); stroke-width: 1.5 }
[data-graph-kind="leaf"] { stroke: var(--muted); stroke-dasharray: 3 2 }
[data-graph-kind="terminal"] { fill: var(--border) }
[data-graph-label] { dominant-baseline: middle; fill: var(--text); font-size: .75rem }
[data-graph-edge] { fill: none; stroke: var(--muted); stroke-width: 1.5 }
[data-graph-edge-kind="lazy"] { stroke-dasharray: 5 3 }
[data-graph-port] { fill: none; stroke: var(--muted); stroke-width: 1 }
[data-graph-socket] { fill: none; stroke: var(--muted); stroke-width: 1 }
[data-graph-value] { fill: var(--value-bg); stroke: var(--muted); stroke-width: 1 }
[data-graph-value-label] { dominant-baseline: middle; fill: var(--value); font-size: .75rem }
[data-graph-edge-label] { dominant-baseline: middle; fill: var(--muted); font-size: .7rem }
[data-graph-arrow] { fill: var(--muted) }
`
