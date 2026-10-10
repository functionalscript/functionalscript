## Simplify pre-1.0 releases

**Priority:** P3
**Status:** open

### Problem

Most changes are breaking before 1.0, so mandatory `BREAKING CHANGES`
notices add little value. Regular releases and urgent fixes need a simple,
consistent versioning policy.

### Tasks

- [ ] Before 1.0, drop mandatory `BREAKING CHANGES` notices, since most changes
      are breaking.
      Reconcile the requirement in contributor, release, and module
      documentation, including [fjs/AGENTS.md](../fjs/AGENTS.md) and
      [fjs/compiler/README.md](../fjs/compiler/README.md), and every open TODO
      that mandates the declaration, including
      [commit-message enforcement](./commit-message-enforcement.md).
- [ ] Until 1.0, publish regular releases as `0.X.0`.
- [ ] Publish urgent fixes as `0.X.1`, based on the corresponding `0.X.0` commit.
      Publish subsequent urgent fixes as `0.X.2`, `0.X.3`, and so on,
      cumulatively based on the previous urgent-fix release on the same `0.X`
      release line. Never reuse a published version.
      Provide a publishing path for these release-line commits after `main`
      has advanced, with matching npm trusted-publisher configuration. Update
      the publishing workflow generator and release procedure so an urgent
      fix can publish without including later development changes from `main`.
      Select npm distribution tags explicitly: regular releases and urgent
      fixes on the newest released line use `latest`. Publish fixes for older
      lines with a maintenance tag (for example, `release-0.X`) and leave
      `latest` unchanged, so `npm install functionalscript` continues to install
      the newest release line. Verify this behavior in the publishing checks.
      Reconcile every open publishing TODO that assumes versions publish only
      from `main`, including
      [publishing packages](../fjs/ci/todo/publishing-packages.md), with this
      release-line publishing path.
      Carry every release-line fix into `main` before the next regular release,
      adapting it if needed for the current code so upgrading to that release
      preserves the fix. If `main` already contains the fix, record that in the
      urgent-fix PR.

### After 1.0

The release policy after 1.0 remains an open question and is outside this
task's scope. Do not decide whether mandatory notices return as part of this
work. A possible direction is to continue releasing on branches, introducing
breaking changes with major-version updates (`Mj.?.?`) and adding features
within a major version (`Mj.Mi.?`). This is tentative, not an adopted policy;
defer that discussion until it is needed.

### Related

- [Publishing workflow generator](../fjs/ci/publish/module.f.mjs) — extend
  the current `main`-only trigger to support release-line fixes; regenerate
  the workflow from its source.
- [Publishing packages](../fjs/ci/todo/publishing-packages.md) — reconcile its
  main-only publishing instructions when implementing release-line fixes.
- [CONTRIBUTING.md](../CONTRIBUTING.md#commit-messages) and
  [AGENTS.md](../AGENTS.md#5-pull-requests-and-releases) — update the
  mandatory notice requirement when implementing this policy.
- [changelog/README.md](../changelog/README.md#breaking-changes-and-versioning)
  and [changelog/RELEASE.md](../changelog/RELEASE.md) — align versioning and
  release procedures with this policy.
- [Commit-message enforcement](./commit-message-enforcement.md) — this
  proposal supersedes its pre-1.0 requirement to derive version bumps from
  `BREAKING CHANGES` declarations; reconcile that task when implementing it.
