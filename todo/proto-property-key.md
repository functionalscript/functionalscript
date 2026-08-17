## `__proto__` as a property key

**Priority:** P2
**Status:** open

### Problem

JavaScript gives three spellings of a `__proto__` key in an object
literal two different meanings:

```js
{ __proto__: v }      // sets [[Prototype]]; no own property
{ "__proto__": v }    // sets [[Prototype]]; no own property
{ ["__proto__"]: v }  // ordinary own data property named "__proto__"
```

Only the computed form creates a property. Verified with node: the first
two yield `Object.keys(o) === []` with the prototype replaced; the third
yields `["__proto__"]` with the prototype untouched.

**This is where "JSON is a subset of FunctionalScript"
([spec/README.md](../spec/README.md)) breaks.** `JSON.parse` has no
prototype special case — `JSON.parse('{"__proto__":{"z":1}}')` produces
an own property — so one text means a data property as JSON and a
prototype assignment as a FunctionalScript module. Every other JSON
document means the same thing in both languages; this one does not.

**The module emitter writes the unsafe form today**, so it does not
round-trip its own output:

```js
const o = {}
Object.defineProperty(o, '__proto__',
    { value: 3, enumerable: true, writable: true, configurable: true })
stringify(sort)(o)         // 'export default {"__proto__":3}'
```

The **JSON** emitter is correct as it stands —
`stringifyAsTree(sort)(o)` gives `{"__proto__":3}`, which `JSON.parse`
reads back as an own property. The two formats need different spellings;
see
[fjs/djs/todo/proto-key-handling](../fjs/djs/todo/proto-key-handling.md).

Evaluating that text gives an object with **no** properties: the value
is silently lost. With an object value it is worse — the prototype is
replaced instead, so the result is a different value, not merely a
lossy one.

### Proposal

**Parsing.** `{ __proto__: … }` and `{ "__proto__": … }` are not valid
FunctionalScript: reject them as compilation errors. FunctionalScript plans to have no prototype chains at run time
([property-accessor](../spec/todo/2330-property-accessor.md)), so a spelling
whose only meaning is "assign a prototype" has no meaning to give;
rejecting it is the whitelist principle, not a special case. Accept
`{ ["__proto__"]: … }`, which denotes an ordinary property.

**Serializing.** In **FunctionalScript output**, emit `["__proto__"]:`
for that key: it is the only spelling whose evaluation reproduces the
value, so it is required for round-tripping, not a stylistic choice. In
**JSON output** the plain `"__proto__":` key stays — the computed form
is not valid JSON, and JSON already round-trips. The two emitters
diverge here on purpose.

Note that `2330`'s prohibition on *reading* `__proto__`
([property-accessor](../spec/todo/2330-property-accessor.md)) is a
separate rule and stays: a value may carry a `__proto__` property that
FunctionalScript code cannot read with `o.__proto__`. Reaching it needs
`Object.getOwnPropertyDescriptor(o, k)?.value` — the `["own", …]`
operation of the [EDAG](./edag-stage1-discussion.md).

### Consequence: JSON is a subset of FunctionalScript *except here*

JSON keeps its own meaning — `"__proto__"` is an ordinary data key in a
JSON document, and the JSON reader must go on accepting it. So a JSON
document containing a `__proto__` key is **not** a valid FunctionalScript
module, and [spec/README.md](../spec/README.md)'s "JSON is a subset of
FunctionalScript" needs this one documented exception.

The alternative would be for FunctionalScript to accept the spelling and
read it as a data property — but that makes FS source mean something
different from what a JavaScript engine gives it, breaking FS principle 2.
A narrow, stated exception to the subset claim is the cheaper price.

### Dependency

Accepting `{ ["__proto__"]: … }` requires **computed property keys** in
object literals, which the language does not have yet:
[spec/README.md](../spec/README.md) says a key is a string literal or an
identifier. The minimum needed here is the constant-string computed key;
the general form is a separate question. The pattern already appears in
[function](../spec/todo/3110-function.md)'s function-naming sketch
(`{[name]: () => 0}[name]`), so it is wanted independently.

Until computed keys exist, `__proto__` is simply not expressible as a
key — which is still an improvement on expressing it *wrongly*.

### Tasks

- [ ] Parser: reject the identifier and string-literal spellings.
- [ ] Computed property keys with a constant string key.
- [ ] Serializer: emit `["__proto__"]:` for that key in
      FunctionalScript output only, with a round-trip test — note both
      formats share one key serializer today, so the change is
      per-emitter
      ([fjs/djs/todo/proto-key-handling](../fjs/djs/todo/proto-key-handling.md)).
- [ ] Round-trip proof: serialize → evaluate → structurally equal, over
      a corpus that includes `__proto__` keys.
- [ ] Spec: document the rule when the parser implements it
      ([2410-identifier-property](../spec/2410-identifier-property.md)
      is the neighbouring document).

### Related

- [fjs/djs/todo/proto-key-handling](../fjs/djs/todo/proto-key-handling.md)
  — the state of the current FJS compiler and what to change in it.
- [edag-stage1-discussion](./edag-stage1-discussion.md) — subject 4
  (object constructor keys) and subject 12 (`toString(f)` must print the
  computed form for the same reason).
