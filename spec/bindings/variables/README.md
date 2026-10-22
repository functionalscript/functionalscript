# Variables

**Status:** implemented

```js
export default (...a) => {
    let n = a[0];
    let [sum, count] = [0, 0];
    sum = sum + n;
    count = count + 1;
    if (n < 0) { sum = -sum; return [sum, count]; }
    n = n * 2;
    return [sum, count, n];
};
```

A `let` declares a **variable**: a name an assignment, `x = value;`, may
rebind. Otherwise it is a `const` under the other keyword — a statement of a
function body, standing where a `const` stands, in a guard's or a case's
block and in a loop's block, that binds a name or a pattern
([destructuring](../destructuring/README.md)) to the value of its
initializer, evaluated as its own statement whether or not anything reads
it ([constants](../constants/README.md)). The name is a name of the body as
a `const`'s is: it takes the words a `const` takes, bound twice is
`duplicate id`, read in its own initializer or before its declaration
`const not found`, and from outside a nested function it is a capture. A
parameter is a variable too, fixed or rest.

- **An assignment**, `x = value;`, rebinds the variable for the statements
  after it, in order, as JavaScript reads them: `let r = 0; r = r + n; r =
  r * 2; return r;` returns `(0 + n) * 2`. It is a statement, ended as
  every statement is, and no value of the language: `a = b = 1;`,
  `f(a = 1)` and `o.a = 1;` are refused where their `=` stands
  ([refused constructs](../../todo/refused-constructs.md)). The value is
  established for what it does, as a `const`'s is, even where the next
  assignment overwrites it before any read: `r = null.x; r = 1;` throws.
- **Only a variable is assigned.** An assignment to a `const`, to an
  import or to the name a function is declared under is refused
  (`assignment to const`): JavaScript throws there, at run time, and this
  compiler names the slip where it is written.
- **A variable denotes a sequence of values, not a cell.** Each assignment
  establishes a fresh immutable value, and a read is a read of the latest;
  no node of the graph holds a variable, so the graph outputs write the
  values: `let r = 0; r = r + n; return r;` is the graph `n + 0` is. A
  guard's block ends in a terminator ([bodies and guards](../../control-flow/guards/README.md)),
  so the assignments in it are that block's own, and the statements after
  the guard read the values the body established before it — the one way
  two branches rejoin is the loop ([loops](../../control-flow/loops/README.md)),
  which steps one variable.
- **A reassigned variable is captured by no function held as a value.** A
  function nested in the variable's scope — a `const`, an item, an
  argument, a value returned, a condition — may not read or assign a
  variable that is assigned anywhere in that scope, whether the assignment
  comes before or after it (`reassigned variable captured`): JavaScript's
  closure sees the variable's last value, where the function's capture
  holds the value it had when the function was made, so the program is
  refused rather than read another way. Two spellings say what is meant:
  a function called where it is written, `r = (() => r + 1)();`, reads
  the value of that moment in both languages and is admitted, through any
  depth of such functions — reads alone: an assignment from inside it,
  `(() => { r = 1; return 0; })();`, is refused the same way, since the
  compiler inlines such a function's block with values of its own, which
  the scope around it never sees, where JavaScript's assignment reaches the
  variable; and a **snapshot**, `const s = r; return () => s;`, holds what
  the capture would hold, as a `const` does. A variable
  never assigned is captured as a `const` is: a `let` nothing assigns and
  a parameter nothing assigns are a `const` by another spelling, and the
  rule is one for both.
- **The scope is the block.** `let` is not hoisted and has no `var`:
  `var` is refused ([`var`](../var/README.md)). A `let` with no
  initializer, `let x;`, and a `let` at module level are not admitted yet
  ([let](../../todo/3220-let.md), "General bindings"), and a loop steps
  one variable ([loops](../../control-flow/loops/README.md)).

## Examples

The compiler demo offers the programs `variables` in [`module.f.js`](../module.f.js), each with its real output.

The demo on this page runs [`sample.f.js`](./sample.f.js), this page's
example as a function of one number — two `let`s, one with a pattern, and
assignments in the body and in a guard's block, to the `let`s and to a
parameter — with every output `fjs compile` makes of it: the expression
graph (EDAG), the Rust and the WebAssembly that Rust builds to. Its Run
button calls the default export with `3` and `-2`, as JavaScript and as
WebAssembly, and shows what each call returned or threw.

## Reference

- ECMA-262: [Let and const declarations](https://tc39.es/ecma262/#sec-let-and-const-declarations),
  [Assignment operators](https://tc39.es/ecma262/#sec-assignment-operators)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let>
