## Open a FIFO without blocking, as the Node runner does

**Priority:** P4
**Status:** open

### Problem

`open` of `fjs/effects/node/types.ts` opens without blocking (`O_NONBLOCK`), so
a FIFO with no writer is opened, `fstat` says `isFile: false`, and the caller
closes it. `std` names no such flag, and the crate has no dependency that does,
so `files::open` refuses a path whose metadata says it is a FIFO, with
`ERR_NOT_A_FILE`, as `readWhole` does, rather than block the host for good.

A caller that opens a FIFO to learn what it is gets an error where the Node
runner answers a handle. It refuses the entry either way; only the way it learns
differs.

### Tasks

- [ ] Open with `O_NONBLOCK` where the platform names it, and drop the refusal.
