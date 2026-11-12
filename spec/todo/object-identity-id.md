## Add an object identity `id` pattern

**Priority:** P3
**Status:** open — proposal; admission and semantics need a design decision

### Problem

FJS can compare object and function references for equality, but cannot derive
an identity hash or ordering from that comparison. A library cannot generally
index arbitrary references efficiently using equality alone. `Map` and `Set`
are not language types; adding them would require new VM representations and
interface support.

Provide a string identity that existing persistent string-keyed collections
can use, without first adding a collection type to the language.

### Proposal

Recognize an `id` helper as a complete function pattern, like
[`entry`](../property-access/entries/README.md). Its proposed type-level API is
`(o: unknown) => string`; executable FJS source remains JavaScript, with types
in JSDoc or companion declarations. Behavior for primitive inputs is still
undecided.

The JavaScript implementation shares a registry through a namespaced string
key on `globalThis`. A `WeakMap` associates references with strings; a
monotonically increasing `bigint` counter allocates new IDs. No symbol key is
needed. The following is a **proposal sketch for object and function inputs**,
not currently accepted FJS or a settled recognition grammar:

```js
const id = o => {
    const registry = globalThis['functionalscript.object-id.v1'] ??= {
        ids: new WeakMap(),
        next: 0n,
    };
    const existing = registry.ids.get(o);
    if (existing !== undefined) return existing;
    const result = String(registry.next++);
    registry.ids.set(o, result);
    return result;
};
```

Within one registry's lifetime:

- Repeated requests for the same reference return the same string.
- Distinct references receive distinct strings, even with identical contents.
- Objects, arrays and functions participate; IDs are never reused, including
  after their objects are collected.
- Separate helper definitions and modules share the registry. Weak keys do
  not keep an object alive merely because it received an ID.

The proposed key above is a spelling to settle with the pattern. Registry
scope follows the particular `globalThis`, not every realm, worker or VM.
Durable identity across serialization or restarts is outside this proposal.

The compiler would lower the recognized function to a native identity
operation. The JavaScript helper supplies the executable source meaning;
backends must reproduce the approved contract using their own identity
representation. This does not admit general `globalThis` access, `WeakMap`,
symbols or property mutation. Stable reference identity must survive existing
VM interfaces: reconstructing a fresh wrapper on each request is insufficient.

**Benefits.** Supplies the missing key for identity-based collections while
returning an existing VM value type. Collection layout and persistent updates
remain library work. The JavaScript spelling runs directly without rewriting
the source.

**Drawbacks.** Introduces shared mutable allocation state, a recognized
pattern and native support. Each reference lookup has a registry cost, and
the exact strings depend on first-use order. Returning a string avoids a new
value type but does not eliminate VM/interface work.

### Admission and open decisions

The [language principles](../principles/README.md) require accepted code to
have no side effects and successful results to agree with JavaScript. The
counter's mutation is observable, rather than an unobservable cache:

```js
const unused = id(a);
const result = id(b);
```

For distinct, previously unseen objects, removing the unused call changes
`result`. Reordering first requests also changes returned strings. Preserving
only identity equality is insufficient: callers can return, compare and sort
the exact strings. Pattern recognition alone does not make this operation
pure or authorize a semantic exception.

Decide how the feature fits those principles before implementation. The
alternative discussed is an ordinary [runner effect](../design/io-effects.md)
whose handler owns the registry and returns the string through a continuation.
That uses the existing effect model; a synchronous `id` pattern needs a
separate, explicit language-design decision. This proposal does not approve
weakening the current guarantees.

Also settle the primitive-input policy for `unknown`, registry initialization
and lifetime, and how native execution matches JavaScript for the same inputs
and registry environment, including calls through exported functions. Reject
or explicitly encode primitives; do not silently box them into fresh objects.

### Tasks

- [ ] Decide between the synchronous pattern and runner-effect API; record
  the language designer's approval and its link before implementing a new
  language feature, as [DESIGN §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
  requires.
- [ ] Specify the input domain, string format, registry key/scope, lifetime,
  initialization and observable evaluation behavior. Preserve the current
  refusal until a compatible design or explicit semantic change is approved.
- [ ] If the pattern is approved, define recognition over parsed statements
  and expressions with validated bindings, following
  [statement-aware intrinsics](../../fjs/compiler/parser/todo/statement-aware-intrinsics.md).
  Specify its callable representation, native operation and JavaScript output
  without exposing the registry's component operations generally.
- [ ] Implement the chosen API and backend/interface support with stable
  object identity, weak retention and no ID reuse. Carry ordering/state through
  the approved execution model; do not treat observable allocation as pure.
- [ ] Add focused proofs for aliases, equal-content distinct objects,
  arrays/functions, registry sharing, the primitive policy and exact observable
  results across executors. Cover the unused-call example, later exported calls
  and, for a pattern, refusal of bodies that depart from its approved shape.
- [ ] Document the approved API and limits, add an identity-keyed collection
  example, and fold the implemented behavior into the specification.

### Related

- [References in containers](../../todo/037-language-design-map.md) — the
  broader capability gap and collection alternatives.
- [Object identity](../design/object-identity.md) — the existing design sketch.
- [Entry helpers](../property-access/entries/README.md) — complete function
  patterns already recognized by the compiler.
- [I/O effects](../design/io-effects.md) — runner-owned state and operations.
