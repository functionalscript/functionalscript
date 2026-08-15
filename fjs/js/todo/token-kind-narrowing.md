# A token built from a `string` kind needs a cast to become a `JsToken`

**Priority:** P3
**Status:** open

### Problem

`JsToken` is a union discriminated by `kind`, and the tokenizers build tokens
from strings that are *known* to be valid kinds — but the collections holding
those strings are typed over `string`, so `has`/lookup does not narrow and each
construction is cast:

| Site | Cast |
| --- | --- |
| `fjs/js/tokenizer/module.f.mjs:262` | `[kind, /** @type {JsToken} */ ({ kind })]` building `keywordEntries` from `keywords` |
| `fjs/djs/tokenizer/module.f.mjs:393` | `if (keywordSet.has(value)) return /** @type {JsToken} */ ({ kind: value })` |
| `fjs/djs/tokenizer/module.f.mjs:406` | `return /** @type {JsToken} */ ({ kind: tag })` |
| `fjs/djs/tokenizer/module.f.mjs:295` | `/** @type {TokenMetadata} */ (stateMetadata)` — same family, on the metadata rather than the token |

The `js/tokenizer` one carries a comment saying the claim holds "by
construction": `_KeywordToken` derives its kinds from the same `keywords` list
the entries are built from. That is true, and it is exactly the kind of
invariant that should be expressible rather than asserted in prose — the list is
the source of both.

`Set.prototype.has` is the obstacle in the `djs` cases: it takes the set's
element type and returns `boolean`, so a `ReadonlySet<string>` cannot narrow
`value` to a keyword union no matter how it was built.

### Proposal

Type the keyword and operator collections over the kind union rather than
`string` — `keywords` is already the single source of truth, so `ReadonlySet<KeywordKind>`
should be derivable from it. Then `has` narrows where the repo's own
`at(op)(operatorMap)` pattern already does, and the four casts go.

Note that a type predicate would also remove them, and
[`fjs/AGENTS.md`](../../AGENTS.md) allows one where the alternative is a cast —
but only where the predicate body *is* the structural check that defines
membership. Here it would be a `Set` lookup asserting a union, which is the
error-prone shape that section warns about. Prefer typing the collection.

### Related

- [`todo/inline-type-casts.md`](../../../todo/inline-type-casts.md)
