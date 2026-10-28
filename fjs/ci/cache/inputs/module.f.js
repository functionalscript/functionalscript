/**
 * The committed inputs each CI check reads. JavaScript has three nested
 * rungs; Rust also reads its complete workspace and the shared CI tooling.
 * A path may belong to both. An empty list names an excluded input, while
 * `null` makes an unclassified tracked file visible to the completeness check.
 *
 * @module
 *
 * @import { Rung } from '../types.ts'
 */

const workspace = /** @type {const} */ ([
    'nanvm/lib/',
    'nanvm/harness/',
    'nanvm/effects-node/',
    'nanvm/demos/',
])

// These files control checkout or the shell that executes every check.
/** @type {readonly string[]} */
const sharedFiles = [
    '.gitattributes', '.gitignore', '.node-version', 'dev.sh', 'dev.ps1', 'dev.bashrc',
    'mise.toml', 'mise.lock', 'mise.spidermonkey.toml', 'mise.spidermonkey.lock',
]

// These paths describe tooling or site assets that the cached checks do not
// read. Documents outside spec/ and the Rust workspace are excluded below.
/** @type {readonly string[]} */
const excludedFiles = [
    '.assetsignore', '.github/FUNDING.yml', '.github/dependabot.yml',
    'LICENSE', 'favicon.ico', 'funding.json', 'wrangler.jsonc',
    'fjs/website/favicon.svg',
]

/** Environment manifests and npm sidecars affect every tool-backed check. */
const shared = (/** @type {string} */ path) => sharedFiles.includes(path) || path.startsWith('.mise/locks/')

/** The JavaScript rung a path contributes to, independently of Rust. */
const javascript = (/** @type {string} */ path) => {
    if (shared(path) || path === 'package.json' || path === 'deno.json'
        || path === 'fjs/module.mjs' || path === 'fjs/spidermonkey.mjs'
        || path === 'fjs/types/result/module.mjs'
        || path.split('/').some(p => p.startsWith('gen.'))
        || path.endsWith('.f.mjs') || path.endsWith('.f.js') || path.endsWith('.data.js')) { return 'fjs' }
    if (path.endsWith('.mjs') || path.endsWith('.js') || path.endsWith('.cjs')) {
        return path.startsWith('fjs/effects/') || path.startsWith('fjs/emergent_testing/') ? 'fjs' : 'js'
    }
    if (path.startsWith('spec/') || path === 'package-lock.json' || path === 'deno.lock' || path === 'bun.lock') { return 'js' }
    return path.endsWith('.ts') || path === 'tsconfig.json' ? 'ts' : null
}

/**
 * Rungs that consume a repository-relative tracked file. Rust files may also
 * be JavaScript inputs: its committed generated outputs and JS fixtures are
 * read by both sets of checks. New file kinds must be classified explicitly.
 *
 * @type {(path: string) => readonly Rung[] | null}
 */
export const select = path => {
    const ci = path.startsWith('fjs/ci/') || path.startsWith('.github/workflows/')
    // CI documents are not build inputs, even under a generated directory.
    if (ci && (path.endsWith('.md') || path.split('/').includes('todo'))) { return [] }
    const js = javascript(path)
    const rust = path === 'Cargo.toml' || path === 'Cargo.lock' || path.startsWith('.cargo/')
        || workspace.some(p => path.startsWith(p)) || shared(path)
        || ci
    if (js !== null) { return rust ? [js, 'rust'] : [js] }
    if (rust) { return ['rust'] }
    const excluded = path.endsWith('.md') || path.split('/').includes('todo')
        || path.startsWith('changelog/') || path.startsWith('doc/')
        || path.startsWith('.claude/') || path.startsWith('.devcontainer/')
        || excludedFiles.includes(path)
    return excluded ? [] : null
}
