# Comma

**Status:** implemented

```js
const assert = (...a) => a[0] ? undefined : (() => { throw a[1]; })();
export default (...a) => (assert(a[0] >= 0, "negative"), a[0] + 2);
```

`(a, b)` establishes `a`, then `b`, and is the value of `b`, `a`'s value
discarded, as in JavaScript. Any number of operands may be written,
`(a, b, c)` being `c` with `a` and `b` established. In a pure language the
one thing a discarded operand can do is fail, which makes the comma the
assertion form: `(assert(a >= 0), a + 2)` is `a + 2` where the assertion
holds, and the assertion's failure where it does not. Asserts express
internal contract breaches, not input validation, which is a value's job
([operators](../todo/2340-operators.md)).

The comma is written in parentheses, the one place it can be told from
every other comma: an argument list, an array's items and an object's
entries are lists, `f(a, b)` calling with two arguments and `[a, b]` holding
two items, as in JavaScript. A group, `(a, b)`, may stand wherever a value
may, and takes steps and operators as a group does
([grouping](grouping.md)): `(a, b).x` reads `x` of `b`, and `1 + (a, 2)` is
`3`. Inside the parentheses the operands are values, so a comma never holds
what only a parameter list may: `(a, b = 1)`, `(a, ...b)` and `(a, b,)` are
refused at the `=`, the `...` and the `)`. The comma JavaScript reads with no
parentheses of its own — `return a, b` and `throw a, b` in a block, the
condition of `if (a, b)`, `while` and `switch`, a substitution `${a, b}` and
a computed key `x[a, b]` — is refused at the comma, and the parentheses are
the spelling there too, `if ((a, b))`
([refused constructs](../todo/refused-constructs.md)).

A list in parentheses followed by `=>` is a function's parameters, as in
JavaScript, so `(a, b) => a + b` is the function and `(a, b)` the comma; the
two agree up to the `)`, and what follows it decides. Each parameter is then
a binding target ([parameters](../functions/parameters.md)), and
`(a, b + 1) => 1` is refused at the `b`.

The comma is the one operator that detaches a receiver. `(o.m)(a)` is the
method call `o.m(a)` is ([grouping](grouping.md)), where `(0, o.m)(a)`
reads `o.m` and calls the function it holds as a plain one — JavaScript's
detached call, which a function of this language, using no `this`, answers
as it answers the method call. The read is a read: `(0, a.at)(0)` reads a
built-in prototype's member, and is refused at the key as `a.at` alone is
([property access](../property-access/README.md)), where JavaScript would
throw.

Every operand is an eager position, as a container's item is: a `const`
reached through any of them counts as reached for what a module or a body
anchors ([operators](README.md)). The comma makes no EDAG node where it
stands. Its value is its last operand's node, and each discarded operand
that is code is anchored by the comma at the nearest block root — the
module's, a function body's, or the lazy operand it stands in, so
`c && (assert(c), 1)` establishes the assertion only where `c` is truthy. A
discarded operand that is no code is dropped: a reference, a literal and a
function compute nothing a later node reads, and a `const` a reference
names is anchored by its scope where nothing else reaches it. A discarded
comma is its operands, each discarded in turn, so `((a.x, () => 1), 2)`
drops the function as `(a.x, () => 1, 2)` does. So
`const a = []; const b = a; export default (b, a.length);` is
`['.', A, 'length']` with no comma, `b` being `a`'s node, where
`const a = []; const b = a.x; export default (b, a.length);` keeps
`[',', [['.', A, 'x'], ['.', A, 'length']]]`, `b` being a node of its own
that the result does not reach ([`fjs/compiler/edag`](../../fjs/compiler/edag/module.f.mjs)).
The [failure contract](../principles/README.md#failure-is-one-outcome)
governs execution: each operand's success is established before the result
is revealed, in no promised order beyond that.

The FunctionalScript writer, the `.js` output, spells a discarded operand
as the `const` of the block it is anchored in, the form it writes every
anchor in: `export default (...a) => (a.x, a.y);` comes back as
`export default (...$0)=>{const $1=$0.x;return $0.y;};`, and
`(0, o.f)()` as the read of `o.f` into a `const` and the call of that.
Read back, that text is the graph it was written from.

## Examples

The compiler demo offers the programs `comma` in [`module.f.js`](./module.f.js), each with its real output.

## Reference

- ECMA-262: [Comma operator](https://tc39.es/ecma262/#sec-comma-operator)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Comma_operator>
