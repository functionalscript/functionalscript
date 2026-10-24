# Strings

**Status:** implemented

A string is JSON's, between double quotes or between single quotes:

```js
export default ["hello!", 'hello!'];
```

The escapes, the quotes and where a string may stand are specified in
[string escapes and quotes](../../lexical/string-escapes/README.md).

## Examples

The compiler demo has no programs for this page yet: its accepted and refused examples are a follow-up.

The demo on this page runs [`sample.f.js`](./sample.f.js), this page's
example as a function of one number — strings in double quotes and in single
quotes — with every output `fjs compile` makes of it: the expression graph
(EDAG), the Rust and the WebAssembly that Rust builds to. Its Run button
calls the default export with `0` and `1`, as JavaScript and as WebAssembly,
and shows what each call returned or threw.

```js
export default (...a) => ["hello!", 'hi!'][Number(a[0])].length;
```

## Reference

- ECMA-262: [String literals](https://tc39.es/ecma262/#sec-literals-string-literals), [The String type](https://tc39.es/ecma262/#sec-ecmascript-language-types-string-type)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String>
