# Global Names

A name ECMAScript defines globally is a reserved word.

**Priority:** P3
**Status:** open

## Problem

FunctionalScript has no free names, so a global denotes nothing today and a
module may take the word for itself:

```js
const Math = { PI: 3 };
export default Math.PI;      // accepted
```

A reader who knows JavaScript pays for that on every line. And it is a trap
for later: [`2360-built-in.md`](./2360-built-in.md) plans to admit some of
these names as namespaces, and admitting one that a module has already bound
changes what that module means, silently.

Four are refused already, for reasons that are not this one: JavaScript
itself refuses to bind `eval` in strict code, and `undefined`, `NaN` and
`Infinity` are words FunctionalScript keeps so that each denotes its value
wherever a value stands.

## Proposal

A global name is a reserved word: never bound, never a value, and an
ordinary property key like every other reserved word — `{ Object: 1 }` and
`a.Object` are names of properties, as JavaScript has them.

Half of it holds already: a module has no free names, so `export default
Object;` is `const not found`. What the rule adds is the refusal to bind,
and a better answer to the half that holds.

The list is ECMA-262 §19 and whatever 2360 admits beyond it, `WebAssembly`
being the one such name today:

- [ECMA-262 §19, The Global Object](https://tc39.es/ecma262/#sec-global-object)
- [MDN, Standard built-in objects](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects),
  for editions and deprecations

Read them when the list is written. `'Uint8Array' in globalThis` is the
test that tells a name from a typo, and only the head of a path is a name —
`WebAssembly.Module` is a property of one.

## What it costs

It is a breaking change: `const Object = 1;` compiles today, so the pull
request that lands the rule declares it.

Here it costs three renames. At `ce2698cf`, `fjs/types/bigint`,
`fjs/media/json/extended` and `fjs/media/json/parser` each hold
`const { isFinite } = Number` — which is the case for the rule rather than
against it, `Number.isFinite` not being the global `isFinite`. They are
FunctionalScript ([`spec/README.md`](../README.md), File Types), so they are
renamed by the same pull request.

## Open questions

1. The list ages as ECMAScript grows. Pin it to an edition, or re-read §19
   each time?
2. Host globals — `console`, `process`, `require` — are not ECMAScript's and
   differ per runtime. `WebAssembly` shows the line is not "ours versus the
   host's" but whether the language may ever denote the name.
3. `keywords` is the list the JavaScript tokenizer gives token kinds to, and
   a global name must stay an `id` token there, so the globals want a list
   of their own that the fold consults beside it.

## Tasks

- [ ] The list, from the sources above.
- [ ] The refusal, in the fold, where `identifierOf` already answers
      `reserved word` for a keyword.
- [ ] Proofs: refused as a binding name and as a reference, accepted as a
      key.
- [ ] Rename the three `isFinite` bindings.
- [ ] Cross-check the list against 2360's, so a name admitted there is one
      no module could have bound.
- [ ] `spec/README.md`: the rule it states for `NaN` and `Infinity`, one
      list longer.

## Related

- [`2360-built-in.md`](./2360-built-in.md) — which of these names become
  namespaces; this lands first.
- [`3150-shadowing.md`](./3150-shadowing.md) — shadowing between a module's
  own bindings.
