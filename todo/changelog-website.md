## Publish the changelog on the website

**Priority:** P4
**Status:** open

### Problem

The release history lives only in the repository. Users of the package should
be able to read it on the FunctionalScript website as an index of releases and
a page per release.

### Proposal

Extend the website generator (`fjs/website`) to read the `changelog/` directory
and emit an index page plus one page per release. The repository remains the
source of truth; the website is presentation.

The generator must recognize **one released form**, plus a transient directory
that may reappear
([changelog/README.md](../changelog/README.md#layout)):

- `<version>.md` — one file per release, every release. **Two reference styles,
  and both can appear in one file**: a plain `(#NNN, #NNN)` the generator turns
  into links, or a short commit SHA where the commit carries no `(#NNN)`; and an
  inline `[#NNN](url)` link already written out, which may close with a period.
  `0.46.0` mixes them, `0.45.0` is entirely links, and the oldest releases have
  neither. All must render.
- `unreleased/<PR>.md` — one file per pull request, **transient rather than
  closed**: a release empties it, and a pull request opened under the old policy
  recreates it whenever it merges, however long after the transition
  ([changelog/RELEASE.md](../changelog/RELEASE.md)). Either render it as a
  pending section or skip it, but do not build anything that assumes it exists —
  nor anything that assumes it is gone for good.

`0.45.0` through `0.48.0` were once directories of per-pull-request files, and a
generator had to join them in descending pull-request-number order and derive
each link from a file name. They are ordinary `<version>.md` files now, so that
third form is gone and no generator needs to learn it.

The main cost is rendering: the repo has no Markdown parser. Either write a
small self-hosted parser for the entry subset (paragraphs, list items, inline
code, bold, links — all the current entries use), or reconsider the entry
format. The BNF machinery is a natural fit for the parser.

### Tasks

- [ ] Parser for the changelog Markdown subset
- [ ] Read `<version>.md`, with the three reference styles its entries carry —
      a plain `(#NNN)`, a short commit SHA where a commit had no pull request,
      and an inline `[#NNN](url)` link — any of which can appear in one file
      ([changelog/README.md](../changelog/README.md#entries)) — and decide what
      to do with `unreleased/` when it exists
- [ ] Release index page and per-release pages in `fjs/website`
- [ ] Link the changelog from the landing page

### Related

- [changelog/README.md](../changelog/README.md) — the layout and the Markdown
  subset this consumes
- [commit-message-enforcement.md](./commit-message-enforcement.md) — reuses this
  parser to validate a pull request's `Changelog:` section
