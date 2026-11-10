# Remove the runtime-reference cache guard

The cache guard rejects deterministic source such as destructuring `Math.log2`,
which prevents reuse for every dependent coverage directory.

Remove the AST reference blacklist and its dependency-scanner callback. Keep
the existing source hashes, static dependency resolution, and graph validation.
Verify that unchanged coverage using the reported Math binding can be reused.
