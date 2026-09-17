# Global Names

A name ECMAScript defines globally is never a module's to bind.

## Problem

FunctionalScript has no free names: every name in a module comes from a
`const` or an import, and a name nothing binds is `const not found`. So
`Object` denotes nothing today —

```js
export default Object;          // const not found
export default Object.entries;  // const not found
const Object = 1;               // accepted: an ordinary name, shadowing nothing
const Math = { PI: 3 };         // accepted
const globalThis = 1;           // accepted
```

— and a module may bind any of them. Four are already refused, for two
different reasons, and neither is that the word is a keyword: ECMAScript has
no keyword among them.

- `eval` is refused because **JavaScript** refuses it: binding it in strict
  code is an early error, so `const eval = 1;` is a `SyntaxError` in any
  module, and the subset inherits that. `arguments` goes with it; the
  repository's [`restrictedNames`](../../fjs/js/keywords/module.f.mjs) is
  that pair.
- `undefined`, `NaN` and `Infinity` are refused because
  **FunctionalScript** chose to, keeping them as words "so that each name
  denotes its value wherever it appears"
  ([`literalGlobals`](../../fjs/js/keywords/module.f.mjs)). That is stricter
  than JavaScript, where `const undefined = 1;` in a module is legal.

The repository's `keywords` list holds all four, which is why each answers
`reserved word` today — that list is "every name FunctionalScript treats as
a keyword", broader than ECMAScript's reserved words on purpose. This
document adds the rest of the globals to it.

`arguments` and `this` are refused as names too, and are not on this list:
neither is a property of the global object — `arguments` is a function's own
binding and `this` an expression — so neither is a global name, however
alike the refusals look. They are already refused as bindings *and* as
references, which is where they differ from the names here: `Object` must
stay referenceable in the head of an access, or `Object.entries()` can never
land.

Two things make the rest worth the same treatment.

**Reading.** `const Math = { PI: 3 }; export default Math.PI;` is a module a
reader has to hold two meanings of `Math` in their head for. FunctionalScript
is read by people who know JavaScript, and a name that means something else
here is a cost paid on every line that uses it.

**Ordering.** [`2360-built-in.md`](./2360-built-in.md) plans to admit some of
these as namespaces — "Global objects can't be assigned to a variable
(`const r = Object`). They can only be used as namespaces
(`Object.entries()`)" — which is the same rule seen from the other side, and
the only half of it written down. The day `Object.entries()` is admitted,
every module that bound `const Object = …` changes meaning.

The reservation is a breaking change of its own, whenever it lands:
`const Object = 1;` is accepted source today, so reserving the name turns a
module that compiles into one that does not, and the pull request that
implements it owes the `**BREAKING CHANGES:**` declaration `AGENTS.md` asks
for. What the ordering buys is not avoiding *that* break but avoiding a
second and worse one — a name that quietly changes meaning under a module
that already bound it, which no declaration can soften. So this is its own
document and not a section of 2360: it should land first, and it should
land loudly.

At `ce2698cf`, three of this repository's 382 `.js` and `.mjs` files bind a
global name, and all three bind the same one — `fjs/types/bigint`,
`fjs/media/json/extended` and `fjs/media/json/parser`, each with

```js
const { isFinite } = Number
```

They are the argument for the rule rather than a counterexample to it. That
binding is not the global `isFinite`: it is `Number.isFinite`, which does
not coerce its argument where the global does, so each of those modules has
a name meaning one thing locally and another everywhere else — the confusion
the reservation exists to prevent, arrived at by an idiom nobody would call
careless. Three renames is what it costs here.

All three are FunctionalScript: `.f.mjs` is what this repository's own
authored FunctionalScript is spelled, and `.f.js` is the separate marker for
what the parser of the same revision accepts — "neither spelling changes
what the language is" ([`spec/README.md`](../README.md), File Types). The
parser reads none of them today, destructuring not being in the language
yet ([`2450-destructuring.md`](./2450-destructuring.md)), but the rule is
the language's and not the parser's, so the three renames belong in the
pull request that lands it rather than in a later one.

## Proposal

A global name is a **reserved word**: never a name a module binds, never a
value a module names, and an ordinary property key like every other reserved
word. It is the rule `NaN` already follows, and this document's whole
content is that the rest of the list follows it too.

Half of it holds today by accident rather than by rule. A module has no free
names, so `export default Object;` is already `const not found` — there is
nothing for a global name to refer to. What reserving it changes is the
other half, `const Object = 1;`, and the answer the first half gives: not
"you forgot to declare it" but "that name is spoken for".

Keys are untouched. `{ Object: 1 }`, `a.Object`, `{ NaN: 1 }` and `a.NaN`
are property names, which JavaScript spells with an `IdentifierName` and
admits every reserved word to. A key is no value position, and `{ "NaN": 1 }`
has always denoted the same object.

**A namespace head is resolved before the reservation is consulted.** This
is the one ordering the implementation cannot get backwards. 2360 admits
`Object.entries()`, where `Object` stands in the head of an access and
denotes a namespace rather than a value; if the reserved-word check runs
first, that feature can never land. The reservation says a global name is
not a *name*, which leaves the language free to give it meaning in a
position of its own — exactly as it does for `NaN` where a value may stand.

### What it takes

Measured, by putting `Object` and `Math` into
[`keywords`](../../fjs/js/keywords/module.f.mjs) and reading the answers off
the parser:

|input|answer|
|-|-|
|`const Object = 1;`|`reserved word`|
|`export default Object;`|`reserved word`|
|`import Object from "./a.f.js";`|`reserved word`|
|`export default { Object: 1 };`|accepted|
|`const a = {}; export default a.Object;`|accepted|

That is the whole behaviour, from the list alone: no tokenizer change, since
a global name is an `id` token and stays one; no grammar change, since the
rules are written over token symbols; and no new message, since
`identifierOf` already refuses a keyword wherever a name is bound or
referenced, and the key path never consults it.

`globalThis` is not merely reserved: it is the global object itself, which
is ambient authority, so it is a name FunctionalScript will never admit —
the same class as `eval`. [`2360-built-in.md`](./2360-built-in.md) lists it,
and its entry there now says never rather than not yet and points back here
for the reason: an unchecked box alone cannot tell "not decided" from
"decided against".

### The list

The list is the standard's. ECMAScript defines it in
[ECMA-262 §19, The Global Object](https://tc39.es/ecma262/#sec-global-object),
across four subclauses, and that is what the implementation transcribes:

- [§19.1 Value Properties of the Global Object](https://tc39.es/ecma262/#sec-value-properties-of-the-global-object)
  — `globalThis`, `Infinity`, `NaN`, `undefined`
- [§19.2 Function Properties of the Global Object](https://tc39.es/ecma262/#sec-function-properties-of-the-global-object)
  — `eval`, `isFinite`, `isNaN`, `parseFloat`, `parseInt`, and the four URI functions
- [§19.3 Constructor Properties of the Global Object](https://tc39.es/ecma262/#sec-constructor-properties-of-the-global-object)
  — every global constructor, `Object` through the typed arrays
- [§19.4 Other Properties of the Global Object](https://tc39.es/ecma262/#sec-other-properties-of-the-global-object)
  — `Atomics`, `JSON`, `Math`, `Reflect`

§19 is not quite the whole set. The reservation exists so that admitting a
name cannot change what a module already means, so it covers **every name
2360 may admit**, and 2360 reaches past the standard: `WebAssembly` is the
embedder's, not ECMAScript's, and it has a section there. A name the
language may one day denote is reserved whatever spells it, or the ordering
this document is built on holds for some names and not others.

The same names, grouped for reading rather than for specifying, are MDN's
standard built-in objects — the page 2360 already works from:

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects

Two sources rather than one because they answer different questions: §19 is
normative and says what the set *is*, MDN says which edition each name
arrived in and which are deprecated, and the second is what decides the
questions below.

The table transcribes them, grouped as MDN groups them, with ✓ marking a
name FunctionalScript already refuses to bind. **It has not been checked
against either source** — it was written from memory, the environment that
drafted this document having a route to neither — so implementing this issue
starts by reading §19 and the MDN page and correcting the table, not by
trusting it. The subclause titles above are cited the same way and want the
same check.

|Group|Names|
|-|-|
|value properties|`globalThis`, `Infinity` ✓, `NaN` ✓, `undefined` ✓|
|function properties|`eval` ✓, `isFinite`, `isNaN`, `parseFloat`, `parseInt`, `decodeURI`, `decodeURIComponent`, `encodeURI`, `encodeURIComponent`|
|fundamental objects|`Object`, `Function`, `Boolean`, `Symbol`|
|errors|`Error`, `AggregateError`, `EvalError`, `RangeError`, `ReferenceError`, `SyntaxError`, `TypeError`, `URIError`|
|numbers and dates|`Number`, `BigInt`, `Math`, `Date`, `Temporal`|
|text|`String`, `RegExp`|
|indexed collections|`Array`, `Int8Array`, `Uint8Array`, `Uint8ClampedArray`, `Int16Array`, `Uint16Array`, `Int32Array`, `Uint32Array`, `Float16Array`, `Float32Array`, `Float64Array`, `BigInt64Array`, `BigUint64Array`|
|keyed collections|`Map`, `Set`, `WeakMap`, `WeakSet`|
|structured data|`ArrayBuffer`, `SharedArrayBuffer`, `DataView`, `Atomics`, `JSON`|
|memory|`WeakRef`, `FinalizationRegistry`|
|control abstraction|`Iterator`, `Promise` — and see the note below|
|reflection|`Reflect`, `Proxy`|
|internationalization|`Intl`|
|the embedder's, and 2360's|`WebAssembly`|

A name on MDN's page is not always a name the global object has, and only
the latter can be bound or referred to. `Generator`, `GeneratorFunction`,
`AsyncFunction`, `AsyncGeneratorFunction`, `AsyncGenerator` and
`AsyncIterator` are intrinsics reached through a prototype, not global
bindings — `typeof GeneratorFunction` is a `ReferenceError` — so they are
nothing to reserve, and 2360 lists four of them. What belongs in the set is
what `name in globalThis` answers for, which is also how the four `UInt*`
misspellings in 2360 were found.

`escape` and `unescape` are Annex B and deliberately left out; a module that
binds either is binding a name the language deprecates, and the list should
not carry it forward.

### Open questions

1. **The list ages.** ECMAScript adds globals — `Temporal` is the recent one
   — so a name legal today may be a global tomorrow, and adopting a new
   edition's list is a breaking change for any module that bound one of its
   additions. Pin the list to an edition of
   [ECMA-262](https://tc39.es/ecma262/#sec-global-object) and say so,
   re-reading §19 on each revision, or accept the churn?
   The same question the keyword list already has, and it has never been
   answered in writing.
2. **Host globals.** `console`, `process`, `window`, `document`, `fetch`,
   `setTimeout`, `require`, `module`, `exports`, `__dirname` are not
   ECMAScript's, and they differ per runtime. The recommendation is to leave
   them bindable: FunctionalScript is defined against the language, not a
   host, and since it has no free names, `const console = …` means the same
   thing in every runtime. But a reader's confusion is the same, so the
   question deserves an answer rather than a silence.

   `WebAssembly` shows where the line actually falls, and it is not
   "ECMAScript's versus the host's": that name is the embedder's and is
   reserved, because 2360 may admit it. What decides is whether the language
   may one day denote the name, not who standardized it — so answering this
   question means saying which host globals 2360 could ever reach, and
   reserving exactly those.
3. **What `keywords` means.** The list these names join is documented as
   "every name FunctionalScript treats as a keyword", which they now are —
   but it is also the union of four ECMAScript-shaped groups, and a fifth
   group of global names sits oddly beside `reservedWords`. Whether that
   list grows a fifth group or the fold consults two lists is a naming
   question rather than a behavioural one: the answers in the table above
   are the same either way. Four of the names are in it already — `eval`,
   `undefined`, `NaN` and `Infinity` — so the group has to be defined as a
   union rather than a disjoint addition.

## Tasks

- [ ] Correct the table above against
      [ECMA-262 §19](https://tc39.es/ecma262/#sec-global-object) and
      https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects
      — it is a transcription from memory and nothing has checked it.
- [ ] `globalNames` in `fjs/js/keywords/module.f.mjs`, the corrected list,
      and `keywords` as the union that holds it — `eval`, `undefined`, `NaN`
      and `Infinity` are in both, so it is a union and not an addition. The
      refusal then needs no code: `identifierOf` already answers
      `reserved word` wherever a name is bound or referenced.
- [ ] A proof that every name [`2360-built-in.md`](./2360-built-in.md)
      lists is in the set, so that a namespace admitted there cannot be a
      name a module was free to bind — `WebAssembly` is the one that is in
      2360 and outside ECMA-262 §19 today, and the proof is what keeps the
      next one from slipping through. 2360's four `UInt*` entries are
      misspelled — `Uint8Array` and its three siblings are the names that
      exist — and the proof cannot pass until they are corrected, which
      this change does. Four more of its entries are no global binding at
      all, being intrinsics reached through a prototype, so the proof reads
      "every name 2360 lists that the global object has".
- [ ] Proofs: each of the four positions in the table above, and a
      `const not found` still answering a name nothing binds, so that the
      new refusal is seen to be about the list rather than about references
      in general.
- [ ] Rename the three `isFinite` bindings — `fjs/types/bigint`,
      `fjs/media/json/extended`, `fjs/media/json/parser` — in the pull
      request that lands the rule. They are authored FunctionalScript, which
      is what `.f.mjs` means
      ([`spec/README.md`](../README.md), File Types), so the rule lands on
      them the day it lands, and a repository whose own source breaks its
      own language rule is not a state to pass through.
- [ ] `spec/README.md`: one sentence beside the `NaN`/`Infinity`/`undefined`
      rule it already states, generalized to the list — the same rule, one
      list longer.
- [x] [`2360-built-in.md`](./2360-built-in.md) cross-references this as the
      half that lands first, its stale `undefined` box is ticked — that name
      is a literal global like the two above it — and its `globalThis` box
      says never rather than not yet. Done here, since a `todo/` that
      contradicts another is corrected rather than built on.
- [ ] Answer the three open questions above in this document before the
      implementation, since each changes what the list is.
- [ ] The implementing pull request declares the break: a `Changelog:`
      section with a `**BREAKING CHANGES:**` item, naming what stops
      compiling — a module binding one of these names.

## Related

- [ECMA-262 §19, The Global Object](https://tc39.es/ecma262/#sec-global-object)
  — the normative list, and the one the implementation transcribes.
- [MDN, Standard built-in objects](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects)
  — the same names with their editions and deprecations, which the open
  questions below turn on.
- [`2360-built-in.md`](./2360-built-in.md) — which of these names become
  namespaces, the feature this one clears the way for.
- [`3150-shadowing.md`](./3150-shadowing.md) — shadowing between a module's
  own bindings; this document is about the names no binding may take at all.
- [`fjs/js/keywords/module.f.mjs`](../../fjs/js/keywords/module.f.mjs) — the
  one source of truth for the words FunctionalScript treats specially, where
  the list belongs.
