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
  cannot ask whether the loose file that would shadow a `packed-refs` line is
  there. Unknowable is not absent, so it refuses rather than answer the packed
  line — which would be a stale id in exactly the state the host cannot observe.
  A packed-only name is refused with it, which is the cost of not guessing.
- [`tryRoots`](../module.f.mjs) *does* look, so it answers: the walk reads every
  entry of `refs/`, and a loose file it cannot name is one it is handed as `�`,
  re-encodes as `0xEF 0xBF 0xBD`, and then fails to read — which this module
  reports on the channel, since a file a listing named and a read cannot find is
  a broken host. So a packed name with no such file is listed correctly, and one
  with such a file refuses the whole listing. Neither answer is a guess.

  That read failing is what makes the limitation announce itself, and it is only
  guaranteed while the lossy name matches no other file. Put a file whose name
  really *is* U+FFFD beside one named `0x80` and the read succeeds: measured on
  node 22, `readdir` answers two entries both named U+FFFD and a read of that
  name answers the valid file's bytes both times, so a walk that read on would
  list one id twice under one name and drop the other ref in silence. A
  retention root missing is worse than a refusal, so the walk refuses a listing
  that carries one name twice — `lossyNameCode` — and that refusal is this
  issue's other half rather than its fix: the pair is *two* refs, and answering
  both needs the byte-oriented listing below.

The two halves therefore disagree about a packed-only name: the listing has it
and the lookup will not answer for it. That is the honest shape of the
limitation rather than a bug in one of them — one half looked and the other
cannot — and it is what this issue removes.

The state that makes the lookup's refusal necessary cannot be built in a proof
here either: the virtual filesystem spells a directory entry as a `string`, so a
fixture cannot hold a file whose name is not UTF-8. A reader that answered from
the packed line would be answering a state its own tests cannot reach. The
colliding listing above can be proven, because what reaches this module is the
host's *answer* and a mock host can give the answer node gives — two entries of
one name — without holding two such files.

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
