import { assertStructurallySame } from '../../../asserts/module.f.js'
import { select } from './module.f.js'

export const proof = /** @type {const} */ ({
    functionalScript: () => {
        for (const path of ['fjs/a/module.f.mjs', 'fjs/a/module.f.js', 'fjs/a/input.data.js',
            'package.json', 'deno.json', 'fjs/module.mjs', 'fjs/spidermonkey.mjs', 'gen.cloudflare',
            'fjs/a/gen.output/data.bin', 'fjs/effects/node/module.mjs',
            'fjs/emergent_testing/node/module.mjs', 'fjs/emergent_testing/loader.cjs',
            'spec/types/module.f.js']) {
            assertStructurallySame(select(path), ['fjs'])
        }
    },
    javascript: () => {
        for (const path of ['fjs/a/module.mjs', 'fjs/a/module.js', 'fjs/a/module.cjs',
            'package-lock.json', 'deno.lock', 'bun.lock', 'spec/functions/README.md']) {
            assertStructurallySame(select(path), ['js'])
        }
    },
    typescript: () => {
        for (const path of ['fjs/a/types.ts', 'fjs/a/types.d.ts', 'tsconfig.json']) {
            assertStructurallySame(select(path), ['ts'])
        }
    },
    rust: () => {
        for (const path of ['Cargo.toml', 'Cargo.lock', '.cargo/config.toml',
            'nanvm/lib/src/vm/README.md', 'nanvm/harness/tests/a.rs',
            'nanvm/effects-node/Cargo.toml', 'nanvm/demos/publish/src/lib.rs']) {
            assertStructurallySame(select(path), ['rust'])
        }
    },
    overlappingInputs: () => {
        assertStructurallySame(select('nanvm/lib/src/gen.methods.rs'), ['fjs', 'rust'])
        assertStructurallySame(select('nanvm/harness/fixtures/a.mjs'), ['js', 'rust'])
        assertStructurallySame(select('nanvm/demos/a/types.ts'), ['ts', 'rust'])
        assertStructurallySame(select('gen.nix/run'), ['fjs', 'rust'])
        assertStructurallySame(select('.github/workflows/gen.ci.yml'), ['fjs', 'rust'])
        assertStructurallySame(select('fjs/ci/cache/module.f.mjs'), ['fjs', 'rust'])
        assertStructurallySame(select('fjs/ci/cache/types.ts'), ['ts', 'rust'])
        for (const path of ['.gitattributes', '.gitignore', '.node-version', 'dev.sh']) {
            assertStructurallySame(select(path), ['fjs', 'rust'])
        }
    },
    namedExclusions: () => {
        for (const path of ['README.md', 'fjs/a/README.md', 'todo/a/proposal.txt',
            'changelog/next.txt', 'doc/diagram.svg', '.claude/settings.json',
            '.devcontainer/Dockerfile', '.assetsignore', '.github/FUNDING.yml',
            '.github/dependabot.yml', 'LICENSE', 'favicon.ico', 'funding.json',
            'wrangler.jsonc', 'fjs/website/favicon.svg']) {
            assertStructurallySame(select(path), [])
        }
    },
    unknownInputs: () => {
        assertStructurallySame(select('fjs/a/new-fixture.json'), null)
        assertStructurallySame(select('new-tool.config'), null)
    },
})
