# Loops

**Status:** implemented

```js
export default n => {
    let r = 1;
    while (r < n) { r = r * 2; }
    return r;
};
```

- **`let x = init;` followed by `while (condition) { … }`** is a loop: two
  statements of a block body, standing where a `const` may, that the
  compiler reads as one. The `let` declares the loop's variable with its
  initial value; the `while` runs its block while the condition is truthy,
  tested as `?:` tests its condition, before each round; and from the loop
  on the variable is a `const` of the body holding the value the last round
  left. The block holds `const`s, call statements
  ([call statements](../../functions/call-statements/README.md)) and assignments to
  the variable,
  `x = value;`, each ended as every statement is; an assignment rebinds the
  variable for the statements after it, in order, as JavaScript reads them,
  and the block's end continues the loop with the variable's last binding
  — a block assigning nothing continues with it unchanged. A value nothing
  after it reads, a `const` the block never uses or an assignment
  overwritten before any read, `r = null.x; r = 1;`, is established all the
  same, for what it does, as an unused `const` is anywhere
  ([bodies and guards](../guards/README.md)): the throw JavaScript throws
  there is thrown here, and the writer writes the value back as a `const`
  of the block, the same graph. This is the one
  form: one variable per loop, the `while` right after its `let`, no
  `break`, `continue`, guard, `return`, `throw` or nested loop in the block,
  no `let` anywhere else, and no loop at the module level — each a step of
  a plan rather than a guarantee, additive on this one
  ([`spec/todo/3220-let.md`](../../todo/3220-let.md)). No `;` follows the
  `}`, as none follows a guard's.

- The loop is syntactic sugar and adds no node: `let r = init; while (c)
  { s…; r = next; } rest` denotes `rest` with `r` the value of
  `loop(init)`, where `loop` is the function `r => c ? (() => { s…;
  return loop(next); })() : r` — the recursive spelling, its one parameter
  the variable, the block the body of a parameterless function called
  where it stands, as a guard's is, so that a `const` in it is the block's
  alone and runs only when the condition holds. The graph is the template
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
  way, each because this reading and JavaScript's would differ:
  - a function nested in the loop, in its condition or its block, that
    reads the variable and is held as a value — a `const`, an item, an
    argument, a value returned — rather than called where it is written
    (`loop variable captured`): JavaScript's closure sees the variable's
    last value, where the function's capture would hold the value of the
    round it was made in. A function called where it is written, `r = (()
    => r + 1)();`, reads the round's value in both, and is admitted; so
    is a read from any depth of such functions, since each closure is
    made and called in the round, where a function held as a value is
    refused for a read a function it calls where written makes, `r = ()
    => (() => r)();`, its closure outliving the round all the same;
  - a `const` of the variable's name in the block (`loop variable
    shadowed`): a block may shadow any other name, as a guard's block
    may ([bodies and guards](../guards/README.md)), but the loop's block
    has one job, to assign the variable, and a `const` of its name
    declares that it cannot — JavaScript throws on an assignment after
    it and refuses a read before it. The round leaves the state as it
    was, and the state being all the condition reads, every round after
    it is the same round: a loop that never ends, or throws at once.
    This compiler names the slip, a `const` written for the step, rather
    than compile a loop that cannot advance;
  - an assignment to any other name (`not the loop variable`), the one
    name a block may rebind.

  A `let` not followed by its `while`, or a `while` no `let` stands
  before, is refused (`let without while`, `while without let`): the two
  are one loop. The variable is a name of the body as a `const` is — bound
  twice is `duplicate id`, read in its own initializer `const not found`,
  by a nested function there too, `let r = () => r;`, whose closure
  JavaScript lets see the variable's last value — and a function written
  after the loop reads it as the value it holds, as it reads any `const`.

## Examples

The compiler demo offers the programs `loops` in [`module.f.js`](../module.f.js), each with its real output.

The demo on this page runs [`sample.f.js`](./sample.f.js), this page's
example as a function of one number — the one-variable `let`/`while` loop:
the least power of two not below the input — with every output `fjs compile`
makes of it: the expression graph (EDAG), the Rust and the WebAssembly that
Rust builds to. Its Run button calls the default export with `5` and `100`,
as JavaScript and as WebAssembly, and shows what each call returned or
threw.

## Reference

- ECMA-262: [The while statement](https://tc39.es/ecma262/#sec-while-statement)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/while>
