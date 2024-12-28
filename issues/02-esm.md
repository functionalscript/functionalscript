# Switching to ESM

We need ESM for such systems like Deno, JSR and browsers.

Currently, the biggest obstacle to using ESM is that we cannot make bundles on ESM modules without an FS parser.
The solution is to deploy ESM modules to HTTPS.

This task depends on [test-debug](./test-debug.md).
