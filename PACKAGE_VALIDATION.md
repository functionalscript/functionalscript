# Validating the packed npm package against clean consumers

This is the manual method used by
[#1520](https://github.com/functionalscript/functionalscript/pull/1520),
reusable until a committed CI fixture from
[`fjs/ci/todo/f-mjs-package-support.md`](./fjs/ci/todo/f-mjs-package-support.md)
replaces it.

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
