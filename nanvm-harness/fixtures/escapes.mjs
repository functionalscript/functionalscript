/**
 * Compiled by `fjs compile` into the sibling `escapes.rs`, committed and
 * drift-checked by `npm run gen` (see `../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins the code points a Rust string literal cannot hold as
 * they stand — a control character, DEL, and a bidirectional control that
 * `rustc` refuses in a literal — each written by `fjs/media/rust` as its
 * `\u{…}` escape and read back by the VM as the character it names.
 */
export default ["\u0000", "\u001f", "\u007f", "‮", "⁩"];
