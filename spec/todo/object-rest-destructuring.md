## Object rest destructuring

**Priority:** P2
**Status:** wip

### Problem

Object rest binding, `const { a, ...rest } = value`, is currently refused,
including inside a fixed parameter pattern. It is ordinary JavaScript syntax
for a fresh record containing the source's own enumerable string properties
except the selected keys. Its absence blocks the WebAssembly binary parser
from compiling without a source workaround.

### Approved design

Admit a final object rest binding whose target is an identifier in every
existing binding-pattern position: declarations, exports, nested patterns,
fixed parameters, and declaration `for…of` headers. The rest binding has no
default and no following comma or property. Unlike array rest, an object rest
binding cannot itself target another pattern. Existing name, declaration,
capture, default, and property-key checks continue to apply.

Evaluate the source once. Establish ordinary property bindings and their
defaults in source order, then copy the remaining entries into a fresh object.
Exclude the source property names, not the names of their bindings; aliases
and repeated source keys do not change that rule. Normalize admitted numeric
literal keys to their string property names. Computed keys beyond the current
literal-key surface remain the separate computed-binding-keys proposal.

The copy is shallow, preserves value identity and entries whose value is
`undefined`, and retains JavaScript property enumeration order. Arrays contribute
their enumerable indices, strings their UTF-16 code-unit indices, and numbers,
booleans and bigints no entries. Null and undefined throw, including for a
rest-only pattern or an unused rest binding. Each evaluation creates a fresh
rest object, even when it is empty. These semantics use FJS's existing value
domain, which excludes symbols, getters and proxies.

Built-in namespaces such as `Object` and `Number` remain non-values. Their
existing selected-member destructuring remains supported; copying a namespace
with object rest is refused explicitly.

Lowering belongs to the existing checked-pattern expansion. Add an object-rest
recipe to the source expansion plan, holding the source read and the excluded
static keys. Expand it through existing `Object.entries`, array `filter`, and
`Object.fromEntries` operations. The generated filter callback compares the
entry key with those literal keys and captures nothing. A rest-only pattern
needs no filter. No FAST or EDAG operation, executor primitive, or handwritten
backend implementation is added.

For example, the conceptual expansion of `{ funcs, code, ...rest }` is:

```js
const source = sections
const { funcs, code } = source
const rest = Object.fromEntries(
    Object.entries(source).filter(
        ([key]) => key !== 'funcs' && key !== 'code'
    )
)
```

The benefit is familiar JavaScript source syntax using one shared runtime
implementation across backends. The cost is intermediate entry arrays and the
existing immutable `Object.fromEntries` body's quadratic copying fallback.
Backend substitutions may optimize that existing operation later without
changing this source feature's semantics.

### Approval

`sergey-shandar` explicitly requested implementation in the
[working session](https://chatgpt.com/local/6af76317-5c08-8191-b451-685c94478033):
"update 3840 and then implement the rest object spread."
This followed the proposal to implement object-rest destructuring through
entry enumeration, filtering, and reconstruction. Object-literal spread is
already supported; this approval covers the object-rest binding feature above.

### Tasks

- [x] Propose syntax, semantics, lowering, benefits and drawbacks.
- [x] Record explicit language-design approval before implementation.
- [ ] Implement binding admission and common lowering.
- [ ] Prove source evaluation, exclusion, enumeration order, fresh identity,
      nullish and primitive sources, defaults, nested patterns, and existing
      declaration checks across represented and generated execution.
- [ ] Update the permanent destructuring specification and accepted examples.
- [ ] Promote modules that become compilable and update their references.

### Related

- [Destructuring](../bindings/destructuring/README.md) — current binding rules.
- [Computed binding keys](./computed-binding-keys.md) — separately unsupported
  runtime keys.
- [Rest parameter patterns](./rest-parameter-patterns.md) — a separate grammar
  limitation; object-rest support does not approve it.
