# Investigate generating the changelog from Git history

**Priority:** P4
**Status:** open

## Problem

Even as per-PR files ([changelog-directory.md](./changelog-directory.md)),
changelog entries are authored by hand while the same information — commits,
diffs, PR links — already exists in Git history. It may be possible to remove
the `changelog/` directory and derive the release history directly:

```
Git history -> changelog generator -> FunctionalScript website
```

This is an investigation, not a commitment: summarizing diffs at build time
would make the published notes non-deterministic and unreviewed, and Git
history is immutable, so a badly worded source could never be fixed — while a
committed entry can be fixed by a cleanup PR. The `**BREAKING CHANGES:**`
marker also drives version bumps, and that signal must stay reviewed.

## Proposal

Evaluate at least these designs before removing `changelog/`:

1. **Commit-message extraction.** The entry lives in the squash/merge commit
   message (e.g. a `Changelog:` trailer, reviewed as part of the PR). The
   generator deterministically extracts trailers between release tags — no
   summarization, reviewed text, `changelog/` genuinely redundant.
2. **Authoring assistant.** A tool drafts the entry from the PR's diff at PR
   time; the reviewed result is still committed as a `changelog/` file. The
   generator stays out of the build; `changelog/` remains the source of truth.
3. **Build-time summarization.** The generator reads commits and diffs and
   writes the prose itself. Only acceptable if the output is deterministic and
   there is a reviewed override mechanism — which tends to reinvent
   `changelog/`.

Decide on criteria: determinism of the published pages, where review happens,
how a published mistake gets fixed, and where the breaking-change signal for
versioning comes from.

## Related

- [changelog-directory.md](./changelog-directory.md) — the structure this
  would replace
- [changelog-website.md](./changelog-website.md) — the consumer that must not
  care which source feeds it
