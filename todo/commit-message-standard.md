## Standard for commit messages merged into `main`

**Priority:** P2
**Status:** wip — the format is adopted, in
[CONTRIBUTING.md](../CONTRIBUTING.md#commit-messages): title, `Changelog:`
section, squash-only. Release tagging was rejected, see below.
`CONTRIBUTING.md` is the normative text from now on; the proposal below is kept for the reasoning
behind it, and only the repository settings remain undone — they need a
maintainer with admin rights and cannot land in a PR.

### Problem

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

### Proposal

#### One squash commit per PR — no other merge method

- **Squash and merge only.** Disable "Create a merge commit" and "Rebase and
  merge" in the repository settings. A rebase merge replays the branch's
  commits onto `main` (GitHub rewrites committer and SHAs, but keeps each
  commit's own message): they carry no ` (#NNN)` suffix and no reviewed body,
  so the PR — the unit the changelog is written in — becomes invisible to a
  generator. A merge commit keeps the PR number but buries the content in a
  two-parent graph the generator would have to re-linearize. A squash merge
  never lands branch commits: it always creates one new commit, parented on
  the `main` tip, titled `<PR title> (#NNN)` — the last hundred first-parent
  commits on `main` already have this shape. Older history does not (486 of
  1803 first-parent commits lack the ` (#NNN)` suffix, 15 are merge commits,
  and release `0.41.0` landed by direct push as recently as 2026-08-03),
  which is the Problem section's point: the shape holds only while every
  landing goes through a squash-merged PR, and nothing enforces that today.
- **No true fast-forward is possible through the GitHub UI** — but `git push`
  from a local clone fast-forwards `main` to arbitrary commits with no PR
  information at all, which is what the branch-protection rule below closes.
- **No direct pushes to `main`.** Branch protection: require a PR, require
  linear history. Every commit on `main` is then a squash commit of exactly
  one PR, in merge order — the "correct order, nothing missed" property comes
  from this rule alone.

#### Title: the PR title, in the changelog-entry style

The squash title is the PR title, so this is a PR-title standard, checkable
before merge:

```
<topic>: <short description, imperative, lower-case after the colon>
```

- `<topic>` is the module path (`types/bit_vec`, `djs/tokenizer`) or an area
  (`ci`, `docs`, `changelog`, `AGENTS.md`) — the same topic the changelog
  entry starts with.
- ≤ 72 characters including the ` (#NNN)` GitHub appends; no `(#…)` of your
  own, no trailing period. The limit is a deliberate tightening, not current
  practice — 38 of the last 200 titles exceed it today.
- A release PR's title is the bare version: `0.45.0`.

#### Body: the PR description, carrying the changelog entry

Set the repository's default squash message to **"Pull request title and
description"**, so the body is reviewed prose instead of the intermediate
commit list. When the change affects behavior or the public API, the PR
description then contains a `Changelog:` section — the last section of the body
*before an optional trailer block* (`Co-Authored-By:`, generated-with lines,
session links; about half of recent PR bodies end with one, this PR's included,
so "ends with" would be a spec bug) — holding exactly the list items that would
go into `changelog/unreleased/<PR>.md`, in the same restricted Markdown subset,
no PR link (the title's `(#NNN)` identifies it):

```
<free prose: motivation, design, measurements — anything>

Changelog:
- `types/bit_vec`: `tryListToVec` reuses the shared balanced fold, at the
  same cost as the accumulator it replaces
```

- A PR that needs no entry (docs, `todo/`, CI-only) omits the section entirely
  — a `Changelog: none` placeholder is noise on every such PR. This is a trade,
  not a free simplification: a mandatory section made a forgotten entry
  mechanically visible, and an omitted one is indistinguishable from a
  correctly-absent one until enforcement can tell the two apart. Whether it can
  is open — changed paths rule out a documentation PR but not an internal
  refactor, which touches source and owes nothing either — so until
  [commit-message-enforcement.md](./commit-message-enforcement.md) settles the
  predicate, "no missed changelog notes" is a convention again for
  behavior-changing PRs.
- A breaking change starts its item with `**BREAKING CHANGES:**`, exactly as
  in the files — the version-bump decision reads the same marker from either
  source.
- While `changelog/unreleased/` remains the source of truth, the section and
  the file are duplicates by design: the section is the format the future
  generator would read, the file is what today's release process uses. If
  commit-message extraction wins the investigation, the files retire and the
  section remains; if it loses, the section cost was a few reviewed lines per
  PR.

#### Tag releases — rejected

This section proposed tagging each release commit `vX.Y.Z`, so that "entries
in this release" is a range between two tags rather than a parse of
version-bump titles. **Decided against**: the repository has no tags and is
not going to get any
([#1561](https://github.com/functionalscript/functionalscript/pull/1561)).
The changelog already records release membership per PR — `changelog/X.Y.Z/`
holds one file per PR that shipped in that release — so a tag would be a
second copy of a fact the tree already carries, and one a release could
forget. A generator takes the boundary from the release commit, whose title is
the bare version, or from the changelog directories themselves. Recorded in
[changelog/README.md](../changelog/README.md#breaking-changes-and-versioning) so the
question is not reopened by the next reader.

### Tasks

- [ ] Repository settings: squash-only, default squash message "Pull request
      title and description", branch protection (PRs required, linear
      history). Until these are set, the documented format is a convention a
      maintainer can defeat with one click in the merge dialog or one
      `git push`.
- [x] Document the title and `Changelog:` section format once adopted —
      [CONTRIBUTING.md](../CONTRIBUTING.md#commit-messages)

Machine-checking the format before merge is a separate, later step:
[commit-message-enforcement.md](./commit-message-enforcement.md), unblocked
by the AGENTS.md adoption above.

### Related

- [commit-message-enforcement.md](./commit-message-enforcement.md) — the
  pre-merge check that turns this convention into a rule; starts after the
  AGENTS.md adoption
- [changelog-from-git-history.md](./changelog-from-git-history.md) — the
  investigation this keeps possible; its "commit-message extraction" design
  reads the `Changelog:` section defined here
- [changelog/README.md](../changelog/README.md) — the entry format the
  `Changelog:` section reuses
- [changelog-website.md](./changelog-website.md) — the consumer that must not
  care which source feeds it
