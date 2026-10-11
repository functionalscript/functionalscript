import { assert, assertEq } from '../../asserts/module.f.mjs'
import { rust } from '../../ci/config/module.f.js'
import { step as ioStep } from '../../effects/module.f.mjs'
import { readUtf8File } from '../../effects/node/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import { build, buildPath, buildText, generatedDirectory, main } from './module.f.mjs'

export const proof = {
    // Fixed text: the pin written in full, an install only where `cargo` is
    // missing, no pipe to hide a failed download from `set -e`, and no tool
    // beyond the three approved.
    buildText: () => assertEq(buildText(), `#!/bin/sh
set -e
if ! command -v cargo > /dev/null
then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o "$HOME/rustup-init.sh"
    sh "$HOME/rustup-init.sh" -y --profile minimal --default-toolchain ${rust} --no-modify-path
    PATH="$HOME/.cargo/bin:$PATH"
fi
cargo doc --no-deps --workspace
node ./fjs/module.mjs r ./fjs/website/module.f.mjs
`),
    // The pin is the config's, not a copy of it.
    namesThePin: () => assert(buildText().includes(` --default-toolchain ${rust} `), buildText()),
    buildPath: () => {
        assertEq(generatedDirectory, 'gen.website')
        assertEq(buildPath, 'gen.website/build.sh')
    },
    // The script is written where `npm run website` names it.
    writes: () => {
        const [, [tag, result]] = virtual(emptyState)(ioStep(build, () => readUtf8File(buildPath)))
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
