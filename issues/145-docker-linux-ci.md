# 145. Use Docker containers for Linux CI jobs.

**Priority:** P3
**Status:** irrelevant

Use Docker containers for Linux CI jobs. Running Linux jobs inside a Docker container allows GitHub Actions to cache the container image, so tool installation (Node, Rust, Bun, Deno, Wasmer, Wasmtime, etc.) is paid once per image rebuild rather than on every CI run. The cache key must include all tool versions and the target architecture. macOS and Windows jobs are unaffected.

Superseded by [i65Z-ci-scenario-docker](./65Z-ci-scenario-docker.md), which
tracks the concrete generated-image plan.
