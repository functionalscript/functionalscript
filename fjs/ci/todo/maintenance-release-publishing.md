# Publish maintenance releases from reviewed release commits

**Priority:** P1
**Status:** open

## Problem

The pre-1.0 policy allows urgent fixes from a released `0.X.0` commit, then
successive patches from the preceding fix release. The current generated npm
workflow publishes only main pushes. Maintenance publishing needs its own
implementation; it is deferred from the policy PR so removing mandatory
breaking notices does not depend on registry administration.

A manual trigger alone is insufficient: repository write access lets a caller
select an unreviewed branch. npm trust in the repository and workflow filename
alone does not constrain that branch. An environment field alone is insufficient
too: a writer can omit it in a branch's workflow. Existing main publishing must
continue to work when this path is added.

## Tasks

- [ ] Publish the exact reviewed maintenance release commit without later main
      development; extend the generator and proofs, then regenerate workflows.
- [ ] Establish an enforceable release authorization boundary before enabling a
      manual path. One option is a protected deployment environment bound in
      npm's trusted publisher, with authorized release reviewers and no bypass.
      Reviewers verify the exact commit, version, and release PR.
- [ ] If replacing a trusted publisher, recreate the immutable connection with
      the exact workflow and environment identity, explicitly enable direct
      `npm publish`, and remove alternate paths that bypass approval.
- [ ] Schedule replacement within two days of the planned real release and
      verify its first successful publish before that deadline. Recreate an
      expired connection before retrying; do not wait for an unspecified next
      release or publish a throwaway version to validate setup. Confirm npm's
      current activation requirements when implementing this workflow.
- [ ] Select npm distribution tags explicitly: regular releases and urgent
      fixes on the newest released line use `latest`. Publish fixes for older
      lines with a maintenance tag (for example, `release-0.X`) and leave
      `latest` unchanged, so `npm install functionalscript` continues to install
      the newest release line. Verify both cases in the publishing checks.
- [ ] Verify the actual publish step and exact registry version and dist-tag;
      a green workflow or `npm whoami` cannot establish publication while the
      publish step tolerates failure. Coordinate with publish-only-a-new-version.
- [ ] Reconcile every publishing proposal that assumes main-only releases,
      including publishing-packages and publish-only-a-new-version. Version
      checks must cover regular and maintenance release windows.
- [ ] Update the maintenance release procedure with the implemented path and
      required configuration. Carry fixes into main before the next regular
      release, adapting them if needed or recording that main already has them.

## Evidence and related work

- [Approval boundary review](https://github.com/functionalscript/functionalscript/pull/2761#discussion_r4233684939)
- [Direct publish permission review](https://github.com/functionalscript/functionalscript/pull/2761#discussion_r4234014314)
- [Publisher activation window review](https://github.com/functionalscript/functionalscript/pull/2761#discussion_r4234543720)
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- [Publishing packages](./publishing-packages.md)
- [Publish only a new version](./publish-only-a-new-version.md)
- [Release procedure](../../../changelog/RELEASE.md#urgent-fixes-before-10)

The policy PR's attempt to configure a protected GitHub environment returned
HTTP 403 (`Resource not accessible by integration`); npm configuration was also
outside its integration. Those administrative steps belong to this implementation,
not to the pre-1.0 policy change.
