# `instanceof`

**Status:** implemented

```js
export default (...a) => a[0] instanceof Array;
```

`x instanceof Array` is `true` when `x` is an array and `false` of every
other value — `null`, `undefined`, every primitive, an object and a
function included. It never throws and converts nothing. It is the one
`instanceof` the language has: the right operand must be the word `Array`,
bare or in parentheses, since a group vanishes (`a instanceof (Array)` is
`a instanceof Array`); any other right operand — `Map`, an access, a
literal, a function — is refused at the operator. `Object` and `Function`
are not admitted and never will be: `typeof x === "object"` and
`typeof x === "function"` are the spellings for those. If we add more
types, like `Set` or `RegExp`, each is one more name on the right, once the
language can build one.

`instanceof` is a relational operator, one level with `< <= > >=` and
left-associative as they are: `a instanceof Array === b` is
`(a instanceof Array) === b`, `a < b instanceof Array` is
`(a < b) instanceof Array`, and `!a instanceof Array` is
`(!a) instanceof Array` — JavaScript's own trap, kept rather than repaired;
`!(a instanceof Array)` is the negation. `instanceof` is a reserved word,
as `typeof` is: it names no `const` and no parameter, while
`{ instanceof: 1 }` and `a.instanceof` are a key and a property name as in
JavaScript. `Array` is a reserved word too ([numbers](../values/numbers.md)), so no
scope binds it and the operator always means the global — before and after
any `const`, where JavaScript would read a later `const Array` as a binding
in its temporal dead zone and throw.

The EDAG's node is `['instanceof', exp, 'Array']`: the constructor is a
*name* from a closed list, not an operand, since no global is a value there
([`fjs/edag`](../../fjs/edag/README.md)); `nanvm-lib` answers it with
`Any::instanceof_(x, Constructor::Array)`. The writer spells it with
spaces around the word, `a instanceof Array`.

## Examples

The compiler demo offers the programs `instanceOf` in [`module.f.js`](./module.f.js), each with its real output.

## Reference

- ECMA-262: [InstanceofOperator](https://tc39.es/ecma262/#sec-instanceofoperator)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/instanceof>
