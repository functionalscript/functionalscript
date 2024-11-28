# Allow Debugging During Test Run

Currently, we read files as strings and then parse them as functions. See [dev/test.mjs](../dev/test.mjs). In this case, the
debugger doesn't know about the source code and can't debug the functions. The main reason for loading modules as functions was
that Deno v1 didn't support `.cjs` files. However, Deno v2 supports them.

We can fix the issue by changing our test runner. The test runner will scan all directories, find all `test.f.cjs` files, and
then load them using `require`.

Limitations: we will not able to check test module dependencies to have module coverage but, anyway, without a parser, we are not able to get full coverage. So, we can drop support for it right now.

**Note:** In this case, we may drop support for Deno v1. At least until we switch to [ESM](./esm.md).
