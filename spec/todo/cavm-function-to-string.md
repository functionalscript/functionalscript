## Function text in the content-addressable VM: the hash is the text

**Priority:** P4
**Status:** open

### Problem

Default function text is EDAG-derived
([function text and serialization](./serialization.md#function-text-and-serialization),
[render or refuse](./3120-parameters.md#default-function-text-render-or-refuse)),
and the [serialization questions](./serialization.md#open-questions) about
it are open: whether `String(f)` is the callable serializer, whether it
instantiates the captured frame, and how it spells `self`. In a
[content-addressable VM](./content-addressable-vm.md) they get harder
before they get easier, because the CAVM adds a constraint: two functions
with the same content are **one value**
([execution models](../../fjs/edag/execution-models.md#4-content-addressable-vm)),
and one value has one text. So

```js
const a = () => 2
const b = x => () => x
a === b(2) // true in the CAVM
```

requires `String(a) === String(b(2))`, and any rendering that depends on how
the function was built — a literal `2` in one body, a captured `x` in the
other — risks giving one value two texts. Rendering the body also has no
finite answer for a captured function without a name to call it by, since
the EDAG is name-erased: `() => x` names a binding no reader can resolve,
inlining `x`'s text pulls in the whole dependency graph, which the
[lazy frame rendering](./serialization.md#conditional-requirement-lazy-frame-rendering)
requirement exists to forbid and which never terminates for `self`, and a
fresh name is arbitrary.

### Proposal

In the CAVM, the default text of a function does not render its body at
all. It names the function by its own hash, wrapped in a call that forwards
the arguments:

```js
const f = () => 21
const g = () => f() * 2
```

`String(g)` is

```js
(...rest) => $Bxo0DuQ…(...rest)
```

where `$Bxo0DuQ…` is the hash of `g` — the content identity of its EDAG and
captured frame, the same hash the CAVM keys `g` by. A function whose
`length` is two reads `(a, b, ...rest) => $…(a, b, ...rest)`: the fixed
parameters follow `length`, so the text's arity agrees with the function's,
and the rest parameter forwards whatever else a caller passes.

The text is a function of the function's identity and nothing else, which is
what makes it right:

- **One value, one text.** `a` and `b(2)` above are one value, so one hash,
  so one text, however either was built. No rendering choice can split them.
- **The three questions close at once.** There is no body in the text, so
  `String(f)` renders no captures and needs no spelling for `self`, and it
  is not the callable serializer — it is a code *reference*, question 1's
  second reading, decided by the profile. Nothing is instantiated, so
  the lazy-rendering requirement is met with nothing to be lazy about.
- **Finite and canonical.** One identifier however deep the dependency
  graph; the same on every CAVM and every run; and equal text means equal
  value, which a JS-compatible profile cannot promise
  ([serialization](./serialization.md), code identity versus allocation
  identity) and a CAVM can, since it deliberately replaces allocation
  identity with content identity.
- **Resolvable.** The name is the address: a reader who wants `g`'s code
  asks the CAVM for that hash. Expanding a hash into its EDAG or into source
  — where a captured function is in turn named by *its* hash, so the
  expansion is one level and finite — is a CAVM inspection operation,
  a decompiler, and not `toString`.
- **Legal spelling.** The characters an
  [identifier](../README.md#identifiers) may continue with — `A`–`Z`,
  `a`–`z`, `0`–`9`, `_` and `$` — are exactly sixty-four, so a hash spells
  as base64 over that alphabet with no character outside it: a 255-bit
  hash is forty-three characters, against sixty-four in hex. Standard
  base64's `+` and `/`, and base64url's `-`, are not identifier
  characters, so the alphabet is this one and not either standard's;
  `fjs/basen`'s `baseN` builds the codec from the alphabet alone, as the
  standard `base64` and `cbase32` modules already do. A leading `$` makes
  the name start with a non-digit and marks it as generated — `$` is rarely
  written by hand, which keeps the names out of the way of real ones. The
  text stays parseable source, and evaluated where `$…` resolves to the
  function it names, it is that function again.

The cost is stated plainly: the text carries no code, where JavaScript's
carries the source. That is inside the adopted
[exception](../README.md#function-source-representation-exception) — the
EDAG-derived text was never going to be JavaScript's — but it is the far
end of it, and a profile that wants readable bodies wants the decompiler
above, not a different `toString`.

This is CAVM-only. A JS-compatible executor has no hash to name by, and
[execution models](../../fjs/edag/execution-models.md) keeps the identity
models distinct on purpose; the shared default renderer stays one operation
with this as its one profile-dependent branch.

### Open

- **Length.** The full hash is 255 bits
  ([content-addressable-vm](./content-addressable-vm.md)), forty-three
  base64 characters: correct, and still long for a name. A prefix is
  readable but reintroduces collisions; the CAVM design already weighs a
  48-bit prefix against a full hash for its *value* representation, and the
  same trade applies to the name. Whether text may abbreviate what the VM
  keys by in full, and how a reader resolves an abbreviated name, is
  undecided.
- **Encoding details.** Base64 over the identifier alphabet is proposed
  above, and the alphabet's order is the one open choice in it. Forty-three
  characters carry 258 bits, so three are padding; the tag bit and the
  `undefined` all-zero hash of the CAVM design need not appear in a name
  that only ever stands for a function.
- **Round trip.** Whether the compiler should *accept* `$…` names as
  references into a CAVM — making the rendered text loadable, not just
  readable — is a language question and needs the
  [feature process](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions);
  rendering alone adds no syntax.

### Tasks

- [ ] Record in [content-addressable-vm](./content-addressable-vm.md) the
      identity this relies on: a function's content is its EDAG *with* its
      captured frame, reduced, so a captured constant and a literal are one
      content and `a === b(2)` above holds.
- [ ] Decide the hash spelling in a name: full or prefix, and the alphabet's
      order.
- [ ] Record the rule in [serialization](./serialization.md) as the CAVM
      profile's answer to questions 1–3, and the JS-compatible profile's
      remaining choice beside it.
- [ ] Give the shared default renderer this profile-dependent branch, once
      it exists
      ([render or refuse](./3120-parameters.md#default-function-text-render-or-refuse)).

### Related

- [content-addressable-vm](./content-addressable-vm.md) — the hash this
  proposal names by, and its size trade-off.
- [serialization](./serialization.md#open-questions) — the three questions
  this proposal closes for one profile.
- [3120-parameters](./3120-parameters.md#default-function-text-render-or-refuse)
  — the renderer this rule plugs into.
- [execution-models](../../fjs/edag/execution-models.md#4-content-addressable-vm)
  — content identity, the premise of one value, one text.
- [mvp-roadmap](../../nanvm-lib/todo/mvp-roadmap.md#canonical-representation-the-edag-as-data-decided)
  — the EDAG as the thing hashed.
- [member-functions](../../nanvm-lib/todo/member-functions.md) — nanvm-lib's
  `toString` placeholder, the JS-compatible side of the same gap.
