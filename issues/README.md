# Issues

## Allow Debugging During Test Run

Currently, we read files as strings and then parse them as functions. See [dev/test.mjs](dev/test.mjs). In this case, debugger doesn't know about source code and can't debug the functions. The main reason for loading modules as functions was that Deno v1 didn't support `.cjs` files. However, Deno v2 support them.

We can fix the issue by changing our test runner. The test runner will scan all directories and find all `test.f.cjs` files and then load them using `require`.

## Creating `./_module.f.cjs`

We can write a script which will generate `./_module.f.cjs` before packaging. Note: the script should be added into [prepack](https://docs.npmjs.com/cli/v8/using-npm/scripts#pre--post-scripts).
