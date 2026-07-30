## 65Z-nix-edsl. Minimal generic Nix eDSL and serializer

**Priority:** P3
**Status:** open

### Problem

[65Z-ci-nix](../../../ci/todo/65z-ci-nix.md) needs to generate small, readable
`flake.nix` files. Building those files with ad hoc string concatenation would mix Nix
syntax, escaping, indentation, and CI-specific decisions in one generator.

A complete Nix AST, parser, evaluator, type model, or formatting framework would be much
larger than the current need. The first implementation only has to represent the syntax
used by the generated Node flakes.

### Proposal

Add `fjs/media/nix/module.f.ts`: a small FunctionalScript eDSL and deterministic serializer
for Nix expressions. Follow the same general approach as `fjs/media/html/module.f.ts`:

- represent source as immutable data;
- keep the representation generic and independent of its first consumer;
- escape text in the serializer rather than at call sites;
- emit string chunks for composition and provide a final string helper;
- add syntax forms only when an actual generator needs them.

The module must not contain concepts such as flakes, Nixpkgs, CI jobs, systems, shells, or
packages. Those remain ordinary values assembled by the CI generator.

#### Minimal representation

Use normal JavaScript strings as escaped double-quoted Nix string literals. Attribute names
are also strings, but their position distinguishes them from string expressions. Represent
the remaining syntax with a small tagged-tuple tree:

```ts
import { type List as ChunkList } from '../../types/list/module.f.ts'

type Identifier = string

type AttributeName = string

type AttributePath = readonly [AttributeName, ...AttributeName[]]

type Binding = readonly ['=', AttributePath, Expression]

type Reference = readonly ['ref', Identifier, ...AttributeName[]]

type AttributeSet = readonly ['set', ...Binding[]]

// The first consumer only needs lists of package references.
type NixList = readonly ['list', ...Reference[]]

type ApplicationArgument = Reference | AttributeSet

// The first consumer only calls a reference with reference or attribute-set arguments.
type Application = readonly ['apply', Reference, ...ApplicationArgument[]]

// The first consumer only needs an attribute-set argument pattern with `...`.
type OpenSetPattern = readonly ['open-set-pattern', ...Identifier[]]

type Lambda = readonly ['lambda', OpenSetPattern, Expression]

type Let = readonly ['let', readonly Binding[], Expression]

type IndentedString = readonly ['indented-string', string]

export type Expression =
    | string
    | Reference
    | AttributeSet
    | NixList
    | Application
    | Lambda
    | Let
    | IndentedString
```

This is a syntax tree, not a semantic Nix object model:

- `['ref', 'pkgs', 'nodejs_22']` renders as `pkgs.nodejs_22`;
- `['=', ['inputs', 'nixpkgs', 'url'], value]` renders a dotted attribute binding;
- `['apply', fn, argument0, argument1]` renders whitespace-separated Nix function
  application;
- `['open-set-pattern', 'nixpkgs']` renders as `{ nixpkgs, ... }`;
- `['let', bindings, body]` owns the `let ... in` structure;
- `['indented-string', text]` owns Nix indented-string delimiters and escaping.

`Identifier` and `AttributeName` have different serialization rules:

- the first item in a reference and every open-set pattern item must be a valid unquoted
  Nix identifier and must not be a reserved word;
- the serializer returns `undefined` when an identifier-only position is invalid;
- attribute-path items and reference selections may contain any string;
- an attribute name that is valid in bare form is emitted unchanged;
- every other attribute name is emitted as an escaped quoted attribute name;
- one `AttributeName` always remains one path segment, so `a.b` is serialized as `"a.b"`
  rather than being reinterpreted as two segments.

The restricted `NixList` and `Application` operands are deliberate. Every currently allowed
child is unambiguous without parentheses. Nested applications, applications as list items,
and other grouped operands remain unrepresentable until a generator needs an explicit
parenthesized-expression construction.

Do not add a raw-Nix node. Unsupported syntax should remain unsupported until a concrete
consumer requires a typed construction for it.

#### Current generated-flake example

The Node flake can be assembled without any flake-specific helper:

```ts
const flake: Expression = ['set',
    ['=', ['inputs', 'nixpkgs', 'url'],
        'github:NixOS/nixpkgs/<commit>'],
    ['=', ['outputs'], ['lambda',
        ['open-set-pattern', 'nixpkgs'],
        ['set',
            ['=', ['devShells', 'aarch64-linux', 'default'],
                ['let', [
                    ['=', ['pkgs'], ['apply',
                        ['ref', 'import'],
                        ['ref', 'nixpkgs'],
                        ['set',
                            ['=', ['system'], 'aarch64-linux']
                        ]
                    ]]
                ], ['apply',
                    ['ref', 'pkgs', 'mkShell'],
                    ['set',
                        ['=', ['packages'], ['list',
                            ['ref', 'pkgs', 'nodejs_22']
                        ]]
                    ]
                ]]
            ]
        ]
    ]]
]
```

The Node 22 generator may add this binding to the `mkShell` attribute set:

```ts
['=', ['shellHook'], ['indented-string', `export NPM_CONFIG_PREFIX="$HOME/.npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
mkdir -p "$NPM_CONFIG_PREFIX"`]]
```

The same tree shape must support Node 22, Node 24, and Node 26 by changing data only.

#### Serialization

Export a checked chunk serializer and a final string helper, analogous to the HTML module:

```ts
export const nix: (_: Expression) => ChunkList<string> | undefined
export const nixToString: (_: Expression) => string | undefined
```

Use one deterministic readable format:

- four-space indentation;
- one attribute-set or `let` binding per line;
- a semicolon after every binding;
- compact lists for the currently required package references;
- whitespace-separated application of a reference to its declared arguments;
- no implicit flattening or context-dependent regrouping;
- one trailing newline in a successful `nixToString` result;
- correct escaping for quoted strings, quoted attribute names, and indented strings;
- no formatting options in the first implementation.

The formatter does not need to preserve input formatting because the eDSL contains syntax,
not source text.

#### Extension rule

Implement only the forms above for the first CI flakes. In particular, do not preemptively
add:

- parsing or evaluation;
- comments or source locations;
- numbers, booleans, or `null`;
- filesystem paths or URI literals;
- operators, conditionals, assertions, `with`, or `inherit`;
- recursive sets or dynamic attribute expressions;
- string interpolation nodes;
- identifier, default-value, or `@` function patterns;
- parenthesized or other grouped expressions;
- arbitrary expression selection such as `(f x).a`;
- configurable pretty-printing;
- flake, package, system, or shell helpers.

A later CI Nix TODO may extend `Expression` and its proofs when its generator uses another
Nix construction. It should not bypass the eDSL with generated raw Nix text.

### Tasks

- [ ] Add `fjs/media/nix/module.f.ts` with the minimal expression types above.
- [ ] Implement `nix` as a deterministic checked `ChunkList<string>` serializer.
- [ ] Implement `nixToString` with one final newline on success.
- [ ] Validate identifier-only positions and return `undefined` for invalid identifiers.
- [ ] Emit safe attribute names bare and escape all other attribute names as quoted names.
- [ ] Escape quoted string expressions in the serializer.
- [ ] Escape indented strings in the serializer.
- [ ] Add `proof.f.ts` cases for every supported node.
- [ ] Add proofs for invalid identifiers and quoted attribute names such as `a.b`.
- [ ] Add exact-output proofs for the Node 24 flake and the Node 22 `shellHook` variant.
- [ ] Update the CI Nix generator to build the generated flakes through this eDSL.
- [ ] Add grouped operands or other syntax nodes only when a concrete generator requires them.

### Related

- [65Z-ci-nix](../../../ci/todo/65z-ci-nix.md) — first consumer and current syntax scope.
- [`fjs/media/html/module.f.ts`](../../html/module.f.ts) — model for a generic data eDSL
  with escaping and chunk serialization.
