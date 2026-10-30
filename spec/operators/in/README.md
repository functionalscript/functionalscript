# `in`

**Status:** implemented

```js
export default "x" in { x: 1 };
```

`"k" in o` is `true` when `o` owns an enumerable entry under the key `k` —
a member of an object, an element of an array, one holding `undefined`
included, so that `"x" in { x: undefined }` is `true` and `"x" in {}` is
`false` — or when `k` is `length` and `o` an array or a function, which
own it without enumerating it; and `false` otherwise: of a function, which
owns no entry, and of an object or an array without one. It throws for
`null`, `undefined` and every primitive, the `TypeError` JavaScript's `in`
throws, so `"0" in "abc"` fails as it does there. The question is
`hasEntry`'s for an entry ([reading an entry](../../property-access/entries/README.md)):
`"k" in o` is the constant-key spelling of presence, as `o.k` is the
constant-key read, and `hasEntry(o, k)` the computed one, as `entry(o, k)`
is — but the operators read `length` and the helpers do not, since a
helper lists what `Object.entries` lists, the enumerable entries, so the
operator has a body of its own beside the helper's.

**The key is a string literal**, bare or in parentheses, since a group
vanishes, and nothing else: a number, a name, an operator's result or an
`in` of its own is refused at the operator
(`the left operand of in must be a string literal`), and a key computed at
run time is `hasEntry`'s to test
([`in` with a computed key](./computed-key/README.md)). The literal may not
name a property a built-in prototype gives a value — `toString`, `push`,
`__proto__` and the rest [`fjs/js/prototype`](../../../fjs/js/prototype/module.f.js)
lists — refused as the key of a read is
([a prototype's name](../../property-access/prototype-names/README.md),
`prohibited property name`), with the read's one exemption: `length`,
which an array and a function own without enumerating it, is a key, and
`"length" in []` is `true` as in JavaScript. Any other string is a key: an
index-like `"0"`, a keyword's word `"if"`, the empty string.

**Why this and not JavaScript's `in`.** JavaScript's asks whether a property
exists anywhere on the prototype chain, so `"toString" in {}` is `true`;
FunctionalScript has no chain, and answering for own entries would give
accepted text a different successful result than JavaScript gives it
([principles](../../principles/README.md)). For a literal key outside the
inventory the chain has nothing to say: a FunctionalScript value owns no
non-enumerable string key outside it, and the chain adds only inventory
names, so JavaScript finds such a key exactly where the own entry is, and
the two languages agree on every value the language can build. A computed
key is refused for the same reason, since a name the compiler cannot see it
cannot refuse. The decision, the alternatives rejected and the approval are
[the `in` record](../../todo/2346-in-operator.md).

`in` is a relational operator, one level with `<` and `instanceof` and
left-associative as they are: `"a" in o === true` is `("a" in o) === true`,
`"a" in o < 2` is `("a" in o) < 2`, and the right operand groups as `<`'s
right operand would, `"a" in (1 < 2)`; `1 < 2 in o` is `(1 < 2) in o`,
refused for its left operand. `in` is a reserved word, as `instanceof` is:
it names no `const` and no parameter, while `{ in: 1 }` and `a.in` are a
key and a property name as in JavaScript. `for (k in o)` is a different
grammar, a statement the language does not have.

The EDAG's node is `['in', key, exp]`: the key is a *spelling*, carried as
`instanceof`'s constructor name is and never an operand
([`fjs/edag`](../../../fjs/edag/README.md)). Its answer is one body,
`runtime.in` in [`fjs/js/runtime`](../../../fjs/js/runtime/module.f.js), the
receiver check and then `hasEntry`, which every executor calls or
substitutes natively
([DESIGN.md §13](../../../doc/DESIGN.md#13-one-source-of-truth-optimize-by-substitution)).
The writer spells it with spaces around the word, `"k" in o`.

## Pages

Refused by design, showing what `fjs compile` prints and what to write instead:

- [`in` With a Computed Key Is Refused](./computed-key/README.md)

## Examples

The compiler demo offers the programs `in` in [`module.f.js`](../module.f.js), each with its real output.

The demo on this page runs [`sample.f.js`](./sample.f.js), this page's
example as a function of one number — `"x" in` an object that owns the
entry, and one that does not — with every output `fjs compile` makes of it:
the expression graph (EDAG), the Rust and the WebAssembly that Rust builds
to. Its Run button calls the default export with `0` and `1`, as JavaScript
and as WebAssembly, and shows what each call returned or threw.

```js
export default (...a) => "x" in [{ x: 1 }, {}][Number(a[0])];
```

## Reference

- ECMA-262: [Relational operators](https://tc39.es/ecma262/#sec-relational-operators)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in>
