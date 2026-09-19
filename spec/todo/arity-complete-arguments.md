## Serialize arity and complete arguments

**Priority:** P3
**Status:** open

### Problem

The [named-parameter proposal](./3120-parameters.md) preserves declared arity
but limits source serialization of positive-arity functions to indexed reads
of declared parameters. Valid EDAGs can also observe the complete actual
argument list, which those source forms cannot reconstruct.

Under the proposed format, `['=>', 2, ['[]', []], ['.', ['args'], 'length']]`
describes a callable `f` with `f.length === 2`, `f() === 0`, `f(undefined) === 1` and
`f(1, 2, 3) === 3`. Returning `['args']` or forwarding it must likewise
preserve omissions and extra arguments.

Mixed rest, `(a, b, ...rest) => …`, preserves declared arity and extra
arguments, but `[a, b, ...rest]` pads omitted positions with `undefined`.
It therefore does not solve the complete-argument case by itself. Until
an approved representation exists, the writer must refuse these graphs
explicitly; EDAG validation and execution still admit them.

### Tasks

- [ ] Propose a source representation that preserves both declared arity
  and the complete actual argument list. Explain its benefits, drawbacks
  and any additional syntax or runtime support it needs.
- [ ] Obtain language-designer approval before adding source capabilities;
  update the writer boundary in the parameter plan when support is added.
- [ ] Prove callable round trips for omitted, explicit `undefined` and
  extra arguments, including returning and forwarding the argument array.

### Related

- [Review finding](https://github.com/functionalscript/functionalscript/pull/2133#discussion_r4054015547).
- [Serialization](./serialization.md#function-text-and-serialization) —
  callable serialization and default function text have separate open questions.
