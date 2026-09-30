## npm-trusted-publisher-gen-workflow. Point npm's trusted publisher at `gen.npm-publish.yml`

**Priority:** P2
**Status:** open

### Problem

The publishing workflow is now `.github/workflows/gen.npm-publish.yml`
(`npmPublishPath` in [`../publish/module.f.mjs`](../publish/module.f.mjs)).
npm's trusted publishing binds the `functionalscript` package to the exact
workflow filename, and the package's trusted publisher on npmjs.com names
`npm-publish.yml`. With the two out of step, the `publish-npm` job's
`npm publish --provenance` step fails its OIDC exchange on every push to
`main` — and fails quietly, because the step is `continue-on-error` (see
[publish-only-a-new-version](publish-only-a-new-version.md)). A version bump
pushed in that state would not reach the registry.

Nothing in this repository can make the change: it is a setting of the package
on npm, made by a maintainer with publish rights. And nothing in this
repository can hold both names authorized at once: npm keeps one trusted
publisher per package, so at every instant exactly one of the two filenames
publishes. Keeping the old file beside the new one through a transition would
not close that: it would put two publish workflows on the same trigger, which
[README.md](../README.md#the-publishing-workflow) rejects, and move the same
gap to the day the old file is deleted. So the switch is not staged; it is one
act, below.

### Steps

On npmjs.com, signed in as a maintainer of `functionalscript`:

1. Open the package page, <https://www.npmjs.com/package/functionalscript>,
   and go to **Settings**.
2. Under **Publishing access**, find the **Trusted publisher** section, which
   lists one GitHub Actions publisher: organization or user `functionalscript`,
   repository `functionalscript`, workflow filename `npm-publish.yml`.
3. Edit it (or remove it and add a new GitHub Actions publisher) so the
   **Workflow filename** reads `gen.npm-publish.yml`. Keep the organization and
   repository as they are, and leave **Environment name** empty: the generated
   workflow declares no environment.
4. Save.

The filename is the only field that changes. Provenance keeps working: npm
records the workflow path that produced each tarball, so releases after the
change simply name the new path.

### Timing

The rename merges and the setting changes in one sitting: merge the pull
request, then make the change above at once, before anything else is pushed to
`main`. There is no ordering in which both names work — before the merge only
`npm-publish.yml` exists on `main`, after it only `gen.npm-publish.yml` — so
the two steps together are the release-safe unit, and the version in
`package.json` stays where it is until both are done. Then release: confirm
the change by watching the `publish-npm` job on the first push to `main` that
bumps the version, where the `npm publish --provenance` step succeeds instead
of being carried by `continue-on-error`.

### Downstream

Every project that regenerates with this version deletes its old
`.github/workflows/ci.yml` and `.github/workflows/npm-publish.yml` by hand:
the generator does not remove what an earlier version wrote
([README.md](../README.md#fjs-ci-is-not-stable)), and GitHub loads every
workflow in the directory, so a leftover `ci.yml` runs the whole matrix a
second time on every pull request and a leftover `npm-publish.yml` is a second
publish workflow on the same trigger. A project that publishes also updates
its trusted publisher's workflow filename, in the same sitting
([README.md](../README.md#the-publishing-workflow)).

### Tasks

- [ ] Update the trusted publisher on npmjs.com as above.
- [ ] Confirm the next release's `npm publish --provenance` step succeeds.
- [ ] Delete this issue.
