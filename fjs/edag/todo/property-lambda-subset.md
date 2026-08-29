## `propertyLambda` is `optionPropertyLambda` on a smaller input

**Priority:** P4
**Status:** open

### Problem

In the Amnesia VM, `propertyLambda` (`../amnesia/module.f.mjs:175-184`) is a
strict special case of `optionPropertyLambda` (`:152-163`), re-implemented:

```js
const propertyLambda = (f, obj, prop, k) => {
    if (k === undefined) { return obj[prop] }
    const [o, e, cont] = k
    switch (o) {
        case '|()': return callProperty(f, obj, prop, e)
        case '|?.()': return nullish(obj[prop])
            ? skip(f, cont)
            : optionLambda(f, callProperty(f, obj, prop, e), cont)
    }
}
```

`PropertyLambda ⊂ OptionPropertyLambda` as a type (`../types.ts:89-92` vs
`:111-118`: all three of its arms appear verbatim in the larger union), and
the walkers agree arm for arm:

- the `undefined` guard and the `|?.()` arm are byte-identical to
  `optionPropertyLambda`'s (`:154`, `:160-162`);
- the `|()` arms are provably equal: `PropertyLambda`'s `|()` is terminal
  ("`|()` is terminal and so has only the shorter arity",
  `../types.ts:87-88`), so `cont` is always `undefined` there, and
  `optionPropertyLambda`'s
  `optionLambda(f, callProperty(f, obj, prop, e), cont)` with
  `cont === undefined` returns the call's value (`:132`) — exactly
  `propertyLambda`'s `callProperty(f, obj, prop, e)`;
- `optionPropertyLambda`'s extra `|.` and `|!()` arms are unreachable for
  `PropertyLambda`-typed input.

So the `.` handler (`:214-217`) maintains a second copy of the walk whose
subtlest rule — the `|?.()` short-circuit — is written twice; a semantics
fix has to land in both.

### Proposal

Delete `propertyLambda` and dispatch `.` to `optionPropertyLambda` directly;
the subtype relation makes the call well-typed as is. Keep
`propertyLambda`'s JSDoc prose — why only a call can follow a bare `.`, and
what a failed guard becomes with no region open — by moving it onto the `.`
handler, so the design note survives the deleted function.

The same file's four walkers all repeat the
`if (k === undefined) …; const [o, e, cont] = k; switch (o)` step-decoding
preamble that `:105-112` documents; whether a shared step-decoder is worth
its indirection can be judged while making this change, but it is not part
of this issue.

### Tasks

- [ ] Delete `propertyLambda`; route the `.` handler through
      `optionPropertyLambda`; move the prose.
- [ ] `npx tsc`, `fjs t`; the amnesia proofs — the `(a?.b)(c)` and `?.()`
      short-circuit rows in particular — pass unchanged.

### Related

- [shared-chain-productions.md](./shared-chain-productions.md) — the same
  containment (`PropertyLambda`/`OptionLambda` inside
  `OptionPropertyLambda`) spelled by copy on the grammar side.
