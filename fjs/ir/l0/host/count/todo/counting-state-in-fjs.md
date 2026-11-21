## The counting host's rules in FunctionalScript

**Priority:** P3
**Status:** open

### Problem

[`module.mjs`](../module.mjs) is the counting host: about 270 lines of
plain JavaScript under a module comment of ninety. The comment gives the
reason it is not FunctionalScript: "Counting is state, and a WebAssembly
import has nowhere else to keep it." That is a reason for the state to
live at the boundary. It is not a reason for the rules to, and
[AGENTS.md §3](../../../../../../AGENTS.md#3-functionalscript-and-typescript-fjs)
asks a `.mjs` to be thin.

What the file holds today, beside the `WebAssembly.Memory`, `Table` and
`Global` objects that only a host can make:

- the cell rules: `make`, `dup` and `drop`, with the copy values that are
  never counted and their four constant handles;
- the builder rules: `begin`, `push`, `push_property` and `seal`, with
  the refusals of a wrong kind, a full builder and one that is not full,
  and `seal`'s "a repeated key keeps its first position and its last
  value", which is a loop over a `Map` and an array that are both mutated;
- the throw rules: one held value, and "a throw after a throw";
- `keep`, `live` and `recover`, which are a difference between two maps
  of counts.

None of these touches WebAssembly. Each is a transition over four values:
the cells, the kept counts, the open builders and the held throw. They
can be proved only through `proof.mjs`, by building a host and calling
its imports, and `proof.mjs` is a host proof, which
[AGENTS.md](../../../../../../AGENTS.md#3-functionalscript-and-typescript-fjs)
reserves for effects.

The [NaNVM host](../../nanvm/module.mjs) shares the shape and nothing
else. `isCopy` is defined in both files, `constantOf` in both with
different handles (`-1n` to `-4n` here, `0n` to `3n` there), and both
build the same `data_base`, `table`, `table_base` and four constant
globals by hand.

### Proposal

A `module.f.js` beside the host owns the rules as a state machine:

```ts
type State = {
    readonly cells: OrderedMap<bigint, Cell>
    readonly kept: OrderedMap<bigint, number>
    readonly builders: OrderedMap<number, Builder>
    readonly held: Nullable<readonly [unknown]>
    readonly next: bigint
    readonly nextBuilder: number
}
// each import: (state, ...args) => Result<readonly [State, answer], string>
```

`make`, `dup`, `drop`, `begin`, `push`, `pushProperty`, `seal`, `throw_`,
`thrown`, `keep`, `live` and `recover` are functions of that state, with a
`proof.f.js` that pins each rule directly, a refusal as an `error` rather
than a JavaScript `throw` of a string.

`module.mjs` keeps one `let state`, the WebAssembly objects, `make_string`
(which reads memory), and `make_function` and `call`, whose re-entrancy
is the host's own: each import becomes "apply the transition, store the
state, answer or throw the error".

A small shared `.mjs` in `fjs/ir/l0/host` makes the globals that both
hosts make, from the four handles that a host gives its constants, and
exports `isCopy` once.

### Drawbacks

- A cell's value is `unknown`, a function among them, so the state is a
  FunctionalScript value that holds host values. Nothing in the rules
  inspects one past `isCopy`, a string test for a key and an array test
  for a frame.
- Every `dup` and `drop` goes through a persistent map rather than a
  `Map`. This host exists to make a misplaced count show, not to be fast,
  and the benchmark's fast host is NaNVM.
- `make_function` reads the state inside a call that an import started.
  The `let` at the boundary has to be read after the inner call returns,
  not before; that discipline is the one hazard the move adds.

### Related

- [one loader](../../todo/one-loader.md)
- [host proofs for effects only](../../../../../../todo/host-proofs-for-effects-only.md)
