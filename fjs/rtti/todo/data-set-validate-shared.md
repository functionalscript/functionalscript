## One data-set validator over `getItem`; one leftover rule

**Priority:** P4
**Status:** open

### Problem

`arraySetValidate` (`../data/module.f.mjs:1215`) and `objectSetValidate`
(`:1257`) are the same function modulo how a member is read. The declared
pass is identical to the character except for `value[Number(k)]` vs
`value[k]`:

```js
const declared = eachEntry(
    prefixEntries,                     // propEntries in the object arm
    (k, n) => {
        if (!(k in value)) {
            return nodeAdmitsAbsence(rules)(n) ? ok(false) : verror('unexpected value')
        }
        const m = nodeValidate(rules)(n)(value[Number(k)])   // value[k]
        return m[0] === 'error' ? m : ok(true)
    },
    emptyPresence,
    consPresence,
)
```

and both end with the same `presenceUnchanged` re-ask. That is exactly the
`getItem` parameter the schema-form factories already abstract over
(`constContainerValidate` in `../validate/module.f.mjs:200` takes
`(value, k) => …` for the same reason). The JSDoc admits the twinning —
`:1204` "Same shape as {@link objectSetValidate}, one kind over" and `:1282`
"The same last re-ask as `arraySetValidate`'s, one kind over" — but the code
does not express it.

Worse, the two arms spell "what is left over" two different ways. The array
arm goes through the shared rule:

```js
// :1232
const extra = undeclaredMembers(p.prefix.map((_, i) => String(i)), value)
```

while the object arm reaches around it:

```js
// :1275
Object.entries(value).filter(([k]) => at(k)(p.props) === null),
```

— even though the array arm's own doc (`:1209-1212`) states the rule:
"`undeclaredMembers` is what the schema-form readers walk too, so 'what is
left over' is one rule rather than two that happen to coincide."

The two spellings are equivalent today, and the equivalence is a coincidence:
`at` returns `null` both for an absent key and for one whose value is
`undefined` (`../../types/object/module.f.mjs:31-34`), which is exactly what
`definedEntries` drops when it builds `propEntries`. So the object arm is not
currently *wrong* — it is a second definition of a rule the file names as
single, and that is the divergence a future `props`-side change would
reintroduce silently.

### Proposal

One `setValidate(getItem, declaredNames)`-shaped helper used by both arms,
with `undeclaredMembers` as the single source of "left over" on both. The
array arm keeps its `rest === undefined` length rule (`:1240`) as its `fits`,
the same one-parameter split the schema-form factories use. The result should
delete one of the two ~35-line bodies and make the object arm's leftover walk
the shared one.

### Tasks

- [ ] Extract the shared declared-pass/re-ask body; express both arms
      through it with `getItem` and their own leftover/`fits` parameters.
- [ ] Replace the object arm's `Object.entries(value).filter(…)` with
      `undeclaredMembers`. This is a refactor with no behavior change — the
      two agree on every input today — so no new proof row is expected; the
      existing tables are the check.
- [ ] `tsc`, `fjs t`; the three-reader agreement tables pass unchanged.

### Related

- [container-read-skeleton.md](./container-read-skeleton.md) — the same
  duplication between the two schema-form readers; this issue is the data
  form's instance of the theme.
- [kindset-eliminator.md](./kindset-eliminator.md) — touches
  `patternsValidate`, the dispatcher above these two arms, not their bodies.
