## Bug: the FJS compiler mishandles `__proto__` keys

**Priority:** P2
**Status:** open
**Blocked by:** computed property keys — see
[proto-property-key](./proto-property-key.md)

The rule and its rationale are in
[proto-property-key](./proto-property-key.md); this issue is the state
of the current implementation and what to change in it.

### Part 1 — serializing (emitting)

**The DJS serializer emits the prototype-assigning spelling**, so it
does not round-trip its own output:

```js
import { stringifyAsTree } from './fjs/djs/serializer/module.f.mjs'
import { sort } from './fjs/types/object/module.f.mjs'

const o = {}
Object.defineProperty(o, '__proto__',
    { value: 3, enumerable: true, writable: true, configurable: true })

stringifyAsTree(sort)(o)          // '{"__proto__":3}'
eval('({"__proto__":3})')         // {} — the property is gone
```

With an object value the failure is worse than lossy: the emitted text
replaces the prototype, producing a different value rather than an
incomplete one.

**Cause.** `propertySerialize` in
[`fjs/djs/serializer/module.f.mjs`](../fjs/djs/serializer/module.f.mjs)
builds a key with `stringSerialize` + `colon` borrowed from
[`fjs/media/json/serializer/module.f.mjs`](../fjs/media/json/serializer/module.f.mjs).
That is correct for JSON and wrong for JavaScript — the two languages
disagree about this one key.

**Scope — the JSON serializer is correct and must not change.**
`JSON.parse('{"__proto__":3}')` yields an own property, so JSON already
round-trips; `["__proto__"]:` is not even valid JSON. Only the DJS
emitter (the `.f.js` module path, `stringify` / `stringifyAsTree` via
[`fjs/djs/module.f.mjs`](../fjs/djs/module.f.mjs)) needs the computed
spelling. Fixing this in the shared JSON helper would break JSON output.

- [ ] `propertySerialize` in the **DJS** serializer emits
      `["__proto__"]:` for that key and `"k":` for every other.
- [ ] Round-trip proof: serialize → evaluate → structurally equal, with
      `__proto__` in the corpus, both as a primitive and as an object
      value.
- [ ] Leave the JSON serializer alone; add a test asserting JSON output
      keeps `"__proto__":`, so a later refactor cannot "unify" the two.

### Part 2 — parsing

`{ __proto__: v }` and `{ "__proto__": v }` are **not valid
FunctionalScript** ([proto-property-key](./proto-property-key.md)), so
accepting them is the bug — independently of what the parser then does
with them. `parseObjectStartOp` in
[`fjs/djs/parser/module.f.mjs`](../fjs/djs/parser/module.f.mjs) takes a
key from either a `string` or an `id` token (the identifier-property
path, `#2410`) and hands it to `pushKey` unchecked, so both spellings
are accepted and treated as ordinary keys.

**Scope — JSON input is a different reader and stays as it is.** In a
JSON document `"__proto__"` *is* an ordinary data key, and
[`fjs/media/json/parser`](../fjs/media/json/parser) is a separate module
from the DJS parser used by the transpiler, so the rejection lands on
the FunctionalScript side only. This is the one place where a JSON
document is not also a valid FunctionalScript module — see the
subset-exception note in
[proto-property-key](./proto-property-key.md).

- [ ] Reject the `id` spelling `{ __proto__: … }` with a compilation
      error.
- [ ] Reject the string spelling `{ "__proto__": … }` likewise.
- [ ] Accept `{ ["__proto__"]: … }` — needs computed property keys,
      which the language does not have yet, hence the **Blocked by**
      above. The two rejections are not blocked and can land first.
- [ ] Parser proof covering all three spellings.

### Conformance tests

Three fixtures, covering both halves and the subset exception.

**`proto.json`** — JSON input, where the key is an ordinary data key:

```json
{"__proto__":{"a":42}}
```

```sh
fjs compile proto.json protoOutput.js   # succeeds
```

**`protoBad.js`** — the string spelling, which is not valid
FunctionalScript:

```js
export default {"__proto__":{"a":42}}
```

```sh
fjs compile protoBad.js protoOutput.js  # must fail to compile
```

The identifier spelling `export default {__proto__:{"a":42}}` is the
same case and must fail the same way.

**`protoGood.js`** — the computed spelling, the only valid one:

```js
export default {["__proto__"]:{"a":42}}
```

```sh
fjs compile protoGood.js protoOutput.js  # succeeds
```

**The assertions:**

- `proto.json` and `protoGood.js` compile to **the same output** — this
  is the whole point of the pair: a JSON document and the valid
  FunctionalScript spelling denote the same value, and the emitter has
  exactly one spelling for it.
- that output uses `["__proto__"]:`, never `"__proto__":`.
- `protoBad.js` fails to compile — a diagnostic, not silent acceptance.
- semantic check behind the textual one: evaluating the output yields an
  object whose own `__proto__` property is `{a: 42}` and whose prototype
  is unchanged. The textual assertion alone would pass for a spelling
  that happens to look right; this one states the property being tested.

**The reverse direction — FunctionalScript in, JSON out:**

```sh
fjs compile protoGood.js out.json   # succeeds
```

`out.json` must be exactly `{"__proto__":{"a":42}}` — plain JSON, with
**no `["__proto__"]:` artifact**. The computed spelling is a JavaScript
form; emitting it into a `.json` file would produce something no JSON
parser accepts. So the two emitters diverge on purpose, and this test
pins that: the JS emitter must use the computed spelling, the JSON
emitter must not.

Together the two directions close the loop:
`proto.json → protoOutput.js → out.json` returns the original document
byte for byte, with each hop using its own language's spelling.

### Why both halves matter

Until part 1 lands, the compiler can produce a module whose meaning
differs from the value it was given. Until part 2 lands, it can accept a
module whose meaning differs from what JavaScript gives it. Each half is
a soundness gap on its own side of the pipeline.
