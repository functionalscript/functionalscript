## Any's module in the IR

**Priority:** P1
**Status:** wip

### Problem

Checkpoint 4d-2 of
[runtime-in-ir.md](../../../../doc/sasha-gil/ir/runtime-in-ir.md): Any is
still only NaNVM's import. With seal/unseal, hooks over bits, `release`, and
`Ref` on main (#4108, #4109), the module that defines `any` can be written in
the IR over the NaN box.

### Proposal

`fjs/ir/runtime/any` defines `any` with carrier `i64`, hooks over bits that
call `Ref` for a reference and pass other boxes through, and the scalar
functions and constants of
[defined-hooks.md](../../../../doc/sasha-gil/ir/defined-hooks.md) /
runtime-in-ir.md choice 6. `number` joins `copy`. Prove against L0 on
NaNVM. Linking into programs is 4e, not this step.

Open questions from defined-hooks.md left as they are for this step: `kind`
stays `(v: any) -> int(0, 8)` (not bits); hook effects stay inferred; a
`dup` keeps the variant as the lifetime pass already seals.

### Tasks

- [ ] `fjs/ir/runtime/any`: `isRef`, `kind`, `dup` / `drop`, then `to_f64` /
  `from_f64` / `to_bool` / `from_bool` / `same` and the four constants
- [ ] Checker / lifetime / print proofs of the module
- [ ] NaNVM host proof against L0 on the same boxes (no leak)

### Related

- [runtime-in-ir.md](../../../../doc/sasha-gil/ir/runtime-in-ir.md)
- [defined-hooks.md](../../../../doc/sasha-gil/ir/defined-hooks.md)
- #4108, #4109
