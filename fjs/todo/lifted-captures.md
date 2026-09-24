## Nest the helpers the old hoist rule lifted

**Priority:** P4
**Status:** open

### Problem

[`fjs/AGENTS.md`](../AGENTS.md#hoist-helpers-to-module-scope) §3.3 used to
treat "doesn't capture local state" as a target. A named helper was to lift
its captures into leading curried parameters and move to module scope, and a
fold's step function was to carry its per-call context in the accumulator.
The rule now says the opposite: a helper that captures local state stays in
the scope that holds it, because a parameter every call fills with the same
local carries no information.

Several helpers were shaped by the old text and cite §3.3 for it, so their
comments now point a reader at a rule that contradicts them:

- `fjs/effects/module.f.mjs` — `_walkLoop`, whose `f` leads "so this
  function has a context-free identity".
- `fjs/git/refstore/module.f.mjs` — `stepped`, `refOf`, `readAsRef`.
- `fjs/git/refstore/proof.f.mjs` — `nameAt`, `linkedHeadHost`.
- `fjs/git/packidx/module.f.mjs` — `offsetIn`, `nextStep`.
- `fjs/git/packidx/proof.f.mjs` — `withTwoSlots`.
- `fjs/git/store/module.f.mjs` — `inOne`.

Not on the list: citations of §3.3 for a helper that was already closed, such
as `u8ToUnpacked` in `fjs/types/bit_vec`, or for a call-invariant value bound
once, such as the paths in `fjs/git/packstore`'s `packOf`. Those follow the
rule as it stands.

### Proposal

For each helper, check whether a lifted parameter is filled with the same
local at every call. Where it is, move the helper back into the scope that
holds the value and drop the parameter. Where a parameter really varies
between calls, such as `offsetIn`'s `lo` and `hi` across its bisection, keep
that parameter, and replace the §3.3 citation with the actual reason. Either
way no comment goes on citing §3.3 for lifting a capture.

### Tasks

- [ ] `effects`: `_walkLoop`.
- [ ] `git/refstore` and its proofs.
- [ ] `git/packidx` and its proofs.
- [ ] `git/store`: `inOne`.
- [ ] `tsc`, `fjs test`, and `npm run cov` at 100% after each.

### Related

- [`../AGENTS.md`](../AGENTS.md#hoist-helpers-to-module-scope) — the rule.
