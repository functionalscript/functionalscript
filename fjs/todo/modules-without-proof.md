## Every implementation module has a proof beside it

**Priority:** P5
**Status:** wip

### Problem

[`fjs/AGENTS.md` §1.2](../AGENTS.md#12-proof-coverage-is-mandatory) says an
implementation module ships with a proof in its own directory. Every
`module.f.mjs` that exports a function now has one. Two that hold data only
do not, and whether §1.2 reaches them is not written down:

- [`fjs/ci/config`](../ci/config/module.f.js) — the pinned versions, images
  and actions.
- [`fjs/website/style`](../website/style/module.f.mjs) — the stylesheet and
  its links.

### Tasks

- [x] A `proof.f.mjs` for `fjs/ci/common`, `fjs/effects/list`,
      `fjs/effects/mock` and `fjs/types/btree/types`, covering every export.
- [ ] State in `fjs/AGENTS.md` §1.2 whether a module that exports only data
      needs a proof of its own, and add one for `fjs/ci/config` and
      `fjs/website/style` if it does.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [in-module-proof-exports.md](./in-module-proof-exports.md) — the opposite
  case: modules whose proof lives inside the module.
