## data-tosequence-reuse. `bnf/data` re-implements `toSequence`

**Priority:** P5
**Status:** irrelevant
**Superseded by:** [Separate alphabet-specific BNF helpers](./unicode-rules.md)

### Why irrelevant

This TODO proposed preserving `bnf/data`'s generic `string` rule case and reusing
`toSequence` from `fjs/bnf/module.f.mjs` to implement its Unicode expansion.

The alphabet-specific BNF split intentionally removes that architecture instead:

- `string` is removed from the generic `DataRule` / `Rule` representation;
- `fjs/bnf/data/module.f.ts` no longer interprets strings as Unicode code points;
- `toSequence` moves to `fjs/bnf/unicode/module.f.ts` as an alphabet-specific
  construction helper;
- Unicode helpers lower strings to ordinary generic rules before they reach
  `bnf/data`.

Therefore there is no remaining duplicate `toSequence` implementation to reuse in
`bnf/data`. Implementing this TODO first would create work that the alphabet split
immediately removes, while implementing it afterward would no longer make sense.

### Historical proposal

The original proposal was to import `toSequence` in `fjs/bnf/data/module.f.ts`,
replace the `'string'` case body with `sequence(toSequence(dr))`, and delete the
local duplicate Unicode-conversion helpers/imports.

Do not implement that proposal. Implement
[Separate alphabet-specific BNF helpers](./unicode-rules.md) instead.

### Related

- [Separate alphabet-specific BNF helpers](./unicode-rules.md) — removes the
  generic string-expansion path that motivated this TODO.
- `AGENTS.md` — "When a sibling module already has the type or helper you need,
  import it." The general rule still applies; this specific duplication disappears
  with the new BNF module boundary.
