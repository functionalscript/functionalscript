# Validating the packed npm package against clean consumers

This is the manual method used by
[#1520](https://github.com/functionalscript/functionalscript/pull/1520),
reusable until a committed CI fixture from
[`todo/f-mjs-package-support.md`](./todo/f-mjs-package-support.md) replaces it.

The package ships `.mjs` runtime, `.d.mts` / `types.d.ts` declarations, and no
`.js` files. The emitted declarations reference `…/types.ts` specifiers that name
no shipped file, so the thing to prove for every consumer toolchain is that those
specifiers resolve to the shipped `types.d.ts` — genuinely, not as an `any`
fallback. This file records the consumer sources and the per-runtime
install-from-file commands, all verified on tsc 5.9.3 / 7.0.2, Node v22,
Bun 1.3.11, and Deno 2.9.5.

## Consumer sources

Four files in an empty directory. `test.ts` exercises runtime and types;
`bad.ts` is the negative control proving type resolution is real — it must
**fail** with TS2322 under every checker.

The `import type` form in `test.ts` is load-bearing, not stylistic; see
[`types.js` is not a real module](#typesjs-is-not-a-real-module) below.

`package.json`:

```json
{ "type": "module", "private": true }
```

`tsconfig.json` (deliberately default-ish: no `allowImportingTsExtensions`):

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "es2023",
    "strict": true,
    "noEmit": true
  }
}
```

`test.ts`:

```ts
import { length, toArray } from 'functionalscript/fjs/types/list/module.f.mjs'
import type { List } from 'functionalscript/fjs/types/list/types.js'
const l: List<number> = [1, 2, 3]
console.log(length(l), toArray(l))
```

`bad.ts`:

```ts
import type { List } from 'functionalscript/fjs/types/list/types.js'
const l: List<number> = 'not a list'
console.log(l)
```

## Build the tarball

From a clean checkout (`files` still lists `**/*.js`, so a working tree holding
stale pre-declaration-only emit would ship it):

```sh
npm pack --pack-destination <dir>
```

## Install from the tarball file and verify

Node (also produces the `node_modules` that Deno checking uses below):

```sh
npm install <dir>/functionalscript-0.44.0.tgz
npx tsc -p .                          # type-check; must fail on bad.ts only
node --experimental-strip-types test.ts
```

Bun (its own installer accepts the tarball directly):

```sh
bun add <dir>/functionalscript-0.44.0.tgz
bun run test.ts
bun build test.ts --outdir out --target node && node out/test.js
```

Deno — run and check on top of npm- or Bun-installed `node_modules`:

```sh
deno run --allow-read test.ts
deno check test.ts                    # and: deno check bad.ts must fail TS2322
```

`#1520` itself extracted the tarball manually
(`tar xzf … && mv package node_modules/functionalscript`, dependency declared as
`"functionalscript": "*"`), which produces the same layout as the installers.

## `types.js` is not a real module

A `…/types.js` specifier resolves to the shipped `types.d.ts` for type
checking, but names no runtime module — the package ships no `types.js` files.
The only supported import is therefore the fully erased `import type { X }`
(or JSDoc `@import`); the rule is stated in `fjs/AGENTS.md` §3.2. The inline form
must not be used:

`inline.ts`:

```ts
import { type List } from 'functionalscript/fjs/types/list/types.js'
const l: List<number> = [1, 2, 3]
console.log(l)
```

What makes this form dangerous is that every type checker accepts it — the
failure is runtime-only, and whether it hits depends on whether the toolchain
*elides* an import statement left without value bindings or merely *strips*
the type syntax and keeps the statement. Measured against the packed tarball:

| toolchain | type check | runtime |
| --- | --- | --- |
| tsc, `verbatimModuleSyntax: true` | passes | emits retained `import {}` -> `ERR_MODULE_NOT_FOUND` |
| tsc, default elision | passes | import elided, runs |
| Node `--experimental-strip-types` | — | `ERR_MODULE_NOT_FOUND` |
| Bun 1.3.11 `bun run` | — | import elided, runs |
| Deno 2.9.5 | `deno check` passes | `deno run` -> `ERR_MODULE_NOT_FOUND` |

The repository's own `tsconfig.json` sets `verbatimModuleSyntax: true`, which
is the first failing row — a consumer copying the repository's settings gets
the failure, and one relying on default elision writes code that breaks the
moment a colleague runs it under Node or Deno. `import * as` behaves exactly
like the inline form: default tsc elision drops a namespace import used only
in type positions (measured: `import * as T from '…/types.js'` with a
`T.List<number>` annotation compiles to no import and runs), while
`verbatimModuleSyntax` and type stripping keep it and fail. Bare side-effect
imports are never elided by any toolchain, so those fail everywhere.

## Deno caveats measured on 2.9.5

Do not hand Deno the tarball or the unpacked directory as a `file:` dependency:

- `"functionalscript": "file:….tgz"` — `deno install` exits 0 but materializes
  a broken `deno@0.0.0` entry; nothing resolves.
- `"functionalscript": "file:./package-dir"` — `deno run` works, but
  `deno check` fails with TS2307 on every `…/types.ts` specifier.

The second failure locates the boundary of Deno's `.ts` -> `.d.ts`
substitution: Deno applies it to packages resolved *as npm packages through
`node_modules`* (registry installs behave the same), but a `file:`-linked
directory is treated as first-party source, where a `.ts` specifier must name a
real file. That first-party behavior is what the migration documents originally
generalized into "Deno does not substitute"; for the published npm package the
substitution does apply, which is why shipping only `types.d.ts` works.
