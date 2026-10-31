# Bodies and Guards

**Status:** implemented

- A body `const` is the body's, and binds as a module's does, a module
  being a function too ([a module is a function](../../modules/README.md#a-module-is-a-function)):
  it names a value the `return` and the statements after it may use, it may
  not be written twice, and it is not in its own initializer's scope — except
  that a function that is the whole initializer has the name as its own, as
  a module `const`'s does (above). It is evaluated as a module's is, as its own statement, at every call and whether
  or not the `return` reaches it ([shared values](../../bindings/constants/README.md)):
  `() => { const x = null.x; return 1; }` loads and throws when called, as in
  JavaScript. The parameter is a name of the body too, so a `const` may not
  take it. A body `const`
  *may* take a name a scope around it binds, shadowing it as in
  JavaScript ([no-shadowing](../../todo/3150-shadowing.md)) — unless the body
  has already read that name from outside, before the `const` or in its own
  initializer. That is not supported yet and is refused (`capture
  shadowed`) rather than compiled to another value: JavaScript resolves
  every reference in the body to the body's `const`, a read before its
  declaration throwing and a function written earlier reading it once
  called, where this compiler would read the capture. It is no restriction
  of the language — nothing leaks through it — but a forward reference
  inside a body, which
  [`body-const-forward-reference.md`](../../../fjs/compiler/parser/todo/body-const-forward-reference.md)
  tracks.

  ```js
  export default (...args) => {
      const first = args[0];
      const pair = [first, first];
      return [pair, pair];
  };
  ```

  `pair` is one array however many references reach it, as a module `const`
  is one value — which is the whole reason a body has them.
- The body is an expression or a block, and `value` and `{ return value; }`
  denote the same function. As an expression the body is any value except a
  bare object literal: after `=>` JavaScript reads `{` as a block, never as
  an object, so the spelling is refused rather than read another way, and the
  object is written in parentheses instead ([grouping](../../operators/grouping/README.md)) —
  `(...args) => ({ a: 1 })`, as in JavaScript. The block
  is any number of statements — `const`s, call statements
  ([call statements](../../functions/call-statements/README.md)), and conditional statements, `if`
  (below) — and then one terminating statement, a `return` or a `throw` (below), or a
  switch with a `default` ([switch](../switch/README.md)), or a
  [terminal unconditional loop](../loops/README.md#a-terminal-unconditional-loop), each
  ended as every statement is — by its `;`, or by the newline before the
  next statement, a guard's by its `}`, and the last one's by the `}`
  ([module structure](../../modules/README.md)) — and an object literal is an
  ordinary value again, since after `return` JavaScript expects an
  expression. `return` and the value share a line: a newline between them
  ends the statement in JavaScript, which would return `undefined`, so it is
  refused here rather than read another way, exactly as a newline before
  `=>` is. Nothing follows the terminating statement: a statement after it
  is unreachable, and JavaScript's admitting the text does not make it
  anything but a mistake.
- A parameterless function **called where it is written**, with no
  arguments, denotes its body where the call stands:
  `a ? (() => { const x = f(); return [x, x]; })() : 4` is the idiom for a
  `const` inside an expression, an arm of a conditional say, where no
  statement can stand, and it lowers to the arm holding `[x, x]` with `x`
  one shared node, no function and no call. Nothing observes the function:
  it is called once and compared with nothing, so it mints no identity the
  program could see, and its body evaluates exactly once, where the call
  stands — a slot of its frame is the enclosing scope's own node, so what
  the body shares stays shared and nothing else is. A body `const` the
  returned value does not reach is evaluated where the call stands, as in
  JavaScript; in the graph it is anchored at the nearest position that
  opens a block, the scope's root or a lazy operand
  ([operators](../../operators/README.md)), which is where JavaScript's own semantics can
  tell no difference under the [failure contract](../../principles/README.md#failure-is-one-outcome).
  `(() => [1, 2])()` is `[1, 2]`, and a module holding either hashes the
  same. A capture a body names only through an unused alias, `const x =
  c;` and nothing more, is no slot of its frame, in a body or in a call
  inlined into one: the alias is dropped, so nothing reads it, and the
  scope's `const` is anchored as one nothing reaches. A call with an
  argument, `(() => 1)(null.x)`, has an argument to evaluate; a function
  with a parameter binds a name; and a body reading its own rest array
  names what the enclosing scope does not hold — each stays a call. The FunctionalScript writer uses the same idiom in reverse:
  a value shared under one lazy operand alone, which no `const` of the
  scope could hold without evaluating it whatever the operator decides, is
  written in a block opened at the operand,
  `a ? (() => { const $0 = [1]; return [$0, $0]; })() : 4`, which reads
  back as the operand. Round-tripping through that writer keeps the graph,
  not the text: the function written in the source is gone from both.
- **`throw value;`** terminates a block as `return value;` does, and a
  function whose body ends in it fails at every call — the one failure
  outcome the language has ([failure is one outcome](../../principles/README.md#failure-is-one-outcome)),
  reached on purpose, as a panic on a broken invariant rather than an
  expected error, which travels as a value
  ([`fjs/AGENTS.md` §1.5](../../../fjs/AGENTS.md#15-never-use-trycatch-test-throwing-with-the-throw-key)).
  Everything else about it is JavaScript's, read as `return` is: the value
  is any expression and is evaluated first, so `throw f(x)` calls `f` before
  failing; `throw` and its value share a line, since JavaScript's restricted
  production forbids a line terminator between them, and `throw;` with no
  value is not JavaScript; and nothing in the language catches the value,
  so the language promises the failure and not the payload, which an
  executor carries out of band for a human or a test runner to read.

  ```js
  export const todo = () => { throw "not implemented"; };
  export const checked = (n) => {
      const half = n / 2;
      throw ["not yet", half];
  };
  ```

  The body lowers to the node `['throw', v]`, an operation of one operand
  that always fails, and it follows the positional laziness every operator
  has: in an eager position it is evaluated and fails, and in a lazy one —
  an arm of `?:`, the right operand of `&&`, `||` or `??` — it is not
  established unless JavaScript would establish it, so
  `c ? 1 : (() => { throw 0; })()` is `1` under a true `c`. The
  FunctionalScript writer spells the node in a terminating position, a
  block's or [the module's](../../modules/README.md), as the statement it came
  from, and anywhere else — wherever a graph puts one, and an arm of `?:`
  once `if` lowers there — as the call of a function that throws,
  `(() => { throw v; })()`: JavaScript's one spelling of an expression that
  fails, and FunctionalScript itself — the call of a parameterless function
  written where it is called, which the front end inlines (above), so the
  text reads back as the node it was written from and fails at the same
  point. That is the writer's spelling, not a second source form:
  `throw` is a statement only, and an expression that must fail goes
  through a function that throws, as in JavaScript. The EDAG output carries
  the node, and the Rust output fails as the VM fails
  ([output](../../command-line/output.md)).
- **`if (condition) { ... }`** is a conditional statement before the
  function body's terminating statement. Its condition is evaluated once
  where the statement stands and tested as `?:` tests its condition. The
  selected branch may complete normally, return from the function, or throw.
  Normal completion continues with the statements after the whole `if`;
  a return or throw skips them. A missing `else` does nothing on the falsy
  path. Braced `else` branches and `else if` chains follow the same rules.

  Each branch has its own lexical scope. Its declarations do not escape,
  while assignments to outer variables supply the values that subsequent
  statements read. An unchanged branch supplies the incoming value
  ([variable normalization](../../bindings/variables/README.md#normalization)).

  ```js
  export const adjust = (condition, value) => {
      if (condition) { value = 1; }
      return value + 2;
  };
  ```

  The braces are required, and a function still needs its own terminating
  statement after the `if`. A final `if` whose arms both return is not yet
  a function-body terminator. Bare branches and module-level `if` remain
  follow-ups ([reachable block ends](../../todo/3210-reachable-block-end.md)).
  Finishing a branch does not implicitly return `undefined` from its function.
  No `;` follows the `}`, as
  in JavaScript: one there is the empty statement the language refuses
  ([module structure](../../modules/README.md)), and the next statement may
  share the guard's line.

  ```js
  export const unwrap = r => {
      if (r[0] === 'error') { throw r[1]; }
      return r[1];
  };
  export const sign = n => {
      if (n < 0) { return -1; }
      if (n > 0) { return 1; }
      return 0;
  };
  ```

  An `if` without `else` whose branch terminates is a guard: its following
  statements run only when the condition is falsy. Such a guard is syntactic
  sugar over the conditional and adds no node: a
  body `s… if (c) B rest` denotes `c ? (() => B)() : (() => rest)()`, the
  guard's block and the statements after it each the body of a
  parameterless function called where it stands (above), and the compiler
  reads it as exactly that, so `if (a) { const x = [1]; return [x, x]; }
  return 0;` and `a ? (() => { const x = [1]; return [x, x]; })() : 0`
  are one graph and one hash — `['?:', a, ['[]', [x, x]], 0]` with `x`
  one shared node — and a second guard nests as the alternate of the
  first. Where a `const` lives is which edges reach it: one before the
  guard is the scope's, evaluated eagerly as JavaScript evaluates it before
  the condition, so `const a = [1]; if (m) { return a; } return 0;` is
  `[',', [a, ['?:', m, a, 0]]]`, the anchoring rule of
  [operators](../../operators/README.md) — and `m ? a : a` is not folded to `a`, the
  condition being an evaluation of its own that may fail; one in the
  guard's block, or after the guard, is reached from its arm alone, and
  evaluated only when JavaScript would evaluate it, so `if (a) { throw 1;
  } const y = [2]; return y;` is `['?:', a, ['throw', 1], ['[]', [2]]]`
  and an unused `const z = [2]` in its place is anchored at the
  alternate's comma, `[',', [z, 1]]`, never at the function's root. The
  statements after a guard are JavaScript's one block with the ones before
  it, so a name that block has bound — a parameter, a `const` before the
  guard, or one after an earlier guard — may not be bound again there
  (`duplicate id`), and neither may a word that block has already read
  from an enclosing scope, in a statement before the guard, in the
  condition or in the guard's block (`capture shadowed`), since in
  JavaScript every such read would have named the later `const` before
  its declaration; the guard's block is a block of its own and may shadow
  either. The FunctionalScript writer never
  writes `if`: it spells the conditional, and an arm that holds a `const`
  or a `throw` as the block opened at the operand (above), so the guarded
  body reads back as the same graph; the EDAG output carries the `?:`,
  and the Rust output prints it as it prints any conditional.

  Normally completing branches use the existing FAST `if` statement and
  normal `yield` exits to pass their selected binding values to one shared
  continuation. Branch-local work stays conditional and preserves its
  evaluation order. EDAG uses its existing conditional operation; no new
  graph operation or function invocation represents a branch
  ([FAST and EDAG example](../../todo/3210-reachable-block-end.md#fast-and-edag-representation)).

## Examples

The compiler demo offers the programs `guards` in [`module.f.js`](../module.f.js), each with its real output.

The demo on this page runs [`sample.f.js`](./sample.f.js), this page's
example as a function of one number — a body with a `const` and two
terminating `if` guards — with every output `fjs compile` makes of it: the
expression graph (EDAG), the Rust and the WebAssembly that Rust builds to.
Its Run button calls the default export with `-5`, `0` and `7`, as
JavaScript and as WebAssembly, and shows what each call returned or threw.

```js
export default (...a) => {
    const n = a[0];
    if (n < 0) { return "negative"; }
    if (n > 0) { return "positive"; }
    return "zero";
};
```

## Reference

- ECMA-262: [The if statement](https://tc39.es/ecma262/#sec-if-statement), [The return statement](https://tc39.es/ecma262/#sec-return-statement), [The throw statement](https://tc39.es/ecma262/#sec-throw-statement)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/if...else>
