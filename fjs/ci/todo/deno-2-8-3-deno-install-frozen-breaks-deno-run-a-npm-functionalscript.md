## Deno 2.8.3: `deno install --frozen` breaks `deno run -A npm:functionalscript`

**Priority:** P1
**Status:** investigate

With Deno 2.8.3, running `deno install --frozen` before `deno run -A npm:functionalscript@0.30.0` produces:

```
error: Failed resolving binary export. '.../node_modules/.deno/functionalscript@0.30.0/node_modules/functionalscript/package.json' did not exist
```

The same command succeeds if `deno install --frozen` is **not** run beforehand.
