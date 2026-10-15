# Parameters

**Status:** implemented

- Fixed names bind positional arguments; missing arguments are `undefined`.
  Extra arguments are permitted. The rest parameter is the array of arguments
  after the fixed prefix. Each invocation has its own rest array, and repeated
  reads within it return the same array. Parameters may shadow outer names,
  but must be distinct and cannot collide with body declarations. Each one,
  fixed or rest, is a name by the
  [binding rule](../bindings/constants.md): `(eval) => 1` and
  `(...let) => 1` are refused, while `(from, then) => [from, then]` is a
  function.
- `f.length` is the number of fixed parameters, including unused ones and
  counting a pattern as one. Rest
  adds zero. A function has **at most 16** fixed parameters: a 17th is a
  compile error, and an EDAG function whose `length` is above 16 is refused by
  every writer. Wider data reads better as an array or an object, and a rest
  parameter still takes any number of arguments. The EDAG interpreters retain
  the function's length, body and evaluated captures as represented values;
  conversion to ordinary runtime callables happens at an explicit target
  compile/load boundary ([EDAG values](../../fjs/edag/values.md#runtime-compilation)).
- An **empty parameter list** binds no name at all, so a body written under
  one cannot reach its arguments: the arguments array is named by the
  parameter and by nothing else, and a word the list does not spell is
  unbound here exactly as any other unbound word is. Nothing else
  distinguishes the two lists. `() => 1` and `(...args) => 1` denote the one
  function, the one node `['=>', 0, [], 1]` — though each arrow written is
  a function of its own (below) — and a body `const` may take the name a
  parameter would have taken, there being no parameter to collide with.

## Examples

The compiler demo offers the programs `parameters` in [`module.f.js`](./module.f.js), each with its real output.

## Reference

- ECMA-262: [Parameter lists](https://tc39.es/ecma262/#sec-parameter-lists)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters>
