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
- A **default**, `= value` after a fixed parameter, a name or a pattern,
  is the parameter's value where its argument is `undefined` — missing, or
  passed as `undefined` — and the argument where it is anything else,
  `null` included. The default is evaluated only where it is taken, at
  each call: `(a = {}) => a` answers a fresh object at each call, and
  `(a = null.x) => a` throws only when called without `a`. Where it is
  taken, it is evaluated at the call, before the body, whether or not the
  body goes on to read the parameter: `(a, b = null.x) => a === 5 ? b : a`
  throws when called without `b`, `f(6)` included, as JavaScript's does,
  the parameter being an entry of the body as a `const` is. It is resolved
  in the function's own scope, before the body: it reads the scopes
  around the function, through the function's frame as the body does,
  the function itself, and the parameters before it, `(a, b = a) => b`.
  A read of a later parameter or of the parameter itself, which JavaScript
  throws on when the default is taken, is refused rather than read from a
  scope around the function: `const not found` where no scope around binds
  the name, and `capture shadowed` at the parameter where one does, a read
  inside a function the default writes included. A body `const` that
  shadows a name a default read is refused the same way, `capture
  shadowed`, as one that shadows a name the body read is. The parameters
  from the first default on, and the rest parameter after them, are read
  from the rest array, so the graph needs no node of its own: `(a = 5) =>
  a` is `(...r) => r[0] === undefined ? 5 : r[0]`, the outputs writing that
  lowered form ([default parameters](../todo/3125-default-parameters.md)).
- `f.length` is the number of fixed parameters, including unused ones and
  counting a pattern as one, before the first parameter with a default,
  as JavaScript's is: `((a, b = 1, c) => 0).length` is `1`. Rest
  adds zero. A function has **at most 16** fixed parameters, every one
  written counted, defaulted or not: a 17th is a
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
