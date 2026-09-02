# Collecting the changelog at release time

The changelog is written **once per release**, from the pull requests that
shipped in it — not once per pull request. This file is the procedure.
[README.md](./README.md) is the format those entries are written in and the
versioning rule they feed.

A pull request owes the changelog one thing, and only when it applies: a
`Changelog:` section in its description whose items are prefixed
`**BREAKING CHANGES:**` where the public API breaks
([CONTRIBUTING.md](../CONTRIBUTING.md#commit-messages)). That declaration is the
version-bump signal and nothing derives it from a diff. Everything else — what
the release notes say, how entries are grouped, how long they are — is decided
here, at release time, by one author with the whole window in view.

## Why the collection happens here

A pull request author knows their own change and not the release. Several pull
requests routinely move the same thing, and entries written one at a time record
the moves instead of the destination. The window since the `0.48.0` release —
the one this convention arrives in, not the one `changelog/0.48.0/` records — is
the worked example:
[#1807](https://github.com/functionalscript/functionalscript/pull/1807) made the
generated `run` scripts pass `--quiet` three times,
[#1813](https://github.com/functionalscript/functionalscript/pull/1813) cut that
back to once after generating a `flake.lock`,
[#1825](https://github.com/functionalscript/functionalscript/pull/1825) replaced
the pinned-hash lock generation with `nix flake lock`, and
[#1831](https://github.com/functionalscript/functionalscript/pull/1831) added
`--extra-experimental-features`. Four entries describing a path; the reader
needs one describing where it ended.

Writing at release time also lets a break introduced and undone inside one
window be reported as what it is — nothing — rather than as two entries that
cancel out.

## The procedure

### 1. Find the release boundary

The repository has no tags and is not getting any
([README.md](./README.md#breaking-changes-and-versioning)), so the boundary is
the previous release's merge commit on `main`.

`package.json`'s `"version"` is the previously released number: the release
commit bumps it and nothing else touches it, so the version you are releasing
*from* is already in the working tree.

```sh
node -p "require('./package.json').version"          # e.g. 0.48.0
git log --first-parent --format='%H %s' | grep 'Release 0.48.0'
```

Then **confirm the candidate rather than trusting its title** — a text match is
a search, not an analysis ([AGENTS.md §6](../AGENTS.md#6-external-tools)):

```sh
git show --first-parent <candidate> -- package.json
```

It is the boundary only if that diff is the bump to the version you searched
for.

**`--first-parent` is required on both commands, for two different reasons.**
On the search, the release branch's own commit carries the same title as the
merge that landed it and is not the boundary. On `git show`, every commit this
procedure walks is a merge, and `git show` prints no diff for a merge by
default — without the flag it emits nothing at all, on the right commit and the
wrong one alike, which reads exactly like "not the boundary".

### 2. List the pull requests in the window

```sh
git fetch origin main
git log --first-parent --reverse --format='%H %s' <boundary>..origin/main
```

Each line is one thing that landed on `main`, and the trailing `(#NNN)` is its
pull request number. Three cautions, each of which has cost a release note:

- **List `origin/main`, never the release branch's `HEAD`.** Once `main` is
  merged into an open release branch, the pull requests that arrived on `main`
  are reachable only through that merge's *second* parent, so a first-parent
  walk from the branch tip does not list them — they are in the release's code
  and absent from its window. This is not hypothetical: the pull request that
  wrote this paragraph merged `main` in and three pull requests, #1841 through
  #1843, vanished from its own listing.

  `main` is the authority, not the release branch, and the asymmetry is worth
  stating: the release lands *by merging into* `main`, and `npm publish` runs on
  a push to `main` and packs that tree, so whatever sits on `main` when the
  release merges is in the released package. A commit on `main` is therefore
  never a change that "will not ship", and this listing cannot err by including
  one — it can only err by missing one, which is the whole reason the range ends
  at `origin/main` and step 7 re-derives it immediately before merging.
- **`--reverse`, or read bottom-to-top.** `git log` prints newest first, and
  step 4 depends on reading in the order things happened: without it a
  superseded state is read as the release's final effect.
- **A line with no `(#NNN)` did not arrive through a pull request.** It still
  shipped, so read it like any other; nothing else will report it.

Merge order is not pull-request-number order — a pull request opened earlier can
merge later — and merge order is the one to use.

Nothing but this command defines the window, so a mistake here drops a release
note silently. Cross-check the count against the repository's merged pull
requests for the same dates.

### 3. Read them

For each, the merge commit's body is the reviewed pull request description:

```sh
git log -1 --format=%B <commit>
```

Read in this order, stopping as soon as you can state what a user of the package
would notice:

1. the `Changelog:` section, where the author wrote one — their own note, with
   full context. It is raw material, not final text.
2. the rest of the description — motivation and design.
3. the diff (`git show --first-parent <commit>`), when the description does not
   settle it — the flag for the same reason as in step 1.

Collect every `**BREAKING CHANGES:**` declaration as you go; step 5 needs all of
them.

**For the first release under this procedure only, `changelog/unreleased/` is a
fourth source, and it is not optional.** Thirteen of its files declare a break,
and four of those — 1811, 1817, 1824 and 1825 — declare it *nowhere else*, in
two different ways: 1824 and 1825 carry no `Changelog:` section in their merge
bodies at all, while 1811 and 1817 carry one that does not mention the break.
The second is the worse failure, because a section that is present reads as
complete — which is the argument for reading the files rather than trusting a
section to be exhaustive. Reading only the merge commits would undercount the
breaks by four — four breaking changes a reader of the release notes never
learns about.

It would not get *this* window's version wrong: the other nine declarations do
appear in their merge bodies — somewhere in them, which is the instrument that
matters here, since step 3 is a person reading a description rather than a
parser keyed on one shape — and one surviving break already forces a minor.
That is an accident of this window rather than a property of the procedure — a
window whose declarations were all of the invisible kind would take a patch for
a release that breaks the API — and it is why the directory is read in full
rather than sampled.

Read those files **from `origin/main`, not from the working tree**, for the same
reason step 2 lists `origin/main`: a pull request opened under the old policy can
still land its entry file on `main` after this branch was cut, and `git fetch`
updates remote-tracking refs without touching a checked-out directory, so `ls
changelog/unreleased/` here answers for the branch rather than for the release.

```sh
git ls-tree --name-only origin/main -- changelog/unreleased/
git show origin/main:changelog/unreleased/<PR>.md
```

**Record that listing**, because the final scan in step 7 compares against it
and not against the branch. Once this branch deletes `changelog/unreleased/`,
every file it consumed is still on `origin/main` — the deletion does not reach
`main` until the release merges — so "`origin/main` holds a file this branch does
not" becomes true of all of them and separates nothing. A late arrival is a path
in the new listing and **not** in the recorded one; that comparison is the whole
signal.

For each such path, update the branch from `main`, read it into the entries, and
delete it with the rest. A file added on `main` after the branch deleted the
directory survives the release merge — the two sides touched different paths — so
without this it is both missing from the notes and left behind in a directory
that is supposed to be gone. See "Transition" below for what happens to the
directory.

Most pull requests produce no entry. Internal refactors, test-only changes,
coverage, CI, `todo/` and documentation are invisible to a user of the package,
and the release notes are written for that user.

### 4. Group by net effect

This is the step per-pull-request entries could not do. Entries describe the
release, not its history:

- Several pull requests that moved one thing get **one** entry, describing where
  it landed, referencing all of them.
- A feature added and then renamed before it shipped is reported under the name
  it shipped with.
- A break introduced and reverted inside the window is **not a break** — not in
  the entries and not in the version number. Say so in the release pull
  request's description, so that the reasoning is reviewed rather than inferred
  from an absence.

### 5. Choose the version number

The rule and its table are in
[README.md](./README.md#breaking-changes-and-versioning). The input is the set
of `**BREAKING CHANGES:**` declarations collected in step 3, minus any the
window itself undid (step 4): at least one surviving break means the release
cannot be a patch.

### 6. Write `changelog/X.Y.Z.md`

One file, list items only, most important first. Format and the Markdown subset:
[README.md](./README.md#entries). Keep an entry to about three wrapped lines —
it is a release note, not a design document, and the pull request references
carry a reader to the full story.

### 7. Open the release pull request

Titled `Release X.Y.Z`. It bumps `"version"` in `package.json` (and
`package-lock.json`) and adds `changelog/X.Y.Z.md`; merging it to `main`
triggers the `npm publish` workflow. Before merging:

- [ ] the version in `package.json` matches the changelog file name
- [ ] every pull request in the window was read, and the count was cross-checked
- [ ] every `**BREAKING CHANGES:**` declaration is either in an entry or
      explicitly accounted for as undone — including, for the transitional
      release, the ones that exist only in `changelog/unreleased/` (step 3)
- [ ] **immediately before merging, fetch and re-run step 2 against
      `origin/main` one last time** — and again after any update from `main`,
      which is *a* reason to re-list rather than the only one. A pull request
      that lands on `main` while the release pull request sits there ships with
      this release whether or not the release branch ever merged it, because the
      release lands by merging *into* `main` and `main`'s tip at that moment is
      what publishes. Tying the re-list to updates of the branch misses exactly
      that case: the branch never moved, so nothing prompts a rescan, and the
      note is absent from a release that carries the code. Extend
      `changelog/X.Y.Z.md` with whatever the final listing adds, and re-check
      the version number against any break it brings — a late arrival can turn a
      patch into a minor.
- [ ] **record the tip you scanned, and merge only that tip.** "Immediately
      before" narrows the race between the scan and the merge; it does not close
      it, and a pull request that lands in between still becomes an ancestor of
      the release and still publishes:

      ```sh
      git fetch origin main && git rev-parse origin/main   # note it
      git fetch origin main && git rev-parse origin/main   # again, before merging
      ```

      **The fetch is the check.** `origin/main` is a local remote-tracking ref
      that moves only when you fetch, so re-reading it without one compares the
      recorded value against itself and reports "unchanged" however far the
      remote has actually advanced — a test that cannot fail.

      If `main` has moved, the scan is stale: re-list, extend the entries, and
      re-check the version before merging.

      Even fetched, this narrows the race rather than closing it: `main` can
      advance between that last fetch and the merge itself. Closing it needs the
      platform — GitHub's **"Require branches to be up to date before merging"**
      blocks the merge button whenever `main` has advanced past the release
      branch, which turns the residual window into a forced re-scan. Enable it
      ([commit-message-enforcement](../todo/commit-message-enforcement.md));
      until it is on, the fetch-to-merge interval is an accepted exposure, and
      it is smallest when the two happen back to back.
- [ ] **transitional release only:** `changelog/unreleased/` is deleted in this
      same pull request, after its content has been read into the entries — and
      the final scan re-listed it from `origin/main` and compared against the set
      step 3 recorded, not against this working tree. Comparing against the tree
      answers "true" for every file already consumed, so only a path absent from
      the recorded set is a late arrival to read and delete.

## What this replaced, and what was rejected

Through the release made under the previous scheme, every behavior-changing pull
request added `changelog/unreleased/<PR>.md` and repeated it in a `Changelog:`
section, and releasing renamed the directory. It was dropped because it charged
every pull request for an entry no one had the context to write well, and
because the duplication rule did not hold in practice — in the last full window,
17 of 29 entry files had no matching section in the merge commit.

Two other designs were considered and rejected:

- **Generating entries from diffs at build time.** The published notes would be
  non-deterministic and unreviewed, and Git history is immutable, so a badly
  worded source could never be fixed. A committed entry can be fixed by a
  cleanup pull request.
- **Publishing the `Changelog:` sections verbatim.** Deterministic and reviewed,
  but it is the per-pull-request scheme again with a different storage: the
  sections are written one pull request at a time, so they carry the churn of
  step 4 into the release notes.

What the previous scheme got right is kept: the `**BREAKING CHANGES:**` marker
as a reviewed, per-pull-request declaration, the versioning table it feeds, and
every released file exactly as it was published.

## Transition

`changelog/unreleased/` still holds entry files written under the previous
scheme. They are the authors' own notes for pull requests in the current window
— exactly what a `Changelog:` section is — so the next release reads them as
step 3 raw material and **deletes the directory in the same release pull
request**. They do not survive as published entries: `changelog/X.Y.Z.md` is
written by the procedure above, over the whole window, including the pull
requests that left no file.

After that release, `changelog/unreleased/` does not come back.
