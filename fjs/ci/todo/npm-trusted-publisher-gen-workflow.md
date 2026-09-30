## npm-trusted-publisher-gen-workflow. Point npm's trusted publisher at `gen.npm-publish.yml`

**Priority:** P2
**Status:** open

### Problem

The publishing workflow is now `.github/workflows/gen.npm-publish.yml`
(`npmPublishPath` in [`../publish/module.f.mjs`](../publish/module.f.mjs)).
npm's trusted publishing binds the `functionalscript` package to the exact
workflow filename, and the package's trusted publisher on npmjs.com still names
`npm-publish.yml`. Until it is updated, the `publish-npm` job's
`npm publish --provenance` step fails its OIDC exchange on every push to
`main` — and fails quietly, because the step is `continue-on-error` (see
[publish-only-a-new-version](publish-only-a-new-version.md)). The next
version bump would not reach the registry.

Nothing in this repository can make the change: it is a setting of the package
on npm, made by a maintainer with publish rights.

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

Make the change after this rename lands on `main` and before the next version
bump. Between the two, no release is possible either way — the old publisher
names a file that no longer exists on `main`. Confirm it by watching the
`publish-npm` job on the first push to `main` that bumps `package.json`'s
version: the `npm publish --provenance` step succeeds instead of being carried
by `continue-on-error`.

### Downstream

Every project that publishes with an `fjs ci`-generated workflow does the same
two things when it regenerates with this version: updates its trusted
publisher's workflow filename, and deletes its old `npm-publish.yml`, which
the generator does not remove and which would otherwise be a second publish
workflow on the same trigger
([README.md](../README.md#the-publishing-workflow)).

### Tasks

- [ ] Update the trusted publisher on npmjs.com as above.
- [ ] Confirm the next release's `npm publish --provenance` step succeeds.
- [ ] Delete this issue.
