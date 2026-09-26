## Console program

**Priority:** P2
**Status:** open

The `nanvm` **crate** — the self-hosting milestone of the
[MVP roadmap](./mvp-roadmap.md), shipped on crates.io (not npm): the
`nanvm-lib` runtime, the `nanvm-effects-node` effect runner (the Rust twin
of `fjs/effects/node` — see the effects section of the roadmap), the
generated Rust of the FJS compiler, loader and interpreter (the same FJS
sources used on JavaScript hosts), and a thin hand-written `main`, built by
cargo into a single native executable that parses and runs supported authored
FJS — no Node/Deno, no rustc at the user's run time. Its AOT-compiled FJS
interpreter evaluates loaded EDAG as data. The
[loader](../../fjs/fsc/todo/load-modules-without-import-effect.md) needs no
native `import` or function-construction effect, and the optional
[Rust EDAG library](../../todo/rust-edag.md) is not a prerequisite.

The native CLI's source contract is authored FunctionalScript, which is `.f.mjs`
today. Note what `.f.mjs` does and does not mean, per
[`fjs/fsc/README.md`](../../fjs/fsc/README.md): it marks FunctionalScript-intent
JavaScript and does **not** promise that the compiler in the same repository
revision accepts the module. That promise is what the stage-2 `.f.js` marker
will carry, so the extension this command accepts becomes `.f.js` for renamed
modules once stage 2 begins. `.f.js` is not generated output either — no build
or packaging step produces repository `.f.js` source — so it is not excluded on
that basis. (`fjs compile` does write one wherever a caller names it as the
output path; that is the compiler's output for a user, not repository source.)

The generated compiler source is **committed to git** and packaged by cargo
like any other source file, so consumers build pure Rust with no build
dependencies — no Node, no network, no third-party JS engine — and
`cargo publish` needs no `--allow-dirty`. The committed copy is a verified
cache of the generator's output: the CI drift check regenerates it on every
PR and fails on any diff. See the distribution section of
[mvp-roadmap](./mvp-roadmap.md) for the full arrangement, the rejected
alternatives (including the earlier publish-time-generation plan this
reverses), and the reproducibility check: both distributions must emit
byte-identical `.rs` output for the same input; once the crate ships, the
check closes into a fixed point — the crate-shipped compiler regenerates its
own packaged source, identically.

Open question (see [mvp-roadmap](./mvp-roadmap.md#open-questions)): is the
crate's binary named `fjs` (same CLI surface as the npm tool, native) or
`nanvm`?

**Loading and execution:** loading evaluates a module to its complete export
object without automatically calling exported functions. The CLI then chooses
what to run or print. Effects, including `sandbox` for capturing computation
results and throws, are handled by the
[native runner](../../todo/nanvm-effects-node.md).

**Open question:** the earlier default-export/autocall proposal conflicts with
the shipped `fjs run`, which runs a module's exported `main` as a `NodeProgram`
([`fjs/module.f.mjs`](../../fjs/module.f.mjs)) and refuses a module without
one, and with the harness's [`run`](../../nanvm-harness/src/lib.rs), under
which no export name is mandatory and exported functions are never invoked
just because the module was loaded. Whether the native CLI mirrors
`fjs run`, explicitly selects and calls a default export, or offers both is
undecided. This is the CLI's entry-selection policy: it supplies the chosen
export to [fs-vm-load-save](./fs-vm-load-save.md)'s generic Execute step, whose
selection comes from its caller.
