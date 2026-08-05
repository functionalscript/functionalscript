## parser-container-stack-cost. `parse` spends a call-stack frame per container

**Priority:** P1
**Status:** open

### Problem

`fjs/media/json`'s `parse` throws `RangeError: Maximum call stack size exceeded`
on well-formed JSON containing more than about 5000 **container values**,
whether they are nested or siblings. A `throw` in FunctionalScript is a panic
(§3.4): nothing can catch it, so the whole point of `parse` returning a
`Result` — malformed or oversized input being a value the caller branches on —
is lost for these inputs. The document is *valid*, and `parse` still cannot
report anything at all.

The limit is per **container**, not per value. Binary-searching the largest
input of each shape that still parses (Node 22.22.2):

| Shape | Largest that parses |
| --- | --- |
| `[1, 1, … ]` — sibling numbers | >200000 (no limit found) |
| `["ab", "ab", … ]` — sibling strings | >200000 (no limit found) |
| `{"k0":1, "k1":1, … }` — primitive-valued fields | >200000 (no limit found) |
| `[{}, {}, … ]` — sibling empty objects | **5687** |
| `[[], [], … ]` — sibling empty arrays | **5687** |
| `[[[[…]]]]` — nesting depth | **5689** |

Sibling containers (5687) and nesting depth (5689) fail at effectively the
**same** threshold, two frames apart, while primitives never fail at all. So a
container costs stack wherever it appears, and how it is arranged is
irrelevant. That equality is the strongest available hint that both come from
one cause.

Two consequences for how this should be read:

- **It is not a depth-vs-breadth distinction.** An earlier revision of this
  issue claimed "5000 levels of nesting parse fine, so it is not a depth
  limit". That was an artifact of sampling at 5000, just under the 5689
  threshold. Nesting is not safe; it merely happened to be measured below the
  cliff.
- **What *is* the anomaly is the primitive/container asymmetry.** Deep nesting
  costing stack is ordinary for a recursive-descent-shaped parser. 200,000
  sibling primitives costing none while 5,688 empty `{}` values overflow is
  not — an empty object is not more work than a number, and no arrangement of
  flat siblings should consume a stack frame each.

Also established:

- **Not an element-count limit.** 200,000 primitive elements parse fine in an
  array and in an object alike, so neither the array accumulator's length nor
  the `OrderedMap`'s size is the bound.
- **Not the tokenizer.** `tokenize` materializes all 18002 tokens of the
  6000-`{}` case without trouble; `fjs/media/json/parser`'s `parse` is what
  overflows on that already-materialized token list.

The threshold is a JS call-stack limit, so the exact number varies with the
engine, its version, and how much stack the caller has already consumed — the
same document can parse in one context and panic in another. The 5687/5689
pair above is Node 22.22.2; on Node 23.11.0 a reviewer measured both nesting
depth and sibling `{}` failing at 5000 while 50,000 sibling primitives still
parsed, i.e. the same asymmetry with a smaller stack. Treat every number here
as a measurement, not a contract, and re-measure on the target runtime before
relying on one.

**Mechanism: not yet established.** The stack is
`next` → `apply`'s thunk (`fjs/types/list/module.f.ts:104`) → `next` → …, one
frame per layer, so the recursion is in the lazy-list traversal rather than in
`foldOp`. The obvious suspect — `addToArray` (`:60-62`) appending with
`concat(array.values)([value])`, giving an *n*-layer spine — is **ruled out by
the 200,000-primitive rows**, which walk a far longer spine of exactly the same
shape. What remains to explain is why completing a container
(`endArray`/`endObject`, `:86-111`) costs a frame that outlives the container.
Find that before writing a fix, and do not assume the accumulator is at fault.

This was found while migrating `fjs/djs/tokenizer/proof.f.ts` off `JSON.parse`
(see `remove-native-json.md`): a 6000-token dump could not be read back through
`parse` at all, and that proof now compares the serialized dump as text
instead.

### Proposal

Establish the mechanism first — the measurements above narrow it to "one frame
per container, wherever it sits", but not yet to a line. The sharpest probe is
the primitive/container pair: `[0, 0, …]` and `[[], [], …]` differ only in
whether each pushed value is a container, and one is unbounded while the other
caps at 5687, so instrumenting stack depth across that single substitution
should localize it. The near-identical sibling and depth thresholds say to look
for **one** cause, not two.

Two candidate directions once it is known, in preference order:

1. **Remove the mid-fold forcing.** If `endArray`/`endObject` forcing a child
   (`toArray` / `fromMap`) while the enclosing container is still lazy is what
   stacks, defer it: keep children unforced in the accumulator and materialize
   once at the end, or accumulate with an O(1) prepend reversed at close (the
   shape `fjs/types/rtti/parse` already uses — `consEntry` + `orderedEntries`).
2. **Make `next` iterative across `apply` layers.** The general fix, benefiting
   every `flat`/`map` pipeline rather than just this parser, but it changes
   `fjs/types/list`'s core traversal and wants its own measurement.

Per §5.1 the generic improvement (2) is the better long-term answer if the
recursion turns out not to be specific to this parser; prefer 1 only if the
defect really is local to the fold.

Whichever lands, the contract to establish is that `parse` **never panics on
input the tokenizer accepts**: any limit it cannot honor must come back as
`error`, not as a `throw`. Until then `parse` is total in its *type* but not in
its behavior, which is the gap that makes this P1 — a `Result` return that can
still panic gives callers a guarantee the code does not keep.

Note that a bound on *nesting depth* may be a legitimate thing to keep (a
document nested 100,000 deep is a reasonable thing to refuse); the requirement
is that refusing it is an `error` value rather than a panic. The flat-sibling
cost has no such defence and should simply go away.

### Tasks

- [ ] Localize the recursion: what does completing a container leave on the
      stack that completing a primitive does not?
- [ ] Pin today's behavior first, so the bug cannot silently return: a proof in
      `fjs/media/json/parser/proof.f.ts` with the sibling-container and
      deep-nesting cases under a `throw` key (§3.4), plus the
      200,000-primitive array and object cases as `ok` baselines. Size the
      throwing cases well past any plausible engine threshold — they are
      measurements of a moving limit, not of a fixed one.
- [ ] Fix, then flip those `throw`-keyed cases to `ok` assertions and confirm
      sibling containers scale like primitives.
- [ ] Check whether `fjs/djs`'s parser shares the shape and the bug.
- [ ] Revisit `fjs/djs/tokenizer/proof.f.ts`'s `largeInputs[1]`: once `parse`
      handles the dump, a round-trip assertion becomes available again.
- [ ] `npx tsc`, `fjs t`, `npm run cov`, CHANGELOG entry.

### Related

- [`fjs/media/json/parser/module.f.ts`](../parser/module.f.ts) — `addToArray`
  (`:60-62`), `endArray`/`endObject` (`:86-111`), `parse` (`:230-240`).
- [`fjs/types/list/module.f.ts`](../../../types/list/module.f.ts) — `next`,
  `concat`, and the `apply` thunk the recursion runs through.
- [`fjs/types/rtti/parse/module.f.ts`](../../../types/rtti/parse/module.f.ts) —
  `consEntry` / `orderedEntries`, the O(1)-prepend accumulator direction 1 copies.
- [streaming-recognizer](./streaming-recognizer.md) — a different concern about
  the same pipeline (*space*: O(n) value, O(token) buffering). That issue
  assumes `parse` works and is merely expensive; this one is a crash, and a
  no-op-builder recognizer derived from today's fold would inherit it.
- [remove-native-json](./remove-native-json.md) — the migration that surfaced this.
