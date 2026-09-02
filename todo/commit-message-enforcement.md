## Enforce the commit-message standard before merge

**Priority:** P3
**Status:** open — the format is adopted, in
[CONTRIBUTING.md](../CONTRIBUTING.md#commit-messages), so this is no longer
waiting on it; the linter enforces that documented rule. The gap between
adoption and enforcement is deliberate trial time, so let the format run by
hand on real pull requests first: whatever it gets wrong is fixed while a fix is
still a documentation edit rather than a linter change plus a rule migration.

### Problem

The format is a convention: nothing stops a pull request with a malformed title
or a malformed `Changelog:` section from merging.

One failure in that set costs more than the rest. Since the changelog is
collected at release time ([changelog/RELEASE.md](../changelog/RELEASE.md)), the
`**BREAKING CHANGES:**` declaration is the *only* thing a pull request still
owes the changelog, and it is the input to the version-bump decision. A
forgotten declaration ships a break as a patch release, which
[changelog/README.md](../changelog/README.md#breaking-changes-and-versioning)
promises is a safe upgrade. Everything else the linter would catch is cosmetic
next to that.

### Proposal

A **required status check**: a workflow on `pull_request` with types
`[opened, edited, synchronize, reopened]` reads the title and body from the
event payload and fails unless

- the title matches `<topic>: <short description>` — or `Release X.Y.Z` for a
  release — within 72 characters including the ` (#NNN)` GitHub appends, with no
  `(#NNN)` written by the author, and
- a `Changelog:` section, **when present**, is the last section of the body
  before an optional trailer block (`Co-Authored-By:`, generated-with lines,
  session links — about half of recent bodies end with one) and holds list items
  in the entry Markdown subset.

The `edited` trigger re-runs the check when the title or description is fixed —
no push needed to re-green. Branch protection marks it required, which disables
the merge button until it passes. The linter is a self-hosted FunctionalScript
module (`fjs/ci`), and the changelog-subset Markdown parser planned in
[changelog-website.md](./changelog-website.md) validates the section's items.

#### What no pre-merge check can decide

Whether a pull request breaks the public API. The declaration is an author
assertion, and a check that reads the diff cannot replace it — that is why
CONTRIBUTING.md states the consequence rather than promising a guard. Two things
narrow the hole, and neither closes it:

1. **A release-side check, which *is* decidable.** Given a release pull request,
   the window is a `git log --first-parent` range, the declarations are
   `**BREAKING CHANGES:**` occurrences in those merge-commit bodies, and the
   bump is the `package.json` diff. Comparing the three is mechanical, and it
   catches the release that undercounts — a real failure mode, since one person
   reads a whole window by hand. It cannot see a break nobody declared.
2. **An API-surface diff.** The package emits `.d.ts`/`.d.mts` declarations, so
   a job could build them for base and head and report removed or narrowed
   declarations. That flags the `readonly`-added-to-a-tuple case a human misses.
   It is a much larger tool than a PR linter, it reports candidates rather than
   verdicts (a removed declaration nobody imported is not a break worth a bump,
   and a behavior break shows up in no declaration at all), and it should be its
   own issue before anyone starts it.

One hole no pre-merge check covers: GitHub lets whoever clicks the merge button
edit the commit message in the merge dialog. Backstops: don't touch the merge
box (auto-merge sidesteps it entirely — it merges with the default message); a
post-merge audit job on `push` to `main` that compares the landed message
against the pull request and fails loudly; commit-metadata rulesets would block
it outright but require an Enterprise plan.

### Tasks

- [ ] PR-lint workflow (title format; `Changelog:` section well-formed when
      present) as a self-hosted `fjs/ci` module
- [ ] Release-side check: the version bump in a release pull request agrees with
      the `**BREAKING CHANGES:**` declarations in its window, or the description
      says which break the window undid
- [ ] Repository settings, which need a maintainer with admin rights and cannot
      land in a pull request:
  - [ ] disable "Squash and merge" and "Rebase and merge" — the repository
        always merges, to keep the branch's real history and the
        `(#NNN)`-suffixed first-parent line the release listing reads
        ([CONTRIBUTING.md](../CONTRIBUTING.md#commit-messages))
  - [ ] branch protection: require a pull request, no direct pushes to `main`.
        `git push` from a local clone still advances `main` with no pull request
        information at all — release `0.41.0` landed that way on 2026-08-03 —
        and the "every commit is one reviewed pull request" property the release
        listing depends on comes from this rule alone
  - [ ] mark the lint a required status check
- [ ] Post-merge audit: on `push` to `main`, verify the landed commit message
      matches the pull request title `(#NNN)` and description
- [ ] File the API-surface diff separately if it is wanted; do not fold it into
      the linter

### Related

- [CONTRIBUTING.md](../CONTRIBUTING.md#commit-messages) — the format this
  enforces, and the reasoning for merge-commits-only
- [changelog/RELEASE.md](../changelog/RELEASE.md) — the release procedure whose
  only per-pull-request input is the declaration this checks
- [changelog-website.md](./changelog-website.md) — plans the changelog
  Markdown-subset parser the section validator reuses
