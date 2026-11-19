## Write block-assignment graph profiles as source

**Priority:** P3
**Status:** open

### Problem

Assignments in immediate-call expression blocks preserve their outer binding
updates in immutable FAST and EDAG. Some resulting graphs exceed the source
writer's existing profile even though their input is admitted FunctionalScript.
The compiler reports an explicit output refusal for these shapes; graph and
value evaluation still retain their semantics.

A required member lookup before an argument that writes an outer binding gains
a `memberPresent` query. The current source writer has no spelling for that
query and refuses `an internal member-presence query`:

```js
export default (() => {
    let n = 0;
    const object = { f: value => value };
    const result = object.f((() => { n = n + 1; return n; })());
    return [result, n];
})();
```

The value is `[1, 1]`. Replacing the query must preserve required lookup
failures and successful results. The [failure policy](../../../../../spec/principles/README.md#failure-is-one-outcome)
does not require preserving which failure wins or its diagnostic payload.
Optional calls must skip argument writes and retain the previous binding values.

Stacked switch-label state can establish a shared node inside one selected
region and read it later outside. The existing source profile refuses
`a shared node reached from outside the lazy operand that establishes it`:

```js
export default (() => {
    let n = 0;
    let k = 0;
    while (k < 1) {
        k = k + 1;
        switch (3) {
            case (() => { n = n + 1; return 1; })():
            case (() => { n = n + 1; return 2; })(): { n = n + 10; break; }
            default: { n = n + 100; break; }
        }
    }
    return [n, k];
})();
```

The value is `[102, 1]`. Its selected shared value needs one evaluation and
identity, without moving evaluation into an unreached region.

The spread forms this section used to list are written now: an expansion is
no barrier before the items that follow it
([`edag/demand`](../../../demand/module.f.js)).

### Proposal

Recover source-spellable lookup and shared-demand regions in the source output
adapter, retaining the common graph construction and placement owners.
Assignments inside emitted immediate calls are available to transport results.
The generated source must reparse to the same behavior, preserve sharing, and
stabilize under repeated graph/source conversion.

Do not ship the initial prepared-only recovery prototypes. Inline memo demand
IIFEs reintroduce their completion/value slots as fresh source state on every
parse. Moving member prefixes into argument-spread IIFEs likewise adds new state
and argument containers on later conversions. Those spellings preserve the
first result but grow the program repeatedly instead of reaching a canonical
source profile. A solution needs canonical reconstruction or shared normalization
that prevents those synthetic wrappers from accumulating.

### Tasks

- [ ] Recover required member lookup and optional-call argument regions while
  preserving lookup failures, skipped writes, receiver identity, and argument order.
- [ ] Spell shared selected-region state with one evaluation and the original
  invocation lifetime, including stacked switch labels.
- [ ] Prove repeated source conversion reaches a stable spelling and graph
  normalization for the admitted profile, with explicit refusal elsewhere.

### Related

- [Block assignment integration proofs](../../../../compiler/serializer/block_assignments.proof.f.js) — semantic checks and current explicit output refusals.
- [Source output admission](../module.f.js) — the existing graph-profile boundary.
- [Compiler architecture](../../../../compiler/architecture.md) — placement and source spelling have separate owners.
