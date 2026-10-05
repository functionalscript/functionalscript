## repository-compile-reach. What stops `fjs compile` on the repository's own modules

**Priority:** P2
**Status:** open

### Problem

The self-hosting milestone ([mvp-roadmap](../../../nanvm-lib/todo/mvp-roadmap.md))
needs the compiler, loader and interpreter, which are authored `.f.mjs`, to
compile to Rust. How far is that? Run `fjs compile <module> <out>.rs` over
every `fjs/**/module.f.mjs` and read the first refusal. At `a84ff2980`, **one
of 211 modules compiles** (`fjs/compiler/examples/module.f.mjs`, an example
written for the purpose). Every other one stops at its first unsupported
construct, and a module that clears its first may stop at its next; the table
counts only the first, so it says what to do first, not how much each costs.

| Modules | First refusal | Example |
| ---: | --- | --- |
| 87 | a template literal, `` `…${x}…` `` | `fjs/cas/cli/module.f.mjs:44` |
| 29 | destructuring: `const { a, b } = o`, `([k, v]) => …`, `({ a }) => …` | `fjs/basen/base128/module.f.mjs:12`, `fjs/common/monoid/module.f.mjs:47` |
| 12 | a numeric literal with a binary or underscore spelling: `0b0101`, `0xffff_ffffn` | `fjs/text/utf8/module.f.mjs:41`, `fjs/crypto/secp/module.f.mjs:116` |
| 10 | a statement the language has no spelling for yet: `let`, `for`, `switch` | `fjs/crypto/sha1/module.f.mjs:118`, `fjs/types/btree/module.f.mjs:16` |
| 9 | an escape in a single-quoted string: `'\x07'`, `'\b'` | `fjs/git/alternates/module.f.mjs:98` |
| 8 | `!`, the logical not | `fjs/edag/value/function/module.f.mjs:29` |
| 8 | a trailing `}` after an object argument spelled `ci({ … })` (a call whose argument is an object with a shorthand member) | `fjs/ci/self/module.f.mjs:43` |
| 7 | `assert(…)`, `isArray(…)`: a call to an imported function (the callee is refused before its arguments are read) | `fjs/ebnf/ast/module.f.mjs:26` |
| 8 | a host global: `Set`, `Map`, `Number`, `instanceof`, `Array` | `fjs/compiler/tokenizer/module.f.mjs:75`, `fjs/types/array/module.f.mjs:15` |
| 4 | a computed member, `a[i]`, `b[x + k]` | `fjs/types/list/module.f.mjs:30`, `fjs/git/bytes/module.f.mjs:25` |
| 4 | a default parameter, `(v, msg = 'x') =>` | `fjs/asserts/module.f.mjs:25` |
| 6 | other: a name not in scope in a module that imports a schema constant, a spread of a computed key, a conditional chain | `fjs/edag/module.f.mjs:63`, `fjs/fsm/module.f.mjs:85` |

The classification is by the token the refusal points at, read from the line
it names; it is a survey, not a diagnosis, and a few rows hold more than one
cause. Reproduce it with the loop in the next section.

### What follows

- **Template literals** are the first blocker of 41% of the modules, and they
  are almost all error messages and `assert` texts. They are a feature with
  open questions of their own ([template-literals](../../../spec/todo/3440-template-literals.md):
  what a substitution may be, and the canonical form), so this is the case for
  settling those questions, not a license to start before they are.
- **Destructuring** is next at 14%, and **binary/underscore numeric spellings**
  and **single-quoted escapes** are tokenizer-level and cheap by comparison
  (12 and 9 modules).
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
