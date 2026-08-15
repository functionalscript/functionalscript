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

`Set.prototype.has` is the obstacle in the two `djs` keyword cases: it takes
the set's element type and returns `boolean`, so a `ReadonlySet<string>` cannot
narrow `value` to a keyword union no matter how it was built.

`fjs/js/tokenizer/module.f.mjs:262` is a **different problem**, and retyping the
collection will not fix it. `keywords` is already the 49-member literal union;
deleting the cast reports

```
Type '{ kind: "arguments" | "await" | … | "yield" }' is not assignable to type
'_FalseToken | _KeywordToken | _NullToken | _TrueToken | _UndefinedToken'
```

The value built has a *union-typed* `kind`, and an object type whose property is
a union does not distribute over a union of object types: TypeScript needs it to
match one member, and `{ kind: <all 49> }` matches none of `_KeywordToken`,
`_TrueToken`, `_FalseToken`, `_NullToken`, `_UndefinedToken` individually.

### Proposal

Type the `djs` keyword and operator collections over the kind union rather than
`string` — `keywords` is already the single source of truth — so `has` narrows
where the repo's own `at(op)(operatorMap)` pattern already does. That removes
three of the four casts.

Handle `js/tokenizer:262` separately: it needs the entry list built so each
element's `kind` is a single literal (so the object type distributes), or
`JsToken` restructured so one object type covers the keyword-ish kinds.

Note that a type predicate would also remove the `djs` three, and
[`fjs/AGENTS.md`](../../AGENTS.md) allows one where the alternative is a cast —
but only where the predicate body *is* the structural check that defines
membership. Here it would be a `Set` lookup asserting a union, which is the
error-prone shape that section warns about. Prefer typing the collection.

### Related

- [`todo/inline-type-casts.md`](../../../todo/inline-type-casts.md)
