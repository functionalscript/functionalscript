## `entry` Answers the Value, `hasEntry` the Presence

**Priority:** P2
**Status:** wip — the design is approved by the language designer,
**sergey-shandar**, in the session that wrote this record
([approval](https://claude.ai/code/session_01L4xPteqjBToqCN3aycb8Su),
"Do it, I approve"); the tasks below are in progress

### Decision

The read of a property named at run time is two helpers, not one option:

```js
const entry = (a, b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable ? x.value : undefined;
};
const hasEntry = (a, b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable === true;
};
```

`entry(a, b)` is the value of the enumerable own property `b` names of
`a`, and `undefined` where there is none; `hasEntry(a, b)` is whether there
is one, `true` for an entry holding `undefined`. Both convert the key as
`Object.getOwnPropertyDescriptor` converts it, both fail on a nullish `a`,
and both are recognized whole, under any three distinct names, as the
option helper was, each an EDAG node of its own, `['entry']` and
`['hasEntry']`, that every executor answers natively with nothing built.
Which values own what stays as [entries](../property-access/entries.md)
says: an object's field, an array's or a string's element, and nothing a
value owns without enumerating it, nothing of a function, a number, a
boolean or a `bigint`, and nothing a prototype would give.

This reverses [#3024](https://github.com/functionalscript/functionalscript/pull/3024),
which made `entry` answer the option `[value]` or `[]`, and restores the
value-answering body that record retired, beside the presence helper it
proposed first under the name `hasEntity`. The option stays available as
an ordinary function over the two, `hasEntry(a, b) ? [entry(a, b)] : []`,
for a caller that wants one.

### Why two helpers

The option was chosen for one scan per question: value, presence, or a
default that respects an entry holding `undefined`, each one call, where
the pair spends two scans on the third, `hasEntry(a, b) ? entry(a, b) : d`.
That argument held until the runtime's dispatcher was written in the
language ([runtime-members](../../fjs/js/todo/runtime-members.md),
[DESIGN.md §13](../../doc/DESIGN.md#13-one-source-of-truth-optimize-by-substitution)):

- **An allocation on every member call.** `dot` reads the receiver and
  then the member table, and with the option each read builds a
  one-element array to carry one bit. On NaNVM that is one or two heap
  objects before `a.map(f)` does anything, a cost the hand-written call
  step never paid, and on the hot path of every compiled module. With the
  pair the same `dot` allocates nothing:

  ```js
  dot: (self, key) => {
      if (hasEntry(self, key)) { return entry(self, key) }
      const body = entry(member, key)
      return body === undefined ? undefined : body(self)
  }
  ```

  A receiver that owns nothing under the key — every string, array,
  number, boolean, bigint and function under an admitted name — costs one
  scan; an object literal that owns it costs two; the table costs one,
  and `body === undefined` is exact because the table holds functions
  alone.
- **The shape is in the source, not in a rule.** A backend could print
  `entry(x, k).length === 1 ? entry(x, k)[0] : …` without the array, but
  that is a substitution keyed on a body's text, which §13 says is a sign
  the source should expose the shape instead. `hasEntry` is the shape.
- **The floor is simpler.** The core of the runtime may not use what it
  defines, and with the option it reads `[0]` of `entry`'s answer, a
  property read, to get at the value: the read had to be declared
  primitive to stop the regress. With the pair presence is a boolean and
  the value is the value; the read stays primitive for other reasons, but
  nothing in the core depends on it.

The price the pair pays:

- **Two scans where presence and value are both wanted**, on the
  receivers that own the key. Each scan is one lookup, a hash or a short
  walk, where the option's saving was one lookup against one allocation,
  and the allocation is the dearer of the two on every VM.
- **An own `undefined` is invisible to `entry` alone.** `entry({ x:
  undefined }, "x")` and `entry({}, "x")` are both `undefined`; a caller
  that cares asks `hasEntry`, as JavaScript's `in` and `Object.hasOwn`
  callers do. [undefined-property](./1010-undefined-property.md)'s
  distinction stays expressible, through the second helper.
- **Two recognized bodies, two nodes, two native answers** on each
  executor, where the option had one of each.
- **Breaking, again.** Every importer of the option is rewritten, and the
  option body is no longer the helper. Pre-1.0 this is allowed
  ([changelog](../../changelog/README.md)), and the importers are the
  runtime's `dot`, the interpreter's `entry` operation and the proofs
  #3024 moved.

### Tasks

- [x] `hasEntry` beside the option: the body recognized whole in the
      parser, the AST's and the EDAG's `['hasEntry']`, the interpreter's
      operation, the JavaScript output writing the helper back, the Rust
      printer and `Any::has_entry` in `nanvm-lib`, the corpus cases, and
      [entries](../property-access/entries.md) updated. Nothing breaks.
- [x] `entry` back to the value: the value-answering body recognized as
      the helper, the option body an ordinary function again, the
      interpreter's and NaNVM's `entry` answering the value, every
      importer of the option moved to the pair, the spec and the
      [compatibility record](../../todo/fjs-javascript-compatibility.md)
      updated.
- [ ] `dot` over the pair, as above, in
      [runtime-members](../../fjs/js/todo/runtime-members.md).

### Related

- [entries](../property-access/entries.md) — the spec this changes.
- [`in`](./2346-in-operator.md) — stays out; `hasEntry` is the presence
  question it would have asked, over the enumerable own property alone.
- [undefined-property](./1010-undefined-property.md) — the distinction
  `hasEntry` keeps.
