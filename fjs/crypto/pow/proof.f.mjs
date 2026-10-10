/** @import { DemoEvent } from '../../website/demo/types.ts' */

import { utf8 } from '../../text/module.f.mjs'
import { empty, uint } from '../../types/bit_vec/module.f.mjs'
import { computeSync, sha224, sha256 } from '../sha2/module.f.mjs'
import { bitcoinPow, genesisNBits, genesisTarget, pow, sha256Pow, targetFromNBits } from './module.f.mjs'
import { assert, assertEq, assertNotNullish } from '../../asserts/module.f.mjs'
import { demo, parseNBits, parseNonce } from './demo.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'
import { runPure } from '../../effects/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'

const p256 = sha256Pow
const p224 = pow(sha224)
const sample = utf8('functionalscript pow proof')
const emptyData = empty

/** Target large enough for {@link sample} under SHA-256 (`0x207fffff`). */
const easyNBits = 0x207f_ffffn

/** Compact encoding for target `1` (`0x03000001`). */
const hardNBits = 0x0300_0001n

/** SHA-256 of the empty message (NIST / Bitcoin block merkle uses this primitive). */
const sha256EmptyHash =
    0xe3b0_c442_98fc_1c14_9afb_f4c8_996f_b924_27ae_41e4_649b_934c_a495_991b_7852_b855n

/** Bitcoin block #0 header hash as big-endian uint256. */
const block0Hash =
    0x0000_0000_0019_d668_9c08_5ae1_6583_1e93_4ff7_63ae_46a2_a6cf_fb38_8491_c27d_c990n

/** @type {(nBits: bigint) => void} */
const expectNull = nBits => {
    assertEq(targetFromNBits(nBits), null, nBits)
}

export const proof = {
    demo: {
        parseNonce: () => {
            assertEq(parseNonce('0'), 0n)
            assertEq(parseNonce('00042'), 42n)
            assertEq(parseNonce('9007199254740993'), 9_007_199_254_740_993n)
            return ['', '-1', '+1', '1.5', '1e3', '0x10', ' 42', '42 ', '٤٢', '🔑'].map(text => assertEq(parseNonce(text), null))
        },
        parseNBits: () => {
            assertEq(parseNBits('0x1d00ffff'), genesisNBits)
            assertEq(parseNBits('0X1D00FFFF'), genesisNBits)
            assertEq(parseNBits('0x01d00ffff'), genesisNBits)
            assertEq(parseNBits('0x00000000ffffffff'), 0xffff_ffffn)
            assertEq(parseNBits('0x000000000'), 0n)
            assertEq(parseNBits('0x0'), 0n)
            assertEq(parseNBits('0xffffffff'), 0xffff_ffffn)
            return ['', '1d00ffff', '0x', '0x100000000', '0xgg', '0x-1', ' 0x1', '0x1 ', '0x🔑'].map(text => assertEq(parseNBits(text), null))
        },
        update: () => {
            /** @type {(state: typeof demo.init, event: DemoEvent) => typeof demo.init} */
            const next = (state, event) => unwrap(assertNotNullish(runPure(demo.update(state)(event))[0]))
            assertEq(next(demo.init, { kind: 'input', name: 'text', value: '\nmessage\n' }).text, '\nmessage\n')
            assertEq(next(demo.init, { kind: 'input', name: 'nonce', value: '53' }).nonce, '53')
            assertEq(next(demo.init, { kind: 'input', name: 'nBits', value: '0x1d00ffff' }).nBits, '0x1d00ffff')
            assertEq(next(demo.init, { kind: 'input', name: 'other', value: 'ignored' }), demo.init)
            assertEq(next(demo.init, { kind: 'start' }), demo.init)
            assertEq(next(demo.init, { kind: 'click', name: 'other' }), demo.init)
            const stepped = next(demo.init, { kind: 'click', name: 'next-nonce' })
            assertEq(stepped.nonce, '43')
            assertEq(stepped.text, demo.init.text)
            assertEq(stepped.nBits, demo.init.nBits)
            const large = { ...demo.init, nonce: '9007199254740993' }
            assertEq(next(large, { kind: 'click', name: 'next-nonce' }).nonce, '9007199254740994')
            const invalid = { ...demo.init, nonce: '-' }
            assertEq(next(invalid, { kind: 'click', name: 'next-nonce' }), invalid)
        },
        view: () => {
            // Independent Node crypto.createHash vectors pin both failed and successful nonces.
            const failed = htmlToString(demo.view(demo.init))
            assert(failed.includes('<textarea id="text" name="text" rows="8">Hello, FunctionalScript!</textarea>'), failed)
            assert(failed.includes('name="next-nonce"'), failed)
            assert(failed.includes('Try next nonce'), failed)
            assert(failed.includes('<pre>Hello, FunctionalScript!42</pre>'), failed)
            assert(failed.includes('<pre>0fffff0000000000000000000000000000000000000000000000000000000000</pre>'), failed)
            assert(failed.includes('<pre>6b874641ffc6e42bbb63ca7350bda22218d53a2af93c4dd03361f624c160d691</pre>'), failed)
            assert(!failed.includes('Hash as integer'), failed)
            assert(!failed.includes('Copy hash integer'), failed)
            assert(failed.includes('Hash does not meet target'), failed)
            assert(failed.includes('data-result="error"'), failed)
            const passed = htmlToString(demo.view({ ...demo.init, nonce: '53' }))
            assert(passed.includes('<pre>0a3d56c9c89d4aad40f0f93a1d8b199714975201d74ff72e64ba0cc1f99fd07d</pre>'), passed)
            assert(passed.includes('Hash meets target'), passed)
            assert(passed.includes('data-result="ok"'), passed)
            assert(!passed.includes('OpenSSL'), passed)
            const genesis = htmlToString(demo.view({ ...demo.init, nBits: '0x1d00ffff' }))
            assert(genesis.includes(`<pre>${genesisTarget.toString(16).padStart(64, '0')}</pre>`), genesis)
            assert(genesis.includes('Hash does not meet target'), genesis)
            const multiline = htmlToString(demo.view({ ...demo.init, text: '\nПривіт 🌍\n' }))
            assert(multiline.includes('<pre>\nПривіт 🌍\n42</pre>'), multiline)
            assert(multiline.includes('<pre>0b3665913ccaef516f4927c42096a2919ea75d432ca747e3fda13377abd55277</pre>'), multiline)
            const zero = htmlToString(demo.view({ ...demo.init, text: '', nonce: '000' }))
            assert(zero.includes('<pre>0</pre>'), zero)
            assert(zero.includes('5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9'), zero)
            const quoted = htmlToString(demo.view({ ...demo.init, text: "m' $HOME `whoami`" }))
            assert(quoted.includes("<pre>m' $HOME `whoami`42</pre>"), quoted)
        },
        autoRun: () => {
            /** @type {(state: typeof demo.init, name: string) => typeof demo.init} */
            const click = (state, name) => unwrap(assertNotNullish(runPure(demo.update(state)({ kind: 'click', name }))[0]))
            const schedule = assertNotNullish(demo.nextEvent)
            assertEq(schedule(demo.init), null)
            let state = click(demo.init, 'auto-run')
            assertEq(state.search?.running, true)
            assertEq(state.search?.attempts, 1n)
            assertEq(state.search?.start, 42n)
            assertEq(state.search?.target, targetFromNBits(0x200f_ffffn))
            assertEq(state.search?.hash, 0x6b87_4641_ffc6_e42b_bb63_ca73_50bd_a222_18d5_3a2a_f93c_4dd0_3361_f624_c160_d691n)
            assertEq(assertNotNullish(schedule(state)).kind, 'click')
            const active = htmlToString(demo.view(state))
            assert(active.includes('>Stop</button>'), active)
            assert(active.includes('Searching after 1 attempt.<br>Failed nonce: 42.'), active)
            for (let nonce = 43n; nonce <= 53n; nonce += 1n) {
                const event = assertNotNullish(schedule(state))
                state = unwrap(assertNotNullish(runPure(demo.update(state)(event))[0]))
                assertEq(state.nonce, String(nonce))
            }
            assertEq(state.search?.running, false)
            assertEq(state.search?.attempts, 12n)
            assertEq(state.search?.hash, 0x0a3d_56c9_c89d_4aad_40f0_f93a_1d8b_1997_1497_5201_d74f_f72e_64ba_0cc1_f99f_d07dn)
            assertEq(schedule(state), null)
            const found = htmlToString(demo.view(state))
            assert(found.includes('Found nonce 53 after 12 attempts.<br>Failed nonces: 42–52.'), found)
            assert(found.includes('>Auto-run nonce</button>'), found)
            assertEq(click(state, 'auto-next'), state)
            // Independent SHA-256 checks find the next successes at 65 and 68.
            let next = click({ ...demo.init, nonce: '53' }, 'auto-run')
            assertEq(next.nonce, '54')
            assertEq(next.search?.start, 54n)
            assertEq(next.search?.attempts, 1n)
            assertEq(next.search?.running, true)
            for (let nonce = 55n; nonce <= 65n; nonce += 1n) {
                next = click(next, 'auto-next')
                assertEq(next.nonce, String(nonce))
            }
            assertEq(next.search?.running, false)
            assertEq(next.search?.attempts, 12n)
            const resumed = htmlToString(demo.view(next))
            assert(resumed.includes('Found nonce 65 after 12 attempts.<br>Failed nonces: 54–64.'), resumed)
            next = click(next, 'auto-run')
            assertEq(next.nonce, '66')
            next = click(click(next, 'auto-next'), 'auto-next')
            assertEq(next.nonce, '68')
            assertEq(next.search?.running, false)
            assertEq(next.search?.attempts, 3n)
            assertEq(next.search?.start, 66n)
            // Both 5 and 6 meet this easier target; skip 5 and count only 6.
            const immediate = click({ ...demo.init, nonce: '5', nBits: '0x207fffff' }, 'auto-run')
            assertEq(immediate.nonce, '6')
            assertEq(immediate.search?.running, false)
            assertEq(immediate.search?.attempts, 1n)
            assertEq(immediate.search?.start, 6n)
            assert(htmlToString(demo.view(immediate)).includes('No failed nonces.'))
            const stopped = click(click(demo.init, 'auto-run'), 'auto-run')
            assertEq(stopped.search?.running, false)
            const stoppedView = htmlToString(demo.view(stopped))
            assert(stoppedView.includes('Stopped after 1 attempt.'), stoppedView)
            const running = click(demo.init, 'auto-run')
            const edited = unwrap(assertNotNullish(runPure(demo.update(running)({ kind: 'input', name: 'text', value: 'new' }))[0]))
            assertEq(edited.search, null)
            assertEq(click(running, 'next-nonce').search, null)
            for (const invalid of [{ ...demo.init, nonce: '-' }, { ...demo.init, nBits: 'bad' }, { ...demo.init, nBits: '0x0' }]) {
                assertEq(click(invalid, 'auto-run'), invalid)
            }
            assertEq(click(demo.init, 'auto-next'), demo.init)
        },
        invalid: () => {
            const malformed = htmlToString(demo.view({ ...demo.init, nBits: 'bad' }))
            assert(malformed.includes('Enter nBits as a hexadecimal 32-bit value'), malformed)
            assert(!malformed.includes('Hash meets target'), malformed)
            for (const nBits of ['0x0', '0x01800001', '0x227fffff']) {
                const html = htmlToString(demo.view({ ...demo.init, nBits }))
                assert(html.includes('nBits must decode to a positive 256-bit target.'), html)
                assert(!html.includes('Copy target'), html)
            }
            const nonce = htmlToString(demo.view({ ...demo.init, nonce: '-' }))
            assert(nonce.includes('Enter a non-negative decimal nonce.'), nonce)
            assert(nonce.includes('name="next-nonce"'), nonce)
            assert(!nonce.includes('Copy hash"'), nonce)
        },
    },
    targetFromNBits: {
        genesis: () => {
            assertEq(targetFromNBits(genesisNBits), genesisTarget, 'genesis target')
        },
        block0HashWithinGenesisTarget: () => {
            assert(!(block0Hash > genesisTarget), 'block0 hash exceeds genesis target')
        },
        exponent3: () => {
            assertEq(targetFromNBits(0x0300_00ffn), 0xffn, 'exponent 3')
        },
        exponent2: () => {
            assertEq(targetFromNBits(0x0200_8000n), 0x80n, 'exponent 2')
        },
        hardTargetOne: () => {
            assertEq(targetFromNBits(hardNBits), 1n, 'hard target')
        },
        zero: () => {
            assertEq(targetFromNBits(0n), 0n, 'zero nBits')
        },
        negative: () => {
            expectNull(0x0180_0001n)
        },
        negativeHighMantissa: () => {
            expectNull(0x22ff_ffffn)
        },
        overflowExponent: () => {
            expectNull(0x2300_0001n)
        },
        exceeds256: () => {
            expectNull(0x227f_ffffn)
        },
    },
    meets: {
        easy: () => {
            assert(p256.meets(easyNBits)(sample), 'easy nBits should pass')
        },
        hard: () => {
            assert(!(p256.meets(hardNBits)(sample)), 'target 1 should fail')
        },
        genesisFailsSample: () => {
            assert(!(p256.meets(genesisNBits)(sample)), 'genesis target too hard for sample')
        },
        zeroTargetRejectsSample: () => {
            assert(!(p256.meets(0n)(sample)), 'non-zero hash vs zero target')
        },
        invalidNBits: () => {
            assert(!(p256.meets(0x0180_0001n)(sample)), 'invalid nBits should not pass')
        },
        hashLeqTarget: () => {
            const h = p256.hashInt(sample)
            const target = assertNotNullish(targetFromNBits(easyNBits), 'easy nBits decode')
            assert(!(h > target), 'hash above easy target')
            assert(h <= target, 'hash <= target')
        },
    },
    hashInt: {
        sha256Sample: () => {
            const digest = computeSync(sha256)([sample])
            assertEq(p256.hashInt(sample), uint(digest), 'sha256 sample')
        },
        sha256Empty: () => {
            assertEq(p256.hashInt(emptyData), sha256EmptyHash, 'sha256 empty constant')
            const digest = computeSync(sha256)([emptyData])
            assertEq(p256.hashInt(emptyData), uint(digest), 'sha256 empty')
        },
        sha224: () => {
            const digest = computeSync(sha224)([sample])
            assertEq(p224.hashInt(sample), uint(digest), 'sha224')
        },
        stable: () => {
            assertEq(p256.hashInt(sample), p256.hashInt(sample), 'stable')
        },
    },
    pow: {
        sha256Pow: () => {
            const built = pow(sha256)
            assertEq(sha256Pow.hashInt(sample), built.hashInt(sample), 'hashInt')
            assertEq(sha256Pow.meets(easyNBits)(sample), built.meets(easyNBits)(sample), 'meets')
        },
        bitcoinPow: () => {
            assertEq(bitcoinPow.hashInt(sample), sha256Pow.hashInt(sample), 'bitcoinPow')
        },
        independentInstances: () => {
            const a = pow(sha256)
            const b = pow(sha256)
            assertEq(a.hashInt(sample), b.hashInt(sample), 'hashInt')
            assertEq(a.meets(easyNBits)(sample), b.meets(easyNBits)(sample), 'meets')
        },
    },
}
