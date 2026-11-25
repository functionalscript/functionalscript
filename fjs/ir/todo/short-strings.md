## Short strings in the IR

**Priority:** P2
**Status:** wip — design PR; no packing/unpacking, host ABI, link, or feature proofs until the design is approved

### Problem

After scalar Any in the IR ([runtime-in-ir.md](../../../doc/sasha-gil/ir/runtime-in-ir.md),
[#4113](https://github.com/functionalscript/functionalscript/pull/4113)),
numeric programs shed most L0 import traffic, but string-heavy demos such
as `repeat` stay reference-shaped: short values still take NaNVM dyn-refs
and pay `kind_ref` / `dup_ref` / `drop_ref`. The modular runtime already
names several interchangeable String implementations; coding one packing
path without that interface would lock the experiment.

### Proposal

Design only first: one String **runtime module interface**, several
candidate implementations (host-backed baseline, NaN memory-saving, NaN
CPU-saving), and an experiment plan that swaps variants without rewriting
callers. Full note:
[`doc/sasha-gil/ir/short-strings.md`](../../../doc/sasha-gil/ir/short-strings.md).

Do **not** start S1–S4 coding until that design is approved.

### Tasks

- [x] Design note under `doc/sasha-gil/ir/` (interface, candidates, experiment, non-goals, open questions, later slices)
- [x] Claim with this `todo/` and a docs-only PR
- [ ] Owner approval of the design (Sergey / Sasha)
- [ ] **S1** — String module skeleton + short pack/unpack helpers; unused by programs; no link change
- [ ] **S2** — Host / NaNVM ABI emits and accepts short-string boxes; long path unchanged
- [ ] **S3** — Link / L1 string ops use the short path; parity vs L0
- [ ] **S4** — Remeasure; update `benchmark.md`
- [ ] Optional **S5+** — second variant behind the same interface; compare

### Related

- [short-strings.md](../../../doc/sasha-gil/ir/short-strings.md) — the design
- [modular-runtime.md](../../../doc/sasha-gil/wasm/modular-runtime.md) — String variants and `unpack` / `length` / `at`
- [modular-l0.md](../../../doc/sasha-gil/wasm/modular-l0.md) — String as an L0 module
- [runtime-in-ir.md](../../../doc/sasha-gil/ir/runtime-in-ir.md) — “Short strings come after”
- [defined-hooks.md](../../../doc/sasha-gil/ir/defined-hooks.md) — short strings keep `isRef` false
- [`fjs/ir/runtime/any`](../runtime/any/module.f.js) — current runtime-module pattern (do not extend in the design PR)
