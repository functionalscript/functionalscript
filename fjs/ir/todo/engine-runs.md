## Engine runs in files of their own

**Priority:** P3
**Status:** open — the owner's direction of 2026-11-27: engine runs stay in
`proof.mjs` for now, and move into files of their own later

### Problem

Several host proofs of `fjs/ir` compile modules of the IR to WebAssembly
and run them on the host's engine against twins in JavaScript:
`wasm/proof.mjs` for the emitter, the proofs that NaNVM's test runs again
on its `.wasm`, and more as the runtime in the IR grows, such as the
heap's. [fjs/AGENTS.md §1.6](../../AGENTS.md#16-a-host-proof-is-for-an-effect-and-for-nothing-else)
keeps `proof.mjs` for effects, and whether an engine run is one came up on
[#4150](https://github.com/functionalscript/functionalscript/pull/4150),
where a review asked to take one out. The owner ruled that they prove an
effect for now and stay
([host proofs for effects only](../../../todo/host-proofs-for-effects-only.md#engine-runs)),
and that they move later, so that `proof.mjs` holds only effects in
§1.6's narrow sense and no review needs to ask again.

### Proposal

Give engine runs a kind of file of their own, named outside the host
proofs that `js-only.mjs` finds, as
[`l0/host/nanvm/nanvm.test.mjs`](../l0/host/nanvm/nanvm.test.mjs) is, and
have CI run them by name, as it runs that one. The runs keep what they
check today: that each module validates, that each function agrees with
its twin, and, through NaNVM's test, the same on NaNVM's `.wasm`.

### Tasks

- [ ] List every engine run under `fjs/ir`, and the cases in each that run
      on the engine and those that do not
- [ ] Choose the files' names, and where CI runs them
- [ ] Move the runs, with NaNVM's test still running them on its `.wasm`,
      and every count of tests the same before and after
- [ ] Say in §1.6 where engine runs live

### Related

- [host proofs for effects only](../../../todo/host-proofs-for-effects-only.md#engine-runs):
  the ruling that keeps them in `proof.mjs` until then
- [`wasm/proof.mjs`](../wasm/proof.mjs): the emitter's engine runs, and
  the case that raised the question
