## Build the IR in vertical slices

**Priority:** P3
**Status:** wip

### Problem

The WASM backend, [step 4 of the WASM plan](../../../doc/sasha-gil/wasm/README.md#plan),
compiles FunctionalScript through the code IR: normalized FAST is lowered to
the IR, and the IR is emitted as WASM.
[definition.md](../../../doc/sasha-gil/ir/definition.md) proposes that IR,
and its prototype checks, emits and runs samples lowered by hand. Nothing of
it exists under `fjs/` yet: no IR data, no checker, no lowering and no
emitter.

The lowering is the least proven part. The prototype never lowers FAST
itself: definition.md's worked example is lowered by hand, from the FAST
that `definition.fast.mjs` prints.

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

### Tasks

- [x] **Typed code, written by hand.** Floats, `bool` and integer ranges in
  one word; `lit`, `get`, `let`, `op`, `call`, `variant` and `match` of a
  `bool`, `block` and `br`; the checker, the printer and the emitter. No
  FAST and no imports. The [README](../README.md) has what it admits.
- [x] **The first lowering.** The same part of the language from normalized
  FAST, with each function's parameter types given to the lowering, since
  FAST has none. Normalized FAST is assumed, as definition.md's open
  question 2 recommends, until the compiler owner's view settles it. The
  [README](../from_fast/README.md) has what it lowers.
- [x] **Values of unknown type, read only.** Borrowed `any` parameters, the
  interfaces of L0 as data, a JavaScript host for the `fjs:l0` imports,
  casts and conversions. Subject: L1's `toBoolean`, lowered from L1's own
  text. The [README](../README.md#what-the-third-slice-adds) has what it
  adds, and [`from_fast`](../from_fast/README.md#the-l0-view) how the
  lowering reads the L0 view.
- [x] **Loops.** Loop parameters, loop functions and an exact `f64`
  counter. Subjects: `stringEquals` and `stringLess`, lowered from L1's own
  text. A function inside a function is inlined at each call, where
  definition.md lifts it; the
  [README](../from_fast/README.md#loops-and-functions-inside-functions)
  says why, and [the IR's](../README.md#what-the-fourth-slice-adds) what the
  slice adds.
- [x] **Functions that are not exported, and native rows.** Parameter types
  taken from the call sites, which no note settles yet, and `%`, which
  [l1-design.md](../../../doc/sasha-gil/wasm/l1-design.md#the-operations)
  makes native but which has neither a native row nor an IR operator, while
  `numberIndex` uses `n % 1`. Subjects: `strictEquals`, `stringIndex` and
  `numberIndex`. A function that is not exported is inlined at each call,
  typed by what the call gives, as the owner chose; `%` is a new native row,
  `numberRemainder`; and `stringIndex` keeps its loop's state in a record,
  a product that stays in its function. The
  [README](../README.md#what-the-fifth-slice-adds) has what the slice adds,
  and [the lowering's](../from_fast/README.md#functions-that-the-module-does-not-export)
  how it reads such a function.
- [ ] **Counted values.** The lifetime pass, module constants through `init`,
  string literals, and a host that counts. Subject: `typeOf`.
- [ ] **Failure.** `throw`, L1's error table and the trap ABI of NaNVM's L0.
  Subjects: `functionText` and `bigintPair`.
- [ ] **Builders.** The linear kind, `buildArray` and `buildObject` with their
  callbacks inlined, and array and object literals. Subjects: `toIterable`
  and `objectSpread`.
- [ ] **Calling function values.** L0's `call` from WASM into the host and
  back. Subjects: `toPrimitive`, `toNumber`, `toNumeric`, `toString` and
  `call`.
- [ ] **The whole L1 module**, against the cases of its parity proof.
- [ ] **Programs.** Operators on unknown types as calls of L1, closures as
  values, and a program as one module linked with L1.
- [ ] **NaNVM's `.wasm`** in place of the JavaScript host.

### Related

- [definition.md](../../../doc/sasha-gil/ir/definition.md) — the IR these
  slices build, its lowering table and its open questions
- [type-system.md](../../../doc/sasha-gil/ir/type-system.md) — the types and
  the rules that the core takes from it
- [l1-design.md](../../../doc/sasha-gil/wasm/l1-design.md) — the closure rule
  and the typed lowering that the L1 slices follow
- [`fjs/wasm/runtime`](../../wasm/runtime/README.md) — the L0 view and the L1
  bodies that are the slices' subjects
