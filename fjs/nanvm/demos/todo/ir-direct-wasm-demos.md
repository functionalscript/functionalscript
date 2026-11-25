## IR direct-to-WASM on sort and Collatz demos

**Priority:** P2
**Status:** wip

### Problem

The sort and Collatz website demos compare FunctionalScript as JavaScript with
`fjs compile` → Rust → WASM only. After runtime-in-IR through `linkAny`, there
is no third route that runs the same workloads as IR-emitted WASM on NaNVM L0,
so the pages never show live timings for the direct-to-WASM path those demos
motivated.

### Proposal

Add IR-lowerable pure programs for both demos, publish their emitted WASM with
`nanvm_l0_wasm` beside the existing Rust module, host the IR module in the
browser next to Rust→WASM, and extend the page UI with a third Run column.
Remeasure after wiring. Short strings stay design-only.

### Tasks

- [ ] IR-lowerable Collatz and sort programs (pure exports; same report text)
- [ ] Build/publish: IR `.wasm` + `nanvm_l0_wasm` under `nanvm/demos/wasm/`
- [ ] Browser host for IR→WASM beside Rust→WASM
- [ ] UI third route on sort and Collatz pages
- [ ] Remeasure and note figures; delete this `todo/` when done

### Related

- [`todo/wasm-demos.md`](../../../../todo/wasm-demos.md) — existing two-route demos
- [`doc/sasha-gil/ir/runtime-in-ir.md`](../../../../doc/sasha-gil/ir/runtime-in-ir.md) — collatz/sort L0 profiles
- Project plan: IR demo pass (FIB-23); prefer one coherent PR off `main`
