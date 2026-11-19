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
(about 2.4 million lowered-WASM calls, zero wrong answers, measured on
[`177c39cb3`](https://github.com/functionalscript/functionalscript/commit/177c39cb3ae3ee10fbc4586a897c75a50d5a19ba)
before [#3837](https://github.com/functionalscript/functionalscript/pull/3837)
and on that merge for the post-fix run; three refusal defects fixed in
#3837).

| Choice | Decision |
| --- | --- |
| How `typeOf` gets its array | Bring array literals of values and the linear builder into slice 6, so `typeOf` lowers from L1's own text |
| How slice 6 is cut | Six stacked PRs, 6a to 6f, one feature each |
| Memory and where literals are built | As [L0 §5](../../../doc/sasha-gil/wasm/l0-design.md#5-memory-and-table-made-by-the-loader-imported-by-both-modules) and [§6](../../../doc/sasha-gil/wasm/l0-design.md#6-literals-built-once-at-start-up): the loader makes the memory and the module imports it. **Two build sites, one borrowing rule.** The start function builds every string and bigint literal (L0 §6: building one cannot throw, and the host cannot catch a trap in `start`). Derived `init` evaluates every other module constant, including container constants such as `typeNames` ([L0 §20](../../../doc/sasha-gil/wasm/l0-design.md#20-a-program-is-one-module-with-an-init-export)). A use of either is still a borrow that is never dropped, as [definition.md](../../../doc/sasha-gil/ir/definition.md#constants) says. That is a deliberate divergence from definition.md's line that derived `init` evaluates *every* constant — literals are constants for naming and borrowing, but they are not built in `init`. It also diverges from L0 §6 putting constant containers in `start` |
| Linear and copy variants of `any` | Linear now, since 6e needs it; copy variants of `any` after slice 6, so every `any` is counted through 6f |
| The random comparison | Keep it as a seeded host proof, in a PR of its own before 6a, and extend it with each later slice |

### Decisions for slice 7 (2026-11-15)

Owner decided seven choices on the shape of slice 7, failure.

| Choice | Decision |
| --- | --- |
| Where L1's errors come from | Read from L1's text: the error table that L1 imports is a module of string constants, and `error.k` lowers to the string literal |
| What a throw is in the IR | `never` is the empty sum, and a throw is a call of L0's `Functions.throw(own v: any) -> never`, which may fail |
| When the effect bit lands | Now: each interface function declares whether it may fail, as [definition.md](../../../doc/sasha-gil/ir/definition.md#one-effect) marks it, and the checker infers the bit for each function of a module, to a fixed point. Being explicit on what throws, early |
| What a throw leaves | The lifetime pass drops what a function owns before a call that answers `never`, but what the call borrows. A callee's throw, and a trap, still abandon what the callers hold, which the host's `recover` frees |
| The host's side | As [L0 §13](../../../doc/sasha-gil/wasm/l0-design.md#13-errors-a-throw-traps): `throw` keeps the value and returns, the `unreachable` after its call traps, and the host reads the value by `has_thrown` and `thrown`, then calls `recover` |
| The oracle | Three outcomes: the same value, a throw of the same value, or a trap of both, where a twin's trap is a misuse of the L0 view or a `trap` of the twin. A function that cannot fail never fails, and the cells are checked after every outcome |
| How slice 7 is cut | Two PRs: 7a, throwing by hand; 7b, the lowering of `throw` and of L1's error table, with the subjects `functionText` and `bigintPair` |

### Decisions for slice 8 (2026-11-15)

Owner decided six choices on the shape of slice 8, builders, from a
choices doc.

| Choice | Decision |
| --- | --- |
| What slice 8 covers | The builders and `{}` only. An object literal with keys stays a record. Object literals as values, and spread in array and object literals, move to slice 11, since no L1 body uses them |
| How a builder call lowers | As [L0 §22](../../../doc/sasha-gil/wasm/l0-design.md#22-building-in-one-pass): `begin_array(n)` or `begin_object(n)`, one IR `loop` over the index, the state and the builder, and `seal`. No new IR term |
| Which callbacks | Arrow literals written in the call, inlined where the loop calls them. Anything else is refused until slice 9 |
| The order of the callbacks' calls | The L0 view calls them in the order of one loop: an item before the next state, and a key, its check, then its value. The view changes to match, in 8a |
| `numberToString` | A new native row, `numberToString(x: f64) -> string`, as slice 5's rows are |
| How slice 8 is cut | Three PRs: 8a, the view's order; 8b, `buildArray` with `toIterable`; 8c, `buildObject` and `{}` with `objectSpread` |

**Where 8c differs from the first choice (open for the owner).** 8c
([#3898](https://github.com/functionalscript/functionalscript/pull/3898))
also lowers an object literal of names and values when every value is of
`any` and the module imports Containers, as one lowered over a runtime
does: `{ a, b }` is `Containers.seal` of a `push_property` of each onto
`begin_object`, cast to `object`. An object literal with a value of
another type, a float among them, stays a record. So an object literal as
a value of `any` is in slice 8, not slice 11, which the first row above
says. Spread in a literal still waits for slice 11. Keeping this, or
refusing such a literal again until slice 11, is the owner's to confirm.

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

#### Counted values (`typeOf`)

Slice 6 cannot reach `typeOf` as first listed: L1's `typeNames` is an array
literal of strings, and array reads need a bounds path to `undefined`. The
stack below brings that machinery forward. Each PR is stacked on the one
before it and proved end to end on its own.

- [x] **Seeded random comparison** (before 6a, #3853). A host proof of a
  few hundred programs a run under
  [`from_fast/random`](../from_fast/random/README.md); extend it as later
  slices land. It found the three defects that example proofs at 100%
  coverage missed. Since 7a it judges each call by the three outcomes. Its last form is
  8b's `buildArray`: 8c to 10b added none.
- [x] **6a. Owned values, by hand** (#3856). The counted kind, `dup`/`drop`;
  borrow and own parameters and owned results (`concat`, `from_unit`);
  static check of the owned stage, which also holds a linear type's owned
  values to one consumer; a host that counts every value, under every host
  proof of the emitter. Copy variants of `any` wait for the item after
  slice 10 below.
- [x] **6b. The lifetime pass**, as two stacked PRs:
  - [x] the pass: plain stage to owned (move, `dup`, `drop`), from the
    checker's plain stage, `checkPlain` (#3864);
  - [x] lowering of L0 view functions that answer owned values (`concat`,
    `fromUnit`, `substring`, `item`), with helpers against JavaScript and
    the random comparison through the pass (#3865).
- [x] **6c. Constants and `init`** (#3866). Any's `undefined`, `null`, `true` and
  `false` as imported globals; module constants other than string and bigint
  literals (those are 6d); derived `init`; lowering of a module-level
  definition.
- [x] **6d. String literals** (#3870). A string literal is a literal of the sealed
  type whose interface names its maker, `make_string` for `any`, borrowed
  and never dropped as a constant is; built once for its type and its
  spelling in the module's start function, from UTF-16 units in a data
  segment at `data_base` of the memory that the loader makes (the
  start/`init` split as in the decisions above); lowering of a string of
  FAST.
- [x] **6e. Array literals of values** (#3887). The linear kind, Containers'
  `builder`, which names no `dup`, `drop` or `kind`; a function that gives
  back a parameter, `push`, whose import answers nothing; `begin_array`,
  `push`, `seal`; array literals of values of `any` with no spread (the
  parser refuses holes), their items done before the builder begins.
  Numbers and booleans as items wait for Any's `from_f64` and `from_bool`,
  in slice 9.
  (`buildArray` and `buildObject` with callbacks are the builders slice
  below; spread moved to slice 11, and 8c lowers object literals of values
  of `any`.)
- [x] **6f. Reading an array, and `typeOf`** (#3890). `a[k]` of an array at
  a number key by L1's `get` rules for that case; `typeOf` lowered from
  L1's text. A receiver of another kind waits for L1's `get` itself, in
  slice 10: `undefined` and `null` throw, and an object or a string reads
  by a string.

#### Failure

Slice 7, cut in two as decided above.

- [x] **7a. Throwing, by hand** (#3896). L0's `Functions.throw(own v: any) ->
  never`, which may fail; the effect bit, which interfaces declare and the
  checker infers; drops before a throw; the host's `throw`, `has_thrown`,
  `thrown` and `recover`; the three-outcome oracle under every host proof
  and the random comparison.
- [x] **7b. Throwing, lowered** (#3897). `throw x` of FAST and L1's error table as
  string constants, read from L1's text. Subjects: `functionText` and
  `bigintPair`. A lowering's runtime may name L1's error module and its
  table, which `errorTable` reads from that module's normalized FAST;
  `error.k` is a literal of its text, and `throw x` is `Functions.throw`.
  `functionText` runs as WASM against L1's own; `bigintPair` runs as a
  copy, since L1 calls it only from arithmetic, which a later slice
  lowers. The random comparison gains a form that throws.

#### Builders

Slice 8, cut in three as decided above.

- [x] **8a. The order of the builders' calls** (#3903). The L0 view calls `at` of a
  state before `next` of it, and `keyAt`, the key's check, then `valueAt`,
  as one loop does; a host proof shows the order by what a failing
  callback throws.
- [x] **8b. `buildArray`, lowered** (#3908). Arrow-literal callbacks inlined into
  one loop over `begin_array`, `push` and `seal`; the `asArray` cast.
  Subject: `toIterable`. A throw inside a callback is refused, since it
  would leave the linear builder behind; a call there that fails abandons
  the builder, as a trap does. The random comparison gains a form of it.
- [x] **8c. `buildObject` and `{}`, lowered** (#3898). Containers' `begin_object`
  and `push_property`, in the IR and the counting host; the `asObject`
  cast; the `numberToString` row. Subject: `objectSpread`. A `{ ...v }`
  literal waits for a later cut; `objectSpread` is what it copies.

#### Function values

Slice 9, cut in two: boxing first, then `call`. Slice 9b is three stacked
PRs as decided below.

- [x] **9a. Any's `from_f64` and `from_bool`** (#3918). Written where a
  number or a boolean meets `any`, as
  [definition.md's rule 6](../../../doc/sasha-gil/ir/definition.md#from-normalized-fast-to-the-ir)
  has it; with them, numbers and booleans as items of an array literal.
  Float records stay products.
- [x] **9b1. `code` and `call_ref`** (#3922). The `code` type, the
  `code(f)` and `call_ref(c, …)` terms, the checker, the printer and the
  emitter (`ref.func` / `call_indirect` over a module table). Hand-written
  only.
- [x] **9b2. L0 `Functions.call` / `make_function`** (#3928 / #3932). The interface rows and
  the counting host: call existing function values (`any.only(function)`).
  `make_function` of an IR `code` waits for slice 11; until then the
  counting host traps on it.
- [x] **9b3. Lowering and subjects** (#3929). `asFunction(f)(…)` as L0
  `call(f, args)`; `find`, `text`, `join` as needed; subjects `toPrimitive`,
  `toNumber`, `toNumeric`, `toString` and `call`.

### Decisions for slice 9 (2026-11-15)

Owner chose option A on each of four choices.

| Choice | Decision |
| --- | --- |
| How 9b is cut | Three stacked PRs: 9b1 `code` / `call_ref`; 9b2 L0 `call` / `make_function` + host; 9b3 lowering + subjects |
| What 9b makes as a function value | Call existing function values only; `make_function` of an IR `code` waits for slice 11 |
| How `asFunction(f)(…xs)` lowers | Always L0 `call(f, args)` with an args array ([L0 §12](../../../doc/sasha-gil/wasm/l0-design.md#12-functions-a-code-index-a-frame-a-length-and-a-text)) |
| Rows the subjects need beside `call` | Bring `find`, `text`, `join` (and whatever the subjects still miss) into 9b3 with them |

#### Next — the whole L1 module

Slice 10, cut in three as decided below. Claim: [#3934](https://github.com/functionalscript/functionalscript/pull/3934).

- [x] **10a. `get`** (#3935). L1's `get` lowered from its text over the
  runtime and its error table, run against L1's own: its throw for
  `undefined` and `null`, and its reads of an object or a string by a
  string, which 6f left out. A member or index of sealed `any` is a call
  of the module's `get` where the table names it; 6f's array-at-number
  path stays.
- [x] **10b. Arithmetic and relational subjects** (#3936). L1's `add` /
  `subtract` / `multiply` / `divide` / `negate` and the relational bodies,
  lowered and run against L1's own; native bigint arithmetic and
  `bigintLess`, with `bigintDivide` of `0n` a row that may fail.
- [ ] **10c. Remaining L1 exports and parity.** Every remaining export of
  [`l1/module.f.js`](../../wasm/runtime/l1/module.f.js) that is not already
  a subject, which is `toPropertyKey` alone, and the host twin runs extended so each
  runs against L1's own. Builtins wait.

### Decisions for slice 10 (2026-11-16)

Owner chose option A on each of four choices.

| Choice | Decision |
| --- | --- |
| How 10 is cut | Three stacked PRs: 10a `get` + keyed object/string reads; 10b arithmetic and relational subjects; 10c remaining exports + parity |
| How `a[k]` / `.` of `any` lowers | Always L1 `get`, keeping 6f's array-at-number specialization |
| What "the whole L1 module" covers | Every export of [`l1/module.f.js`](../../wasm/runtime/l1/module.f.js) that is not already a subject; builtins wait |
| Parity | Extend the existing host twin runs so every remaining export runs against L1's own |

#### Later

- [ ] **Copy variants of `any`** (after 10). Any marks `undefined`, `null`
  and `boolean` as needing no release, as
  [definition.md's open question 6](../../../doc/sasha-gil/ir/definition.md#open-questions)
  recommends, so the lifetime pass writes no `dup` or `drop` of a value
  that holds only those kinds, such as Any's constants. It changes no
  answer, only counts, so it waits until the whole L1 module shows what it
  saves.
- [ ] **Programs** (11). Operators and member reads on unknown types as
  calls of L1, `get` among them, closures as values, and a program as one
  module linked with L1. Spread in array and object literals, moved here
  from slice 8. Object literals as values of `any` were lowered in 8c,
  which the owner is to confirm (see the decisions for slice 8).
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
