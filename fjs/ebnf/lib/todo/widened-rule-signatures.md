## widened-rule-signatures. The grammar helpers widen the rules they build

**Priority:** P4
**Status:** open

### Problem

`Ast<R>` in [`../../ast/types.ts`](../../ast/types.ts) is only as precise as
the rule type it is given, and the two grammars hand it widened ones. Every
helper is annotated with the union member it returns rather than the shape
it builds, so the shape is gone before `Ast` sees it:

| site | annotated | builds |
|---|---|---|
| `cj`, `array`, `object` in [`../json/module.f.mjs`](../json/module.f.mjs) | `Tuple` | a four-element tuple |
| `createValue` | `Variant` | a variant with seven known tags |
| `string` | `Rule` | a three-element tuple |
| `value`, in both grammars | `Const<Variant>` / `Thunk` | the grammar's own variant |

So `Ast<typeof json>` is `readonly [readonly number[], readonly [string, Ast<Rule>], readonly number[]]`:
the whitespace runs are exact, and the value in the middle is any tagged
AST at all. A proof written against that type cannot pin a JSON value's
shape, which is what the type is for.

The DataJS `statement` helper had the same annotation and was fixed in the
PR that filed this issue: a `const` type parameter keeps the prefix's arity,
so a statement's AST is a tuple rather than a list. The rows above are what
that fix did not reach.

### Proposal

The first three rows are the same fix: a `const` type parameter for each
argument that is a rule, and a return type spelled from the parameters —
`readonly [O, typeof ws, …, C]` for `cj`, a mapped object over the argument
types for `createValue`, and a `const` pin for `string`
([pin-literal-constants](../json/todo/pin-literal-constants.md) is the same
change for two literals).

The last row is not: `value` names itself, and TypeScript infers nothing
recursive, so the thunk needs an explicit recursive type — a named alias in a
sibling `types.ts`, since a file-scope `@typedef` is not allowed
([fjs/AGENTS.md](../../../AGENTS.md)). That is
ebnf-front-end's Problem 7, and this
grammar is the real case it asked to be tested on: if the annotation is
onerous, the AST table is documentation rather than a checked contract, and
the answer belongs in that issue as much as here.

### Tasks

- [ ] `const` type parameters on `cj`, `array`, `object` and `createValue`;
      `string` pinned.
- [ ] A recursive type for `value` in each grammar, and a proof that
      `Ast<typeof json>` and `Ast<typeof dataJs>` reject a shape the grammar
      cannot produce — the counterexample for a widened tuple is an empty
      node where a statement must be.
- [ ] Answer Problem 7 in ebnf-front-end from what the annotation cost.
- [ ] `tsc`, `fjs test`.

### Related

- [`../../ast/types.ts`](../../ast/types.ts) — `Ast<R>`, and why a widened
  `R` gives `Ast<Rule>`.
- ebnf-front-end — Problem 7, explicit
  annotations on recursive rules.
- [pin-literal-constants](../json/todo/pin-literal-constants.md) — the same
  precision loss on two literals.
- [`../datajs/module.f.mjs`](../datajs/module.f.mjs) — `statement`, the
  helper already fixed.
