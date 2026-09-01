## Serialize DataJS graphs as YAML

**Priority:** P4
**Status:** open

### Problem

DataJS represents a directed acyclic graph, but its JavaScript-module syntax is
not the only textual format capable of preserving shared values. YAML anchors
and aliases can encode the same identity: `&id` names a value and `*id` refers
to that value later.

There is no YAML codec that serializes a DataJS value with anchors or parses
aliases back into shared object identity.

### Proposal

Add a YAML codec whose first stage implements a deliberately small language:
JSON syntax extended only with YAML anchors and aliases.

```yaml
{"first": &id [1,2], "second": *id}
```

Its value grammar is JSON's recursive grammar with two additions:

```text
value  ::= alias | anchor? node
anchor ::= '&' name
alias  ::= '*' name
name   ::= [A-Za-z_][A-Za-z0-9_-]*
```

`node` is any JSON scalar, array, or object, with nested positions using this
extended `value` production. JSON whitespace may separate tokens.

Stage 1 accepts JSON objects, arrays and scalar values. An anchor may prefix a
value, and a later alias denotes that exact value rather than an equal copy.
It does not attempt to implement YAML indentation, implicit scalar typing,
tags, directives, merge keys, block strings, comments, or YAML's alternative
mapping and sequence syntax.

Parsing must:

- preserve identity, so two aliases of one anchored array or object produce
  references to the same node;
- reject an unresolved alias, a duplicate anchor, a forward reference, and any
  cycle;
- reject syntax outside the stage-1 language rather than assign it a plausible
  meaning;
- complete all validation after grammar recognition and before returning the
  parsed result.

Serialization must:

- emit ordinary JSON when the input is a tree;
- assign deterministic anchor names to arrays or objects referenced more than
  once, emit the anchor with the first occurrence, and emit aliases afterward;
- preserve object-member order and distinguish reference identity from value
  equality;
- reject cycles and values outside JSON's value domain during stage 1, including
  DataJS-only leaves such as `bigint`, `undefined`, `NaN`, and infinities.

Later stages may add more YAML syntax and DataJS leaves, but each addition must
define its accepted language and scalar semantics before implementation.

### Tasks

- [ ] Publish the stage-1 grammar beside the implementation.
- [ ] Define fallible parse and serialize APIs using `Result`.
- [ ] Implement parsing with anchor resolution and identity-preserving aliases.
- [ ] Implement deterministic serialization of shared arrays and objects.
- [ ] Add proofs for trees, shared values, unresolved and duplicate names,
  forward references, cycles, unsupported YAML syntax, and unsupported leaves.
- [ ] Document which YAML features remain outside the accepted language.

### Related

- [`spec/datajs/README.md`](../../../../spec/datajs/README.md) — defines the
  DataJS value model and DAG identity semantics.
- [DataJS parser and serializer](../../datajs/todo/parser-serializer.md) — the
  native DataJS codec and its validation rules.
