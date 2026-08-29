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

The parser failures above are about the *names*, and are not a missing branch but
a consequence of the grammar's alphabet. `NaN` and `Infinity` reach the parser as
`id` tokens, so the grammar
matches them as *references* and name resolution rejects them — the same shape as
`export default zzz`. `-Infinity` fails earlier: the tokenizer's minus-fold
applies to numeric literals, and `Infinity` is not one.

Note this is about the *name*: an overflowing literal already parses to both
infinities today — see the spelling question below.

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
here instead. Whatever is decided must **not** change shared JSON behaviour.
The standard codec does not reject these values: it emits `null` for `NaN` and
both infinities, via `JSON.stringify`. Whether that stays is that issue's
question, not this one's — this issue must leave it untouched.

### Design questions to settle first

**1. The spellings — and only `NaN` forces a grammar change.** DJS has no
arithmetic, so `0/0` and `1/0` are unavailable. But an *overflowing numeric
literal* already round-trips both infinities today, with no grammar change at
all, because the fold reaches them through `parseFloat`:

```
export default 1e400    ->  Infinity
export default -1e400   ->  -Infinity
```

So the choice for the infinities is between two working representations, not
between one and none:

| spelling | reads as what it is | needs grammar work | reserved-name question |
|---|---|---|---|
| `1e400` / `-1e400` | no — an overflow, not a value | none | none |
| `Infinity` / `-Infinity` | yes | new terminal | yes |

`1e400` is the cheaper option and the worse one to read: nothing in it says
"infinity", it round-trips only because binary64 parsing overflows, and a reader
tidying it to `1e40` would silently change the value. Canonical names are
probably right, but the trade should be made deliberately rather than by
assuming, as an earlier revision of this issue did, that no literal spelling
exists.

`NaN` has no numeric spelling at any exponent, so it forces the grammar change
whichever way the infinities go — which makes the questions below unavoidable
rather than contingent.

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

**3. `-0` needs no parser change**, only a serializer one, and it has no literal
alternative — an overflow spelling reaches the infinities but nothing reaches
`-0` except the sign the parser already keeps. Worth confirming the
serializer's fix does not disturb `0`, since `-0 === 0` and only `Object.is`
separates them.

### Tasks

- [ ] Settle the three questions above; record the reserved-versus-shadowed
      decision in [`../parser/README.md`](../parser/README.md) beside the
      framing-keyword rule it extends.
- [ ] Parser: admit `NaN`, and the infinity names too if question 1 chooses them
      over `1e400`; resolve a bound name to the binding rather than the literal.
      If `1e400` wins, the infinities need no parser change at all — they parse
      today.
- [ ] Serializer: emit the four values in the chosen spellings. It currently
      delegates to JSON primitives, which have no spelling for any of them.
- [ ] Prove the round trip semantically, not by string equality —
      `Object.is(roundTrip(-0), -0)`, `Number.isNaN(roundTrip(NaN))`,
      `roundTrip(Infinity) === Infinity`, `roundTrip(-Infinity) === -Infinity`.
- [ ] Leave shared JSON behaviour exactly as it is. The standard codec does not
      reject these — its `numberSerialize` delegates to `JSON.stringify`, so
      `NaN` and both infinities currently serialize as `null`. That is the
      behaviour to preserve here; deciding whether it *should* be `null` belongs
      to [`number-edge-cases.md`](../../media/json/todo/number-edge-cases.md),
      which leaves it open.
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
