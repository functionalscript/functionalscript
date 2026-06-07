# 667-fjs-ci-command. Add `fjs ci` command to generate CI workflow

**Priority:** P3
**Status:** done

## Problem

Generating a CI workflow currently requires knowing an internal path:

```sh
node ./fs/fjs/module.ts r ./fs/ci/module.f.ts
```

This is exposed in `package.json` as `npm run ci-update`, but it is not available as a
first-class `fjs` command. Other projects that install FunctionalScript as a dependency
and want the standard CI generator have no simple entry point.

## Proposal

Add `fjs ci` (alias `fjs i`) as a built-in command in `fs/fjs/module.f.ts`:

```ts
case 'ci':
case 'i':
    return ciMain(rest)
```

`ciMain` imports and runs the default effect from `fs/ci/module.f.ts` (the same effect
that `npm run ci-update` runs today). Rust support is detected automatically via
`access('Cargo.toml')`, so no arguments are required for the common case.

After this change, any project that has FunctionalScript installed can regenerate its
GitHub Actions workflow with:

```sh
fjs ci
```

Installed projects can call the package bin directly. `package.json` in this repo
uses the same built-in command through the checked-in Node entry point, because `npm`
scripts do not put the current package's own `bin` declaration on `PATH` before the
package is installed:

```json
"ci-update": "node ./fs/fjs/module.ts ci"
```

## Customisation

Projects that need a custom `Setup` (extra steps for Node, Deno, or Bun) should
continue to use `fjs r <their-ci-module>`.

## Related

- `fs/fjs/module.f.ts` — command dispatcher
- `fs/ci/module.f.ts` — `ci(setup)` function and `default` export
- `package.json` — `ci-update` script
- [667-fjs-run-main-convention.md](./667-fjs-run-main-convention.md) — proposes
  switching `fjs r` from `v.default` to `v.main`
