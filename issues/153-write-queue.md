l# 153. Async Write with Backpressure

Asynchronous writes to `stdout` and `stderr` via the `Write` effect ([i152](./152-write-effect.md)) must respect Node.js stream backpressure to avoid dropping or corrupting data when the internal buffer is full.

## Use case

```ts
// Print many large messages concurrently — e.g. test results arriving in parallel.
await Promise.all(results.map(r => write('stdout', encode(r))))
```

Each individual `stream.write()` call is atomic — Node.js treats the data as a unit. The only hazard is ignoring backpressure: if the stream's internal buffer fills up and `write()` returns `false`, subsequent writes must wait for the `drain` event before proceeding.

A manual queue (promise chain) would also serialise writes, but it accumulates unboundedly in memory: if messages are produced faster than the OS can drain them, the queue grows without limit. The backpressure approach avoids this — when the stream's buffer is full, `write()` returns `false` and the producer pauses until `drain` fires, naturally throttling the producer to the speed of the consumer.

This gives the right performance characteristics in both cases:
- **Large computations with occasional prints**: `write()` returns `true` (buffer not full) so the computation never waits — printing is effectively free.
- **Small computations printing many large messages**: the producer is throttled when the buffer fills, preventing unbounded memory growth.

## Solution

```ts
import { once } from 'node:events'

const writeAll = async (
    stream: NodeJS.WritableStream,
    data: Uint8Array,
): Promise<void> => {
    if (!stream.write(data)) {
        await once(stream, 'drain')
    }
}
```

`stream.write(data)` returns `true` if the data was flushed immediately, or `false` if it was buffered and the caller should back off. `once(stream, 'drain')` resolves when the stream is ready for more data.

## Impact

- `Io` exposes `stdout` and `stderr` as `NodeJS.WritableStream` (rather than bare `{ fd, isTTY }`) so `writeAll` can call `.write()` and listen for `'drain'`
- The `Write` effect handler in `fromIo` calls `writeAll(stream, fromVec(data))`
- Virtual runner is unaffected (synchronous, no concurrency)

## Related

- [i152](./152-write-effect.md) — `Write` effect and `csiWrite`; this issue resolves the atomicity gap left there
