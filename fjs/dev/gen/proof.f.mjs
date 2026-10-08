/**
 * Proofs for the regeneration program: its order, its stopping, and its lock
 * step, run against the virtual filesystem with the subprocess slice answered
 * as each proof says.
 *
 * @import { Child, ExitStatus, NodeOp, NodeProgram } from '../../effects/node/types.ts'
 * @import { IoResult } from '../../effects/types.ts'
 * @import { Dir, State } from '../../effects/node/virtual/types.ts'
 * @import { PartialMemOperationMap, RunInstance } from '../../effects/mock/types.ts'
 * @import { Unknown } from '../../media/datajs/types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import { ioError } from '../../effects/module.f.mjs'
import { partialRun } from '../../effects/mock/module.f.mjs'
import { errorExit, exitCode, exitStep, log, nodeCommands } from '../../effects/node/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, virtual, virtualOperationMap } from '../../effects/node/virtual/module.f.mjs'
import { lockUpdatePath } from '../../ci/nix/module.f.mjs'
import { main as clean } from '../clean/module.f.mjs'
import { main as ci } from '../../ci/self/module.f.mjs'
import { main as rustTests } from '../../nanvm/update/module.f.mjs'
import { corpus, main as matrix, modules as corpusModules } from '../../media/datajs/vectors/matrix/module.f.mjs'
import { main as fixtures, modulesPath } from '../../nanvm/harness/module.f.mjs'
import { tryStringify } from '../../media/datajs/serializer/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { asNominal } from '../../types/nominal/module.f.mjs'
import { error, ok, unwrap } from '../../types/result/module.f.mjs'
import { generators, lock, lockEnded, main, sequence } from './module.f.mjs'

/** A child as `spawn` would brand one; nothing here looks inside it. @type {Child} */
const child = asNominal('child')

/**
 * The virtual runner with the subprocess slice answered as given, since the
 * virtual runner itself has no child to run: `spawn` checks it was asked for
 * the lock script on the terminal and answers `started`, `childWait` answers
 * `ended`, and `spawned` counts the starts so a proof can tell whether the
 * lock step was reached at all.
 *
 * @type {(started: IoResult<Child>, ended: IoResult<ExitStatus>) => { readonly run: RunInstance<NodeOp, State>, readonly spawned: () => number }}
 */
const withSubprocess = (started, ended) => {
    let count = 0
    /** @type {PartialMemOperationMap<NodeOp, State>} */
    const operations = {
        ...virtualOperationMap,
        spawn: (command, args, options) => state => {
            count += 1
            assertEq(command, 'sh')
            assertEq(args.join(','), lockUpdatePath)
            assertEq(options.stdio, 'inherit')
            return [state, started]
        },
        childWait: () => state => [state, ended],
    }
    return { run: partialRun(nodeCommands)(operations), spawned: () => count }
}

/**
 * The corpus sources as the matrix generator reads them, written as its own
 * writer spells them, so that generator succeeds in memory — the matrix proof
 * does the same — and an empty fixture directory for the harness generator.
 *
 * @type {Dir}
 */
const root = {
    'spec': {
        'datajs': {
            'vectors': Object.fromEntries(corpusModules(corpus).map(([name, imported]) =>
                [name, { 'data.f.js': [utf8(unwrap(tryStringify(/** @type {Unknown} */ (imported))))] }])),
        },
    },
    'nanvm-harness': { 'fixtures': {} },
}

/** A program that logs `s` and exits `0`. @type {(s: string) => NodeProgram} */
const says = s => () => exitStep(log(s))

export const proof = {
    // The order is the design's: cleanup, then the generators, the one that
    // writes the flakes before the lock step that reads them.
    generators: () => {
        assertEq(generators.length, 5)
        assert(generators[0] === clean)
        assert(generators[1] === ci)
        assert(generators[2] === rustTests)
        assert(generators[3] === matrix)
        assert(generators[4] === fixtures)
    },
    sequence: {
        allSucceed: () => {
            const [state, code] = virtual(emptyState)(sequence([says('one'), says('two')])(defaultNodeProgramOptions))
            assertEq(exitCode(code), 0)
            assertEq(state.stdout, 'one\ntwo\n')
        },
        // The first failure stops the sequence: the third program never runs,
        // and its exit code is the sequence's.
        stopsAtTheFirstFailure: () => {
            const failing = sequence([says('one'), () => errorExit('two'), says('three')])
            const [state, code] = virtual(emptyState)(failing(defaultNodeProgramOptions))
            assertEq(exitCode(code), 1)
            assertEq(state.stdout, 'one\n')
            assertEq(state.stderr, 'two\n')
        },
        empty: () => {
            const [, code] = virtual(emptyState)(sequence([])(defaultNodeProgramOptions))
            assertEq(exitCode(code), 0)
        },
    },
    lockEnded: {
        exitedZero: () => {
            const [state, code] = virtual(emptyState)(lockEnded(['exited', 0]))
            assertEq(exitCode(code), 0)
            assertEq(state.stderr, '')
        },
        exitedNonzero: () => {
            const [state, code] = virtual(emptyState)(lockEnded(['exited', 2]))
            assertEq(exitCode(code), 1)
            assertEq(state.stderr, `${lockUpdatePath}: exit code 2\n`)
        },
        signaled: () => {
            const [state, code] = virtual(emptyState)(lockEnded(['signaled', 'SIGTERM']))
            assertEq(exitCode(code), 1)
            assertEq(state.stderr, `${lockUpdatePath}: killed by SIGTERM\n`)
        },
    },
    lock: {
        // The script on the terminal, waited for, ended well.
        ok: () => {
            const { run, spawned } = withSubprocess(ok(child), ok(['exited', 0]))
            const [state, code] = run(emptyState)(lock)
            assertEq(exitCode(code), 0)
            assertEq(spawned(), 1)
            assertEq(state.stderr, '')
        },
        // A script that could not start is the host's failure, reported in the
        // host's words.
        cannotStart: () => {
            const { run } = withSubprocess(error(ioError({ code: 'ENOENT', message: 'no sh' })), ok(['exited', 0]))
            const [state, code] = run(emptyState)(lock)
            assertEq(exitCode(code), 1)
            assertEq(state.stderr, 'no sh\n')
        },
        failed: () => {
            const { run } = withSubprocess(ok(child), ok(['exited', 1]))
            const [state, code] = run(emptyState)(lock)
            assertEq(exitCode(code), 1)
            assertEq(state.stderr, `${lockUpdatePath}: exit code 1\n`)
        },
    },
    main: {
        // Every generator against a filesystem holding what it reads, then
        // the lock step: exit `0`, the outputs written, the script started
        // exactly once and last — the flakes it locks are there by then.
        regenerates: () => {
            const { run, spawned } = withSubprocess(ok(child), ok(['exited', 0]))
            const [state, code] = run({ ...emptyState, root })(main(defaultNodeProgramOptions))
            assertEq(exitCode(code), 0, state.stderr)
            assertEq(spawned(), 1)
            const github = state.root['.github']
            assert(typeof github === 'object' && !(github instanceof Array))
            assert('workflows' in github)
            const harness = state.root['nanvm-harness']
            assert(typeof harness === 'object' && !(harness instanceof Array))
            assert('gen.fixtures' in harness, modulesPath)
        },
        // A generator that fails stops the regeneration there: the matrix
        // generator cannot read its corpus from an empty filesystem, and the
        // lock script is never started.
        stopsAtAFailedGenerator: () => {
            const { run, spawned } = withSubprocess(ok(child), ok(['exited', 0]))
            const [state, code] = run(emptyState)(main(defaultNodeProgramOptions))
            assertEq(exitCode(code), 1)
            assertEq(spawned(), 0)
            assert(state.stderr.includes('cannot be read'), state.stderr)
        },
    },
}
