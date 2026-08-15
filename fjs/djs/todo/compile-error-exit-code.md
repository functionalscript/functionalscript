# `fjs compile` exits 0 on a parse error

**Priority:** P2
**Status:** open

## Problem

When compilation fails, `compile` in `fjs/djs/module.f.mjs` prints the error
message but then returns `pure(0)`, so the process exits with code 0:

```js
if (result[0] === 'error') {
    const metadata = result[1].metadata
    return step(
        error(`${metadata?.path}:${metadata?.line}:${metadata?.column} - error: ${result[1].message}`),
        () => pure(0))
}
```

The argument-count check just above correctly returns `pure(1)`, so this branch
is the odd one out. As a result, scripts and CI cannot detect a failed compile
from the exit status:

```sh
$ printf 'console.log("hi")\nexport default 1\n' > x.f.mjs
$ fjs compile x.f.mjs out.mjs; echo $?
x.f.mjs:1:1 - error: const not found
0
```

The output file is (correctly) not written in this case, so the only failure
signal is the message text.

## Fix

Return `pure(1)` from the parse-error branch. Check whether any caller or test
depends on the current exit code.

## Related

- `file not found` errors from `transpile` take the same branch and are also
  reported with exit code 0 (and with `undefined:undefined:undefined` as the
  location, since `metadata` is `null` — a second, cosmetic issue).
