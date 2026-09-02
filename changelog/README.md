# Changelog

All notable changes to this project are documented in this directory.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries are written **once per release**, from the pull requests that shipped in
it. A pull request adds no changelog file; what it owes instead — a
`**BREAKING CHANGES:**` declaration when it breaks the public API — is in
[CONTRIBUTING.md](../CONTRIBUTING.md#commit-messages). The release procedure that
reads those pull requests and writes the file is [RELEASE.md](./RELEASE.md).

## Layout

```
changelog/
  README.md        this file
  RELEASE.md       how a release collects its entries
  <version>.md     one file per release — the current form
  <version>/
    <PR>.md        one directory per release, 0.45.0 through 0.48.0
  unreleased/
    <PR>.md        left over from the per-pull-request scheme; the next
                   release consumes it (RELEASE.md, "Transition")
```

A renderer of the changelog reads three forms, and only the first is written
today:

- **`<version>.md`** — one file per release, holding that release's entries in
  order of importance. Releases through `0.44.0` and every release from the one
  that follows this convention. The two eras differ in one detail: the older
  files end an entry with an inline `[#NNN](url)` pull-request link (the oldest
  have none), while a current file writes a plain `(#NNN)` reference the
  renderer turns into a link.
- **`<version>/<PR>.md`** — one directory per release holding one file per pull
  request, `0.45.0` through `0.48.0`. Entries carry no pull-request reference at
  all: the file name is the number. Render a release by joining its files in
  descending pull-request-number order.
- **`unreleased/<PR>.md`** — the same, for work not yet released. Nothing adds to
  it any more, but a pull request opened under the old policy recreates it
  whenever it merges, so a release consumes it whenever it is non-empty
  ([RELEASE.md](./RELEASE.md)).

Released files are published history. A `<version>.md` file that is empty
records a release that shipped no notable change.

## Entries

An entry is one Markdown list item, written in the `Topic: short description`
style — the topic is the module path (`types/bit_vec`, `djs/tokenizer`) or an
area (`ci`, `docs`), the same topic the pull request title starts with. How to
decide what gets an entry, how to group several pull requests into one, and how
to order them: [RELEASE.md](./RELEASE.md).

- **Keep it short.** At most a few lines — about three wrapped lines, ~250
  characters — saying what changed and, when it isn't obvious, why. It is a
  release note for users of the package, not a design document. Rationale,
  migration walkthroughs, measurements, and alternatives considered belong in
  the pull request description, the relevant `README.md`, or JSDoc on the
  affected exports.
- **Reference pull requests, don't link them.** An entry ends with the numbers
  it came from in parentheses — `(#1807, #1813, #1825, #1831)` — and the
  renderer derives each link. Do not link to, or name in plain text, an issue or
  a `todo/` file: issue files are deleted when the work is done, so those
  references rot and mean nothing to a reader of the published package.
- **List items only.** No heading — the version is the file name — and no
  Markdown beyond paragraphs, list items, inline code, and bold, so the website
  can render entries with a small self-hosted parser. That subset is a
  convention rather than an accident.
- **A breaking entry starts with `**BREAKING CHANGES:**`** and states the old
  shape, the new one, and the one-line migration.
- These rules govern **new** entries. Don't rewrite a released entry as a side
  effect of an unrelated pull request. Entries written before a convention
  arrived are published history; leave them as they are. A deliberate cleanup
  pass over past releases is a legitimate pull request of its own (both
  conventions arrived as one), and no released text is lost when it happens: the
  full prior wording stays in the pull request and in git history.

## Breaking changes and versioning

- Make breaking changes whenever they are the right design — don't preserve a
  worse API (e.g. a stale re-export or a non-canonical export location) just to
  avoid churn, and don't treat "it's already published" as a reason to keep a
  shape (see [DESIGN.md §2](../DESIGN.md#2-the-api-is-the-most-important-part-of-quality)).
  The version number is what lets consumers stay on the old API; a released
  version is immutable, so nothing is taken away from anyone by improving the
  next one. When a change breaks the public API, declare it with
  `**BREAKING CHANGES:**` in the pull request description and update every
  importer in the same pull request rather than keeping a compatibility shim.
- **The project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html),
  and the CHANGELOG decides which number moves.** A `**BREAKING CHANGES:**`
  declaration on any pull request in the release window means the release
  shipping it cannot be a patch — unless the window itself undid the break, which
  the release pull request says in as many words
  ([RELEASE.md](./RELEASE.md#4-group-by-net-effect)). The package is still
  pre-1.0, where the leading `0.` is pinned and the *minor* position plays the
  role the major one plays after 1.0:

  | the release window contains                 | Pre-1.0 — `0.Y.Z` | 1.0 and later — `X.Y.Z` |
  | ------------------------------------------- | ----------------- | ----------------------- |
  | at least one surviving breaking change      | `0.(Y+1).0`       | `(X+1).0.0`             |
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
- Releasing is its own pull request, titled `Release X.Y.Z`: the version lives in
  `package.json` (`"version"`) — `deno.json` holds tasks and formatting only —
  and the entries are collected into `changelog/X.Y.Z.md` by
  [RELEASE.md](./RELEASE.md). Releases `0.45.0` through `0.48.0` are directories
  of per-pull-request files and releases through `0.44.0` are single files
  written under the older entry rules; leave both as they are.
- **The release window is re-derived rather than assumed**, and when it is
  re-derived, from which ref, and in what form are
  [RELEASE.md](./RELEASE.md#7-open-the-release-pull-request)'s to state — this
  file does not repeat them. What holds regardless: a pull request that merges
  to `main` while the release pull request is open belongs to the release, and
  nothing on the release branch notices on its own.
- **The repository has no Git tags and is not going to get any.** A tag would be
  a second copy of a fact the tree already carries — the release boundary is the
  release commit itself, and what shipped in a release is its changelog file —
  and one a release could forget to write.
