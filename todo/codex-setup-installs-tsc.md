## Codex setup lacks the pinned tsc

**Priority:** P3
**Status:** open

### Problem

[CONTRIBUTING.md](../CONTRIBUTING.md#openai-codex-environment)'s "OpenAI Codex
environment" says "Both `npm test` and `npm run cov` work in this environment",
and gives a setup script that runs `rustup component add`, `npm ci` and
`cargo fetch`. Nothing in it installs TypeScript.

`npm test` is `tsc && node ./fjs/module.mjs t`, and `package.json`'s only
`devDependency` is `@types/node`. The same document's
[Requirements](../CONTRIBUTING.md#requirements) says TypeScript "is **not** an
npm dependency of this package, so `npm ci` does not install it" and asks for
exactly the version [`fjs/ci/config/module.f.mjs`](../fjs/ci/config/module.f.mjs)
pins in `typescript`. So in the environment the script builds, `npm test`
either finds no `tsc` or runs whatever compiler the image happens to carry.

### Tasks

- [ ] Install the pinned compiler in the Codex setup script (a global
      `npm install -g typescript@<version>` naming the configured version),
      or narrow the claim to `npm run cov`
- [ ] Keep the version in one place, so the script cannot drift from the pin

### Related

- [check-set-ci-parity](./check-set-ci-parity.md) — the checks this
  environment is meant to run
