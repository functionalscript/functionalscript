# Walk a container schema by own indices, or keep walking it by iteration

**Priority:** P4
**Status:** open — a decision about the canonical data form, not a patch to one reader

## Problem

Every reader of a container schema walks it by **iteration**:
[`../common/module.f.mjs`](../common/module.f.mjs)'s `tupleSchemaEntries` with
`Array.from`, and [`../data/module.f.mjs`](../data/module.f.mjs)'s
`containerUnion` with `for…of`. Iteration is an ordinary property lookup driven
by `length`, so two things about a schema object that is not a plain array can
change what it declares:

- an overridden `Symbol.iterator` yields whatever it likes, whatever the indices
  hold;
- an inherited numeric index — a custom prototype, or a polluted
  `Array.prototype[0]` — is read in place of a hole, so a hole stops declaring
  `undefined`, which is the contract [`../README.md`](../README.md) states under
  "A hole is a declared position".

Verified against `a6117ea`, one probe each:

```js
const s = [number]; s[Symbol.iterator] = function* () { yield string }
validate(s)([1])                       // error — the iterator wins over index 0

const proto = Object.create(Array.prototype); proto[0] = number
const h = new Array(1); Object.setPrototypeOf(h, proto)
validate(h)([undefined])               // error — the inherited schema wins over the hole
```

**Neither is a disagreement, which is why this is P4 rather than a bug.** All
three readers answer the same on both, because they make the same walk — and
before `4eb0142`, the code commit of
[#1712](https://github.com/functionalscript/functionalscript/pull/1712), they did
*not*: `Object.entries` reads own enumerable keys only, so the schema-form
readers and the data form split on both probes. Closing that split is what that
commit did, and every commit from it onward agrees. What is left is a question
about which walk the agreed-on one should be.

FunctionalScript can express neither schema — it has no symbols and no mutation
— so both are reachable only from a caller already writing plain JavaScript, and
neither can be pinned by a `.f.mjs` proof. That is also the reason the current
behaviour is documented rather than guarded.

## Proposal

Undecided; the two options are not a ladder.

1. **Keep iteration.** It is what `containerUnion` has always done, and the
   canonical data form is content-addressed, so leaving it alone leaves every
   hash alone. The cost is that "a hole declares `undefined`" holds for ordinary
   arrays rather than universally.
2. **Read own indices, in both.** `Array.from({ length: rtti.length }, …)` with
   an own-property check in the schema-form readers, and the matching change to
   `containerUnion`. The contract then holds unconditionally. The cost is that it
   moves the canonical data form, so it wants its own pull request and its own
   look at whether any stored hash is affected.

Option 2 is only coherent if **both** move. Changing `tupleSchemaEntries` alone
re-opens the split that #1712 closed — measured on the probes above.

The value side is a separate question, and settled only in the sense that the
readers agree: `getItem` reads `value[k]`, which follows a value's prototype
chain too, while `undeclaredEntries` enumerates own keys only. Answer A in
[`./close-counts-trailing-undefined.md`](./close-counts-trailing-undefined.md)
would make that asymmetry load-bearing — it asks the canonical form to equate
`close([number])` with `close([number, () => ['const', undefined]])`, which an
inherited index at 1 tells apart.

## Tasks

- [ ] Decide between iteration and own indices for a container schema walk.
- [ ] If own indices win, change `tupleSchemaEntries` and `containerUnion`
      together, and say whether any stored data-form hash moves.
- [ ] Re-word "A hole is a declared position" in `../README.md` to match
      whichever is chosen.

## Related

- [`../common/module.f.mjs`](../common/module.f.mjs) — `tupleSchemaEntries`,
  whose doc comment records why iteration is the current choice.
- [`../data/module.f.mjs`](../data/module.f.mjs) — `containerUnion`, the walk it
  has to agree with.
- [`../README.md`](../README.md) — "A hole is a declared position", the contract
  the inherited-index case qualifies.
- Reported by the Codex review bot on
  [#1712](https://github.com/functionalscript/functionalscript/pull/1712), twice:
  once for the iterator and once for the inherited index.
