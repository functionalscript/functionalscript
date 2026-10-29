# Loops

**Status:** implemented — nested `while` bodies with conditionals and explicit exits

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

A loop may stand at module level, in a function body, in a terminal guard's or
case's block, inside another loop or conditional arm, or after another loop.
Module loops run in initialization order,
including between named exports; earlier exported constants retain their
declared values ([modules](../../modules/README.md)). Its body holds `const`s
and initialized `let`s, call statements, assignments and conditional blocks.
It may assign zero, one or several outer variables, including parameters.
Assignments take effect in source order: a later
assignment reads the value an earlier one established. Loop-local declarations
belong to that round, and a shadowed name denotes its own binding.

Initializers, call statements and assignment computations run when reached,
even if nothing reads their values. For example, `r = null.x; r = 1;` throws
at the first assignment. The condition runs once at every reached test, using
the preceding round's values; a failed test or body computation does not
complete the loop normally.

An `if (condition) { ... }` inside a loop executes its block when the condition
is truthy. An optional `else` block runs when it is falsy; `else if` tests the
next condition only when preceding conditions were falsy. A normally completing
selected block continues with the following statement. Assignments update the
enclosing loop's variables; an arm that leaves a variable unassigned preserves
its preceding value. Each block owns its declarations, including nested
conditional blocks.

```js
while (i < n) {
    if (i < 2) {
        sum = sum + i;
    } else if (i < 4) {
        sum = sum + 2 * i;
    } else {
        sum = sum + 3 * i;
    }
    i = i + 1;
}
```

An inner loop completes before the next statement in its enclosing block.
Its assignments update enclosing variables in source order. Declarations in
the outer body initialize again on every reached outer iteration; declarations
inside the inner body belong to each reached inner iteration. An initially
false inner condition skips only that body and leaves following statements
reachable. Inner loops may also stand in either conditional arm.

```js
while (i < n) {
    let j = 0;
    while (j < 2) {
        sum = sum + i + j;
        j = j + 1;
    }
    i = i + 1;
}
```

An unlabeled `break;` finishes the innermost loop with the values established
before it. Following statements run once after that loop. An unlabeled
`continue;` starts the next test of the innermost loop's condition with those
current values. Both skip the rest of their selected body or conditional arm,
including any enclosing conditional's remaining statements. An inner loop's
exit leaves its enclosing loop active.

```js
while (i < n) {
    i = i + 1;
    if (i === 3) { continue; }
    if (i > 5) { break; }
    sum = sum + i;
}
```

Reached initializers and assignments still run before a transfer, even when
their results are unused. Skipped statements perform no computations. Their
names, declarations and writes remain subject to the ordinary source checks,
including the write-based capture rule. A nested function owns its control
flow; its body cannot break or continue a loop in the enclosing function.
The usual semicolon insertion rules apply to the unlabeled statements.

`return value;` inside a loop finishes its owning source function, including
from either conditional arm or an inner loop. Generated loop helpers do not
intercept that return. An ordinary nested function keeps its own returns;
calling it does not return from the caller. As elsewhere, a module body cannot
return, including from a module loop.

`throw value;` evaluates its value and propagates the failure immediately.
It may occur in a function or module loop. Earlier reached work runs before
either exit, following statements perform no computations, and source legality
checks still inspect those statements. Return and throw statements follow the
same spelling and line-break rules as outside loops.

```js
export default n => {
    let i = 0;
    while (i < n || n < 0) {
        if (n < 0) { throw "negative limit"; }
        i = i + 1;
        if (i === 4) { return i * 10; }
    }
    return i;
};
```

Switch statements inside loop bodies and conditional arms evaluate their
discriminant once and test case labels lazily in source order. Cases use
braces, may share stacked labels, and must exit explicitly: no case falls
through to another. A `default` is optional and last.

A `break` exits the nearest switch or loop. Breaking a switch resumes the
statements after it with the case's current state; `continue` instead retests
the nearest enclosing loop. A nested loop owns both of its transfers.
Returns and throws retain their existing function and failure behavior.
Case-local declarations stay within their braced block, and source legality
checks still inspect the text after an exit.

```js
export default n => {
    let i = 0;
    let sum = 0;
    while (i < n) {
        i = i + 1;
        switch (i % 4) {
            case 0: { continue; }
            case 1: case 2: { sum = sum + i; break; }
            default: { sum = sum + 2 * i; break; }
        }
        sum = sum + 10;
    }
    return [i, sum];
};
```

An unmatched switch without `default` resumes with unchanged state. A case
whose path reaches its closing brace without an exit is refused. `break`
and `continue` cannot cross an ordinary nested function boundary. Direct
module switches and switch-local breaks outside loop bodies remain separate
follow-ups; a switch inside a module loop follows these same loop rules.

A zero-state loop is
admitted: `while (false) {}` finishes immediately; `while (true) {}` does not
finish. A source function called inside a body keeps its own returns and may
contain its own loops.

## A terminal unconditional loop

A final `while (true)` can end a function body, including an existing
terminating guard or case block, without a following return or throw when no
source `break` targets that loop:

```js
export default n => {
    let count = n;
    while (true) {
        if (count === 0) { return count; }
        count = count - 1;
    }
};
```

The condition must be the boolean literal `true`, with parentheses allowed.
No constant folding or truthiness inference is used: `1`, `!false`, and a
reference to a constant whose value is true do not qualify. An ordinary loop
with a following return keeps its existing rules.

Only a break to this loop disqualifies it. Breaks in an inner loop or switch
target that inner construct and remain allowed. A continue cannot complete
the loop normally, and returns retain their owning function. Nested functions
own their own control flow. All source breaks are considered, including an
unreachable `if (false) { break; }` and a break after a return or throw.

Such a loop has no normal completion: an execution may return explicitly,
throw, or continue indefinitely. It cannot silently fall through and return
`undefined`. All declaration, reference and capture checks still apply to
unreachable source text. Module loops do not replace the module's required
exports or terminal throw.

Source resolution retains the loop's target identity and verifies the absence
of an owning break before desugaring. Normalization uses the existing loop
operations with no normal result or false-condition exit. Any internal
unreachable-completion guard is an invariant check, not an implicit function
result or a reachable post-loop continuation; no new VM operation is needed.

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
values simultaneously after its source assignments have run in order. Explicit
`continue` supplies those current loop inputs; explicit `break` supplies the
current normal results. Source admission resolves the target, and sugar packs
the state through the existing FAST transfers.
For a literal `true` condition and an explicit exit from that loop, sugar uses
the body directly instead of adding an unreachable false-condition arm. This
includes an owning-function return or statement throw in a nested loop. An
inner loop's own `break` or `continue`, or a nested function's exits, do not
exit an enclosing loop. Loops without their own explicit exits keep their
established graph shape.
Conditional blocks supply explicit FAST results for the union of enclosing
bindings assigned by normally completing arms, in declaration-introduction
order. Both arms start with the same incoming values. A normally completing arm
supplies its latest versions; an unchanged binding retains its preceding value.
An abrupt arm retains its loop transfer, owning return or thrown value instead.
Later statements read the selected normal results. An omitted `else` supplies
the incoming values.

The established scalar shape keeps its recursive graph and exact graph round
trip. General state uses the shared aggregate helper. Source serialization
round trips through the same graph conversion and stabilizes under its declared
normalization, rather than preserving the written variable names or count.

Source `.js`/`.mjs`, code-only JavaScript/function text and Rust emit eligible
aggregate helpers with plain or conditional bodies as loops and run with bounded
stack. Required condition computations run at every reached test. Normal loop
completion supplies its results once; a return or throw bypasses the normal
continuation. Result closures capture immutable final values. The source
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
