## scan-as-map. Two state-free `Scan` operators are `map`s in disguise

**Priority:** P4
**Status:** open

### Problem

Two of fsm's stream transforms are written as self-referential `Scan`
operators although they carry no state — each ignores the scan state and
returns itself (`fs/fsm/module.f.ts:59-67`):

```ts
const stringifyOp: Scan<Entry<SortedSet<string>>, Entry<string>>
    = ([sortedSet, max]) => [[stringifyIdentity(sortedSet), max], stringifyOp]

const scanStringify = scan(stringifyOp)

const fetchOp: Scan<Entry<SortedSet<string>>, SortedSet<string>>
    = ([item, _]) => [item, fetchOp]

const scanFetch = scan(fetchOp)
```

`scan` (`fs/types/list/module.f.ts:232`) exists for *stateful* streaming
transforms; an operator whose only "state" is a reference to itself is an
element-wise projection — exactly what `map`
(`fs/types/list/module.f.ts:117`) expresses directly. The self-referential
idiom makes the reader hunt for evolving state that isn't there.

### Proposal

Replace both with `map`:

```ts
const scanStringify = map(([sortedSet, max]: Entry<SortedSet<string>>) =>
    [stringifyIdentity(sortedSet), max] as const)

const scanFetch = map(([item]: Entry<SortedSet<string>>) => item)
```

Six lines (two ops plus two `scan` wrappers) become two, and the intent —
element-wise projection — is visible in the name. Both consumers
(`toArray(scanStringify(setMap))` at `:74` and `scanFetch(setMap)` at `:76`,
folded at `:77`) consume a `List`, which `map` produces, so laziness and
behavior are unchanged; verify with the existing proof.

### Tasks

- [ ] Replace `stringifyOp`/`scanStringify` and `fetchOp`/`scanFetch` with
      `map` projections; drop the now-unused `scan` import if nothing else
      uses it.
- [ ] `npx tsc` clean; `fjs t` passes (`fs/fsm/proof.f.ts`).

### Related

- `fs/fsm/module.f.ts:59-67` — the two operators; consumers at `:74-78`.
- `fs/types/list/module.f.ts` — `map` (`:117`), `scan` (`:232`).
- `fs/bnf/todo/recognizer-backend.md` — reuses fsm's scan *drivers*; does not
  touch these internal helpers.
