/**
 * @import { Dir, State } from '../../../effects/node/virtual/types.ts'
 * @import { Vec } from '../../../types/bit_vec/types.ts'
 */

import { assert, assertEq, assertNotNullish, assertOk } from '../../../asserts/module.f.js'
import { vecToCBase32 } from '../../../basen/cbase32/module.f.mjs'
import { dispatch } from '../../../cli/module.f.mjs'
import { computeSync, sha256 } from '../../../crypto/sha2/module.f.mjs'
import { exitCode } from '../../../effects/node/module.f.mjs'
import { nodeProgramOptions, virtual, virtualAt } from '../../../effects/node/virtual/module.f.mjs'
import { hexText } from '../../../git/oid/module.f.mjs'
import { tryResolve } from '../../../git/refstore/module.f.mjs'
import { initConfig, latin1 } from '../../../git/testlib.f.mjs'
import { u8ListToVecMsb } from '../../../types/bit_vec/module.f.mjs'
import { commands as casCommands } from '../../cli/module.f.mjs'
import { branchRef } from '../module.f.mjs'

const main = dispatch(casCommands)

/** @type {(s: string) => readonly Vec[]} */
const text = s => [u8ListToVecMsb(latin1(s))]

/** The branch every case names, in the repository of the current directory. */
const branch = { dir: './.git', branch: 'build-cache' }

/** A worktree, as the current directory: a repository whose `config` names an author, and a file to add. */
const root = {
    '.git': { config: text(`${initConfig}\n[user]\n\tname = Cas Writer\n\temail = cas@example.com\n`), objects: { pack: {} } },
    'file.txt': text('alpha\n'),
}

const alphaKey = vecToCBase32(computeSync(sha256)([u8ListToVecMsb(latin1('alpha\n'))]))

/**
 * Runs `fjs cas <args>` over `root`: the state it left, its exit code, and
 * what it printed.
 *
 * @type {(root: Dir, args: readonly string[]) => { readonly state: State, readonly code: number, readonly stdout: string, readonly stderr: string }}
 */
const ran = (root, args) => {
    const [state, r] = virtualAt(root)(main(nodeProgramOptions(args)))
    return { state, code: exitCode(r), stdout: state.stdout, stderr: state.stderr }
}

/** The id the branch holds over `state`, as hex, or `null`. @type {(state: State, dir?: string) => string | null} */
const headAt = (state, dir = branch.dir) => {
    const id = assertOk(virtual(state)(tryResolve({ gitdir: dir, common: dir }, 20)(latin1(branchRef(branch))))[1])
    return id === null ? null : hexText(id)
}

export const proof = {
    // The nested table has help at its level, listing the subcommands.
    help: () => {
        const { code, stdout } = ran(root, ['git', 'help'])
        assertEq(code, 0)
        for (const name of ['add', 'get', 'list']) {
            assert(stdout.includes(name), [name, stdout])
        }
    },
    // The whole round: a branch that is not there lists nothing and holds no
    // key; add prints the key and creates the branch; list and get read it;
    // adding the same content again prints the key and changes nothing.
    round: () => {
        const empty = ran(root, ['git', 'list', 'build-cache'])
        assertEq(empty.code, 0, empty.stderr)
        assertEq(empty.stdout, '')
        const missing = ran(root, ['git', 'get', 'build-cache', alphaKey, 'out'])
        assertEq(missing.code, 1)
        assertEq(missing.stderr, `${alphaKey} is not in the snapshot\n`)
        const added = ran(root, ['git', 'add', 'build-cache', 'file.txt'])
        assertEq(added.code, 0, added.stderr)
        assertEq(added.stdout, `${alphaKey}\n`)
        assertNotNullish(headAt(added.state))
        const listed = ran(added.state.root, ['git', 'list', 'build-cache'])
        assertEq(listed.code, 0, listed.stderr)
        assertEq(listed.stdout, `${alphaKey}\n`)
        const got = ran(added.state.root, ['git', 'get', 'build-cache', alphaKey, 'out'])
        assertEq(got.code, 0, got.stderr)
        const out = got.state.root.out
        assert(out instanceof Array && out.length === 1 && out[0] === u8ListToVecMsb(latin1('alpha\n')), 'restored other bytes')
        const again = ran(added.state.root, ['git', 'add', 'build-cache', 'file.txt'])
        assertEq(again.code, 0, again.stderr)
        assertEq(again.stdout, `${alphaKey}\n`)
        assertEq(headAt(again.state), headAt(added.state))
    },
    // The author comes from the repository's `config`, or from `~/.gitconfig`
    // where the repository names none; with neither, add is refused and says
    // what to set, and a name an ident cannot hold is refused naming the
    // setting. Neither writes anything.
    author: () => {
        const bare = { '.git': { config: text(initConfig), objects: { pack: {} } }, 'file.txt': text('alpha\n') }
        const refused = ran(bare, ['git', 'add', 'build-cache', 'file.txt'])
        assertEq(refused.code, 1)
        assertEq(refused.stderr, 'set user.name and user.email in ./.git/config or ./.gitconfig\n')
        assertEq(headAt(refused.state), null)
        const global = { ...bare, '.gitconfig': text('[user]\n\tname = Global\n\temail = g@example.com\n') }
        const added = ran(global, ['git', 'add', 'build-cache', 'file.txt'])
        assertEq(added.code, 0, added.stderr)
        assertEq(added.stdout, `${alphaKey}\n`)
        const bracketed = { ...bare, '.git': { ...bare['.git'], config: text(`${initConfig}\n[user]\n\tname = A <B>\n\temail = cas@example.com\n`) } }
        const refusedName = ran(bracketed, ['git', 'add', 'build-cache', 'file.txt'])
        assertEq(refusedName.code, 1)
        assertEq(refusedName.stderr, 'user.name is empty or holds "<", ">", a line break or a NUL; set it in ./.git/config or ./.gitconfig\n')
        assertEq(headAt(refusedName.state), null)
    },
    // A current directory that is neither a worktree nor a repository — no
    // `.git`, or a `.git` file that is no gitfile — in words a user can act
    // on; and a `.git` directory with no `config` in it, which names a
    // repository Git then fails to open, in the host's own words.
    notARepository: () => {
        for (const root of [{ 'file.txt': text('alpha\n') }, { '.git': text('junk\n') }]) {
            const r = ran(root, ['git', 'list', 'build-cache'])
            assertEq(r.code, 1)
            assertEq(r.stderr, 'the current directory is neither a Git worktree nor a repository directory\n')
        }
        const empty = ran({ '.git': {} }, ['git', 'list', 'build-cache'])
        assertEq(empty.code, 1)
        assert(empty.stderr !== '' && !empty.stderr.includes('neither a Git worktree'), empty.stderr)
    },
    // The current directory may be the repository directory itself — a bare
    // repository: add into it, and list through it, both run.
    repositoryDirectory: () => {
        const bare = {
            config: text(`${initConfig}\n[user]\n\tname = B\n\temail = b@example.com\n`),
            objects: { pack: {} },
            'file.txt': text('alpha\n'),
        }
        const added = ran(bare, ['git', 'add', 'build-cache', 'file.txt'])
        assertEq(added.code, 0, added.stderr)
        assertEq(added.stdout, `${alphaKey}\n`)
        assertNotNullish(headAt(added.state, '.'))
        const listed = ran(added.state.root, ['git', 'list', 'build-cache'])
        assertEq(listed.stdout, `${alphaKey}\n`)
    },
    // The argument counts, each in `exactArgs`' words.
    arguments: () => {
        assertEq(ran(root, ['git', 'add', 'a']).stderr, "'cas git add' expects two parameters\n")
        assertEq(ran(root, ['git', 'get', 'a', 'b']).stderr, "'cas git get' expects three parameters\n")
        assertEq(ran(root, ['git', 'list']).stderr, "'cas git list' expects one parameter\n")
    },
    // A key that is no cBase32 is refused before anything is read.
    badKey: () => {
        const got = ran(root, ['git', 'get', 'build-cache', 'not-a-key', 'out'])
        assertEq(got.code, 1)
        assertEq(got.stderr, 'invalid key format: not-a-key\n')
    },
}
