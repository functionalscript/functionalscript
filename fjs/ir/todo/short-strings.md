## Short strings in the IR

**Priority:** P2
**Status:** wip — design approved (Sasha, #4118); S1–S3 done; S4 coding

### Problem

After scalar Any in the IR ([runtime-in-ir.md](../../../doc/sasha-gil/ir/runtime-in-ir.md),
[#4113](https://github.com/functionalscript/functionalscript/pull/4113)),
numeric programs shed most L0 import traffic, but string-heavy demos such
as `repeat` stay reference-shaped: short values still take NaNVM dyn-refs
and pay `kind_ref` / `dup_ref` / `drop_ref`. The modular runtime already
names several interchangeable String implementations; coding one packing
path without that interface would lock the experiment.

### Proposal

One String **runtime module interface**, several candidate implementations
(host-backed baseline, NaN memory-saving, NaN CPU-saving), and an experiment
plan that swaps variants without rewriting callers. Full note:
[`doc/sasha-gil/ir/short-strings.md`](../../../doc/sasha-gil/ir/short-strings.md).
Design approved; S1 lands the skeleton under `fjs/ir/runtime/string`.

### Tasks

- [x] Design note under `doc/sasha-gil/ir/` (interface, candidates, experiment, non-goals, open questions, later slices)
- [x] Claim with this `todo/` and a docs-only PR
- [x] Owner approval of the design (Sasha on [#4118](https://github.com/functionalscript/functionalscript/pull/4118); Sergey not required for this gate)
- [x] **S1** — String module skeleton + short pack/unpack helpers; unused by programs; no link change (`fjs/ir/runtime/string`)
- [x] **S2** — Host / NaNVM ABI accepts short boxes; emit policy is per-variant (off for A, on for B/C when a concrete enabled tag fits)
- [x] **S3** — Link / L1 string ops use the short path (`linkString` + B IR length/unit); parity vs L0
- [ ] **S4** — Remeasure; update `benchmark.md`
- [ ] Optional **S5+** — second variant behind the same interface; compare

### Related

- [short-strings.md](../../../doc/sasha-gil/ir/short-strings.md) — the design
- [modular-runtime.md](../../../doc/sasha-gil/wasm/modular-runtime.md) — String variants and `unpack` / `length` / `at`
- [modular-l0.md](../../../doc/sasha-gil/wasm/modular-l0.md) — String as an L0 module
- [runtime-in-ir.md](../../../doc/sasha-gil/ir/runtime-in-ir.md) — “Short strings come after”
- [defined-hooks.md](../../../doc/sasha-gil/ir/defined-hooks.md) — short strings keep `isRef` false
- [`fjs/ir/runtime/any`](../runtime/any/module.f.js) — current runtime-module pattern (do not extend in the design PR)
