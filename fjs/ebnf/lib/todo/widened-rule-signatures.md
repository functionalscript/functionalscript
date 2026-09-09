## widened-rule-signatures. The grammar helpers widen the rules they build

**Priority:** P4
**Status:** open — done for the JSON grammar; the DataJS `value` row remains.

### Problem

`Ast<R, I, O>` in [`../../ast/types.ts`](../../ast/types.ts) is only as
precise as the rule type it is given, and the two grammars hand it widened
ones. Every
helper is annotated with the union member it returns rather than the shape
it builds, so the shape is gone before `Ast` sees it:

| site | annotated | builds |
|---|---|---|
| `cj`, `array`, `object` in [`../json/module.f.mjs`](../json/module.f.mjs) | `Tuple` | a four-element tuple |
| `createValue` | `Variant` | a variant with seven known tags |
| `string` | `Rule` | a three-element tuple |
| `value`, in both grammars | `Const<Variant>` / `Thunk` | the grammar's own variant |

So `Ast<typeof json, I>` is `readonly [readonly Meta<I>[], readonly [string, Ast<Rule, I>], readonly Meta<I>[]]`:
the whitespace runs are exact, and the value in the middle is any tagged
AST at all. A proof written against that type cannot pin a JSON value's
shape, which is what the type is for — and a mapping of `value` receives
`Children<Const<Variant>, I, O>`, which says nothing of the seven branches
it has to read. The mapping itself is not blocked: the fold in
[`../../ll1`](../../ll1/README.md) keys a mapping by rule identity, and the
`value` thunk is reachable as `json[1]` and `dataJs[2][4]`.

The DataJS `statement` helper had the same annotation and was fixed in the
PR that filed this issue: a `const` type parameter keeps the prefix's arity,
so a statement's AST is a tuple rather than a list. The rows above are what
that fix did not reach.

### What landed

The JSON grammar is done, in the PR that shipped
[`fjs/media/json/parser`](../../../media/json/parser/module.f.mjs): `cj`, `array`, `object` and
`createValue` take `const` type parameters and return `Container<Item>`
and `Value<P, V>` from [`../json/types.ts`](../json/types.ts), `string` and
`number` are pinned, and `value` is annotated `JsonValue` — a recursive
alias, `() => readonly ['const', Value<typeof string, JsonValue>]`, which
TypeScript admits because the reference sits inside a function type. Its
proof's `types` entry pins the seven tags of `Children<typeof value>`, the
document's shape, and the refusal of a shape the grammar cannot produce, at
depth as at the top.

What the annotation cost, for Problem 7: one alias per grammar, of one
line, and one change in `Ast` — its variant row now builds each branch
through an alias, `_Branch`, so that TypeScript defers the branch's tuple
instead of expanding it as it builds the variant, which is what made the
recursive `Ast` finite; written directly into the mapped type, the tuple
met itself (TS2615). A rule that recurses through a variant is finite
under it; one that recursed through tuples alone would not be, and no
grammar here spells that shape
([`../../ast/README.md`](../../ast/README.md), "A rule that names itself").

### Proposal

The first three rows are the same fix: a `const` type parameter for each
argument that is a rule, and a return type spelled from the parameters —
`readonly [O, typeof ws, …, C]` for `cj`, a mapped object over the argument
types for `createValue`, and a `const` pin for `string` — the same change
pin-literal-constants asked for on `hex` and `number`, closed with it.

The last row is not: `value` names itself, and TypeScript infers nothing
recursive, so the thunk needs an explicit recursive type — a named alias in a
sibling `types.ts`, since a file-scope `@typedef` is not allowed
([fjs/AGENTS.md](../../../AGENTS.md)). That is
ebnf-front-end's Problem 7, and this
grammar is the real case it asked to be tested on: if the annotation is
onerous, the AST table is documentation rather than a checked contract, and
the answer belongs in that issue as much as here.

### Tasks

- [x] `const` type parameters on `cj`, `array`, `object` and `createValue`;
      `string` pinned.
- [x] A recursive type for JSON's `value`, and a proof that
      `Ast<typeof json>` rejects a shape the grammar cannot produce.
- [ ] The same for DataJS's `value`, typed `Thunk` today, and a proof that
      `Ast<typeof dataJs>` rejects an empty node where a statement must be.
- [x] Answer Problem 7 in ebnf-front-end from what the annotation cost.
- [ ] `tsc`, `fjs test`.

### Related

- [`../../ast/types.ts`](../../ast/types.ts) — `Ast<R, I, O>`, and why a
  widened `R` gives `Ast<Rule, I, O>`.
- ebnf-front-end — Problem 7, explicit
  annotations on recursive rules.
- [`../datajs/module.f.mjs`](../datajs/module.f.mjs) — `statement`, the
  helper already fixed.
- [self-contained-tokenizer](../../../media/json/todo/self-contained-tokenizer.md)
  — stage 3b's token mapping keys on `string`, whose mapping receives
  `Children<Rule, I, O>` as annotated; the `string` row here is what types
  that mapping's parameter. The `value` row is stage 4's grammar route's,
  and DataJS's `value` thunk is the same case.
