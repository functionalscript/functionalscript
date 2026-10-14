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

1. **The bump.** A pull request titled `Release X.Y.Z` changes `version` in
   `package.json` and `package-lock.json` and nothing else. Merging it
   publishes through the existing workflow. Whatever `main` holds at that
   merge is the release by definition, and nobody has to have scanned it
   first.
2. **The notes.** Opened only once the bump has merged and the version has
   published, because its window comes from what npm published (below). An AI
   session writes `changelog/<version>.md` for every published version that
   has no file yet, and lands it through a reviewed pull request. The reading,
   grouping and writing steps of today's procedure stay as they are; only the
   window and the timing change.

Under both options for where the notes land (below), these are the same two
pull requests; only the second one's base differs.

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

**Urgent fixes need no copy into `main`.** Their notes are written after they
publish too, straight to wherever the notes live, so step 5's copy of
`changelog/0.X.P.md` from the maintenance branch into `main` goes away.

**Where the notes land is open.** Two options:

- **A. A pull request to `main`.** `changelog/` stays where it is, and nothing
  that reads it changes: the website, its proofs, the links into released
  files, and the docs. The notes pull request is Markdown only, and it runs
  `main`'s CI like any other pull request. This option fixes the whole problem
  above.
- **B. A `changelog` branch.** The released files move off `main` to a branch
  holding only `changelog/<version>.md`, and the notes session opens its pull
  requests into that branch. Notes then stay out of `main`'s history and CI.
  The cost is everything below that is marked B: the website reads the branch,
  CI and Cloudflare stop treating the branch as a code branch, entries get their
  own check, and the docs and links move.

  Under B the website reads the release files from the branch's tree, not
  from the checkout. It does that through this repository's own Git reader:
  `git/repo`, `git/refstore`, `git/store` and `git/walk` already resolve a ref,
  read loose and packed objects and walk a tree to a path. No `git` command is
  needed to read, though one may be needed to fetch the branch's objects
  (tasks). A build that cannot resolve the branch refuses, naming the command
  that fetches it, rather than deploying a site whose "Releases" link leads
  nowhere ([DESIGN.md §10](../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
  The website build stops on a release file it cannot parse, so under B a bad
  entry would break the next deploy of `main`. A pull request into the branch
  therefore runs the same parse before it merges.

### Tasks

**Either option**

- [ ] Decide A or B.
- [ ] Rewrite the release procedure. A release pull request is the bump alone,
      merged once its CI is green. Decide which of step 6's tested-toolset
      checks stay on the bump, because they gate what ships: `engines.node`,
      the root lock's engine metadata and `.node-version` equal to the `node`
      pin. The rest move to the notes session, because they record what
      shipped, read from `fjs/ci/config/module.f.js` at the `gitHead`.
- [ ] Write the notes procedure:
      - list the published versions (`npm view functionalscript versions`)
        against the release files;
      - for each version without a file, read the window between `gitHead`s;
      - group the changes by net effect and write the file;
      - open the pull request.

      The version needs no choosing; it was chosen by the bump.
- [ ] Drop what the fixed window makes unnecessary:
      - the title search and its confirmation in step 1;
      - the re-scan and the recorded tip in step 7;
      - the `changelog/unreleased/` source in step 3 and the "Transition"
        section, since the directory is empty on `main`;
      - the up-to-date setting task in
        [commit-message-enforcement](./commit-message-enforcement.md), whose
        only stated reason is the release race.
- [ ] Urgent fixes: drop step 5's copy into `main`, and the matching task in
      [maintenance-release-publishing](../fjs/ci/todo/maintenance-release-publishing.md).
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

**B only: the branch**

- [ ] Create `changelog` from `main`'s tip with everything but `changelog/`
      deleted, so each file's history stays reachable from the branch. Since it
      shares history with `main`, never merge either into the other. Add a root
      `README.md` there that says what the branch holds and links the
      procedure on `main`.
- [ ] Protect it: changes only through pull requests, the entry check
      required, no force-push or deletion. These are repository settings, so a
      maintainer applies them.
- [ ] Carry every release file `main` gains before the switch. The open
      [Release 0.56.0](https://github.com/functionalscript/functionalscript/pull/2929)
      writes one. Confirm that the branch's `changelog/` equals `main`'s
      immediately before `main` drops it.

**B only: CI**

- [ ] Keep the main CI off pull requests into `changelog`. `gen.ci.yml`'s
      `pull_request: {}` runs the whole suite for any base, and a tree with no
      `package.json` fails it. Add `branches-ignore: [changelog]` in `fjs/ci`
      and regenerate. Don't use a `main`-only filter, because maintenance
      branches need CI.
- [ ] Add the entry check for pull requests into `changelog`: a generated
      workflow that applies `main`'s parser to the pull request's files the way
      the website build does. Decide how it gets both trees and what command it
      runs. A website build pointed at the pull request's head is the check
      that cannot disagree with the deploy.

**B only: the website**

- [ ] Read the release files from the `changelog` branch through `git/repo`,
      `git/refstore`, `git/store` and `git/walk`, instead of from the walked
      checkout. Decide the ref; `refs/remotes/origin/changelog` is what a full
      clone has. Refuse a build that cannot resolve it, with a message naming
      the fetch that fixes it.
- [ ] Get the branch's objects into Cloudflare's build. Measure what Workers
      Builds clones. If it does not carry `changelog`, add
      `git fetch origin changelog:refs/remotes/origin/changelog` to
      `gen.cloudflare/build.sh` through `fjs/website/cloudflare`. That is an
      external tool in a generated script, so it needs approval
      ([AGENTS.md §6](../AGENTS.md#6-external-tools)) in the pull request that
      adds it.
- [ ] Reserve `changelog/` on `main` as an output directory. The build creates
      it as it creates `prs/` and `cli/`, and keeps it out of source discovery.
- [ ] Move the website proofs that build release pages from a `changelog/`
      directory in the virtual tree to a virtual repository holding the branch.
- [ ] Exclude the `changelog` branch from Cloudflare's preview builds, since it
      has no generator to run. Record the setting in `fjs/website/README.md`'s
      "Configure Cloudflare", and say there and in the generator's JSDoc where
      releases come from.

**B only: docs and links**

- [ ] Move `changelog/README.md` and `changelog/RELEASE.md` to `doc/`. They
      describe `main`'s code, CI and website and are linked from it. Update
      every link to them: AGENTS.md, CONTRIBUTING.md, DESIGN.md,
      `fjs/AGENTS.md`, `fjs/ci/README.md`, and the JSDoc of `media/markdown`,
      `ebnf/lib/markdown` and `website/changelog`, among about thirty files that
      mention `changelog/`.
- [ ] Replace relative links from `main` into released files, such as
      `fjs/effects/README.md`'s link to `changelog/0.46.0.md`, with the
      website's release pages.
- [ ] Remove `changelog/` from `main` in the pull request that switches the
      website to the branch, so the site never builds without releases.

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
- [fjs/website/README.md](../fjs/website/README.md) — how the site reads the
  repository
- [fjs/git/README.md](../fjs/git/README.md) — the reader option B's website
  build would use
