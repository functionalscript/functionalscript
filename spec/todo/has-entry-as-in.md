## Make `entry` and `hasEntry` answer as `.` and `in` do

**Priority:** P3
**Status:** open — proposed by the language designer in
[the working session](https://claude.ai/code/session_01Q2nX9tTC5wXtzE7LHJXgRs);
the approval record is the first task

### Problem

The language asks two questions of a value and a key, the value and the
presence, each in two spellings: a constant key, `a.k` and `"k" in a`, and
a computed one, `entry(a, k)` and `hasEntry(a, k)`
([reading an entry](../property-access/entries/README.md)). The computed
spellings do not answer as the constant ones do:

- `a.length` reads the `length` an array, a string and a function own
  without enumerating it ([property access](../property-access/README.md));
  `entry(a, "length")` is `undefined`, since the helper reads enumerable
  own properties alone.
- `"k" in a` throws for `null`, `undefined` and every primitive, as
  JavaScript's does; `hasEntry`, which is
  `Object.getOwnPropertyDescriptor(a, b)?.enumerable === true`, answers a
  string's index `true`, a number's, a boolean's or a bigint's key
  `false`, and throws only for `null` and `undefined`. And `"length" in []`
  is `true` where `hasEntry([], "length")` is `false`, which is why the
  parser refuses `length` as the key of `in` where a read allows it.

Those gaps are why the operator has an implementation of its own.
[The `in` record](./2346-in-operator.md) gave it a body in the runtime,
`runtime.in`, a receiver check and then `hasEntry`, which every executor
calls through the runtime value; a native answer for the node would be a
substitution rule beside the native `hasEntry` every executor already has,
`Any::has_entry` in nanvm-lib and `hasEntryCall` in the interpreter — two
natives, a body and a rule, for one question.

### Proposal

The helpers answer as the operators do, so that each is the other's
computed-key spelling and nothing else:

- `entry(a, b)` is the value `a[k]` reads for the key: an enumerable own
  property of `a`, or its `length`; `undefined` where there is none, of a
  primitive too, as `true.x` is; a throw for `null` and `undefined`, as
  the read is.
- `hasEntry(a, b)` is the answer `"k" in a` gives: `true` for an
  enumerable own entry of an object, an array or a function, one holding
  `undefined` included, and for their `length`; `false` for an absent one;
  a throw for `null`, `undefined` and every primitive, a string's index
  among them.

Then the operator *is* the helper: the EDAG's `['in', key, exp]` is
answered as `['()', ['hasEntry'], [exp, key]]` is, one implementation per
executor, the one it has for `hasEntry`; `runtime.in` goes, and the
runtime is `static` and `dot` again; the Rust writer prints the node as
`Any::has_entry`, and no substitution rule is needed, since nothing is
left to substitute. And the key rule of `in` is the read's: `length` is a
key of `in` as it is of a read, `"length" in []` being `true` as
JavaScript has it, so the one exception the parser makes for the operator
goes.

What stays FunctionalScript's: a name a built-in prototype gives a value
is refused as a constant key of either form, and the computed forms answer
it as they do today, from the value's own properties; a function's `name`
is no observation of a program ([principles](../principles/README.md)),
so `entry(f, "name")` stays `undefined`.

The helpers are recognized whole from their bodies, so the bodies change
to ones JavaScript runs the same way, and the two languages agree by
construction:

```js
const entry = (a, b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x !== undefined && (x.enumerable || b === "length") ? x.value : undefined;
};
const hasEntry = (a, b) => {
    if (a === null || typeof a !== "object" && typeof a !== "function") { throw "hasEntry: not an object"; }
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x !== undefined && (x.enumerable === true || b === "length");
};
```

An alternative for `hasEntry`, with the operator itself making the
receiver check, which the compiler may admit inside this one recognized
pattern as it admits the bracketed `__proto__` key
([principles](../principles/README.md)): `b in a && …`. Shorter, and it
names the operator it mirrors, at the price of a computed `in` the parser
otherwise refuses. One to choose.

### What it costs

- **A breaking change to both helpers.** `hasEntry("abc", "0")` was `true`
  and throws; `hasEntry(1, "x")` was `false` and throws;
  `entry([], "length")` and `hasEntry([], "length")` were `undefined` and
  `false` and are `0` and `true`. Every caller that hands a primitive, or
  asks for `length`, changes: `runtime.dot` asks `hasEntry(self, key)` of
  every receiver, a string's index included, so the dispatcher needs a
  branch for a primitive receiver — `entry` alone serves a string, whose
  entry never holds `undefined` — and `dot(a, "length")` now finds the
  number `length` as an own property, which it calls and which throws, as
  JavaScript's `[].length()` does; the rest of the tree is audited.
- **One spelling each, in several places.** The bodies in
  `fjs/types/object/entry`, the compiler's recognizers of them, their
  function texts (`_entryText`, `_hasEntryText`), `entryCall` and
  `hasEntryCall` in `fjs/edag/operations`, `Any::entry` and
  `Any::has_entry` in nanvm-lib, and the entries page, each saying the
  same thing.
- **The texts of the helpers change**, which `String(entry)` shows, under
  the function-text exception the principles state.

### Tasks

- [ ] The [§12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
      approval record, as [the `in` record](./2346-in-operator.md) carries
      its own.
- [ ] Choose `hasEntry`'s spelling, above.
- [ ] `fjs/types/object/entry`: the new bodies and their proofs against the
      host's `.` and `in`; the recognizers and function texts in
      `fjs/compiler`; `entryCall` and `hasEntryCall`; `Any::entry` and
      `Any::has_entry`; the corpus's `in` groups in `fjs/nanvm` double as
      `hasEntry`'s, and gain `length`.
- [ ] Audit every `entry` and `hasEntry` caller for a primitive receiver or
      a `length` key; `runtime.dot`'s branch for a primitive receiver.
- [ ] The `in` node answered as a `hasEntry` call in the interpreters and
      the Rust writer; `runtime.in` removed, the runtime's README, type
      pins and the nanvm-lib comments back to two functions.
- [ ] The parser: `length` admitted as the key of `in`, the key rule the
      read's; the proofs that pin `"length" in []` refused pin it `true`.
- [ ] The specification: [reading an entry](../property-access/entries/README.md),
      [`in`](../operators/in/README.md) and its `length` paragraph, and the
      `in` record's paragraph on the body.

### Related

- [The `in` record](./2346-in-operator.md) — the operator, whose body this replaces with the helper's.
- [Reading an entry at run time](../property-access/entries/README.md) — the pair and why there are two.
- [Property access](../property-access/README.md) — the read `entry` mirrors, `length` included.
- [DESIGN.md §13](../../doc/DESIGN.md#13-one-source-of-truth-optimize-by-substitution) — one source of truth; with one implementation there is nothing to substitute.
