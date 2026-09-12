## try-concat. The concat-overflow rule is internal; consumers re-derive it

**Priority:** P4
**Status:** open

### Problem

`bit_vec` states the "concat overflows `maxLength`" rule once, inside the
private `tryUnpackConcat` monoid (`module.f.mjs:215-218`):

```js
operation: a => b =>
    a === null || b === null || a.length + b.length > maxLength
        ? null
        : unpackConcat(a)(b)
```

but the exported pairwise `concat` is unchecked, so callers that care
re-derive the bound:

```js
// fjs/basen/cbase32/module.f.mjs:60-64
if (head === null || length(head) + length(rest) > maxLength) { return null }
return concat(head)(rest)
// fjs/cas/module.f.mjs:84
if (length(acc) + length(first) > maxLength) { … }
```

and `fjs/basen/base64/module.f.mjs:63-69` discharges the same obligation
in seven lines of *prose* ("No `head`/`realBits` overflow check is needed
here: …") ahead of a bare `msb.concat`. Two sibling codecs in one
directory disagree on whether to check at all, and a comment's arithmetic
is not re-checked when a chunk width changes.

The module already ships the checked/unchecked pair at the list level —
`tryListToVec` / `listToVec = mapUnwrap(tryListToVec)` — and
`fjs/text`'s `tryUtf8`/`utf8` follows the same convention. The pairwise
member of that family is simply absent.

### Proposal

Add `tryConcat: (a: Vec) => (b: Vec) => Nullable<Vec>` to `bo`, defined
from the existing `tryUnpackConcat` operation so the bound literal stays
in one place. **`concat` stays exactly as it is — unchecked.** Today two
valid operands whose lengths sum past `maxLength` give an oversized
vector on Node rather than a throw; that behaviour is unchanged, no break
is declared, and [unpack-lift.md](./unpack-lift.md)'s plan to lift the
existing unchecked implementation over `Unpacked` stands. Making `concat`
`mapUnwrap(tryConcat)` was weighed and rejected: it would turn a
documented no-check fast path into an assertion, which is a behaviour
change this issue has no reason to make — the callers that want the
check are the ones this issue moves onto `tryConcat`. `cbase32`'s guard collapses
to `return tryConcat(head)(rest)` with its `maxLength`/`length` imports
dropped; `base64`'s prose either becomes a `tryConcat` call or points at
the one owner of the rule; `fjs/cas`'s loop keeps its custom error but
asks `tryConcat` instead of restating the arithmetic.

### Tasks

- [ ] Add `tryConcat` to `bo` with proofs (both orders, the exact
      `maxLength` boundary); `concat` untouched.
- [ ] Rewrite the three consumer sites through it.
- [ ] `tsc`, `fjs test`.

### Related

- [unpack-lift.md](./unpack-lift.md) — lifts ops over `Unpacked`; its
  rewrite of `concat` leaves it unchecked, so the two compose.
- [padded-uint-chunk-list.md](./padded-uint-chunk-list.md) — the
  short-chunk cousin, one layer down.
