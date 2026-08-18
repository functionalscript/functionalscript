## 66G-fjs-run-commands. `fjs run` should accept `Commands` as `main`, not just `NodeProgram`

**Priority:** P3
**Status:** open

### Problem

`fjs run <module>` imports the target module and calls `v.main` as a
`NodeProgram`. When a module naturally expresses its interface as a `Commands`
array (as `fjs/cas/module.f.mjs` now does), it must also export a redundant
`export const main = dispatch(commands)` solely to satisfy `fjs run` — see the
fix in [#1093](https://github.com/functionalscript/functionalscript/pull/1093)
that had to restore exactly this boilerplate after it was removed.

### Proposal

`main` remains the single conventional entry point. Extend its type to
`NodeProgram | Commands<NodeOp>` and resolve the union inside `runEffect` and
`run` in `fjs/effects/node/module.mjs` — the canonical entry into the Node
runtime. Every downstream caller (`fjs run`, bin scripts) already goes through
`runEffect`/`run`, so no caller needs to change.

```ts
// fjs/effects/node/module.f.mjs
export type NodeMain = NodeProgram | Commands<NodeOp>
```

Widen `dispatch` in `fjs/cli/module.f.mjs` to accept either a `Commands` array
or a `Program` function, and short-circuit to the function when it receives one:

```ts
export const dispatch = <O extends NodeOp>(p: Commands<O> | Program<O>) =>
    (options: NodeProgramOptions): Effect<O | Write, number> =>
        typeof p === 'function' ? p(options) : /* existing dispatch logic */
```

Then `runEffect` and `run` simply widen their parameter to `NodeMain` and
always go through `dispatch` — no `Array.isArray` check needed at the call site:

```ts
export const runEffect = (p: NodeMain): Promise<number> =>
    runNodeEffect(dispatch(p)(options))
```

`fjs run` in `fjs/module.f.mjs` passes `v.main` straight to the effect
runner and needs no change. The `export const main = dispatch(commands)`
wrapper in `fjs/cas/module.f.mjs` simplifies to `export const main = commands`.

### Tasks

- [ ] Export `NodeMain = NodeProgram | Commands<NodeOp>` from
      `fjs/effects/node/module.f.mjs`.
- [ ] Widen `runEffect` and `run` in `fjs/effects/node/module.mjs` to accept
      `NodeMain`; resolve the union with `Array.isArray` before invoking.
- [ ] Simplify `fjs/cas/module.f.mjs`: `export const main = commands` (drop the
      `dispatch` wrapper).
- [ ] Add a proof in `fjs/proof.f.mjs` covering the `Commands`-as-`main` path.

### Related

- `fjs/module.f.mjs` — the `run` handler at line 39.
- `fjs/cas/module.f.mjs` — the `main = dispatch(commands)` boilerplate this issue
  eliminates.
- `fjs/cli/module.f.mjs` — `dispatch` used by the new branch; `Commands`
  is defined in `fjs/cli/types.ts`.
