## Enforce the commit-message standard before merge

**Priority:** P3
**Status:** open — the format is adopted, in
[CONTRIBUTING.md](../CONTRIBUTING.md#commit-messages), so this is no longer
waiting on it; the linter enforces that documented rule. The gap between
adoption and enforcement is deliberate trial time, so let the format run by
hand on real PRs first: whatever it gets wrong is fixed while a fix is still a
documentation edit rather than a linter change plus a rule migration.

### Problem

Once the standard is documented, it is still only a convention: nothing stops
a PR with a malformed title, a malformed `Changelog:` section, or a behavior
change carrying no changelog note at all from merging. The format must be
machine-checked before the merge button enables, or the history the changelog
generator would read degrades one forgotten PR at a time.

### Proposal

The format is enforced *before* merge by a **required status check**: a
workflow on `pull_request` with types `[opened, edited, synchronize, reopened]`
reads the PR title and body from the event payload and fails unless the title
matches the format and any `Changelog:` section is the last section of the body
before an optional trailer block (`Co-Authored-By:`, generated-with lines,
session links — about half of recent PR bodies end with one). The section is
optional: a PR that changes neither behavior nor the public API omits it, so
its absence is not a failure — the entry file under `changelog/unreleased/` and
the section travel together, and a PR that has one without the other is what
the check catches. The `edited` trigger makes the check re-run when the title
or description is fixed — no push needed to re-green. Branch protection marks
the check required, which disables the merge button until it passes. The linter
itself is a self-hosted FunctionalScript module (`fjs/ci`), and the
changelog-subset Markdown parser planned in
[changelog-website.md](./changelog-website.md) is the validator for the
section's items.

An optional section gives up what a mandatory one bought, and the consistency
check above does not buy it back: a behavior-changing PR that forgets *both*
the entry file and the section is consistent, so it passes. Closing that needs
a second check deriving **"entry owed?" from the diff**, and the honest state
of that idea is that its predicate is not settled. Changed paths give a
*necessary* condition and not a sufficient one: a PR confined to documentation,
`todo/`, tests, and CI owes nothing, but the converse fails — an internal
refactor edits production source and owes nothing either, which the policy says
in as many words. A check keyed on paths alone would block that refactor or
push its author into a misleading release note.

So the remaining question is how a PR represents "touched production source,
changed no behavior" to a machine. The candidates: an author declaration
required only on that narrow subset — the PRs that touch source and carry no
entry, where the assertion carries information a machine cannot derive, unlike
the blanket `Changelog: none` this rule dropped; or the check stays advisory,
reporting rather than blocking, and the completeness guarantee is never
mechanical. Pick one before building it. Until then the Problem's "one
forgotten PR at a time" is unaddressed for exactly that case, and the required
check enforces shape rather than completeness.

One hole no pre-merge check covers: GitHub lets whoever clicks "Squash and
merge" edit the commit message in the merge dialog. Backstops: don't touch
the merge box (auto-merge sidesteps it entirely — it merges with the default
message); a post-merge audit job on `push` to `main` that compares the
landed message against the PR and fails loudly; commit-metadata rulesets
would block it outright but require an Enterprise plan.

### Tasks

- [ ] PR-lint workflow (title format, `Changelog:` section well-formed and
      consistent with `changelog/unreleased/<PR>.md` when either is present)
      as a self-hosted `fjs/ci` module
- [ ] Decide how a PR represents "touched production source, changed no
      behavior": a declaration scoped to that subset, or an advisory-only
      check. Paths alone cannot decide it — internal refactors touch source
      and owe no entry
- [ ] "Entry owed?" check, once that is decided: flag a PR whose diff reaches
      outside documentation, `todo/`, tests, and CI while carrying neither
      `changelog/unreleased/<PR>.md` nor a `Changelog:` section
- [ ] Branch protection: mark the lint a required status check
- [ ] Post-merge audit: on `push` to `main`, verify the landed commit
      message matches the PR title `(#NNN)` and description

### Related

- [CONTRIBUTING.md](../CONTRIBUTING.md#commit-messages) — the format this enforces
- [commit-message-standard.md](./commit-message-standard.md) — the reasoning
  behind that format, and the repository settings it still waits on
- [changelog-website.md](./changelog-website.md) — plans the changelog
  Markdown-subset parser the `Changelog:` section validator reuses
- [changelog-from-git-history.md](./changelog-from-git-history.md) — the
  investigation that consumes the history this keeps clean
