## Standard JSON parse/serialize and optional native compatibility

**Priority:** P3
**Status:** blocked
**Blocked by:** [Extended JSON bigint parse/serialize](./bigint-parse-serialize.md)

### Problem

`fjs/media/json` should own a complete standard JSON codec implemented in
FunctionalScript. That does **not** require the default `json.parse` /
`json.stringify` API to reproduce every observable detail of the host
`JSON.parse` / `JSON.stringify` implementation.

There are two separate contracts:

1. **FunctionalScript standard JSON** — accept/produce standard JSON syntax and
   the ordinary bigint-free JSON runtime value domain. Its behavior should be
   deterministic, explicit, and useful for FunctionalScript itself.
2. **Native `JSON.*` compatibility** — if a concrete consumer needs host-equivalent
   behavior, add a separate transform/serialization policy over the same shared
   structural machinery.

Do not force contract (2) into contract (1). Native compatibility details such as
shortest-double spelling, `-0 -> "0"`, non-finite normalization, or exact overflow
behavior should not make the ordinary FunctionalScript JSON codec harder than it
needs to be.

The current `fjs/media/json.parse` already intentionally differs from native
`JSON.parse` at the API level: it returns `Result<Unknown, string>` instead of
throwing. That is a useful precedent for keeping the FunctionalScript API clean
rather than treating the host API as the specification.

### Shared structural core

Use one tokenizer and one container-building parser. Numeric syntax stays
lossless until a policy chooses its runtime representation:

```text
JSON text
   |
   v
JSON tokenizer
   |
   v
shared structural parse
(NumberToken leaves, original lexeme preserved)
   |
   +--> extended materializer -> ExtendedUnknown
   |
   +--> standard materializer -> json.Unknown
   |
   +--> RTTI materializer -> Ts<T>
   |
   +--> optional native-compatible materializer
```

Likewise, serialization should share the recursive object/array traversal while
allowing the numeric leaf policy to differ:

```text
json.Unknown
   |
   +--> FunctionalScript standard number formatter -> JSON text
   |
   +--> optional native-compatible number formatter -> JSON text
```

These are different transformers/policies over one structural implementation,
not parallel JSON parsers or serializers.

### FunctionalScript standard parse

Materialize the shared lossless tree directly into the ordinary bigint-free JSON
value domain.

For numeric leaves, the simplest standard policy is to convert the exact JSON
number token to JavaScript `number` after tokenization has established that the
syntax is valid. The exact implementation can reuse the tokenizer's parsed
numeric data where safe, but `NumberToken.value` remains the canonical source for
cases where an exponent or coefficient exceeded an intermediate representation.

This direct materializer is important even though
[standard-transform.md](./standard-transform.md) provides
`extendedToStandard`: a valid JSON number may exceed the runtime bigint limit and
therefore be impossible to materialize first as `ExtendedUnknown`. Standard JSON
parsing must not need a second tokenizer or structural parser just because the
extended runtime representation is narrower for that input.

The default FunctionalScript parser does not need to be specified in terms of
native `JSON.parse` edge behavior. It needs a documented total policy for every
valid JSON number token and malformed input must remain an ordinary `Result`
failure.

### FunctionalScript standard stringify

Serialize the ordinary bigint-free JSON value domain using the shared recursive
serializer and a FunctionalScript-owned numeric formatter.

The default requirements are:

- output is valid JSON text;
- output is deterministic;
- every finite number has a defined spelling;
- the chosen spelling reparses under the FunctionalScript standard parser to the
  intended `number` value;
- negative zero, non-finite programmatic numbers, and other exceptional runtime
  values have explicit documented behavior;
- object-entry ordering follows the explicit `mapEntries`/ordering contract of
  the FunctionalScript serializer, not an implicit promise to reproduce host
  property enumeration order.

The formatter does **not** have to emit the same bytes as native
`JSON.stringify`. For example, a valid deterministic spelling for an unsafe
integer-valued double may differ from the host's shortest decimal spelling as long
as the FunctionalScript contract is preserved.

The exact exceptional-number policy remains in
[number-edge-cases.md](./number-edge-cases.md). That investigation should choose
what is best for the FunctionalScript codec, not what is required to imitate the
host.

### Optional native `JSON.*` compatibility

Only implement this when a real consumer needs host-equivalent behavior. Keep it
as a separate named API/policy rather than changing the default `json.*` contract.

Conceptually the compatibility parser is another materializer over the same
lossless structural tree, and the compatibility stringifier is another numeric /
normalization policy over the same recursive serializer:

```text
native-compatible parse:
JSON text -> shared structural parse -> native-compatible materializer

native-compatible stringify:
json.Unknown -> native-compatible normalization/number formatting
             -> shared structural serializer -> JSON text
```

The compatibility layer may therefore bypass `ExtendedUnknown` for cases that
cannot be represented there, such as a bare integer beyond the runtime bigint
limit. It must not duplicate tokenization or the structural JSON state machine.

If implemented, compare only the supported FunctionalScript surface. Do not
silently expand the task to native optional arguments such as reviver, replacer,
or indentation unless a concrete consumer requires them.

Compatibility cases to verify include:

- `-0` parse and stringify behavior;
- `NaN`, `Infinity`, and `-Infinity` stringify behavior where the runtime type
  admits those values;
- exponent overflow such as `1e400`;
- bare integer input far beyond exact JavaScript-number precision and beyond the
  runtime bigint construction limit;
- finite number spelling, especially unsafe integer-valued doubles;
- object-entry ordering where the compared APIs expose an ordering guarantee.

Some native number-format evidence has already been measured:

```text
max_plain_integer =  999999999999999900000
min_plain_integer = -999999999999999900000

JSON.stringify(max_plain_integer) == "999999999999999900000"
JSON.stringify(1e21)              == "1e+21"
```

and native shortest-round-trip spelling may differ from the exact integer stored
by the binary double:

```text
JSON.stringify(999999999999999900000)
    == "999999999999999900000"

BigInt(999999999999999900000).toString()
    == "999999999999999868928"
```

That evidence belongs to the optional compatibility policy. It must not determine
how the default FunctionalScript standard serializer represents the value.

### Relationship to runtime value transforms

[standard-transform.md](./standard-transform.md) remains useful as a pair of
runtime-domain utilities:

```text
ExtendedUnknown <-> json.Unknown
```

Those transformers are not required to define either parser/stringifier.

In particular:

- standard parse may materialize `json.Unknown` directly from the exact tree;
- extended parse materializes `ExtendedUnknown` from the same exact tree;
- callers that already have one runtime tree can use the value transformers;
- standard stringify may choose its own numeric leaf formatter instead of first
  forcing every value through `standardToExtended`;
- native-compatible parse/stringify, if added, use their own policy without
  contaminating either reusable value transformer.

### Tasks

- [ ] Define the default FunctionalScript standard JSON parse contract separately
      from native `JSON.parse` compatibility.
- [ ] Add/rebase the standard materializer from the shared lossless structural
      tree to `fjs/media/json.Unknown`; keep `NumberToken.value` available until
      numeric materialization is complete.
- [ ] Ensure valid oversized numeric tokens do not require successful intermediate
      `bigint` construction merely to reach the standard parser.
- [ ] Define the FunctionalScript standard number-serialization contract: valid,
      deterministic JSON and reparsing semantics, without requiring native
      shortest-decimal spelling.
- [ ] Choose explicit default behavior for `-0`, non-finite programmatic numbers,
      and other exceptional numeric values through
      [number-edge-cases.md](./number-edge-cases.md).
- [ ] Reuse one recursive structural serializer; parameterize/adapt numeric leaf
      formatting rather than creating a second object/array walker.
- [ ] Keep the existing `Result`-returning parse API unless a separate task has a
      reason to change it; native throwing behavior is not part of the default
      contract.
- [ ] Add default-codec proofs against the FunctionalScript contract, not against
      host byte-for-byte output.
- [ ] Only when a real consumer needs it, add a separately named native-compatible
      materializer/stringifier policy over the same shared structural core.
- [ ] For that optional compatibility policy, add differential proofs against the
      supported native `JSON.parse` / `JSON.stringify` surface, including the
      measured large-number cases above.
- [ ] Do not add reviver/replacer/pretty-print compatibility without a concrete
      consumer.
- [ ] `npx tsc`, `fjs test`.

### Related

- [Extended JSON bigint parse/serialize](./bigint-parse-serialize.md) — owns the
  shared lossless structural parse and the bigint-aware materializer/serializer.
- [Standard/extended value transforms](./standard-transform.md) — reusable
  runtime-tree conversions; they do not define codec compatibility.
- [JSON numeric edge cases](./number-edge-cases.md) — settles exceptional numeric
  policy for the FunctionalScript codecs without requiring native behavior.
- [RTTI-aware extended JSON parser](./rtti-parse.md) — another materializer over
  the same lossless number-token tree.
- [Remove native JSON](./remove-native-json.md) — self-hosts JSON serialization;
  its default number formatter should satisfy the FunctionalScript JSON contract,
  while exact host formatting belongs only to the optional compatibility policy.
- [`fjs/media/json/module.f.ts`](../module.f.ts) — current ordinary JSON value
  types and `parse` / `stringify` surface.
