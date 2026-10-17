## One member function per name, dispatching on its receiver itself

**Priority:** P3
**Status:** wip — the member shape has landed, **sergey-shandar**'s
decisions below taken; the direct call and the natives remain

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
`value/method` and in the `member` section of
[`../runtime`](../runtime/module.f.js), keyed by receiver type.

### Proposal

The runtime defines one function per member name, taking any receiver, and
the function dispatches on its receiver itself:

```js
export const runtime = {
    member: {
        map: self => self instanceof Array
            ? f => /* the array's map */
            : undefined,
    },
}
```

- The `member` section is keyed by name alone, and a body is a function
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
  table, the interpreter's dispatcher and `runtime_method`'s search by type
  go: one rule, in one place, for both executors.
- A compiled `a.map(b)` calls the body directly, `map(a)` and then the
  function it answers on NaNVM, the runtime's body in the interpreter,
  skipping the key string and the scans. A call of a name not in
  `allowedCalls` stays as it is: a property read, then a call of what it
  holds.

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
- The body's Rust signature is the receiver itself,
  `fn starts_with<A: IStaticFunction>(self_: Any<A>)`, a `MemberCode<A>`,
  rather than the statics' `args: Array<A>` with the receiver as its one
  element: a member is a function of exactly its receiver, and the call
  step passes it with nothing built around it.

### Tasks

- [x] The member shape: `member` keyed by name, bodies of the receiver,
      `startsWith` the first; the static-runtime printer printing a member
      bound on `IStaticFunction`; `runtime_method` by name, the two-step
      call and guard in `Member` and in the interpreter's dispatcher;
      `static_function` on `IVm`.
- [ ] The direct call: the Rust backend and the interpreter calling a
      body by its name where a call's name is in `allowedCalls`, with no
      key string and no scan, the own property checked first as the
      executors check it today.
- [ ] The natives, one body at a time: each native implementation a
      branch of its body, the native table and the interpreter's
      dispatcher shrinking as they move, with the corpus in
      `nanvm/member` as the oracle; the primitives no body can define
      stay native and listed, as the statics' are.

### Related

- [`runtime.md`](./runtime.md) — the bodies written once, which this
  extends to the dispatch.
- [`runtime-static.md`](./runtime-static.md) — the static runtime the
  bodies compile into.
- [`../../../nanvm/lib/todo/static-runtime-calls.md`](../../../nanvm/lib/todo/static-runtime-calls.md)
  — the sibling case, a known callee inside the runtime called directly.
- [`../prototype/README.md`](../prototype/README.md) — the read and call
  rules by name alone.
