## positional-arity-check. Positional-argument arity validation is hand-rolled per command

**Priority:** P5
**Status:** open

### Problem

`fjs/cli`'s `dispatch` owns command routing and help, but no arity
validation, so each handler re-implements "exactly N required positional
args, else `errorExit`". Two consumers today, in
`fjs/cas/cli/module.f.ts`:

```ts
// add (:26-29)
handler: ({ home, args: [path, ...rest] }) => {
    if (path === undefined || rest.length !== 0) {
        return errorExit("'cas add' expects one parameter")
    }
// get (:40-43)
handler: ({ home, args: [hashCBase32, path, ...rest] }) => {
    if (hashCBase32 === undefined || path === undefined || rest.length !== 0) {
        return errorExit("'cas get' expects two parameters")
    }
```

### Proposal

A combinator in `fjs/cli/module.f.ts`, the layer that already owns
`Command`/`dispatch`:

```ts
export const exact = <O extends NodeOp>(name: string, n: number) =>
    (run: (args: readonly string[], o: NodeProgramOptions) => Effect<O, number>) =>
    (o: NodeProgramOptions): Effect<O | Write, number> =>
        o.args.length === n
            ? run(o.args, o)
            : errorExit(`'${name}' expects ${n} parameter${n === 1 ? '' : 's'}`)
```

`add`/`get` wrap their bodies in `exact('cas add', 1)` /
`exact('cas get', 2)` and destructure a known-length `args`. A richer
declarative variant — `Command` gaining an optional `arity`/`params` field
that `dispatch` validates and folds into the help text — fits the repo's
data-driven-registry preference better; choose whichever the
`66g-fjs-run-commands` reshaping of `Commands` prefers, and land this
alongside that work rather than as a standalone micro-PR.

### Tasks

- [ ] Pick combinator vs `Command`-field validation (coordinate with
      `fjs/todo/66g-fjs-run-commands.md`).
- [ ] Migrate `cas add` / `cas get`; keep their error strings.
- [ ] `npx tsc`, `fjs t`.

### Related

- `fjs/todo/66g-fjs-run-commands.md` — the `Commands` reshaping this
  should ride along with.
- `fjs/cas/cli/module.f.ts:26-29,40-43` — the two current copies.
