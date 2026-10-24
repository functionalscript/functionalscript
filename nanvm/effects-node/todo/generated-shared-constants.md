## Generate the limits and refusal codes the native runner copies by hand

**Priority:** P4
**Status:** open

### Problem

The native runner carries hand-written copies of values
[`fjs/effects/node/module.f.mjs`](../../../fjs/effects/node/module.f.mjs)
exports, each with a doc comment pointing back at its original:

```rust
/// `maxOffset` in `fjs/effects/node/module.f.mjs`: `Number.MAX_SAFE_INTEGER`.
const MAX_OFFSET: u64 = (1 << 53) - 1;
```

In [`src/files.rs`](../src/files.rs): `MAX_FILE_SIZE_BYTES` (`maxLengthBytes`),
`MAX_OFFSET` (`maxOffset`), the `ERR_NOT_A_FILE` code and its message
(`notAFileCode`, `notAFileMessage`), and the `fileSizeRefusal` wording in
`read_file`. In [`src/inflate.rs`](../src/inflate.rs): `ERR_TRAILING_BYTES`
(`inflateTrailingCode`). A copy is a value that drifts: the parity corpus
catches a drift after the fact, and only where it has a case.

The repository already generates the command set for this crate:
[`fjs/nanvm/commands`](../../../fjs/nanvm/commands/module.f.mjs) writes
[`src/gen.commands.rs`](../src/gen.commands.rs) from `nodeCommands` so the
set is "printed from there rather than written twice". The constants beside
the commands are the same kind of fact and are not printed.

### Proposal

Extend that generator, or add a sibling `gen.limits.rs`, to emit the numeric
limits and refusal codes the runners share, with the JavaScript exports as the
one source. Message templates that interpolate values stay hand-written where
Rust formatting differs; the parity corpus pins them.

Do [refuse-in-the-effect](../../../fjs/effects/node/todo/refuse-in-the-effect.md)
first: it removes `MAX_OFFSET`'s uses and the window wording, so what is left
to generate is smaller.

### Tasks

- [ ] List the constants `files.rs` and `inflate.rs` copy, each against its
      JavaScript export.
- [ ] Emit them from `npm run gen`; replace the hand-written `const`s; CI's
      stale-`gen.*` check guards the result.

### Related

- [refuse-in-the-effect](../../../fjs/effects/node/todo/refuse-in-the-effect.md)
  — removes the largest copy before this runs.
- [nanvm-effects-node-operations](../../../todo/nanvm-effects-node-operations.md)
  — the parity corpus that catches drift today.
- [node-modules-resolution](../../../todo/node-modules-resolution.md) — its
  stage 3 wants the resolver "never a handwritten copy", the same idea.
