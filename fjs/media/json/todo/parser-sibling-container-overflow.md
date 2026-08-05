## parser-sibling-container-overflow. `parse` overflows the call stack on ~5000 sibling containers

**Priority:** P1
**Status:** open

### Problem

`fjs/media/json`'s `parse` throws `RangeError: Maximum call stack size exceeded`
on well-formed JSON containing roughly 5000 or more **sibling container values**
(objects or arrays). A `throw` in FunctionalScript is a panic (§3.4): nothing
can catch it, so the whole point of `parse` returning a `Result` — malformed or
oversized input being a value the caller branches on — is lost for these inputs.
The document is *valid*, and `parse` still cannot report anything at all.

Measured on Node 22, `parse(text)[0]`:

| Input | Result |
| --- | --- |
| `[1, 1, … ]`, 12000 numbers | `ok` |
| `["ab", "ab", … ]`, 12000 strings | `ok` |
| `{"k0":1, "k1":1, … }`, 6000 primitive-valued fields | `ok` |
| `[[[[…]]]]`, nesting depth 5000 | `ok` |
| `[[], [], … ]`, 3000 empty arrays | `ok` |
| `[{}, {}, … ]`, 3000 empty objects | `ok` |
| `[[], [], … ]`, 6000 empty arrays | **`RangeError`** |
| `[{}, {}, … ]`, 6000 empty objects | **`RangeError`** |
| `[[1], [1], … ]`, 6000 one-element arrays | **`RangeError`** |
| `[{"k":1}, … ]`, 6000 one-field objects | **`RangeError`** |
| `{"k0":{}, "k1":{}, … }`, 6000 object-valued fields | **`RangeError`** |

What isolates the trigger is the first three rows against the last five: the
same 6000-element containers parse fine when their elements are *primitives*
and panic when the elements are *containers*, empty ones included. So it is:

- **Not a depth limit.** 5000 levels of nesting parse fine; every failing case
  is flat, depth 2.
- **Not an element-count limit.** 12000 primitive elements parse fine, in an
  array or an object alike, so neither the array accumulator's length nor the
  `OrderedMap`'s size is the bound.
- **Not the tokenizer.** `tokenize` materializes all 18002 tokens of the
  6000-`{}` case without trouble; `fjs/media/json/parser`'s `parse` is what
  overflows on that already-materialized token list.

The trigger is therefore the *number of completed child containers* — i.e. how
many times `endArray`/`endObject` (`parser/module.f.ts:86-111`) run inside one
enclosing container — not the size of anything.

The threshold sits between 5000 and 5500 and is a JS call-stack limit, so it
varies with the engine and with how much stack the caller has already used:
the same document can parse in one context and panic in another.

**Mechanism: not yet established.** The stack is
`next` → `apply`'s thunk (`fjs/types/list/module.f.ts:104`) → `next` → …, one
frame per layer, so the recursion is in the lazy-list traversal rather than in
`foldOp`. The obvious suspect — `addToArray` (`:60-62`) appending with
`concat(array.values)([value])`, giving an *n*-layer spine — is **ruled out by
the 12000-primitive row**, which walks a longer spine of exactly the same
shape. Whatever `endArray`/`endObject` do when they force a child value
mid-fold is the part still to be explained; find that before writing a fix, and
do not assume the accumulator is at fault.

This was found while migrating `fjs/djs/tokenizer/proof.f.ts` off `JSON.parse`
(see `remove-native-json.md`): a 6000-token dump could not be read back through
`parse` at all, and that proof now compares the serialized dump as text
instead.

### Proposal

Establish the mechanism first — the measurements above narrow it to "one
completed child container per frame", but not yet to a line. Start by
instrumenting which lazy structure `next` is descending when the stack grows:
the failing and passing cases differ only in whether the pushed value is itself
a container, so a single well-chosen `[]`-vs-`0` comparison under a stack-depth
counter should localize it.

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

### Tasks

- [ ] Localize the recursion: which lazy structure is `next` descending, and
      why only when the pushed value is a container.
- [ ] Reproduce as a proof in `fjs/media/json/parser/proof.f.ts`: 6000 sibling
      `{}` and 6000 sibling `[]` both return `ok`, with the 12000-primitive,
      6000-primitive-field, and 5000-deep cases as the working baselines that
      must not regress.
- [ ] Fix, and confirm the sibling-container count scales well past the old
      threshold.
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
