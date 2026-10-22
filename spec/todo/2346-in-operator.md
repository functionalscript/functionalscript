## The `in` Operator Stays Out

**Priority:** P3
**Status:** open — approval of the language designer pending

### Decision

FunctionalScript does not have the `in` operator, and will not have it. The
text `"a" in o` is a compilation error, as it is today. This is a refusal **by
design**, not a gap waiting for work
([design principles §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
asks a refusal to say which of the two it is). The same word in `for (k in o)`
is a different grammar, a statement the language does not have yet (see the
[roadmap](./README.md)), and this record does not decide it.

[Reading an entry](../property-access/entries/README.md) holds this boundary for
`Object.hasOwn`; this record gives `in` the reasons it stated only in
passing. The way to ask whether an object has an entry is the `hasEntry`
helper beside `entry`, not a spelling of `in`: `hasEntry(o, k)` is the
question.

### What `in` answers in JavaScript

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

### Why FunctionalScript does not want it

**1. Only one way to implement it breaks the language's first rule; the other
two are compatible and not worth their cost.** Successful FunctionalScript and
JavaScript executions have the same observable result
([principles](../principles/README.md)), and a text JavaScript gives a meaning
FunctionalScript cannot reproduce "is a compilation error, not an invitation to
give it a second, more convenient meaning." There are three ways to implement
`in`:

- *Answer for own entries only.* This breaks the rule. `"toString" in {}` is
  `false` where JavaScript says `true`, and `"length" in []` is `false` where
  JavaScript says `true`. The same accepted text gets a different successful
  result, which is exactly what the rule forbids.
- *Answer as JavaScript does, with a prototype chain.* This is compatible, at
  the price of the chain, so that `"toString" in {}` can be `true`. It is
  rejected because the language was built without one: "FunctionalScript has no prototype chains"
  ([specification](../property-access/README.md)), and a name a prototype would
  give a value reads as absent, as the [`entry` helper](../property-access/entries/README.md)
  states. A chain that exists only to answer `in` is the whole feature
  smuggled back for one operator, and every VM would have to carry it.
- *Answer by receiver-type dispatch.* This is compatible, within the
  execution profile the principles require a language to declare. The language
  already knows, per receiver type, the names a built-in prototype gives
  ([`fjs/js/prototype`](../../fjs/js/prototype/module.f.js), fixed to
  ECMAScript 2025), and VMs dispatch inherited method calls on the receiver's
  type, so `in` could be "an own entry, or a name in that type's inventory"
  with no chain stored. For the closed value set this reproduces every row of
  the table above. It is rejected on design grounds, not for a compatibility
  failure:
  - *It reopens what the language closed.* Reading such a name is a
    compilation error, `o.toString` and `o["toString"]` alike, because
    "JavaScript would find a function there and this language nothing, and a
    module must mean one thing in both"
    ([property access](../property-access/README.md)). `in` would answer the
    same question about the same name as data, `true` for `"toString"` and
    `"push"` where the read of that name is refused, and the dynamic key
    `k in o` cannot be refused at compile time as the literal read can.
  - *Its agreement is the declared profile's, and only that.* A name a newer
    or older engine owns differs from the inventory, so `"toSorted" in []`
    would be `false` on an engine that predates it. That is a profile-bound
    exception, which the principles permit and treat as the exception, and
    it would be a new one on an operator that has none.
  - *It buys nothing a program should want.* The names an inventory adds are
    exactly the ones a program has no reason to test (`"toString" in o`);
    the legitimate question, an entry the program put there, is answered by
    `hasEntry`, so the machinery would exist to answer only the
    questions better left unasked.

So the own-entries answer is refused because it breaks the rule. The chain and
the dispatch design keep it, and are refused because the language would pay
for them, with a chain it was built without or with a read rule it would
reopen, for a construct whose only new answers are ones a program should not
ask. The operator is refused rather than approximated.

**2. It does not match any pattern the language whitelists.** The language is a
whitelist of *complete semantic patterns*, not of operations in isolation
([principles](../principles/README.md)). The question programs actually ask is
"does this object hold an enumerable data entry under this key?", and that has
a pattern: the `hasEntry` helper beside `entry`, spelled with JavaScript's
own names ([reading an entry](../property-access/entries/README.md)). `in` asks something wider and different
(the chain, non-enumerable names, anything `Object.prototype` defines), so no
pattern lowers to it without changing what it means.

**3. A restriction must name the mistake it prevents.**
[Design principles §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
admits a restriction only for a concrete benefit: a guarantee it protects or a
mistake it prevents. The guarantee is rule 1 above, which every
implementation short of a prototype chain or an edition-bound inventory
breaks. The mistakes are the ones
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
([design principles](../design/design-principles.md),
[§1](../../doc/DESIGN.md#1-simplicity-first)). Presence and reads have one
spelling each, the `hasEntry` and `entry` helpers, which need no chain, no
`TypeError` branch and no second meaning. Adding `in` would give the same
question two spellings with different answers.

### Alternatives rejected

| Alternative | Why not |
|---|---|
| `in` as "own enumerable entry" | Same text, different successful result than JavaScript (rule 1 above) |
| `in` with a built-in `Object.prototype` | Reintroduces the prototype chain and makes names like `toString` observable |
| `in` by receiver-type dispatch (own entry, or a name in the type's prototype inventory) | Compatible within the declared ECMAScript 2025 profile, but it answers as data a name whose read the language refuses, and it buys no question worth asking |
| `in` recognized only inside a larger pattern | No useful pattern contains it; the `entry` helper is the pattern |
| Defer silently | A refusal that does not say whether it is permanent reads as an open task (§10) |

### Consequences

- The compiler keeps refusing `in`; it needs no new code, and no EDAG node,
  `nanvm-lib` operator or Rust printing for it. The `in` row of
  [`nanvm/lib/README.md`](../../nanvm/lib/README.md#js-operator-implementation-status)
  is not a pending task.
- Migration is case by case, because `in` has no single replacement. Where
  the code meant "this object has an enumerable entry `k`", which is how
  most uses read, the replacement is `hasEntry(o, k)`, which is
  `true` for an entry holding `undefined` as `in` is. Where the code relied on
  inherited or non-enumerable names (`"toString" in o`, `"length" in a`),
  neither replacement is equivalent, and it needs a rewrite that states what
  it really wants to know.
- The word `in` stays reserved ([lexical grammar](../lexical/identifiers/README.md)).

### When to revisit

Only if the language gains a prototype chain, if the rule that a prototype
name is refused as the key of a read is itself changed, or if the principles'
first rule is. None is planned. Receiver-type dispatch alone does not reopen
this: it is compatible, but rejected for reopening the read rule and for the
questions it adds.

### Tasks

- [ ] Language-designer approval, recorded here with a link
      ([design principles §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)).
      This record states the decision the language already implements; the
      approval confirms it and its reasons.
- [x] A proof that `a in b` and `for (k in o)` are refused at the compiler:
      `refusedByDesign` in
      [`operators.proof.f.mjs`](../../fjs/compiler/parser/operators.proof.f.mjs)
      pins the message and column of each, and that `in` stays a key.

### Related

- [Undefined-valued properties](./1010-undefined-property.md).
- [Reading an entry at run time](../property-access/entries/README.md).
- [Operators](../operators/README.md).
