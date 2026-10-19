# Switch

**Status:** implemented

```js
export default node => {
    switch (node[0]) {
        case "array": case "object": { return "container"; }
        case "string": { return "text"; }
        default: { throw ["unknown", node[0]]; }
    }
};
```

- **`switch (discriminant) { case label: block … default: block }`** is a
  statement of a block body, standing where a `const` may, that the
  compiler reads as a chain of guards over one shared value
  ([bodies and guards](./guards.md)). The discriminant is any expression,
  evaluated once, eagerly, where the statement stands, as JavaScript
  evaluates it before any label. A case is one or more labels, each `case`,
  any expression and `:`, and then a block — the guard's own: any number of
  statements and then a `return` or a `throw`, so every case terminates
  and none falls through into the next. The labels are evaluated where
  they stand, in source order, each only when every label before it did
  not match, as JavaScript evaluates them; a match is strict equality,
  `===`, as JavaScript's is, so `NaN` matches no label and an object
  matches itself alone; and the first match wins. `default:` is optional
  and last; its block runs when no label matched. With a `default`, the
  `switch` is the body's terminating statement, and nothing follows it:
  a statement after it is unreachable, as one after a `return` is.
  Without one, the statements after the `switch`, up to and including the
  body's own terminator, are what runs when no label matched — exactly as
  the statements after a guard run when its condition is falsy. No `;`
  follows the `}`, as none follows a guard's. This is the one form: braces
  around every case block, no `break`, no fallthrough from a block into
  the next case, `default` last, at least one case, and the statement in a
  function body only — each a step of a plan rather than a guarantee,
  additive on this one ([`spec/todo/3230-switch.md`](../todo/3230-switch.md)).

- **The statement is syntactic sugar and adds no node**: `switch (e) {
  case a: case b: B1  case c: B2 } rest` denotes `d === a || d === b ?
  (() => B1)() : d === c ? (() => B2)() : (() => rest)()`, where `d` is
  the discriminant's value, shared as a body `const` is — one node however
  many labels read it, evaluated where the statement stands whether or not
  a label is reached, so that `switch (null.x) { case 1: { return 2; } }`
  throws here as in JavaScript — and each block and the statements after
  the `switch` are the body of a parameterless function called where it
  stands, inlined as
  a guard's arms are. A `default` block is the last alternate in place of
  `rest`. The `||` over a stacked group evaluates the second label only
  when the first did not match, which is JavaScript's order, and the `?:`
  chain nests as a chain of guards nests, so a hand-written chain of
  guards over a `const` of the discriminant, `const d = e; if (d === a ||
  d === b) { B1 } if (d === c) { B2 } rest`, is the same graph and the same
  hash — and so is the conditional spelled out, `e === a ? 1 : 2` for a
  switch of one case and one label, the discriminant then one node read
  once. The `===`, `||` and `?:` nodes are the operators the language has;
  nothing is added to the EDAG, its validators, interpreters or hash.

- **The writers never spell `switch`**, as they never spell `if`: the
  FunctionalScript output spells the conditional, a `const` of the
  discriminant where more than one test reads it, and an arm that holds a
  `const` or a `throw` as the block opened at the operand; the EDAG output
  carries the `?:`; and the Rust output tests the discriminant with
  `strict_eq`, the labels of one case under `logical_or`, each after the
  first a closure, and prints the chain as it prints any conditional.
  Round-tripping through the writer keeps the graph, not the text, as a
  guard's round trip does.

- **Scoping** is the guard's. A case block, and the `default` block, is a
  block of JavaScript's own: it may bind what the body has bound or read,
  shadowing it. The statements after a `switch` without `default` are the
  body's one block with the ones before it, so a name that block has bound
  — a parameter, a `const` before the switch — may not be bound again
  there (`duplicate id`), and neither may a word that block has already
  read from an enclosing scope, in a statement before the switch, in the
  discriminant, in a label or in a case block (`capture shadowed`), since
  in JavaScript every such read would have named the later `const` before
  its declaration ([bodies and guards](./guards.md)).

- **Refusals.** Programs JavaScript admits that are refused rather than
  read another way, each at the token the grammar stops at
  ([DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)):

  - A case block that does not terminate, `case 1: { const x = 1; }`,
    refused at its `}`. In JavaScript the statements fall through into
    the next case, which is the mistake `switch` is known for, a
    forgotten `break`; the block rule prevents it the way the guard's
    does, by requiring every branch to say where it ends.
  - A case without braces, `case 1: return 1;`, refused at the `return`:
    a declaration written there lives in the scope of the whole `switch`
    in JavaScript, visible to every case and in its temporal dead zone for
    the ones before it, the statement's other known mistake; the braces
    make each block's scope its own. The brace-less single `return` is a
    follow-up.
  - `break`, refused as the word it is: with terminating blocks there is
    nothing for it to do, and a `break` that continues with the statements
    after the `switch` is a follow-up.
  - A `default` that is not last, refused at the `default`: JavaScript
    admits it anywhere, with the same meaning once every branch
    terminates, so the position says nothing, and last is the one
    spelling.
  - A `switch` with no case, `switch (e) {}`, refused at its `}`, and one
    with a `default` alone, refused at the `default`: a statement that
    dispatches on nothing is a mistake rather than a form.
  - A statement after a `switch` that has a `default`, refused at the
    statement: unreachable, as one after `return` is.
  - A `;` after the `}`: the empty statement, refused as it is after a
    guard's `}` ([module structure](../modules/README.md)).
  - A `switch` at the module level, or in a loop's block: each a
    follow-up, as the guard's are.

  Duplicate labels, `case 1: … case 1: …`, are not refused: JavaScript
  admits them, the second is unreachable, and telling two labels apart in
  general is analysis the compiler does not do; the first wins, as in
  JavaScript.

## Examples

The compiler demo offers the program `Switch` in [`module.f.js`](./module.f.js), with its real output.

## Reference

- ECMA-262: [The switch statement](https://tc39.es/ecma262/#sec-switch-statement)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/switch>
