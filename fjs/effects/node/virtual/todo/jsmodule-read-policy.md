## A read of a non-regular entry panics where a host fails

**Priority:** P3
**Status:** open

### Problem

`readFile` and `readBytes` in [`../module.f.mjs`](../module.f.mjs) answer a
`JsModule` by throwing — `jsModuleUnsupported`, reached through `resolveFile`.
`writeBytes` answers the same entry with an `IoResult` error, and the asymmetry
is deliberate today: it was settled that way in
[#1845](https://github.com/functionalscript/functionalscript/pull/1845), where
unifying the three on the throw was a regression the review caught.

The argument that saved `writeBytes` applies to the two reads as well. A
`JsModule` is this file system's stand-in for a name that exists and is not a
regular file — a FIFO, a device, a socket, which is what `stat`'s `notRegular`
says it is. A host does not panic when a program reads one: `open` succeeds and
the read fails with an ordinary errno, which `ReadFile` and `ReadBytes` in
[`../../types.ts`](../../types.ts) both promise as an `IoResult`. So a caller's
branch for *that* failure has no fixture here. It cannot be reached, let alone
proven, because the only entry that could produce it panics instead — and
nothing in FunctionalScript catches a panic.

This is not a crash waiting for a real input. A `JsModule` exists only in a
fixture, so the throw is reached only by a fixture author, and today it tells
them something true: pointing a read at a module is usually a mistake. The
question is whether that is worth the proof it costs.

### Proposal

Not decided; the two answers are not equally cheap.

- **Make the reads fail like `writeBytes`.** `jsModuleUnsupported` goes, all
  three share `jsModuleNotAFile`, and the read-a-special-file branch becomes
  provable. It costs the loud signal for a mis-aimed fixture, and it changes
  behavior two proofs currently pin under `throw`.
- **Give the file system a real non-regular entry** and leave `JsModule` alone
  as "a module, which reads do not support". A read of *that* entry fails with
  an `IoResult` and the proof exists without touching the module case. This is
  the same fourth `_Entity` case [dirent-kinds](./dirent-kinds.md) needs, so
  the two should be decided together rather than twice.

### Tasks

- [ ] Decide which of the two, with [dirent-kinds](./dirent-kinds.md) in view.
- [ ] Pin a read of a non-regular entry that fails as a value, in
      [`../proof.f.mjs`](../proof.f.mjs).

### Related

- [dirent-kinds](./dirent-kinds.md) — `readdir` has two entry kinds where a host
  has three; a link entry there is the non-regular entry this wants.
- [`../../../AGENTS.md`](../../../AGENTS.md) — a throw is a panic, and
  recoverable failure belongs in `Result`; the rule both halves of this turn on.
