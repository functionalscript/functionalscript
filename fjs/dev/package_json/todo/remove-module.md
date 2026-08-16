# Remove `fjs/dev/package_json`

**Priority:** P3
**Status:** open

## Problem

The module has **no consumers anywhere in the repository**, and it is the only
place left that needs the reader shape the project just decided against.

When `validate` was deleted and its nine importers moved to `parse`, eight
migrated by changing an import. This one did not: its proof asserted
`Object.is(result, input)`, and it is documented as reading metadata *"without
losing unrelated fields before write-back"*. So it now parses for the check and
returns the value it was given:

```js
export const validatePackageJson = value =>
    mapOk(() => /** @type {PackageJson} */ (value))(parseShape(value))
```

That is a deliberate local exception, and it is carrying its weight for nobody.

## Why removing beats keeping

- **Nothing uses it.** No `.mjs`, `.ts`, `.json`, or workflow file outside
  `fjs/dev/package_json/` mentions it.
- **Nothing else in-tree parses `package.json` either**, so there is no
  obvious caller waiting to be wired up. `fjs/ci` is the only other module that
  touches the file: two of its mentions are comments
  (`ci/config/module.f.mjs:25`, `ci/deno/module.f.mjs:7`), and the third
  (`ci/proof.f.mjs:34`) puts a `package.json` entry into a *virtual* filesystem
  so the CI generator can be tested against a Node-shaped repo. `fjs/ci` cares
  whether the file exists, never what is in it.
- **The preservation it protects has no beneficiary.** The module offers no
  write-back function — only `validatePackageJson` and
  `validatePackageJsonText`. A caller that reads a `package.json` in order to
  rewrite it already holds the parsed object; handing the same reference back
  saves it nothing it did not have.
- **It is small enough to not be worth a home.** The whole schema is three
  optional fields:

  ```js
  { name: option(string), version: option(string), scripts: option(record(string)) }
  ```

  A consumer that needs this can declare it and call `parse` in a few lines,
  against the same rtti the module uses.
- **It keeps one exception alive in the tree.** "Check the shape, return the
  original" is exactly the reader shape that was retired. Leaving one instance
  of it invites the next reader to treat it as a supported pattern.

## Before removing

- **This is a breaking change to the published surface.** `package.json` has no
  `exports` map and `files` is `["**/*.js", "**/*.d.ts", "**/*.mjs",
  "**/*.d.mts"]`, so every module is deep-importable from the npm package.
  `fjs/dev/package_json/module.f.mjs` is reachable today even though nothing
  in-tree reaches for it. Mark the changelog entry `**BREAKING CHANGES:**`.
- **Coverage.** `proof.f.mjs` goes with the module; removing both keeps the
  aggregate at 100%, but confirm with `npm run cov` rather than assuming.
- Do not preserve the schema somewhere "just in case" — that is how a module
  with no consumers becomes two files with no consumers.

## If removal is rejected

Two ways to make it earn its place, either of which resolves this issue:

1. **Give the preservation a purpose** — add the write-back function the module
   header implies, so returning the original object is load-bearing rather than
   a property only a proof observes.
2. **Drop the preservation** — let `validatePackageJson` be `parse(schema)`
   like every other call site, delete the `Object.is` proof, and accept that
   undeclared fields do not survive. The cast and its explanation go away with
   it.

Option 2 is the smaller change and leaves nothing exceptional behind, but it
silently changes what a caller gets, which is why it was not taken when
`validate` was deleted.

## Tasks

- [ ] Confirm no consumer has appeared since this was filed.
- [ ] Delete `fjs/dev/package_json/` (module, proof, and this file).
- [ ] `npx tsc`, `fjs t`, `npm run cov`.
- [ ] Changelog entry prefixed `**BREAKING CHANGES:**` — a published module is
      going away.

## Related

- `fjs/types/rtti/README.md` — "Structs and tuples are open"; `parse` is the
  reader every other site now uses.
- `fjs/dev/package_json/module.f.mjs` — `validatePackageJson`'s comment
  explains the exception this issue proposes to end.
