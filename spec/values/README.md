# Supported Value Types

**Status:** implemented

An expression is a data expression, a property access, a function, a call, an
operator ([operators](../operators/README.md)) — a prefix `-` (negation), `~` (bitwise
not), `!` (logical not) or `typeof`, a binary operator, `instanceof Array`
or the conditional `?:` — the conversions `Number(exp)`
([number conversion](../conversions/number.md)) and `String(exp)`
([string conversion](../conversions/string.md)), or any of those in parentheses
([grouping](../operators/grouping.md)).

|Value|Example|In JSON|
|-----|-------|:-----:|
|`null`|`null`|✅|
|boolean|`true`, `false`|✅|
|number|`-42.5`, `3e2`|✅|
|number, not JSON's|`NaN`, `Infinity`, `-Infinity`|❌|
|string|`"hello"`|✅|
|array|`[1, "a"]`|✅|
|object|`{ "a": 1 }`|✅|
|`bigint`|`34n`, `-34n`|❌|
|`undefined`|`undefined`|❌|
|function|`(x) => x + 1`|❌|
|reference|`a`|❌|

A reference is a name in scope — an `import`, a module or body `const`, or a
function parameter — and denotes the value that name holds
([shared values](../bindings/constants.md), [functions](../functions/README.md)). It is
not a kind of value of its own: what a reference denotes is one of the types
above, and what makes it worth writing is that two references can denote the
*same* value.

The ❌ rows are what a module has and a JSON document does not, and every one
of them but `reference` is also what a `.json` output cannot carry
([output](../command-line/output.md)). A reference is not a value, so a `.json` output writes
the value it denotes: `const a = [1]; export default { p: a };` is
`{"p":[1]}`. What JSON cannot carry is the *sharing*: an object or an array
the value reaches along more than one reference is written where each
reference reaches it, as `JSON.stringify` writes it ([output](../command-line/output.md)).

## Pages

- [Numbers](./numbers.md)
- [Bigints](./bigints.md)
- [Strings](./strings.md)
- [Template Literals](./template-literals.md)
- [Arrays](./arrays.md)
- [Objects](./objects.md)

## Examples

The compiler demo offers the programs `index` in [`module.f.js`](./module.f.js), each with its real output.

## Reference

- ECMA-262: [ECMAScript language types](https://tc39.es/ecma262/#sec-ecmascript-language-types)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Data_structures>
