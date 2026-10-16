# Optional Chaining

**Status:** implemented; the [language-design approval record](../todo/2335-optional-chaining.md#authorization-and-approval) is still open

The behavior below was added to the compiler and specification in
[#2660](https://github.com/functionalscript/functionalscript/pull/2660).
Its required explicit language-design approval is not recorded; the
[approval-process follow-up](../todo/2335-optional-chaining.md#authorization-and-approval)
remains open.

```js
const o = { a: { b: 1 }, f: (...x) => x };
const n = null;
export default [o?.a.b, n?.a.b, o.f?.(2), n?.(3), (o?.a).b];
```

An optional chain is JavaScript's: `v?.k` and `v?.[k]` read the property
`v.k` and `v[k]` read, with the key the same constant either takes
([property access](README.md)), and `v?.(…)` calls `v` as `v(…)`
does — unless `v` is `null` or `undefined`, when the whole chain is
`undefined` and nothing after the `?.` is evaluated: not the key, not the
arguments, and not the steps written after it. `n?.a.b` is `undefined` under
a nullish `n`, where `n.a.b` throws, and `n?.f(g())` never calls `g`. The
steps after a `?.` are the chain's own until a parenthesis ends it, so
`(n?.a).b` reads `b` of `undefined` and throws — the one thing a group is
observable through ([grouping](../operators/grouping.md)) — and the value is JavaScript's
in every spelling: `a?.b.c` and `(a?.b).c` are two programs, `a?.b?.(c)` and
`(a?.b)?.(c)` one, since a region closed before a guard is unobservable.

A call keeps its receiver through a `?.` as it keeps it through a `.`:
`a?.b(c)` and `a.b?.(c)` call `b` with `a` as `this`, so a built-in member
function is called through either, and `(a?.b)(c)` keeps it too, as
`(a.b)(c)` does. The key is judged as an access's is — a prototype name
refused as a read, `a?.at`, and allowed as a call, `a?.at(0)`; a member
function a module may not call refused at its key, `a?.push(1)`; `length`
read from any value — and a key computed at run time is the conversion,
`a?.[Number(i)]`, as it is after `.`
([property access](README.md)), established only where the guard
lets the chain go on.

The graph is `fjs/edag/README.md`'s Chains, where every spelling has one
shape and the host engine agrees with it: `a?.b` is `['?.', a, 'b']`, the
steps after it the node's continuation, `['?.', a, 'b', ['|.', 'c']]` for
`a?.b.c`, and a group an access over the node, `['.', ['?.', a, 'b'], 'c']`.
`a.b?.(c)` is the access's own step, `['.', a, 'b', ['|?.()', [c]]]`, and
`a?.(c)` the call node `['?.()', a, [c]]`. The graph outputs write them: the
FunctionalScript one as above, a group where the region closed; the EDAG
one as the nodes; the Rust one as the method chain `nanvm-lib` runs. Value
outputs evaluate the chain and serialize its selected result. A
`?.` directly before a decimal digit is the token `?.` here, as the
tokenizer reads it
([`?.` before a digit](../../fjs/js/tokenizer/todo/optional-chain-before-digit.md)):
`a?.5:1` is refused at the `5`, and will be the conditional it is in
JavaScript when `.5` is a number.

## Examples

The compiler demo offers the programs `optionalChaining` in [`module.f.js`](./module.f.js), each with its real output.

## Reference

- ECMA-262: [Optional chains](https://tc39.es/ecma262/#sec-optional-chains)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining>
