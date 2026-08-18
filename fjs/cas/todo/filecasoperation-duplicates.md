## `FileCasOperation` lists three members twice

**Priority:** P5
**Status:** open

### Problem

`types.ts:19-22`:

```ts
export type FileCasOperation =
    | ReadBytes | Mkdir | Readdir | Access | Rename | Rm
    | RandomInt | Now | CreateExclusive | WriteBytes | Stat
    | Now | Readdir | Rm
```

`Now`, `Readdir`, and `Rm` appear twice. Harmless for a union type, but it is
copy-paste residue in a type whose doc comment enumerates the members one by
one, and it misleads a reader into hunting for a difference.

### Tasks

- [ ] Drop the duplicate line
