## Replace serialized proof expectations with structural ones

**Priority:** P4
**Status:** open

### Problem

Roughly 105 proof assertions compare `JSON.stringify(value)` against a JSON
**string literal** instead of stating the expected value directly:

| File | sites |
| ---- | ----- |
| `fjs/djs/tokenizer/proof.f.mjs` | ~14 |
| `fjs/bnf/ll1/proof.f.mjs` | 34 |
| `fjs/bnf/descent/proof.f.mjs` | 27 |
| `fjs/bnf/data/proof.f.mjs` | 4 |
| `fjs/media/json/serializer/proof.f.mjs` | 11 (serialization **is** the contract — leave alone) |

```js
const result = JSON.stringify(dm)
if (result !== '{"":{"rangeMap":[[null,64],[{"rules":[]},70]]}}') { throw result }
```

Serialization is incidental here — the proof wants "is this the dispatch map I
expect?", not "does it serialize to this text". The string form makes property
order observable, drops `undefined`-valued properties, and forces the reader to
parse JSON in their head to see what is being claimed.

`structurallySame` / `assertStructurallySame` (added in the PR that filed this
issue, see `fjs/types/object/structurally_same/README.md`) is the comparison
these sites want. The two sites where serialization was *only* a comparison
mechanism — `fjs/cas/evo/proof.f.mjs` and `fjs/bnf/proof.f.mjs:105`, both
`stringify(actual)` vs `stringify(expected)` — were converted there. These
remaining ones were not, for the reason below.

### The obstacle: `undefined`-valued properties

A mechanical rewrite of the string literal into the equivalent JavaScript
literal **does not pass**, and this is not a typo-level problem. The BNF
dispatch entries carry optional properties as *present with value
`undefined`*, which `JSON.stringify` silently drops:

```js
const dm = dispatchMap(toData(range('AF'))[0])
Object.keys(dm['']) // ['emptyTag', 'rangeMap'] — emptyTag is present, and undefined
```

So `{"":{"rangeMap":[…]}}` is a *lossy projection* of the real value. Under
`structurallySame`, `{ a: undefined }` and `{}` deliberately differ (a property
is a property), so the honest literal is
`{ '': { emptyTag: undefined, rangeMap: […] } }` — every expectation gains
`emptyTag: undefined` / `tag: undefined` noise that says nothing about the
grammar under test. That is not obviously an improvement over the JSON string,
which is why this needs a design decision rather than a mechanical pass.

A second, smaller loss: `fjs/bnf/data/proof.f.mjs`'s `emptyTagMap` expectations
(`'{"5":true,"":"e"}'`) are order-sensitive today purely because they are
strings. `structurallySame` ignores property order by design, so converting
them silently drops an assertion nobody wrote on purpose — fine if intended,
but it should be intended.

### Proposal

Decide which of these is true, then apply it uniformly:

1. **The `undefined` properties are the defect.** `dispatchMap` and friends
   should not emit `emptyTag: undefined` / `tag: undefined` at all — omit the
   key instead. Then the mechanical rewrite works, the expectations read
   cleanly, and the data structures stop carrying properties that mean
   "absent". Check what consumes `emptyTag` before changing its shape.
2. **The `undefined` properties are intended**, and the proofs should spell
   them out. Verbose but honest; the expectation then documents the real value.
3. **`structurallySame` should treat an `undefined`-valued property as
   absent.** This would match how the repo already treats `StringMap<T>` —
   `{readonly[k in string]?: T}`, iterated with `definedEntries` /
   `definedValues` precisely because an `undefined` value is not an entry
   (`fjs/AGENTS.md` §3.2). It contradicts the semantics `structurallySame` shipped
   with, so it is a breaking change to that helper and needs its own argument,
   not a drive-by flip. Note that option 3 also removes the reason option 1
   exists, so pick one, not both.

Option 1 is the most likely right answer — it fixes the data rather than the
comparison — but it is a change to `fjs/bnf`, not to the proofs, and should be
measured against what reads `emptyTag`.

### Tasks

- [ ] Decide between the three options above; record the reasoning in
      `fjs/bnf/README.md` (option 1/2) or
      `fjs/types/object/structurally_same/README.md` (option 3).
- [ ] Convert the `fjs/bnf/ll1`, `fjs/bnf/descent`, `fjs/bnf/data` and
      `fjs/djs/tokenizer` expectations accordingly.
- [ ] Confirm the `emptyTagMap` expectations do not depend on property order,
      or keep those specific ones as strings and say why.
- [ ] Leave `fjs/media/json/serializer/proof.f.mjs` as string comparisons —
      serialized text is that module's contract.
- [ ] `tsc`, `fjs test`.

### Related

- `fjs/types/object/structurally_same/README.md` — the comparison these sites
  should use, and what it does and does not promise.
- `fjs/cas/evo/proof.f.mjs`, `fjs/bnf/proof.f.mjs` — the two sites already
  converted; both compared two *values*, so neither hit the `undefined`
  problem.
- `fjs/AGENTS.md` §3.2 (`StringMap` / `definedEntries`) — the precedent option 3
  would be aligning with.
