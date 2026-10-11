import { assertEq } from '../../asserts/module.f.mjs'
import { rust } from '../../ci/config/module.f.js'
import { docArgs, rustupInitArgs, rustupInitUrl, targetTriple } from './module.f.mjs'

export const proof = {
    targetTriple: () => {
        assertEq(targetTriple('linux', 'x64'), 'x86_64-unknown-linux-gnu')
        assertEq(targetTriple('linux', 'arm64'), 'aarch64-unknown-linux-gnu')
        assertEq(targetTriple('darwin', 'x64'), 'x86_64-apple-darwin')
        assertEq(targetTriple('darwin', 'arm64'), 'aarch64-apple-darwin')
        assertEq(targetTriple('win32', 'x64'), null)
        assertEq(targetTriple('linux', 'ia32'), null)
    },
    rustupInitUrl: () => assertEq(
        rustupInitUrl('x86_64-unknown-linux-gnu'),
        'https://static.rust-lang.org/rustup/dist/x86_64-unknown-linux-gnu/rustup-init'),
    // The toolchain `rustup-init` installs is the pin, not a copy of it.
    rustupInitArgs: () => assertEq(
        rustupInitArgs.join(' '),
        `-y --profile minimal --default-toolchain ${rust} --no-modify-path`),
    docArgs: () => assertEq(docArgs.join(' '), 'doc --no-deps --workspace'),
}
