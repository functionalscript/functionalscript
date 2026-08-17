## Keep the root of an absolute path

**Priority:** P3
**Status:** open

### Problem

[`parse`](../module.f.mjs) splits a path on `/` and drops every empty segment,
so the leading empty segment that *is* the POSIX root disappears with them:

```js
normalize('/a/b/m.f.js')      // 'a/b/m.f.js'   — absolute became relative
concat('/a/b/m.f.js')('..')   // 'a/b'
parse('/a/b')                 // ['a', 'b']
concat('//srv/share/m.f.js')('..')  // 'srv/share'  — UNC root lost too
normalize('/')                // ''
```

`foldNormalizeOp` treats `''` as noise:

```js
case '': case '.': { return state }
```

That is right for an interior empty segment — `a//b` is `a/b` — and wrong for
the first one, which is not a missing name but the root marker. A Windows
drive letter survives only because `C:` happens to be a non-empty segment.

`fjs compile` shows the consequence. The transpiler resolves an import with
`concat(concat(path)('..'))(importPath)`
([`fjs/djs/transpiler/module.f.mjs`](../../djs/transpiler/module.f.mjs)), so
naming the input by an absolute path turns every import into a path resolved
against the current directory instead:

```sh
$ cd /tmp/x && fjs compile m.f.js out.json     # m.f.js imports ./lib.f.js
$ cat out.json
[{"port":8080}]

$ fjs compile /tmp/x/m.f.js out.json           # the same module, named absolutely
/tmp/x/m.f.js - error: file not found
```

The file named in that message exists; the one that was not found is
`tmp/x/lib.f.js`, looked for under the current directory. A module with no
imports compiles from an absolute path, because the file named on the command
line is read with the path as given and only imports go through `concat`.

The limitation is already worked around at the one other call site it breaks,
[`fjs/effects/node/module.mjs`](../../effects/node/module.mjs):

```js
const s0 = v.includes(':') || v.startsWith('/') ? v : concat(process.cwd())(v)
```

The `v.startsWith('/')` test exists because `concat` would eat the root.

`fjs/cas` and `fjs/effects/node/virtual` also parse absolute paths, and both
happen to be unaffected: each compares or slices two paths that went through
the same function, so the missing root cancels out. They would still be
simpler to reason about with a root that survives.

### Proposal

Split the root off the string before folding the segments, and put it back
afterwards:

- root is `//` for a UNC path, `/` for a POSIX absolute path, and `''`
  otherwise — a drive letter needs no special case, since it is already a
  segment;
- `..` may not escape a root that exists: `/a/../..` is `/`, while `a/../..`
  stays `..`, which is what `foldNormalizeOp`'s `'..'` branch already does for
  the relative case.

`parse` returns `readonly string[]` and is exported, so the root has to reach
its callers somehow — as a separate return value, or by a second function that
answers whether a path is absolute. Both are breaking changes to a small API
with three callers; pick the one that reads better at those call sites rather
than the one that preserves the current signature.

### Tasks

- [ ] Keep the root through `parse`, `normalize`, and `concat`, including the
      UNC form, and stop `..` from escaping it.
- [ ] Decide how `parse` reports the root, and update `fjs/cas` and
      `fjs/effects/node/virtual` for the new shape.
- [ ] Drop the `v.startsWith('/')` workaround in
      `fjs/effects/node/module.mjs` once `concat` is safe for absolute paths.
- [ ] Proofs for `/a/b`, `//srv/share`, `C:/a/b`, `/`, `/a/../..`, and an
      interior `a//b`, keeping 100% coverage.
- [ ] A `fjs/djs` proof that a module named by an absolute path resolves its
      imports.
- [ ] `npx tsc`, `fjs test`.

### Related

- [`fjs/djs/transpiler/module.f.mjs`](../../djs/transpiler/module.f.mjs) — the
  call site that turns this into a compile failure.
- [parse-error-location-format](../../djs/todo/parse-error-location-format.md)
  — why the failure names the compiled file instead of the import it could not
  find. Fixing the path bug removes the common way to hit that message, not the
  misattribution itself.
