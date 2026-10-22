## One member function per name, and `dot`, the dispatcher, in FunctionalScript

**Priority:** P3
**Status:** wip — the member shape, the inventory, `dot` and its
compilation have landed, **sergey-shandar**'s decisions below taken; the
chain in the runtime and the natives remain

### Problem

A member call on a built-in, `a.map(b)`, is dispatched at run time by name
and by the receiver's type. The compiled form reads the property with a
string key and calls what it finds; the call step tries the receiver's own
property, then the native table in `vm/lambda`, scanned by comparing the
key against every name, then the runtime's `members` table by type and
key, then throws. The name was a literal in the source, and the list of
names a module may call on a built-in, `allowedCalls` in
[`../prototype`](../prototype/module.f.js), is known at compile time. The
same dispatch is written twice more, in the represented interpreter's
`value/method` and in the `member` table of
[`../runtime`](../runtime/module.f.js), keyed by receiver type.

### Proposal

The runtime module defines one function per member name, taking any
receiver, and the function dispatches on its receiver itself; the table is
the module's `member` export, which `dot` reads, and the runtime value is
its two functions, `static` and `dot`:

```js
export const member = {
    map: self => self instanceof Array
        ? f => /* the array's map */
        : undefined,
}

export const runtime = { static: id => entry(statics, id), dot }
```

- The `member` table is keyed by name alone, and a body is a function
  of the receiver alone: `undefined` for a receiver the name is no member
  of, else the function of the arguments as the call passed them, a
  closure over the receiver. An executor asks the body in two steps — the
  first before any argument exists, which is what the guard of
  `a.map?.(b)` needs, the second with the arguments, whose failure is a
  throw — and the body is pure, so a guard and a call ask the first step
  twice at no cost but the call.
- The executor keeps the own-property path and the `TypeError` for
  calling `undefined` around the body, once for every name: the receiver's
  own property shadows a built-in, and a body answering `undefined` is the
  `TypeError`, or a skip under `?.()`. The body never falls back itself,
  so no prototype name is destructured anywhere.
- The native implementations become branches of the bodies, so the native
  table and the interpreter's dispatcher go: one rule, in one place, for
  both executors.
- The resolution a call step makes — the own property, else the body's
  answer, else `undefined` — is written once, in the language, as the
  runtime's `dot`, and every executor asks it:

  ```js
  export const dot = (self, key) => {
      if (hasEntry(self, key)) { return entry(self, key) }
      const body = entry(member, key)
      return body === undefined ? undefined : body(self)
  }
  ```

  `entry` is the language's own-property read, the value or `undefined`,
  and `hasEntry` the presence beside it
  ([`../../types/object/entry`](../../types/object/entry/module.f.js),
  [why two helpers](../../../spec/property-access/entries/README.md#why-two-helpers)), so an own property
  wins whatever it holds, as it does in JavaScript —
  `{ toString: f }` calls `f`, `{ x: undefined }.x()` throws, `[1][0]()`
  throws for the element — and a receiver that owns nothing enumerable
  under the key, every array, string, number, boolean, bigint and
  function under an admitted name, costs one failed read before the
  table. `entry(member, key)` reads the table as an object literal, so no
  inherited name answers. A `length`, which an array, a string and a
  function own without enumerating it, is no entry and no member name:
  a call step asks `dot` for an admitted member name alone, and reads
  `length` as the executor's own property read does, `a.length`, so
  `a.length?.()` throws as in JavaScript, a number being no function, and
  `dot` is never asked for it. The receiver is never nullish: the executor
  throws for one before any argument, as `Member::new` and the
  interpreter's property step do. A compiled `a.map(b)` stays
  `Any::dot(a, "map").end_call(...)`: one dispatcher serves a literal key
  and a computed one, `a[Number(b)]()`, alike, and a direct call by name
  would be a second resolution to keep in step with the first.

### Decisions

**sergey-shandar**, in the session:

- A body is `(self) => undefined | ((...args) => value)`, the inner
  function throwing on error as a body throws today, rather than a single
  body of the receiver and the arguments answering a tagged result or
  `undefined`: the guard of an optional call must decide before the
  arguments exist, and the staged body gives it the step it needs.
- On NaNVM the body makes a `Function` with the receiver in its frame, so
  a member is bound on `IStaticFunction`, which is now the capability of
  every VM, `IVm::static_function`, rather than the printer inlining the
  shape without a closure; a measurement may move it later.
- The body's shape is the receiver itself, `self => …`, a closure of one
  argument in the runtime value ([`../runtime/README.md`](../runtime/README.md)),
  rather than the statics' `(...args)` with the receiver as its one
  element: a member is a function of exactly its receiver, and the call
  step passes it with nothing built around it.
- The inventory comes first, as one table by type: `fjs/js/members`
  holds every built-in type, then every name its prototype has and
  `allowedCalls` admits, then the function of the receiver and the
  arguments, `(self, ...args)`, the receiver typed as the type it is
  under, which a body over `unknown` cannot be; `todo` stands where no
  body is written. `types.ts` pins each type's keys to exactly the
  admitted names. A per-name body is built from them: `map` is
  `self => self instanceof Array ? (...args) => members.array.map(self, ...args) : undefined`,
  the type dispatch inside the body, the typed implementation beside it.
- The compiled output keeps `Any::dot(a, "map")`: no direct call by name,
  since the alternatives are more complicated. The implementation behind
  `dot` reuses the generated member functions, and an own property is
  looked for through `hasEntry` and `entry`, which find nothing for every
  receiver but an object's field or an element, so only an object literal
  can shadow a built-in. Which entries stay native is decided as the table fills; a
  native needs both NaNVM's Rust and the interpreter's case until its
  body lands.
- `dot` is written in FunctionalScript, as the proposal shows, over the
  pair `hasEntry` and `entry`, the presence and the value
  ([why two helpers](../../../spec/property-access/entries/README.md#why-two-helpers)).
  Every executor asks it first and its natives after, NaNVM through the
  runtime value every compiled module takes as its parameter
  ([`../runtime/README.md`](../runtime/README.md), "How NaNVM finds it"),
  so a body answers its name on every executor at once. With bodies written over the
  intrinsics for the names the native table answers, `Member::call`
  becomes the nullish throw, the index keys an array, a string or a
  function owns, and `dot`; the two-step guard and the interpreter's
  `hasMethod` go with it, since `dot` answers the guard's question too.
- The whole chain moves into the runtime after `dot`, under
  [DESIGN.md §13](../../../doc/DESIGN.md#13-one-source-of-truth-optimize-by-substitution):
  the three continuations of the README's chains section, in
  FunctionalScript, as the source of truth —

  ```ts
  type PropertyLambda = { end, call, optionCall }        // after `.`
  type OptionLambda = { end, call, dot }                 // after `?.()`, or a step inside a region
  type OptionPropertyLambda = { end, optionCall, endCall } // after `?.` or `|.`
  export const dot: (self, index) => PropertyLambda
  export const optionDot: (self, index: Lazy<Index>) => OptionPropertyLambda
  export const optionCall: (self, args: Lazy<Args>) => OptionLambda
  ```

  — the index and the arguments lazy where a guard decides before them,
  a skipped region a closure answering `undefined` to `end` and passing
  through every step, and a throw propagating on its own, so the Rust
  `Region::Thrown` has no counterpart. The reasons are portability — a
  backend for another language provides the primitive surface and
  generates the rest — and a reference every optimization is diffed
  against. On NaNVM the naive emission allocates an object and its
  closures per step; `vm/lambda`'s stack-allocated types are the
  substitution for the chain nodes, which the EDAG already spells as
  `.`, `?.`, `|()`, `|?.()` and `|!()`, one printer case per node, and
  the harness runs the fixtures both ways. The interpreter runs the
  source directly, which deletes its chain handling in `operations` and
  its dispatcher in `value/method`. The core — `dot`, `optionDot`,
  `optionCall` and the resolution — uses the primitive surface and plain
  calls of function values alone, no member call and no `?.`, and the
  printer refuses a chain node inside it: `dot` asks `hasEntry` and reads
  `entry`, two helpers the backend answers, and calls the body as a value,
  `body(self)`, never as `a[k](...)`, which is a member call. A property
  read, `a[k]`, is primitive — the backend's own-property read, the `end`
  of a property step, which the two helpers are built over — so the core
  may read one freely: a read defined in the source would read its own
  definition.

### Tasks

- [x] The member shape: `member` keyed by name, bodies of the receiver,
      `startsWith` the first; the two-step call and guard in `Member` and
      in the interpreter's dispatcher; `static_function` on `IVm`. NaNVM
      first lifted the module into static functions found by name; the
      runtime value (`../runtime/README.md`, "How NaNVM finds it")
      replaced that.
- [x] The inventory: `fjs/js/members`, every type's admitted names,
      `todo` where no body is written, its keys pinned.
- [x] `dot` in the runtime, as the proposal shows, with its proof on the
      host; the interpreter asking it before its natives, `member` in
      `value/method` going (`left`, the names the natives lack, stays as
      what the guard asks without running a native); the printer accepting
      the `dot` section and leaving it out, named, until it compiles it.
- [x] `dot` compiled: printed as any function of a module the backend
      evaluates, in the runtime value every compiled module takes;
      `Member::call` asks it before the native table, as the interpreter
      does. The native scan and the two-step guard go with the last body
      (below).
- [ ] The chain in the runtime: `dot` answering a `PropertyLambda`,
      `optionDot` and `optionCall`, with their proof on the host and the
      corpus's chain cases as the oracle; the interpreter running them,
      its chain handling and dispatcher going; the primitive surface a
      backend provides listed in the runtime's README; the Rust printer
      emitting the naive form under a flag and the harness diffing it
      against `vm/lambda`'s.
- [ ] The natives, one body at a time: each a typed implementation in
      `fjs/js/members` and a branch of its per-name body, the native
      table and the interpreter's dispatcher shrinking as they move — an
      entry beside a body is unreachable, since every executor asks `dot`
      first — with the corpus in `nanvm/member` as the oracle; the
      primitives no body can define stay native as intrinsics, listed in
      `fjs/edag`, as the statics' are in `fjs/js/static`. `startsWith`
      and `codePointAt` are written; the string names over `slice` and
      `charCodeAt` alone — `at`, `charAt`, `endsWith`, `includes`,
      `indexOf`, `lastIndexOf`, `substring`, `isWellFormed` — are the
      next batch.

### Related

- [`runtime.md`](./runtime.md) — the bodies written once, which this
  extends to the dispatch.
- [`../runtime/README.md`](../runtime/README.md) — "How NaNVM finds
  it": the runtime as a value the module receives, with `dot` compiled as
  an ordinary function, and the intrinsics a body reaches a native through.
- [`runtime-static.md`](./runtime-static.md) — the static runtime the
  bodies compile into.
- [`../../edag/todo/direct-calls.md`](../../edag/todo/direct-calls.md)
  — the sibling case, a known callee inside the runtime called directly.
- [`../prototype/README.md`](../prototype/README.md) — the read and call
  rules by name alone.
