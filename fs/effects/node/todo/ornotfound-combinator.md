## `orNotFound` combinator

**Priority:** P4
**Status:** open

`fs/cas/module.f.ts` spells out the same three-way `IoResult` policy in two places: `ok → continue`, `ENOENT → benign default`, `other error → throw`. Add one combinator beside `isNotFound` in `fs/effects/node/module.f.ts`:

```ts
export const orNotFound =
    <O extends Operation, T>(effect: Effect<O, IoResult<T>>) =>
    <N>(notFound: N) =>
    <Q extends Operation, R>(onOk: (value: T) => Effect<Q, R>): Effect<O | Q, R | N> =>
        effect.step<Q, R | N>(r => {
            if (r[0] === 'ok') { return onOk(r[1]) }
            if (isNotFound(r[1])) { return pure(notFound) }
            throw r[1]
        })
```

CAS call sites then carry only their differences:

```ts
read: (key) => orNotFound(readFile(toPath(key)))(undefined)(pure),
list: () => orNotFound(access('.cas'))<readonly Vec[]>([])(() => readdir(...))
```

### Tasks

- [ ] Add `orNotFound` to `fs/effects/node/module.f.ts`.
- [ ] Rewrite `read` and `list` in `fs/cas/module.f.ts` to use it.
- [ ] Cover all three branches (`ok`, `ENOENT`, non-`ENOENT` throw) in `fs/effects/node/proof.f.ts`.

### Related

- `208-try-catch-consolidate` (now `fs/types/result/todo.md`) — consolidating `tryCatch` helpers that *produce* `IoResult`; this is about *consuming* one uniformly. Complementary.
