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

The generator must recognize three release forms
([changelog/README.md](../changelog/README.md#layout)). One is written today,
one is a closed range, and one is transient:

- `<version>.md` — one file per release, the current form and also the form used
  through `0.44.0`. The two eras differ in how an entry names its pull requests:
  a current entry ends with a plain `(#NNN, #NNN)` reference the generator turns
  into links, or a short commit SHA where the change arrived without a pull
  request, while a file through `0.44.0` ends with an inline `[#NNN](url)` link
  already (the oldest have none). All must render.
- `<version>/<PR>.md` — one directory per release holding one file per pull
  request, `0.45.0` through `0.48.0` only. Entries carry no reference at all;
  the generator derives each pull-request link from the file name, joining a
  release's files in descending pull-request-number order.
- `unreleased/<PR>.md` — the same shape, and **transient rather than closed**: a
  release empties it, and a pull request opened under the old policy recreates it
  whenever it merges, however long after the transition
  ([changelog/RELEASE.md](../changelog/RELEASE.md)). Either render it as a
  pending section or skip it, but do not build anything that assumes it exists —
  nor anything that assumes it is gone for good.

The main cost is rendering: the repo has no Markdown parser. Either write a
small self-hosted parser for the entry subset (paragraphs, list items, inline
code, bold, links — all the current entries use), or reconsider the entry
format. The BNF machinery is a natural fit for the parser.

### Tasks

- [ ] Parser for the changelog Markdown subset
- [ ] Read all three release forms, with the three reference styles a current
      entry can end in — plain `(#NNN)`, an inline `[#NNN](url)` in files through
      `0.44.0`, and a short commit SHA for a change that arrived without a pull
      request ([changelog/README.md](../changelog/README.md#entries)) — and the
      file-name derivation for the directory form
- [ ] Release index page and per-release pages in `fjs/website`
- [ ] Link the changelog from the landing page

### Related

- [changelog/README.md](../changelog/README.md) — the layout and the Markdown
  subset this consumes
- [commit-message-enforcement.md](./commit-message-enforcement.md) — reuses this
  parser to validate a pull request's `Changelog:` section
