## node-pin-steps. The pinned-Node steps are private to `ci/node` and respelled by three modules

**Priority:** P4
**Status:** open

### Problem

`fjs/ci/node` has both builders — `installNode`, the `setup-node`
step, and `nodeVersionStep`, whose doc explains the leading `v` that
`node --version` prints — and exports neither. So:

```js
// fjs/ci/package, packageCheckJob
uses('actions/setup-node', { 'node-version': node.default })
// fjs/ci/publish, publishSteps
install(uses('actions/setup-node', { 'node-version': node.default, 'registry-url': registry }))
// fjs/ci/module.f.mjs, shellPlatformSteps
nixVersionStep(nixShell, 'node --version', `v${node.default}`)
```

restate the action, its input key and the pin, and the last re-derives
the `v` quirk. A new `setup-node` input or a changed `--version` format
is found in four places.

### Proposal

Export the two from `fjs/ci/node/module.f.mjs`, `installNode` taking
extra inputs for the registry, and the three sites call them.

### Tasks

- [ ] The exports; the three sites; `npm run gen` regenerates
      byte-identical workflows; `fjs test`.

### Related

- [66h-ci-npm-global-install.md](./66h-ci-npm-global-install.md) — the
  same move for global installs.
