## export-drive-predicates. Two git modules rewrite `fjs/path`'s drive predicates, and one disagrees

**Priority:** P3
**Status:** open

### Problem

`fjs/path` decides what a Windows drive looks like with three private
predicates, and two git modules rewrite them because they are private:

```js
// fjs/path/module.f.mjs — the owner, unexported
const isDriveLetter = c => (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')
const isDriveRoot = p => p.length >= 3 && p[1] === ':' && p[2] === '/' && isDriveLetter(p[0])
const isBareDrive = p => p.length === 2 && p[1] === ':' && isDriveLetter(p[0])

// fjs/git/repo/module.f.mjs — isDriveLetter byte-identical, isBareDrive with its clauses swapped
const isAbsolute = path =>
    path.startsWith('/') || (isDriveLetter(path[0]) && path[1] === ':' && path[2] === '/')
const isBareDrive = path => path.length === 2 && isDriveLetter(path[0]) && path[1] === ':'

// fjs/git/store/module.f.mjs — the third reading, with no letter test at all
const isDrive = x => x.length > 1 && x[1] === ':'
const isWindows = od => isDrive(root(od))
const isAbsolute = (od, entry) => entry.startsWith('/')
    || ((entry.startsWith('\\') || isDrive(entry)) && isWindows(od))
```

`repo`'s doc concedes the copy — "the same reading `fjs/path` takes of a
drive, and the same limitation it records" — and `fjs/path`'s `under` doc
already reasons about `repo`'s bare-drive refusal by name. `store`'s copy is
not a copy but a divergence: `1:/donor/objects` and `::` pass `isDrive`, so
on an object directory that is itself drive-rooted such an `alternates`
entry is handed to the host as absolute, where `fjs/path` and `repo` both
read it as relative and join it below `objects/`. Two readers of one string
disagree, which is what `isWindows`'s own doc says the drive test exists to
prevent.

### Proposal

Export the three predicates from `fjs/path`; they are one line each and
already documented there. `repo` drops all three of its own — `isAbsolute`
becomes `path.startsWith('/') || isDriveRoot(path)`, which shows its
deliberate narrowing (no UNC, no leading `\`) as one visible difference from
`root(path) !== ''` — and `store`'s `isDrive` becomes a `isDriveLetter`
check through the same export, so the fix and the deduplication are one
edit.

### Tasks

- [ ] Export `isDriveLetter`, `isDriveRoot`, `isBareDrive` from `fjs/path`
      with proof cases for `1:/x` and `::`.
- [ ] `fjs/git/repo` and `fjs/git/store` import them; `store`'s proof pins
      that `1:/donor/objects` is relative on a drive-rooted store.
- [ ] `tsc`, `fjs test`.

### Related

- [decode-once.md](./decode-once.md) — `fjs/path`'s internal sharing; this
  issue is about its exports.
- [`../../git/todo/byte-paths.md`](../../git/todo/byte-paths.md) — would
  ask the host which roots it has; until then the string reading should at
  least be one.
