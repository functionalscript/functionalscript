## Wait for response completion before closing the proof server

**Priority:** P2
**Status:** wip

### Problem

Windows CI in #2568 reports `[3, 4]` from `createServer.writesEveryChunk`.
The client receives all Content-Length bytes before the server's final drain
and end-marker pull. `withServer` then closes its connections and cancels that
pull, even though the response body arrived intact.

### Tasks

- [ ] Wait for the producer's release before the proof's client callback returns,
      preserving the exact four-pull and single-release assertions.
