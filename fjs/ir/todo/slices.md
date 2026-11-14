## Build the IR in vertical slices

**Priority:** P3
**Status:** wip

### Problem

The WASM backend, [step 4 of the WASM plan](../../../doc/sasha-gil/wasm/README.md#plan),
compiles FunctionalScript through the code IR: normalized FAST is lowered to
the IR, and the IR is emitted as WASM.
[definition.md](../../../doc/sasha-gil/ir/definition.md) proposes that IR,
and its prototype checks, emits and runs samples lowered by hand. The IR under
`fjs/` is built one small part of the language at a time.

### Proposal

Build the three parts together, one small part of the language at a time.
Each slice is one pull request that goes through every part it needs, proves
the emitted WASM against the FunctionalScript original on the same inputs,
and refuses everything outside the slice, so that the next slice only adds.

- **Where.** `fjs/ir` holds the IR's data, its checker and its printer.
  `fjs/ir/wasm` holds the emitter, which writes the AST of
  [`fjs/media/wasm`](../../media/wasm/README.md), so that module's writer
  makes the bytes. `fjs/ir/from_fast` holds the lowering from normalized
  FAST, as [`fjs/edag/from_fast`](../../edag/from_fast/README.md) holds the
  one to EDAG, and `fjs/ir/l0` the interfaces of L0 and a JavaScript host
  for them.
- **What the IR is.** definition.md, with ir-design.md as its history and
  type-system.md as the reference for what the core leaves out, as
  definition.md's open question 1 recommends. `br` is the only transfer, as
  its open question 4 recommends.
- **The order.** From the least risky slice to the most: typed code first,
  then values of unknown type, then each kind of machinery once (counts,
  failure, linear builders, function values), and the whole L1 module,
  programs and NaNVM last.
- **Beside the slices.** The RTTI schema of the IR's data
  ([ir-design.md, choice 12](../../../doc/sasha-gil/ir/ir-design.md#12-the-normalized-form-is-an-rtti-schema))
  can join at any point. Its known risk is TS2589 on a recursive type, which
  [`fjs/rtti/ts`](../../rtti/ts/README.md) shows how to avoid. The half of
  the IR that is a language for the runtime (layouts, heap objects, runtime
  modules written in the IR) meets these slices only at interfaces.

### Decisions for slice 6 (2026-11-14)

Owner chose option A on each of five choices after review of slices 2–5
(about 2.4 million lowered-WASM calls, zero wrong answers; three refusal
defects fixed in [#3837](https://github.com/functionalscript/functionalscript/pull/3837)).

| Choice | Decision |
| --- | --- |
| How `typeOf` gets its array | Bring array literals of values and the linear builder into slice 6, so `typeOf` lowers from L1's own text |
| How slice 6 is cut | Six stacked PRs, 6a to 6f, one feature each |
| Memory and where literals are built | As [L0 §5](../../../doc/sasha-gil/wasm/l0-design.md#5-memory-and-table-made-by-the-loader-imported-by-both-modules) and [§6](../../../doc/sasha-gil/wasm/l0-design.md#6-literals-built-once-at-start-up): the loader makes the memory and the module imports it. **Two build sites, one borrowing rule.** The start function builds every string and bigint literal (L0 §6: building one cannot throw, and the host cannot catch a trap in `start`). Derived `init` evaluates every other module constant, including container constants such as `typeNames` ([L0 §20](../../../doc/sasha-gil/wasm/l0-design.md#20-a-program-is-one-module-with-an-init-export)). A use of either is still a borrow that is never dropped, as [definition.md](../../../doc/sasha-gil/ir/definition.md#constants) says. That is a deliberate divergence from definition.md's line that derived `init` evaluates *every* constant — literals are constants for naming and borrowing, but they are not built in `init`. It also diverges from L0 §6 putting constant containers in `start` |
| Linear and copy variants of `any` | Linear now, since 6e needs it; copy variants of `any` after slice 6, so every `any` is counted through 6f |
| The random comparison | Keep it as a seeded host proof, in a PR of its own before 6a, and extend it with each later slice |

### Roadmap

Tick a box when its pull request merges. Slice numbers in parentheses are the
original twelve; 6a–6f are that sixth slice cut as decided above.

#### Done

- [x] **Typed code, written by hand** (1) —
  [#3806](https://github.com/functionalscript/functionalscript/pull/3806).
  Floats, `bool` and integer ranges; checker, printer, emitter. No FAST.
- [x] **The first lowering** (2) —
  [#3807](https://github.com/functionalscript/functionalscript/pull/3807).
  The same part from normalized FAST, signatures supplied beside FAST.
- [x] **Values of unknown type, read only** (3) —
  [#3808](https://github.com/functionalscript/functionalscript/pull/3808).
  Borrowed `any`, L0 interfaces, host, casts. Subject: `toBoolean`.
- [x] **Loops** (4) —
  [#3813](https://github.com/functionalscript/functionalscript/pull/3813).
  Loop parameters and an exact `f64` counter. Subjects: `stringEquals`,
  `stringLess`.
- [x] **Functions that are not exported, and native rows** (5) —
  [#3824](https://github.com/functionalscript/functionalscript/pull/3824).
  Inlining of unexported functions, records, `%` as `numberRemainder`.
  Subjects: `strictEquals`, `stringIndex`, `numberIndex`.
- [x] **Three refusal defects from the random comparison** —
  [#3837](https://github.com/functionalscript/functionalscript/pull/3837).
  Argument evaluation order under inlining; reading a definition past
  normalization's blocks; cast refusals that name the value's kinds.

#### Next — counted values (`typeOf`)

Slice 6 cannot reach `typeOf` as first listed: L1's `typeNames` is an array
literal of strings, and array reads need a bounds path to `undefined`. The
stack below brings that machinery forward. Each PR is stacked on the one
before it and proved end to end on its own.

- [ ] **Seeded random comparison** (before 6a). A host proof of a few hundred
  programs a run, covering what the slices lower; extend it as later slices
  land. It found the three defects that example proofs at 100% coverage
  missed. Tighten the trap oracle before slice 7 makes throws meaningful.
- [ ] **6a. Owned values, by hand.** Copy and counted kinds; `dup`/`drop`;
  borrow and own parameters and owned results (`concat`, `from_unit`);
  static check of the owned stage; a host that counts every value.
- [ ] **6b. The lifetime pass.** Plain stage to owned (move, `dup`, `drop`);
  lowering of L0 view functions that answer owned values.
- [ ] **6c. Constants and `init`.** Any's `undefined`, `null`, `true` and
  `false` as imported globals; module constants other than string and bigint
  literals (those are 6d); derived `init`; lowering of a module-level
  definition.
- [ ] **6d. String literals.** A literal as a constant named by its spelling,
  built once in the module's start function by `make_string` from UTF-16
  units in a data segment (memory and the start/`init` split as in the
  decisions above).
- [ ] **6e. Array literals of values.** The linear kind; `begin_array`,
  `push`, `seal`; array literals with no spread and no holes. (Object
  literals, spread and `buildArray` / `buildObject` with callbacks stay in
  the builders slice below.)
- [ ] **6f. Reading an array, and `typeOf`.** `a[k]` of an array at a number
  key by L1's `get` rules for that case; `typeOf` lowered from L1's text.

#### Later

- [ ] **Failure** (7). `throw`, L1's error table and the trap ABI of NaNVM's
  L0. Subjects: `functionText` and `bigintPair`.
- [ ] **Builders** (8). What is left after 6e: `buildArray` and `buildObject`
  with their callbacks inlined, object literals and spread. Subjects:
  `toIterable` and `objectSpread`.
- [ ] **Calling function values** (9). L0's `call` from WASM into the host
  and back. Subjects: `toPrimitive`, `toNumber`, `toNumeric`, `toString` and
  `call`.
- [ ] **The whole L1 module** (10), against the cases of its parity proof.
- [ ] **Programs** (11). Operators on unknown types as calls of L1, closures
  as values, and a program as one module linked with L1.
- [ ] **NaNVM's `.wasm`** (12) in place of the JavaScript host.

### Related

- [definition.md](../../../doc/sasha-gil/ir/definition.md) — the IR these
  slices build, its lowering table and its open questions
- [type-system.md](../../../doc/sasha-gil/ir/type-system.md) — the types and
  the rules that the core takes from it
- [l1-design.md](../../../doc/sasha-gil/wasm/l1-design.md) — the closure rule
  and the typed lowering that the L1 slices follow
- [`fjs/wasm/runtime`](../../wasm/runtime/README.md) — the L0 view and the L1
  bodies that are the slices' subjects
- [`fjs/ir/README.md`](../README.md) — what each merged slice admits
