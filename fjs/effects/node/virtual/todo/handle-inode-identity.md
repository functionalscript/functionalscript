## handle-inode-identity. An open handle does not see a write to its own file

**Priority:** P2
**Status:** open

### Problem

A program that opens a file and then writes to the same path reads the **old**
bytes back through the open handle here, and the **new** bytes on a host. So a
proof can pass against contents production will not return.

Measured, `open('a.bin')` then a write of `NEW` over `old`, then `fstat` and
`pread` through the handle:

| | handle reads |
|---|---|
| host, Darwin, Node 23.11.0 | `NEW` |
| this runner | `old` |

`openOp` (`../module.f.mjs`) stores the resolved `_Entity` in the handle:

```js
{ ...s, handles: [...s.handles, { id, entity: resolved[1] }], handleNext: id + 1 }
```

A `_Entity` is an immutable value. `writeFile` and `writeBytes` replace the root
entry with a new array, and the handle goes on holding the one it captured, so
`pread` answers the bytes that were there at open time and `fstat` answers the
size that was there at open time. The measurement above used a replacement of the
same length on purpose, so that only the bytes differ; a shorter or longer one
makes `fstat` disagree too.

There is no sequence that makes this visible in the tree today — `fjs/web` opens,
`fstat`s and `pread`s one path and writes nothing — so nothing that ships is
wrong. What is wrong is the model: the virtual runner is the thing proofs are
written against, and it answers a question about a live file with a snapshot.

### It is a write that must reach the handle, and a rename that must not

The two look alike here and are opposites on a host, which is why this cannot be
fixed by making a handle re-read its name.

| while a handle is open | the host's handle | this runner |
|---|---|---|
| `rename` puts another file at the name | keeps its own bytes | keeps its own bytes |
| `writeFile` writes the name | sees the new bytes | keeps the old bytes |

The first row is already proven, twice and on purpose: `open.namesAnInode` in
[`../../proof.mjs`](../../proof.mjs) settles it through a real descriptor, and
`handles.namesAnInode` in [`../proof.f.mjs`](../proof.f.mjs) models it here on every
platform, Windows included. `Open` in [`../../types.ts`](../../types.ts) says why it
is a requirement rather than a nicety: a path is resolved once per call, so a caller
reading a file in windows can straddle two of them, and a response framed by one
entry's size can then carry another entry's bytes. A handle must **not** follow the
name.

What a host handle follows is the *inode*: the same object the name pointed at when
it was opened, whatever the name points at now. A rename changes which inode the
name means and leaves the handle's alone; a write changes the contents of the inode
the handle is holding. This runner has no inode to tell those apart — a `Dir` maps
a name straight to an `_Entity` value, so "the file this handle holds" and "the
file this name holds" are the same sentence, and the only way to model one row is
to break the other.

### Two shapes that would fix it

1. **Give the file system inode identity.** A `Dir` maps a name to an id, and a
   table maps the id to the contents. A handle holds the id. A write through a
   name finds the id and replaces the contents, which every handle on that id
   then sees; a `rename` moves the name and leaves the id alone, which is what a
   host does too. This is the faithful model and it touches every operation in
   the file system, so it is its own change and not a corner of one.

2. **Refuse the sequence.** A write to a path with an open handle on it answers a
   refusal rather than a plausible snapshot, which is what
   [DESIGN.md §10](../../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle) asks
   of an input a runner cannot handle. Cheap, and it stops a proof passing on a
   wrong answer. What it costs is that the refusal is words no host produces, and
   a refusal a program is proven against is meant to be the refusal it meets —
   the rule `refusalMessage` exists to keep for the gates. So this is a stopgap,
   and would have to be labelled one.

The first is the one worth doing. The second is worth doing first only if
something in the tree is about to write through a path it holds open.

### Where it was found

Codex's review of [#2313](https://github.com/functionalscript/functionalscript/pull/2313),
which added the handle effect that made handles outlive the operations that
created them. The gap arrived with the handles; it is not a regression in
anything that was there before.
