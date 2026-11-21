/**
 * Proofs for source regeneration,
 * run against the virtual filesystem with the subprocess slice answered
 * as each proof says.
 *
 * @import { Child, ExitStatus, NodeOp, NodeProgram } from '../../effects/node/types.ts'
 * @import { IoResult } from '../../effects/types.ts'
 * @import { Dir, State } from '../../effects/node/virtual/types.ts'
 * @import { PartialMemOperationMap, RunInstance } from '../../effects/mock/types.ts'
 * @import { Unknown } from '../../media/datajs/types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.js'
import { ioError } from '../../effects/module.f.js'
import { partialRun } from '../../effects/mock/module.f.js'
import { errorExit, exitCode, exitStep, log, nodeCommands } from '../../effects/node/module.f.js'
import { defaultNodeProgramOptions, emptyState, virtual, virtualOperationMap } from '../../effects/node/virtual/module.f.js'
import { main as clean } from '../clean/module.f.js'
import { main as ci } from '../../ci/self/module.f.js'
import { main as rustTests } from '../../nanvm/update/module.f.js'
import { corpus, main as matrix, modules as corpusModules } from '../../media/datajs/vectors/matrix/module.f.js'
import { main as fixtures, modulesPath } from '../../nanvm/harness/module.f.js'
import { main as demos, samples } from '../../nanvm/demos/module.f.js'
import { main as fjsrs, output as fjsrsOutput } from '../../nanvm/fjsrs/build/module.f.js'
import { main as cloudflare } from '../../website/cloudflare/module.f.js'
import { tryStringify } from '../../media/datajs/serializer/module.f.js'
import { utf8 } from '../../text/module.f.js'
import { asNominal } from '../../types/nominal/module.f.js'
import { error, ok, unwrap } from '../../types/result/module.f.js'
import { generators, main, sequence } from './module.f.js'
import { hasEntry } from '../../types/object/entry/module.f.js'
import { entry } from '../../types/object/entry/module.f.js'

/** A child as `spawn` would brand one; nothing here looks inside it. @type {Child} */
const child = asNominal('child')

/**
 * The virtual runner with the subprocess slice answered as given, since the
 * virtual runner itself has no child to run: `spawn` checks it was asked for
 * the subprocess on the terminal and answers `started`, and `childWait`
 * answers `ended`. No regeneration proved here may start a subprocess, and
 * none needs a count to say so: the command `spawn` checks for is one no
 * caller sends, so a start fails the proof at the start itself.
 *
 * @type {(started: IoResult<Child>, ended: IoResult<ExitStatus>) => RunInstance<NodeOp, State>}
 */
const withSubprocess = (started, ended) => {
    /** @type {PartialMemOperationMap<NodeOp, State>} */
    const operations = {
        ...virtualOperationMap,
        spawn: (command, args, options) => state => {
            assertEq(command, 'unexpected subprocess')
            assertEq(args.length, 0)
            assertEq(options.stdio, 'inherit')
            return [state, started]
        },
        childWait: () => state => [state, ended],
    }
    return partialRun(nodeCommands)(operations)
}

/**
 * A stand-in `sample.f.js` for every spec page's demo sample, nested by its
 * directory under `spec/`, so the samples generator finds each one it lists.
 *
 * @type {Dir}
 */
const specSamples = samples
    .filter(({ directory }) => directory.startsWith('spec/'))
    .reduce((/** @type {Dir} */ tree, { directory }) => {
        /** @type {(dir: Dir, path: readonly string[]) => Dir} */
        const put = (dir, [head, ...rest]) => ({
            ...dir,
            [head]: rest.length === 0
                ? { .../** @type {Dir} */ (entry(dir, head) ?? {}), 'sample.f.js': [utf8('export default () => 4;')] }
                : put(/** @type {Dir} */ (entry(dir, head) ?? {}), rest),
        })
        return put(tree, directory.split('/').slice(1))
    }, {})

/**
 * The corpus sources as the matrix generator reads them, written as its own
 * writer spells them, so that generator succeeds in memory — the matrix proof
 * does the same — an empty fixture directory for the harness generator, and
 * a stand-in for `fjs/js/runtime` at its path, which the Rust writer
 * compiles and the harness loads.
 *
 * @type {Dir}
 */
const root = {
    'spec': {
        ...specSamples,
        'datajs': {
            'vectors': Object.fromEntries(corpusModules(corpus).map(([name, imported]) =>
                [name, { 'data.f.js': [utf8(unwrap(tryStringify(/** @type {Unknown} */ (imported))))] }])),
        },
    },
    'nanvm': { 'harness': { 'fixtures': {} } },
    'fjs': {
        'js': { 'runtime': { 'module.f.js': [utf8('export const statics = {}; export const runtime = {};')] } },
        'nanvm': {
            'demos': {
                'hello': { 'sample.f.js': [utf8('export default () => 1;')] },
                'sort': { 'sample.f.js': [utf8('export default () => 2;')] },
                'collatz': { 'sample.f.js': [utf8('export default () => 3;')] },
            },
            'fjsrs': { 'module.f.js': [utf8('export const main = () => 0;')] },
        },
    },
}

/** A program that logs `s` and exits `0`. @type {(s: string) => NodeProgram} */
const says = s => () => exitStep(log(s))

export const proof = {
    // Source regeneration has a stable order; dependency updates are separate.
    generators: () => {
        assertEq(generators.length, 8)
        assert(generators[0] === clean)
        assert(generators[1] === ci)
        assert(generators[2] === rustTests)
        assert(generators[3] === matrix)
        assert(generators[4] === fixtures)
        assert(generators[5] === demos)
        assert(generators[6] === fjsrs)
        assert(generators[7] === cloudflare)
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
    main: {
        // Every source generator runs, outputs are written, and dependency
        // locking starts no subprocess during CI regeneration.
        regenerates: () => {
            const run = withSubprocess(ok(child), ok(['exited', 0]))
            const [state, code] = run({ ...emptyState, root })(main(defaultNodeProgramOptions))
            assertEq(exitCode(code), 0, state.stderr)
            const github = state.root['.github']
            assert(typeof github === 'object' && !(github instanceof Array))
            assert(hasEntry(github, 'workflows'))
            const nanvm = state.root['nanvm']
            assert(typeof nanvm === 'object' && !(nanvm instanceof Array))
            const harness = nanvm['harness']
            assert(typeof harness === 'object' && !(harness instanceof Array))
            assert(hasEntry(harness, 'gen.fixtures'), modulesPath)
            const executable = nanvm['fjsrs']
            assert(typeof executable === 'object' && !(executable instanceof Array))
            const source = executable['src']
            assert(typeof source === 'object' && !(source instanceof Array))
            assert(hasEntry(source, 'gen.program.rs'), fjsrsOutput)
        },
        // A generator that fails stops the regeneration there: the Rust
        // writer cannot compile the runtime from an empty filesystem, and
        // the subprocess is never started.
        stopsAtAFailedGenerator: () => {
            const run = withSubprocess(ok(child), ok(['exited', 0]))
            const [state, code] = run(emptyState)(main(defaultNodeProgramOptions))
            assertEq(exitCode(code), 1)
            assert(state.stderr.includes('fjs/js/runtime/module.f.js'), state.stderr)
        },
    },
}
