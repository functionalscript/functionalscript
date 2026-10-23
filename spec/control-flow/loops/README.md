# Loops

**Status:** implemented

```js
export default n => {
    let r = 1;
    while (r < n) { r = r * 2; }
    return r;
};
```

- **`while (condition) { … }`** is a loop: a statement of a block body,
  standing where a `const` may, over one **variable**
  ([variables](../../bindings/variables/README.md)) — a `let`'s or a
  parameter's, the one name declared outside the block that the block
  assigns. The `while` runs its block while the condition is truthy,
  tested as `?:` tests its condition, before each round; and from the loop
  on the variable holds the value the last round left. The block holds
  `const`s and `let`s of its own, call statements
  ([call statements](../../functions/call-statements/README.md)) and
  assignments, `x = value;`, each ended as every statement is; an
  assignment rebinds a variable for the statements after it, in order, as
  JavaScript reads them, and the block's end continues the loop with the
  variable's last binding. A value nothing after it reads, a `const` the
  block never uses or an assignment overwritten before any read, `r =
  null.x; r = 1;`, is established all the same, for what it does, as an
  unused `const` is anywhere ([bodies and guards](../guards/README.md)):
  the throw JavaScript throws there is thrown here, and the writer writes
  the value back as a `const` of the block, the same graph. This is the
  one form: one variable per loop, no `break`, `continue`, guard,
  `return`, `throw` or nested loop in the block, and no loop at the module
  level — each a step of a plan rather than a guarantee, additive on this
  one ([`spec/todo/3220-let.md`](../../todo/3220-let.md)). No `;` follows
  the `}`, as none follows a guard's.

- The loop is syntactic sugar and adds no node: `let r = init; while (c)
  { s…; r = next; } rest` denotes `rest` with `r` the value of
  `loop(init)`, where `loop` is the function `r => c ? (() => { s…;
  return loop(next); })() : r` — the recursive spelling, its one parameter
  the variable, the block the body of a parameterless function called
  where it stands, as a guard's is, so that a `const` in it is the block's
  alone and runs only when the condition holds. The variable's value at
  the `while` is `init`, whatever stood between its declaration and the
  loop; a loop over a parameter the function's own argument. The graph is the template
  `['=>', 1, slots, ['?:', c, ['()', ['self'], [next]], ['arg', 0]]]`
  called with `init`, a comma around the call where the block holds a
  `const` the next value does not reach — the same graph and hash a
  function written that way has, and what the block reads from the body
  around it is the function's frame, as any nested function's captures
  are ([captures](../../functions/captures/README.md)).

- **A loop runs in constant stack** in the FunctionalScript output, in
  function text and in the Rust output: each writer recognizes the template
  and spells it as the one loop, `while (c) { …; r = next; }` — the source
  writer as these two statements, the code-only text as the same two over a
  `let` of the function's parameter
  ([function text](../../../fjs/edag/function-text.md)), and the Rust output as
  Rust's `loop` over a `let mut` of the initial value where the function
  is called where it is written, and as the function's closure whose body
  is that loop over its argument where it is held as a value, no round a
  call either way — where a function calling itself last is
  otherwise recursion, which V8 runs out of stack on after some thousands
  of rounds, having no tail calls, and Rust likewise. A hand-written
  function of the template's shape, `const loop = r => c ? loop(next) :
  r;`, is the same graph and gets the same loop; one of a shape no `while`
  writes — a `const` before the condition running every round, a condition
  sharing a value with the block that mints identity, a container, a
  function or a call, a read of the rest array — keeps the recursion in
  every writer, which ask one recognizer; a read the condition
  and the block repeat, `r[0]`, one value of the graph, is written where
  each read stands and loops. A condition sharing a value of its own, the
  `const` of a function called where written, is the FunctionalScript
  output's loop still, the condition written as that function again, so
  that the value is established afresh at every test, and the Rust
  output's, whose `loop` rebinds it; the function text keeps the recursion
  for it. The FunctionalScript output alone keeps the recursion for a
  nested function that reads the variable, `self(() => r)`, since its
  nested function captures by name where the recursion's holds the value
  of its round — the function text's captures by value, through the
  wrapper it applies, and the Rust output's frame is a value. The EDAG
  interpreters still run the call
  ([tail-call-loop](../../../fjs/edag/todo/tail-call-loop.md)).

- Three programs JavaScript admits are refused rather than read another
  way:
  - a block that assigns no variable declared outside it (`loop variable
    missing`) — a `const` of the variable's name in the block among them,
    the block's own binding, which the loop never sees: the state being
    all the condition reads, every round is the same round, a loop that
    never ends or throws at once. This compiler names the slip rather
    than compile a loop that cannot advance;
  - a block that assigns a second variable declared outside it (`second
    loop variable`): the graph construction steps one, and more is a
    step of the plan ([`spec/todo/3220-let.md`](../../todo/3220-let.md),
    "General loops");
  - a function nested in the loop, in its condition or its block, that
    reads the variable and is held as a value (`reassigned variable
    captured`): the rule every variable has
    ([variables](../../bindings/variables/README.md)), the loop being
    where a variable is assigned most. A function called where it is
    written, `r = (() => r + 1)();`, reads the round's value as
    JavaScript's does, and is admitted; a function after the loop reads a
    snapshot, `const s = r;`, instead.

  The variable is a name of the body as a `const` is — bound twice is
  `duplicate id`, read in its own initializer `const not found`, by a
  nested function there too, `let r = () => r;`, whose closure JavaScript
  lets see the variable's last value.

## Examples

The compiler demo offers the programs `loops` in [`module.f.js`](../module.f.js), each with its real output.

The demo on this page runs [`sample.f.js`](./sample.f.js), this page's
example as a function of one number — the one-variable `while` loop:
the least power of two not below the input — with every output `fjs compile`
makes of it: the expression graph (EDAG), the Rust and the WebAssembly that
Rust builds to. Its Run button calls the default export with `5` and `100`,
as JavaScript and as WebAssembly, and shows what each call returned or
threw.

## Reference

- ECMA-262: [The while statement](https://tc39.es/ecma262/#sec-while-statement)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/while>
