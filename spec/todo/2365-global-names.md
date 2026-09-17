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

— and a module may bind any of them. Three globals are already refused, for
a reason that applies to the rest:
[`literalGlobals`](../../fjs/js/keywords/module.f.mjs) — `undefined`, `NaN`
and `Infinity` — which FunctionalScript keeps as words "so that each name
denotes its value wherever it appears", and `eval`, which is a restricted
name. Refusing `undefined` is already *stricter* than JavaScript, where
`const undefined = 1;` at module scope is legal.

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
every module that bound `const Object = …` changes meaning. Reserving the
name **before** it denotes anything makes that a non-event; reserving it
after is a breaking change. That ordering is the reason this is its own
document and not a section of 2360: it should land first.

Nothing in this repository binds a global name — measured across every `.js`
and `.mjs` file — so the reservation costs no existing module.

## Proposal

A module may not **bind** a name ECMAScript defines globally: not as a
`const`, not as an import's name, not as a parameter. The refusal names the
rule, as `reserved word` does for a keyword, rather than reporting a token
the grammar did not expect.

It is a rule about binding sites only. The words stay ordinary property
keys — `{ Math: 1 }`, `a.Object` — and stay ordinary strings. What a module
may not do is give one of them a second meaning.

Three of the names are not keys today, and that is a separate rule, not this
one: `NaN`, `Infinity` and `undefined` carry their own token symbols, so
`{ NaN: 1 }` and `a.NaN` are refused where `{ Math: 1 }` is accepted, and
[`spec/README.md`](../README.md) says a module cannot "bind, shadow or key
them". The key half of that is being removed in a document of its own — a
key is no value position, and `{ "NaN": 1 }` already denotes the same
object, so refusing the word costs a spelling and protects nothing. This
document neither relies on that refusal nor extends it: every name it
reserves is reserved at binding sites, and every one of them stays a key.

`globalThis` is not merely reserved: it is the global object itself, which
is ambient authority, so it is a name FunctionalScript will never admit —
the same class as `eval`, and worth saying once here rather than leaving it
to be inferred from its absence from 2360's list.

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
|control abstraction|`Iterator`, `AsyncIterator`, `Promise`, `GeneratorFunction`, `AsyncGeneratorFunction`, `Generator`, `AsyncGenerator`, `AsyncFunction`|
|reflection|`Reflect`, `Proxy`|
|internationalization|`Intl`|

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
3. **Where the check lives.** These names stay `id` tokens — they are not
   keywords — so they need their own set and their own message rather than
   joining [`keywords`](../../fjs/js/keywords/module.f.mjs), whose meaning is
   "a word the tokenizer treats as a keyword".

## Tasks

- [ ] Correct the table above against
      [ECMA-262 §19](https://tc39.es/ecma262/#sec-global-object) and
      https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects
      — it is a transcription from memory and nothing has checked it.
- [ ] `globalNames` in `fjs/js/keywords/module.f.mjs`, beside `literalGlobals`,
      with the corrected list and a proof that the four names already refused
      are in it.
- [ ] The check goes at the binding sites, which is `bind` and the `=>`
      parameter in `fjs/fsc/parser/module.f.mjs` — not in `identifierOf`,
      whose third caller is a *reference*, where refusing a global name
      would take `Object.entries()` with it and defeat the feature this
      document clears the way for. A message of its own: `reserved word` is
      for a keyword, and these are not keywords.
- [ ] Proofs: each binding position refused — `const`, an import's name, a
      rest parameter — a reference still reaching `const not found` rather
      than the new refusal, and a property key of the same name still
      accepted, `{ Math: 1 }` and `a.Object`.
- [ ] `spec/README.md`: one sentence beside the `NaN`/`Infinity`/`undefined`
      rule it already states, generalized to the list.
- [ ] [`2360-built-in.md`](./2360-built-in.md): cross-reference this as the
      half that lands first, and tick its stale `undefined` box — that name
      is already a literal global and already refused.
- [ ] Answer the three open questions above in this document before the
      implementation, since each changes what the list is.

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
