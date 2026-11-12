## Admit Math.trunc

**Priority:** P2
**Status:** wip

### Problem

`Math.trunc` is refused, blocking the SHA-1 module's FJS migration. The
owner requested implementation using native functions when both Rust and
core WASM provide a compatible operation; otherwise use the common runtime.
WASM must not acquire third-party dependencies.

### Tasks

- Confirm the native operation and record the admission and backend choice.
- Implement static admission and execution with JavaScript-compatible
  conversion, signed zero, special values and callable identity.
- Prove the behavior across the existing JavaScript and Rust executors,
  update generated outputs and promote any newly accepted leaf modules.
