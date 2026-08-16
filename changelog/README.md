# Changelog

All notable changes to this project are documented in this directory.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Layout

```
changelog/
  README.md        this file
  unreleased/
    <PR>.md        entries not released yet, one file per pull request
  <version>/
    <PR>.md        one directory per released version, entry files kept as-is
  <version>.md     one file per released version (releases through 0.44.0)
```

A pull request adds `changelog/unreleased/<PR>.md` named by its own number, so
two pull requests can never conflict on the same lines. A pull request with
several entries puts them all in its one file. Releasing renames
`changelog/unreleased/` to `changelog/<version>/`, keeping the entry files
exactly as they are. Git does not track empty directories, so `unreleased/`
simply does not exist between a release and the next pull request that adds an
entry — that pull request recreates it by adding its file.

Releases through `0.44.0` predate the directory-per-version layout: each is a
single `<version>.md` file whose entries were concatenated in descending
pull-request-number order. They stay as they are; a renderer of the changelog
reads both forms.

Entries are therefore ordered by pull-request number, not by merge order — a
pull request opened earlier can merge after one opened later. The deviation is
accepted: pull-request order is deterministic and conflict-free.

## Entries

To add an entry, first open the pull request to obtain its number, then create
`changelog/unreleased/<PR>.md` named by that number — recreating
`changelog/unreleased/` if a release just consumed it. Entries are created after
the pull request exists precisely because the file is named by its number. Write
them in the `Topic: short description` style, with no pull-request number or link
inside the file — the file name already carries the number, and a renderer
derives the link from it. A pull request with several entries puts them all in
its one file, most important first.

Only add entries for changes that affect behavior or the public API — a pull
request that doesn't (internal refactors, test-only changes, coverage
improvements, and pull requests that only touch `todo/`, `AGENTS.md`, or other
documentation files) does not need one, and says `Changelog: none` in the
description instead.

- **Keep it short.** An entry is **at most a few lines** (about three wrapped
  lines, ~250 characters) — what changed and, when it isn't obvious, why. It is a
  release note for users of the package, not a design document. Rationale,
  migration walkthroughs, measurements, and alternatives-considered belong in the
  pull request description, the relevant `README.md`, or JSDoc on the affected
  exports; the entry's file name identifies the pull request, so a reader can go
  there for the full story.
- **No links.** The file name is the pull-request number, so an entry neither
  repeats it nor links to the pull request. Do not link to — or name in plain
  text — an issue or `todo/` file either: issue files are deleted when the work
  is done, so those references rot and mean nothing to a reader of the published
  package.
- **A file holds list items only.** No heading — the version or pull-request
  number is the file name — and no Markdown beyond paragraphs, list items,
  inline code, and bold, so the website can render entries with a small
  self-hosted parser. That subset is a convention rather than an accident. A
  `<version>.md` file that is empty retrofits a released section that recorded
  no entries.
- These rules govern **new** entries. Don't rewrite a released entry as a side
  effect of an unrelated pull request — a feature pull request touches its own
  file and nothing else. Entries written before this convention end with an
  inline `[#NNN](url)` pull-request link (and the oldest have none); they are
  published history, so leave them as they are. A deliberate cleanup pass over
  past releases is a legitimate pull request of its own (this convention arrived
  as one), and no released text is lost when it happens: the full prior wording
  stays in the pull request and in git history.

## Breaking changes and versioning

- Make breaking changes whenever they are the right design — don't preserve a
  worse API (e.g. a stale re-export or a non-canonical export location) just to
  avoid churn, and don't treat "it's already published" as a reason to keep a
  shape (see [DESIGN.md §2](../DESIGN.md#2-the-api-is-the-most-important-part-of-quality)).
  The version number is what lets consumers stay on the old API; a released
  version is immutable, so nothing is taken away from anyone by improving the
  next one. When a change breaks the public API, prefix its CHANGELOG entry with
  `**BREAKING CHANGES:**` and update every importer in the same pull request
  rather than keeping a compatibility shim.
- **The project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html),
  and the CHANGELOG decides which number moves.** A `**BREAKING CHANGES:**` entry
  anywhere in `changelog/unreleased/` means the release shipping it cannot be a
  patch. The package is still pre-1.0, where the leading `0.` is pinned and the
  *minor* position plays the role the major one plays after 1.0:

  | `changelog/unreleased/` contains            | Pre-1.0 — `0.Y.Z` | 1.0 and later — `X.Y.Z` |
  | ------------------------------------------- | ----------------- | ----------------------- |
  | at least one `**BREAKING CHANGES:**` entry  | `0.(Y+1).0`       | `(X+1).0.0`             |
  | new features, nothing breaking              | `0.Y.(Z+1)`       | `X.(Y+1).0`             |
  | fixes only                                  | `0.Y.(Z+1)`       | `X.Y.(Z+1)`             |

  Pre-1.0 the leading `0.` costs one position, and the distinction it costs is
  feature-vs-fix, not the break signal: `0.Y` moves **only** for a breaking
  change, and everything else — new features included — is a patch. That is
  deliberate. `^0.41.0` and `~0.41.0` both resolve to `>=0.41.0 <0.42.0` under
  npm (Cargo's bare `0.41.0` and JSR/Deno agree), so while the package is pre-1.0
  the minor is the only upgrade boundary a resolver enforces. Reserving it for
  breaking changes makes crossing it mean "something broke, read the entries" and
  makes every patch release a safe upgrade that still delivers features — the
  same contract the 1.0-and-later column gives, one position to the left. SemVer
  §4 leaves `0.y.z` undefined ("Anything MAY change at any time"), so this is a
  convention chosen inside the spec rather than a departure from it.

  A bigger bump is a number, not a cost — it never argues for holding back a
  breaking change, it only records that one happened. Releases through `0.41.0`
  predate this convention and took a minor bump for feature-only releases too
  (`0.35.0`, `0.33.0`); they are published, so leave their numbers alone.
- Releasing is its own commit: the version lives in `package.json` (`"version"`)
  — `deno.json` holds tasks and formatting only. When it's bumped, rename
  `changelog/unreleased/` to `changelog/X.Y.Z/`, keeping the entry files
  exactly as they are. The next pull request that adds an entry recreates
  `changelog/unreleased/`. Releases through `0.44.0` are single
  `changelog/X.Y.Z.md` files; leave them as they are.
- **After every update of the release pull request from `main`, check that
  `changelog/unreleased/` is empty.** A pull request merged after the rename puts
  its entry file back into `changelog/unreleased/`, and an update from `main`
  carries it into the release branch — outside the renamed directory. Move any
  such file into `changelog/X.Y.Z/` before merging the release, or its change
  ships unrecorded in the changelog. Check again right before merging.
- **The repository has no Git tags and is not going to get any.** "Which
  entries shipped in this release" is answered by `changelog/X.Y.Z/`, which
  holds one file per pull request that shipped in it; a tag would be a second
  copy of that fact, kept in step by hand.
