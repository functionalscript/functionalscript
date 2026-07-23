# `run` handler should use `result.unwrap`

**Priority:** P5
**Status:** open

## Problem

The `fjs run` command handler in `fjs/module.f.ts:44-51` hand-rolls the
throw-on-error unwrap of the `import_` result:

```ts
handler: options => {
    const [file, ...args] = options.args
    return import_(file).step(([s, v]) => {
        if (s === 'error') { throw v }
        return (v.main as NodeProgram)({ ...options, args })
    })
},
```

This re-implements `unwrap` from `fjs/types/result/module.f.ts:59-62`
byte-for-byte (destructure the `Result`, throw the error payload on
`'error'`, otherwise return the value). `fjs/dev/module.f.ts:77` already
unwraps the *same* `import_` result through the owner:

```ts
import_(f).step(r => pure([[f, unwrap(r)] as const]))
```

## Proposal

Import `unwrap` from `../types/result/module.f.ts` in `fjs/module.f.ts` and
collapse the handler body:

```ts
handler: options => {
    const [file, ...args] = options.args
    return import_(file).step(r => (unwrap(r).main as NodeProgram)({ ...options, args }))
},
```

One call site; no behavior change (the thrown value is still the error
payload). Independent of `fjs/todo/66g-fjs-run-commands.md` (which widens
the accepted `main` type) but can ride along with it.

## Tasks

- [ ] Replace the inline `if (s === 'error') { throw v }` with `unwrap`.
- [ ] Run `npx tsc` and `fjs t`.

## Related

- `fjs/types/result/module.f.ts:59` — the owner of `unwrap`.
- `fjs/todo/66g-fjs-run-commands.md` — reshapes the same handler.
