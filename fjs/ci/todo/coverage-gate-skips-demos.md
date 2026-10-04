## Measure coverage of `demo.f.mjs` files

**Priority:** P3
**Status:** open

### Problem

[`AGENTS.md`](../../../AGENTS.md#3-functionalscript-and-typescript-fjs) asks
every new `.f.mjs` module for a co-located proof with 100% coverage. The gate
that enforces it does not see demos. `npm run cov` in `package.json` measures
`**/module.f.mjs` and `**/module.f.js`, and `deno task cov` in `deno.json`
selects the same files, so no `demo.f.mjs` is ever measured. A demo can lose
coverage and every check stays green.

It already has. Measured at `34c74956` with

```sh
node --test --experimental-test-coverage --test-coverage-include='**/demo.f.mjs'
```

every `demo.f.mjs` but one is at 100%. `fjs/types/bigint/demo.f.mjs` is not:
no proof hands its `mathLog2` a value of `2n ** 1023n` or more, so the first
shift is always zero, the doubling loop breaks before its body, and the
halving loop after it never runs.

A demo's coverage is otherwise self-reported, which is how a review of
[functionalscript/functionalscript#2545](https://github.com/functionalscript/functionalscript/pull/2545)
found it: the PR stated `fjs/rtti/demo.f.mjs` was at 100%, and no gate could
confirm it.

### Proposal

- Bring `fjs/types/bigint/demo.f.mjs` to 100% first, with a proof that hands
  `mathLog2` a value of at least `2n ** 1023n`, so widening the gate does not
  turn CI red.
- Widen the filter to include demos — `**/demo.f.mjs`, or every authored
  `*.f.mjs` if the other non-module FunctionalScript files also meet the rule —
  in `package.json`'s `cov` and `deno.json`'s `cov` together, since
  [`../README.md`](../README.md) requires the two to select the same files.
- Check what Bun's `bun test --coverage` measures, and keep it in step.

### Related

- [`../README.md`](../README.md) — the `cov` scripts and why the runners
  share one filter.
- [`fjs/types/bigint/demo.f.mjs`](../../types/bigint/demo.f.mjs) — the demo
  below 100% today.
