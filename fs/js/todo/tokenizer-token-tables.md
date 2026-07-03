## `js/tokenizer`: derive keyword/operator token types and tables from one list

**Priority:** P4
**Status:** open

### Problem

The keyword and operator vocabularies in `fs/js/tokenizer/module.f.ts` are each
written out **twice** — once as a TypeScript union type and once as a runtime
entry table — so adding or removing a token requires editing two places that
nothing keeps in sync:

1. **Keywords.** `KeywordToken` (`fs/js/tokenizer/module.f.ts:106-112`) spells
   out 45 keyword kinds; `keywordEntries` (`:418-468`) repeats every one of
   them as `['catch', { kind: 'catch' }]` rows (plus `true`/`false`/`null`/
   `undefined`, which have their own token types but sit in the same table).
   Every row has the shape `['x', { kind: 'x' }]` — the string is written twice
   per row, ~50 rows.

2. **Operators.** `OperatorToken` (`:119-130`) spells out 57 operator kinds;
   `operatorEntries` (`:479-535`) repeats them all as `['&&=', { kind: '&&=' }]`
   rows — again the string twice per row, 57 rows.

That is ~130 lines of pure bookkeeping and two silent-drift hazards: a kind
added to the type but not the table produces tokens the tokenizer can never
emit; a row added to the table but not the type is only caught if the entry's
inferred type happens not to unify with `JsToken`.

`AGENTS.md` names the exact remedy (string-literals-as-values, pattern 2):
*"`const my = ['foo', 'bar'] as const` with `type My = typeof my[number]` when
you also need to iterate the values at runtime."* The keyword and operator
lists are precisely that case — the type and the table should both be derived
from one `as const` array.

### Proposal

One source array per vocabulary; derive the union type and the entry table
from it:

```ts
const keywords = ['arguments', 'await', 'break', /* … */, 'yield'] as const

type KeywordToken = { readonly kind: typeof keywords[number] }

const operators = ['!', '!=', '!==', /* … */, '~'] as const

type OperatorToken = { readonly kind: typeof operators[number] }

// shared row constructor — the string appears once
const kindEntry = <K extends string>(k: K): Entry<{ readonly kind: K }> =>
    [k, { kind: k }]

const keywordEntries: List<Entry<JsToken>> =
    [...keywords, 'true', 'false', 'null', 'undefined'].map(kindEntry)

const operatorEntries: List<Entry<JsToken>> = operators.map(kindEntry)
```

Notes for the implementer:

- The current `KeywordToken`/`OperatorToken` unions are split across several
  `{ readonly kind: … | … }` lines purely for line-width; `typeof keywords[number]`
  replaces all of them at once.
- `true`/`false`/`null`/`undefined` stay **out** of `keywords` (they are
  `TrueToken`/`FalseToken`/`NullToken`/`UndefinedToken`, not keywords) and are
  appended only when building the runtime table, preserving today's
  type structure exactly.
- Inside `.map`, `kindEntry`'s generic parameter is inferred as the whole
  element union, which is fine — the table is typed `Entry<JsToken>` and
  single-discriminant object unions accept `{ kind: A | B }`. If `tsc`
  disagrees on some version, map over the array with an explicitly annotated
  result type instead of tightening `kindEntry`.
- `isKeywordToken` and `getOperatorToken`/`hasOperatorToken` keep working
  unchanged — they consume the maps built from the tables.

Net effect: ~130 lines shrink to ~25, and a token kind is added by editing one
array element.

### Tasks

- [ ] Introduce `keywords`/`operators` `as const` arrays; derive
      `KeywordToken`/`OperatorToken` from them.
- [ ] Rebuild `keywordEntries`/`operatorEntries` via a shared `kindEntry`
      constructor.
- [ ] `npx tsc` clean; `fjs t` passes with existing `fs/js/tokenizer` proofs.

### Related

- `AGENTS.md` — "Use string literals as strongly-typed values" (pattern 2:
  `as const` array + `typeof arr[number]`), the rule this issue applies.
- [i667-js-tokenizer-handler-literals](667-js-tokenizer-handler-literals.md)
  — the sibling DRY issue inside the same module (handler bodies); this one
  covers the token vocabularies and is independent.
