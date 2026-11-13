## Add an object identity `id` pattern

**Priority:** P4
**Status:** open — tentative v2; runtime admission and implementation remain open

### Release scope

Keep v1 as simple as possible. The `id` feature is a **tentative v2 candidate**,
not a v1 requirement or a committed v2 feature. This TODO records the design
for later consideration; it does not authorize implementation. This planning
direction comes from the [working session](https://chatgpt.com/local/6af607d6-7994-8191-b9a8-1309ba7a700d).

The API returns `bigint` from its first version, independently of the language
release in which it ships. Obfuscation is an optional follow-up.

The plain counter below is the minimal reference design. A separate
[follow-up TODO](./object-identity-id-obfuscation.md) records the proposed
nonce and reversible uint32 permutation, also tentatively for v2.

### Problem

FJS can compare object and function references for equality, but cannot derive
an identity hash or ordering from that comparison. A library cannot generally
index arbitrary references efficiently using equality alone. `Map` and `Set`
are not language types; adding them would require new VM representations and
interface support.

Provide a bigint identity that persistent collections can compare or index
without first adding a collection type to the language. The generic B-tree
can use a bigint comparator; the current string-keyed `OrderedMap` needs
adaptation or a specialization to retain bigint keys without text conversion.

### Proposal

Recognize an `id` helper as a complete function pattern, like
[`entry`](../property-access/entries/README.md). Its proposed type-level API is
`(o: unknown) => bigint`; executable FJS source remains JavaScript, with types
in JSDoc or companion declarations. Behavior for primitive inputs is still
undecided.

One possible JavaScript implementation shares a registry through a namespaced
string key on `globalThis`. A `WeakMap` associates references with bigints; a
monotonically increasing `bigint` counter allocates new IDs. No symbol key is
needed. The following is a **proposal sketch for object and function inputs**,
not currently accepted FJS or a settled recognition grammar:

```js
const id = o => {
    const registry = globalThis['functionalscript.object-id.bigint.v1'] ??= {
        ids: new WeakMap(),
        next: 0n,
    };
    const existing = registry.ids.get(o);
    if (existing !== undefined) return existing;
    const result = registry.next;
    registry.ids.set(o, result);
    registry.next += 1n;
    return result;
};
```

### Result contract

The [proposed spec contract](../design/object-identity.md#proposed-id-result-contract)
allows non-sequential bigint values and different implementations in
different VMs. The counter above is one implementation candidate; concrete
labels and results derived from them need not match across VMs or runs.
Ordinary bigint equality and ordering remain usable within an execution.
The contract does not prescribe a sign or fixed integer width; the counter
sketch happens to produce nonnegative values.

Within one identity scope:

- Repeated requests for the same reference return the same bigint.
- Distinct references under the applicable identity semantics receive distinct
  bigint values, even with identical contents in the JavaScript-compatible profile.
- Objects, arrays and functions participate; IDs are never reused, including
  after their objects are collected.
- Separate helper definitions and modules share the registry. Weak keys do
  not keep an object alive merely because it received an ID.

The proposed key above is a spelling to settle with the pattern. Registry
scope follows the particular `globalThis`, not every realm, worker or VM.
Durable identity across serialization or restarts is outside this proposal.

The compiler would lower the recognized function to a native identity
operation. The JavaScript helper is executable source, while native backends
may choose their own implementation and concrete labels under the proposed
result contract. This does not admit general `globalThis` access, `WeakMap`,
symbols or property mutation. Stable reference identity must survive existing
VM interfaces: reconstructing a fresh wrapper on each request is insufficient.

**Benefits.** Supplies the missing key for identity-based collections while
returning an existing VM value type. Collection layout and persistent updates
remain library work. The JavaScript spelling runs directly without rewriting
the source. Returning bigint avoids decimal encoding and decoding and lets
VMs use their compact bigint representation where available.

**Drawbacks.** Introduces shared mutable allocation state, a recognized
pattern and native support. Each reference lookup has a registry cost; in the
counter implementation, exact values depend on first-use order. Returning a
bigint avoids a new value type but does not eliminate VM/interface work.

### Admission and open decisions

The [language principles](../principles/README.md) require accepted code to
have no side effects and successful results to agree with JavaScript. The
counter's mutation is observable, rather than an unobservable cache:

```js
const unused = id(a);
const result = id(b);
```

For distinct, previously unseen objects in this counter implementation,
removing the unused call changes `result`. Reordering first requests also
changes returned bigint values. The proposed result contract deliberately permits
implementation-dependent labels and consequences of observing them; it needs
an explicit exception to the current principles. Pattern recognition alone
does not make the operation pure.

Decide how the feature fits those principles before implementation. The
alternative discussed is an ordinary [runner effect](../design/io-effects.md)
whose handler owns the registry and returns the bigint through a continuation.
That uses the existing effect model; a synchronous `id` pattern needs a
separate admission decision covering the proposed exception and its optimizer
rules. Recording the future result contract does not admit the feature today.

Also settle the primitive-input policy for `unknown`, registry initialization
and lifetime, and which observations must agree across JavaScript and native
execution under the result contract, including calls through exported functions.
Reject or explicitly encode primitives; do not silently box them into fresh objects.

### Tasks

- [ ] Decide between the synchronous pattern and runner-effect API; record
  the language designer's approval and its link before implementing a new
  language feature, as [DESIGN §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
  requires.
- [ ] Specify the input domain, registry key/scope, lifetime, initialization
  and observable evaluation behavior under the implementation-dependent
  result contract. Preserve the current
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
  arrays/functions, bigint results including cached `0n`, registry sharing,
  the primitive policy and identity
  guarantees across executors; do not require identical labels from different
  implementations. Cover the unused-call example, later exported calls
  and, for a pattern, refusal of bodies that depart from its approved shape.
- [ ] Document the approved API and limits, add an identity-keyed collection
  example, and fold the implemented behavior into the specification.

### Related

- [References in containers](../../todo/037-language-design-map.md) — the
  broader capability gap and collection alternatives.
- [Generic B-tree](../../fjs/types/btree/README.md) and
  [string-keyed ordered map](../../fjs/types/ordered_map/types.ts) — collection
  integration for bigint keys.
- [Object identity](../design/object-identity.md) — the existing design sketch.
- [Entry helpers](../property-access/entries/README.md) — complete function
  patterns already recognized by the compiler.
- [I/O effects](../design/io-effects.md) — runner-owned state and operations.
- [Reversible ID obfuscation](./object-identity-id-obfuscation.md) — a
  tentative v2 follow-up; not a dependency of v1.
