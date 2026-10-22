# Grouping

**Status:** implemented

```js
export default ([80, 443]).length;
```

A value may be written in parentheses, and it denotes that value: `(x)` is
`x`, so the parentheses leave nothing behind — no node of their own and no
change to which values a module shares — exactly as in JavaScript. A group
is a value like any other and takes a property access or a call after its
`)`, and it holds one value or the operands of a comma, `(a, b)`, which is
an operator of its own ([comma](comma/README.md)) and the one that detaches a
receiver.

Once admitted, parentheses leave no node behind, except for the boundary an
[optional chain](../property-access/optional-chaining.md) makes of them: they end the region a
`?.` opened. Admission can still depend on source form, as it does for a
literal bracket key ([property access](../property-access/README.md)). They keep
a property reference, so `(o.m)(a)` is the method call `o.m(a)` is
([functions](../functions/README.md)), and they keep sharing, so a `const` reached
through a group is the one value it is reached without one. They launder
nothing either: `(1).x` is the access `1 .x` is, `(1)(2)` the call `1(2)`
is, and `(o.toString)(1)` the method call `o.toString(1)` is, its key judged
by the call rule and not the read rule ([property access](../property-access/README.md)):
`(a.push)(1)` is refused at the key as a prohibited member function, as
`a.push(1)` is, and `(o.toString)` alone, a read, stays refused.

What a group does change is how far an operator reaches. A group is one
operand of whatever operator stands around it, so it overrides precedence
and associativity as in JavaScript ([operators](README.md)): `(1 + 2) * 3`
multiplies the sum, `1 - (2 - 3)` and `(2 ** 3) ** 2` reverse the default
association, `(a ? b : c) + 1` adds to the chosen arm, and `(1 + 2) ** 2`
raises the sum. It bounds how far a prefix reaches too, since `-` binds
looser than a step ([unary minus](../values/README.md)): `(-1).x` is the
access on the negation and `-1 .x` the negation of the access, as JavaScript
reads each. A group is an operand of `-` as well, and the one way a function
reaches the prefix at all: `-((...a) => 1)` is a value where `-(...a) => 1`
is a syntax error, there and here.

A parenthesized parameter list, `(a, b) => …`, is distinguished from a group
and from a comma by the arrow following `)`. Each parameter must be a binding
target; `(a + b)` is a group and `(a, b + 1)` a comma, while `(a + b) => 1`
and `(a, b + 1) => 1` are refused.

## Examples

The compiler demo offers the programs `grouping` in [`module.f.js`](./module.f.js), each with its real output.

## Reference

- ECMA-262: [The grouping operator](https://tc39.es/ecma262/#sec-grouping-operator)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Grouping>
