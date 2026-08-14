# Replace `CHANGELOG.md` with a `changelog/` directory

**Priority:** P1
**Status:** open

## Problem

Every PR adds its entry at the top of `## Unreleased` in `CHANGELOG.md`, so any
two concurrent PRs conflict on the same lines. The file is also over 2000 lines
and keeps growing.

## Proposal

Replace the single file with a directory:

```
changelog/
  README.md        <- the current CHANGELOG preamble: versioning convention,
                      entry-style rules
  unreleased/
    <PR>.md        <- one file per changelog-worthy PR, named by PR number
  <version>.md     <- retrofitted released sections, one file per release
```

- A PR adds `changelog/unreleased/<PR>.md` instead of editing a shared file —
  PR numbers are unique, so concurrent PRs can never conflict. A PR with
  several entries puts them all in its one file. The `**BREAKING CHANGES:**`
  marker keeps its meaning; at release time it is found by scanning
  `changelog/unreleased/`.
- Entry ordering: PR numbers are monotonic, so sorting filenames by number
  descending reproduces the current newest-first order.
- Releasing: concatenate `unreleased/*.md` (descending) into
  `changelog/<version>.md` and delete the entry files. Git does not store
  empty directories, so `unreleased/` needs a permanent file (`.gitkeep` or a
  one-line `README.md`).
- Retrofit: released sections move as one file per version
  (`changelog/0.44.0.md`, …). Splitting history per PR would be churn with no
  benefit — conflicts only ever happen in `unreleased` — and pre-convention
  entries have no PR number to name a file by.
- Entries stay in the Markdown subset they already use (paragraphs, list
  items, inline code, bold, PR links). Publishing the changelog on the website
  ([changelog-website.md](./changelog-website.md)) needs to render entries with
  a small self-hosted parser, so the subset is the convention, not an accident.

## Tasks

- [ ] Create `changelog/README.md` from the `CHANGELOG.md` preamble
- [ ] Retrofit released sections as `changelog/<version>.md`
- [ ] Create `changelog/unreleased/` with its permanent file and move any
      unreleased entries into per-PR files
- [ ] Delete `CHANGELOG.md`, or leave a short stub pointing at `changelog/`
- [ ] Update `AGENTS.md` §8.3 (entry workflow) and §8.4 (release step) and
      `CONTRIBUTING.md` to describe the directory

## Related

- [changelog-website.md](./changelog-website.md) — consumes this structure
- [changelog-from-git-history.md](./changelog-from-git-history.md) — may
  eventually replace this structure
