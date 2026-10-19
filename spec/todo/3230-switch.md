## Switch statement

**Priority:** P2
**Status:** wip — approved by the language designer
([Approval](#approval)); the implementation of the one form below is
[#3045](https://github.com/functionalscript/functionalscript/pull/3045)

Introducing `switch`, in one form first: the terminating `switch`, the
guard's sibling.

```js
export const kind = node => {
    switch (node[0]) {
        case 'array': case 'object': { return 'container'; }
        case 'string': { return 'text'; }
        default: { throw ['unknown', node[0]]; }
    }
};
```

### Problem

FunctionalScript dispatches on a value one way: a chain of guards, each
`if (d === a) { … }`, or the conditional it lowers to. JavaScript spells
that dispatch as `switch`, and the standard modules do: at `658e8da3`, 48
`.f.mjs` modules under `fjs/` hold 106 `switch` statements, with 73
`default` labels and 58 stacked labels (`case 0: case 2:`), from the
JSON parser's dispatch on a node's tag (`fjs/media/json/parser`) to the
B-tree's dispatch on a node's width (`fjs/types/btree`). None of them
can go through the compiler until the statement exists, and the register
lists it as open, no record proposing it
([refused constructs](./refused-constructs.md), `st.switch`). Rewriting
each as a chain of guards would compile, and would lose the one thing
`switch` says that the chain does not: that every branch tests the same
value.

### Proposal

A statement of a block body, standing where a `const` may, that the
compiler reads as a chain of guards over one shared value — surface
syntax over `?:` and `===`, no new node:

```
terminator ::= 'return' value end | 'throw' value end
             | 'switch' '(' value ')' '{' 'case' value ':' caseTail
caseTail ::= 'case' value ':' caseTail | block afterCase
afterCase ::= 'case' value ':' caseTail | 'default' ':' block '}'
            | '}' statement* terminator
```

The switch stands where `return` and `throw` do, in the terminator's
position, and holds the rest of its block: with a `default` the block
ends with it, and without one the statements after it and their
terminator are its tail, read back into the block's one flat list. That
is what lets the grammar say both that a `default` ends the block and
that the statements after a `switch` continue it, with one symbol of
lookahead and no rule the fold has to check; and a switch begins with
its first case, so the empty switch and one of a `default` alone are no
sentence of the grammar rather than a check after it.

- `switch (e)` evaluates the discriminant once, eagerly, where the
  statement stands, as JavaScript evaluates it before any label.
- A `case` is one or more labels and then a block — the guard's own
  block: any number of statements and then the one statement every block
  ends with, a `return`, a `throw`, or a switch with a `default`, whose
  every branch ends so in turn — so every branch terminates. Stacked
  labels, `case a: case b:`,
  share the one block, as in JavaScript. A label is any expression,
  evaluated where it stands and only when every label before it has not
  matched, in source order, as JavaScript evaluates them; a match is
  strict equality, `===`, as JavaScript's is, so `NaN` matches no label
  and an object matches itself alone.
- `default:` is optional and last, a clause of its own with no label
  stacked on it; its block runs when no label matched.
  With a `default`, the `switch` is the body's terminating statement, and
  nothing follows it: a statement after it is unreachable, as one after a
  `return` is. Without one, the statements after the `switch`, up to and
  including the body's own terminator, are what runs when no label
  matched — exactly as the statements after a guard run when its condition
  is falsy.
- No `;` follows the `}`, as none follows a guard's.
- This is the one form: braces around every case block, no `break`, no
  fallthrough from a block into the next case, `default` last, and the
  statement in a function body only. Each other form is a later step,
  additive on this one, under [Later](#later).

**Lowering.** The statement is syntactic sugar and adds no node:
`switch (e) { case a: case b: B1  case c: B2 } rest` denotes

```js
d === a || d === b ? (() => B1)() : d === c ? (() => B2)() : (() => rest)()
```

where `d` is the discriminant's value, shared as a body `const` is — one
node however many labels read it, evaluated where the statement stands
whether or not a label is reached, so that `switch (null.x) { case 1:
{ return 2; } }` throws
here as in JavaScript — and each block and the statements after the
`switch` are the body of a parameterless function called where it stands,
inlined as a guard's arms are
([bodies and guards](../control-flow/guards.md)). A `default` block is the
last alternate in place of `rest`. The `||` over a stacked group evaluates
the second label only when the first did not match, which is JavaScript's
order, and the `?:` chain nests as a chain of guards nests, so a
hand-written chain of guards, `if (d === a || d === b) { B1 } if (d === c)
{ B2 } rest` over a `const d = e;`, is the same graph and the same hash.
The `===`, `||` and `?:` nodes are the operators the language has; nothing
is added to the EDAG, its validators, interpreters or hash.

**Writers.** None changes. As with `if`, the writer never spells `switch`:
it spells the conditional, and the compiled module runs the same chain in
every output. Round-tripping through the writer keeps the graph, not the
text, as a guard's round trip does.

**Refusals.** Programs JavaScript admits that are refused rather than
read another way, each by name
([DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)):

- A case block that does not terminate. In JavaScript the statements fall
  through into the next case, which is the mistake `switch` is known for:
  a forgotten `break`. The block rule prevents it the way the guard's does,
  by requiring every branch to say where it ends
  ([DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)).
  The standard modules hold the mistake already: in `fjs/types/btree/find`,
  `find` has a `case 3:` whose block ends in an inner `switch` with no
  `default`, so a value no inner label matches falls through into
  `case 5:`; only TypeScript's narrowing makes that unreachable. Under
  this form the block is refused until it terminates.
- A `default` that is not last. JavaScript admits it anywhere, with the
  same meaning once every branch terminates, so the position says nothing
  and a reader has to check that it does not; last is the one spelling.
- A label stacked with the `default`, `case a: default: { … }` or
  `default: case a: { … }`. JavaScript reads the two as one clause, so the
  block runs on `a` and on no match alike — which is to say whatever the
  label does: a label in the `default`'s clause can never change which
  block runs, and is written only by mistake, as a leftover of a block
  split in two or in the belief that it narrows something. Its one
  effect is that `a` is evaluated on the way, which is the evaluation an
  unused `const` spells on purpose. The refusal names the dead label
  rather than reading it as nothing; admitting the clause as the
  `default` whose block the label's test shares is a step under
  [Later](#later).
- A `switch` with no case, `switch (e) {}`, and one of a `default` alone,
  `switch (e) { default: { return v; } }`. JavaScript evaluates `e` and
  goes on, or runs the block; here either is a `const` nothing reads and
  then the block, which the language spells as that `const` and the
  block's statements in place — the same graph, and the one the writer
  would write back. A `switch` that tests nothing is what deleting the
  last case leaves behind, and refusing it names that slip rather than
  reading it as the block it abbreviates; the mistake it prevents is the
  same one the guard's `if (c) { … }` with no condition would be. The
  grammar refuses both by beginning a switch with its first case. Should
  generated code want a switch of any number of cases, zero included,
  admitting the two is one grammar step, under [Later](#later).
- A statement after a `switch` that has a `default`: unreachable, as one
  after `return` is.
- A `const` outside a case block — between the `{` and the first label, or
  in a case written without braces — has no place in the grammar. In
  JavaScript such a declaration lives in the scope of the whole `switch`,
  visible to every case and in its temporal dead zone for the ones before
  it, which is the statement's other known mistake; the braces make each
  block's scope its own, as a guard's is.
- `break` and `continue`, as everywhere ([let](./3220-let.md), "Later").

A case block is a block of JavaScript's own, so it may bind what the body
has bound or read, shadowing it as a guard's block may; and the
statements after a `switch` without `default` are the body's one block
with the ones before it, so what that block has bound, or read from
outside — in the discriminant, a label or a case block — is not theirs to
bind (`duplicate id`, `capture shadowed`), exactly as after a guard.

#### Benefits

- The dispatch the standard modules already write, in the spelling every
  JavaScript reader knows, compiles: the biggest single construct keeping
  the `.f.mjs` tree out of the compiler, at `658e8da3`.
- No new node: the EDAG, its validators, interpreters, writers and hash
  are untouched, and a chain of guards over a shared `const` and the
  `switch` are one graph.
- The terminating block rules out the two mistakes `switch` is known for,
  fallthrough and the shared declaration scope, by the same rule the guard
  already has, rather than by a new one.
- The grammar reads it in one symbol, as `return` and `throw` are
  decided, and the fold builds it from the guard's own `arm`: one more
  frame, the discriminant's entry, and the `||` over a stacked group.

#### Drawbacks

- The form is narrow. A case written without braces, `case 'x': return
  v;`, which the standard modules also use, is refused until its follow-up
  lands; so is a `break` that continues with the statements after the
  `switch`, and a `switch` at module level.
- A `default` is required wherever a case block does not terminate on its
  own — a nested `switch` without `default` as the last statement of a
  block, as in `fjs/types/btree/find` — so a few standard modules change
  before they compile. Each such site is a latent fallthrough in
  JavaScript, so the change is a fix.
- Two keywords, two grammar rules and a third alternative of the
  terminator, and one frame in the fold.
- Duplicate labels, `case 1: … case 1: …`, are not refused: JavaScript
  admits them, the second is unreachable, and telling two labels apart in
  general is analysis the compiler does not do. A proof may pin that the
  first wins, as in JavaScript.

### Approval

A new language feature needs the formal, explicit approval of the language
designer, `sergey-shandar`, distinct from the proposer, before it is
implemented
([DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)).
**Approved** by `sergey-shandar`, the language designer, on the
implementation's pull request:
[functionalscript/functionalscript#3045 (comment)](https://github.com/functionalscript/functionalscript/pull/3045#discussion_r4316967530).

### Tasks

- [x] `switch` and `case` among the framing keywords; the grammar rules in
  `fjs/compiler/parser/grammar` — the switch a terminator that holds the
  rest of its block, its cases recursive through variants, which is what
  keeps the rule's type finite — with the refusals pinned in its proof
- [x] the fold in `fjs/compiler/parser`: the discriminant as an entry of
  the body, each label entered in order, each block an arm as a guard's,
  the chain closed from the last case back
- [x] `spec/control-flow/switch.md`, a `switch` program in the control-flow
  demo module with its real output, and the same graph and hash asserted
  against the hand-written chain of guards
- [x] the pages and rows that say a block ends in `return` or `throw`
  naming the third terminator, a switch with a `default`:
  [guards](../control-flow/guards.md), and the `st.guard`, `st.body-end`
  and `st.unreachable` rows of [refused constructs](./refused-constructs.md)
- [x] the `st.switch` row of [refused constructs](./refused-constructs.md)
  narrowed to every form this record refuses — a case without braces, a
  case block that does not terminate, `break` in a case, a `default` that
  is not last, a label stacked with the `default`, a switch with no case
  or of a `default` alone, a switch at module level or in a loop's block —
  planned where [Later](#later) names the form and design where
  [Refusals](#proposal) alone does, as the `st.guard` row holds the
  guard's follow-ups; and the `st.break-continue` row naming this record
  too
- [ ] the standard modules whose `switch` the form refuses — a case block
  that does not terminate, a case without braces — rewritten or waiting on
  a follow-up, each named

### Later

- A case without braces, `case 'x': return v;` and `case 'x': throw w;`:
  a block of one terminator, admitted where the block holds no `const`,
  which is where JavaScript's switch scope cannot bite.
- `break` as a case block's terminator: the arm is then the statements
  after the `switch`, one shared graph with the alternate, and the
  `switch` no longer needs a `default` to terminate the body.
- A `switch` at the module level, the module being a function too, with
  the guard's own module-level follow-up.
- A label stacked with the `default`, as the `default` with the label's
  test evaluated for its own sake: `d === a ? B : B`, the one block both
  arms of a conditional the language does not fold.
- The empty switch and the switch of a `default` alone, as the block each
  abbreviates, should a generator of switches want zero cases to be a
  switch too.
- A `switch` whose every case is a `return` of an expression, as the one
  spelling of a pure dispatch; and `match`/`when`
  ([new-pl](../../todo/new-pl.md)), which the proposal there chose for
  not conflicting with this statement.

### Related

- [refused constructs](./refused-constructs.md) — `st.switch`, the row
  this record turns from open to planned, and narrows to its follow-ups
  once the one form lands
- [bodies and guards](../control-flow/guards.md) — the guard whose block,
  arms and scoping rules the case block takes
- [let](./3220-let.md) — the loop, whose "Later" holds `break`
