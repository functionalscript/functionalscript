## Release by version bump, write the notes afterwards

**Priority:** P2
**Status:** open

### Problem

A release pull request carries the version bump and the release notes together
([changelog/RELEASE.md](../changelog/RELEASE.md)). The notes are written on the
release branch, but what publishes is `main`'s tip when that pull request
merges: `npm publish` runs on every push to `main` and packs that tree. Anything
that lands on `main` while the release pull request is open ships in the
release, and is missing from its notes unless someone re-scans in time.

`RELEASE.md` manages that race rather than removing it: a re-scan immediately
before merging, a recorded tip compared after a fresh fetch, and a repository
setting, "Require branches to be up to date before merging", to close the last
gap. Each is a step a release author can miss, and missing one drops a release
note silently.

Before 1.0 nothing about a release depends on its notes. Every regular release
is `0.X.0` and every urgent fix is the next patch on its line, whatever the
window holds
([changelog/README.md](../changelog/README.md#breaking-changes-and-versioning)).
The notes record what shipped; they are not an input to shipping it, so they
do not have to be written first.

### Proposal

**A release is two pull requests: the bump, then the notes.**

1. **The bump**, against its release line: `main` for a regular release, the
   maintenance branch for an urgent fix. A pull request titled `Release X.Y.Z`
   changes `version` in `package.json` and `package-lock.json` and nothing
   else. Merging it publishes through the existing workflow. Whatever `main`
   holds at that merge is the release by definition, and nobody has to have
   scanned it first.
2. **The notes**, always against `main`. Opened only once the bump has merged
   and the version has published, because its window comes from what npm
   published (below). An AI session writes `changelog/<version>.md` for every
   published version above `0.55.0` that has no file yet, and lands it through
   a reviewed pull request. Every published version from `0.30.0` through
   `0.55.0` has its file; older gaps are history. The reading,
   grouping and writing steps of today's procedure stay as they are; only the
   window and the timing change.

`changelog/` stays on `main`, so nothing that reads it changes: the website, its
proofs, the links into released files, and the docs. The notes pull request is
Markdown only and runs `main`'s CI like any other pull request.

**A release's window comes from npm, not from a commit title.** npm records the
commit it published from as the version's `gitHead`:
`npm view functionalscript@0.55.0 gitHead` answers `dbf277c9…`, the merge of
[Release 0.55.0](https://github.com/functionalscript/functionalscript/pull/2835).
The notes for a version cover `<previous gitHead>..<gitHead>`, the previous
version being the one before it on the same release line, listed with
`--first-parent`. That window is fixed once the version publishes, so one
reading is enough. It replaces step 1's title search and step 7's re-scan,
recorded tip and up-to-date setting. It also stays right when the publish
packed a later commit than the release merge (see the publish task below),
because it names the commit that was actually packed.

**Urgent fixes need no copy into `main`.** Their bump stays on the maintenance
branch, but their notes are written after they publish too, in a pull request
to `main` like any other release's notes, so step 5's copy of
`changelog/0.X.P.md` from the maintenance branch into `main` goes away.

**Rejected: a `changelog` branch.** Moving the released files to a branch of
their own would keep one Markdown pull request per release out of `main`'s
history and CI. That is all it gains, and everything that reads `changelog/` on
`main` would have to follow it:

- the website build would have to read the branch, through `fjs/git`'s reader,
  with a `git fetch` added to the Cloudflare build;
- CI would have to ignore pull requests into the branch;
- the branch would need its own entry check, since the website build stops on
  a release file it cannot parse and a bad entry there would break `main`'s
  next deploy;
- the entry format and procedure docs would move, and the links from `main` to
  them and into released files (about thirty files mention `changelog/`) would
  change.

The fixed window above removes the race wherever the files live.

### Tasks

- [ ] Rewrite the release procedure. A release pull request is the bump alone,
      merged once its CI is green. Decide which of step 6's tested-toolset
      checks stay on the bump, because they gate what ships: `engines.node`,
      the root lock's engine metadata and `.node-version` equal to the `node`
      pin. The rest move to the notes pull request, because they record what
      shipped, read from `fjs/ci/config/module.f.js` at the `gitHead`.
- [ ] Write the notes procedure:
      - list the published versions (`npm view functionalscript versions`)
        against the files in `changelog/`;
      - for each version above `0.55.0` without a file, read the window
        between `gitHead`s;
      - group the changes by net effect and write the file;
      - open the pull request to `main`.

      The version needs no choosing; it was chosen by the bump.
- [ ] Drop what the fixed window makes unnecessary:
      - the title search and its confirmation in step 1;
      - the re-scan and the recorded tip in step 7;
      - the `changelog/unreleased/` source in step 3 and the "Transition"
        section. The directory is empty on `main`, and only a pull request
        opened under the per-pull-request policy could recreate it; when this
        was filed, every open pull request had been opened long after that
        policy ended at `0.49.0`;
      - the up-to-date setting task in
        [commit-message-enforcement](./commit-message-enforcement.md), whose
        only stated reason is the release race.
- [ ] Urgent fixes: drop step 5's copy into `main`, and the matching task in
      [maintenance-release-publishing](../fjs/ci/todo/maintenance-release-publishing.md).
      The urgent release's notes reach `main` through its notes pull request.
- [ ] Publish only from the commit that changed the version. Two pushes to
      `main` close together start two publish runs of the same version, and
      whichever reaches `npm publish` first decides which tree the version
      holds; `continue-on-error` absorbs the other's 403. A `concurrency` group
      does not fix it, because GitHub cancels the older pending run of a group
      when a newer one queues. Coordinate with
      [publish-only-a-new-version](../fjs/ci/todo/publish-only-a-new-version.md).
- [ ] Update the rules that say a release pull request writes the notes:
      AGENTS.md §5, CONTRIBUTING.md's pull request rules and
      `changelog/README.md`. A pull request's optional `Changelog:` section
      stays raw material for the notes.
- [ ] Update the publishing issues that describe today's release:
      [publishing-packages](../fjs/ci/todo/publishing-packages.md) and
      [publish-only-a-new-version](../fjs/ci/todo/publish-only-a-new-version.md).
      Also update [post-1.0-release-policy](./post-1.0-release-policy.md): a
      policy that chooses the bump from breaking changes needs the window read
      before the bump again.

### Related

- [changelog/RELEASE.md](../changelog/RELEASE.md) — the procedure this replaces
- [changelog/README.md](../changelog/README.md) — the entry format, unchanged
- [publish-only-a-new-version](../fjs/ci/todo/publish-only-a-new-version.md) —
  the publish step this relies on
- [maintenance-release-publishing](../fjs/ci/todo/maintenance-release-publishing.md)
  — urgent fixes, whose notes this moves
- [commit-message-enforcement](./commit-message-enforcement.md) — the
  up-to-date setting this makes unnecessary
- [post-1.0-release-policy](./post-1.0-release-policy.md) — where the notes
  could become an input to the bump again
