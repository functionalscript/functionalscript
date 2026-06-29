## A `VecBuilder` for O(n log n) bit-vector concatenation

**Priority:** P2
**Status:** open

### Problem

Building a large `Vec` by repeatedly appending small chunks is **O(n²)** in the
total bit length, because every `concat` re-shifts the *entire* accumulated
`bigint` to make room for the new tail.

The `big` proof in `fs/base_n/proof.f.ts` makes this visible. It decodes a hex
string of `maxLength >> 2n` (262 144) `f` characters into a 1 Mbit vector:

```ts
big: () => {
    const x = hex.stringToVec(bigSampleHex)
    assertEq(length(x!), maxLength)
}
```

`fs/base_n/module.f.ts` `stringToVec` folds one 4-bit chunk at a time:

```ts
let result: Vec = empty
for (const c of s) {
    const index = toIndex(c)
    if (index < 0) { return null }
    result = concat(result)(vecN(BigInt(index)))   // re-shifts all of `result`
}
return result
```

Each `concat` does `(acc << 4) | chunk`, so the work is `4 + 8 + 12 + … ≈ n²/2`
bit operations. Measured cost of the `big` test alone:

- node: ~13.5 s
- bun: ~42.7 s (Bun's `bigint` shift is slower)

This is not specific to `base_n`. The public `BitOrder.listToVec`
(`fs/types/bit_vec/module.f.ts`) is also a naive left fold and has the same
O(n²) behavior for long lists:

```ts
listToVec: fold(flip(concat))(empty),
```

So every caller that concatenates many vectors (`fs/asn.1`, `fs/crypto/sign`,
`fs/sul/...`) inherits the quadratic blow-up once the list gets long.

### Key observation — the fast algorithm already exists

`u8ListToVec` (`fs/types/bit_vec/module.f.ts`) already avoids the quadratic cost
with a **binary-counter** accumulator. Slot `i` of its `result` array holds an
already-combined run of the most recent `2 ** i` elements; a freshly arrived
element "carries" upward, merging only with similar-sized runs — exactly like
incrementing a binary number. Because every merge joins two runs of comparable
size, the total `bigint` shifting work is `O(n log n)` instead of `O(n²)`, and
element order is preserved.

This accumulator *is* a `VecBuilder`: the bit-vector analogue of a
`StringBuilder` (Java) / `strings.Builder` (Go) / `String::push_str` amortized
buffer. The trick is currently private to `u8ListToVec` and not reused.

### Proposal

Extract the binary-counter accumulator into one shared builder and route every
many-into-one concatenation through it.

1. Add a private `unpackListToVec(unpackConcat)(list: List<Unpacked>): Unpacked`
   helper holding the binary-counter loop (lifted verbatim from `u8ListToVec`).
   Optionally expose a small public `VecBuilder` surface
   (`empty` / `append` / `build`) if an incremental, non-list API proves useful;
   start with the list form since all current callers have the full list.
2. Reimplement `BitOrder.listToVec` as
   `list => pack(unpackListToVec(unpackConcat)(map(unpack)(list)))` so the public
   API is O(n log n) for everyone.
3. Reimplement `u8ListToVec` to delegate to the same helper (removing the
   duplicated loop).
4. Fix `fs/base_n/module.f.ts` `stringToVec` to collect chunks and call
   `msb.listToVec` once instead of folding `concat` per character. Preserve the
   early `null` return on the first out-of-alphabet character (validate indices,
   then build). Stay within FunctionalScript style — no `.push`; arrays are valid
   `List<Vec>`, so `chars.map(toIndex)` → check for `< 0` → `map(vecN)` works.
   Remove the then-unused `concat` import.

### Correctness notes

- **Order preservation.** The binary counter merges `unpackConcat(old)(cur)`
  with `old` (earlier) on the left, and the final
  `result.reduce((p, c) => unpackConcat(c)(p), unpackEmpty)` prepends
  higher (earlier) slots in front of accumulated later runs. Net result is
  left-to-right order, identical to the current `fold(flip(concat))(empty)`.
  This matters for `fs/asn.1` and other order-sensitive callers.
- **Empty list** still yields `empty` (reduce seed is `unpackEmpty`).

### Tasks

- [ ] Add `unpackListToVec` (binary-counter) helper in
      `fs/types/bit_vec/module.f.ts`.
- [ ] Reimplement `BitOrder.listToVec` on top of it.
- [ ] Reimplement `u8ListToVec` on top of it; delete the duplicated loop.
- [ ] Rewrite `fs/base_n/module.f.ts` `stringToVec` to build via `listToVec`;
      keep `null`-on-invalid behavior; drop the unused `concat` import.
- [ ] Run `npx tsc` and `node ./fs/fjs/module.ts t`; confirm all `bit_vec` and
      `base_n` proofs pass and the `big` test drops from ~13 s to well under a
      second.
- [ ] Decide whether to keep `big` as a pure correctness check or add a loose
      timing guard.

### Related

- `fs/types/bit_vec/module.f.ts` — `u8ListToVec` (existing binary-counter
  source), `BitOrder.listToVec` (naive fold to replace).
- `fs/base_n/module.f.ts` — `stringToVec` (primary O(n²) hot path).
- `fs/base_n/proof.f.ts` — the `big` proof that surfaced this.
- Callers that benefit: `fs/asn.1/module.f.ts`, `fs/crypto/sign/module.f.ts`,
  `fs/sul/level/literal/module.f.ts`, `fs/sul/id/module.f.ts`,
  `fs/types/uint8array/module.f.ts`.
