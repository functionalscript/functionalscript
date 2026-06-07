# 667-ci-rust-autodetect. CI: auto-detect Rust by presence of `Cargo.toml`

**Priority:** P3
**Status:** open

## Problem

`fs/ci/module.f.ts` takes an explicit `rust: boolean` flag in its `Setup` type
to decide whether to include Rust build steps. This is a manual signal that can
drift out of sync — someone could add or remove `Cargo.toml` without updating
the CI generator, and CI would silently skip or spuriously include Rust steps.

## Proposal

Remove the `rust` field from `Setup` and instead detect at CI-generation time
whether `Cargo.toml` exists at the repository root. If it does, include Rust
steps; if not, omit them.

The generator already runs as a `NodeProgram` with filesystem access via the
`access` effect (`fs/effects/node/module.f.ts`). A single `access('Cargo.toml')`
call is enough — no need to parse the file.

```ts
// before
ci({ rust: true, ... })

// after — rust auto-detected, no flag needed
ci({ nodeExtra, denoExtra, bunExtra })
```

## Related

- `fs/ci/module.f.ts` — `Setup` type and `ci()` entry point
- `fs/ci/module.f.ts` — `job()` helper that gates `rustSteps` on the flag
- `fs/effects/node/module.f.ts` — `access` effect for filesystem probing
