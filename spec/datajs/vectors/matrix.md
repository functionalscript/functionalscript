# The class-by-role matrix

Generated from the corpus by `npm run gen`. Edits here are overwritten;
the vectors and the reasons are the source, and both are reviewed as data.

A **class** is the branch of the specification a vector covers, as fine as
the thing an implementation can get wrong on its own. A **role** is what an
implementation does — conformance is per role, so a serializer-only one
never runs a reader or a normalize vector. A cell is the vectors that role
has for that class, a reference to the note saying why it owes none, or a
role whose sets have not landed. An empty cell with no reason fails the
generator, which is the whole point: prose that mentions a class in two
roles reads exactly like prose that mentions it in three.

| role | sets | classes covered | not applicable | awaiting |
| - | - | -: | -: | -: |
| `reader` | `accept`, `reject` | 674 | 0 | 0 |
| `serializer` | `serializer-accept`, `graph-equivalence` | 155 | 519 | 0 |
| `normalize` | no set yet | 0 | 0 | 674 |

674 classes.

| class | `reader` | `serializer` | `normalize` |
| - | - | - | - |
| `array/elements/every-value` | `array-elements-every-value` | `ser-array-elements-every-value` | *awaiting the set* |
| `array/elements/negative-first` | `array-elements-negative-first` | `ser-array-elements-negative-first` | *awaiting the set* |
| `array/elision/leading` | `array-elision-leading` | not applicable, [note 1](#notes) | *awaiting the set* |
| `array/elision/medial` | `array-elision-medial` | not applicable, [note 1](#notes) | *awaiting the set* |
| `array/elision/only` | `array-elision-only` | not applicable, [note 1](#notes) | *awaiting the set* |
| `array/elision/trailing` | `array-elision-trailing` | not applicable, [note 1](#notes) | *awaiting the set* |
| `array/empty` | `array-empty` | `ser-array-empty` | *awaiting the set* |
| `array/nested/array` | `array-nested-array` | `ser-array-nested-array` | *awaiting the set* |
| `array/nested/deep` | `array-nested-deep` | not applicable, [note 37](#notes) | *awaiting the set* |
| `array/nested/empty` | `array-nested-empty` | not applicable, [note 39](#notes) | *awaiting the set* |
| `array/nested/object` | `array-nested-object` | `ser-array-nested-object` | *awaiting the set* |
| `array/no-comma` | `array-no-comma` | not applicable, [note 1](#notes) | *awaiting the set* |
| `array/object/nested/mixed` | `mixed-nested` | not applicable, [note 36](#notes) | *awaiting the set* |
| `array/one` | `array-one` | `ser-array-one` | *awaiting the set* |
| `array/separator/semicolon` | `array-semicolon` | not applicable, [note 1](#notes) | *awaiting the set* |
| `array/spread` | `array-spread` | not applicable, [note 1](#notes) | *awaiting the set* |
| `array/three` | `array-three` | `ser-array-three` | *awaiting the set* |
| `array/trailing-comma` | `array-trailing-comma` | not applicable, [note 1](#notes) | *awaiting the set* |
| `array/trailing-comma/two` | `array-trailing-comma-two` | not applicable, [note 1](#notes) | *awaiting the set* |
| `array/two` | `array-two` | not applicable, [note 34](#notes) | *awaiting the set* |
| `array/unclosed` | `array-unclosed` | not applicable, [note 1](#notes) | *awaiting the set* |
| `array/unopened` | `array-unopened` | not applicable, [note 1](#notes) | *awaiting the set* |
| `array/unshared` | `array-unshared` | `graph-unshared-array-empty`, `graph-unshared-array-parent-object-empty` | *awaiting the set* |
| `array/unshared/equal` | `array-unshared-equal` | `graph-unshared-array-non-empty`, `graph-unshared-array-parent-object` | *awaiting the set* |
| `bigint/binary` | `bigint-binary` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/binary-upper` | `bigint-binary-upper` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/binary-upper/neg` | `bigint-neg-binary-upper` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/binary/neg` | `bigint-neg-binary` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/digit9` | `bigint-9` | not applicable, [note 16](#notes) | *awaiting the set* |
| `bigint/digit9/neg` | `bigint-neg-9` | not applicable, [note 16](#notes) | *awaiting the set* |
| `bigint/digits` | `bigint-109` | `ser-bigint-109` | *awaiting the set* |
| `bigint/digits/neg` | `bigint-neg-109` | `ser-bigint-neg-109` | *awaiting the set* |
| `bigint/exponent` | `bigint-exponent` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/exponent-upper` | `bigint-exponent-upper` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/exponent-upper/neg` | `bigint-neg-exponent-upper` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/exponent/neg` | `bigint-neg-exponent` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/fraction` | `bigint-fraction` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/fraction/neg` | `bigint-neg-fraction` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/hex` | `bigint-hex` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/hex-upper` | `bigint-hex-upper` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/hex-upper/neg` | `bigint-neg-hex-upper` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/hex/neg` | `bigint-neg-hex` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/leading-point` | `bigint-leading-point` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/leading-point/neg` | `bigint-neg-leading-point` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/leading-zero` | `bigint-leading-zero` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/leading-zero/neg` | `bigint-neg-leading-zero` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/octal` | `bigint-octal` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/octal-upper` | `bigint-octal-upper` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/octal-upper/neg` | `bigint-neg-octal-upper` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/octal/neg` | `bigint-neg-octal` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/past-2p128` | `bigint-2p128` | `ser-bigint-2p128` | *awaiting the set* |
| `bigint/past-2p128/neg` | `bigint-neg-2p128` | `ser-bigint-neg-2p128` | *awaiting the set* |
| `bigint/past-2p53` | `bigint-2p53` | `ser-bigint-2p53` | *awaiting the set* |
| `bigint/past-2p53/neg` | `bigint-neg-2p53` | `ser-bigint-neg-2p53` | *awaiting the set* |
| `bigint/past-2p64` | `bigint-2p64` | `ser-bigint-2p64` | *awaiting the set* |
| `bigint/past-2p64/neg` | `bigint-neg-2p64` | `ser-bigint-neg-2p64` | *awaiting the set* |
| `bigint/plus` | `bigint-plus` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/separator` | `bigint-separator` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/separator/neg` | `bigint-neg-separator` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/suffix/double` | `bigint-suffix-double` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/suffix/double/neg` | `bigint-neg-suffix-double` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/suffix/space` | `bigint-suffix-space` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/suffix/space/neg` | `bigint-neg-suffix-space` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/suffix/upper` | `bigint-suffix-upper` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/suffix/upper/neg` | `bigint-neg-suffix-upper` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/trailing-point` | `bigint-trailing-point` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/trailing-point/neg` | `bigint-neg-trailing-point` | not applicable, [note 1](#notes) | *awaiting the set* |
| `bigint/zero` | `bigint-0` | `ser-bigint-0` | *awaiting the set* |
| `bigint/zero/neg` | `bigint-neg-0` | not applicable, [note 17](#notes) | *awaiting the set* |
| `byte/bom/first` | `byte-bom-first` | not applicable, [note 49](#notes) | *awaiting the set* |
| `byte/truncated` | `byte-truncated` | not applicable, [note 49](#notes) | *awaiting the set* |
| `byte/valid/widths` | `byte-valid-widths` | not applicable, [note 49](#notes) | *awaiting the set* |
| `const/declarators` | `const-declarators` | not applicable, [note 1](#notes) | *awaiting the set* |
| `const/destructuring/array` | `const-destructuring-array` | not applicable, [note 1](#notes) | *awaiting the set* |
| `const/destructuring/object` | `const-destructuring-object` | not applicable, [note 1](#notes) | *awaiting the set* |
| `const/duplicate` | `const-duplicate` | not applicable, [note 1](#notes) | *awaiting the set* |
| `const/duplicate/same-value` | `const-duplicate-same-value` | not applicable, [note 1](#notes) | *awaiting the set* |
| `const/name/dollar-inside` | `const-name-dollar-inside` | not applicable, [note 1](#notes) | *awaiting the set* |
| `const/name/no-dollar` | `const-name-no-dollar` | not applicable, [note 1](#notes) | *awaiting the set* |
| `const/name/reserved` | `const-name-reserved` | not applicable, [note 1](#notes) | *awaiting the set* |
| `const/name/value-word` | `const-name-value-word` | not applicable, [note 1](#notes) | *awaiting the set* |
| `const/no-name` | `const-no-name` | not applicable, [note 1](#notes) | *awaiting the set* |
| `const/no-value` | `const-no-value` | not applicable, [note 1](#notes) | *awaiting the set* |
| `const/one` | `const-one` | not applicable, [note 27](#notes) | *awaiting the set* |
| `const/reference/chain` | `const-reference-chain` | not applicable, [note 26](#notes) | *awaiting the set* |
| `const/reference/chain/shared` | `const-reference-chain-shared` | not applicable, [note 26](#notes) | *awaiting the set* |
| `const/reference/element` | `const-reference-element` | not applicable, [note 26](#notes) | *awaiting the set* |
| `const/reference/member` | `const-reference-member` | not applicable, [note 26](#notes) | *awaiting the set* |
| `const/shared/leaf` | `const-shared-leaf` | not applicable, [note 32](#notes) | *awaiting the set* |
| `const/shared/mixed` | `const-shared-mixed` | `ser-sharing-mixed`, `graph-sharing-mixed` | *awaiting the set* |
| `const/shared/nested` | `const-shared-nested` | not applicable, [note 33](#notes) | *awaiting the set* |
| `const/shared/object` | `const-shared-object` | `ser-sharing-object`, `graph-sharing-object`, `graph-sharing-empty-object` | *awaiting the set* |
| `const/shared/three-paths` | `const-shared-three-paths` | `ser-shared-three-paths` | *awaiting the set* |
| `const/shared/twice` | `const-shared-twice` | `ser-sharing-array`, `graph-sharing-array` | *awaiting the set* |
| `const/shared/two-nodes` | `const-shared-two-nodes` | `ser-shared-two-nodes` | *awaiting the set* |
| `const/two` | `const-two` | not applicable, [note 28](#notes) | *awaiting the set* |
| `const/unreferenced` | `const-unreferenced` | not applicable, [note 30](#notes) | *awaiting the set* |
| `const/unreferenced/among` | `const-unreferenced-among` | not applicable, [note 30](#notes) | *awaiting the set* |
| `const/unshared/twins` | `const-unshared-twins` | not applicable, [note 31](#notes) | *awaiting the set* |
| `const/value/every-alternative` | `const-value-every` | not applicable, [note 29](#notes) | *awaiting the set* |
| `document/both-edges` | `document-both-edges` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/comment/block` | `document-comment-block` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/comment/line` | `document-comment-line` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/comment/trailing` | `document-comment-trailing` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/consts/chain` | `document-const-chain-long` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/consts/many` | `document-many-consts` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/empty` | `document-empty` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/empty-statement/between` | `document-semicolon-between` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/empty-statement/double` | `document-semicolon-double` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/empty-statement/leading` | `document-semicolon-leading` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/export/missing` | `document-no-export` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/export/not-last` | `document-export-not-last` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/export/twice` | `document-export-twice` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/import` | `document-import` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/import/binding` | `document-import-binding` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/leading/lf` | `document-leading-lf` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/leading/run` | `document-leading-run` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/semicolon/const` | `document-semicolon-const` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/semicolon/export` | `document-semicolon-export` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/semicolon/export/newline` | `document-semicolon-export-newline` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/shortest` | `document-shortest` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/spelling/one-line` | `document-spelling-one-line` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/spelling/readable` | `document-spelling-readable` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/statement/expression` | `document-statement-expression` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/statement/function` | `document-statement-function` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/statement/let` | `document-statement-let` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/statement/var` | `document-statement-var` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/trailing/crlf` | `document-trailing-crlf` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/trailing/lf` | `document-trailing-lf` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/trailing/reference` | `document-trailing-reference` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/trailing/run` | `document-trailing-run` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/trailing/spaces` | `document-trailing-spaces` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/trailing/value` | `document-trailing-value` | not applicable, [note 5](#notes) | *awaiting the set* |
| `document/whitespace-only` | `document-whitespace-only` | not applicable, [note 5](#notes) | *awaiting the set* |
| `export/form/const` | `export-const` | not applicable, [note 1](#notes) | *awaiting the set* |
| `export/form/named` | `export-named` | not applicable, [note 1](#notes) | *awaiting the set* |
| `export/form/no-default` | `export-no-default` | not applicable, [note 1](#notes) | *awaiting the set* |
| `export/form/no-value` | `export-default-only` | not applicable, [note 1](#notes) | *awaiting the set* |
| `id/distinct/case` | `id-distinct-case` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/distinct/dollar` | `id-distinct-dollar` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/distinct/length` | `id-distinct-length` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/distinct/prefix` | `id-distinct-prefix` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/escaped/both` | `id-escaped-both` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/escaped/braces` | `id-escaped-braces` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/escaped/declaration` | `id-escaped-declaration` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/escaped/reference` | `id-escaped-reference` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/escaped/tail` | `id-escaped-tail` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/non-ascii` | `id-non-ascii` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/non-ascii/cjk` | `id-non-ascii-cjk` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/non-ascii/zwj` | `id-non-ascii-zwj` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/contextual/as` | `id-tail-contextual-as` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/contextual/async` | `id-tail-contextual-async` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/contextual/from` | `id-tail-contextual-from` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/contextual/get` | `id-tail-contextual-get` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/contextual/of` | `id-tail-contextual-of` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/contextual/set` | `id-tail-contextual-set` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/digit-first` | `id-tail-digit-first` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/dollar` | `id-tail-dollar` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/empty` | `id-empty-tail` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/endpoints` | `id-tail-endpoints` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/hash` | `id-tail-hash` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/hyphen` | `id-tail-hyphen` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/keyword/const` | `id-tail-keyword-const` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/keyword/default` | `id-tail-keyword-default` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/keyword/export` | `id-tail-keyword-export` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/long` | `id-tail-long` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/one/9` | `id-tail-one-9` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/one/A` | `id-tail-one-A` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/one/Z` | `id-tail-one-Z` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/one/a` | `id-tail-one-a` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/one/underscore` | `id-tail-one-underscore` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/one/z` | `id-tail-one-z` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/reserved/arguments` | `id-tail-reserved-arguments` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/reserved/await` | `id-tail-reserved-await` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/reserved/class` | `id-tail-reserved-class` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/reserved/delete` | `id-tail-reserved-delete` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/reserved/enum` | `id-tail-reserved-enum` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/reserved/eval` | `id-tail-reserved-eval` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/reserved/function` | `id-tail-reserved-function` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/reserved/if` | `id-tail-reserved-if` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/reserved/import` | `id-tail-reserved-import` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/reserved/in` | `id-tail-reserved-in` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/reserved/let` | `id-tail-reserved-let` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/reserved/new` | `id-tail-reserved-new` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/reserved/static` | `id-tail-reserved-static` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/reserved/this` | `id-tail-reserved-this` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/reserved/typeof` | `id-tail-reserved-typeof` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/reserved/var` | `id-tail-reserved-var` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/reserved/with` | `id-tail-reserved-with` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/reserved/yield` | `id-tail-reserved-yield` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/value-word/Infinity` | `id-tail-value-word-Infinity` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/value-word/NaN` | `id-tail-value-word-NaN` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/value-word/false` | `id-tail-value-word-false` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/value-word/null` | `id-tail-value-word-null` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/value-word/true` | `id-tail-value-word-true` | not applicable, [note 2](#notes) | *awaiting the set* |
| `id/tail/value-word/undefined` | `id-tail-value-word-undefined` | not applicable, [note 2](#notes) | *awaiting the set* |
| `infinity/minus` | `neg-infinity` | `ser-neg-infinity` | *awaiting the set* |
| `infinity/plus` | `infinity` | `ser-infinity` | *awaiting the set* |
| `key/computed/number` | `key-computed-number` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/computed/reference` | `key-computed-reference` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/computed/string` | `key-computed-string` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/identifier` | `key-identifier` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/identifier/dollar` | `key-identifier-dollar` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/numeric` | `key-numeric` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/numeric/float` | `key-numeric-float` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/proto` | `key-proto` | `ser-key-proto` | *awaiting the set* |
| `key/proto/among` | `key-proto-among` | `ser-key-proto-among` | *awaiting the set* |
| `key/proto/bare` | `key-proto-bare` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/proto/computed/bare` | `key-proto-computed-bare` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/proto/computed/escaped` | `key-proto-computed-escaped` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/proto/computed/single-quoted` | `key-proto-computed-single-quoted` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/proto/computed/space/both` | `key-proto-computed-space-both` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/proto/computed/space/left` | `key-proto-computed-space-left` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/proto/computed/space/right` | `key-proto-computed-space-right` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/proto/computed/template` | `key-proto-computed-template` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/proto/nested` | `key-proto-nested` | `ser-key-proto-nested` | *awaiting the set* |
| `key/proto/string` | `key-proto-string` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/proto/string/among` | `key-proto-string-among` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/proto/string/escaped` | `key-proto-string-escaped` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/proto/string/escaped-all` | `key-proto-string-escaped-all` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/proto/string/nested` | `key-proto-string-nested` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/proto/value/null` | `key-proto-value-null` | not applicable, [note 47](#notes) | *awaiting the set* |
| `key/proto/value/object` | `key-proto-value-object` | not applicable, [note 48](#notes) | *awaiting the set* |
| `key/proto/value/shared` | `key-proto-shared` | `ser-key-proto-value-shared` | *awaiting the set* |
| `key/string/continuation` | `key-continuation` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/continuation/crlf` | `key-continuation-crlf` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/empty` | `key-empty` | `ser-key-empty` | *awaiting the set* |
| `key/string/escape/0` | `key-escape-0` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/escape/b` | `key-escape-b` | `ser-key-escape-b` | *awaiting the set* |
| `key/string/escape/backslash` | `key-escape-backslash` | `ser-key-escape-backslash` | *awaiting the set* |
| `key/string/escape/backtick` | `key-escape-backtick` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/escape/f` | `key-escape-f` | `ser-key-escape-f` | *awaiting the set* |
| `key/string/escape/identity` | `key-escape-identity` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/escape/identity/a` | `key-escape-identity-a` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/escape/n` | `key-escape-n` | `ser-key-escape-n` | *awaiting the set* |
| `key/string/escape/octal` | `key-escape-octal` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/escape/octal/8` | `key-escape-octal-8` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/escape/quote` | `key-escape-quote` | `ser-key-escape-quote` | *awaiting the set* |
| `key/string/escape/r` | `key-escape-r` | `ser-key-escape-r` | *awaiting the set* |
| `key/string/escape/single-quote` | `key-escape-single-quote` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/escape/slash` | `key-escape-slash` | not applicable, [note 21](#notes) | *awaiting the set* |
| `key/string/escape/space` | `key-escape-space` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/escape/t` | `key-escape-t` | `ser-key-escape-t` | *awaiting the set* |
| `key/string/escape/u-braces` | `key-escape-u-braces` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/escape/u/09af` | `key-escape-u-09af` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/9afA` | `key-escape-u-9afA` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/AF09` | `key-escape-u-AF09` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/F09a` | `key-escape-u-F09a` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/afAF` | `key-escape-u-afAF` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/fAF0` | `key-escape-u-fAF0` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/002f/0` | `key-escape-u-non-hex-002f-0` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/002f/1` | `key-escape-u-non-hex-002f-1` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/002f/2` | `key-escape-u-non-hex-002f-2` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/002f/3` | `key-escape-u-non-hex-002f-3` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/003a/0` | `key-escape-u-non-hex-003a-0` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/003a/1` | `key-escape-u-non-hex-003a-1` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/003a/2` | `key-escape-u-non-hex-003a-2` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/003a/3` | `key-escape-u-non-hex-003a-3` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/0040/0` | `key-escape-u-non-hex-0040-0` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/0040/1` | `key-escape-u-non-hex-0040-1` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/0040/2` | `key-escape-u-non-hex-0040-2` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/0040/3` | `key-escape-u-non-hex-0040-3` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/0047/0` | `key-escape-u-non-hex-0047-0` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/0047/1` | `key-escape-u-non-hex-0047-1` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/0047/2` | `key-escape-u-non-hex-0047-2` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/0047/3` | `key-escape-u-non-hex-0047-3` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/0060/0` | `key-escape-u-non-hex-0060-0` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/0060/1` | `key-escape-u-non-hex-0060-1` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/0060/2` | `key-escape-u-non-hex-0060-2` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/0060/3` | `key-escape-u-non-hex-0060-3` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/0067/0` | `key-escape-u-non-hex-0067-0` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/0067/1` | `key-escape-u-non-hex-0067-1` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/0067/2` | `key-escape-u-non-hex-0067-2` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/non-hex/0067/3` | `key-escape-u-non-hex-0067-3` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/short/0` | `key-escape-u-short-0` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u/short/3` | `key-escape-u-short-3` | not applicable, [note 19](#notes) | *awaiting the set* |
| `key/string/escape/u00/0000` | `key-escape-u00-0000` | `ser-key-escape-u00-0000` | *awaiting the set* |
| `key/string/escape/u00/001f` | `key-escape-u00-001f` | `ser-key-escape-u00-001f` | *awaiting the set* |
| `key/string/escape/uppercase` | `key-escape-uppercase-n` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/escape/uppercase/u` | `key-escape-uppercase-u` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/escape/v` | `key-escape-v` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/escape/x` | `key-escape-x` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/quote/single` | `key-quote-single` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/quote/template` | `key-quote-template` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/quote/template/empty` | `key-quote-template-empty` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/raw-control/0000` | `key-raw-0000` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/raw-control/0009` | `key-raw-0009` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/raw-control/000a` | `key-raw-000a` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/raw-control/000d` | `key-raw-000d` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/raw-control/001f` | `key-raw-001f` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/raw-quote` | `key-raw-quote` | not applicable, [note 1](#notes) | *awaiting the set* |
| `key/string/raw/astral` | `key-raw-astral` | `ser-key-raw-10000` | *awaiting the set* |
| `key/string/raw/bmp` | `key-raw-latin`, `key-raw-cjk` | `ser-key-raw-latin`, `ser-key-raw-0800`, `ser-key-raw-007f`, `ser-key-raw-0080`, `ser-key-raw-07ff`, `ser-key-raw-d7ff`, `ser-key-raw-e000`, `ser-key-raw-ffff` | *awaiting the set* |
| `key/string/raw/range/0020-0021/high` | `key-raw-0021` | `ser-key-raw-0021` | *awaiting the set* |
| `key/string/raw/range/0020-0021/low` | `key-raw-0020` | `ser-key-raw-0020` | *awaiting the set* |
| `key/string/raw/range/0023-005b/high` | `key-raw-005b` | `ser-key-raw-005b` | *awaiting the set* |
| `key/string/raw/range/0023-005b/low` | `key-raw-0023` | `ser-key-raw-0023` | *awaiting the set* |
| `key/string/raw/range/005d-10ffff/high` | `key-raw-10ffff` | `ser-key-raw-10ffff` | *awaiting the set* |
| `key/string/raw/range/005d-10ffff/low` | `key-raw-005d` | `ser-key-raw-005d` | *awaiting the set* |
| `key/string/raw/slash` | `key-raw-slash` | `ser-key-raw-slash` | *awaiting the set* |
| `key/string/raw/ws-like/00a0` | `key-raw-ws-like-00a0` | `ser-key-raw-ws-like-00a0` | *awaiting the set* |
| `key/string/raw/ws-like/1680` | `key-raw-ws-like-1680` | `ser-key-raw-ws-like-1680` | *awaiting the set* |
| `key/string/raw/ws-like/2000` | `key-raw-ws-like-2000` | `ser-key-raw-ws-like-2000` | *awaiting the set* |
| `key/string/raw/ws-like/2001` | `key-raw-ws-like-2001` | `ser-key-raw-ws-like-2001` | *awaiting the set* |
| `key/string/raw/ws-like/2002` | `key-raw-ws-like-2002` | `ser-key-raw-ws-like-2002` | *awaiting the set* |
| `key/string/raw/ws-like/2003` | `key-raw-ws-like-2003` | `ser-key-raw-ws-like-2003` | *awaiting the set* |
| `key/string/raw/ws-like/2004` | `key-raw-ws-like-2004` | `ser-key-raw-ws-like-2004` | *awaiting the set* |
| `key/string/raw/ws-like/2005` | `key-raw-ws-like-2005` | `ser-key-raw-ws-like-2005` | *awaiting the set* |
| `key/string/raw/ws-like/2006` | `key-raw-ws-like-2006` | `ser-key-raw-ws-like-2006` | *awaiting the set* |
| `key/string/raw/ws-like/2007` | `key-raw-ws-like-2007` | `ser-key-raw-ws-like-2007` | *awaiting the set* |
| `key/string/raw/ws-like/2008` | `key-raw-ws-like-2008` | `ser-key-raw-ws-like-2008` | *awaiting the set* |
| `key/string/raw/ws-like/2009` | `key-raw-ws-like-2009` | `ser-key-raw-ws-like-2009` | *awaiting the set* |
| `key/string/raw/ws-like/200a` | `key-raw-ws-like-200a` | `ser-key-raw-ws-like-200a` | *awaiting the set* |
| `key/string/raw/ws-like/2028` | `key-raw-ws-like-2028` | `ser-key-raw-ws-like-2028` | *awaiting the set* |
| `key/string/raw/ws-like/2029` | `key-raw-ws-like-2029` | `ser-key-raw-ws-like-2029` | *awaiting the set* |
| `key/string/raw/ws-like/202f` | `key-raw-ws-like-202f` | `ser-key-raw-ws-like-202f` | *awaiting the set* |
| `key/string/raw/ws-like/205f` | `key-raw-ws-like-205f` | `ser-key-raw-ws-like-205f` | *awaiting the set* |
| `key/string/raw/ws-like/3000` | `key-raw-ws-like-3000` | `ser-key-raw-ws-like-3000` | *awaiting the set* |
| `key/string/raw/ws-like/feff` | `key-raw-ws-like-feff` | `ser-key-raw-ws-like-feff` | *awaiting the set* |
| `key/string/surrogate/adjacent/hh-d800` | `key-surrogate-adjacent-hh-d800` | `ser-key-surrogate-adjacent-hh-d800` | *awaiting the set* |
| `key/string/surrogate/adjacent/hh-d800-dbff` | `key-surrogate-adjacent-hh-d800-dbff` | `ser-key-surrogate-adjacent-hh-d800-dbff` | *awaiting the set* |
| `key/string/surrogate/adjacent/hh-dbff` | `key-surrogate-adjacent-hh-dbff` | `ser-key-surrogate-adjacent-hh-dbff` | *awaiting the set* |
| `key/string/surrogate/adjacent/lh-dc00-d800` | `key-surrogate-adjacent-lh-dc00-d800` | `ser-key-surrogate-adjacent-lh-dc00-d800` | *awaiting the set* |
| `key/string/surrogate/adjacent/lh-dfff-dbff` | `key-surrogate-adjacent-lh-dfff-dbff` | `ser-key-surrogate-adjacent-lh-dfff-dbff` | *awaiting the set* |
| `key/string/surrogate/adjacent/ll-dc00` | `key-surrogate-adjacent-ll-dc00` | `ser-key-surrogate-adjacent-ll-dc00` | *awaiting the set* |
| `key/string/surrogate/adjacent/ll-dfff` | `key-surrogate-adjacent-ll-dfff` | `ser-key-surrogate-adjacent-ll-dfff` | *awaiting the set* |
| `key/string/surrogate/lone/d800` | `key-surrogate-lone-d800` | `ser-key-surrogate-lone-d800` | *awaiting the set* |
| `key/string/surrogate/lone/dbff` | `key-surrogate-lone-dbff` | `ser-key-surrogate-lone-dbff` | *awaiting the set* |
| `key/string/surrogate/lone/dc00` | `key-surrogate-lone-dc00` | `ser-key-surrogate-lone-dc00` | *awaiting the set* |
| `key/string/surrogate/lone/dfff` | `key-surrogate-lone-dfff` | `ser-key-surrogate-lone-dfff` | *awaiting the set* |
| `key/string/surrogate/lone/raw/d800` | `key-surrogate-lone-raw-d800` | not applicable, [note 42](#notes) | *awaiting the set* |
| `key/string/surrogate/lone/raw/dbff` | `key-surrogate-lone-raw-dbff` | not applicable, [note 42](#notes) | *awaiting the set* |
| `key/string/surrogate/lone/raw/dc00` | `key-surrogate-lone-raw-dc00` | not applicable, [note 42](#notes) | *awaiting the set* |
| `key/string/surrogate/lone/raw/dfff` | `key-surrogate-lone-raw-dfff` | not applicable, [note 42](#notes) | *awaiting the set* |
| `key/string/surrogate/pair/high-corner` | `key-surrogate-pair-high-corner` | not applicable, [note 46](#notes) | *awaiting the set* |
| `key/string/surrogate/pair/interior` | `key-surrogate-pair-interior` | `ser-key-surrogate-pair-interior` | *awaiting the set* |
| `key/string/surrogate/pair/low-corner` | `key-surrogate-pair-low-corner` | not applicable, [note 45](#notes) | *awaiting the set* |
| `key/string/surrogate/pair/mixed` | `key-surrogate-pair-mixed` | `ser-key-surrogate-pair-mixed` | *awaiting the set* |
| `leaf/boolean/false` | `false` | `ser-false` | *awaiting the set* |
| `leaf/boolean/true` | `true` | `ser-true` | *awaiting the set* |
| `leaf/nan` | `nan` | `ser-nan` | *awaiting the set* |
| `leaf/null` | `null` | `ser-null` | *awaiting the set* |
| `leaf/undefined` | `undefined` | `ser-undefined` | *awaiting the set* |
| `number/binary` | `number-binary` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/binary-upper` | `number-binary-upper` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/binary-upper/neg` | `number-neg-binary-upper` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/binary/neg` | `number-neg-binary` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/binary64/max` | `number-max` | `ser-number-max` | *awaiting the set* |
| `number/binary64/max/neg` | `number-neg-max` | `ser-number-neg-max` | *awaiting the set* |
| `number/binary64/overflow` | `number-overflow` | not applicable, [note 14](#notes) | *awaiting the set* |
| `number/binary64/overflow/neg` | `number-neg-overflow` | not applicable, [note 14](#notes) | *awaiting the set* |
| `number/binary64/rounding` | `number-rounding` | not applicable, [note 13](#notes) | *awaiting the set* |
| `number/binary64/rounding/neg` | `number-neg-rounding` | not applicable, [note 13](#notes) | *awaiting the set* |
| `number/binary64/subnormal` | `number-subnormal` | `ser-number-subnormal` | *awaiting the set* |
| `number/binary64/subnormal/neg` | `number-neg-subnormal` | `ser-number-neg-subnormal` | *awaiting the set* |
| `number/binary64/underflow` | `number-underflow` | not applicable, [note 15](#notes) | *awaiting the set* |
| `number/binary64/underflow/neg` | `number-neg-underflow` | not applicable, [note 15](#notes) | *awaiting the set* |
| `number/double-point` | `number-double-point` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/double-point/neg` | `number-neg-double-point` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/exp/E` | `number-1E2` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/E/neg` | `number-neg-1E2` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/double-sign` | `number-exp-double-sign` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/double-sign/neg` | `number-neg-exp-double-sign` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/e` | `number-1e09` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/e/neg` | `number-neg-1e09` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/high-first` | `number-1e90` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/high-first/neg` | `number-neg-1e90` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/infinity` | `number-exp-word` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/infinity/neg` | `number-neg-exp-word` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/minus` | `number-1e-2` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/minus/neg` | `number-neg-1e-2` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/no-digits` | `number-exp-no-digits` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/no-digits/neg` | `number-neg-exp-no-digits` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/one-digit/high` | `number-1e9` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/one-digit/high/neg` | `number-neg-1e9` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/one-digit/low` | `number-1e0` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/one-digit/low/neg` | `number-neg-1e0` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/plus` | `number-1e+2` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/plus/neg` | `number-neg-1e+2` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/point` | `number-exp-point` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/point/neg` | `number-neg-exp-point` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/sign/no-digits` | `number-exp-sign-no-digits` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/exp/sign/no-digits/neg` | `number-neg-exp-sign-no-digits` | not applicable, [note 6](#notes) | *awaiting the set* |
| `number/frac` | `number-1.09` | `ser-number-1.5` | *awaiting the set* |
| `number/frac-exp` | `number-1.09e-2` | not applicable, [note 10](#notes) | *awaiting the set* |
| `number/frac-exp/neg` | `number-neg-1.09e-2` | not applicable, [note 10](#notes) | *awaiting the set* |
| `number/frac/high-first` | `number-1.90` | not applicable, [note 9](#notes) | *awaiting the set* |
| `number/frac/high-first/neg` | `number-neg-1.90` | not applicable, [note 9](#notes) | *awaiting the set* |
| `number/frac/neg` | `number-neg-1.09` | `ser-number-neg-1.5` | *awaiting the set* |
| `number/frac/no-digits/exp` | `number-frac-exp-no-digits` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/frac/no-digits/exp/neg` | `number-neg-frac-exp-no-digits` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/frac/one-digit` | `number-1.0` | not applicable, [note 8](#notes) | *awaiting the set* |
| `number/frac/one-digit/high` | `number-1.9` | not applicable, [note 8](#notes) | *awaiting the set* |
| `number/frac/one-digit/high/neg` | `number-neg-1.9` | not applicable, [note 8](#notes) | *awaiting the set* |
| `number/frac/one-digit/neg` | `number-neg-1.0` | not applicable, [note 8](#notes) | *awaiting the set* |
| `number/hex` | `number-hex` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/hex-upper` | `number-hex-upper` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/hex-upper/neg` | `number-neg-hex-upper` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/hex/neg` | `number-neg-hex` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/int/digit9` | `number-9` | not applicable, [note 11](#notes) | *awaiting the set* |
| `number/int/digit9/neg` | `number-neg-9` | not applicable, [note 11](#notes) | *awaiting the set* |
| `number/int/digits` | `number-109` | not applicable, [note 12](#notes) | *awaiting the set* |
| `number/int/digits/neg` | `number-neg-109` | not applicable, [note 12](#notes) | *awaiting the set* |
| `number/int/zero` | `number-0` | `ser-number-0` | *awaiting the set* |
| `number/int/zero/neg` | `number-neg-0` | `ser-number-neg-0` | *awaiting the set* |
| `number/leading-point` | `number-leading-point` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/leading-point/neg` | `number-neg-leading-point` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/leading-zero` | `number-leading-zero` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/leading-zero/neg` | `number-neg-leading-zero` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/leading-zeros` | `number-leading-zeros` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/leading-zeros/neg` | `number-neg-leading-zeros` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/octal` | `number-octal` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/octal-upper` | `number-octal-upper` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/octal-upper/neg` | `number-neg-octal-upper` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/octal/neg` | `number-neg-octal` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/plus` | `number-plus` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/plus/zero` | `number-plus-zero` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/separator` | `number-separator` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/separator/neg` | `number-neg-separator` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/trailing-point` | `number-trailing-point` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/trailing-point/neg` | `number-neg-trailing-point` | not applicable, [note 1](#notes) | *awaiting the set* |
| `number/zero/exp` | `number-0e0` | not applicable, [note 7](#notes) | *awaiting the set* |
| `number/zero/exp/neg` | `number-neg-0e0` | not applicable, [note 7](#notes) | *awaiting the set* |
| `number/zero/frac` | `number-0.0` | not applicable, [note 7](#notes) | *awaiting the set* |
| `number/zero/frac/neg` | `number-neg-0.0` | not applicable, [note 7](#notes) | *awaiting the set* |
| `object/double-comma` | `object-double-comma` | not applicable, [note 1](#notes) | *awaiting the set* |
| `object/duplicate/adjacent` | `object-duplicate-first` | not applicable, [note 22](#notes) | *awaiting the set* |
| `object/duplicate/both-levels` | `object-duplicate-both-levels` | not applicable, [note 22](#notes) | *awaiting the set* |
| `object/duplicate/escaped` | `object-duplicate-escaped` | not applicable, [note 22](#notes) | *awaiting the set* |
| `object/duplicate/escaped-first` | `object-duplicate-escaped-first` | not applicable, [note 22](#notes) | *awaiting the set* |
| `object/duplicate/index` | `object-duplicate-index` | not applicable, [note 22](#notes) | *awaiting the set* |
| `object/duplicate/nested` | `object-duplicate-nested` | not applicable, [note 22](#notes) | *awaiting the set* |
| `object/duplicate/plain` | `object-duplicate-plain` | not applicable, [note 22](#notes) | *awaiting the set* |
| `object/duplicate/proto` | `object-duplicate-proto` | not applicable, [note 22](#notes) | *awaiting the set* |
| `object/duplicate/three` | `object-duplicate-three` | not applicable, [note 22](#notes) | *awaiting the set* |
| `object/empty` | `object-empty` | `ser-object-empty` | *awaiting the set* |
| `object/equals` | `object-equals` | not applicable, [note 1](#notes) | *awaiting the set* |
| `object/key-only` | `object-key-only` | not applicable, [note 1](#notes) | *awaiting the set* |
| `object/key-order/boundaries` | `object-key-order-boundaries` | `ser-object-key-order-boundaries` | *awaiting the set* |
| `object/key-order/escaped-index` | `object-key-order-escaped-index` | not applicable, [note 25](#notes) | *awaiting the set* |
| `object/key-order/index-before-name` | `object-key-order-index-before-name` | `ser-object-key-order-index-before-name` | *awaiting the set* |
| `object/key-order/index-first` | `object-key-order-index-first` | not applicable, [note 24](#notes) | *awaiting the set* |
| `object/key-order/names/first-occurrence` | `object-key-order-names-first-occurrence` | `ser-object-key-order-names-first-occurrence` | *awaiting the set* |
| `object/key-order/non-index/above` | `object-key-order-non-index-above` | not applicable, [note 23](#notes) | *awaiting the set* |
| `object/key-order/non-index/exp` | `object-key-order-non-index-exp` | not applicable, [note 23](#notes) | *awaiting the set* |
| `object/key-order/non-index/hex` | `object-key-order-non-index-hex` | not applicable, [note 23](#notes) | *awaiting the set* |
| `object/key-order/non-index/negative` | `object-key-order-non-index-negative` | not applicable, [note 23](#notes) | *awaiting the set* |
| `object/key-order/non-index/negative-zero` | `object-key-order-non-index-negative-zero` | not applicable, [note 23](#notes) | *awaiting the set* |
| `object/key-order/non-index/plus` | `object-key-order-non-index-plus` | not applicable, [note 23](#notes) | *awaiting the set* |
| `object/key-order/non-index/space` | `object-key-order-non-index-space` | not applicable, [note 23](#notes) | *awaiting the set* |
| `object/leading-comma` | `object-leading-comma` | not applicable, [note 1](#notes) | *awaiting the set* |
| `object/members/every-value` | `object-members-every-value` | `ser-object-members-every-value` | *awaiting the set* |
| `object/nested/array` | `object-nested-array` | `ser-object-nested-array` | *awaiting the set* |
| `object/nested/deep` | `object-nested-deep` | not applicable, [note 38](#notes) | *awaiting the set* |
| `object/nested/empty` | `object-nested-empty` | not applicable, [note 40](#notes) | *awaiting the set* |
| `object/nested/object` | `object-nested-object` | `ser-object-nested-object` | *awaiting the set* |
| `object/no-colon` | `object-no-colon` | not applicable, [note 1](#notes) | *awaiting the set* |
| `object/no-value` | `object-no-value` | not applicable, [note 1](#notes) | *awaiting the set* |
| `object/one` | `object-one` | `ser-object-one` | *awaiting the set* |
| `object/spread` | `object-spread` | not applicable, [note 1](#notes) | *awaiting the set* |
| `object/three` | `object-three` | `ser-object-three` | *awaiting the set* |
| `object/trailing-comma` | `object-trailing-comma` | not applicable, [note 1](#notes) | *awaiting the set* |
| `object/trailing-comma/two` | `object-trailing-comma-two` | not applicable, [note 1](#notes) | *awaiting the set* |
| `object/two` | `object-two` | not applicable, [note 35](#notes) | *awaiting the set* |
| `object/unclosed` | `object-unclosed` | not applicable, [note 1](#notes) | *awaiting the set* |
| `object/unshared` | `object-unshared` | `graph-unshared-object-empty`, `graph-unshared-object-parent-empty` | *awaiting the set* |
| `object/unshared/equal` | `object-unshared-equal` | `graph-unshared-object-non-empty`, `graph-unshared-object-parent` | *awaiting the set* |
| `reference/case` | `reference-case` | not applicable, [note 1](#notes) | *awaiting the set* |
| `reference/forward` | `reference-forward` | not applicable, [note 1](#notes) | *awaiting the set* |
| `reference/index` | `reference-index` | not applicable, [note 1](#notes) | *awaiting the set* |
| `reference/member` | `reference-member` | not applicable, [note 1](#notes) | *awaiting the set* |
| `reference/prefix` | `reference-prefix` | not applicable, [note 1](#notes) | *awaiting the set* |
| `reference/self` | `reference-self` | not applicable, [note 1](#notes) | *awaiting the set* |
| `reference/unbound` | `reference-unbound` | not applicable, [note 1](#notes) | *awaiting the set* |
| `reference/unbound/among` | `reference-unbound-among` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/continuation` | `string-continuation` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/continuation/crlf` | `string-continuation-crlf` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/empty` | `string-empty` | `ser-string-empty` | *awaiting the set* |
| `string/escape/0` | `string-escape-0` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/escape/b` | `string-escape-b` | `ser-string-escape-b` | *awaiting the set* |
| `string/escape/backslash` | `string-escape-backslash` | `ser-string-escape-backslash` | *awaiting the set* |
| `string/escape/backtick` | `string-escape-backtick` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/escape/f` | `string-escape-f` | `ser-string-escape-f` | *awaiting the set* |
| `string/escape/identity` | `string-escape-identity` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/escape/identity/a` | `string-escape-identity-a` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/escape/n` | `string-escape-n` | `ser-string-escape-n` | *awaiting the set* |
| `string/escape/octal` | `string-escape-octal` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/escape/octal/8` | `string-escape-octal-8` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/escape/quote` | `string-escape-quote` | `ser-string-escape-quote` | *awaiting the set* |
| `string/escape/r` | `string-escape-r` | `ser-string-escape-r` | *awaiting the set* |
| `string/escape/single-quote` | `string-escape-single-quote` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/escape/slash` | `string-escape-slash` | not applicable, [note 20](#notes) | *awaiting the set* |
| `string/escape/space` | `string-escape-space` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/escape/t` | `string-escape-t` | `ser-string-escape-t` | *awaiting the set* |
| `string/escape/u-braces` | `string-escape-u-braces` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/escape/u/09af` | `string-escape-u-09af` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/9afA` | `string-escape-u-9afA` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/AF09` | `string-escape-u-AF09` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/F09a` | `string-escape-u-F09a` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/afAF` | `string-escape-u-afAF` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/fAF0` | `string-escape-u-fAF0` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/002f/0` | `string-escape-u-non-hex-002f-0` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/002f/1` | `string-escape-u-non-hex-002f-1` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/002f/2` | `string-escape-u-non-hex-002f-2` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/002f/3` | `string-escape-u-non-hex-002f-3` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/003a/0` | `string-escape-u-non-hex-003a-0` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/003a/1` | `string-escape-u-non-hex-003a-1` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/003a/2` | `string-escape-u-non-hex-003a-2` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/003a/3` | `string-escape-u-non-hex-003a-3` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/0040/0` | `string-escape-u-non-hex-0040-0` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/0040/1` | `string-escape-u-non-hex-0040-1` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/0040/2` | `string-escape-u-non-hex-0040-2` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/0040/3` | `string-escape-u-non-hex-0040-3` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/0047/0` | `string-escape-u-non-hex-0047-0` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/0047/1` | `string-escape-u-non-hex-0047-1` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/0047/2` | `string-escape-u-non-hex-0047-2` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/0047/3` | `string-escape-u-non-hex-0047-3` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/0060/0` | `string-escape-u-non-hex-0060-0` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/0060/1` | `string-escape-u-non-hex-0060-1` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/0060/2` | `string-escape-u-non-hex-0060-2` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/0060/3` | `string-escape-u-non-hex-0060-3` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/0067/0` | `string-escape-u-non-hex-0067-0` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/0067/1` | `string-escape-u-non-hex-0067-1` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/0067/2` | `string-escape-u-non-hex-0067-2` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/non-hex/0067/3` | `string-escape-u-non-hex-0067-3` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/short/0` | `string-escape-u-short-0` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u/short/3` | `string-escape-u-short-3` | not applicable, [note 18](#notes) | *awaiting the set* |
| `string/escape/u00/0000` | `string-escape-u00-0000` | `ser-string-escape-u00-0000` | *awaiting the set* |
| `string/escape/u00/001f` | `string-escape-u00-001f` | `ser-string-escape-u00-001f` | *awaiting the set* |
| `string/escape/uppercase` | `string-escape-uppercase-n` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/escape/uppercase/u` | `string-escape-uppercase-u` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/escape/v` | `string-escape-v` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/escape/x` | `string-escape-x` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/quote/single` | `string-quote-single` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/quote/template` | `string-quote-template` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/quote/template/empty` | `string-quote-template-empty` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/raw-control/0000` | `string-raw-0000` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/raw-control/0009` | `string-raw-0009` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/raw-control/000a` | `string-raw-000a` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/raw-control/000d` | `string-raw-000d` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/raw-control/001f` | `string-raw-001f` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/raw-quote` | `string-raw-quote` | not applicable, [note 1](#notes) | *awaiting the set* |
| `string/raw/astral` | `string-raw-astral` | `ser-string-raw-10000` | *awaiting the set* |
| `string/raw/bmp` | `string-raw-latin`, `string-raw-cjk` | `ser-string-raw-latin`, `ser-string-raw-0800`, `ser-string-raw-007f`, `ser-string-raw-0080`, `ser-string-raw-07ff`, `ser-string-raw-d7ff`, `ser-string-raw-e000`, `ser-string-raw-ffff` | *awaiting the set* |
| `string/raw/range/0020-0021/high` | `string-raw-0021` | `ser-string-raw-0021` | *awaiting the set* |
| `string/raw/range/0020-0021/low` | `string-raw-0020` | `ser-string-raw-0020` | *awaiting the set* |
| `string/raw/range/0023-005b/high` | `string-raw-005b` | `ser-string-raw-005b` | *awaiting the set* |
| `string/raw/range/0023-005b/low` | `string-raw-0023` | `ser-string-raw-0023` | *awaiting the set* |
| `string/raw/range/005d-10ffff/high` | `string-raw-10ffff` | `ser-string-raw-10ffff` | *awaiting the set* |
| `string/raw/range/005d-10ffff/low` | `string-raw-005d` | `ser-string-raw-005d` | *awaiting the set* |
| `string/raw/slash` | `string-raw-slash` | `ser-string-raw-slash` | *awaiting the set* |
| `string/raw/ws-like/00a0` | `string-raw-ws-like-00a0` | `ser-string-raw-ws-like-00a0` | *awaiting the set* |
| `string/raw/ws-like/1680` | `string-raw-ws-like-1680` | `ser-string-raw-ws-like-1680` | *awaiting the set* |
| `string/raw/ws-like/2000` | `string-raw-ws-like-2000` | `ser-string-raw-ws-like-2000` | *awaiting the set* |
| `string/raw/ws-like/2001` | `string-raw-ws-like-2001` | `ser-string-raw-ws-like-2001` | *awaiting the set* |
| `string/raw/ws-like/2002` | `string-raw-ws-like-2002` | `ser-string-raw-ws-like-2002` | *awaiting the set* |
| `string/raw/ws-like/2003` | `string-raw-ws-like-2003` | `ser-string-raw-ws-like-2003` | *awaiting the set* |
| `string/raw/ws-like/2004` | `string-raw-ws-like-2004` | `ser-string-raw-ws-like-2004` | *awaiting the set* |
| `string/raw/ws-like/2005` | `string-raw-ws-like-2005` | `ser-string-raw-ws-like-2005` | *awaiting the set* |
| `string/raw/ws-like/2006` | `string-raw-ws-like-2006` | `ser-string-raw-ws-like-2006` | *awaiting the set* |
| `string/raw/ws-like/2007` | `string-raw-ws-like-2007` | `ser-string-raw-ws-like-2007` | *awaiting the set* |
| `string/raw/ws-like/2008` | `string-raw-ws-like-2008` | `ser-string-raw-ws-like-2008` | *awaiting the set* |
| `string/raw/ws-like/2009` | `string-raw-ws-like-2009` | `ser-string-raw-ws-like-2009` | *awaiting the set* |
| `string/raw/ws-like/200a` | `string-raw-ws-like-200a` | `ser-string-raw-ws-like-200a` | *awaiting the set* |
| `string/raw/ws-like/2028` | `string-raw-ws-like-2028` | `ser-string-raw-ws-like-2028` | *awaiting the set* |
| `string/raw/ws-like/2029` | `string-raw-ws-like-2029` | `ser-string-raw-ws-like-2029` | *awaiting the set* |
| `string/raw/ws-like/202f` | `string-raw-ws-like-202f` | `ser-string-raw-ws-like-202f` | *awaiting the set* |
| `string/raw/ws-like/205f` | `string-raw-ws-like-205f` | `ser-string-raw-ws-like-205f` | *awaiting the set* |
| `string/raw/ws-like/3000` | `string-raw-ws-like-3000` | `ser-string-raw-ws-like-3000` | *awaiting the set* |
| `string/raw/ws-like/feff` | `string-raw-ws-like-feff` | `ser-string-raw-ws-like-feff` | *awaiting the set* |
| `string/surrogate/adjacent/hh-d800` | `string-surrogate-adjacent-hh-d800` | `ser-string-surrogate-adjacent-hh-d800` | *awaiting the set* |
| `string/surrogate/adjacent/hh-d800-dbff` | `string-surrogate-adjacent-hh-d800-dbff` | `ser-string-surrogate-adjacent-hh-d800-dbff` | *awaiting the set* |
| `string/surrogate/adjacent/hh-dbff` | `string-surrogate-adjacent-hh-dbff` | `ser-string-surrogate-adjacent-hh-dbff` | *awaiting the set* |
| `string/surrogate/adjacent/lh-dc00-d800` | `string-surrogate-adjacent-lh-dc00-d800` | `ser-string-surrogate-adjacent-lh-dc00-d800` | *awaiting the set* |
| `string/surrogate/adjacent/lh-dfff-dbff` | `string-surrogate-adjacent-lh-dfff-dbff` | `ser-string-surrogate-adjacent-lh-dfff-dbff` | *awaiting the set* |
| `string/surrogate/adjacent/ll-dc00` | `string-surrogate-adjacent-ll-dc00` | `ser-string-surrogate-adjacent-ll-dc00` | *awaiting the set* |
| `string/surrogate/adjacent/ll-dfff` | `string-surrogate-adjacent-ll-dfff` | `ser-string-surrogate-adjacent-ll-dfff` | *awaiting the set* |
| `string/surrogate/lone/d800` | `string-surrogate-lone-d800` | `ser-string-surrogate-lone-d800` | *awaiting the set* |
| `string/surrogate/lone/dbff` | `string-surrogate-lone-dbff` | `ser-string-surrogate-lone-dbff` | *awaiting the set* |
| `string/surrogate/lone/dc00` | `string-surrogate-lone-dc00` | `ser-string-surrogate-lone-dc00` | *awaiting the set* |
| `string/surrogate/lone/dfff` | `string-surrogate-lone-dfff` | `ser-string-surrogate-lone-dfff` | *awaiting the set* |
| `string/surrogate/lone/raw/d800` | `string-surrogate-lone-raw-d800` | not applicable, [note 41](#notes) | *awaiting the set* |
| `string/surrogate/lone/raw/dbff` | `string-surrogate-lone-raw-dbff` | not applicable, [note 41](#notes) | *awaiting the set* |
| `string/surrogate/lone/raw/dc00` | `string-surrogate-lone-raw-dc00` | not applicable, [note 41](#notes) | *awaiting the set* |
| `string/surrogate/lone/raw/dfff` | `string-surrogate-lone-raw-dfff` | not applicable, [note 41](#notes) | *awaiting the set* |
| `string/surrogate/pair/high-corner` | `string-surrogate-pair-high-corner` | not applicable, [note 44](#notes) | *awaiting the set* |
| `string/surrogate/pair/interior` | `string-surrogate-pair-interior` | `ser-string-surrogate-pair-interior` | *awaiting the set* |
| `string/surrogate/pair/low-corner` | `string-surrogate-pair-low-corner` | not applicable, [note 43](#notes) | *awaiting the set* |
| `string/surrogate/pair/mixed` | `string-surrogate-pair-mixed` | `ser-string-surrogate-pair-mixed` | *awaiting the set* |
| `value/expression/binary` | `value-binary` | not applicable, [note 1](#notes) | *awaiting the set* |
| `value/expression/call` | `value-call` | not applicable, [note 1](#notes) | *awaiting the set* |
| `value/expression/comma` | `value-comma` | not applicable, [note 1](#notes) | *awaiting the set* |
| `value/expression/double-negation` | `value-double-negation` | not applicable, [note 1](#notes) | *awaiting the set* |
| `value/expression/index` | `value-index` | not applicable, [note 1](#notes) | *awaiting the set* |
| `value/expression/new` | `value-new` | not applicable, [note 1](#notes) | *awaiting the set* |
| `value/expression/parenthesized` | `value-parenthesized` | not applicable, [note 1](#notes) | *awaiting the set* |
| `value/expression/ternary` | `value-ternary` | not applicable, [note 1](#notes) | *awaiting the set* |
| `value/expression/this` | `value-this` | not applicable, [note 1](#notes) | *awaiting the set* |
| `value/expression/typeof` | `value-typeof` | not applicable, [note 1](#notes) | *awaiting the set* |
| `value/expression/void` | `value-void` | not applicable, [note 1](#notes) | *awaiting the set* |
| `value/sign/array` | `value-sign-array` | not applicable, [note 1](#notes) | *awaiting the set* |
| `value/sign/bare` | `value-sign-bare` | not applicable, [note 1](#notes) | *awaiting the set* |
| `value/sign/double` | `value-sign-double` | not applicable, [note 1](#notes) | *awaiting the set* |
| `value/sign/nan` | `value-sign-nan` | not applicable, [note 1](#notes) | *awaiting the set* |
| `value/sign/null` | `value-sign-null` | not applicable, [note 1](#notes) | *awaiting the set* |
| `value/sign/plus-infinity` | `value-sign-plus-infinity` | not applicable, [note 1](#notes) | *awaiting the set* |
| `value/sign/reference` | `value-sign-reference` | not applicable, [note 1](#notes) | *awaiting the set* |
| `value/sign/space` | `value-sign-space` | not applicable, [note 1](#notes) | *awaiting the set* |
| `value/sign/string` | `value-sign-string` | not applicable, [note 1](#notes) | *awaiting the set* |
| `value/sign/true` | `value-sign-true` | not applicable, [note 1](#notes) | *awaiting the set* |
| `value/sign/undefined` | `value-sign-undefined` | not applicable, [note 1](#notes) | *awaiting the set* |
| `whitespace/other/000b` | `ws-other-000b` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/000c` | `ws-other-000c` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/000c/leading` | `ws-other-000c-leading` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/00a0` | `ws-other-00a0` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/00a0/container` | `ws-other-00a0-container` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/1680` | `ws-other-1680` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/2000` | `ws-other-2000` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/2001` | `ws-other-2001` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/2002` | `ws-other-2002` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/2003` | `ws-other-2003` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/2004` | `ws-other-2004` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/2005` | `ws-other-2005` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/2006` | `ws-other-2006` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/2007` | `ws-other-2007` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/2008` | `ws-other-2008` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/2009` | `ws-other-2009` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/200a` | `ws-other-200a` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/2028` | `ws-other-2028` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/2028/required` | `ws-other-2028-required` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/2029` | `ws-other-2029` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/202f` | `ws-other-202f` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/205f` | `ws-other-205f` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/3000` | `ws-other-3000` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/3000/trailing` | `ws-other-3000-trailing` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/feff` | `ws-other-feff` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/other/feff/first` | `ws-other-feff-first` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/required/const` | `ws-required-const` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/required/default/array` | `ws-required-default-array` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/required/default/bigint` | `ws-required-default-bigint` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/required/default/false` | `ws-required-default-false` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/required/default/infinity` | `ws-required-default-infinity` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/required/default/name` | `ws-required-default-name` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/required/default/nan` | `ws-required-default-nan` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/required/default/negative` | `ws-required-default-negative` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/required/default/negative-bigint` | `ws-required-default-negative-bigint` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/required/default/negative-infinity` | `ws-required-default-negative-infinity` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/required/default/null` | `ws-required-default-null` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/required/default/number` | `ws-required-default-number` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/required/default/object` | `ws-required-default-object` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/required/default/string` | `ws-required-default-string` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/required/default/true` | `ws-required-default-true` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/required/default/undefined` | `ws-required-default-undefined` | not applicable, [note 4](#notes) | *awaiting the set* |
| `whitespace/required/export` | `ws-required-export` | not applicable, [note 4](#notes) | *awaiting the set* |
| `ws/around-colon` | `ws-around-colon` | not applicable, [note 3](#notes) | *awaiting the set* |
| `ws/around-comma` | `ws-around-comma` | not applicable, [note 3](#notes) | *awaiting the set* |
| `ws/before-semicolon` | `ws-before-semicolon` | not applicable, [note 3](#notes) | *awaiting the set* |
| `ws/cr/everywhere` | `ws-cr-everywhere` | not applicable, [note 3](#notes) | *awaiting the set* |
| `ws/cr/required` | `ws-cr-required` | not applicable, [note 3](#notes) | *awaiting the set* |
| `ws/cr/run` | `ws-cr-run` | not applicable, [note 3](#notes) | *awaiting the set* |
| `ws/crlf` | `ws-crlf` | not applicable, [note 3](#notes) | *awaiting the set* |
| `ws/inside-empty` | `ws-inside-empty` | not applicable, [note 3](#notes) | *awaiting the set* |
| `ws/lf/everywhere` | `ws-lf-everywhere` | not applicable, [note 3](#notes) | *awaiting the set* |
| `ws/lf/required` | `ws-lf-required` | not applicable, [note 3](#notes) | *awaiting the set* |
| `ws/lf/run` | `ws-lf-run` | not applicable, [note 3](#notes) | *awaiting the set* |
| `ws/none-optional` | `ws-none-optional` | not applicable, [note 3](#notes) | *awaiting the set* |
| `ws/run/all-four` | `ws-run-all-four` | not applicable, [note 3](#notes) | *awaiting the set* |
| `ws/run/all-four/reversed` | `ws-run-all-four-reversed` | not applicable, [note 3](#notes) | *awaiting the set* |
| `ws/space/everywhere` | `ws-space-everywhere` | not applicable, [note 3](#notes) | *awaiting the set* |
| `ws/space/required` | `ws-space-required` | not applicable, [note 3](#notes) | *awaiting the set* |
| `ws/space/run` | `ws-space-run` | not applicable, [note 3](#notes) | *awaiting the set* |
| `ws/tab/everywhere` | `ws-tab-everywhere` | not applicable, [note 3](#notes) | *awaiting the set* |
| `ws/tab/required` | `ws-tab-required` | not applicable, [note 3](#notes) | *awaiting the set* |
| `ws/tab/run` | `ws-tab-run` | not applicable, [note 3](#notes) | *awaiting the set* |

## Notes

Why a role owes no vector. Each is a record in
`spec/datajs/vectors/not-applicable`, and answers either one class, every
class under a prefix, or every class no set but one carries — so one note
stands under as many rows as it is true of.

1. **`serializer`**, set `reject` — a reject class names a document a reader refuses, and a serializer refuses no input at all; it is handed a value of the data model and its type is the contract
2. **`serializer`**, subtree `id` — a const name is the serializer's to choose, so the shape of one is the reader's branch; normalized form is where naming is pinned
3. **`serializer`**, subtree `ws` — a serializer is handed a graph and picks its own spelling, so this is the reader's branch; what a normalized serializer must emit is pinned under that role
4. **`serializer`**, subtree `whitespace` — a serializer is handed a graph and picks its own spelling, so this is the reader's branch; what a normalized serializer must emit is pinned under that role
5. **`serializer`**, subtree `document` — the document's own edges and spellings are what a reader takes, and a serializer may emit any of them; normalized form is where one is chosen
6. **`serializer`**, subtree `number/exp` — a serializer is handed a graph and picks its own spelling, so this is the reader's branch; what a normalized serializer must emit is pinned under that role
7. **`serializer`**, subtree `number/zero` — a serializer is handed a graph and picks its own spelling, so this is the reader's branch; what a normalized serializer must emit is pinned under that role
8. **`serializer`**, subtree `number/frac/one-digit` — a serializer is handed a graph and picks its own spelling, so this is the reader's branch; what a normalized serializer must emit is pinned under that role
9. **`serializer`**, subtree `number/frac/high-first` — a serializer is handed a graph and picks its own spelling, so this is the reader's branch; what a normalized serializer must emit is pinned under that role
10. **`serializer`**, subtree `number/frac-exp` — a serializer is handed a graph and picks its own spelling, so this is the reader's branch; what a normalized serializer must emit is pinned under that role
11. **`serializer`**, subtree `number/int/digit9` — a serializer is handed a graph and picks its own spelling, so this is the reader's branch; what a normalized serializer must emit is pinned under that role
12. **`serializer`**, subtree `number/int/digits` — a serializer is handed a graph and picks its own spelling, so this is the reader's branch; what a normalized serializer must emit is pinned under that role
13. **`serializer`**, subtree `number/binary64/rounding` — a serializer is handed a graph and picks its own spelling, so this is the reader's branch; what a normalized serializer must emit is pinned under that role
14. **`serializer`**, subtree `number/binary64/overflow` — the value is an infinity, which the serializer set carries as a leaf of its own; this class is the reader's spelling of one
15. **`serializer`**, subtree `number/binary64/underflow` — the value is a zero, which the serializer set carries with both signs; this class is the reader's spelling of one
16. **`serializer`**, subtree `bigint/digit9` — a serializer is handed a graph and picks its own spelling, so this is the reader's branch; what a normalized serializer must emit is pinned under that role
17. **`serializer`**, subtree `bigint/zero/neg` — the value is zero, which a bigint has only one of; the serializer set carries it, and the negative spelling is the reader's
18. **`serializer`**, subtree `string/escape/u` — a serializer is handed a graph and picks its own spelling, so this is the reader's branch; what a normalized serializer must emit is pinned under that role
19. **`serializer`**, subtree `key/string/escape/u` — a serializer is handed a graph and picks its own spelling, so this is the reader's branch; what a normalized serializer must emit is pinned under that role
20. **`serializer`**, subtree `string/escape/slash` — the value is the same one the serializer set carries; only the document spelling differs
21. **`serializer`**, subtree `key/string/escape/slash` — the value is the same one the serializer set carries; only the document spelling differs
22. **`serializer`**, subtree `object/duplicate` — a duplicate key is a document fact and never a graph fact, so no input a serializer is handed can carry one
23. **`serializer`**, subtree `object/key-order/non-index` — observable key order is one property and the serializer set pins it once, with an object mixing index and string keys; the rest are the reader's readings of a document
24. **`serializer`**, subtree `object/key-order/index-first` — observable key order is one property and the serializer set pins it once, with an object mixing index and string keys; the rest are the reader's readings of a document
25. **`serializer`**, subtree `object/key-order/escaped-index` — observable key order is one property and the serializer set pins it once, with an object mixing index and string keys; the rest are the reader's readings of a document
26. **`serializer`**, subtree `const/reference` — a const is how a document spells sharing, not a fact about the graph, so a serializer chooses whether and how to bind; what it may not choose is hoisting a node reached twice, which the sharing vectors carry
27. **`serializer`**, subtree `const/one` — a const is how a document spells sharing, not a fact about the graph, so a serializer chooses whether and how to bind; what it may not choose is hoisting a node reached twice, which the sharing vectors carry
28. **`serializer`**, subtree `const/two` — a const is how a document spells sharing, not a fact about the graph, so a serializer chooses whether and how to bind; what it may not choose is hoisting a node reached twice, which the sharing vectors carry
29. **`serializer`**, subtree `const/value` — a const is how a document spells sharing, not a fact about the graph, so a serializer chooses whether and how to bind; what it may not choose is hoisting a node reached twice, which the sharing vectors carry
30. **`serializer`**, subtree `const/unreferenced` — a const is how a document spells sharing, not a fact about the graph, so a serializer chooses whether and how to bind; what it may not choose is hoisting a node reached twice, which the sharing vectors carry
31. **`serializer`**, subtree `const/unshared` — a const is how a document spells sharing, not a fact about the graph, so a serializer chooses whether and how to bind; what it may not choose is hoisting a node reached twice, which the sharing vectors carry
32. **`serializer`**, subtree `const/shared/leaf` — a shared leaf is invisible in a graph, since leaves compare by value and not by identity, so no input can carry one
33. **`serializer`**, subtree `const/shared/nested` — a const is how a document spells sharing, not a fact about the graph, so a serializer chooses whether and how to bind; what it may not choose is hoisting a node reached twice, which the sharing vectors carry
34. **`serializer`**, subtree `array/two` — the serializer set covers containers by shape rather than by element count, since a walker cannot tell two from three without telling one from two
35. **`serializer`**, subtree `object/two` — the serializer set covers containers by shape rather than by element count, since a walker cannot tell two from three without telling one from two
36. **`serializer`**, subtree `array/object` — the serializer set covers containers by shape rather than by element count, since a walker cannot tell two from three without telling one from two
37. **`serializer`**, subtree `array/nested/deep` — the specification states no depth an implementation must support, so no vector can say which depth conforming means; a writer's own recursion limit is real and tracked where it belongs, in fjs/media/datajs/todo/serializer.md, and a set can spell a chain deep enough to find one, measured at 2600 consts, but a vector there would assert a refusal at a depth the specification permits, which names this writer's bug rather than anything conforming means
38. **`serializer`**, subtree `object/nested/deep` — the specification states no depth an implementation must support, so no vector can say which depth conforming means; a writer's own recursion limit is real and tracked where it belongs, in fjs/media/datajs/todo/serializer.md, and a set can spell a chain deep enough to find one, measured at 2600 consts, but a vector there would assert a refusal at a depth the specification permits, which names this writer's bug rather than anything conforming means
39. **`serializer`**, subtree `array/nested/empty` — the serializer set covers containers by shape rather than by element count, since a walker cannot tell two from three without telling one from two
40. **`serializer`**, subtree `object/nested/empty` — the serializer set covers containers by shape rather than by element count, since a walker cannot tell two from three without telling one from two
41. **`serializer`**, subtree `string/surrogate/lone/raw` — a lone surrogate is one value however a document spells it, and the serializer set carries all four
42. **`serializer`**, subtree `key/string/surrogate/lone/raw` — a lone surrogate is one value however a document spells it, and the serializer set carries all four
43. **`serializer`**, subtree `string/surrogate/pair/low-corner` — both corner values are in this set already as raw astral characters, and what a pair class adds over them is a spelling; a writer that fails to pair escapes each half, which denotes the same string, so this role cannot see the difference
44. **`serializer`**, subtree `string/surrogate/pair/high-corner` — both corner values are in this set already as raw astral characters, and what a pair class adds over them is a spelling; a writer that fails to pair escapes each half, which denotes the same string, so this role cannot see the difference
45. **`serializer`**, subtree `key/string/surrogate/pair/low-corner` — both corner values are in this set already as raw astral characters, and what a pair class adds over them is a spelling; a writer that fails to pair escapes each half, which denotes the same string, so this role cannot see the difference
46. **`serializer`**, subtree `key/string/surrogate/pair/high-corner` — both corner values are in this set already as raw astral characters, and what a pair class adds over them is a spelling; a writer that fails to pair escapes each half, which denotes the same string, so this role cannot see the difference
47. **`serializer`**, class `key/proto/value/null` — a value behind this key is written by the same emitter as any other member value, and every leaf and container shape has a vector of its own; what is particular to the key is its spelling and the sharing behind it, and both have vectors too
48. **`serializer`**, class `key/proto/value/object` — a value behind this key is written by the same emitter as any other member value, and every leaf and container shape has a vector of its own; what is particular to the key is its spelling and the sharing behind it, and both have vectors too
49. **`serializer`**, subtree `byte` — a byte document is a reader's input; a serializer is handed a graph and emits a document as text, so encoding it is the caller's
