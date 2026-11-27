# Short strings in the IR

2026-11-24. **Design approved** (Sasha, [#4118](https://github.com/functionalscript/functionalscript/pull/4118)).
S1: String module skeleton in
[`fjs/ir/runtime/string`](../../../fjs/ir/runtime/string/module.f.js).
S2: counting host and NaNVM L0 ABI **accept** short-string boxes; **emit**
is per-variant (`alwaysDynRef` / `emitA` for A, `shortWhenEnabled` + v1
tags / `emitB` for B/C). S3: `linkString` merges B IR `length`/`unit`
(short path; long miss still imports). S4: remeasure (`shortOps`
primary, `repeat` secondary; variant B) in [benchmark.md](./benchmark.md).
**Decision gate:** NaNVM-targeted hosts default to B (`emitB`); counting
stays A (`emitA`) as the dyn-ref control.

This is the next runtime-in-IR phase after scalar Any
([runtime-in-ir.md](./runtime-in-ir.md); checkpoints through 4d-2 on
`main` as [#4113](https://github.com/functionalscript/functionalscript/pull/4113),
with 4e linking/remeasure merged as #4114–#4116). It follows the
[modular runtime](../wasm/modular-runtime.md) and
[modular L0](../wasm/modular-l0.md) notes: several String implementations
behind one module interface, swappable without rewriting callers.

Tracker: [`fjs/ir/todo/short-strings.md`](../../../fjs/ir/todo/short-strings.md).

## Why now

Slice 1 put NaN-boxed **scalars** in IR Any (`fjs/ir/runtime/any`). Numeric
loops lose most L0 import traffic; `kind` already reserves short-string /
short-bigint branches; `isRef` stays false for them so Any's `dup`/`drop`
hooks need no change when short strings appear
([defined-hooks.md](./defined-hooks.md)).

What is still expensive is **reference-shaped** work. On the After
linkAny table in [benchmark.md](./benchmark.md) (checkpoint 4e,
[#4116](https://github.com/functionalscript/functionalscript/pull/4116)
tip, merged with #4114–#4115), `repeat` is about **950×**
JavaScript, and its L0 import profile is mostly `kind_ref` / `dup_ref` /
`drop_ref` (plus container/string imports). The older third-run table on
`main` before linkAny had `repeat` at 108× with `kind`/`dup`/`drop`
instead — do not mix those runs. `repeat` (`n = 1_000`, append `'ab'`
from `e = ""`) grows past the eight-unit short maximum after a few
steps; the pre-linkAny profile attributed about 87% of its time to
copying increasingly long strings. Short strings are still the first
runtime-in-IR step that can cut **short** string traffic without
rewriting containers or Heap — but the primary comparison for that win
is a short-only microbench, not `repeat` as a short-hit rate demo.
`repeat` stays as a regression / long-path check (and for any early
iterations or `concat` policy that still help).

| Length class | Today (post–scalar Any) | This phase's target |
| --- | --- | --- |
| Short (matches an enabled Sergey tag: length **and** unit bit-widths) | Still a dyn-ref string on NaNVM | Inline in the box; String ops over the box or unpacked slots |
| Long (no matching enabled tag — too many units, or units too wide for every tag of that length) | NaNVM heap string behind a dyn-ref | Unchanged: NaNVM (or Naive) long path |

**Packing eligibility** is tag fit, not length alone. Example: four UTF-16
units including `U+0080` do not match `4×7` (7-bit units), so there is no
short box for that string even though length ≤ 8; emit/accept must choose
a concrete enabled tag or fall through long. Truncating or refusing such
a value is out of contract.

## Fit with the modular runtime

The architecture already says how to experiment:

- **[modular-runtime.md](../wasm/modular-runtime.md)** — one String module
  interface (`unpack`, `length`, `at`; `drop` a no-op for now), three
  variants (Naive, NaN CPU-saving, NaN memory-saving) that differ only in
  how an unpacked string is laid out.
- **[modular-l0.md](../wasm/modular-l0.md)** — L0 cut by kind; String owns
  string kinds and the string function list; Any owns the `i64` encoding
  (`box` / `box_inline` / `payload`); programs never see layouts.
- **[ir-design.md choice 13](./ir-design.md#13-an-unpacked-string-is-an-ir-type-laid-out-by-the-runtime-module)** —
  IR type `str` and table rows `unpack` / `length` / `at`; the emitter
  lays locals out from the module's manifest. Swap the module, keep the
  program.
- **Any as the current runtime-module example** —
  [`fjs/ir/runtime/any`](../../../fjs/ir/runtime/any/module.f.js): an IR
  module that `defines` a sealed type, exports an interface importers see,
  and links later as template form. Short strings belong in a **String**
  module beside it, not as an ad-hoc fork of Any's scalar helpers.

This design therefore treats short strings as **the first String-module
experiment in the IR**, not as a one-off packing patch inside Any.

## Runtime module interface

Callers (L1 bodies, demos, later link) depend only on this surface. Every
candidate implementation below must satisfy it. Names follow modular L0 /
the memo; where L0 says `unit` and the memo says `at`, this note keeps
both spellings as one function until an owner picks
([modular-l0 open](../wasm/modular-l0.md#where-this-draft-is-least-sure)).

### What programs and emitters see

| Piece | Role |
| --- | --- |
| **Import form** (`fjs:l0/string` or today's bundled `fjs:l0`) | Portable: every string op is a call; no slots; `unpack` is null / a no-op; `length` and `unit`/`at` take the source `any`. Baseline for parity proofs. |
| **Template form** (IR `str` rows) | Inlined fragments over locals whose count and types the **manifest** declares. Same three logical ops: `unpack(any) → str`, `length(str) → i32`, `at`/`unit`(str, i) → i32. |
| **Manifest** | Module name/version; required Any encoding (e.g. "NaN box"); slot types for template form (`i32`/`i64`/…); per-function import vs template (null = no-op); which long-string import path the short miss uses. |
| **Lifetime** | A `str` **borrows** its source `any`. No `dup`/`drop` of the unpacked value; the lifetime pass keeps the source alive until the last `str` use ([ir-design choice 13](./ir-design.md#13-an-unpacked-string-is-an-ir-type-laid-out-by-the-runtime-module)). |

Allocating ops that need runtime storage stay imports in both forms, as
modular L0 already draws: `make_string`, `concat`, `substring`,
`read_units` (and `from_unit` when it allocates a long string). A short
result may return through Any's **`box_inline`** instead of a heap
`box`+payload; that is an internal String↔Any call, not a program ABI.

### What Any must already provide (no new Any API in the first coding stack unless needed)

| Capability | Why String needs it |
| --- | --- |
| `kind` short-string branch (`x & 0xC != 0` → 4) | Already reserved in Any's IR `kind`. |
| `isRef` false for short strings | Hooks pass bits through; short strings are copy-like for counting. |
| `box_inline` / pack helpers (internal) | String builds a short box without a NaNVM slot. |
| `payload` / long dyn-ref path | Miss path: long string still a reference. |

Whether pack/unpack bit helpers live as **private functions of the String
module** (reading the box through `unseal` once String is allowed to see
string-narrowed `any`) or as **shared Any bit utilities** is an open
question below. Either way, **callers never import those helpers**; they
import String's public ops or use `str.*` rows.

### Interface contract (summary)

A String runtime module variant is valid for experiment if:

1. It implements `length` and `at`/`unit` for every string `any` the ABI
   admits (short and long), with the same observable results as today's L0
   view on the same inputs.
2. Its manifest states slot demand (including zero) and which functions are
   templates vs imports vs null.
3. **Storage (by variant class):**
   - **NaN short-string variants (B, C):** values whose encodings the
     variant **enables** do **not** take a dyn-ref slot; they live in the
     box. Every other string `any` (too long for any short tag, or a short
     tag the variant has not enabled yet) still goes through the
     host/NaNVM string path — same observable `length`/`at` as L0, just
     not inline. A v1 that enables only a subset must **force long** for
     the rest, not refuse them (refusal would break clause 1).
   - **Host-backed baseline (A):** never makes a short-string box; every
     string remains a dyn-ref. That is intentional: A is the portable
     control, not a NaN short-string implementation. The “no dyn-ref for
     enabled shorts” rule applies only to B and C.
4. Swapping the variant changes the linked String module, the Any
   encoding it requires if any, and the **host/runtime emission policy**
   for allocating string imports (`make_string`, `from_unit`, `concat`,
   …) — not L1 source or demo programs. Those imports stay imports in
   every form; whether they return short boxes or always dyn-refs is
   part of the variant's configuration (see experiment plan), so
   baseline A can still promise all-dyn-ref results.

## Candidate implementations

At least three variants plug into that interface. **None is chosen here**;
the point is to keep them interchangeable.

### A. Host-backed / import-form (baseline)

- **Layout:** every string is a dyn-ref; NaNVM (or the counting host) owns
  storage. No short-string box is ever made.
- **Manifest:** zero unpacked slots; `unpack` null; `length`/`unit` are
  imports (today's L0).
- **Tradeoffs:** already works; no win on `repeat`; perfect **control** for
  A/B measurement. Matches modular L0's "portable program" row.

### B. NaN memory-saving (decode on each read)

From [modular-runtime.md](../wasm/modular-runtime.md#naive-nan-cpu-saving-and-nan-memory-saving-string-runtime-modules)
and the [type-system worked example](./type-system.md#reading-two-string-functions-over-the-nan-box):

- **Layout:** short string lives entirely in the `any` bits (Sergey's scalar
  tags: empty, `1×16` … `8×6`, etc.). Unpacked form **is** the source
  `any` (zero extra slots).
- **Ops:** `unpack` null; each `length`/`at` re-decodes the box; long miss
  branches to the host string path.
- **Tradeoffs:** smallest frame; more bit work per access; good when strings
  are touched few times. Natural first IR coding shape: functions over
  `unseal`ed bits, like Any's scalars.

### C. NaN CPU-saving (unpack once into slots)

Also from the modular-runtime memo, with one correction below:

- **Long vs empty:** Sergey's box gives `""` its own short-string tag
  ([README](../../sergey-shandar/nanvm/README.md), empty string row), so
  length `0` is a valid short result. The modular-runtime memo's
  “length `0` = long” sentinel therefore **cannot** be used as written.
  Empty stays length `0` on the short arm. Pick **one** of the layouts
  below when C is implemented (open Q2); do not prescribe both.
- **Layout C-flag:** `unpack` writes a separate `i32` flag (`0` short /
  `1` long), a length local (`0…8` on the short arm), and unit slots
  (memo: up to eight 16-bit units). On the long arm the remaining slot
  holds a pointer/handle. Frame cost: flag + length + units (or handle).
- **Layout C-sentinel:** `unpack` writes a single length local where
  `0…8` means short (including empty) and a sentinel outside that range
  (e.g. `-1`) means long, plus the same unit / handle slots. No separate
  flag local. Frame cost: one fewer `i32` than C-flag.
- **Ops:** `length`/`at` branch on flag or sentinel, then read slots or
  the long path; decode cost paid once per unpack region.
- **Tradeoffs:** larger frames than B; cheaper repeated `at`. Measure the
  frame cost of the **chosen** layout, not an unconditional “extra local.”
  Needs the IR/emitter to honour multi-local `str` layouts (choice 13),
  which memory-saving can defer.

### How they plug in

```text
  program / L1 ──► str.unpack / str.length / str.at   (IR rows, fixed)
                        │
                        ▼
              String module variant (A | B | C)
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
     L0 imports    bit decode     unpack to slots
     (host)        on each read   then cheap at
                        │             │
                        └──────┬──────┘
                               ▼
                    long miss → NaNVM / host string
```

Any stays the encoding owner; String variants that need NaN short tags
require NaN Any (as modular L0's example runtimes table already shows).
Variant A works with either Any form.

A fourth idea — **128-bit values** holding longer inline strings
([128bit.md](../../sergey-shandar/nanvm/128bit.md)) — is noted only as a
later experiment family; it would still expose the same `str` rows, with a
different Any carrier. Out of scope for the first coding stack.

## Experiment plan

Goal: compare A/B/C **without rewriting callers**.

1. **Fix the programs.** Primary: a short-only microbench (literals +
   `length`/`unit`/`concat` whose results stay within the enabled short
   encodings). Secondary: keep `repeat` as a long-path / regression check
   (it is mostly long after a few steps). Callers use `str` rows or L0
   String names only.
2. **Vary the String runtime configuration** at link/emit time: the
   String module variant (import A vs template B/C), the Any encoding it
   requires, **and** the host/NaNVM emission policy for allocating string
   imports. Allocating ops (`make_string`, `from_unit`, `concat`, …) stay
   imports in every form; A configures them to always return dyn-refs, B/C
   to emit a short box when a concrete enabled tag fits. Callers and
   demos do not change. “Vary only the String module” alone is not enough
   once S2 teaches the host to emit shorts.
3. **Parity.** Each variant must match the L0 JavaScript / NaNVM view on
   the existing string parity tables (short and long), including traps on
   bad indices.
4. **Measure** (same harness as [benchmark.md](./benchmark.md)):
   - wall clock: **short-only microbench first**; `repeat` second;
   - L0 / Ref import counts on the short-only bench: `kind_ref`,
     `dup_ref`, `drop_ref`, string imports;
   - short-hit rate on the short-only bench (and early `repeat` steps if
     useful);
   - frame cost: locals per `str` for B (0) vs the **chosen** C layout;
   - optional: peak host string allocations; `repeat` wall clock as
     regression.
5. **Decision gate.** **Closed:** NaNVM-targeted builds default to
   variant B (`emitB` = `shortWhenEnabled` + v1 tags; linked
   `length`/`unit`). Counting host and explicit callers keep A
   (`emitA` / `alwaysDynRef`) as the control. C stays buildable behind
   the same interface; do not delete it until a later cleanup. See
   [benchmark.md §After short strings (S4)](./benchmark.md#after-short-strings-s4).

## Non-goals (first design / first coding stacks)

- **Containers / objects / arrays in the IR** — stay on NaNVM.
- **Heap in the IR** — later phase ([runtime-in-ir.md](./runtime-in-ir.md)).
- **Short bigints** — same box family (`x & 1 == 1`), sibling phase; they
  do **not** share the String module interface (they would get a BigInt
  module). Layout non-overlap with string tags must be preserved when
  both land.
- **Choosing and shipping a single packing implementation** in this
  design PR (S1+ after the owner decision on this note).
- **Rope for `concat`**, cancel-`dup`/`drop` lifetime pass, static `s` bit
  / data-segment literals — separate levers in benchmark.md / runtime-in-ir
  open questions.
- **Renaming `at` vs `unit`** as a blocker — pick in an open question;
  both spellings mean one op.

## Open questions (Sergey / Sasha)

1. **Default experiment order:** implement B (memory-saving) before C
   (CPU-saving), with A as baseline — or stand up the multi-local `str`
   layout (C's prerequisite) first?
2. **Candidate C layout:** C-flag vs C-sentinel (see §C)? Must not reuse
   length `0` as long. Also whether to patch the modular-runtime memo's
   “`0` = long” wording in the same coding stack.
3. **Where pack/decode helpers live:** private to String, or shared Any
   bit utilities? Modular L0 puts `box_inline` on Any.
4. **Which short encodings in v1?** All of Sergey's scalar string tags, or
   a subset (e.g. empty + `1×16`/`2×16` first) with the rest **forced
   long** (not refused — see clause 3)?
5. **`concat` of two shorts:** always try inline result, or always allocate
   long until a later slice? Affects the short-only microbench and early
   `repeat` steps.
6. **`string` as a copy variant of `any`:** once shorts exist, should a
   value narrowed to `string` be copy when short and counted when long, or
   stay counted until narrowed further? Hooks today treat non-refs as
   pass-through bits.
7. **`at` vs `unit` naming** in the IR `str` table.
8. **Dependency on 4e:** may String template work begin against #4113 alone
   (Any module present, not yet `linkAny`), or wait for #4114–#4116 on
   `main`?

## Suggested later PR slices (git-base only; not started here)

Stack with **git base** (child PR base = parent head). No GitHub
`stack_on`. Start only after this design is approved.

| Slice | Ships (illustrative) |
| --- | --- |
| **S0** | This note + `fjs/ir/todo/short-strings.md` (design only). |
| **S1** | String module skeleton in IR: interface + manifest hooks; short pack/unpack **helpers** unused by programs; proofs of bit round-trips; no link change. Prefer implementing behind the interface so a second variant can land as S1b without caller churn. **Shipped** in [`fjs/ir/runtime/string`](../../../fjs/ir/runtime/string/module.f.js) (manifests A/B/C; v1 enabled tags empty/`s1x16`/`s2x16`; C-flag provisional). |
| **S2** | Host / counting-host / NaNVM ABI: accept short-string boxes; emission of shorts where a **concrete enabled tag** fits is a **per-variant policy** (off for A, on for B/C). Long path unchanged when no tag fits. **Shipped**. |
| **S3** | Link / L1 string ops use the short path (template or linked IR); long miss still imports; parity proofs vs L0. **Shipped** (`linkString` + B IR). |
| **S4** | Remeasure (short microbench primary, `repeat` secondary); update `benchmark.md`; record which variant / C layout was measured. **Shipped** (variant B; C not measured). Decision gate: **B default** for NaNVM (`emitB`); A remains control (`emitA`). |
| **S5+** | Alternate variant (B↔C) behind the same interface; compare; optional `concat` inline policy from open Q4; widen v1 tags if useful. |

Short bigints and Heap stay **after** this experiment's measurement gate,
as in the post-4e task list.
