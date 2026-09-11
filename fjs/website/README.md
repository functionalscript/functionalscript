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
listing its files, its subdirectories, the issues in its `todo/`, and the
proofs of its subtree. Sections with nothing in them are omitted.

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

**No browser operation exists yet, so `O` is `never` and every demo is pure.**
The parameter is there so the first operation is a widening rather than a
second kind of demo. Until then the runtime runs an effect that can only be a
value, and a demo told *no* is a path that cannot be reached: answering
`notImplemented` needs a declared vocabulary to recognise the command against,
and there is none. `fjs/effects/browser/` brings the first operation, the
vocabulary, the partial runner that can decline, and the test for it together.

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
