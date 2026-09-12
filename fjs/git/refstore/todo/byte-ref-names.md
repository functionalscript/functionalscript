## A ref name is bytes and this host's path is text

**Priority:** P4
**Status:** open

### Problem

A ref name is bytes. Git takes any byte its name rule allows, with no encoding
requirement, and a name that is not valid UTF-8 is an ordinary ref — measured
on Git 2.43.0, where `\x80` is one byte of the name:

```
$ git check-ref-format $'refs/heads/\x80'     # accepted
$ git show-ref                                # lists it
$ git rev-parse $'refs/heads/\x80'             # resolves it, packed or loose
```

The effects this module reads through spell a path as a `string`, because node
does. That is lossless for every name node decoded *from* UTF-8 and lossy for
every other, in a way that cannot be undone:

```js
fs.readdirSync(dir)                      // [ '�' ]   the 0x80 is gone
fs.readdirSync(dir, {encoding:'buffer'}) // [ <Buffer 80> ] the bytes are there
fs.readFileSync(`${dir}/�`)         // ENOENT
```

So a loose ref whose name is not UTF-8 is unreachable here. Two halves of this
module meet it differently, and neither is right:

- [`tryResolve`](../module.f.mjs) cannot build a path for such a name, so it
  treats the loose file as absent and answers the `packed-refs` line. That is
  the only answer the host can give and it is wrong where such a loose file
  exists and shadows a packed line: Git answers the loose id.
- [`tryRoots`](../module.f.mjs) walks `refs/` through `readdir`, so it is handed
  `�` for that entry, encodes it back as `0xEF 0xBF 0xBD`, and then fails
  to read the file it was just told about — which this module reports on the
  channel, since a file a listing named and a read cannot find is a broken host.
  So one such file refuses the whole listing.

A packed name is unaffected in both: it never becomes a path, and both halves
answer it correctly.

### Proposal

The fix is not in this module: it is a `readdir` and a `readFile` that speak
bytes, which is a question for [`fjs/effects/node`](../../../effects/node/).
Node has the primitive — `{ encoding: 'buffer' }` on `readdir`, and a `Buffer`
path for `readFile` — so the operations could carry `Bytes` beside the `string`
they carry now, and this module would use the byte form for a name and keep the
text form for the directory it was given.

Until then the limitation is the host's and is written down here rather than
worked around: a byte-oriented path API is a change to the effects, and pushing
it into this module would mean guessing which of two files a lossy name meant.

### Related

- [`fjs/path/todo/posix-backslash-names.md`](../../../path/todo/posix-backslash-names.md)
  — the same shape one layer down: a name a host allows and this module's
  spelling of a path cannot express.
- [`fjs/git/refstore/module.f.mjs`](../module.f.mjs) — `nameText`, where the
  decision is made and measured.
