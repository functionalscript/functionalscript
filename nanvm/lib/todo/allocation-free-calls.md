## A function that creates no value should allocate nothing

**Priority:** P3
**Status:** open — a goal and a problem statement; no design yet

### Goal

A function that creates no new array, object, string or big integer runs
without allocating dynamic memory. With a module's constants held as
[static data](./static-constants.md), everything such a function reads is
already there, and what it computes is numbers, booleans and references.

### Problem

It does not hold today, for reasons that are not in the function's source.

- **A call allocates its arguments.** A function's code is
  `StaticCode<A>`, `fn(self_, args: Array<A>)`
  ([`istatic_function.rs`](../src/vm/internal/istatic_function.rs)): the
  arguments come as an array, and the generated code builds one at every
  call site, `[a, b].to_array()`. A function that does nothing but call
  another allocates. Calls are far more frequent than constants, so this is
  the larger part.
- **A closure allocates.** A function value is its code and a frame of what
  it captured, built as an array where the function is made, and on the
  naive VM the function is an `Rc` of its own. A callback written inline,
  for `map` or `every`, is made each time the line runs.

Some operations create a value without the source showing a constructor: a
conversion to a string, a rest parameter, a spread, and a thrown value that
is no constant. These are creations, and the goal does not cover them.

### Parameters on a call

How a call can pass its arguments without allocating has to be thought
through; nothing is decided. What an answer has to deal with:

- **Where the arguments live.** On a stack of the VM's own, as a borrowed
  slice of the caller's values, or as fixed parameters for the common
  counts with an array only where there are more.
- **Arguments that escape.** A rest parameter is an array the body can
  keep, return or capture. A function that has one needs a real array; one
  that reads its arguments by position does not, and the compiler knows
  which it is.
- **One signature.** Every function has one code type today, whether it is
  a compiled closure or a member function of the runtime, and a native
  function, such as the reference map, reads the same `args`. A second way
  to pass arguments is a second signature or a change to all of them.
- **A call through a value.** A caller of a function it does not know has
  to pass arguments the way every function accepts.
- **Tail calls.** A call in tail position takes the caller's place, so the
  caller's arguments must not be needed once the callee has its own.

### Closures

- A function has identity, and evaluating an arrow in a body makes a new
  one at each call
  ([names and identity](../../../spec/functions/names-and-identity/README.md)):
  under `const make = () => () => 1`, `make() === make()` is `false`,
  though the inner arrow captures nothing. So capturing nothing does not
  make a closure a constant. One made while the module initializes is one
  value and can be a static as any other. For one made in a body, what can
  be static is what it is made of, its code and an empty frame; the
  function value is still a new one each time, and what a new value costs
  when it holds nothing of its own is the question.
- One that captures values made at run time needs its frame somewhere.
  Whether a frame that does not outlive the call that made it can live on
  a stack, which asks what the compiler can say about a function value
  escaping.

### Tasks

- [ ] Count allocations in one compiled program, by cause: arguments,
  frames, functions, and values the source creates. The split says what is
  worth doing first.
- [ ] Propose how a call passes its arguments.
- [ ] Propose what a closure that captures nothing, and one that does not
  escape, become.

### Related

- [Static constants](./static-constants.md) — what makes the goal
  reachable for everything a function reads.
- [Reduce `Rc` clones](./087-reduce-rc-clone.md).
- [Optimal NaNVM](./optimal-nanvm.md).
