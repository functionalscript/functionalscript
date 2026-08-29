## non-finite-number-round-trip. DJS does not implement `NaN`, `Infinity`, `-Infinity` or `-0`

**Priority:** P3
**Status:** open

### Problem

[`spec/datajs/README.md`](../../../spec/datajs/README.md) admits four number
values the implementation does not. Measured against the current parser and
serializer:

| value | `parseFromTokens` | `stringifyAsTree` | round-trips |
|---|---|---|---|
| `-0` | preserves it — `Object.is(v, -0)` is `true` | emits `0` | no |
| `NaN` | `const not found` | emits `null` | no |
| `Infinity` | `const not found` | emits `null` | no |
| `-Infinity` | `unexpected token` | emits `null` | no |

The spec requires the round trip: *"`-0` reads back as `-0` and not `0`, and
`NaN` reads back as `NaN`"*, and it lists `NaN`, `±Infinity` becoming `null` and
`-0` becoming `0` as the JSON behaviour DataJS must **not** inherit.

`-0` is serializer-only: the tokenizer folds the sign into the numeric token and
the parser keeps it. Easy to get wrong — `String(-0)` is `"0"`, so only
`Object.is` shows that the parser is already correct.

The other three fail in both directions. They reach the parser as `id` tokens, so
the grammar matches them as *references* and name resolution rejects them,
exactly as it would `zzz`. `-Infinity` fails earlier still: there is no `-` in the
`DjsToken` set at all, so it tokenizes to `error id(Infinity) eof`.

The serializer failures come from reusing JSON primitives, which have no spelling
for any of these.

### The design is already specified

This is implementation work, not an open design. The spec settles each point:

- **They are words, not number syntax.** `word ::= … | 'NaN' | infinity | id`,
  with `infinity ::= '-'? 'Infinity'`. So an overflowing literal is not the
  intended spelling, even though `1e400` and `-1e400` happen to reach the
  infinities today through `parseFloat`.
- **The sign belongs to the token.** *"A `-` is **not an operator**: it belongs
  to the token that follows it… Three productions carry the optional sign —
  `number`, `bigint` and `infinity` — and nothing else does."* That is the rule
  the tokenizer already implements for numbers, extended to one more production;
  it is not a new operator token.
- **The names are reserved, not shadowed.** DataJS rejects `const NaN = 1`,
  because *"JavaScript permits `const undefined = 1`, and afterwards `undefined`
  means that const. A subset that bound the name but kept treating the word as a
  literal would accept a document and mean something different by it."*
  [`todo/parser-serializer-restructure.md`](../../../todo/parser-serializer-restructure.md)
  carries this further: `undefined`, `NaN` and `Infinity` become FunctionalScript
  reserved words, so the DataJS restriction is inherited rather than
  special-cased.
- **`-0` is ordinary number syntax** denoting negative zero — no new token, no new
  word, serializer only.

Note the direction of the subset law, because it is the opposite of what an
earlier revision of this issue assumed. FunctionalScript is a **subset of
JavaScript** — every module is JavaScript, most JavaScript is not a module — and
a superset of *JSON values*. The requirement here does not follow from "DJS can
express anything JavaScript can"; it follows from the spec admitting these four,
and from `.f.js` being the persistence format for EDAG artifacts.

### Tasks

- [ ] Tokenizer: carry the optional sign into an `infinity` production, the way
      `number` and `bigint` already do. No `-` operator token.
- [ ] Parser: admit `NaN` and `infinity` as value words rather than identifiers,
      and reject them as `const` names, per the spec's exclusion list.
- [ ] Serializer: emit the four values in their spec spellings instead of
      delegating to JSON primitives that cannot express them.
- [ ] Prove the round trip semantically, not by string equality —
      `Object.is(roundTrip(-0), -0)`, `Number.isNaN(roundTrip(NaN))`,
      `roundTrip(Infinity) === Infinity`, `roundTrip(-Infinity) === -Infinity`.
- [ ] Leave shared JSON behaviour exactly as it is. The standard codec does not
      reject these — its `numberSerialize` delegates to `JSON.stringify`, so
      `NaN` and both infinities currently serialize as `null`. That is the
      behaviour to preserve; whether it *should* be `null` belongs to
      [`number-edge-cases.md`](../../media/json/todo/number-edge-cases.md), which
      leaves it open.
- [ ] Coordinate the reserved-word half with
      [`parser-serializer-restructure.md`](../../../todo/parser-serializer-restructure.md),
      which owns making these FunctionalScript-wide reserved words; do not
      special-case the restriction in DataJS if that stage is close.
- [ ] `npx tsc`, `fjs t`, and `npm run cov` clean.

### Related

- [`spec/datajs/README.md`](../../../spec/datajs/README.md) — normative: the
  `word` / `infinity` productions, the sign rule, the binding exclusions, and the
  round-trip requirement.
- [`todo/parser-serializer-restructure.md`](../../../todo/parser-serializer-restructure.md)
  — the coordinating plan; owns the reserved-word change, and expects each stage
  to carry its concrete tasks in a co-located file like this one.
- [`compile-modules-to-edag.md`](./compile-modules-to-edag.md) — needs this, and
  says it is required independently of EDAG conversion; the representation work it
  delegates lives here.
- [`number-edge-cases.md`](../../media/json/todo/number-edge-cases.md) — the
  standard JSON codec's own numeric policy, deliberately separate and not to be
  settled by whatever DataJS does.
- [`../parser/README.md`](../parser/README.md) — the alphabet these words join,
  and the framing-keyword rule they are the exception to: these *are* reserved,
  where `import` and `export` are not.
