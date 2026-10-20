import { assert, assertEq } from '../../asserts/module.f.js'
import { rust } from '../../ci/config/module.f.js'
import { step as ioStep } from '../../effects/module.f.mjs'
import { readUtf8File } from '../../effects/node/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import { buildPath, buildText, cloudflare, generatedDirectory, main } from './module.f.mjs'

export const proof = {
    // Fixed text: the pin written in full, no pipe to hide a failed download
    // from `set -e`, no tool beyond the five approved, the bars written
    // before `cargo doc` and the site once, after it.
    buildText: () => assertEq(buildText(), `#!/bin/sh
set -e
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o "$HOME/rustup-init.sh"
sh "$HOME/rustup-init.sh" -y --profile minimal --default-toolchain ${rust} --no-modify-path
export PATH="$HOME/.cargo/bin:$PATH"
rustup target add wasm32-unknown-unknown
cargo build -p nanvm-demos --release --target wasm32-unknown-unknown
cargo run -p nanvm-demos-publish --release -- target/wasm32-unknown-unknown/release/nanvm_demos.wasm nanvm/demos/_build/nanvm_demos.wasm nanvm/demos/_build hello sort
npm run rustdoc-bars
RUSTDOCFLAGS="--html-in-header $PWD/_rustdoc-head.html --html-before-content $PWD/_rustdoc-header.html --html-after-content $PWD/_rustdoc-footer.html --extend-css $PWD/_rustdoc.css" cargo doc --no-deps --workspace
npm run website
`),
    // The pin is the config's, not a copy of it.
    namesThePin: () => assert(buildText().includes(` --default-toolchain ${rust} `), buildText()),
    buildPath: () => {
        assertEq(generatedDirectory, 'gen.cloudflare')
        assertEq(buildPath, 'gen.cloudflare/build.sh')
    },
    // The script is written where the dashboard's command names it.
    writes: () => {
        const [, [tag, result]] = virtual(emptyState)(ioStep(cloudflare, () => readUtf8File(buildPath)))
        assert(tag === 'ok', result)
        assertEq(result, buildText())
    },
    main: () => {
        const [state, [tag, result]] = virtual(emptyState)(main(defaultNodeProgramOptions))
        assert(tag === 'ok', result)
        assertEq(result, 0)
        assert(state.root[generatedDirectory] !== undefined, 'expected the generated directory')
    },
}
