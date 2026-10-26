## A block whose end is reachable

**Priority:** P2
**Status:** open — a problem statement; admitting any form below is a
language change that needs formal language-design approval first
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

- **A body with no terminator.** A function whose statements are only calls
  or `const`s, which JavaScript answers with `undefined`:

  ```js
  // fjs/effects: the strict reading of an operation map
  command => { assert(false, command) }
  // fjs/mcp: a CLI handler
  casMcpServer: () => { casMcpServer('/') },
  ```

  Proof bodies and visitor callbacks in `fjs/dev`, `fjs/ebnf/data` and
  `fjs/ebnf/ll1` have the same shape. The `fjs/effects` site alone is the
  first refusal of eleven modules, ten of them through an import.
- **An `if` block with no terminator**, `else` included: the statements after
  the `if` run on both paths.

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
- **A `switch` that can finish without terminating:** no `default` although
  every case returns (`fjs/types/btree` and its playground), or a `break`
  (`fjs/emergent_testing`). That `break`, with the brace-less case, is
  [3230](./3230-switch.md)'s open follow-up; it is listed here for the count,
  and for the fall-through after a `switch` with no `default`, which is the
  first shape again.

### Proposal (sketch)

Both forms keep JavaScript's meaning and add no EDAG node:

- A body whose end is reachable ends in `return undefined`, the value
  JavaScript gives it. The terminator rule then states where a body *may*
  end without one rather than forbidding it.
- An `if` block whose end is reachable continues with what follows the `if`,
  with or without an `else`. Bindings assigned in either arm are the branch
  result [3220](./3220-let.md#general-bindings) already specifies for general bindings:
  the current values of the outer mutable bindings, an unchanged arm
  supplying the value before it. What follows the `if` is one shared
  continuation; it is not copied into both arms, which would double the code
  at every `if` in a sequence.

The `switch` shape follows from the two: a `switch` with no `default` falls
through to what follows it, and `break` ends its case there.

### Benefits and drawbacks

Benefits: the forms are ordinary JavaScript, and refusing them protects
nothing a reader relies on; 26 modules stop at one today; a body of
assertions and calls, the usual shape of a proof or a callback, reads as it
does in JavaScript.

Drawbacks: a forgotten `return` becomes a function that answers `undefined`
instead of a compilation error — the same trade JavaScript makes, which
TypeScript's return-type checking covers for the modules that are typed; and
a non-terminating `if` needs the branch-result lowering and a shared
continuation where the guard needed neither.

A source rewrite stays an alternative for single sites, `throw` in place of
`assert(false, …)` and a `default` in place of the last `case`, but not for
the shape: a body of calls has no terminator to add.

### Tasks

- [ ] Settle the forms and record formal language-design approval, with a
      link, under [DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions).
- [ ] A body whose end is reachable, through every output; the guard page and
      [refused constructs](./refused-constructs.md) updated.
- [ ] An `if` block whose end is reachable, and `else`, over the branch result
      of [3220](./3220-let.md#general-bindings) and a shared continuation.
- [ ] Recount the modules this unblocks and rename those that then compile.

### Related

- [bodies and guards](../control-flow/guards/README.md) — the terminator rule
  and the guard's follow-ups.
- [3230 switch](./3230-switch.md) — `break` and the brace-less case.
- [3220 let](./3220-let.md) — general bindings and their branch results.
- [MVP roadmap](../../nanvm/lib/todo/mvp-roadmap.md#where-self-hosting-stands)
  — what self-hosting waits on.
