## Group `fs/` subdirectories by concern

**Priority:** P4
**Status:** open

`fs/` has 28 top-level directories mixing foundational data structures (`types`), byte/character encoders (`base64`, `base128`, `cbase32`), language tooling (`json`, `djs`, `fjs`, `fsc`, `bnf`, `js`, `html`), crypto, storage (`cas`, `sul`), and project infrastructure (`ci`, `dev`, `website`). Regroup incrementally — not a big-bang reorg, since every cross-module import is a relative `.f.ts` path.

### 1. `fs/basen/` — group base-N encoders

Move `base64`, `base128`, `cbase32` under `fs/basen/`. They are sibling alphabet-parameterised encoders sharing a codec factory.

### 2. `fs/common/` — common algorithms

Create `fs/common/` for cross-cutting reusable algorithms, starting by moving `monoid` (currently `fs/types/monoid`) there. Admit only genuinely cross-cutting *algorithms* — not data structures or type-level utilities.

### 3. Promote `fjs` bin to `fs/` root

`fs/fjs/module.f.ts` is the top-level CLI dispatcher — nothing imports it as a library. Move `fs/fjs/{module.ts, module.f.ts, proof.f.ts, README.md}` to `fs/`. Update `package.json` (`bin.fjs`, scripts) and `deno.json` (`fjs` task). Fix relative imports (drop one `../`).

### Later candidates

- `lang/` for language/format tooling (`json`, `djs`, `fjs`, `fsc`, `bnf`, `js`, `html`) — highest value but highest churn.
- Storage bucket for `cas` + `sul`; testing bucket for `asserts` + `emergent_testing`.

### Tasks

- [ ] Create `fs/basen/` and move `base64`, `base128`, `cbase32` into it.
- [ ] Create `fs/common/` and move `monoid` from `fs/types/` into it.
- [ ] Promote the `fjs` bin to `fs/` root; update `package.json`/`deno.json` script paths and fix relative imports.
- [ ] Update all relative imports referencing the moved modules.
- [ ] Update `deno.json` `exports` map and run `npm run update`.
- [ ] Verify `npx tsc` and `fjs t` pass.
