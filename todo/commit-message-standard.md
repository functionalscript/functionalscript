# Standard for commit messages merged into `main`

**Priority:** P2
**Status:** proposed

## Problem

[changelog-from-git-history.md](./changelog-from-git-history.md) investigates
deriving the changelog from Git history. Whatever that investigation decides,
it can only ever read the history that exists — every PR merged before the
messages are standardized adds a commit the generator cannot parse. So the
message format must be fixed **now**, ahead of the P4 investigation, or the
option quietly expires.

Today `main` receives squash commits whose *title* is already uniform — GitHub
uses the PR title and appends ` (#NNN)` — but whose *body* is GitHub's default
concatenation of the branch's intermediate commit messages: unreviewed noise
("Drop stray blank line…", "Address review…") that no generator can use.
Releases are not tagged (`git tag` is empty), so release boundaries exist only
as version-bump commit titles.

## Proposal

### One squash commit per PR — no other merge method

- **Squash and merge only.** Disable "Create a merge commit" and "Rebase and
  merge" in the repository settings. A rebase merge fast-forwards the branch's
  commits onto `main` as-is: they carry no ` (#NNN)` suffix and no reviewed
  body, so the PR — the unit the changelog is written in — becomes invisible
  to a generator. A merge commit keeps the PR number but buries the content in
  a two-parent graph the generator would have to re-linearize.
- **No direct pushes to `main`.** Branch protection: require a PR, require
  linear history. Every commit on `main` is then a squash commit of exactly
  one PR, in merge order — the "correct order, nothing missed" property comes
  from this rule alone.

### Title: the PR title, in the changelog-entry style

The squash title is the PR title, so this is a PR-title standard, checkable
before merge:

```
<topic>: <short description, imperative, lower-case after the colon>
```

- `<topic>` is the module path (`types/bit_vec`, `djs/tokenizer`) or an area
  (`ci`, `docs`, `changelog`, `AGENTS.md`) — the same topic the changelog
  entry starts with.
- ≤ 72 characters including the ` (#NNN)` GitHub appends; no `(#…)` of your
  own, no trailing period.
- A release PR's title is the bare version: `0.45.0`.

### Body: the PR description, carrying the changelog entry

Set the repository's default squash message to **"Pull request title and
description"**, so the body is reviewed prose instead of the intermediate
commit list. The PR description then ends with a `Changelog:` section — the
last section of the body, holding exactly the list items that would go into
`changelog/unreleased/<PR>.md`, in the same restricted Markdown subset, no PR
link (the title's `(#NNN)` identifies it):

```
<free prose: motivation, design, measurements — anything>

Changelog:
- `types/bit_vec`: `tryListToVec` reuses the shared balanced fold, at the
  same cost as the accumulator it replaces
```

- A PR that needs no entry (docs, `todo/`, CI-only) writes `Changelog: none`.
  The section is **mandatory** either way — its absence is a lint failure,
  which is what makes "no missed changelog notes" checkable instead of hoped.
- A breaking change starts its item with `**BREAKING CHANGES:**`, exactly as
  in the files — the version-bump decision reads the same marker from either
  source.
- While `changelog/unreleased/` remains the source of truth, the section and
  the file are duplicates by design: the section is the format the future
  generator would read, the file is what today's release process uses. If
  commit-message extraction wins the investigation, the files retire and the
  section remains; if it loses, the section cost was a few reviewed lines per
  PR.

### Tag releases

Tag each release commit `vX.Y.Z` when it lands on `main`. Between-tags is the
natural range query for "entries in this release"; falling back to parsing
version-bump titles works but is a heuristic where a tag is a fact.

## Tasks

- [ ] Repository settings: squash-only, default squash message "Pull request
      title and description", branch protection (PRs required, linear
      history)
- [ ] Document the title and `Changelog:` section format in AGENTS.md §8 once
      adopted
- [ ] CI check on the PR (title lints against the format; body contains a
      `Changelog:` section) — `fjs/ci` is the natural home
- [ ] Tag `v0.45.0` at the next release and each release after

## Related

- [changelog-from-git-history.md](./changelog-from-git-history.md) — the
  investigation this keeps possible; its "commit-message extraction" design
  reads the `Changelog:` section defined here
- [changelog/README.md](../changelog/README.md) — the entry format the
  `Changelog:` section reuses
- [changelog-website.md](./changelog-website.md) — the consumer that must not
  care which source feeds it
