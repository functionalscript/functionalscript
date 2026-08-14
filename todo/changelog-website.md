# Publish the changelog on the website

**Priority:** P4
**Status:** blocked
**Blocked by:** [Replace `CHANGELOG.md` with a `changelog/` directory](./changelog-directory.md)

## Problem

The release history lives only in the repository. Users of the package should
be able to read it on the FunctionalScript website as an index of releases and
a page per release.

## Proposal

Extend the website generator (`fjs/website`) to read the `changelog/`
directory and emit an index page plus one page per release. The repository
remains the source of truth; the website is presentation.

The main cost is rendering: the repo has no Markdown parser. Either write a
small self-hosted parser for the entry subset (paragraphs, list items, inline
code, bold, links — all the current entries use), or reconsider the entry
format. The BNF machinery is a natural fit for the parser.

## Tasks

- [ ] Parser for the changelog Markdown subset
- [ ] Release index page and per-release pages in `fjs/website`
- [ ] Link the changelog from the landing page

## Related

- [changelog-directory.md](./changelog-directory.md) — defines the structure
  and the Markdown subset this consumes
