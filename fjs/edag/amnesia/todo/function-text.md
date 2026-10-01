## function-text. The FunctionalScript evaluator cannot answer a function's text

**Priority:** P3
**Status:** open; mitigated: the evaluator's own conversions refuse

### Problem

`nanvm-lib` answers a function's text with the FunctionalScript writer's
rendering of its EDAG: `() => undefined` is `()=>undefined`. The evaluator's
functions are host closures built by `callable`, and the host answers their
text with the factory's wrapper source, `(a0, ...rest) => g([a0], rest)`. The
parameter plan
([default function text](../../../../spec/todo/3120-parameters.md#default-function-text-render-or-refuse))
calls that a wrong successful result: it has to render or refuse.

[`../../function-text.md`](../../function-text.md) explains the problem in
full:

- why the evaluator cannot render the text, given that a `Proxy`, setting
  `toString` and a `.mjs` adapter are ruled out;
- which conversions the evaluator performs and which the host performs;
- the options and why Refuse was chosen for now.

### Done

The evaluator refuses the conversions it performs itself: `String` of a
function, binary `+` with one, and a string comparison with one. A
comparison whose result does not depend on the text stays answered.

### What remains open

- **The host's conversions.** `String([f])`, `join`, `startsWith` and a
  comparison or `+` with an array or object that holds a function convert
  inside host code. They never reach an evaluator node, so they still answer
  the wrapper's text. The corpus's `host` marker (`fjs/nanvm/types.ts`)
  keeps its function-text cases on the Rust side.
- **Rendering.** The evaluator should render the text in place of the
  refusal. That needs a function value that carries its EDAG, or a host
  boundary that can find it, without a `Proxy`, without mutation and
  without importing JavaScript. No such mechanism exists yet.

Rust's text does not depend on any of this: `nanvm-lib` holds the text
beside the function (`IStaticFunction::static_function`), and the generated
corpus tests check it there.

### Related

- [../../function-text.md](../../function-text.md): the problem, the options and the case for Refuse.
- [../../../../nanvm-lib/todo/to-primitive.md](../../../../nanvm-lib/todo/to-primitive.md): Stage 3, step 6.
- [../../../types/function/length/README.md](../../../types/function/length/README.md):
  the factories, which say they do not provide the text.
