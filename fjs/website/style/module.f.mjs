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
 * The site's mark, as the root-relative URL both the favicon and the header
 * load it by — one file, so the tab and the page cannot show two logos.
 *
 * @type {string}
 */
export const logoPath = '/fjs/website/favicon.svg'

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
    ['link', { rel: 'icon', type: 'image/svg+xml', href: logoPath }],
]

/**
 * The stylesheet, verbatim.
 *
 * @type {string}
 */
export const stylesheet = `:root { color-scheme: light dark; --graph-new-bg: #aecbfa; --bg: white; --text: black; --muted: #5f6368; --border: #dadce0; --link: #137333; --pass: #137333; --pass-bg: #e6f4ea; --fail: #b3261e; --fail-bg: #fce8e6; --value: #174ea6; --value-bg: #e8f0fe }
@media (prefers-color-scheme: dark) {
    :root { --graph-new-bg: #1c2d4d; --bg: #121212; --text: #f1f1f1; --muted: #9aa0a6; --border: #3c4043; --link: #81c995; --pass: #81c995; --pass-bg: #0f2417; --fail: #f28b82; --fail-bg: #2a1414; --value: #8ab4f8; --value-bg: #172033 }
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
body { background-color: var(--bg); color: var(--text); font: 16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; margin: 0; overflow-wrap: anywhere }
/* The column is the page's, not the body's, so the header above it can span
   the whole window. 63.25rem is GitHub's container-lg, 1012px at 16px — the
   column GitHub reads a rendered Markdown file in — so a page here is as wide
   as the same directory's view on GitHub. It is in rem, like every other
   length here, so it grows with a reader's own font size. */
main { margin: 1.5rem auto 3rem; max-width: 63.25rem; padding: 0 1rem }
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

   The selector names elements one by one, so it covers only what it names.
   It names every element a browser gives a face of its own, not only the ones
   the site uses: a demo's field is an input, and it was Arial the moment the
   first demo landed; a select, missing here, was Arial when the first examples
   drop-down landed. Those are the four form controls — button, input, select,
   textarea, with an option or optgroup taking its select's font — plus pre.
   Every other form element — output, fieldset, legend, meter, progress —
   already inherits the page's font, as a label does. An element a browser
   starts giving its own face has to be added here. */
button, input, select, textarea, pre { font: inherit }
pre { white-space: pre-wrap }
/* A button draws its own frame rather than the platform's. Safari keeps its
   native push button only at the small size it was drawn for: at the page's
   16px it falls back to a flat face with no edge, so Measure read as a word
   beside the field rather than a control — while Chrome still drew a button.
   Any background or border drops the native look in every browser, so the
   site sets both and all of them draw the same thing, in both schemes.
   Dropping the native look drops its disabled look too, so the site draws
   that as well: a demo disables its buttons while a command runs, and one
   that still looked and hovered like a live control would invite the click
   it ignores. */
button { background: color-mix(in srgb, var(--border) 40%, var(--bg)); border: 1px solid var(--muted); border-radius: .25rem; color: var(--text); cursor: pointer; padding: .125rem .75rem }
button:hover:enabled { background: var(--border) }
button:disabled { background: var(--bg); border-color: var(--border); color: var(--muted); cursor: default }
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
/* The header every page opens with: the logo and the site's name on the left,
   the site-wide links on the right, across the full width of the window with
   one rule under it, as a site's own bar. Its contents go to the window's
   edges, not the page's column: the bar belongs to the site, and the column
   to the page under it. The menu is bold and a step larger than the text, as a
   site's own navigation is set apart from what it navigates.
   It wraps rather than hiding behind a menu button: in a monospace face a
   phone has no room for the name and the links on one line, and a line break
   costs no script.
   A header link is not underlined: its place in the header is what says it is
   a link, as a site's own navigation does everywhere, and the underline comes
   back on hover. Every link in the header is padded to a finger's target,
   whatever the pointer: it is one row, not a dense list, so the padding
   costs nothing a mouse would miss. */
header { border-bottom: 1px solid var(--border) }
header nav, [data-build] { padding-inline: 1rem }
header nav, [data-site-links] { align-items: center; display: flex; flex-wrap: wrap; gap: .25rem 1.5rem }
header nav { font-size: 1.125rem; font-weight: 700; padding-block: .5rem }
header nav a { padding-block: .25rem; text-decoration: none }
header nav a:hover { text-decoration: underline }
[data-home] { align-items: center; display: inline-flex; gap: .5rem; margin-right: auto }
[data-home] img { height: 1.5rem; width: 1.5rem }
/* A preview says which build it is — the branch and the commit — so a
   reader comparing two previews, or a preview with production, knows which
   one they are looking at. Muted and small: it is about the build, not the
   page. It is a full-width strip under the menu, tinted from the border and
   the background rather than a colour of its own, so it follows both
   schemes, and set to the right, under the links, as a status bar is. */
[data-build] { background: color-mix(in srgb, var(--border) 30%, var(--bg)); border-top: 1px solid var(--border); color: var(--muted); font-size: .8rem; margin: 0; padding-block: .35rem; text-align: right }
/* The funding footer closes every page: one muted, centred line under a rule,
   spanning the window as the header does, so it reads as the site's own bar
   rather than the last line of the page. Its links keep the page's colour and
   underline, because unlike the header's they sit in a sentence.
   A link never breaks inside itself: on a phone "GitHub Sponsors" split
   across two lines read as two links, so the line breaks between links,
   never within one. */
footer[data-funding] { border-top: 1px solid var(--border); color: var(--muted); font-size: .875rem; padding: 1rem; text-align: center }
footer[data-funding] a { white-space: nowrap }
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
/* A directory's catalogue lists three kinds of entry — directory and file
   under Contents, issue under Issues — and each entry's kind is the icon in
   front of it, where a list's bullet would be. The icon is a mask over the muted colour, so it
   follows the colour scheme like the text does. It is not decoration: an
   issue and a file can have the same name, so the icon carries a text
   alternative after the slash. The kind is on the link rather than its list
   item, so the alternative is part of the link's accessible name: a reader
   going through the page's links hears "file a.md" and "issue a.md", not the
   same name twice. The plain content before it is for a browser without that
   syntax, which drops the whole declaration and would otherwise draw no icon
   at all. */
ul:has(> li > [data-kind]) { padding-left: 0 }
li:has(> [data-kind]) { list-style: none }
[data-kind]::before { background-color: var(--muted); content: ""; display: inline-block; height: 1em; margin-right: .5em; mask: var(--icon) center / contain no-repeat; vertical-align: -.125em; width: 1em }
[data-kind="dir"] { --icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M1 3.5A1.5 1.5 0 0 1 2.5 2h3.6l1.5 1.5h5.9A1.5 1.5 0 0 1 15 5v7.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5z'/%3E%3C/svg%3E") }
[data-kind="dir"]::before { content: "" / "directory" }
[data-kind="file"] { --icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M3 1h6.5L13 4.5V15H3zM4.5 2.5v11h7v-8h-3v-3z'/%3E%3C/svg%3E") }
[data-kind="file"]::before { content: "" / "file" }
[data-kind="issue"] { --icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zM8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'/%3E%3C/svg%3E") }
[data-kind="issue"]::before { content: "" / "issue" }
/* A directory with a demo anywhere under it carries a play mark after its
   name, so the marks are a trail from any page down to every demo below it.
   After the name rather than before: the icon in front is what the entry is,
   and this is something about it. It is drawn like the kind icons, a mask over
   the muted colour at the same size, so the list keeps one set of marks; it
   says "has a demo" to a screen reader. */
[data-has-demo]::after { background-color: var(--muted); content: ""; display: inline-block; height: 1em; margin-left: .5em; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zM6 4.25v7.5l5.75-3.75z'/%3E%3C/svg%3E") center / contain no-repeat; vertical-align: -.125em; width: 1em }
[data-has-demo]::after { content: "" / "has a demo" }
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
   A node with outgoing edges carries a row per port under its label, one
   per edge holding that edge's label, and the edge leaves from the right
   end of its row — so a label always sits in the box it names rather than
   over a line. A port is a thinner, unfilled cell inside the node's own
   border, clipped to its rounded corners, with the border drawn once more
   over the cells so it stays one weight all round. A primitive — a
   number, null, undefined — is no node of its own: its value draws in a
   cell right of its key, and no line leaves for it. A value is tinted and
   a key is grey, so the two differ by more than their order in the row.
   An inline input — the EDAG demo's args and rest — is filled like the
   terminal node it would otherwise be, not tinted like a constant. An
   edge's key fills its whole row, so no cell is left empty. No edge
   crosses a box — the layout routes one that skips a rank across a lane
   of its own — so a line needs no casing to stand out from a border it
   passes.
   A graph is not text, so the page's reading width does not bind it: its
   container is as wide as the drawing, never narrower than the text column
   and never wider than the window, and centred on the page. Only a graph
   wider than the window scrolls, sideways in its own container, so the page
   around it stays still. The 3rem kept from the window's width leaves a
   margin either side, and room for a vertical scroll bar, which 100vw
   counts. */
[data-graph] { overflow-x: auto; width: max-content; min-width: 100%; max-width: calc(100vw - 3rem); position: relative; left: 50%; transform: translateX(-50%) }
[data-graph] > svg { display: block }
[data-graph-node] { fill: var(--bg); stroke: var(--text); stroke-width: 1.5 }
[data-graph-outline] { fill: none; stroke: var(--text); stroke-width: 1.5 }
[data-graph-kind="leaf"] { stroke: var(--muted); stroke-dasharray: 3 2 }
[data-graph-kind="terminal"] { fill: var(--border) }
/* The versions demos: a node the step built is new, and one the version
   before it holds too is plain. Blue, not green: a new node is not a
   passed test, so it is not --pass-bg. */
[data-graph-kind="new"] { fill: var(--graph-new-bg) }
[data-graph-label] { dominant-baseline: middle; fill: var(--text); font-size: .75rem }
[data-graph-edge] { fill: none; stroke: var(--muted); stroke-width: 1.5 }
[data-graph-edge-kind="lazy"] { stroke-dasharray: 5 3 }
[data-graph-port] { fill: none; stroke: var(--muted); stroke-width: 1 }
[data-graph-value] { fill: var(--value-bg); stroke: var(--muted); stroke-width: 1 }
[data-graph-value-alone] { fill: none }
/* A value drawn in parts: a prefix's inherited bits muted, its own bits
   strong. */
[data-graph-part="prior"] { fill: var(--muted) }
[data-graph-part="current"] { font-weight: bold }
[data-graph-value-label] { dominant-baseline: middle; fill: var(--value); font-size: .75rem }
[data-graph-value][data-graph-value-kind="terminal"] { fill: var(--border) }
[data-graph-value-label][data-graph-value-kind="terminal"] { fill: var(--text) }
[data-graph-edge-label] { dominant-baseline: middle; fill: var(--muted); font-size: .7rem }
[data-graph-arrow] { fill: var(--muted) }
/* A syntax diagram: a track, the pills of the text an input holds and the
   boxes of other diagrams. A terminal is tinted as a value is in a graph,
   since both are what the input itself spells; a box is hollow, since it
   stands for a diagram drawn elsewhere, and it is a link there, so it fills
   under a pointer. A diagram scrolls sideways in its own container, as a
   graph does. */
[data-railroad] { overflow-x: auto }
[data-railroad] > svg { display: block }
[data-railroad-line] { fill: none; stroke: var(--text); stroke-width: 1.5 }
[data-railroad-box="terminal"] { fill: var(--value-bg); stroke: var(--value); stroke-width: 1.5 }
[data-railroad-box="nonTerminal"] { fill: var(--bg); stroke: var(--text); stroke-width: 1.5 }
a:hover > [data-railroad-box="nonTerminal"] { fill: var(--pass-bg) }
[data-railroad-label] { dominant-baseline: middle; font-size: .75rem }
[data-railroad-label="terminal"] { fill: var(--value) }
[data-railroad-label="nonTerminal"] { fill: var(--text); font-weight: 700 }
/* A codec's bit groups: a box per group, its bits over the character the
   codec wrote for it, shaded. The borders are what pair a character with its
   bits — in one monospace face the two are otherwise the same kind of text —
   and neighbouring boxes share a border, so a line of them reads as one strip.
   The boxes wrap to the page's width. A codec with blocks puts its boxes in
   blocks, which wrap as units with a gap between them, so a line breaks only
   between whole blocks; a block wider than a very narrow screen wraps inside
   itself rather than scrolling the page sideways, and its lines touch so it
   still reads as one. A short last block is padded to a full one with
   placeholder boxes, hidden but holding their place, so it wraps where a full
   block would. Fill bits are muted and dotted under, as they carry no
   data; a stop bit is in the colour of a value and bold but not underlined,
   since an underline on this site is a link. */
[data-bit-groups] { display: flex; flex-wrap: wrap; margin-block: .5rem; padding-left: 1px; row-gap: .5rem }
[data-bit-blocks] { column-gap: .75rem }
[data-bit-block] { display: flex; flex-wrap: wrap; max-width: 100%; padding: 1px 0 0 1px }
[data-bit-block] > [data-bit-box] { margin-top: -1px }
[data-bit-placeholder] { visibility: hidden }
[data-bit-box] { border: 1px solid var(--border); display: flex; flex-direction: column; margin-left: -1px; text-align: center }
[data-bit-box] > span { padding: .2rem .3rem }
[data-bit-char] { background: color-mix(in srgb, var(--border) 45%, var(--bg)); border-top: 1px solid var(--border); font-weight: 700 }
/* A text's characters over their UTF-8 bytes, in the same boxes: a character
   is a unit that wraps whole, its bytes side by side over its label, shaded
   and spanning them. A stand-in for a character a reader could not see is
   muted, as it names the character rather than showing it. */
[data-byte-chars] { column-gap: .75rem; display: flex; flex-wrap: wrap; margin-block: .5rem; padding-left: 1px; row-gap: .5rem }
[data-byte-char] { display: flex; flex-direction: column; max-width: 100%; padding-left: 1px }
[data-byte-row] { display: flex; flex-wrap: wrap }
[data-byte] { border: 1px solid var(--border); margin-left: -1px; padding: .2rem .3rem }
[data-byte-label] { background: color-mix(in srgb, var(--border) 45%, var(--bg)); border: 1px solid var(--border); border-top: 0; font-weight: 700; margin-left: -1px; padding: .2rem .3rem; text-align: center }
[data-stand-in] { color: var(--muted) }
[data-bit="fill"] { color: var(--muted); text-decoration: underline dotted }
[data-bit="stop"] { color: var(--value); font-weight: 700 }
/* A code block — a demo's source, such as the rtti demo's schema — is a
   shaded, bordered box, so code reads apart from the prose around it. A
   reader's answer in the rtti demo is the same box, tinted green for a
   success and red for a failure, so the verdict reads before the value does.
   A line can be one long DataJS document, so it wraps rather than widening
   the page. */
[data-code], [data-result] { border: 1px solid var(--border); border-radius: 6px; overflow-wrap: anywhere; padding: .5rem .75rem; white-space: pre-wrap }
[data-code] { background: color-mix(in srgb, var(--border) 30%, var(--bg)) }
[data-code-block] { position: relative; margin-block: 1em; padding-right: 3rem }
[data-code-block] > pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere }
[data-code-block] > button { position: absolute; top: .25rem; right: .25rem; display: inline-flex; align-items: center; justify-content: center; width: 1.5rem; height: 1.5rem; padding: .125rem; border: 0; border-radius: .25rem; background: transparent; color: var(--muted) }
[data-code-block] > button:hover:enabled { background: transparent; color: var(--text) }
[data-code-block] > button:focus-visible { outline: 2px solid var(--value); outline-offset: 2px }
[data-code-block] > button > svg { width: 20px; height: 20px }
[data-copy-status] { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap }
[data-code-block] > button > [data-copy-check] { display: none }
[data-code-block] > button[data-copied], [data-code-block] > button[data-copied]:hover:enabled { color: var(--pass) }
[data-code-block] > button[data-copied] > svg { display: none }
[data-code-block] > button[data-copied] > [data-copy-check] { display: block }
[data-copied] > [data-copy-status] { right: -3px; bottom: calc(100% + 8px); width: auto; height: auto; overflow: visible; clip-path: none; padding: 5px 9px; background: black; color: white; border-radius: 5px; font-size: 12px; font-weight: 500; box-shadow: 0 2px 6px #00000018; pointer-events: none }
[data-copied] > [data-copy-status]::after { content: ''; position: absolute; top: 100%; right: 10px; border: 5px solid transparent; border-top-color: black }
@media (prefers-color-scheme: dark) {
    [data-copied] > [data-copy-status] { background: #e8eaed; color: #202124 }
    [data-copied] > [data-copy-status]::after { border-top-color: #e8eaed }
}
[data-result="ok"] { background: var(--pass-bg); border-color: color-mix(in srgb, var(--pass) 40%, transparent); color: var(--pass) }
[data-result="error"] { background: var(--fail-bg); border-color: color-mix(in srgb, var(--fail) 40%, transparent); color: var(--fail) }
/* A choice between code blocks — the rtti demo's pair of schemas — shows
   every block, one above another, each a button with a radio dot. The one
   picked is outlined and tinted in the value colour with its dot filled; the
   other recedes, muted, until it is hovered. */
[data-pick] { display: flex; flex-direction: column; gap: .5rem; margin-block: 1rem }
[data-pick] > button, [data-pick] > button:hover:enabled { align-items: flex-start; background: color-mix(in srgb, var(--border) 30%, var(--bg)); border: 1px solid var(--border); border-radius: 6px; color: var(--muted); display: flex; gap: .65rem; padding: .5rem .75rem; text-align: left; width: 100% }
[data-pick] > button:hover:enabled { border-color: var(--muted); color: var(--text) }
[data-pick] > button[aria-pressed="true"], [data-pick] > button[aria-pressed="true"]:hover:enabled { background: var(--value-bg); border-color: var(--value); box-shadow: inset 0 0 0 1px var(--value); color: var(--text) }
[data-pick-dot] { border: 2px solid var(--muted); border-radius: 50%; flex: none; height: .95rem; margin-top: .2rem; width: .95rem }
[aria-pressed="true"] > [data-pick-dot] { background: var(--value); border-color: var(--value); box-shadow: inset 0 0 0 2px var(--value-bg) }
[data-pick-code] { min-width: 0; overflow-wrap: anywhere; white-space: pre-wrap }
`
