## function-text. The FunctionalScript evaluator answers a function's text

**Priority:** P2
**Status:** open, needs a design decision

### Problem

`nanvm-lib` answers a function's text with the FunctionalScript writer's
rendering of its EDAG (`tryFunctionText` in `fjs/compiler/serializer`):
`() => undefined` is `()=>undefined`. The evaluator does not. The `=>`
operation in [`fjs/edag/operations`](../../operations/module.f.mjs) makes the
value with `callable(length, body)` from
[`fjs/types/function/length`](../../../types/function/length/module.f.mjs),
and `String(f)` of it is the factory's own source,
`(a0, ...rest) => g([a0], rest)`. The parameter plan
([default function text](../../../../spec/todo/3120-parameters.md#default-function-text-render-or-refuse))
calls that a wrong successful result: it has to render or refuse.

It also splits the operator corpus. Every case that shows a function's text
carries a `host` marker (`fjs/nanvm/types.ts`) and runs in Rust only.

Refusing is not enough on its own. The evaluator can refuse its own
`String` node, but the host converts a function inside `join`, `+`,
`startsWith` and the rest, and those paths never reach an evaluator node.
Only the value itself can answer them.

### Proposal

Give the value the text, through the one conversion every host path reads,
`toString`:

1. **A `Proxy` over the callable** (recommended). A `get` trap answers
   `toString` with a function returning the text and forwards every other
   key. Nothing is mutated, and each evaluation still mints its own
   identity; `typeof`, calls and `length` are the callable's. Every host
   conversion reaches the trap through `OrdinaryToPrimitive`. FunctionalScript
   has no `Proxy`, so this lives in a thin `.mjs` adapter beside
   `types/function/length`, the host boundary AGENTS.md allows.
2. **`Object.defineProperty` on the fresh callable.** It is smaller, but it
   is property mutation, which the parameter plan says it does not grant.

Either way the text is computed on first conversion, not at creation:
conversion is rare, and `tryFunctionText` walks the whole body. The node
the `=>` operation holds, `['=>', length, frameExp, body]`, is exactly what
`tryFunctionText` takes, and D2's code-only answer (`$0`, `$1`, …) needs
no captured values, so the evaluator renders the same text `nanvm-lib`
does. A body the writer refuses throws `FUNCTION_TEXT`'s message rather
than answering the factory's text.

`fjs/edag` sits below `fjs/compiler`, so the renderer is handed to the
executor rather than imported by `operations`: the `Context` that
`amnesia` builds takes a `functionText` beside `invoke`. That keeps the
EDAG layer free of the compiler, and the host-side tests can pass a stub.

Then the corpus drops the `host` marker, and both sides run every
function-text case.

### Tasks

- [ ] Approve the mechanism (the `Proxy` adapter or `defineProperty`).
- [ ] The adapter, with its proof: calls, `length`, identity and every
      host conversion of a text-bearing callable.
- [ ] The `=>` operation answers its node's text through the context;
      `amnesia` passes `tryFunctionText`.
- [ ] Drop the corpus's `host` marker and its filter in `fjs/nanvm/proof.f.mjs`.
- [ ] `tsc`, `fjs test`, `npm run cov`.

### Related

- [../../../../nanvm-lib/todo/to-primitive.md](../../../../nanvm-lib/todo/to-primitive.md): Stage 3, step 6.
- [../../../types/function/length/README.md](../../../types/function/length/README.md):
  the factories, which say they do not provide the text.
