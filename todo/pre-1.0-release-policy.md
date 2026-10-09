## Simplify pre-1.0 releases

**Priority:** P3
**Status:** wip

### Problem

Most changes are breaking before 1.0, so mandatory `BREAKING CHANGES`
notices add little value. Regular releases and urgent fixes need a simple,
consistent versioning policy.

### Tasks

- [ ] Drop mandatory `BREAKING CHANGES` notices, since most changes are breaking.
- [ ] Until 1.0, publish regular releases as `0.X.0`.
- [ ] Publish urgent fixes as `0.X.1`, based on the corresponding `0.X.0` commit.

### Related

- [CONTRIBUTING.md](../CONTRIBUTING.md#commit-messages) and
  [AGENTS.md](../AGENTS.md#5-pull-requests-and-releases) — update the
  mandatory notice requirement when implementing this policy.
- [changelog/README.md](../changelog/README.md#breaking-changes-and-versioning)
  and [changelog/RELEASE.md](../changelog/RELEASE.md) — align versioning and
  release procedures with this policy.
- [Commit-message enforcement](./commit-message-enforcement.md) — this
  proposal supersedes its pre-1.0 requirement to derive version bumps from
  `BREAKING CHANGES` declarations; reconcile that task when implementing it.
