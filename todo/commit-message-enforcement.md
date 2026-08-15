# Enforce the commit-message standard before merge

**Priority:** P3
**Status:** open — the format is adopted, in
[CONTRIBUTING.md](../CONTRIBUTING.md#commit-messages), so this is no longer
waiting on it; the linter enforces that documented rule. The gap between
adoption and enforcement is deliberate trial time, so let the format run by
hand on real PRs first: whatever it gets wrong is fixed while a fix is still a
documentation edit rather than a linter change plus a rule migration.

## Problem

Once the standard is documented, it is still only a convention: nothing stops
a PR with a malformed title or a missing `Changelog:` section from merging.
The format must be machine-checked before the merge button enables, or the
history the changelog generator would read degrades one forgotten PR at a
time.

## Proposal

The format is enforced *before* merge by a **required status check**: a
workflow on `pull_request` with types `[opened, edited, synchronize,
reopened]` reads the PR title and body from the event payload and fails
unless the title matches the format and the body contains a `Changelog:`
section as its last section before an optional trailer block
(`Co-Authored-By:`, generated-with lines, session links — about half of
recent PR bodies end with one). The `edited` trigger makes the check re-run
when the title or description is fixed — no push needed to re-green. Branch protection marks
the check required, which disables the merge button until it passes. The
linter itself is a self-hosted FunctionalScript module (`fjs/ci`), and the
changelog-subset Markdown parser planned in
[changelog-website.md](./changelog-website.md) is the validator for the
section's items.

One hole no pre-merge check covers: GitHub lets whoever clicks "Squash and
merge" edit the commit message in the merge dialog. Backstops: don't touch
the merge box (auto-merge sidesteps it entirely — it merges with the default
message); a post-merge audit job on `push` to `main` that compares the
landed message against the PR and fails loudly; commit-metadata rulesets
would block it outright but require an Enterprise plan.

## Tasks

- [ ] PR-lint workflow (title format, `Changelog:` section present and
      valid) as a self-hosted `fjs/ci` module
- [ ] Branch protection: mark the lint a required status check
- [ ] Post-merge audit: on `push` to `main`, verify the landed commit
      message matches the PR title `(#NNN)` and description

## Related

- [CONTRIBUTING.md](../CONTRIBUTING.md#commit-messages) — the format this enforces
- [commit-message-standard.md](./commit-message-standard.md) — the reasoning
  behind that format, and the repository settings it still waits on
- [changelog-website.md](./changelog-website.md) — plans the changelog
  Markdown-subset parser the `Changelog:` section validator reuses
- [changelog-from-git-history.md](./changelog-from-git-history.md) — the
  investigation that consumes the history this keeps clean
