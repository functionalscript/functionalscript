# Releasing

A release is **two pull requests to `main`**:

1. **The bump** changes the version and nothing else. Merging it publishes.
2. **The notes**, opened once the version has published, write
   `changelog/X.Y.Z.md` from the pull requests that shipped in it.

[README.md](./README.md) is the format the notes are written in and the
versioning rule the bump follows.

Before 1.0, `Changelog:` sections and `**BREAKING CHANGES:**` notices are
optional. Read descriptions and diffs for notable changes rather than treating
absence of a marker as evidence of compatibility. The release policy after 1.0
remains [undecided](../todo/post-1.0-release-policy.md).

## Why the notes come after the release

`npm publish` runs on every push to `main` and packs that tree, so a release is
whatever `main` holds when its bump merges. Notes written before that merge
describe a `main` that keeps moving: a pull request that lands while the release
is open ships in it, and its note is missing unless someone re-scans in time.

Written afterwards, the notes cover a window that can no longer change. npm
records the commit it published from as the version's `gitHead`, so the window
is the published one, read once.

Before 1.0 nothing about a release depends on its notes: every regular release
is `0.X.0` and every urgent fix is the next patch on its line, whatever the
window holds. A post-1.0 policy that chooses the bump from breaking changes
would need the window read before the bump again.

## Why the notes are written once per release

A pull request author knows their own change and not the release. Several pull
requests routinely move the same thing, and entries written one at a time record
the moves instead of the destination. The window since the `0.48.0` release is
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

Writing per release also lets a break introduced and undone inside one window be
reported as what it is — nothing — rather than as two entries that cancel out.

## The bump

### 1. Choose the version

`package.json`'s `"version"` is the last version released from `main`: only the
bump changes it. The policy is in
[README.md](./README.md#breaking-changes-and-versioning). Before 1.0, a regular
release increments the minor and resets the patch: `0.X.0`. Urgent fixes follow
[their own procedure](#urgent-fixes-before-10).

### 2. Open the bump pull request

Titled `Release X.Y.Z`. It changes `"version"` in `package.json` and both
version fields at the root of `package-lock.json` —
`npm version X.Y.Z --no-git-tag-version` writes all three — and nothing else.
Fixes discovered while preparing a release belong in their own pull request.

Before merging:

- [ ] CI is green.
- [ ] `package.json`'s `engines.node`, the root `package-lock.json` engine
      metadata and `.node-version` all equal the exact `node` pin in
      [`fjs/ci/config/module.f.js`](../fjs/ci/config/module.f.js), and the
      generated publishing workflow uses that pin. These gate what ships: a
      mismatch is fixed first, in its own pull request, through
      [the version-update acceptance procedure](../fjs/ci/update-versions.md).
- [ ] For a regular release, every urgent release-line fix is present in `main`,
      adapted if necessary so upgrading preserves it; urgent-fix pull requests
      record fixes already present in `main`.

Nothing else has to be scanned: whatever `main` holds when this merges is the
release, and the notes read it afterwards.

### 3. Confirm the publish

```sh
npm view functionalscript@X.Y.Z gitHead
```

It answers the commit npm packed. **A green publish workflow is not evidence**:
its publish step absorbs failures
([publish-only-a-new-version](../fjs/ci/todo/publish-only-a-new-version.md)),
and release `0.53.0`'s first run was green with nothing published. If the
version is missing, fix the cause and re-run the publish workflow run of the
bump's merge commit, not a later one, so the version holds the release's tree.

## The notes

A session that writes notes writes **every missing file**, not only the newest.
If a release's notes were skipped, or their pull request never merged, the next
release's notes session, or any later one, fills the gap:

```sh
npm view functionalscript versions --json
ls changelog/
```

Every published version above `0.55.0` without a `changelog/<version>.md` is
missing; older gaps are history and stay as they are. Write each missing file
over its own window, in one notes pull request or one each. Never close a gap
by widening a later release's window over it: each file describes the version
it is named for.

### 1. Find the window

The notes for a version cover the commits between two `gitHead`s: the previous
version's and this one's.

- For a regular `0.X.0`, the previous version is the highest published
  `0.W.0` below it.
- For an urgent `0.X.P`, it is `0.X.(P-1)`, or `0.X.0` for `0.X.1`.

```sh
npm view functionalscript@<previous> gitHead
npm view functionalscript@X.Y.Z gitHead
git fetch origin main                                # or the maintenance branch
git show <gitHead>:package.json                      # for each of the two
```

Each `gitHead` is a boundary only if `package.json` at it carries the version
you asked npm about. A version npm answers without a `gitHead` has no window: stop
and ask the owner rather than guessing one.

The `gitHead` is usually the bump's merge commit. It can be a later commit:
two pushes to `main` close together start two publish runs of one version, and
the first to reach `npm publish` decides the tree. The `gitHead` names the tree
that was actually packed, so the window stays right either way; say so in the
notes pull request when it happens.

### 2. List the pull requests in the window

```sh
git log --first-parent --reverse --format='%H %s' <previous gitHead>..<gitHead>
```

Each line is one thing that landed on the release's line, and the trailing
`(#NNN)` is its pull request number.

- **`--first-parent`**, because every commit this walks is a merge, and the
  branch commits behind each merge are that pull request's, not the window's.
- **`--reverse`, or read bottom-to-top.** `git log` prints newest first, and
  step 4 depends on reading in the order things happened: without it a
  superseded state is read as the release's final effect.
- **A line with no `(#NNN)` gives you no pull request to open.** It still
  shipped, and the line names nothing to read, so **read its diff and collect
  its notable changes for the release notes**. Group them by net effect in
  step 4, like changes from pull requests. Two things produce such a line, and
  they differ in what exists behind it: a direct push never had a pull request,
  so no reviewed description exists anywhere; a rebase merge had one whose
  description the line does not name — if you can find it, read it, but the
  diff is what you are guaranteed. Until the repository settings in
  [commit-message-enforcement](../todo/commit-message-enforcement.md) forbid
  both, its description — if one was ever written — is not reachable from the
  line, which is what makes the diff the thing you read. Release `0.41.0`
  (`7b979e74`) landed this way.

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
   settle it. `git show` prints no diff for a merge by default, so without the
   flag it emits nothing at all.

Collect notable API changes, including any optional breaking-change notices.

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
- A break introduced and reverted inside the window is **not a break** in the
  entries. Say so in the notes pull request's description, so that the
  reasoning is reviewed rather than inferred from an absence.

### 5. Write `changelog/X.Y.Z.md`

One file, list items only, most important first. Format and the Markdown subset:
[README.md](./README.md#entries). Keep an entry to about three wrapped lines —
it is a release note, not a design document, and the pull request references
carry a reader to the full story.

**Do not write a migration of your own.** A breaking entry carries the migration
its declaring pull request gave, and where that pull request gave none the entry
says what changed and stops. The notes author has the whole window in view,
which is what step 4 needs, but not the change — inventing a migration from a
diff publishes untested advice under the authority of the release notes, and
the reader cannot tell it from the author's. The declaration is the pull
request's; the notes are the release's. If a break plainly needs a migration
and has none, say so in the notes pull request and ask the author, rather than
supplying one.

**CI generation is not stable for third-party consumption**, so its breaking
entries owe no migration at all
([README.md](./README.md#entries)). `fjs/ci` and the `NixJob`, `MetaStep` and
Nix-expression shapes it generates from are this repository's build machinery;
they are recorded because contributors read the notes, not because anyone is
invited to build against them.

#### Tested toolset

During prerelease, a release supports one exact accepted version of each tool,
chosen close to the latest stable version the project can build and test
reliably. Updating a pin replaces that version for the next release. An older
tool requires an older FunctionalScript release with a suitable recorded
toolset; additional support after release remains subject to actual demand.

Include the tested toolset in the release notes or link a release document
that records it. The Markdown format for changelog files remains list items
only: a toolset list item may contain the versions or link that record. Record
Node, Deno, Bun, Rust, TypeScript/TSGO, Wasmtime and Wasmer from
[`fjs/ci/config/module.f.js`](../fjs/ci/config/module.f.js) at the release's
`gitHead` — `git show <gitHead>:fjs/ci/config/module.f.js` — not from today's
tree. Do not infer earlier releases' supported versions from today's pins.

Verify the record against the versions the release's own checks used. Run each
version command in `./dev.sh` in a worktree at the `gitHead`
(`git worktree add <dir> <gitHead>`):

```sh
./dev.sh node --version
./dev.sh deno --version
./dev.sh bun --version
./dev.sh rustc --version
./dev.sh tsc --version
./dev.sh wasmtime --version
./dev.sh wasmer --version
```

Compare their output with the record. Check the passing CI version assertions
for that commit on each platform too, including `setup-node` and clean packed
consumers outside Nix. A mismatch is recorded as what shipped and fixed for the
next release through
[the version-update acceptance procedure](../fjs/ci/update-versions.md); it is
not another supported version to add to the record.

Keep the verified version outputs in the notes pull request's description.
Historical release records retain their original toolsets.

### 6. Open the notes pull request

Titled `changelog: write the X.Y.Z notes`, naming each version it writes,
against `main`, adding `changelog/X.Y.Z.md` for each. Its description names each
window — both `gitHead`s — and carries the toolset evidence. Before merging:

- [ ] each file name is a published version, and no published version above
      `0.55.0` is left without a file
- [ ] each window runs between two `gitHead`s, and `package.json` at each
      carries its version
- [ ] every pull request in each window was read, and the count was
      cross-checked
- [ ] every notable API change is covered, and any optional breaking notices
      are accounted for as shipped or undone
- [ ] the release notes contain or link the tested toolset, verified at the
      `gitHead` as described above

The window is fixed, so nothing that merges while this pull request is open
changes it.

## Urgent fixes before 1.0

The procedure above describes regular releases from `main`. An urgent fix
deliberately uses a different branch and window:

1. Branch from the `gitHead` of the corresponding `0.X.0` release, not from
   today's `main`. For a further urgent fix, branch from the `gitHead` of the
   preceding `0.X.P` instead.
2. Apply only the urgent fixes, updating importers and running the full checks
   required by [AGENTS.md](../AGENTS.md). Review fix PRs against this maintenance
   branch. Once maintenance publishing is implemented, backport only the
   workflow support it needs; do not merge later development into the branch.
3. Open the bump against the maintenance branch: `0.X.1`, then `0.X.2`, etc.,
   in `package.json` and `package-lock.json`, and nothing else.
4. Publishing this maintenance branch is tracked separately in
   [maintenance release publishing](../fjs/ci/todo/maintenance-release-publishing.md).
   The current generated workflow publishes only pushes to `main`; it does not
   provide a maintenance-branch trigger. Implement and verify that follow-up
   before publishing a maintenance release. Never merge later development into
   the maintenance branch just to use the main publisher, or overwrite a
   published version.
5. Once it publishes, write its notes like any other release's: a notes pull
   request to `main` adding `changelog/0.X.P.md`, over the window from the
   previous version on its line. The file lives on `main` for the website's
   history, even if the maintenance branch is deleted.
6. Carry every fix forward to `main` through a separate PR **before the next
   regular release**, adapting it to current code if needed so upgrading retains
   the fix. Leave urgent `package.json` and `package-lock.json` version changes
   on the maintenance branch. If `main` already contains a fix, record that in
   the urgent-fix PR. The next regular release collects the forward-port PR
   normally and uses the next minor with patch zero.
7. Check newer released lines for the same defect and promptly publish an urgent
   fix on every affected newer line, including the newest line used by `latest`.
   Do not leave those users waiting for the next regular release.

## What this replaced, and what was rejected

Through `0.48.0`, every behavior-changing pull request added
`changelog/unreleased/<PR>.md` and repeated it in a `Changelog:` section, and
releasing renamed the directory to `changelog/<version>/` — those directories
are single files now. It was dropped because it charged every pull request for
an entry no one had the context to write well, and because the duplication rule
did not hold in practice — in the last full window, 17 of 29 entry files had no
matching section in the merge commit.

From `0.49.0` until this procedure, one release pull request carried both the
bump and the notes. The notes were written before the merge, so the window ended at
whatever `main` held when the release merged, and keeping them complete took a
re-scan immediately before merging, a recorded tip compared after a fresh
fetch, and a repository setting to block the merge once `main` moved. Writing
the notes after the version publishes, over the `gitHead` window, removes the
race those steps managed.

Three other designs were considered and rejected:

- **Generating entries from diffs at build time.** The published notes would be
  non-deterministic and unreviewed, and Git history is immutable, so a badly
  worded source could never be fixed. A committed entry can be fixed by a
  cleanup pull request.
- **Publishing the `Changelog:` sections verbatim.** Deterministic and reviewed,
  but it is the per-pull-request scheme again with a different storage: the
  sections are written one pull request at a time, so they carry the churn of
  step 4 into the release notes.
- **A `changelog` branch holding the release files.** It would keep one
  Markdown pull request per release out of `main`'s history and CI, and that is
  all it gains. Everything that reads `changelog/` on `main` would have to
  follow it:
  - the website build would read the branch, with a `git fetch` added to the
    Cloudflare build;
  - CI would ignore pull requests into it;
  - it would need an entry check of its own, since the website build stops on a
    release file it cannot parse;
  - the format and procedure documents, and the links into released files,
    would move.

  The `gitHead` window removes the race wherever the files live.

Every released file stays as published. Breaking-change markers remain useful
optional context before 1.0; the release policy after 1.0 remains undecided.
