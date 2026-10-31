## A block whose end is reachable

**Priority:** P2
**Status:** open — a function body that runs off its end stays refused by
design, and its modules take a source rewrite; an `if` block that runs off
its end is a language change that needs formal language-design approval first
([DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions))

### Problem

A FunctionalScript block ends in a terminating statement — a `return`, a
`throw`, or a switch with a `default` — and nothing after it may run
([bodies and guards](../control-flow/guards/README.md)). A loop's block is the
one exception ([loops](../control-flow/loops/README.md)). JavaScript has no such
rule: a function body that runs off its end returns `undefined`, and an `if`
block that runs off its end goes on with the statement after the `if`.
The guard's own page lists "a branch that does not terminate and with it
`else`" as a follow-up, and [the roadmap](./README.md) repeats it, with no
record to hold it. This is that record, together with the function body.

At `442ea8f` a reachable block end is the first refusal of 26 modules, 11 of
them among the modules the self-hosting loader depends on
([where self-hosting stands](../../nanvm/lib/todo/mvp-roadmap.md#where-self-hosting-stands)),
in three shapes:

- **A function body with no terminator**, 14 modules, 5 of the loader's: a
  body whose statements are only calls or `const`s, which JavaScript answers
  with `undefined`.

  ```js
  // fjs/effects: the strict reading of an operation map
  command => { assert(false, command) }
  // fjs/mcp: a CLI handler
  casMcpServer: () => { casMcpServer('/') },
  ```

  Visitor callbacks in `fjs/dev`, `fjs/ebnf/data` and `fjs/ebnf/ll1` have the
  same shape. The `fjs/effects` site alone is the first refusal of ten
  modules, nine of them through an import.
- **An `if` block with no terminator**, `else` included, 5 modules, 2 of the
  loader's: the statements after the `if` run on both paths.

  ```js
  // fjs/compiler/edag `_moduleExports`
  if (module instanceof Array) {
      if (module[0] === ',') { return … }
      if (module[0] === 'throw') { return [] }
  }
  throw 'expected a module export object'
  ```

  `fjs/cli`, `fjs/edag/value/object` and `fjs/ebnf/byte` (its `} else if`)
  are the others.
- **A `switch` that can finish without terminating**, 7 modules, 4 of the
  loader's: no `default` although every case returns (`fjs/types/btree` and
  its playground), or a `break` (`fjs/emergent_testing`). That `break`, with
  the brace-less case, is [3230](./3230-switch.md)'s open follow-up; it is
  listed here for the count.

### Proposal and stages

The three shapes take three different answers.

**A function body: keep the refusal, rewrite the source.**
[DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
names this very restriction as one that earns its place: "discourage falling
through the end of a function block without an explicit `return`: making the
intended result explicit helps expose accidental omissions." The terminator
rule is that guarantee, so the language keeps it and the modules state their
result: `return undefined` where `undefined` is what the body means, or a
`throw` where the body exists to fail, as the `fjs/effects` one does. Both
compile today. A body of calls then reads as one whose result was chosen,
not forgotten.

**An `if` block: a language extension.** An `if` block whose end is reachable
continues with what follows the `if`, with or without an `else`, and adds no
EDAG node. The function still ends in its own terminator, so §12's guarantee
is untouched. Bindings assigned in either arm are the branch result
the [variable contract](../bindings/variables/README.md#normalization) specifies
for general bindings: the current values of the outer mutable bindings, an unchanged arm
supplying the value before it. What follows the `if` is one shared
continuation; it is not copied into both arms, which would double the code at
every `if` in a sequence.

**A `switch`:** [3230](./3230-switch.md)'s follow-ups. A `switch` with no
`default` is the function-body shape once more, rewritten the same way: the
cases stay as they are and a terminator follows the `switch` — `return
undefined`, the result an unmatched value reaches in JavaScript, or a `throw`
where no other value can arrive. Turning the last `case` into the `default`
would not do: it gives an unmatched value that case's result instead.

### Benefits and drawbacks of the `if` extension

Benefits: an `if` that only sometimes acts — an assertion, a lookup that falls
back to the code after it — is ordinary JavaScript, and five modules stop at
one; unlike a body that runs off its end, it hides no result, because the
function's own terminator still states it.

Drawbacks: the branch-result lowering and a shared continuation, where the
guard needed neither; and a reader of a guard can no longer assume that the
code after it runs only when the condition is false.

The alternative that needs no approval is a rewrite here too: a guard's block
can end in the `return` or `throw` the code after it would reach, at the cost
of repeating that code in the arm.

### Tasks

- [ ] Rewrite the function bodies with no terminator, `return undefined` or a
      `throw`, and a terminator after each `switch` with no `default`; no
      approval needed.
- [ ] Settle the `if` form and record formal language-design approval, with a
      link, under [DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions).
- [ ] An `if` block whose end is reachable, and `else`, over the branch result
      of the [variable contract](../bindings/variables/README.md#normalization) and a shared continuation,
      through every output; the guard page and
      [refused constructs](./refused-constructs.md) updated.
- [ ] Recount the modules this unblocks and rename those that then compile.

### Related

- [bodies and guards](../control-flow/guards/README.md) — the terminator rule
  and the guard's follow-ups.
- [DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
  — why a function body keeps its explicit result.
- [3230 switch](./3230-switch.md) — `break` and the brace-less case.
- [Variables](../bindings/variables/README.md) — general bindings and their branch results.
- [MVP roadmap](../../nanvm/lib/todo/mvp-roadmap.md#where-self-hosting-stands)
  — what self-hosting waits on.
