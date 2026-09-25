## Every implementation module has a proof beside it

**Priority:** P5
**Status:** open

### Problem

[`fjs/AGENTS.md` §1.2](../AGENTS.md#12-proof-coverage-is-mandatory) says an
implementation module ships with a proof in its own directory. Six
`module.f.mjs` files have none, so whatever covers them is some other
directory's proof, and a change there can drop their coverage without a
reader of either module noticing.

Four of them export functions:

- [`fjs/ci/common`](../ci/common/module.f.mjs) — `uses`, `install`, `test`,
  `toSteps`, `ubuntu`, `ubuntuArm`, and the `parseGitHubAction` parser over its
  schemas; reached only through the `fjs/ci` proofs.
- [`fjs/effects/list`](../effects/list/module.f.mjs) — `empty` and
  `nonEmpty`; reached through the `fjs/cas`, `fjs/mcp` and `fjs/media/type`
  proofs.
- [`fjs/effects/mock`](../effects/mock/module.f.mjs) — `run` and
  `partialRun`, the runner more than a dozen other proofs drive their effects
  with.
- [`fjs/types/btree/types`](../types/btree/types/module.f.mjs) —
  `collapseRoot`; reached through `fjs/types/btree/remove` and
  `fjs/types/btree/set`.

Two hold data only, and whether §1.2 reaches them is not written down:

- [`fjs/ci/config`](../ci/config/module.f.mjs) — the pinned versions, images
  and actions.
- [`fjs/website/style`](../website/style/module.f.mjs) — the stylesheet and
  its links.

### Tasks

- [ ] A `proof.f.mjs` for `fjs/ci/common`, `fjs/effects/list`,
      `fjs/effects/mock` and `fjs/types/btree/types`, covering every export.
- [ ] State in `fjs/AGENTS.md` §1.2 whether a module that exports only data
      needs a proof of its own, and add one for `fjs/ci/config` and
      `fjs/website/style` if it does.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [in-module-proof-exports.md](./in-module-proof-exports.md) — the opposite
  case: modules whose proof lives inside the module.
