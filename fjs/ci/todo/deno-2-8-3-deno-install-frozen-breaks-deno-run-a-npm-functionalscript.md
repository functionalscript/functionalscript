## Deno 2.8.3: `deno install --frozen` breaks `deno run -A npm:functionalscript`

**Priority:** P1
**Status:** needs re-verification (see note below)

With Deno 2.8.3, running `deno install --frozen` before `deno run -A npm:functionalscript@0.30.0` produces:

```
error: Failed resolving binary export. '.../node_modules/.deno/functionalscript@0.30.0/node_modules/functionalscript/package.json' did not exist
```

The same command succeeds if `deno install --frozen` is **not** run beforehand.

**Note (re-checked 2026-08-14):** CI now pins Deno `2.9.5` (`.github/workflows/ci.yml`,
`deno` in `fjs/ci/config/module.f.mjs`), not 2.8.3. The current Deno step order in
`fjs/ci/deno/module.f.mjs` already runs the smoke test (`deno run -A ... npm:functionalscript
... test`) *before* `deno install --frozen`, so the ordering that triggered this bug report
is no longer present in the pipeline as generated today. This has not been re-tested against
2.9.5 directly (e.g. running `deno install --frozen` immediately before `deno run -A
npm:functionalscript` by hand), so treat this as likely resolved by the current step order /
version bump, but unconfirmed — re-verify against the currently pinned Deno version before
closing, since Deno version pins change again.
