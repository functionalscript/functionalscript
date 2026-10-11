# The `in` Operator Stays Out

**Priority:** P3
**Status:** open — approval of the language designer pending

## Decision

FunctionalScript does not have the `in` operator, and will not have it. The
text `"a" in o` is a compilation error, as it is today. This is a refusal **by
design**, not a gap waiting for work
([design principles §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
asks a refusal to say which of the two it is). The same word in `for (k in o)`
is a different grammar, a statement the language does not have yet (see the
[roadmap](./README.md)), and this record does not decide it.

[Enumerable property presence](./2345-has-own-property.md) already holds this
boundary for `Object.hasOwn`; this record gives `in` the reasons it stated only
in passing. The way to ask whether an object has an entry is the explicit
`hasEntity` pattern proposed there, not a spelling of `in`. That pattern is a
proposal: the compiler recognizes only the `entry` helper today, so presence
has no admitted spelling until 2345's tasks land.

## What `in` answers in JavaScript

`k in o` is `true` when `o` has a property `k` **anywhere on its prototype
chain**, enumerable or not:

```js
"toString" in {};            // true: Object.prototype has it
"__proto__" in {};           // true
"length" in [];              // true: an array owns it, without enumerating it
"x" in { x: undefined };     // true: the entry is there, holding undefined
2 in [1, 2];                 // false: a number is an index, not a value
"a" in "str";                // TypeError: the right side must be an object
"a" in null;                 // TypeError
```

## Why FunctionalScript does not want it

**1. It cannot keep the language's first rule.** Successful FunctionalScript
and JavaScript executions have the same observable result
([principles](../README.md#principles)), and a text JavaScript gives a meaning
FunctionalScript cannot reproduce "is a compilation error, not an invitation to
give it a second, more convenient meaning." There are two ways to implement
`in`, and each breaks something:

- *Answer for own entries only.* Then `"toString" in {}` is `false` where
  JavaScript says `true`, and `"length" in []` is `false` where JavaScript
  says `true`. The same accepted text gets a different successful result, which
  is exactly what the rule forbids.
- *Answer as JavaScript does.* Then the language needs the prototype chain, so
  that `"toString" in {}` can be `true`. The language was built without one:
  "FunctionalScript has no prototype chains"
  ([specification](../README.md#property-access)), and a name a prototype would
  give a value reads as absent, as the [`entry` helper](../README.md#reading-an-entry-at-run-time)
  states. A chain that exists only to answer `in` is the whole feature
  smuggled back for one operator, and every VM would have to carry it.

No third meaning is both useful and honest. So the operator is refused rather
than approximated.

**2. It does not match any pattern the language whitelists.** The language is a
whitelist of *complete semantic patterns*, not of operations in isolation
([principles](../README.md#principles)). The question programs actually ask is
"does this object hold an enumerable data entry under this key?", and that has
a pattern: `Object.getOwnPropertyDescriptor(a, b)?.enumerable`, spelled with
JavaScript's own names, answering `true`, `false` or `undefined`
([2345](./2345-has-own-property.md)). `in` asks something wider and different
(the chain, non-enumerable names, anything `Object.prototype` defines), so no
pattern lowers to it without changing what it means.

**3. A restriction must name the mistake it prevents.**
[Design principles §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
admits a restriction only for a concrete benefit: a guarantee it protects or a
mistake it prevents. The guarantee is rule 1 above. The mistakes are the ones
the table above shows: `in` on an array tests indices, not elements, so
`2 in [1, 2]` is `false`; it throws on a string or `null` where a reader
expects a boolean; it answers `true` for every object and `"toString"`; and
`{ x: undefined }` and `{}` differ under it, which is exactly the distinction
[undefined-valued properties](./1010-undefined-property.md) keeps
visible rather than hiding. A construct with this many surprises that the
language cannot make safe by changing its meaning is not a "harmless JavaScript
convention".

**4. Simplicity and one way to do it.** The language prefers simplicity and
safety to ease of use
([design principles](./design-principles.md),
[§1](../../doc/DESIGN.md#1-simplicity-first)). Presence will have one spelling
(`hasEntity`, once admitted), reads have one (`entry`), and neither needs a chain, a
`TypeError` branch or a second meaning. Adding `in` would give the same
question two spellings with different answers.

## Alternatives rejected

| Alternative | Why not |
|---|---|
| `in` as "own enumerable entry" | Same text, different successful result than JavaScript (rule 1 above) |
| `in` with a built-in `Object.prototype` | Reintroduces the prototype chain and makes names like `toString` observable |
| `in` recognized only inside a larger pattern | No useful pattern contains it; the proposed `hasEntity` is the pattern |
| Defer silently | A refusal that does not say whether it is permanent reads as an open task (§10) |

## Consequences

- The compiler keeps refusing `in`; it needs no new code, and no EDAG node,
  `nanvm-lib` operator or Rust printing for it. The `in` row of
  [`nanvm/lib/README.md`](../../nanvm/lib/README.md#js-operator-implementation-status)
  is not a pending task.
- Migration is case by case, because `in` has no single replacement. Where
  the code meant "this object has an enumerable entry `k`", which is how
  most uses read, the replacement is `hasEntity(o, k)` once it is admitted,
  and `entry(o, k) !== undefined` now. They differ: `hasEntity` answers
  `true` for an entry holding `undefined` and `undefined` (not `false`) for an
  absent key, so a boolean needs `=== true`, while `entry(...) !== undefined`
  is `false` for an entry holding `undefined`. Where the code relied on
  inherited or non-enumerable names (`"toString" in o`, `"length" in a`),
  neither replacement is equivalent, and it needs a rewrite that states what
  it really wants to know.
- The word `in` stays reserved ([lexical grammar](../README.md#identifiers)).

## When to revisit

Only if the language gains a prototype chain, or the principles' first rule
is itself changed. Neither is planned.

## Tasks

- [ ] Language-designer approval, recorded here with a link
      ([design principles §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)).
      This record states the decision the language already implements; the
      approval confirms it and its reasons.
- [ ] A proof that `a in b` and `for (k in o)` are refused at the compiler, if
      none exists.

## Related

- [Enumerable property presence](./2345-has-own-property.md) — `hasEntity`.
- [Undefined-valued properties](./1010-undefined-property.md).
- [Reading an entry at run time](../README.md#reading-an-entry-at-run-time).
- [Operators](./2340-operators.md).
