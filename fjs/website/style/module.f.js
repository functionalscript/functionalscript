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
 * @import { BoxKind } from '../demo/railroad/types.ts'
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
 * The attribute that marks a demo's root and names its module: the page
 * writes it, the runtime starts the demo it finds by it, and the
 * stylesheet's label-and-caption rule selects the demo's labels under it.
 *
 * One name for all of them, as with `captionMarker` below, so renaming it
 * renames every reader and writer at once, and no rule is left selecting a
 * root no page writes any more.
 *
 * @type {string}
 */
export const demoMarker = 'data-demo'

/**
 * The attribute that marks a demo's caption, bold under the stylesheet's
 * label-and-caption rule.
 *
 * One name for the markup and the rule: the demo's `caption` writes it and
 * the stylesheet selects it, so renaming it renames both, and the two
 * cannot drift apart into a caption the rule no longer reaches.
 *
 * @type {string}
 */
export const captionMarker = 'data-caption'

/** The attribute shared by neutral output boxes and their stylesheet rules.
 * @type {string}
 */
export const codeMarker = 'data-code'

/** The attribute of a highlighted field's wrapper, shared with its stylesheet rules.
 * @type {string}
 */
export const editorMarker = 'data-editor'

/** The attribute of the coloured copy of a highlighted field's text. The page
 * runtime keeps its scroll offset equal to the textarea's.
 * @type {string}
 */
export const mirrorMarker = 'data-mirror'

/** The verdict attribute shared by result views and their stylesheet rules.
 * @type {string}
 */
export const resultMarker = 'data-result'

/** The attribute of a verdict word inside a caption — `ok` or `error` —
 * coloured as the result block under it is tinted.
 * @type {string}
 */
export const verdictMarker = 'data-verdict'

/** The attribute shared by a long listing in a code box, such as a WASM
 * module's WAT, and the rule that caps its height and scrolls it.
 * @type {string}
 */
export const listingMarker = 'data-listing'

/** The attribute of the banner a refused construct's spec page opens its
 * demo with: the compiler refuses the sample, by design.
 */
export const refusedMarker = 'data-refused'

/** The attribute of the banner the undecided constructs' page opens its
 * demo with: the compiler refuses each, and no decision says it should.
 */
export const undecidedMarker = 'data-undecided'

/** The attribute of the banner an admitted feature's spec page opens its
 * demo with: the compiler accepts the example, and runs it both ways.
 */
export const admittedMarker = 'data-admitted'

/** The attribute of a register row's card, one construct with its sample
 * and what the compiler prints for it.
 */
export const registerRowMarker = 'data-register-row'

/** The attribute shared by the PoW verdict row and its layout rules.
 * @type {string}
 */
export const powResultMarker = 'data-pow-result'

/** The ECDSA card attribute shared by the demo and stylesheet.
 * @type {string}
 */
export const signCardMarker = 'data-sign-card'

/** The ECDSA explanation attribute shared by the demo and stylesheet.
 * @type {string}
 */
export const signExplanationMarker = 'data-sign-explanation'

/** The ECDSA flow attribute shared by the demo and stylesheet.
 * @type {string}
 */
export const signFlowMarker = 'data-sign-flow'

/** The ECDSA packet attribute shared by the demo and stylesheet.
 * @type {string}
 */
export const signPacketMarker = 'data-sign-packet'

/** The ECDSA role attribute shared by the demo and stylesheet.
 * @type {string}
 */
export const signRoleMarker = 'data-sign-role'

/** The ECDSA scheme attribute shared by the demo and stylesheet.
 * @type {string}
 */
export const signSchemeMarker = 'data-sign-scheme'

/** The ECDSA stage attribute shared by the demo and stylesheet.
 * @type {string}
 */
export const signStageMarker = 'data-sign-stage'

/** The ECDSA stage header attribute shared by the demo and stylesheet.
 * @type {string}
 */
export const signStageHeaderMarker = 'data-sign-stage-header'

/** The ECDSA trust attribute shared by the demo and stylesheet.
 * @type {string}
 */
export const signTrustMarker = 'data-sign-trust'

/** The ECDSA trust key attribute shared by the demo and stylesheet.
 * @type {string}
 */
export const signTrustKeyMarker = 'data-sign-trust-key'

/** The ECDSA trust path attribute shared by the demo and stylesheet.
 * @type {string}
 */
export const signTrustPathMarker = 'data-sign-trust-path'

/** The ECDSA verifier attribute shared by the demo and stylesheet.
 * @type {string}
 */
export const signVerifierMarker = 'data-sign-verifier'

/**
 * The attribute a railroad diagram marks each box with, valued by the
 * piece's kind: `fjs/website/demo/railroad` writes it and the stylesheet
 * selects it, so the two cannot drift apart.
 *
 * @type {string}
 */
export const railroadBoxMarker = 'data-railroad-box'

/**
 * The attribute a railroad diagram marks each box's label with, valued by
 * the piece's kind, shared as {@link railroadBoxMarker} is.
 *
 * @type {string}
 */
export const railroadLabelMarker = 'data-railroad-label'

/**
 * The selector of one kind's boxes. The kind is typed, so a rule for a kind
 * no diagram draws — a misspelt `categoryy` — is a type error rather than
 * a rule that silently selects nothing.
 *
 * @type {(kind: BoxKind) => string}
 */
const railroadBox = kind => `[${railroadBoxMarker}="${kind}"]`

/**
 * The selector of one kind's labels, typed as {@link railroadBox} is.
 *
 * @type {(kind: BoxKind) => string}
 */
const railroadLabel = kind => `[${railroadLabelMarker}="${kind}"]`

/**
 * The colour tokens of the light scheme, and of the dark one.
 *
 * Named because two stylesheets declare them: {@link stylesheet} on every
 * page, and {@link rustdocStylesheet} on rustdoc's.
 */
const lightTokens = '--graph-new-bg: #aecbfa; --graph-added-bg: #a8dab5; --graph-removed-bg: #f6aea9; --bg: white; --text: black; --muted: #5f6368; --border: #dadce0; --link: #137333; --pass: #137333; --pass-bg: #e6f4ea; --fail: #b3261e; --fail-bg: #fce8e6; --value: #174ea6; --value-bg: #e8f0fe; --syntax-number: #8430ce; --syntax-name: #8a4b00'
const darkTokens = '--graph-new-bg: #1c2d4d; --graph-added-bg: #1c3d27; --graph-removed-bg: #4d1c1c; --bg: #121212; --text: #f1f1f1; --muted: #9aa0a6; --border: #3c4043; --link: #81c995; --pass: #81c995; --pass-bg: #0f2417; --fail: #f28b82; --fail-bg: #2a1414; --value: #8ab4f8; --value-bg: #172033; --syntax-number: #c58af9; --syntax-name: #f0a868'

/**
 * The rules for the site's two bars, the header and the funding footer,
 * shared with {@link rustdocStylesheet} so rustdoc's pages carry the same
 * bars as every other page.
 */
const bars = `/* The header every page opens with: the logo and the site's name on the left,
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
`

/**
 * The stylesheet, verbatim.
 *
 * @type {string}
 */
export const stylesheet = `:root { color-scheme: light dark; ${lightTokens} }
@media (prefers-color-scheme: dark) {
    :root { ${darkTokens} }
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
/* Keep the catalogue in a fixed left column and let desktop content fill
   the remaining width. The divider spans the content, independently of
   the sticky catalogue's height. Mobile navigation opens a drawer. */
[data-directory-layout] { display: grid; grid-template-columns: 16rem minmax(0, 1fr); gap: 1.5rem; padding-inline: 1rem }
[data-directory-layout]::before { content: ""; grid-column: 1; grid-row: 1; border-right: 1px solid var(--border); margin-block: 1.5rem 3rem; pointer-events: none }
[data-directory-layout] > main { grid-column: 2; grid-row: 1; margin: 1.5rem 0 3rem; max-width: none; min-width: 0; padding: 0 }
[data-catalogue] { grid-column: 1; grid-row: 1; align-self: start; margin-top: 1.5rem; max-height: calc(100dvh - 3rem); overflow: auto; padding-right: 1rem; position: sticky; top: 1.5rem }
[data-catalogue] > [data-section]:first-child { margin-top: 0 }
[data-catalogue] > [data-section]:last-child { margin-bottom: 0 }
[data-catalogue] li { margin-block: .4rem }
[data-catalogue] a { font-size: .875rem }
@media (max-width: 48rem) {
    [data-directory-layout] { display: block }
    [data-directory-layout]::before { display: none }
    [data-catalogue] { border-right: 0; border-bottom: 1px solid var(--border); max-height: none; padding: 0 0 1rem; position: static }
}
[data-directory-navigation], [data-drawer] { display: none }
@media (max-width: 48rem) {
    [data-drawer-ready] > [data-catalogue] { display: none }
    [data-directory-navigation] { display: flex; margin-bottom: 1rem; border: 1px solid var(--border); border-radius: 6px; overflow: hidden }
    [data-directory-navigation] button { flex: 1; font: inherit; font-size: .875rem; min-height: 44px; padding: .65rem 1rem; background: var(--bg); color: var(--link); border: 0; cursor: pointer }
    [data-directory-navigation] button + button { border-left: 1px solid var(--border) }
    [data-directory-navigation] button:disabled { color: var(--muted); background: color-mix(in srgb, var(--border) 15%, var(--bg)); cursor: default }
    [data-directory-navigation] button:not(:disabled):hover { background: color-mix(in srgb, var(--border) 30%, var(--bg)) }
    [data-directory-navigation] button:focus-visible { outline: 2px solid var(--link); outline-offset: -3px }
    [data-drawer][open] { display: block; position: fixed; inset: 0 auto 0 0; margin: 0; box-sizing: border-box; width: min(86vw, 22rem); height: 100dvh; max-height: 100dvh; max-width: none; border: 0; border-right: 1px solid var(--border); padding: 1rem; background: var(--bg); color: var(--text); overflow: auto }
    [data-drawer]::backdrop { background: rgb(0 0 0 / .42) }
    [data-drawer-top] { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-bottom: .5rem }
    [data-drawer-top] h2 { margin: 0; font-size: 1.125rem }
    [data-drawer-top] button { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; min-height: 44px; min-width: 44px; font-size: 1.4rem; cursor: pointer }
    [data-drawer-path] { color: var(--muted); font-size: .875rem; margin: 0 0 1.5rem }
    [data-drawer] [data-catalogue] { border: 0; margin: 0; padding: 0 }
    [data-drawer] [data-section] a { display: inline-block; padding-block: .35rem }
    html:has([data-drawer][open]) { overflow: hidden }
}
[data-catalogue]:empty { display: none }
[data-directory-layout]:has(> [data-catalogue]:empty) { display: block }
[data-directory-layout]:has(> [data-catalogue]:empty)::before { display: none }
[data-directory-layout]:has(> [data-catalogue]:empty) > main { margin-inline: auto; max-width: 63.25rem }
/* The PR queue keeps the site's three-column table readable on a phone;
   status uses words as well as colour. */
[data-prs] table { border-collapse: collapse; margin-block: 1rem; table-layout: fixed; width: 100% }
[data-prs] caption { margin-bottom: .75rem; text-align: left }
[data-prs] th, [data-prs] td { border-bottom: 1px solid var(--border); padding: .65rem .5rem; text-align: left; vertical-align: top }
[data-prs] th:first-child, [data-prs] td:first-child { padding-left: 0; width: 20% }
[data-prs] th:last-child, [data-prs] td:last-child { padding-right: 0; width: 45% }
[data-pr-check="Passing"] { color: var(--pass) }
[data-pr-check="Failing"], [data-pr-check="Unavailable"] { color: var(--fail) }
[data-pr-check="Loading"], [data-pr-check="No checks"], [data-pr-check="Unknown"] { color: var(--muted) }
[data-prs][aria-busy="true"] [data-pr-note] { color: var(--muted) }
[data-prs][data-pr-stale] [data-pr-note] { color: var(--fail) }
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
/* Single-line text fields fill the column, with padding inside their width. */
input[type="text"] { box-sizing: border-box; width: 100% }
/* A demo's labels and captions are bold at the text's own size, so a reader
   scanning the page tells the controls and each result's name from the prose
   around them without a heading's weight. The lead and notes stay regular.
   demo/README.md states the rule. */
[${demoMarker}] label, [${captionMarker}] { font-weight: bold }
/* The compact target field and its difficulty examples share one column;
   right-aligned attempt counts make the four targets easy to compare. */
[data-pow-search-effort] { border-collapse: collapse; width: 100% }
[data-pow-search-effort] th { border-bottom: 1px solid var(--border); color: var(--muted); font-size: .875rem; font-weight: normal; padding: 0 0 .75rem; text-align: left }
[data-pow-search-effort] td { border-bottom: 1px solid var(--border); padding: .75rem 0 }
[data-pow-search-effort] tr:last-child td { border-bottom: 0 }
[data-pow-search-effort] th:last-child, [data-pow-search-effort] td:last-child { text-align: right }
/* Difficulty guidance is optional context, collapsed until requested.
   Its ordinary-weight title, row labels and notes keep it quieter than results. */
[data-pow-effort] { margin: 1rem 0 }
[data-pow-effort] > summary { cursor: pointer; font-weight: normal }
[data-pow-effort][open] > summary { margin-bottom: .75rem }
[data-pow-effort-label] { color: var(--muted); display: inline-block; font-size: .75rem; margin-left: .75rem }
[data-pow-effort-note] { color: var(--muted); font-size: .875rem }
/* The verdict takes the shared data-result tint and border. Keep its icon
   beside the sentence when it wraps, with enough space to read as one result. */
[${powResultMarker}][${resultMarker}] { align-items: center; display: flex; gap: .625rem; line-height: 1.5; padding: .875rem 1rem; white-space: normal }
[${powResultMarker}] > svg { flex-shrink: 0; height: 1.25rem; width: 1.25rem }
/* Search progress supports the current verdict rather than competing with it;
   smaller muted text separates the attempt count and failed range from the result. */
[data-pow-search-summary] { color: var(--muted); font-size: .875rem; line-height: 1.6; margin-top: .75rem }
${bars}/* Every section of a page is a disclosure, so a reader can fold away what
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
/* An issue's icon is its status. Open keeps the issue icon above, and each
   other status draws its own over the same ring — a half-filled circle for
   work in progress, a bar for blocked, a pause for on hold, a check for done,
   a cross for won't fix — but irrelevant, the one status that no longer
   applies, which is the ring alone, dashed. Each spoken alternative names the
   status and the kind, so a link reads "blocked issue a.md". */
[data-kind="issue"][data-issue-status="open"]::before { content: "" / "open issue" }
[data-kind="issue"][data-issue-status="wip"] { --icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z'/%3E%3Cpath d='M8 4a4 4 0 0 0 0 8z'/%3E%3C/svg%3E") }
[data-kind="issue"][data-issue-status="wip"]::before { content: "" / "wip issue" }
[data-kind="issue"][data-issue-status="blocked"] { --icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z'/%3E%3Crect x='4.5' y='7.25' width='7' height='1.5' rx='.5'/%3E%3C/svg%3E") }
[data-kind="issue"][data-issue-status="blocked"]::before { content: "" / "blocked issue" }
[data-kind="issue"][data-issue-status="on-hold"] { --icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z'/%3E%3Crect x='5.5' y='5' width='1.5' height='6' rx='.5'/%3E%3Crect x='9' y='5' width='1.5' height='6' rx='.5'/%3E%3C/svg%3E") }
[data-kind="issue"][data-issue-status="on-hold"]::before { content: "" / "on-hold issue" }
[data-kind="issue"][data-issue-status="done"] { --icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z'/%3E%3Cpath fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' d='M5.25 8.25l1.9 1.9 3.6-3.9'/%3E%3C/svg%3E") }
[data-kind="issue"][data-issue-status="done"]::before { content: "" / "done issue" }
[data-kind="issue"][data-issue-status="irrelevant"] { --icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='6.25' fill='none' stroke='black' stroke-width='1.5' stroke-dasharray='2.45 2.45'/%3E%3C/svg%3E") }
[data-kind="issue"][data-issue-status="irrelevant"]::before { content: "" / "irrelevant issue" }
[data-kind="issue"][data-issue-status="won't fix"] { --icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z'/%3E%3Cpath fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' d='M5.75 5.75l4.5 4.5M10.25 5.75l-4.5 4.5'/%3E%3C/svg%3E") }
[data-kind="issue"][data-issue-status="won't fix"]::before { content: "" / "won't fix issue" }
/* An issue's priority is a badge before its link, the list's left column,
   and its emphasis falls with the priority rather than changing hue: P1 is
   filled in the failure colour, the conventional one for blocking; P2 in the
   value colour; P3 outlined; P4 plain muted text; P5 the same, fainter. A hue
   per level would say nothing about order and compete with the status icons. */
[data-priority] { border: 1px solid transparent; border-radius: 3px; color: var(--muted); display: inline-block; font-size: .75em; line-height: 1.3; padding: 0 .35em; white-space: nowrap }
[data-priority="P1"] { background-color: var(--fail-bg); color: var(--fail) }
[data-priority="P2"] { background-color: var(--value-bg); color: var(--value) }
[data-priority="P3"] { border-color: var(--border) }
[data-priority="P5"] { opacity: .6 }
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
   over the cells so it stays one weight all round. A node whose rows fall
   into parts — a chain's links — draws its label column as a cell per
   part, outlined as a port is. A primitive — a
   number, null, undefined — is no node of its own: its value draws in a
   cell right of its key, and no line leaves for it. A value is tinted and
   a key is grey, so the two differ by more than their order in the row.
   An inline input — the EDAG demo's args and rest — is filled like the
   terminal node it would otherwise be, not tinted like a constant. An
   edge's key fills its whole row, so no cell is left empty. No edge
   crosses a box — the layout routes one that skips a rank across a lane
   of its own — so a line needs no casing to stand out from a border it
   passes.
   A graph stays inside the column of the block that holds it, so it never
   spreads over the catalogue beside the page. A graph wider than its
   column scrolls, sideways in its own container, so the page around it
   stays still. */
[data-graph] { overflow-x: auto }
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
[data-graph-connection] { outline: none; cursor: pointer }
[data-graph-hit] { fill: none; stroke: transparent; stroke-width: 12; pointer-events: stroke }
[data-graph-trace] { opacity: 0; fill: none; stroke: var(--value); stroke-width: 3; pointer-events: none }
[data-graph-trace-arrow] { fill: var(--value) }
[data-graph-connection]:is(:hover, :focus) [data-graph-trace] { opacity: 1 }
[data-graph]:has([data-graph-connection]:is(:hover, :focus)) [data-graph-edge] { opacity: .25 }
[data-graph]:has([data-graph-connection]:hover) [data-graph-connection]:focus:not(:hover) [data-graph-trace] { opacity: 0 }
[data-graph-edge-kind="lazy"] { stroke-dasharray: 5 3 }
[data-graph-port], [data-graph-group] { fill: none; stroke: var(--muted); stroke-width: 1 }
[data-graph-value] { fill: var(--value-bg); stroke: var(--muted); stroke-width: 1 }
/* The versions demos draw a node's kind as its fill, so a value filling a
   row of one is left unfilled, or the tint would hide it. */
[data-graph-in-kind="new"] [data-graph-value-alone],
[data-graph-in-kind="shared"] [data-graph-value-alone],
[data-graph-in-kind="leaving"] [data-graph-value-alone] { fill: none }
/* A node fading in mid-move, before the move is done and its nodes turn
   blue, keeps its values' light tint: it reads as arriving, lighter than
   the blue a finished move draws. */
[data-graph-in-kind="entering"] [data-graph-value-alone] { fill: var(--value-bg) }
/* The B-tree game's moved key: red in the cell it is removed from, green in
   the one it is inserted into. */
[data-graph-value][data-graph-value-kind="removed"] { fill: var(--graph-removed-bg) }
[data-graph-value][data-graph-value-kind="added"] { fill: var(--graph-added-bg) }
/* A change node by node: a node with an order fades out if it is leaving
   and in otherwise — new, or entering, a node a step built that its demo
   draws plain — over 150 ms, 150 ms after the order before it.
   Only where the reader has not asked for less motion: then the drawing
   changes at once. The page updates its elements in place, and an
   animation runs again only when its name changes, so the drawing's
   container alternates data-graph-replay between "a" and "b", and each
   name has a twin. Orders 0 to 6 are timed: order 0 and one per rank of
   the deepest tree the B-tree game draws, 80 keys in at most six ranks. A
   higher order has no rule and no delay. */
@media (prefers-reduced-motion: no-preference) {
  [data-graph-order] { animation-duration: .15s; animation-fill-mode: both; animation-timing-function: ease }
  /* A keyed node that stays but moves slides to its new place, and a keyed
     edge's route with it, where the browser animates a path's d; where it
     does not, the route is redrawn at once. */
  [data-graph] [data-key] { transition: transform .15s ease, d .15s ease }
  /* A key about to be removed turns red, through order 0, before anything
     fades. */
  [data-graph-value-kind="removed"] { animation: graph-redden .15s ease both }
  [data-graph-replay="a"] [data-graph-order]:not([data-graph-in-kind="leaving"]) { animation-name: graph-in-a }
  [data-graph-replay="b"] [data-graph-order]:not([data-graph-in-kind="leaving"]) { animation-name: graph-in-b }
  [data-graph-replay="a"] [data-graph-in-kind="leaving"][data-graph-order] { animation-name: graph-out-a }
  [data-graph-replay="b"] [data-graph-in-kind="leaving"][data-graph-order] { animation-name: graph-out-b }
  [data-graph-order="1"] { animation-delay: .15s }
  [data-graph-order="2"] { animation-delay: .3s }
  [data-graph-order="3"] { animation-delay: .45s }
  [data-graph-order="4"] { animation-delay: .6s }
  [data-graph-order="5"] { animation-delay: .75s }
  [data-graph-order="6"] { animation-delay: .9s }
}
@keyframes graph-redden { from { fill-opacity: 0 } }
@keyframes graph-in-a { from { opacity: 0 } }
@keyframes graph-in-b { from { opacity: 0 } }
@keyframes graph-out-a { to { opacity: 0 } }
@keyframes graph-out-b { to { opacity: 0 } }
/* A row showing the node an edge leads to is part of the edge, not a
   value. */
[data-graph-value][data-graph-value-ref] { fill: none }
/* A value drawn in parts: a prefix's inherited bits muted, its own bits
   strong. */
[data-graph-part="prior"] { fill: var(--muted) }
[data-graph-part="current"] { font-weight: bold }
[data-graph-value-label] { dominant-baseline: middle; fill: var(--value); font-size: .75rem }
[data-graph-value-label][data-graph-value-ref] { fill: var(--muted); font-style: italic }
[data-graph-value][data-graph-value-kind="terminal"] { fill: var(--border) }
[data-graph-value-label][data-graph-value-kind="terminal"] { fill: var(--text) }
[data-graph-edge-label] { dominant-baseline: middle; fill: var(--muted); font-size: .7rem }
[data-graph-arrow] { fill: var(--muted) }
/* A syntax diagram: a track, the pills of the text an input holds and the
   boxes of other diagrams. A terminal is tinted as a value is in a graph,
   since both are what the input itself spells; a category is grey and set
   in italics, since it is any text of its kind and spells none of it, so
   only text the input holds is blue; a box is hollow, since it
   stands for a diagram drawn elsewhere, and it is a link there, so it fills
   under a pointer. A diagram scrolls sideways in its own container, as a
   graph does. */
[data-railroad] { overflow-x: auto }
[data-railroad] > svg { display: block }
[data-railroad-line] { fill: none; stroke: var(--text); stroke-width: 1.5 }
${railroadBox('terminal')} { fill: var(--value-bg); stroke: var(--value); stroke-width: 1.5 }
${railroadBox('category')} { fill: var(--border); stroke: var(--muted); stroke-width: 1.5 }
${railroadBox('nonTerminal')} { fill: var(--bg); stroke: var(--text); stroke-width: 1.5 }
a:hover > ${railroadBox('nonTerminal')} { fill: var(--pass-bg) }
[${railroadLabelMarker}] { dominant-baseline: middle; font-size: .75rem }
${railroadLabel('terminal')} { fill: var(--value) }
${railroadLabel('category')} { fill: var(--text); font-style: italic }
${railroadLabel('nonTerminal')} { fill: var(--text); font-weight: 700 }
/* A demo's radio group: a few choices that all stay visible, inline under a
   bold legend, each as tall as a touch target. */
[data-radios] { border: 0; margin: 1rem 0; padding: 0; min-width: 0 }
[data-radios] legend { font-weight: bold; padding: 0 }
[data-radios] > div { display: flex; flex-wrap: wrap; gap: 1rem }
[data-radios] label { display: inline-flex; align-items: center; gap: .5rem; min-height: 44px; cursor: pointer }
[data-radios] input { width: auto; margin: 0; accent-color: var(--link) }
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
/* SUL's levels as stripes: each unit — a character, eight typed bits,
   eight padding bits — is a column of its label, its bits, and a row of
   pixels for each level, one pixel a bit wide. The units touch, so a word
   that spans two of them is one unbroken stripe; a unit's label is boxed,
   as a byte's is, to show where one ends. A level's pixels take one of two
   colours, switching where a word ends, and a hash's are hatched over
   them. The hatching is a square tile a pixel wide, its lines running
   corner to corner, so each pixel takes the lines up where its neighbour
   left them and a hash's stripe reads as one hatched bar. The padding's
   pixels are faded, as they carry no data. A label never widens its unit,
   which would open a gap in the stripes: it is as wide as the unit's bits.
   The padding's first label is the exception: the padding is the last run
   of units, and its box grows to hold its word even over a single bit.
   Typed bits have no label, and no box. A label's height is fixed, not a
   minimum: a stand-in such as ␠ is missing from most monospace fonts, and
   the font the browser borrows it from can have a taller line, which would
   make that one box taller than the others. The units are one line that
   scrolls sideways, so no stripe breaks; the rows' names are the first
   unit, pinned to the left edge as the line scrolls. */
[data-sul-scroll] { margin-block: .5rem; overflow-x: auto; padding-bottom: .25rem }
[data-sul-units] { display: flex; width: max-content }
[data-sul-unit] { display: flex; flex-direction: column; gap: 2px }
[data-sul-names] { background: var(--bg); color: var(--muted); left: 0; padding-right: .5rem; position: sticky; z-index: 1 }
[data-sul-label] { border: 1px solid var(--border); box-sizing: border-box; height: 1.5em; line-height: calc(1.5em - 2px); margin-left: -1px; min-width: calc(100% + 1px); text-align: center; white-space: nowrap; width: 0 }
[data-sul-label]:empty { border-color: transparent }
[data-sul-pad] [data-sul-label] { width: auto }
[data-sul-label]:not([data-stand-in], :empty) { background: color-mix(in srgb, var(--border) 45%, var(--bg)); font-weight: 700 }
[data-sul-row] { display: flex; height: 1.2em; line-height: 1.2em }
[data-sul-bit], [data-sul-px] { text-align: center; width: 1ch }
[data-sul-px="a"] { background: var(--value) }
[data-sul-px="b"] { background: var(--syntax-name) }
[data-sul-pad] [data-sul-px] { opacity: .35 }
[data-sul-hash] { background-image: linear-gradient(135deg, color-mix(in srgb, var(--bg) 70%, transparent) 0 15%, transparent 15% 50%, color-mix(in srgb, var(--bg) 70%, transparent) 50% 65%, transparent 65%); background-size: 1ch 1ch }
/* A rendered README reads as GitHub renders it: prose in the platform's sans
   face at GitHub's measure and leading, its title and sections ruled, inline
   code and code fences shaded, and code itself in the site's monospace face.
   This is the one place the site's single face gives way — a spec page is
   prose to be read, and the rest of the page stays set in monospace
   (render-readme's "prose face"). */
[data-readme] { font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif; margin-block: 1.5rem; max-width: 60rem; overflow-wrap: break-word }
[data-readme] > :first-child { margin-top: 0 }
[data-readme] :is(h2, h3, h4, h5, h6) { font-weight: 600; line-height: 1.25; margin: 1.5em 0 1rem }
[data-readme] h2 { border-bottom: 1px solid var(--border); font-size: 2em; padding-bottom: .3em }
[data-readme] h3 { border-bottom: 1px solid var(--border); font-size: 1.5em; padding-bottom: .3em }
[data-readme] h4 { font-size: 1.25em }
[data-readme] h5 { font-size: 1em }
[data-readme] h6 { color: var(--muted); font-size: .875em }
[data-readme] :is(p, ul, pre, table) { margin: 0 0 1rem }
[data-readme] ul { padding-left: 2em }
[data-readme] li + li { margin-top: .25em }
[data-readme] li > :is(p, pre) { margin-top: 1rem }
[data-readme] li > ul { margin: .25em 0 0 }
[data-readme] .task-list-item { list-style: none }
[data-readme] .task-list-item input { margin: 0 .2em .25em -1.4em; vertical-align: middle }
[data-readme] table { border-collapse: collapse; display: block; max-width: 100%; overflow: auto; width: max-content }
[data-readme] :is(th, td) { border: 1px solid var(--border); padding: 6px 13px }
[data-readme] th { font-weight: 600 }
[data-readme] tbody tr:nth-child(2n) { background: color-mix(in srgb, var(--border) 25%, var(--bg)) }
[data-readme] a, [data-readme] a:visited { color: var(--value); text-decoration: none }
[data-readme] a:hover { text-decoration: underline }
[data-readme] code { background: color-mix(in srgb, var(--border) 45%, var(--bg)); border-radius: 6px; font: 85% ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; padding: .2em .4em; white-space: break-spaces }
[data-readme] pre { background: color-mix(in srgb, var(--border) 30%, var(--bg)); border-radius: 6px; line-height: 1.45; overflow: auto; padding: 1rem; white-space: pre }
[data-readme] pre > code { background: transparent; font-size: 85%; padding: 0; white-space: pre }
/* A code block — a demo's source, such as the rtti demo's schema — is a
   shaded, bordered box, so code reads apart from the prose around it. A
   reader's answer in the rtti demo is the same box, tinted green for a
   success and red for a failure, so the verdict reads before the value does.
   A line can be one long DataJS document, so it wraps rather than widening
   the page. */
[${codeMarker}], [${resultMarker}] { border: 1px solid var(--border); border-radius: 6px; overflow-wrap: anywhere; padding: .5rem .75rem; white-space: pre-wrap }
[${codeMarker}] { background: color-mix(in srgb, var(--border) 30%, var(--bg)) }
/* Static reference controls appear only once their browser adapter is bound. */
[data-cli]:not([data-copy-ready]) [data-copy] { display: none }
[data-cli] section { border-top: 1px solid var(--border); margin-top: 2rem; padding-top: 1rem; scroll-margin-top: 1rem }
[data-cli-explorer] nav ul { list-style: none; padding: 0 }
[data-cli-link] { display: block; padding: .65rem .75rem; text-decoration: none; border: 1px solid transparent; border-radius: .35rem }
[data-cli-link] strong, [data-cli-link] span { display: block }
[data-cli-link] span { color: var(--muted); font-size: .85rem; margin-top: .3rem }
[data-cli-link]:hover { background: var(--pass-bg) }
[data-cli-link][aria-current="true"] { background: var(--pass-bg); border-color: var(--link) }
[data-cli-controls] label { display: block; font-size: .85rem; margin-bottom: .5rem }
[data-cli-search-row] { display: flex; gap: .4rem }
[data-cli-search-row] input { min-width: 0; width: 100%; padding: .6rem; font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: .3rem }
[data-cli-search-row] button { flex-shrink: 0; white-space: nowrap; padding-inline: .65rem; font: inherit; color: var(--link); background: var(--bg); border: 1px solid var(--border); border-radius: .3rem; cursor: pointer }
[data-cli-count] { color: var(--muted); font-size: .8rem; margin-bottom: .5rem }
[data-cli-ready] [data-cli-command] { margin-top: 0; padding-top: 0; border-top: 0 }
[data-cli-ready] [data-cli-command] h2 { margin-top: 0 }
[data-cli] [hidden] { display: none }
[data-cli] input:focus-visible, [data-cli] button:focus-visible { outline: 2px solid var(--link); outline-offset: 2px }
@media (min-width: 48rem) {
    [data-cli-ready] [data-cli-explorer] { display: grid; grid-template-columns: 19rem minmax(0, 1fr); gap: 2rem; margin-top: 2rem }
    [data-cli-ready] [data-cli-explorer] nav { align-self: start }
    [data-cli-ready] [data-cli-explorer] nav h2 { margin-top: 0 }
    [data-cli-ready] [data-cli-details] { border-left: 1px solid var(--border); padding-left: 2rem; min-width: 0 }
}
@media (max-width: 47.999rem) {
    [data-cli-ready] [data-cli-explorer] nav ul { max-height: 17rem; overflow-y: auto }
    [data-cli-ready] [data-cli-details] { border-top: 1px solid var(--border); padding-top: 1.5rem; margin-top: 1.5rem }
}
[data-cli] a:focus-visible { outline: 2px solid var(--link); outline-offset: 2px }
[data-code-block] { position: relative; margin-block: 1em; padding-right: 3rem }
[data-code-block] > pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere }
[data-code-block] > button { position: absolute; top: .25rem; right: .25rem; display: inline-flex; align-items: center; justify-content: center; width: 1.5rem; height: 1.5rem; padding: .125rem; border: 0; border-radius: .25rem; background: transparent; color: var(--muted) }
[data-code-block] > button:hover:enabled { background: transparent; color: var(--text) }
[data-code-block] > button:focus-visible { outline: 2px solid var(--value); outline-offset: 2px }
[data-code-block] > button > svg { width: 20px; height: 20px }
[data-copy-status] { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap }
[data-code-block] > button > [data-copy-check] { display: none }
[data-code-block] > button[data-copy-feedback="copied"], [data-code-block] > button[data-copy-feedback="copied"]:hover:enabled { color: var(--pass) }
[data-code-block] > button[data-copy-feedback="copied"] > svg { display: none }
[data-code-block] > button[data-copy-feedback="copied"] > [data-copy-check] { display: block }
[data-copy-feedback] > [data-copy-status] { right: -3px; bottom: calc(100% + 8px); width: auto; height: auto; overflow: visible; clip-path: none; padding: 5px 9px; background: black; color: white; border-radius: 5px; font-size: 12px; font-weight: 500; box-shadow: 0 2px 6px #00000018; pointer-events: none }
[data-copy-feedback] > [data-copy-status]::after { content: ''; position: absolute; top: 100%; right: 10px; border: 5px solid transparent; border-top-color: black }
@media (prefers-color-scheme: dark) {
    [data-copy-feedback] > [data-copy-status] { background: #e8eaed; color: #202124 }
    [data-copy-feedback] > [data-copy-status]::after { border-top-color: #e8eaed }
}
[${resultMarker}="ok"] { background: var(--pass-bg); border-color: color-mix(in srgb, var(--pass) 40%, transparent); color: var(--pass) }
[${resultMarker}="error"] { background: var(--fail-bg); border-color: color-mix(in srgb, var(--fail) 40%, transparent); color: var(--fail) }
/* A result that holds code — the rtti demo's answers — keeps the verdict's
   tint and border and adds an edge in its colour, while its text takes the
   text colour, so the token colours inside read as code and green is not
   both "accepted" and "string". The caption's verdict word carries the
   colour too. */
[${codeMarker}][${resultMarker}] { color: var(--text) }
[${codeMarker}][${resultMarker}="ok"] { border-left: 4px solid var(--pass) }
[${codeMarker}][${resultMarker}="error"] { border-left: 4px solid var(--fail) }
/* A listing too long to read whole, a WASM module's WAT: a box of its own
   height that scrolls, its lines kept unbroken so the indentation reads. */
[${listingMarker}] { max-height: 24rem; overflow: auto; overflow-wrap: normal; white-space: pre }
[${listingMarker}] > pre { white-space: pre }
/* A refused construct's banner: the page's verdict, read before anything
   else on it, so it is larger than a result and edged in the failure colour. */
[${refusedMarker}] { background: var(--fail-bg); border: 2px solid var(--fail); border-left-width: 8px; border-radius: 6px; color: var(--fail); margin-block: 1rem; padding: .75rem 1rem }
[${refusedMarker}] > strong { display: block; font-size: 1.5rem }
[${refusedMarker}] > p { color: var(--text); margin: .5rem 0 0 }
/* An undecided construct's banner: the same weight as a refusal's, in the
   neutral value colour, since nothing is decided to have failed. */
[${undecidedMarker}] { background: var(--value-bg); border: 2px solid var(--value); border-left-width: 8px; border-radius: 6px; color: var(--value); margin-block: 1rem; padding: .75rem 1rem }
[${undecidedMarker}] > strong { display: block; font-size: 1.5rem }
[${undecidedMarker}] > p { color: var(--text); margin: .5rem 0 0 }
/* An admitted feature's banner: the verdict a refused or undecided page
   opens with, here the compiler's acceptance, in the passing colour and a
   lighter weight, since it is the page's expected state. */
[${admittedMarker}] { background: var(--pass-bg); border: 1px solid var(--pass); border-left-width: 8px; border-radius: 6px; color: var(--pass); margin-block: 1rem; padding: .5rem 1rem }
[${admittedMarker}] > strong { display: block; font-size: 1.15rem }
[${admittedMarker}] > p { color: var(--text); margin: .25rem 0 0 }
[${registerRowMarker}] { border: 1px solid var(--border); border-radius: 6px; margin-block: 1rem; padding: .5rem 1rem }
[${registerRowMarker}] > h3 { margin: .25rem 0 .5rem }
[${registerRowMarker}] > div > p { display: inline; margin: 0 }
[${verdictMarker}="ok"] { color: var(--pass) }
[${verdictMarker}="error"] { color: var(--fail) }
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
/* The schema not picked keeps receding: its tokens take its muted colour. */
[data-pick] > button[aria-pressed="false"]:not(:hover) [data-token] { color: inherit }
/* Syntax highlighting inside a code block, from website/demo/highlight:
   the token classes only: punctuation and blanks keep the text colour. */
[data-token="keyword"], [data-token="literal"] { color: var(--value) }
[data-token="string"] { color: var(--pass) }
[data-token="number"] { color: var(--syntax-number) }
[data-token="identifier"] { color: var(--syntax-name) }
[data-token="comment"] { color: var(--muted); font-style: italic }
/* A highlighted field is a textarea laid over a coloured copy of its text, so
   the reader types into the colours and the caret, selection and undo stay the
   browser's. The two must wrap alike to the pixel, so they share the font, the
   padding, the border width and the gutter a scrollbar takes; the textarea's
   own text is transparent and only its caret shows. The copy takes no pointer
   events, and the page runtime keeps its scroll equal to the textarea's. */
[${editorMarker}] { display: block; position: relative; background: var(--bg); border-radius: 6px }
[${editorMarker}] > textarea, [${mirrorMarker}] { box-sizing: border-box; border: 1px solid var(--border); border-radius: 6px; font: .9em/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: normal; margin: 0; overflow-wrap: anywhere; padding: .5rem .75rem; scrollbar-gutter: stable; tab-size: 8; white-space: pre-wrap }
[${editorMarker}] > textarea { background: transparent; caret-color: var(--text); color: transparent; display: block; position: relative }
[${mirrorMarker}] { border-color: transparent; color: var(--text); inset: 0; overflow: hidden; pointer-events: none; position: absolute; user-select: none }
/* The member a failure points at, marked inside a code block — the rtti
   demo's value written again under a refusal — in the failure's colours. */
[${codeMarker}] mark { background: var(--fail-bg); border-radius: 3px; color: var(--fail); outline: 1px solid color-mix(in srgb, var(--fail) 40%, transparent) }
/* ECDSA's diagram separates the intercepted packet from Bob's prior trust.
   Reflow the same semantic content on small screens, preserving reading order. */
[data-secp-playground] { min-width: 0 }
[data-secp-layout] { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 1.5rem; align-items: start }
[data-secp-layout] > div { min-width: 0 }
[data-secp-graph] { width: 100%; height: auto; display: block; font-size: 11px; overflow: hidden }
[data-secp-graph] text { fill: currentColor }
[data-secp-grid] { stroke: var(--border); stroke-width: 1 }
[data-secp-modular-line] { stroke: #d97706; stroke-width: 3; stroke-linecap: round; fill: none }
[data-secp-dot] { fill: var(--muted); cursor: pointer; stroke: transparent; stroke-width: 8 }
[data-secp-point="input"] { stroke: #d97706; fill: #d97706 }
[data-secp-point="base"] { stroke: #8b5cf6; fill: #8b5cf6 }
[data-secp-point="result"] { stroke: #0284c7; fill: #0284c7 }
[data-secp-point="third"] { stroke: #c026d3; fill: #c026d3 }
[data-secp-graph] circle[fill="none"] { fill: none }
[data-secp-label] { font-weight: bold; paint-order: stroke; stroke: var(--bg); stroke-width: 3px }
[data-secp-graph] [data-secp-label="third"] { fill: #c026d3 }
[data-secp-real-curve] { stroke: currentColor; stroke-width: 2 }
[data-secp-line] { stroke: #d97706; stroke-width: 2; fill: none }
[data-secp-finite-negation] { stroke: #0284c7; stroke-width: 2; stroke-dasharray: 2 4; stroke-linecap: round; fill: none }
[data-secp-reflection] { stroke: #0284c7; stroke-width: 2; stroke-dasharray: 5 4 }
[data-demo-drag] { cursor: ew-resize; touch-action: none }
[data-secp-playground] select { max-width: 100%; min-height: 44px }
[data-secp-playground] input[type="range"] { width: 100%; min-height: 44px }
[data-secp-playground] pre { white-space: pre-wrap; overflow-wrap: anywhere }
[data-demo-click]:focus-visible { outline: 3px solid currentColor; outline-offset: 3px }
[data-demo-click][aria-disabled="true"], [data-demo-drag][aria-disabled="true"] { pointer-events: none; cursor: default }
@media (max-width: 760px) { [data-secp-layout] { grid-template-columns: minmax(0, 1fr) } }

[${signSchemeMarker}] { border: 1px solid var(--border); border-radius: 12px; margin: 1rem 0 2rem; padding: 1rem; font-size: .875rem }
[${signSchemeMarker}] svg { display: block; width: 2.5rem; height: 2.5rem; flex: none; margin: .5rem auto }
[${signFlowMarker}] { display: grid; grid-template-columns: minmax(0, 1fr) 4.5rem minmax(0, 1fr) 4.5rem minmax(0, 1fr); gap: .65rem; align-items: start }
[${signCardMarker}], [${signStageMarker}] { --sign-accent: var(--value); --sign-tint: var(--value-bg) }
[${signCardMarker}="eve"], [${signStageMarker}="eve"] { --sign-accent: var(--fail); --sign-tint: var(--fail-bg) }
[${signCardMarker}="bob"], [${signStageMarker}="bob"] { --sign-accent: var(--pass); --sign-tint: var(--pass-bg) }
[${signCardMarker}] { border: 1px solid var(--sign-accent); border-radius: 8px; background: var(--sign-tint); padding: .75rem; text-align: center; min-width: 0 }
[${signCardMarker}] h4 { color: var(--sign-accent); font-size: 1.2rem; margin: 0 0 .25rem }
[${signCardMarker}] small { display: block; margin-top: .35rem }
[${signCardMarker}] svg { color: var(--sign-accent) }
[${signPacketMarker}] { text-align: center; color: var(--muted); margin-top: 2rem }
[${signPacketMarker}] svg { width: 100%; height: 1.5rem }
[${signVerifierMarker}] { min-width: 0 }
[${signExplanationMarker}] { margin: .75rem 0 0; line-height: 1.5; font-size: .8rem }
[${signTrustMarker}] { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr) minmax(0, 1fr); align-items: center; gap: .75rem; color: var(--muted); margin-top: 1rem }
[${signTrustKeyMarker}] { display: flex; align-items: center; gap: .5rem; border: 1px solid var(--border); border-radius: 8px; background: color-mix(in srgb, var(--border) 35%, var(--bg)); color: var(--text); padding: .5rem .75rem }
[${signTrustKeyMarker}] svg { width: 1.5rem; height: 1.5rem; margin: 0 }
[${signTrustPathMarker}] { text-align: center }
[${signTrustPathMarker}] svg { width: 100%; height: 1.5rem; margin: .25rem 0 }
[${signSchemeMarker}] figcaption { color: var(--muted); font-size: .8rem; line-height: 1.5; margin-top: .75rem }
@media (max-width: 900px) {
    [${signFlowMarker}] { grid-template-columns: minmax(0, 1fr) 3.5rem minmax(0, 1fr) 3.5rem minmax(0, 1fr) }
}
@media (max-width: 600px) {
    [${signFlowMarker}], [${signTrustMarker}] { grid-template-columns: minmax(0, 1fr) }
    [${signPacketMarker}], [${signTrustPathMarker}] { display: flex; align-items: center; justify-content: center; gap: .75rem }
    [${signPacketMarker}] svg, [${signTrustPathMarker}] svg { transform: rotate(90deg); width: 1.5rem; height: 1.5rem; margin: .35rem 0 }
    [${signPacketMarker}] { margin-top: 0 }
    [${signTrustKeyMarker}] { justify-content: center }
}

/* Role cards keep long signing outputs and received snapshots in distinct
   sections. Role names and borders distinguish them without relying on color. */
[${signStageMarker}] { border: 1px solid color-mix(in srgb, var(--sign-accent) 45%, var(--border)); border-radius: 10px; margin-block: 1.5rem; padding: 0 1rem 1rem; min-width: 0 }
[${signStageHeaderMarker}] { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .5rem 1rem; margin: 0 -1rem 1rem; padding: .75rem 1rem; border-radius: 9px 9px 0 0; border-bottom: 1px solid color-mix(in srgb, var(--sign-accent) 25%, var(--border)); background: var(--sign-tint); color: var(--sign-accent) }
[${signStageHeaderMarker}] h3 { margin: 0; font-size: 1.1rem }
[${signRoleMarker}] { border: 1px solid color-mix(in srgb, var(--sign-accent) 40%, transparent); border-radius: 999px; font-size: .75rem; padding: .2rem .6rem }

`

/**
 * The stylesheet rustdoc's pages extend theirs with (`--extend-css`), for the
 * site's header and footer that the generator hands rustdoc to put on every
 * page.
 *
 * The tokens are declared on `:root` like the site's own, under names rustdoc
 * does not use. The bars keep the site's face and colours: rustdoc's own
 * styles are left as they are.
 *
 * **Two rules lean on rustdoc's layout**, and are where to look when a Rust
 * release changes it. rustdoc lays a page out as one flex row, its sidebar
 * then `main`: each bar takes a row of its own, and `main` shrinks beside the
 * sidebar instead of wrapping under it when its content is wide. And the bars
 * sit above rustdoc's sticky sidebar, at z-index 100, which would otherwise
 * slide over the footer at the end of a long page.
 *
 * @type {string}
 */
export const rustdocStylesheet = `:root { ${lightTokens} }
@media (prefers-color-scheme: dark) {
    :root { ${darkTokens} }
}
body.rustdoc { flex-wrap: wrap }
body.rustdoc > main { flex: 1 1 0; min-width: 0 }
body.rustdoc > header, body.rustdoc > footer { background-color: var(--bg); flex-basis: 100%; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; position: relative; z-index: 101 }
body.rustdoc > header a, body.rustdoc > footer a { color: var(--link) }
${bars}`
