## Make `hasEntry` answer as `in` does

**Priority:** P3
**Status:** open — proposed by the language designer in
[the working session](https://claude.ai/code/session_01Q2nX9tTC5wXtzE7LHJXgRs);
the approval record is the first task

### Problem

`"k" in o` and `hasEntry(o, "k")` ask one question, whether `o` owns an
enumerable entry under the key, and answer it alike on an object, an
array and a function. They part on a primitive: `in` throws for every
one, as JavaScript's does, where `hasEntry`, which is
`Object.getOwnPropertyDescriptor(a, b)?.enumerable === true`, answers a
string's index `true`, a number's, a boolean's or a bigint's key `false`,
and throws only for `null` and `undefined`.

That gap is why the operator has an implementation of its own.
[The `in` record](./2346-in-operator.md) gave it a body in the runtime,
`runtime.in`, a receiver check and then `hasEntry`, which every executor
calls through the runtime value; and a native answer for the node would be
a substitution rule beside the native `hasEntry` every executor already
has, `Any::has_entry` in nanvm-lib and `hasEntryCall` in the interpreter
— two natives, a body and a rule for one question.

### Proposal

`hasEntry` answers as `in` does: `true` for an enumerable own entry of an
object, an array or a function, one holding `undefined` included, `false`
for an absent one, and a throw for `null`, `undefined` and every
primitive, a string's index among them. Then the operator *is* the
helper: the EDAG's `['in', key, exp]` is answered as `['()', ['hasEntry'],
[exp, key]]` is, one implementation per executor, the one it has for
`hasEntry`; `runtime.in` goes, and the runtime is `static` and `dot`
again; the Rust writer prints the node as `Any::has_entry`, and no
substitution rule is needed, since nothing is left to substitute.

`entry` stays as it is. It mirrors the read: `o[k]` of a primitive is
`undefined`, and `"abc"[0]` is `"a"` where `"0" in "abc"` throws, in
JavaScript as here. So `entry` is to the read what `hasEntry` is to `in`,
and the pair keeps JavaScript's own asymmetry rather than inventing one.

The helper is recognized whole from its body, so its body changes to one
JavaScript runs the same way, and the two languages agree by construction.
Two spellings are on the table, one to choose:

```js
const hasEntry = (a, b) => {
    if (a === null || typeof a !== "object" && typeof a !== "function") { throw "hasEntry: not an object"; }
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable === true;
};
```

or, with the operator itself making the receiver check, which the
compiler may admit inside this one recognized pattern as it admits the
bracketed `__proto__` key ([principles](../principles/README.md)):

```js
const hasEntry = (a, b) => b in a && Object.getOwnPropertyDescriptor(a, b)?.enumerable === true;
```

The first is the body `runtime.in` has today, moved; the second is
shorter and names the operator it mirrors, at the price of a computed
`in` the parser otherwise refuses.

### What it costs

- **A breaking change to the helper.** `hasEntry("abc", "0")` was `true`
  and throws; `hasEntry(1, "x")` was `false` and throws. Every caller that
  hands it a primitive changes: `runtime.dot` asks `hasEntry(self, key)`
  of every receiver, a string's index included, so the dispatcher needs a
  branch for a primitive receiver — `entry` alone serves a string, whose
  entry never holds `undefined` — and the rest of the tree is audited.
- **One spelling, in several places.** The helper's body in
  `fjs/types/object/entry`, the compiler's recognizer of it, its function
  text (`_hasEntryText`), `hasEntryCall` in `fjs/edag/operations`,
  `Any::has_entry` in nanvm-lib, and the entries page, each saying the
  same thing.
- **The text of the helper changes**, which `String(hasEntry)` shows, under
  the function-text exception the principles state.

### Tasks

- [ ] The [§12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
      approval record, as [the `in` record](./2346-in-operator.md) carries
      its own.
- [ ] Choose the helper's spelling, above.
- [ ] `fjs/types/object/entry`: the new body and its proof against the
      host's `in`; the recognizer and function text in `fjs/compiler`;
      `hasEntryCall`; `Any::has_entry`; the corpus's `in` groups in
      `fjs/nanvm` double as the helper's.
- [ ] Audit every `hasEntry` caller for a primitive receiver;
      `runtime.dot`'s branch for one.
- [ ] The `in` node answered as a `hasEntry` call in the interpreters and
      the Rust writer; `runtime.in` removed, the runtime's README, type
      pins and the nanvm-lib comments back to two functions.
- [ ] The specification: [reading an entry](../property-access/entries/README.md),
      [`in`](../operators/in/README.md), and the `in` record's paragraph on
      the body.

### Related

- [The `in` record](./2346-in-operator.md) — the operator, whose body this replaces with the helper's.
- [Reading an entry at run time](../property-access/entries/README.md) — the pair and why there are two.
- [DESIGN.md §13](../../doc/DESIGN.md#13-one-source-of-truth-optimize-by-substitution) — one source of truth; with one implementation there is nothing to substitute.
