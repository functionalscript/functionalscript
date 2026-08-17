## Bug: the FJS compiler mishandles `__proto__` keys

**Priority:** P2
**Status:** open

The rule and its rationale are in
[proto-property-key](../../../todo/proto-property-key.md); this issue is the state
of the current implementation and what to change in it.

### Part 1 — serializing (emitting)

**The DJS serializer emits the prototype-assigning spelling**, so it
does not round-trip its own output:

```js
import { stringify } from './fjs/djs/serializer/module.f.mjs'
import { sort } from './fjs/types/object/module.f.mjs'

const o = {}
Object.defineProperty(o, '__proto__',
    { value: 3, enumerable: true, writable: true, configurable: true })

stringify(sort)(o)                // 'export default {"__proto__":3}'
eval('({"__proto__":3})')         // {} — the property is gone
```

With an object value the failure is worse than lossy: the emitted text
replaces the prototype, producing a different value rather than an
incomplete one.

**Cause, and why the fix cannot go where it looks like it should.**
`propertySerialize` inside `buildSerialize`
([`serializer/module.f.mjs`](../serializer/module.f.mjs)) builds every
key with `stringSerialize` + `colon` borrowed from
[`media/json/serializer`](../../media/json/serializer/module.f.mjs).
That is right for JSON and wrong for JavaScript — the two languages
disagree about this one key — but **both output formats share that one
helper**:

```js
// fjs/djs/module.f.mjs
outputFileName.endsWith('.json')
    ? stringifyAsTree(sort)(result[1])   // JSON output
    : stringify(sort)(result[1])         // .f.js module output
```

`stringifyAsTree` is the **`.json`** path and `stringify` the **module**
path, and both reach the same `propertySerialize` through
`serializeWithoutConst` and `serializeWithConst`. So patching
`propertySerialize` would emit `["__proto__"]:` into `.json` files,
which no JSON parser accepts.

**The JSON output is already correct and must stay.**
`JSON.parse('{"__proto__":3}')` yields an own property, so JSON
round-trips today.

- [ ] Parameterize key serialization per output format — the module
      emitter uses `["__proto__"]:` for that key, the JSON emitter keeps
      `"__proto__":` — rather than changing the shared helper.
- [ ] Round-trip proof for the module path: serialize → evaluate →
      structurally equal, with `__proto__` in the corpus, both as a
      primitive and as an object value.
- [ ] Test asserting JSON output keeps `"__proto__":`, so a later
      refactor cannot "unify" the two paths and reintroduce this.

### Part 2 — parsing

`{ __proto__: v }` and `{ "__proto__": v }` are **not valid
FunctionalScript** ([proto-property-key](../../../todo/proto-property-key.md)), so
accepting them is the bug — independently of what the parser then does
with them. `parseObjectStartOp` in
[`fjs/djs/parser/module.f.mjs`](../parser/module.f.mjs) takes a
key from either a `string` or an `id` token (the identifier-property
path, [2410-identifier-property](../../../spec/2410-identifier-property.md)) and hands it to `pushKey` unchecked, so both spellings
are accepted and treated as ordinary keys.

**Scope — JSON input is a different reader and stays as it is.** In a
JSON document `"__proto__"` *is* an ordinary data key, and
[`fjs/media/json/parser`](../../media/json/parser) is a separate module
from the DJS parser used by the transpiler, so the rejection lands on
the FunctionalScript side only. This is the one place where a JSON
document is not also a valid FunctionalScript module — see the
subset-exception note in
[proto-property-key](../../../todo/proto-property-key.md).

- [ ] Reject the `id` spelling `{ __proto__: … }` with a compilation
      error.
- [ ] Reject the string spelling `{ "__proto__": … }` likewise.
- [ ] Accept `{ ["__proto__"]: … }` — the only blocked task here: it
      needs computed property keys, which the language does not have yet
      ([proto-property-key](../../../todo/proto-property-key.md)). The two
      rejections above are not blocked and can land first.
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
