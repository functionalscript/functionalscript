## `occurrences` without `Map`

**Priority:** P2
**Status:** blocked
**Blocked by:** admitting `Object.fromEntries`, whose proposal for [2360](../../../../spec/todo/2360-built-in.md) is [functionalscript/functionalscript#3356](https://github.com/functionalscript/functionalscript/pull/3356)

### Problem

`occurrences` in [`../module.f.mjs`](../module.f.mjs) answers `indexOf` and
`lastIndexOf` over a list of names from one pass, with two `Map`s, so asking
either for every name is linear rather than quadratic. `new Map` is not
FunctionalScript, and it is the module's last construct the compiler refuses:
with it gone, the module compiles whole and is renamed `module.f.js`, which
lets `fjs/rtti/module.f.mjs` — the schema constructors, on the self-hosting
loader's import path — compile with its `includes` import unchanged.

### Direction

Build the two lookups as plain objects keyed by name and read them with
`entry`: `Object.fromEntries(positions)` keeps the later of two entries with
one key, as the `Map` does, so the positions in order give the last
occurrence and in reverse the first. That waits on admitting
`Object.fromEntries`, which [functionalscript/functionalscript#3356](https://github.com/functionalscript/functionalscript/pull/3356) proposes;
a spread with a computed key would make the build quadratic, which is the
cost this function exists to avoid. Once it lands: rewrite `occurrences`,
rename the module, then rename `fjs/rtti/module.f.mjs`.
