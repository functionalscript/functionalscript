# Changelog

All notable changes to this project are documented in this directory.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and the pre-1.0 policy uses the latitude allowed by
[Semantic Versioning §4](https://semver.org/spec/v2.0.0.html#spec-item-4).

Entries are written **once per release**, from the pull requests that shipped in
it. A pull request adds no changelog file. Release PRs write those files;
forward-port or archival PRs may copy already-published urgent-release notes
unchanged to `main`. Before 1.0, release-note material and
`**BREAKING CHANGES:**` notices in its description are optional. The release
policy after 1.0 remains [undecided](../todo/post-1.0-release-policy.md).
The release procedure is [RELEASE.md](./RELEASE.md).

## Layout

```
changelog/
  README.md        this file
  RELEASE.md       how a release collects its entries
  <version>.md     one file per release — every release has one
  unreleased/
    <PR>.md        left over from the per-pull-request scheme; a release
                   consumes it (RELEASE.md)
```

A renderer reads **one released form**, and one transient directory that may
reappear:

- **`<version>.md`** — one file per release, holding that release's entries in
  order of importance. Every release has one. **A renderer must handle two
  reference styles, and both can appear in one file**: an inline
  `[#NNN](url)` link, and a plain `(#NNN)` reference it turns into a link
  itself. New entries use the plain form; the link survives where an entry was
  published with one, and the oldest releases have neither.
- **`unreleased/<PR>.md`** — one file per pull request, for work not yet
  released. Nothing adds to it any more, but a pull request opened under the old
  policy recreates it whenever it merges, so a release consumes it whenever it
  is non-empty ([RELEASE.md](./RELEASE.md)).

`0.45.0` through `0.48.0` were directories of per-pull-request files, rendered
by joining them in descending pull-request-number order. They are single files
now, joined in that order. 247 of those entries named no pull request — the
file name was the number — so each gained the `(#NNN)` it used to be named. The
other 35 already ended with a `[#NNN](url)` link and kept it instead of gaining
a second reference: all 31 entries in `0.45.0`, and 4 in `0.46.0`, which is why
`0.46.0` mixes the styles. That is a change of storage, not of text: every entry
reads exactly as published, and the prior layout is in git history.

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
  renderer derives each link. A change whose commit carries **no `(#NNN)`**
  cites that commit instead, by short SHA in the same parentheses —
  `(7b979e74)`, the `0.41.0` release — and the renderer links it to the commit.
  What is missing is the number, not necessarily the pull request: a direct push
  never had one, and a rebase merge drops the reference from a pull request that
  did exist. Either way the SHA is the reference the entry can carry.
  `RELEASE.md` step 2 says why such commits exist and requires the release author
  to read their diffs and collect notable changes for release notes. Mixing the
  two in one entry is fine. Do not link to, or
  name in plain text, an issue or a `todo/` file: issue files are deleted when
  the work is done, so those references rot and mean nothing to a reader of the
  published package.
- **List items only.** No heading — the version is the file name — and no
  Markdown beyond paragraphs, list items, inline code, and bold, so the website
  can render entries with a small self-hosted parser. That subset is a
  convention rather than an accident.
- **Before 1.0, breaking-change markers are optional in entries too.** Describe
  the old shape, the new one, and the one-line migration its pull request
  gave. Where that pull request gave none, the entry says what changed and
  stops: a release author writes a migration down, never invents one
  ([RELEASE.md](./RELEASE.md#6-write-changelogxyzmd)).
- **CI generation is not stable for third-party consumption.** `fjs/ci` and the
  `NixJob`, `MetaStep` and Nix-expression shapes it generates from are this
  repository's own build machinery, not published API anyone is invited to
  depend on. A breaking entry for them records what changed and **owes no
  migration** — the rule above governs the API a consumer can reasonably build
  against.
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
  shape (see [DESIGN.md §2](../doc/DESIGN.md#2-the-api-is-the-most-important-part-of-quality)).
  The version number is what lets consumers stay on the old API; a released
  version is immutable, so nothing is taken away from anyone by improving the
  next one. Update every importer in the same pull request rather than keeping
  a compatibility shim; explain the API change in the description.
- **Before 1.0, every regular release is `0.X.0`.** Increment the highest
  released minor and reset the patch to zero, whether the window contains
  breaking changes, features, fixes, or no notable changes. Most changes are
  breaking at this stage, so mandatory `BREAKING CHANGES` notices and
  declaration-driven bumps add little value. SemVer §4 allows anything to
  change before 1.0. Consumers crossing a minor boundary should review the
  release notes.
- **Urgent fixes start at `0.X.1`, from the corresponding `0.X.0` release
  commit.** Include only the required fixes and release metadata, excluding
  subsequent development on `main`. If another urgent fix is needed, branch
  from the preceding fix release and increment the patch (`0.X.2`, `0.X.3`,
  etc.); never reuse a published version. The next regular release still
  advances the minor and resets the patch. See
  [RELEASE.md](./RELEASE.md#urgent-fixes-before-10) for publishing this branch.
- **The release policy after 1.0 is not decided here.** Whether mandatory
  notices return, and how release branches and version bumps work at that stage,
  remain [open questions](../todo/post-1.0-release-policy.md).
  Existing published versions keep their numbers.
- Releasing is its own pull request, titled `Release X.Y.Z`: the version lives in
  `package.json` (`"version"`) — `deno.json` holds tasks and formatting only —
  and the entries are collected into `changelog/X.Y.Z.md` by
  [RELEASE.md](./RELEASE.md). Releases through `0.44.0` were written under the
  older entry rules; leave them as they are.
- **The release window is re-derived rather than assumed**, and when it is
  re-derived, from which ref, and in what form are
  [RELEASE.md](./RELEASE.md#7-open-the-release-pull-request)'s to state — this
  file does not repeat them. For a regular release, a pull request that merges
  to `main` while the release pull request is open belongs to the release, and
  nothing on the release branch notices on its own.
- **The repository has no Git tags and is not going to get any.** A tag would be
  a second copy of a fact the tree already carries — the release boundary is the
  release commit itself, and what shipped in a release is its changelog file —
  and one a release could forget to write.
