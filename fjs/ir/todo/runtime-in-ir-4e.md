# Checkpoint 4e: link Any into programs + counting host boxes + remeasure

**Priority:** P1
**Status:** wip

## Problem

Checkpoint 4d-2 writes Any in the IR (`fjs/ir/runtime/any`). Programs still
import L0's `Any`, so every scalar op stays a host import call. The counting
host still speaks handles (`-1…-4` for constants; numbers as cells), so lifetime
proofs cannot run a program that inlines Any's bit hooks.

## Proposal

1. **Counting host speaks NaN boxes** — scalars are immediates (Sergey
   boxes; `number` in copy); references pack a cell index as a dyn-ref;
   host supplies `kind_ref` / `dup_ref` / `drop_ref` / `same_ref`.
2. **`linkAny`** — merge Any's IR module into a program the way L1's
   `link` does: drop the `Any` import, `defines` `any`, keep `Ref` (and
   the rest of L0); rewrite `Any.*` to `self.*` / constants; unexported
   helpers stay local.
3. **Remeasure** — `doc/sasha-gil/ir/benchmark.run.mjs` (times + `calls`)
   and update `benchmark.md` / plan ticks.

May land as stacked PRs (git-base only). Depends on 4d-2 (#4113).

## Tasks

- [x] Counting host speaks NaN boxes + Ref ops; update `count/proof.mjs`
- [ ] `linkAny` for programs; proofs on NaNVM and counting host
- [ ] Remeasure demos; tick `runtime-in-ir.md` / `defined-hooks.md`

## Related

- [runtime-in-ir.md](../../../doc/sasha-gil/ir/runtime-in-ir.md) choice 5, open Q2
- [defined-hooks.md](../../../doc/sasha-gil/ir/defined-hooks.md) step 3
- PR #4113 (checkpoint 4d-2)
