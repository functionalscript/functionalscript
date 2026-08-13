## A third JSON grammar copy is dead code

**Priority:** P3
**Status:** open

### Problem

`fjs/fsc/json.f.mjs` (125 lines) is a complete JSON grammar written with
`fjs/bnf` combinators — `string`/`character`/`escape`/`hex`,
`number`/`uint`/`fraction0`/`exponent0`, `object`/`array`/`member`,
`ws0`/`ws1` — duplicating `deterministic` in `fjs/bnf/testlib.f.mjs:136-196`
rule for rule.

[bnf-grammar-single-owner](../../media/json/todo/bnf-grammar-single-owner.md)
inventories the JSON grammar as existing in exactly two places
(`fjs/bnf/testlib` and `fjs/djs/tokenizer`); this third copy is not in that
inventory, so implementing the todo as written would strand it.

It is also dead: `fjs/fsc/bnf.f.mjs` is the only importer of `json.f.mjs`,
and nothing imports `bnf.f.mjs` (`wsModule` has zero consumers). Neither file
has proof coverage — `fjs/fsc/proof.f.mjs` imports only `./module.f.mjs`. And
`fjs/fsc` is the compiler, not a media format, so the JSON half is in the
wrong module regardless.

### Proposal

Either delete both files, or keep only `bnf.f.mjs`'s genuinely
FunctionalScript-specific rules (`fjs`, `lineComment`, `multiLine`,
`id`/`alpha`) and have them import the JSON half from the future
`fjs/media/json` grammar owner. Either way, add this pair to
`bnf-grammar-single-owner`'s inventory.

### Tasks

- [ ] Decide: delete, or rebase on the shared JSON grammar
- [ ] Update `bnf-grammar-single-owner`'s inventory and task list

### Related

- [bnf-grammar-single-owner](../../media/json/todo/bnf-grammar-single-owner.md)
  — the two-copy inventory this pair is missing from
