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

1. **A release-side check — decidable, but only over an enforced window.**
   Given a release pull request, the window is a `git log --first-parent` range
   against `origin/main` and the bump is the `package.json` diff. What sits
   between them, the set of declarations, is the hard part, and it is worth
   measuring before anyone builds this.

   **Both instruments fail on the only real window.** Of the thirteen breaks
   declared in `changelog/unreleased/`, nine are also declared somewhere in their
   merge body — in three different shapes:

   | shape | pull requests |
   | --- | --- |
   | a bare `Changelog:` label | #1803, #1807, #1808 |
   | a `## Changelog` heading | #1818, #1822, #1827, #1828, #1832 |
   | neither | #1806 |

   So a parser keyed on the documented bare label finds **three of nine**; a
   heading-tolerant one finds eight. Neither finds #1806, whose marker appears
   only inside a `## Breaking change` prose section, in a sentence *about* its
   entry file's declaration — and whose break is real: `browser.mjs` moved to
   `browser/module.mjs` with no compatibility file. A body-wide scan would find
   #1806 and then also fire on every sentence that merely names the marker,
   including this file and this issue's own pull request description, which
   carries it in prose and has no `Changelog:` section at all.

   Choosing an instrument therefore trades one error direction for the other; it
   does not remove either. Scanning over-reports on prose, parsing under-reports
   on anything that did not use the documented shape, and on today's history the
   under-reporting is the larger error by six.

   **This is why the check is sequenced after the PR-lint, not beside it.** The
   parse is only sound over pull requests that landed while a format was
   enforced; over the unenforced history above it can advise, never decide, and
   it must not be described as catching the release that undercounts. Build the
   lint first, then this check over the window the lint has governed. The section
   parser [changelog-website.md](./changelog-website.md) plans is what makes the
   parse a parse rather than a `grep` — [AGENTS.md
   §6](../AGENTS.md#6-external-tools): a pattern over text cannot tell a
   declaration from the same characters quoted in a sentence about declarations.

   **And even then the guarantee is narrow.** #1806 would satisfy a lint that
   validates a `Changelog:` section *when present*, because it has none. The
   check can confirm the enforced format was followed and that the bump matches
   what the format captured; it cannot confirm the author declared the break at
   all. That gap is the one the API-surface diff below is for.
2. **An API-surface diff.** The package emits `.d.ts`/`.d.mts` declarations, so
   a job could build them for base and head and report removed or narrowed
   declarations. That flags the `readonly`-added-to-a-tuple case a human misses.
   A removed or narrowed public declaration is a break whether or not anything
   in this repository imported it: the consumers the version number exists for
   are not visible to a repository search, and
   [rtti-type-system](./rtti-type-system.md) already settles the point — "no
   internal importer" is a necessary condition, not the whole one. Every such
   declaration is therefore accounted for explicitly, never dismissed by
   in-repo usage.

   What keeps such a tool a reporter of candidates rather than a source of
   verdicts is the other direction: a behavior break shows up in no declaration
   at all, and a changed `_` alias may leave the expanded public contract
   unchanged (the `_` contract in
   [`fjs/fsc/README.md`](../fjs/fsc/README.md#private-types)). It is a much
   larger tool than a PR linter and should be its own issue before anyone
   starts it.

One hole no pre-merge check covers: GitHub lets whoever clicks the merge button
edit the commit message in the merge dialog. Backstops: don't touch the merge
box (auto-merge sidesteps it entirely — it merges with the default message); a
post-merge audit job on `push` to `main` that compares the landed message
against the pull request and fails loudly; commit-metadata rulesets would block
it outright but require an Enterprise plan.

### Tasks

- [ ] PR-lint workflow (title format; `Changelog:` section well-formed when
      present) as a self-hosted `fjs/ci` module
- [ ] Release-side check, **after** the lint is in force: the version bump in a
      release pull request agrees with the `**BREAKING CHANGES:**` declarations
      in its window — read as items of each merge body's parsed `Changelog:`
      section, never as matches anywhere in the body — or the description says
      which break the window undid. The window is derived against `origin/main`,
      never against the release branch. Over pull requests that predate the lint
      the check reports rather than blocks: measured on the window since the
      `0.48.0` release, the documented shape covers three of nine declarations
- [ ] Decide how that check treats a commit with no `(#NNN)`. It has no merge
      body to parse, so the check sees no declaration where
      [changelog/RELEASE.md](../changelog/RELEASE.md#2-list-the-pull-requests-in-the-window)
      requires the release author to read its diff and declare for it — the check
      would then approve a patch for a declared break, or contradict a minor the
      author chose deliberately. Two ways out: make the no-direct-push and
      no-rebase settings below a prerequisite, so the case cannot arise, or give
      the release pull request a place to record the audit and read it as an
      input alongside the parsed sections. The first is cleaner and the second is
      what holds until the settings land
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
  only per-pull-request input is the declaration this checks
- [changelog-website.md](./changelog-website.md) — plans the changelog
  Markdown-subset parser the section validator reuses
