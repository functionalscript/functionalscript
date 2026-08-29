## non-finite-number-round-trip. DJS cannot round-trip `NaN`, `Infinity`, `-Infinity` or `-0`

**Priority:** P3
**Status:** open

### Problem

DJS is a JavaScript-syntax superset, so every JavaScript `number` should have a
`.f.js` spelling that reads back as itself. Four do not. Measured against the
current parser and serializer:

| value | `parseFromTokens` | `stringifyAsTree` | round-trips |
|---|---|---|---|
| `-0` | preserves it — `Object.is(v, -0)` is `true` | emits `0` | no |
| `NaN` | `const not found` | emits `null` | no |
| `Infinity` | `const not found` | emits `null` | no |
| `-Infinity` | `unexpected token` | emits `null` | no |

`-0` is the odd one: the tokenizer folds the sign into the numeric token and the
parser keeps it, so only the serializer drops it. The other three fail in both
directions.

The parser failures are not a missing branch but a consequence of the grammar's
alphabet. `NaN` and `Infinity` reach the parser as `id` tokens, so the grammar
matches them as *references* and name resolution rejects them — the same shape as
`export default zzz`. `-Infinity` fails earlier: the tokenizer's minus-fold
applies to numeric literals, and `Infinity` is not one.

The serializer failures come from reusing JSON primitives, which have no spelling
for these values: JSON's own grammar cannot express them at all.

### Why this is its own issue

The requirement is stated inside
[`compile-modules-to-edag.md`](./compile-modules-to-edag.md), which says of it:

> This parser/serializer support is required independently of module-to-EDAG
> conversion, because `.f.js` is the general representation used to persist EDAG
> and unresolved artifacts.

An independently-required prerequisite inside a large issue is hard to pick up
and easy to lose, so it is extracted here. That issue keeps the EDAG-facing
requirement and delegates the representation work to this one.

[`number-edge-cases.md`](../../media/json/todo/number-edge-cases.md) deliberately
excludes DJS spellings and points at the EDAG issue for them; it should point
here instead. Whatever is decided must **not** change shared JSON behaviour —
standard JSON output has no spelling for these values and must keep rejecting
them.

### Design questions to settle first

**1. The spellings.** DJS has no arithmetic, so `0/0` and `1/0` are not
available: the only candidates are the bare identifiers `NaN`, `Infinity` and the
unary form `-Infinity`. That means the *grammar* has to admit them, not just the
fold.

**2. Whether they are reserved.** Giving `NaN` its own terminal raises the same
question the framing keywords did: today `const NaN = 1` is legal, because `NaN`
is an ordinary `id`. Two options:

- reserve them, which is simpler but breaks a program that binds the name today;
- follow the framing-keyword precedent — a distinct symbol, still accepted
  wherever an identifier is, with a **binding shadowing the literal**. That
  matches JavaScript, where a local `NaN` shadows the global, and keeps the rule
  already recorded in [`../parser/README.md`](../parser/README.md): giving a word
  its own symbol narrows where it is *required*, never where it is *allowed*.

The second looks right, and it makes the fold — not the grammar — decide between
literal and reference, since only the fold knows what names are bound.

**3. `-0` needs no parser change**, only a serializer one. Worth confirming the
serializer's fix does not disturb `0`, since `-0 === 0` and only `Object.is`
separates them.

### Tasks

- [ ] Settle the three questions above; record the reserved-versus-shadowed
      decision in [`../parser/README.md`](../parser/README.md) beside the
      framing-keyword rule it extends.
- [ ] Parser: admit `NaN`, `Infinity` and `-Infinity`, resolving a bound name to
      the binding rather than the literal.
- [ ] Serializer: emit the four values in the chosen spellings instead of
      delegating to JSON primitives that cannot express them.
- [ ] Prove the round trip semantically, not by string equality —
      `Object.is(roundTrip(-0), -0)`, `Number.isNaN(roundTrip(NaN))`,
      `roundTrip(Infinity) === Infinity`, `roundTrip(-Infinity) === -Infinity`.
- [ ] Confirm shared JSON behaviour is unchanged: standard JSON still has no
      spelling for these and still rejects them.
- [ ] `npx tsc`, `fjs t`, and `npm run cov` clean.

### Related

- [`compile-modules-to-edag.md`](./compile-modules-to-edag.md) — states the
  requirement and needs it; this issue owns the representation work it delegates.
- [`number-edge-cases.md`](../../media/json/todo/number-edge-cases.md) — the
  standard JSON codec's own numeric policy, deliberately separate. It must not be
  resolved implicitly by whatever DJS chooses.
- [`../parser/README.md`](../parser/README.md) — the alphabet and the
  framing-keyword rule any new literal terminal has to fit.
- [157](./157-json-djs-shared-value-machine.md) — if parser or serializer
  machinery is shared, codec policy still stays separate from structure.
