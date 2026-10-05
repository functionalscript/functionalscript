## repository-compile-reach. What stops `fjs compile` on the repository's own modules

**Priority:** P2
**Status:** open

### Problem

The self-hosting milestone ([mvp-roadmap](../../../nanvm-lib/todo/mvp-roadmap.md))
needs the compiler, loader and interpreter, which are authored `.f.mjs`, to
compile to Rust. How far is that? Run `fjs compile <module> <out>.rs` over
every `fjs/**/module.f.mjs` and read the first refusal. At `a84ff2980`, **one
of 212 modules compiles** (`fjs/compiler/examples/module.f.mjs`, an example
written for the purpose). Every other one stops at its first unsupported
construct, and a module that clears its first may stop at its next; the table
counts only the first, so it says what to do first, not how much each costs.

| Modules | First refusal | Example |
| ---: | --- | --- |
| 87 | a template literal, `` `…${x}…` `` | `fjs/cas/cli/module.f.mjs:44` |
| 46 | destructuring: `const { a, b } = o`, `const [k, v] = e`, `({ a, b }) => …` | `fjs/basen/base128/module.f.mjs:12`, `fjs/common/monoid/module.f.mjs:47` |
| 14 | a statement the language has no spelling for yet: `let`, `for`, `switch` | `fjs/crypto/sha1/module.f.mjs:118`, `fjs/types/btree/module.f.mjs:16` |
| 9 | a numeric literal spelled `0b0101` or `0xffff_ffffn` | `fjs/text/utf8/module.f.mjs:41`, `fjs/crypto/secp/module.f.mjs:116` |
| 9 | an escape in a single-quoted string: `'\x07'`, `'\b'` | `fjs/git/alternates/module.f.mjs:98` |
| 8 | a shorthand member, `{ a, b }` | `fjs/ci/self/module.f.mjs:43` |
| 8 | `!`, the logical not | `fjs/edag/value/function/module.f.mjs:29` |
| 6 | a call as a statement: `assert(…)` | `fjs/ebnf/ast/module.f.mjs:26` |
| 5 | a host global: `new Set`, `new Map` | `fjs/compiler/tokenizer/module.f.mjs:75` |
| 5 | a name not in scope: `Number`, a schema constant the module imports | `fjs/js/array_index/module.f.mjs:33`, `fjs/edag/module.f.mjs:63` |
| 5 | a computed member or key, `a[i]`, `{ [s]: v }` | `fjs/types/list/module.f.mjs:30`, `fjs/fsm/module.f.mjs:85` |
| 2 | `instanceof` | `fjs/types/array/module.f.mjs:15` |
| 1 | a default parameter, `(v, msg = 'x') =>` | `fjs/asserts/module.f.mjs:25` |
| 6 | other: `typeof` in a condition, a reassignment, a callback using `%` | `fjs/edag/value/array/module.f.mjs:30`, `fjs/types/bigfloat/module.f.mjs:32` |

The classification is by the token the refusal points at, read from the line
it names; it is a survey, not a diagnosis, and a few rows hold more than one
cause. Reproduce it with the loop in the next section.

### What follows

- **Template literals** are the first blocker of 41% of the 211 modules that refuse (87), and they are almost all error messages and `assert` texts. They are a feature with
  open questions of their own ([template-literals](../../../spec/todo/3440-template-literals.md):
  what a substitution may be, and the canonical form), so this is the case for
  settling those questions, not a license to start before they are.
- **Destructuring** is next at 22% (46), and **binary/underscore numeric
  spellings** and **single-quoted escapes** are tokenizer-level and cheap by
  comparison (9 and 9 modules).
- **Source spellings for operations the EDAG already has** are among the small
  rows, and are why the backend work on them has no use yet: the first refusal of
  `String(1)`, `Number(1n)` and `Object.is(1, 2)` as source is `const not
  found`, and `[1, 2][Number(0)]` stops at the index
  ([built-in](../../../spec/todo/2360-built-in.md),
  [global-names](../../../spec/todo/2365-global-names.md),
  [property-accessor](../../../spec/todo/2330-property-accessor.md)).
- **No module is one feature from compiling.** A migration `.f.mjs` → `.f.js`
  of the modules after the first two or three rows will meet statements and
  host globals next, so the order above is the order in which modules *begin*
  to get further, and the count of modules that finish is a separate number to
  record at each step.
- **Calls through imports** (the `assert`/`isArray` row) are what the compiler
  cannot do until it reads another module's functions: not a syntax gap but the
  boundary of "a program is one module graph linked into one EDAG".

### Reproducing

```sh
for f in $(find fjs -name module.f.mjs | sort); do
  echo "$f|$(node fjs/module.mjs compile "$f" /tmp/out.rs 2>&1 | head -1)"
done
```

An empty second field is a module that compiled. The first refusal is the
`file:line:col` in the message, and the line it names is the one counted
above.

### Tasks

- [ ] Keep this count where the next feature lands: when a row's feature is
      added, rerun the loop and replace the table, so the roadmap's "how far"
      is a number and not a feeling.
- [ ] A check that fails when the number of modules that compile goes *down*,
      since every feature should only add to it.

### Related

- [mvp-roadmap](../../../nanvm-lib/todo/mvp-roadmap.md) — the self-hosting
  milestone this measures the distance to.
- [`fjs/compiler/README.md`](../README.md) — the extension contract and the
  `.f.mjs` → `.f.js` migration.
- [template-literals](../../../spec/todo/3440-template-literals.md),
  [destructuring](../../../spec/todo/2450-destructuring.md) — the largest rows.
