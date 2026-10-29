import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { rust } from '../../ci/config/module.f.js'
import { step as ioStep } from '../../effects/module.f.mjs'
import { readUtf8File } from '../../effects/node/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import { buildPath, buildText, cloudflare, generatedDirectory, main, uploadArgs, wranglerVersion } from './module.f.mjs'

export const proof = {
    production: () => {
        assertEq(wranglerVersion, '4.74.0')
        assertStructurallySame(uploadArgs('production', ''), ['--yes', 'wrangler@4.74.0', 'deploy'])
    },
    previews: () => {
        for (const [branch, alias] of [
            ['codex/cloudflare-deploy-job', 'codex-cloudflare-deploy-job'],
            ['Feature/A_1..B', 'feature-a-1-b'],
            ['--hello--', 'hello'],
            ['a'.repeat(45) + '-tail', '' + 'a'.repeat(45)],
            ['b'.repeat(80), '' + 'b'.repeat(46)],
            ['feature/' + 'a'.repeat(45), 'feature-' + 'a'.repeat(38)],
            ['你好/world', 'world'],
        ]) {
            assertStructurallySame(uploadArgs('preview', branch), ['--yes', 'wrangler@4.74.0', 'versions', 'upload', '--preview-alias', alias])
        }
    },
    throw: {
        unknownMode: () => uploadArgs('invalid', 'branch'),
        startsWithDigit: () => uploadArgs('preview', '123-feature'),
        emptyAlias: () => uploadArgs('preview', '---'),
    },
    // Fixed text: the pin written in full, no pipe to hide a failed download
    // from `set -e`, no tool beyond the four approved, the bars written
    // before `cargo doc` and the site once, after it.
    buildText: () => assertEq(buildText(), `#!/bin/sh
set -e
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o "$HOME/rustup-init.sh"
sh "$HOME/rustup-init.sh" -y --profile minimal --default-toolchain ${rust} --no-modify-path --target wasm32-unknown-unknown
export PATH="$HOME/.cargo/bin:$PATH"
sh ./nanvm/demos/gen.build.sh
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
