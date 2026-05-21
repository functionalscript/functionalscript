# 153. Write Queue for Atomic Async Output

Asynchronous writes to `stdout` and `stderr` via the `Write` effect ([i152](./152-write-effect.md)) create a race condition: if two effects call `write` concurrently, their byte sequences can interleave and corrupt each other's output.

## Use case

```ts
// Print many large messages concurrently — e.g. test results arriving in parallel.
await Promise.all(results.map(r => write('stdout', encode(r))))
```

Without a queue, the byte sequences of large messages overlap in the output. With the queue, each message is enqueued atomically and drained in submission order, so the output is always coherent even though the writes proceed concurrently from the caller's perspective.

## Problem

Node.js streams are not atomic. Concurrent `fs.write(fd, buffer)` calls may partially overlap if buffers are large enough to be split across multiple OS write calls. Even small writes can interleave when scheduled across async ticks.

## Solution

Each output stream (`stdout`, `stderr`) needs a **queue** — a serial executor that:

1. Accepts write requests without blocking the caller (fire-and-forget from the effect's perspective)
2. Drains requests one at a time, preserving submission order
3. Guarantees each message is written atomically (no interleaving with other messages)

This is the standard producer–consumer pattern applied to a stream.

## Design sketch

```ts
const writeAsync = (fd: number, data: Uint8Array): Promise<void> =>
    new Promise((resolve, reject) => {
        fs.write(fd, data, err => err ? reject(err) : resolve())
    })

type WriteQueue = {
    readonly enqueue: (data: Uint8Array) => void
}

const createWriteQueue = (fd: number): WriteQueue => {
    let tail: Promise<void> = Promise.resolve()
    return {
        enqueue: data => {
            tail = tail
                .then(() => writeAsync(fd, data))
                .catch(() => {}) // reset queue to resolved so next write still runs
        }
    }
}
```

`enqueue` returns `void` immediately; `tail` chains each write behind the previous one. The caller does not await, but ordering and atomicity are preserved.

## Impact

- `Io.write` can return `void` instead of `Promise<void>` from the caller's perspective
- The `Write` effect handler in `fromIo` calls `queue.enqueue(fromVec(data))` synchronously
- Queues are created once at startup (one per stream) and held in the `fromIo` closure
- Virtual runner is unaffected (synchronous, no concurrency)

## Related

- [i152](./152-write-effect.md) — `Write` effect and `csiWrite`; this issue resolves the atomicity gap left there
