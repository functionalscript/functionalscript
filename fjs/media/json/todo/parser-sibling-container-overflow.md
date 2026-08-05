## parser-sibling-container-overflow. `parse` overflows the call stack on ~5000 sibling containers

**Priority:** P2
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
| `[[], [], … ]`, 3000 empty arrays | `ok` |
| `[[], [], … ]`, 6000 empty arrays | **`RangeError`** |
| `[{}, {}, … ]`, 3000 empty objects | `ok` |
| `[{}, {}, … ]`, 6000 empty objects | **`RangeError`** |
| `[{"k":1}, … ]`, 6000 one-field objects | **`RangeError`** |
| `{"k0":{}, "k1":{}, … }`, 6000 objects in an object | **`RangeError`** |
| `[[[[…]]]]`, nesting depth 5000 | `ok` |

Three things this **is not**:

- **Not a depth limit.** 5000 levels of nesting parse fine; the failing cases
  are flat, depth 2.
- **Not an element-count limit.** 12000 primitive elements parse fine. Only
  container-valued siblings fail, and both `[]` and `{}` fail identically.
- **Not the tokenizer.** `tokenize` materializes all 18002 tokens of the
  6000-`{}` case without trouble; `fjs/media/json/parser`'s `parse` is what
  overflows on that token list.

The threshold sits between 5000 and 5500 sibling containers and is a JS
call-stack limit, so it varies with the engine and with how much stack the
caller has already consumed — meaning the same document can parse in one
context and panic in another.

The recursion is in the lazy-list layer, not in `foldOp`: the stack is
`next` → `apply`'s thunk (`fjs/types/list/module.f.ts:104`) → `next` → …, one
frame per layer. `addToArray` (`parser/module.f.ts:60-62`) appends with
`concat(array.values)([value])`, so an *n*-element container is an *n*-layer
`concat` chain; `endArray`/`endObject` (`:86-111`) then force that chain with
`toArray`/`fromMap` while the enclosing container's own chain is still
un-forced. Primitives never force anything mid-fold, which is why they scale.

This was found while migrating `fjs/djs/tokenizer/proof.f.ts` off `JSON.parse`
(see `remove-native-json.md`): a 6000-token dump could not be read back through
`parse` at all, and that proof now compares the serialized dump as text
instead.

### Proposal

Make the value-building fold force each completed container without adding
stack proportional to the sibling count. Two directions, in preference order:

1. **Accumulate containers in a form that doesn't nest lazily.** `addToArray`
   builds a `concat` spine purely to append; a reversed cons list built with an
   O(1) prepend and reversed once at `endArray`/`endObject` (the shape
   `fjs/types/rtti/parse` already uses for `eachEntry` — `consEntry` +
   `orderedEntries`) removes the chain the forcing walks. This keeps the parser
   a plain fold and is the smallest change.
2. **Make `next` iterative across `apply` layers.** The general fix, benefiting
   every `flat`/`map` pipeline rather than just this parser, but it is a change
   to `fjs/types/list`'s core traversal and wants its own measurement.

Prefer 1 unless 2 turns out to be needed for other consumers — per §5.1 the
generic improvement is the right long-term answer, but the parser's accumulator
is the actual defect here.

Whichever lands, the contract to establish is that `parse` **never panics on
input the tokenizer accepts**: any limit it cannot honor must come back as
`error`, not as a `throw`.

### Tasks

- [ ] Reproduce as a proof in `fjs/media/json/parser/proof.f.ts`: 6000 sibling
      `{}` and 6000 sibling `[]` both return `ok`, plus the 12000-primitive and
      5000-deep cases as the already-working baselines.
- [ ] Fix the accumulator (direction 1) and confirm the sibling count scales
      well past the old threshold.
- [ ] Check whether `fjs/djs`'s parser shares the accumulator shape and the bug.
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
