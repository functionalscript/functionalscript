## Host proofs for effects only

**Priority:** P2 — the rule is written and nothing new may break it, but the
tree still holds host proofs from before it, and each one reads as precedent
to whoever opens it next.
**Status:** open — the survey below counts files; none is classified yet,
but one class has the owner's ruling: [engine runs](#engine-runs).

### Problem

[`fjs/AGENTS.md` §1.6](../fjs/AGENTS.md#16-a-host-proof-is-for-an-effect-and-for-nothing-else)
says a `proof.mjs` proves code that performs effects and nothing else. The
tree holds 90 `proof.mjs` and `*.proof.mjs` files, written while a host
proof was also allowed for "a documented host contract". Some prove an effect:
a `node:` binding, a DOM adapter, a program run over real files and sockets.
Others exist because a case would not compile, or use the host as a reference,
which §1.6 now names as no reason.

Where they are, by directory:

| where | files |
| - | - |
| `fjs/compiler` | 12 |
| `fjs/website` | 9 |
| `spec/modules` | 8 |
| `fjs/ir` | 6 |
| `fjs/nanvm` | 5 |
| `fjs/emergent_testing` | 5 |
| `fjs/effects` | 5 |
| `fjs/edag` | 5 |
| `spec/operators` | 4 |
| `spec/bindings` | 4 |
| `fjs/js` | 4 |
| `spec/values` | 3 |
| `spec/property-access` | 3 |
| `spec/functions` | 2 |
| `spec/conversions` | 2 |
| `spec/built-ins` | 2 |
| `fjs/wasm` | 2 |
| `fjs/types` | 2 |
| `fjs/ci` | 2 |
| `spec/datajs` | 1 |
| `spec/control-flow` | 1 |
| `fjs/web` | 1 |
| `fjs/media` | 1 |
| `fjs/mcp` | 1 |

No file has been read for this list. Which side of the rule each falls on is
the first task, and a count is not a verdict on any of them.

### Proposal

Go directory by directory, one pull request each. For every case in a host
proof, one of three things is true, and §1.6 says what follows:

- it proves an effect: it stays, and the proof's header names the effect;
- FunctionalScript can state it: it moves to the sibling `proof.f.js`,
  rewritten where the compiler refuses the spelling
  ([CONVERTING.md](../doc/CONVERTING.md));
- it proves the host, or needs a value FunctionalScript cannot build: it is
  removed. Coverage does not move, since such a case covers no module line;
  measure it before and after to confirm.

A host proof left with no case is deleted.

### Engine runs

The owner's ruling, 2026-11-27, on
[#4150](https://github.com/functionalscript/functionalscript/pull/4150):
a host proof that compiles modules of the IR to WebAssembly and runs them
on the host's engine, against twins in JavaScript, proves an effect for
now, and stays in its `proof.mjs`. `fjs/ir/wasm/proof.mjs` is one, and so
are the proofs that NaNVM's test runs again on its `.wasm`. What only an
engine settles is whether a module that the emitter writes validates and
computes what the IR means, and FunctionalScript runs no WebAssembly. New
engine runs may join them, as the runtime in the IR grows.

They are not to stay there: the owner wants them moved into files of
their own, outside the host proofs, which CI runs by name, as it runs
`fjs/ir/l0/host/nanvm/nanvm.test.mjs`
([engine runs in files of their own](../fjs/ir/todo/engine-runs.md)).

### Tasks

- [ ] Classify every file above as effect, restatable, or host-only, in this
      file, before changing any.
- [ ] One pull request per directory: move, rewrite or remove, with coverage
      at 100% before and after.
- [ ] Delete this file when no `proof.mjs` proves anything but an effect.

### Related

- [in-module-proof-exports.md](../fjs/todo/in-module-proof-exports.md) and
  [modules-without-proof.md](../fjs/todo/modules-without-proof.md) — where a proof
  lives and whether a module has one.
