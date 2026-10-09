## Enforce the commit-message standard before merge

**Priority:** P3
**Status:** open

### Problem

The format is adopted, in
[CONTRIBUTING.md](../CONTRIBUTING.md#commit-messages), so this issue no longer
waits on it; the linter enforces that documented rule. The gap between adoption
and enforcement is deliberate trial time, so let the format run by hand on real
pull requests first: whatever it gets wrong is fixed while a fix is still a
documentation edit rather than a linter change plus a rule migration.

The format is a convention: nothing stops a pull request with a malformed title
or a malformed `Changelog:` section from merging. And by hand it is not
holding. At `36c8d4a`, seven of the nine merges on `main` from
[#2268](https://github.com/functionalscript/functionalscript/pull/2268) to
[#2276](https://github.com/functionalscript/functionalscript/pull/2276) carry
no `<topic>:` title — "Refactor id prefix-tag scheme into reusable factory",
"Extract empty path handling into reusable helper" and so on; only #2272 and
#2275 follow the format.

Before 1.0, `Changelog:` sections and breaking-change notices are optional.
Regular releases always advance the minor; urgent fixes follow the released
maintenance line ([changelog/README.md](../changelog/README.md#breaking-changes-and-versioning)).
The linter must not require a notice or derive pre-1.0 bumps from declarations.

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
module (`fjs/ci`), and the changelog-subset Markdown parser
[`fjs/media/markdown`](../fjs/media/markdown/module.f.mjs) validates the
section's items.

#### What no pre-merge check can decide

Whether a pull request breaks the public API. Before 1.0 that judgment does not
select the version bump, and notices are optional. From 1.0 onward, declarations
are required, but a format check still cannot confirm that the author declared
every break. An API-surface diff could report candidates; behavior changes can
escape it, so it would need its own proposal and could not replace review.

A release-side check can validate regular pre-1.0 minor bumps and urgent patch
progression from the corresponding release commit without parsing notices.
From 1.0 onward, a declaration-based check would need an enforced-format window;
unstructured historical descriptions can advise, never establish completeness.
Commits without a pull request number still need a diff audit for release notes,
regardless of version policy.

One hole no pre-merge check covers: GitHub lets whoever clicks the merge button
edit the commit message in the merge dialog. Backstops: don't touch the merge
box (auto-merge sidesteps it entirely — it merges with the default message); a
post-merge audit job on `push` to `main` that compares the landed message
against the pull request and fails loudly; commit-metadata rulesets would block
it outright but require an Enterprise plan.

### Tasks

- [ ] PR-lint workflow (title format; `Changelog:` section well-formed when
      present) as a self-hosted `fjs/ci` module
- [ ] Release-side check: before 1.0 validate regular `0.X.0` releases and
      urgent fixes `0.X.1`, then successive patches from the prior fix release,
      based on the corresponding release commit. Do not require or parse
      breaking-change notices to select a pre-1.0 bump. Use `origin/main` for
      regular windows and the maintenance tip for urgent windows
- [ ] Design the 1.0-and-later declaration-based check separately, after the
      PR lint enforces the format. Account for missing pull request numbers and
      unenforced history; a parsed notice cannot prove all breaks were declared
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
  - [ ] **require branches to be up to date before merging.** This is what
        closes the release's time-of-check/time-of-merge gap: a release pull
        request scans `origin/main`, and anything merging between that scan and
        the release merge ships unrecorded
        ([changelog/RELEASE.md](../changelog/RELEASE.md#7-open-the-release-pull-request)).
        The setting blocks the merge button once `main` advances, turning a race
        into a forced re-scan
- [ ] Post-merge audit: on `push` to `main`, verify the landed commit message
      matches the pull request title `(#NNN)` and description
- [ ] File the API-surface diff separately if it is wanted; do not fold it into
      the linter

### Related

- [CONTRIBUTING.md](../CONTRIBUTING.md#commit-messages) — the format this
  enforces, and the reasoning for merge-commits-only
- [changelog/RELEASE.md](../changelog/RELEASE.md) — the release procedure whose
  inputs include descriptions, diffs, and optional release-note sections
- [`fjs/media/markdown`](../fjs/media/markdown/module.f.mjs) — the changelog
  Markdown-subset parser the section validator reuses, and
  [`fjs/ebnf/lib/markdown`](../fjs/ebnf/lib/markdown/module.f.mjs) the grammar
  it reads the subset with
