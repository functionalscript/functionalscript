## Obfuscate object IDs with a reversible permutation

**Priority:** P4
**Status:** open — follow-up proposal, tentatively for v2

### Release scope

Follow up on the [`id` proposal](./object-identity-id.md). Keep v1 as simple
as possible: neither the identity function nor its obfuscation is a v1
requirement. **V2 is a tentative target**, not a release commitment. The
[working session](https://chatgpt.com/local/6af607d6-7994-8191-b9a8-1309ba7a700d)
requested this TODO; implementation and the language contract still need
explicit design approval.

### Problem

Plain counter IDs reveal the order of first ID requests, which need not be
object creation order. We want stable, unique reference labels whose values
make that sequence unobvious, while retaining a cheap reversible mapping.
Unpredictability is an intended weaker guarantee, not a claim of purity.

### Proposal

Initialize one random uint32 nonce per registry. Map each uint32 counter
through the bijective `lowbias32` mixer, XORing the nonce before and after
mixing, then return the unsigned result as a decimal string. This is a
permutation of the uint32 space for each fixed nonce, not a digest with
collisions.

This **JavaScript reference sketch** inlines the mixer so the proposed
function pattern is self-contained. It accepts objects, arrays and functions;
rejecting primitives is a proposed policy to settle with the base API.
The body is not currently accepted FJS.

```js
const id = o => {
    if (
        o === null ||
        (typeof o !== 'object' && typeof o !== 'function')
    ) {
        throw new TypeError('id expects an object or function');
    }

    const registry =
        globalThis['functionalscript.object-id.u32.v1'] ??= {
            ids: new WeakMap(),
            next: 0,
            nonce: crypto.getRandomValues(new Uint32Array(1))[0],
        };

    const existing = registry.ids.get(o);
    if (existing !== undefined) return existing;

    if (registry.next >= 0x1_0000_0000) {
        throw new RangeError('Object ID space exhausted');
    }

    let x = registry.next ^ registry.nonce;
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
    const result = String(
        (x ^ (x >>> 16) ^ registry.nonce) >>> 0,
    );

    registry.ids.set(o, result);
    registry.next += 1;
    return result;
};
```

The string key identifies this registry layout separately from the earlier
BigInt-counter sketch. Its `v1` suffix versions the layout, not the language
release. `??=` generates the nonce only on initialization, and every copy of
this helper in the same realm shares that nonce and registry.

Keep `next` as an ordinary Number, allowing it to reach `2**32` exactly.
Coercing the stored counter with `| 0` or `>>> 0` would wrap and reuse IDs.
The exhaustion check rejects new objects after the uint32 space is used;
cached objects remain accessible because their lookup comes first. Collection
of an object does not recycle its ID or reset the nonce.

### Reversibility and limits

The mixer and its inverse are published in
[`hash-prospector`](https://github.com/skeeto/hash-prospector#discovered-hash-functions).
The nonce wrapper is this proposal's addition. XOR-right-shifts are invertible,
and the odd multipliers have inverses modulo `2**32`, so every step is
bijective. For a numeric key and the same nonce, the inverse is:

```js
const recover = (key, nonce) => {
    let x = key ^ nonce;
    x = Math.imul(x ^ (x >>> 16), 0x43021123);
    x = Math.imul(
        x ^ (x >>> 15) ^ (x >>> 30),
        0x1d69e2a5,
    );
    return (x ^ (x >>> 16) ^ nonce) >>> 0;
};
```

This inverse documents the construction; it need not become a public FJS
API. `Math.imul` preserves the low product bits exactly, and the final
`>>> 0` interprets them as an unsigned Number. Obfuscation has no cryptographic
security guarantee; a uint32 nonce is exhaustively searchable.

**Benefits.** Preserves uniqueness without a collision table, makes sequential
allocation unobvious, and uses inexpensive arithmetic with an explicit inverse.
It still returns an existing VM value type and needs no `Map`/`Set` value type.

**Drawbacks.** Adds random initialization and shared state, bounds the total
number of allocated IDs per registry, and needs native/runtime support for
identity and the approved observation rules.

### Observable contract

The intended contract preserves reference identity within one scope: equal
references receive equal strings, and distinct references receive distinct
strings. Concrete labels and their ordering may differ across runs or VMs.
Randomness and permutation do not make the operation pure. Adopt this weaker
contract explicitly, including its exception to the current
[JavaScript-result agreement](../principles/README.md), before admitting the
direct `id(o)` function pattern.

Specify what remains reproducible for a fixed nonce, registry state and request
order, and which changes in string-dependent results are permitted when an
executor reorders or removes requests. A hard-to-invert label alone grants no
optimizer permission. The base TODO owns the shared parser, VM-interface and
identity-scope work; this follow-up does not require general random APIs or
global mutation to become FJS features.

### Tasks

- [ ] Revisit after the v1 scope is settled; confirm the release target and
  obtain explicit language-design approval before implementation.
- [ ] Specify nonce initialization, registry scope/layout, primitive handling,
  the weaker observable contract and optimizer permissions alongside the base
  `id` design. Distinguish direct function calls from runner effect requests.
- [ ] Implement the approved permutation and nonce initialization, preserving
  identity, weak retention, unsigned arithmetic and the exhaustion policy.
- [ ] Prove reversibility and backend agreement for fixed inputs; cover aliases,
  distinct equal-content objects, arrays/functions, shared nonce initialization,
  the valid string ID `"0"`, and the last allocation followed by cached/new
  lookups at exhaustion. Test primitive behavior under the approved policy.
- [ ] Document the final contract and registry lifetime without promising
  deterministic labels across independent executions or cryptographic secrecy.

### Related

- [Object identity `id` pattern](./object-identity-id.md) — the base proposal.
- [References in containers](../../todo/037-language-design-map.md) — motivation.
- [Entry helpers](../property-access/entries/README.md) — existing function patterns.
