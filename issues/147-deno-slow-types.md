# 147. Deno slow-types.

Deno's JSR publisher requires full explicit type annotations on exported `const`. For complex schemas defined with `as const`, writing out the full type is impractical. A fix via `satisfies` is proposed in [deno_graph#639](https://github.com/denoland/deno_graph/pull/639) and is available in deno_graph 0.107.2, but the fix doesn't work when the constant is used in `export type` as `typeof`. Deno 2.8.0 ships deno_graph 0.108.2 but the issue persists. Keep `--allow-slow-types` flag on `deno publish` and `deno publish --dry-run` commands until this is fully resolved.
