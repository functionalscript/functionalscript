# The website

`module.f.mjs` is a `NodeProgram` that generates the site from the repository
it sits in: one page per directory, each carrying that directory's contents and
the proofs of its subtree, plus the one stylesheet they all link. It is run by
`npm run website`, and its whole output is gitignored.

This file holds the decisions the generator rests on — the ones that are about
the *site* rather than about any one function. What each function does, and why
it does it that way, is in its own JSDoc.

## The site is the repository, served

`wrangler.jsonc` publishes the repository folder itself: `"assets": {
"directory": "." }`. There is no separate output tree. A generated page sits in
the directory it describes, and `.gitignore` keeps `index.html` and the
`_`-prefixed files out of the tree.

**That is what lets a page load any repository file by its path at run time.**
A page's proofs are the real `.f.mjs` modules under it, imported by the browser
from where they actually live; the source and documentation views planned in
`todo/` fetch the same files. None of that works from a directory of copies.

[`emergent_testing/todo/browser-testing.md`](../emergent_testing/todo/browser-testing.md)
describes an eventual isolated application root that exposes HTML and
JavaScript only and deliberately does *not* serve the working tree. That is
that issue's concern, for automated runners. Module pages do not depend on it,
and moving the site under such a root would break every fetch they make — so
the two are separate, and this one is not quietly migrated into the other.

## Every directory gets a page

One rule rather than two: whatever a directory holds, it gets an `index.html`
listing its subdirectories, its files, the issues in its `todo/`, and the
proofs of its subtree — directories first, as GitHub and a file manager list
them. Sections with nothing in them are omitted.

Because every directory has a page, every subdirectory link on every page
resolves, which is what makes the tree walkable from the root. The root page is
that page for the repository root — it carries the project's name and the same
catalogue — rather than a special case beside the rule.

The one exclusion is a `todo/` subtree, by path segment: its issues are its
parent's open work, so a page of its own would hold nothing else. It is neither
generated nor linked, so nothing points at a page that was never written.

## A page runs the proofs under it

A page is the browser test runner with a shorter list, never a second runner.
The list is decided at build time — which proofs are under this directory, and
which of them a browser can link — and written into the page, so what reaches
the browser is an answer rather than a rule to apply.

**A proof has one name.** A page names each proof relative to itself, which is
exactly what `fjs t` prints when run from that directory: `./proof.f.mjs` on
the directory that holds it, `./fjs/types/list/proof.f.mjs` at the root. Three
spellings of one test is the problem this repository has been removing
([the two runners](../emergent_testing/README.md#the-two-runners-and-what-sharing-them-cost)).

A proof a browser cannot link is named on its page with what blocks it, rather
than dropped, so an empty list means "no proofs here" and nothing else. Where
*every* proof of a subtree is blocked the page keeps that list and offers no
control: a run over an empty source list reports `passed`, and a green verdict
for a subtree that ran nothing is the plausible wrong value
[DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle) refuses.

Nothing starts on load, as
[browser-test-controls](../emergent_testing/todo/browser-test-controls.md)
requires. A page binds the runner to its button.

**A run's report is grouped by module, and what passed folds away.** The root
page runs thousands of proofs, and one list of that many identical rows gave a
reader no way to find the one that failed. Each module run is a group whose
folded line is a green or red dot, the module's path, and its counts at the
right edge, failures first — `1 failed · 14 passed` — and a group closes as soon
as the run moves past it having passed, so what stays open is exactly what needs
reading. The whole run's counts sit in the section's title, green and red, with
the time. A failure's message and stack are a tinted box of their own under its
row. Two runs of the same module with another run between them are two
groups; two with nothing between them share one, because a result carries no
run identity to tell them apart — and a generated page names each proof once,
so it never meets that case. The list of proof sources under the report is
shown until a run puts results in it; from then on an entry that produced
results is hidden, since it is a group above. Two kinds stay, because no group
stands for either: a blocked proof, with its reason, and a proof that ran and
reported no tests, which the runner marks after the run.

**The runner's own page shows a failure on purpose.** A green suite never shows
the report's failure state, and breaking a real proof would turn every run red.
So `fjs/emergent_testing/browser` has a demo that runs a small example suite —
one module passing, one failing, one with no tests — through the same walk,
sandbox and report views a real run uses, and after the run lists the module
that reported nothing the way a real page does. It is a `demo`, never a
`proof`, so no real run sees it. It draws into `data-example-*` hooks, not
`data-test-*`, because the runner looks those up across the whole page and the
demo renders above the suite.

## A demo shows what a module does

A module page can say what a module *is* and whether it *passes*. A demo is the
third thing: a hash function is best understood by typing into a field and
watching the digest change.

**Discovery is by export, exactly as it is for a proof.** A module is a demo
module if and only if it exports `demo`, so a demo may live in `demo.f.mjs` or
inline beside the implementation, and no filename decides it
([the proof export](../emergent_testing/README.md#discovery-the-proof-export)).
Two demo modules in one directory is refused rather than resolved: a page has
one demo section, and a precedence rule would decide silently which of them a
reader is looking at. One a browser cannot link is dropped and said on the
console — unlike a proof it has nowhere on the page to be listed with its
blocker.

**A demo is pure, and asks for what it needs.** It exports `init`, `update` and
`view` ([`demo/types.ts`](./demo/types.ts)); `view` answers a `media/html` tree
and `update` answers an `Effect`, so a demo never touches the DOM, registers a
listener, reads a clock or fetches. One impure runtime,
[`demo-runtime.mjs`](./demo-runtime.mjs), renders what a demo describes and
hands each event back. A demo is therefore provable like any other `.f.mjs`,
and its author writes no host code.

`update` returns `Effect<O, State, never>`, and the `never` is a claim: a demo
has no error display apart from what it renders, so a recoverable failure is
absorbed into `State` where `view` can show it.

**What a demo may name is what the runtime implements**, which is `sandbox`
and `catch` from [`effects/common`](../effects/common/types.ts): host-neutral
operations a browser has as surely as Node does, so the first demo to need one
needed no browser vocabulary at all. `fjs/types/bigint` measures two `log2`
implementations by asking `sandbox` to run each and report how long it took;
nothing in the page knows what is being measured.

A command named in the vocabulary with no handler answers `notImplemented`
through the demo's own channel, which is what `never` obliges the demo to
absorb — the bigint demo turns it into a row saying so, and its proof drives
exactly that runner. A command *not* named is a malformed node and panics: a
vocabulary and a handler map are two different things, which is why the
runtime declares both. The first browser-only operation — a fetch, a file the
reader picks — is where `fjs/effects/browser/` becomes necessary.

While an update is in flight the runtime marks the section and disables its
buttons, and the stylesheet writes `Working…` under the demo. Only the runtime
can say this: a demo renders once, after its effect has finished, so it cannot
paint "still going" itself. The word is general because the runtime is — the
next demo may be waiting on a network rather than on arithmetic — and a demo
wanting its own wording should say so in a field rather than have the runtime
guess. Raising the flag is followed by a return to the event loop, because a
demo's work runs on the thread that paints and a flag raised and blocked in one
task is a flag nobody sees.

Events are serialized: one `update` at a time, the next queued behind it. That
is what makes a demo's state a fold over its events in the order they happened,
which is the property its proof relies on. `start` arrives once, after the
first render, so a demo needing an operation before it can show anything has
somewhere to ask without `init` becoming an effect.

**A demo's output should be checkable from outside.** The first one,
[`crypto/sha2`](../crypto/sha2/demo.f.mjs), shows a SHA-256 digest in hex and
says it is hex, because `printf '%s' hello | sha256sum` prints the same 64
characters. Encoding it with this repository's own cBase32 was the first
attempt: it made the demo partly about `basen`, and left a reader no way to
tell whether the page was right. Being checkable is not theoretical — the
digest is padded to 64 because one in sixteen begins with a zero hex digit, and
what found that was someone typing `1234` into the page.

## Links are root-relative

`/_main.css`, `/fjs/types/index.html`, `/fjs/emergent_testing/browser/module.mjs`
— a page at any depth writes the same href for the same target, because a link
is built from the repository path and never from where the page sits. The
exception is a page's own proof sources, which are relative *by design*: that
is what makes their names the ones `fjs t` uses.

## A link keeps its colour, whether or not it has been followed

`a, a:visited { color: var(--link) }` in
[`style/module.f.mjs`](./style/module.f.mjs). Nearly every word on this site is
a link into the tree — a breadcrumb, a file, a subdirectory, an issue — so a
list of them turned two-toned as it was read, and the second colour said only
*where this reader has been*, nothing about the file it names. That distinction
earns its keep in a bibliography, deciding what is left to read; these lists
are a directory's contents, navigated by structure, and a reader returns to one
to go somewhere else from it. The underline stays, so nothing about *being* a
link depends on the colour.

**`--link` is green, and its own token even though it starts at `--pass`'s
values.** The site names every other colour in `:root` — background, text,
muted text, border, pass, fail — and left links to the browser's blue, the one
colour it never chose. Green reads as this site's own: everything is set in a
monospace face already ([One face, the whole site](#one-face-the-whole-site)),
and green is the colour that face suggests, a terminal's.

One green cannot serve both colour schemes. The terminal green this was after,
`#00ff00`, is 13.65:1 against the dark background and 1.37:1 against white,
where WCAG AA asks 4.5:1 for text — unreadable in the light scheme. So, like
every other colour here, it is a pair: `#137333` (5.95:1) in `:root`,
`#81c995` (9.56:1) under `prefers-color-scheme: dark`. Quieter candidates
toward the terminal green were considered for the dark value — `#3fb950`
(7.37:1) — and set aside for the same reason the light value was never
`#0f5132` (9.36:1, the darkest that still passes): the pair the site already
had, `--pass`, passed both, and taking it was the decision to make
deliberately rather than by reaching for the nearest green.

That is also why `--link` is not simply `--pass`. In the test report green
means *passed* — a module's dot and counts are green, red is a failure — and a
link in that same green would make one colour mean both "this went well" and
"go here" on the page where both appear. `--link` keeping `--pass`'s starting
values is coincidence, not aliasing: moving one later must not drag the other
with it.

## The favicon is "fs", committed rather than generated

`favicon.ico` at the repository root, `favicon.svg` in
[`fjs/website/`](./favicon.svg), next to the generator that links it. The site
serves the repository directory itself, so a file is served from where it
sits — there is nothing to generate, and the mark will not change often
enough for a build step to buy anything.

**The mark is "fs", drawn as strokes rather than characters.** The site had
no logo to inherit, and text set in a font renders as whatever the browser
resolves that font to — a different shape depending on what is installed,
unlike every other mark on this site drawn as geometry. A handful of
round-capped path strokes trace a script "fs" ligature — the project's own
initials, in the flowing hand a font can't be relied on to reproduce — and
read clearly down to 16px. It takes `--link`'s two colours, `#137333` light
and `#81c995` dark, via the SVG's own `prefers-color-scheme` query: the one
mark on the page that is this site's own colour and nothing else's.

**Both files, because declaring one ends the implicit lookup.** `/favicon.ico`
is what a browser asks for when a document declares no icon at all; once a
page declares the SVG, a browser that recognizes `rel="icon"` but cannot
render SVG has no reason to go looking for the `.ico` — the fallback would
never be requested in the one case it exists for. So both are declared, and
the SVG's `type` tells a browser which one it can skip. The `.ico` cannot
carry the `prefers-color-scheme` query itself, so it is fixed to the light
value — the fallback for a browser that reads neither the SVG nor the
scheme it would have picked.

## A section's list pads its links for a finger, not a mouse

```css
@media (any-pointer: coarse) {
    [data-section] > ul a { display: inline-block; padding-block: .25rem }
}
```

A page lists its files, directories and issues one link per line with nothing
under it, and at `d05b70ce`, rendered at 390px, every listed link measured
19px tall — under the 24px minimum WCAG 2.2's Target Size (Minimum, AA) sets.
These lists are exactly how a reader moves through the tree, so a target a
finger cannot pick without risking its neighbour is the site's own navigation
working against the reader.

**`any-pointer`, not `pointer`.** `pointer: coarse` reads only the *primary*
pointer, and a touch-screen laptop's primary pointer is its trackpad — fine,
even though the screen a reader might tap is right there. That query would
leave the laptop's lists at 19px for the one input the padding exists for.
`any-pointer: coarse` asks whether a coarse pointer is available at all, so
the laptop's touchscreen gets the same padding its trackpad doesn't need, and
a device with no coarse pointer — an ordinary desktop and mouse — keeps the
list exactly as dense as it was.

Padded, a link measures 27px, confirmed by rendering the generated site at
390px with a touch-capable viewport; an ordinary 1280px desktop viewport
measured the original 19px, unchanged. Like the phone-fit rule
([One face, the whole site](#one-face-the-whole-site)), no proof holds this —
target size is layout, which only a rendering browser can measure.

## A file opens on GitHub, at the commit the site was built from

A listed file or issue links to
`https://github.com/functionalscript/functionalscript/blob/<commit>/<path>`
when the build knows its commit, and to its raw path on this site when it does
not. Until the site has a source view of its own
([`todo/source-and-doc-view.md`](todo/source-and-doc-view.md)), GitHub is that
view: source is highlighted and Markdown is rendered, where the raw file is
neither.

- **The commit, not the branch.** A branch preview outlives its branch, which is
  usually deleted when the pull request merges, and a page's proofs ran that
  exact commit — a branch link would show whatever the branch holds today.
- **Where it comes from:** `WORKERS_CI_COMMIT_SHA`, which Cloudflare's Workers
  Builds sets on every build. A value that is not a SHA-1 commit id is refused,
  and the build log's `file links:` line says which way a build went.
- **A local build keeps raw links.** It has no such variable, and its unpushed
  commits would open nothing on GitHub.
- **Only what a reader follows moves.** A page's proofs and its demo are
  imported by the browser from this site, and stay there.
- **Every link a reader follows is percent-encoded, segment by segment** —
  file, issue and directory links, on this site and on GitHub. A space, `#`, `?`
  or `%` in a name would otherwise end the path or change what it means, and the
  link would go somewhere else without saying so.

## One face, the whole site

Everything is set in a monospace stack, `ui-monospace` first so each platform
supplies its own UI monospace face rather than a terminal default. Nearly every
word on this site is an identifier — a file name, a directory, a module path, a
breadcrumb, a test name — and the report was already monospace because a test
name is a path. Setting one face is what stops the site being two.

**Some elements do not inherit it on their own**, and each is given
`font: inherit`. A browser's rule for `pre` names a monospace family, and
naming one is what triggers the legacy shrink to 13.33px, so a report would
otherwise be set in a nearly-matching face at a nearly-matching size. A form
control is given the platform's UI face outright, so `Run` was Arial at
13.33px on a page otherwise set in monospace at 16px, and a demo's field was
the same the moment the first demo landed. Inheriting is what makes "one face"
true of the whole page rather than only of its text.

The `48rem` measure is kept. In a monospace face at 16px it holds about eighty
characters, which is the width this repository's source is written to.

**A line may break inside a word.** A path has no space to break at, so on a
phone a page's title, a proof's name or a digest was wider than the screen: the
page scrolled sideways, or the report's panel clipped the line. At 360px, on
`d05b70ce`, that was 63 of 216 pages. `overflow-wrap: anywhere` on `body` lets
any line break where it has to; an identifier split mid-word is still read, and
one cut off is not. Breaking a title after its `/` would read better, and needs
the generator to mark where.

No proof holds this. Whether a line fits is layout, which only a browser that
renders the page can measure; a proof asserting the rule's text would pass with
the rule overridden and fail with it moved. That check belongs with the
automated browser runners of
[`emergent_testing/todo/browser-testing.md`](../emergent_testing/todo/browser-testing.md).

**Prose is not exempt, and there is no prose yet.** Rendering `README.md` files
is still on [`todo/`](./todo/generate-website.md), and a long paragraph is
slower to read in a monospace face than a proportional one. Whoever builds that
will see it on their own page and can decide then whether rendered prose keeps
a face of its own; deciding it now, for pages that do not exist, is guessing.

## Discovery is part of the program

Which modules a browser can link is decided by reading their source, and
reading a tree is `readdir` and `readFile`. So the whole generator is one
effect and a proof drives it against `effects/node/virtual`'s in-memory tree: a
directory of fixtures in, a site out, no filesystem touched. What used to check
this was running the command and reading a `git diff`.

The cost is measured and recorded rather than assumed — see the `@module` block
in [`module.f.mjs`](./module.f.mjs) and
[`../text/todo/utf8-to-string-cost.md`](../text/todo/utf8-to-string-cost.md).

## Open questions

[`todo/`](./todo/) — the umbrella list is
[generate-website](./todo/generate-website.md).
