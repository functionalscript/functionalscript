# Function groups

Mutually recursive functions share one definition. Each member has a stable
index within the group. A function body can therefore read a sibling without
creating a back edge in its capture frame. The original proposal records the
language designer's design of 2026-11-25. The designer approved implementation
on 2026-11-27. [Proposal](https://github.com/functionalscript/functionalscript/pull/4120)
and [implementation request](https://chatgpt.com/c/6b09bd1d-d70c-83e8-ac35-915adb53201e).

## Source and graph

```js
const a = () => b
const b = () => a
```

The declarations form one group at module scope or inside a function body.
Calling `a` returns the same function that reading `b` returns. A local group
can also capture values from the enclosing invocation. The compiler requires
all members to be consecutive and mutually reachable through resolved names.
See [function groups](../bindings/constants/README.md#function-groups) for the
source rule and [captures](../functions/captures/README.md) for lexical scope.

```js
const ab = ['group', [], [
    [0, ['self', 1]],
    [0, ['self', 0]],
]]
const a = ['fn', ab, 0]
const b = ['fn', ab, 1]
```

The group node contains one shared list of captured slots and ordered
`[length, body]` entries. Each body has its own parameters and invocation
scope. A program sees the projected functions. Sharing the tagged group node
gives each read of the same member its identity, including on an executor
that hashes a group by content.

Ordinary functions keep `['=>', length, slots, body]` and their own `['self']`.
Groups have two or more members. Keeping both forms preserves direct
self-recursion and tail-loop recovery for single functions. The language puts
no upper bound on group size. See the [EDAG](../../fjs/edag/README.md) and
[FAST recovery](../../fjs/edag/to_fast/README.md).

## Runtime ownership

NaNVM's reference VM allocates one counted group for closures created at
runtime. Its frame stores captures, and its entries store code and metadata.
A function value carries an `Rc` to that group and its member index. Reading
a sibling retains that same group. Returning a member keeps the frame alive
after the enclosing call returns. Dropping the last member releases the group
because the entries hold no owning pointer back to it.
[Reference implementation](../../nanvm/lib/src/naive/function.rs).

A packed 64-bit VM could store a pointer to a member entry in the value.
An offset in the entry would locate the group's reference count. A wider
value can hold the group pointer and index side by side. Both layouts support
the same identity rule.

The native Rust output (`.native.rs`) emits module-constant members as
separate static function descriptors. Their code can name sibling descriptors directly in any source
order, so the group needs no counted allocation or static group descriptor.
Removing the existing frame field from static functions is tracked separately.
[Static values](../../nanvm/lib/src/vm/static_value.rs) and
[#4125](https://github.com/functionalscript/functionalscript/pull/4125).

Portable Rust output (`.rs`) constructs the group through `IVm` at module
initialization. This output supports VMs that provide the group constructor.
Loading static descriptors requires the additional `IStaticVm` capability.
[Rust serializer](../../fjs/rust/serializer/README.md).

## Grammar rule identity

The original EBNF API allocated a fresh function for each reference token
and used its identity to look up a separately supplied rule body. Folding
equal constants could merge tokens and cause a duplicate-definition error.
Recursive grammar rules now return their productions and refer to one
another directly. Reading a rule from its production gives the same function
used as the parser mapping key. A grammar that needs to distinguish two rules
gives them different content. Separately written functions with identical
content may compare equal. Both `Object.is` and a function-leaf comparison
in `structEq` can therefore give different results across executors. A
content-addressable VM gives identical canonical code and captures the
same identity. [EBNF](../../fjs/ebnf/README.md),
[compiler grammar](../../fjs/compiler/parser/grammar/module.f.js) and
[value identity](../todo/value-identity.md).

## Earlier alternatives

An object containing its own mutually recursive members would require
capturing the object during its construction. Recreating such an object on
each read would give successive visits different identities on a
reference-counted VM. A fresh-identity operation would make identity depend
on something outside the value's content. Indexed reads within one group
avoid all three problems.

The language designer approved the original single-function self binding on
2026-10-06. Its EDAG and source rule landed in
[#2629](https://github.com/functionalscript/functionalscript/pull/2629) and
[#2630](https://github.com/functionalscript/functionalscript/pull/2630).
Forward captures of ordinary values and eager reads before declaration
remain separate work. [Body forward references](../../fjs/compiler/parser/todo/body-const-forward-reference.md).
