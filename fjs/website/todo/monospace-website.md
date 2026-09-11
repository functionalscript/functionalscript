## One monospace face for the whole website

**Priority:** P3
**Status:** open

### Problem

The site is rendered in the reader's `system-ui`, chosen when it was one page
of prose about a test suite. It is now a catalogue of a source tree: every
page is mostly file names, directory names, module paths and breadcrumbs, and
one of them — the proof report — is already monospace, because a test name is
a path. So the site sets identifiers in a proportional face everywhere except
the one place it does not.

### Proposal

`body` takes a monospace stack, and the report's own rule goes away as
redundant. What has to be decided rather than assumed:

- **The stack.** `ui-monospace` first picks each platform's UI monospace face
  rather than its terminal default. A fallback chain that ends in `monospace`
  is required; naming faces that are not installed is not.
- **What prose costs.** A module page is names, but a `README.md` rendered by
  [generate-website](generate-website.md) is paragraphs, and a long paragraph
  set in a monospace face is measurably slower to read. Either prose keeps a
  proportional face — which makes this a rule about the catalogue rather than
  about `body` — or the site accepts the cost and says so.
- **Line length.** `body` is capped at `48rem`, a measure chosen for a
  proportional face. A monospace face is wider per character, so the same cap
  holds fewer words per line.

### Tasks

- [ ] Decide the stack, and whether prose is exempt.
- [ ] Apply it in `fjs/website/style/module.f.mjs`; drop what it makes
      redundant.
- [ ] Re-check the cap on line length against a page of each kind.

### Related

- [Generate website](generate-website.md) — "One `main.css`" is where this
  stylesheet came from.
- [`fjs/website`](../README.md) — the pages that made the site a catalogue.
- Raised by @sergey-shandar in review of
  [#1912](https://github.com/functionalscript/functionalscript/pull/1912).
