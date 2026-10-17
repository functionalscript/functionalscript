## Mark the TypeScript printer's output

**Priority:** P4
**Status:** open

### Problem

The rtti demo colours every block it prints except one: the TypeScript type
that `dataToTs` writes. Its JSON Schema and canonical form come from writers
that mark their own runs ([`fjs/text/marked`](../../../text/marked/README.md)),
and the schema's source and the comparison calls are JavaScript the
highlighter's tokenizer fallback reads. TypeScript has neither: `dataToTs`
answers plain strings, and the fallback reads JavaScript tokens, so `type`,
`readonly`, `string` and `number` — the words a TypeScript reader looks for —
would draw as plain identifiers, and a syntax the JavaScript tokenizer does
not share could leave the block uncoloured.

### Proposal

Make the printer a producer, as the DataJS and `.js` writers are:

- a marked entry point beside `dataToTs`, answering the same definitions and
  entry expression as `Marked` runs, with `dataToTs` its text
  ([§5 of the marked README](../../../text/marked/README.md#5-producers-and-their-entry-points));
- `type` and `readonly` marked `keyword`, the primitive type names
  (`string`, `number`, `bigint`, `boolean`, `unknown`, `never`, `undefined`)
  as the kind the marked README settles for them, string and number literal
  types as `string` and `number`, alias names as `identifier`;
- the marks belong in the shared TypeScript printer, `fjs/types/ts`'s
  `printer`, which `dataToTs` routes through, so every caller of that printer
  gets them;
- the rtti demo's TypeScript block draws the runs with `render`.

Open question for the owner: which kind a primitive type name takes. LSP's
semantic tokens call it `type`, which the closed `TokenKind` set does not
have; `keyword` matches how TypeScript spells it, and a new kind is an API
change to `fjs/text/marked`.

### Tasks

- [ ] Decide the kind of a primitive type name.
- [ ] Marked output from `fjs/types/ts`'s `printer`, with proofs, including
      the oracle comparison `disagreement` where the tokenizer applies.
- [ ] A marked `dataToTs` entry point in `fjs/rtti/ts`.
- [ ] The rtti demo's TypeScript block drawn from it.

### Related

- [`fjs/text/marked` §11](../../../text/marked/README.md#11-adding-a-producer-a-checklist)
  — the checklist a new producer follows.
