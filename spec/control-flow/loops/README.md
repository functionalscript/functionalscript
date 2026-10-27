# Loops

**Status:** implemented — plain `while` bodies; structured bodies and exits remain planned

```js
export default n => {
    let value = 1;
    let steps = 0;
    while (value < n) {
        value = value * 2;
        steps = steps + 1;
    }
    return [value, steps];
};
```

`while (condition) { … }` tests its condition before each round, including the
first. A false condition skips the body; after normal completion, following
statements read the values the last round left. Conditions use the same truth
test as `?:`. No `;` follows the closing `}`.

A loop may stand in a function body, in a terminal guard's or case's block,
or after another loop. Its body holds `const`s and initialized `let`s, call
statements and assignments. It may assign zero, one or several outer variables,
including parameters. Assignments take effect in source order: a later
assignment reads the value an earlier one established. Loop-local declarations
belong to that round, and a shadowed name denotes its own binding.

Initializers, call statements and assignment computations run when reached,
even if nothing reads their values. For example, `r = null.x; r = 1;` throws
at the first assignment. The condition runs once at every reached test, using
the preceding round's values; a failed test or body computation does not
complete the loop normally.

The current body grammar excludes guards, switches, nested loops, `break`,
`continue`, `return` and `throw` statements. Module-level loops are also
refused. These are remaining parts of
[general loops](../../todo/3220-let.md#general-loops). A zero-state loop is
admitted: `while (false) {}` finishes immediately; `while (true) {}` does not
finish. A source function called inside a body keeps its own returns and may
contain its own loops.

## Bindings and captures

The ordinary [variable rules](../../bindings/variables/README.md) apply.
Assignments to constants remain refused. A held function cannot capture a
binding reassigned anywhere in its scope, including after the capture or in an
unreachable loop. Use a snapshot to preserve the value of a particular round:
`const snapshot = value; const read = () => snapshot;`. A function called where
it is written may read the current variable, as in
`value = (() => value + 1)();`; assigning an outer variable from that function
remains refused. A never-reassigned `let` or parameter is capturable.

## Normalization and output

Loops add no graph operation. Shared source binding facts select the outer
mutable bindings read or written by the loop, in declaration-introduction
order. These become explicit FAST input and normal-result signatures, with no
fixed-parameter limit on loop state. Immutable outer values remain references;
local declarations stay in the body. Each iteration transfers the current
values simultaneously after its source assignments have run in order.

The established scalar shape keeps its recursive graph and exact graph round
trip. General state uses the shared aggregate helper. Source serialization
round trips through the same graph conversion and stabilizes under its declared
normalization, rather than preserving the written variable names or count.

Source `.js`/`.mjs`, code-only JavaScript/function text and Rust emit eligible
plain aggregate helpers as loops and run with bounded stack. Required condition
computations run at every test; the normal result is computed once after the
final false test. Its closures capture immutable final values. The source
spelling can introduce a scalar helper boundary on its first round trip; its
normalized graph and canonical text then stabilize. Existing scalar source
output retains its graph and bounded-stack spelling, including loops that read
an unchanged outer mutable value. The
[output contract](../../../fjs/edag/todo/tail-call-loop.md#remaining-general-source-output)
records the eligible helper shape and recursive fallback for other graphs.

## Examples

The compiler demo offers the programs `loops` in
[`module.f.js`](../module.f.js), each with its real output.

The demo on this page runs [`sample.f.js`](./sample.f.js), this page's example:
the least power of two not below the input, together with the number of steps.
It shows the expression graph (EDAG), Rust and WebAssembly output. Run calls the
default export with `5` and `100`, as JavaScript and WebAssembly, and returns
`[8, 3]` and `[128, 7]`.

## Reference

- ECMA-262: [The while statement](https://tc39.es/ecma262/#sec-while-statement)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/while>
