## Paths as bytes

**Priority:** P4
**Status:** open

### Problem

Every `Fs` operation spells a path as a JavaScript `string`, because node does.
A POSIX path is not a string: it is a sequence of bytes that is neither `/`
nor `\0`, and nothing requires it to be valid UTF-8. So a name that is not
UTF-8 cannot be reopened once it has been read — from a directory listing or
from a file:

```js
fs.readdirSync(dir)                      // [ '�' ]   the 0x80 is gone
fs.readdirSync(dir, {encoding:'buffer'}) // [ <Buffer 80> ] the bytes are there
fs.readFileSync(`${dir}/�`)              // ENOENT
```

Two consumers already meet it and record what they refuse or miss until it is
fixed here:

- [`fjs/git/refstore`](../../../git/refstore/module.f.mjs) — a loose ref whose
  name is not UTF-8 is unreachable: the lookup refuses it and the listing
  refuses a lossy name
  ([byte-ref-names](../../../git/refstore/todo/byte-ref-names.md)).
- [`fjs/git/store`](../../../git/store/module.f.mjs) — an
  `objects/info/alternates` line naming such a directory is read as a different
  directory, and so a borrowed object is missed
  ([byte-paths](../../../git/todo/byte-paths.md)).

Node has the primitive: `{ encoding: 'buffer' }` on `readdir`, and a `Buffer`
path for every call that takes one.

### Proposal

A path becomes a byte list at the effects boundary, as a file's contents
already are, with the string form kept as the *spelling* a caller writes,
converted once. Two smaller shapes are worth measuring first:

- **Only the operations that take a path from a file or a listing** take
  bytes, leaving the rest as strings. Smaller, but it splits the vocabulary in
  two.
- **The string stays and carries the bytes unchanged**, as a WTF-8-style
  round-trippable encoding. No API change; a subtle invariant everywhere.

A `NUL` cut belongs here too once a path is a byte list: no system call takes a
path holding one, and today `fjs/git/store`'s `alternatesIn` cuts it itself
because it was the only place that could.

### Tasks

- [ ] Choose among the three shapes, with a measurement of what a non-UTF-8
      path costs the two consumers above.
- [ ] Carry it through `fjs/effects/node`, its virtual runner, and `fjs/path`.
- [ ] Unblock the two consumers.

### Related

- [byte-paths](../../../git/todo/byte-paths.md) and
  [byte-ref-names](../../../git/refstore/todo/byte-ref-names.md) — the two
  consumers, and what each does until this lands.
- [`fjs/path/todo/posix-backslash-names.md`](../../../path/todo/posix-backslash-names.md)
  — a name a host allows and `fjs/path`'s spelling of a path cannot express, one
  layer up.
