## Track Bun's percent-encoded JavaScript data URL loader

**Priority:** P3
**Status:** open

Pinned Bun 1.4.5 exports the following data URL as a string instead of loading
its JavaScript. Node 26.13.1 and Deno 2.9.8 export the function as expected:

```js
const source = 'export default x=>x.a;'
const url = `data:text/javascript,${encodeURIComponent(source)}`
const loaded = await import(url)
console.log(typeof loaded.default, loaded.default)
```

The dot remains unescaped by `encodeURIComponent`. Replacing it with `%2E`
in the encoded payload, or using `data:text/javascript;base64,` with the
base64-encoded source, loads the function on all three pinned runtimes.

This affects
[`immutable_source_joins.proof.mjs`](../immutable_source_joins.proof.mjs)'s
`nestedSourceJoinsKeepRequiredFactoriesAndTheirReturnOwner`: its first module
loads as a 404-character URL string, so the function-length assertion fails
with `[404, 4]`. Both source generations emitted before and after
[PR 3926](https://github.com/functionalscript/functionalscript/pull/3926) are
byte-for-byte identical, compared with baseline `f39843b20`; Node loads both
as four-argument functions and produces the expected results.

Investigate or report the host loader behavior and recheck it on Bun upgrades.
The `%2E` and base64 forms are verified options for a future host-loader fix;
preserve the emitted JavaScript and the existing behavioral assertions.
