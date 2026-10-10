/** @import { DemoEvent } from '../../website/demo/types.ts' */

import { sloth, p } from './module.f.mjs'
import { assert, assertEq, assertNotNullish } from '../../asserts/module.f.mjs'
import { demo, hexOfY, parseHex, parseSteps, xOf } from './demo.f.mjs'
import { refusal } from '../../website/demo/module.f.mjs'
import { concat as stringConcat } from '../../types/string/module.f.mjs'
import { element, htmlToString } from '../../media/html/module.f.mjs'
import { maxLengthBytes } from '../../types/bit_vec/module.f.mjs'
import { runPure } from '../../effects/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'

const { eval: evalVdf, verify, modSqrt, quadRes } = sloth

// `eval(steps)(x)` expected values for {@link p}; same Sloth algorithm as
// https://github.com/hyperhyperspace/pulsar/blob/main/src/model/SlothVDF.ts and
// https://github.com/jose-compu/dignity.js/blob/main/src/security/sloth-vdf.js

const sampleX = 123_456_789n
const largeX = 12_345_678_901_234_567_890n
const smallX = 42n
const nonResidue = 2n

const sampleY =
    72_412_151_236_937_799_598_582_816_305_571_618_206_681_207_952_550_127_764_586_725_290_711_141_789_888_684_237_028_784_568_532_880_529_360_450_375_677_852_568_362_636_821_341_317_217_048_062_977_639_333_459_511_661_887_862_128_325_859_969_604_061_461_913_896_412_260_750_881_385_045_152_117_694_320_409_864_730_924_775_539_555_636_460_819_549_547_999_218_170_813_228_857_928_921_642_957_426_089_461_925_313_163n

const smallY =
    145_151_597_037_272_685_697_451_525_487_035_431_973_338_817_762_329_243_361_437_778_785_747_534_269_376_083_577_375_382_484_815_474_368_317_818_719_265_551_745_910_148_543_423_765_263_685_177_263_740_373_969_289_084_400_977_118_144_482_329_577_335_929_842_301_331_443_392_042_760_708_529_572_252_015_473_334_998_752_211_959_790_788_326_970_269_713_683_808_382_892_472_572_910_797_612_141_527_200_051_803_670_965n

const y6 =
    116_287_514_643_100_261_336_025_249_676_072_556_421_566_393_377_742_705_567_032_370_320_583_145_555_855_278_910_304_225_489_766_306_768_040_386_612_082_033_279_417_845_047_304_479_679_877_515_174_322_332_386_599_890_348_932_893_235_091_525_789_175_564_701_751_964_775_040_887_336_849_457_197_662_999_383_850_490_808_701_700_264_064_812_615_988_837_073_981_567_599_117_932_005_435_532_913_423_970_502_774_287_312n

const y4 =
    64_401_150_265_223_443_694_244_964_595_084_197_237_814_157_534_040_219_819_342_647_664_782_563_317_539_559_768_554_855_806_938_965_782_018_778_040_933_157_632_467_146_168_153_951_260_465_261_118_025_222_264_314_070_274_636_967_492_909_984_790_708_532_033_331_622_332_323_767_105_919_809_000_393_624_013_423_095_812_833_452_440_384_602_112_677_364_631_962_445_309_757_177_309_466_319_657_219_548_312_354_433_189n

/** @type {(state: typeof demo.init, event: DemoEvent) => typeof demo.init} */
const next = (state, event) => unwrap(assertNotNullish(runPure(demo.update(state)(event))[0]))

/** @type {(state: typeof demo.init, name: string) => typeof demo.init} */
const click = (state, name) => next(state, { kind: 'click', name })

/** Run scheduled turns until the demo stops asking for one.
 * @type {(state: typeof demo.init) => typeof demo.init}
 */
const settle = state => {
    const event = assertNotNullish(demo.nextEvent)(state)
    return event === null ? state : settle(next(state, event))
}

// `printf '%s' 'Hello, FunctionalScript!' | sha256sum`
const helloX = 0xa22d_1ef8_834e_3024_bb56_53a1_dbeb_3830_5bef_6d1c_ef48_6e45_0e0d_fab7_18b4_7afdn

export const proof = {
    demo: {
        xOf: () => {
            assertEq(xOf(demo.init.text), helloX)
        },
        parseSteps: () => {
            assertEq(parseSteps('0'), 0n)
            assertEq(parseSteps('01000'), 1_000n)
            return ['', '-1', '1.5', ' 1', '0x10'].map(text => assertEq(parseSteps(text), null))
        },
        parseHex: () => {
            assertEq(parseHex('0'), 0n)
            assertEq(parseHex('aF09'), 0xaf09n)
            return ['', '0x1', 'g', ' 1', '1 '].map(text => assertEq(parseHex(text), null))
        },
        hexOfY: () => {
            assertEq(hexOfY(p - 1n), (p - 1n).toString(16))
            assertEq(hexOfY(1n), '1'.padStart(p.toString(16).length, '0'))
        },
        input: () => {
            const evaluated = { ...settle(click({ ...demo.init, steps: '4' }, 'evaluate')), claimed: '1', verdict: /** @type {const} */ ('rejected') }
            const text = next(evaluated, { kind: 'input', name: 'text', value: 'a' })
            assertEq([text.text, text.steps, text.claimed, text.run, text.verdict].join(), 'a,4,1,,')
            const steps = next(evaluated, { kind: 'input', name: 'steps', value: '5' })
            assertEq([steps.text, steps.steps, steps.claimed, steps.run, steps.verdict].join(), `${demo.init.text},5,1,,`)
            const claimed = next(evaluated, { kind: 'input', name: 'claimed', value: '2' })
            assertEq(claimed.claimed, '2')
            assertEq(claimed.verdict, null)
            assertEq(claimed.run, evaluated.run)
            assertEq(next(evaluated, { kind: 'input', name: 'other', value: '1' }), evaluated)
            assertEq(next(evaluated, { kind: 'start' }), evaluated)
            assertEq(click(evaluated, 'other'), evaluated)
            assertEq(click(evaluated, 'evaluate-next'), evaluated)
            assertEq(click(demo.init, 'evaluate-next'), demo.init)
            const invalid = { ...demo.init, steps: 'x' }
            assertEq(click(invalid, 'evaluate'), invalid)
            assertEq(click({ ...invalid, claimed: '1' }, 'verify').verdict, null)
            assert(htmlToString(demo.view(invalid)).includes(stringConcat(element(refusal('Enter a non-negative decimal number of steps.')))), invalid)
        },
        evaluate: () => {
            const schedule = assertNotNullish(demo.nextEvent)
            assertEq(schedule(demo.init), null)
            const initial = htmlToString(demo.view(demo.init))
            assert(initial.includes(`<pre>${helloX.toString(16)}</pre>`), initial)
            assert(initial.includes('<p data-caption="">Input x = SHA-256 of the text, hex:</p>'), initial)
            assert(initial.includes('<h3>Evaluate</h3>'), initial)
            assert(initial.includes('<h3>Verify</h3>'), initial)
            assert(initial.includes('<textarea id="claimed" name="claimed" rows="6"></textarea>'), initial)
            assert(initial.includes('>Evaluate</button>'), initial)
            assert(!initial.includes('Result y'), initial)
            assert(!initial.includes('OpenSSL'), initial)
            const started = click({ ...demo.init, steps: '25' }, 'evaluate')
            assertEq(started.run?.done, 10n)
            assertEq(started.run?.running, true)
            const scheduled = assertNotNullish(schedule(started))
            assertEq(scheduled.kind === 'click' ? scheduled.name : '', 'evaluate-next')
            const running = htmlToString(demo.view(started))
            assert(running.includes('Evaluating: step 10 of 25.'), running)
            assert(running.includes('>Stop</button>'), running)
            assert(!running.includes('Result y'), running)
            const stopped = click(started, 'evaluate')
            assertEq(stopped.run?.running, false)
            assertEq(schedule(stopped), null)
            const paused = htmlToString(demo.view(stopped))
            assert(paused.includes('Stopped at step 10 of 25.'), paused)
            assert(paused.includes('>Resume</button>'), paused)
            const done = settle(click(stopped, 'evaluate'))
            assertEq(done.run?.done, 25n)
            assertEq(done.run?.running, false)
            assertEq(done.run?.value, evalVdf(25n)(helloX))
            assertEq(done.claimed, '')
            const finished = htmlToString(demo.view(done))
            assert(finished.includes('Evaluated 25 sequential square roots.'), finished)
            assert(finished.includes('>Evaluate</button>'), finished)
            assert(finished.includes(`<p data-caption="">Result y, hex:</p><div data-code="" data-code-block=""><pre>${hexOfY(assertNotNullish(done.run).value)}</pre>`), finished)
            assert(!finished.includes('data-result'), finished)
            const restarted = click(done, 'evaluate')
            assertEq(restarted.run?.done, 10n)
            assertEq(restarted.run?.running, true)
            assertEq(restarted.run?.value, started.run?.value)
        },
        zeroSteps: () => {
            const done = click({ ...demo.init, steps: '0' }, 'evaluate')
            assertEq(done.run?.value, helloX)
            assertEq(done.run?.running, false)
        },
        verify: () => {
            const done = settle(click({ ...demo.init, steps: '4' }, 'evaluate'))
            const y = hexOfY(assertNotNullish(done.run).value)
            /** @type {(claimed: string) => typeof demo.init} */
            const verified = claimed => click(next(done, { kind: 'input', name: 'claimed', value: claimed }), 'verify')
            /** @type {(claimed: string) => string} */
            const viewOf = claimed => htmlToString(demo.view(verified(claimed)))
            assertEq(verified(y).verdict, 'verified')
            assert(viewOf(y).includes('<p role="status" data-result="ok">✓ y verifies: squaring it 4 times returns x, up to sign.</p>'), y)
            const tampered = `${y.slice(0, -1)}${y.endsWith('0') ? '1' : '0'}`
            assertEq(verified(tampered).verdict, 'rejected')
            assert(viewOf(tampered).includes('<p role="status" data-result="error">✗ y does not verify for this x and number of steps.</p>'), tampered)
            assertEq(verified('xyz').verdict, 'notHex')
            assert(viewOf('xyz').includes(stringConcat(element(refusal('Enter y as hexadecimal digits.')))), 'xyz')
            assertEq(verified('').verdict, 'notHex')
            assertEq(verified(p.toString(16)).verdict, 'notBelowP')
            assert(viewOf(p.toString(16)).includes(stringConcat(element(refusal('y must be less than the modulus p.')))), 'p')
            // Verify needs no evaluation: a pasted y is checked against x and steps alone.
            assertEq(click({ ...demo.init, steps: '4', claimed: y }, 'verify').verdict, 'verified')
        },
        tooLongText: () => {
            const long = { ...demo.init, text: 'a'.repeat(Number(maxLengthBytes) + 1), claimed: '1' }
            assertEq(xOf(long.text), null)
            assert(htmlToString(demo.view(long)).includes(stringConcat(element(refusal(`Input too long: more than ${maxLengthBytes} UTF-8 bytes.`)))), 'long')
            assertEq(click(long, 'evaluate'), long)
            assertEq(click(long, 'verify').verdict, null)
            const combined = next(long, { kind: 'input', name: 'steps', value: '-' })
            const html = htmlToString(demo.view(combined))
            assertEq(html.split('Refused:').length - 1, 2)
            assert(html.includes(stringConcat(element(refusal('Enter a non-negative decimal number of steps.')))), html)
            assert(html.includes('name="evaluate"'), html)
            assert(html.includes('name="verify"'), html)
        },
        tooLongY: () => {
            const yDigits = p.toString(16).length
            const long = { ...demo.init, claimed: '0'.repeat(yDigits + 1) }
            assertEq(click(long, 'verify').verdict, 'tooLong')
            assert(htmlToString(demo.view(click(long, 'verify'))).includes(stringConcat(element(refusal(`Enter y with at most ${yDigits} hexadecimal digits.`)))), 'tooLong')
            assertEq(click({ ...long, claimed: '0'.repeat(yDigits) }, 'verify').verdict, 'rejected')
        },
        verifyWhileRunning: () => {
            const running = click({ ...demo.init, steps: '25', claimed: '1' }, 'evaluate')
            assertEq(running.run?.running, true)
            assertEq(click(running, 'verify'), running)
            assert(htmlToString(demo.view(running)).includes('<button type="button" name="verify" disabled="">Verify</button>'), 'disabled')
            const stopped = click(running, 'evaluate')
            assert(htmlToString(demo.view(stopped)).includes('<button type="button" name="verify">Verify</button>'), 'enabled')
            assertEq(click(stopped, 'verify').verdict, 'rejected')
        },
        wait: () => {
            const wait = assertNotNullish(demo.wait)
            assertEq(wait(demo.init), null)
            assertEq(wait({ ...demo.init, steps: 'x' }), null)
            assertEq(wait({ ...demo.init, steps: '499999' }), null)
            assertEq(wait({ ...demo.init, steps: '1000000' }), 'verifying 1000000 steps takes about 2 s')
            assertEq(wait({ ...demo.init, steps: '60000000' }), 'verifying 60000000 steps takes about 2 min')
        },
    },
    p: {
        matchesField: () => {
            assertEq(sloth.p, p, [sloth.p, p])
        },
    },
    eval: {
        steps100: () => {
            const y = evalVdf(100n)(sampleX)
            assertEq(y, sampleY, [y, sampleY])
        },
        steps10: () => {
            const y = evalVdf(10n)(smallX)
            assertEq(y, smallY, [y, smallY])
        },
        steps6: () => {
            const y = evalVdf(6n)(largeX)
            assertEq(y, y6, [y, y6])
        },
        steps4: () => {
            const y = evalVdf(4n)(smallX)
            assertEq(y, y4, [y, y4])
        },
        zeroSteps: () => {
            const y = evalVdf(0n)(sampleX)
            assertEq(y, sampleX % p, [y, sampleX % p])
        },
        negativeSteps: () => {
            const y = evalVdf(-1n)(sampleX)
            assertEq(y, null)
        },
        aboveP: () => {
            const y0 = evalVdf(0n)(smallX + p)
            assertEq(y0, smallX, [y0, smallX])
            const y = evalVdf(4n)(smallX + p)
            assertEq(y, y4, [y, y4])
        },
    },
    verify: {
        steps100: () => {
            assert(verify(100n)(sampleX)(sampleY), false)
        },
        steps10: () => {
            assert(verify(10n)(smallX)(smallY), false)
        },
        steps6: () => {
            assert(verify(6n)(largeX)(y6), false)
        },
        steps4: () => {
            assert(verify(4n)(smallX)(y4), false)
        },
        tampered: () => {
            assert(!(verify(4n)(smallX)((y4 + 1n) % p)), (y4 + 1n) % p)
        },
        wrongY: () => {
            assert(!(verify(100n)(sampleX)(sampleY + 1n)), sampleY + 1n)
        },
        zeroSteps: () => {
            assert(verify(0n)(sampleX)(sampleX % p), [sampleX % p])
        },
        negativeSteps: () => {
            assert(!(verify(-1n)(sampleX)(sampleY)), sampleY)
        },
        invalidY: () => {
            assert(!(verify(100n)(sampleX)(0n)), 0n)
        },
    },
    modSqrt: {
        roundTrip: () => {
            const x = 999n
            assert(verify(1n)(x)(modSqrt(x)), modSqrt(x))
        },
        nonResidue: () => {
            assert(!(quadRes(nonResidue)), nonResidue)
            assert(verify(1n)(nonResidue)(modSqrt(nonResidue)), modSqrt(nonResidue))
        },
    },
    quadRes: {
        one: () => {
            assert(quadRes(1n), 1n)
        },
        nonResidue: () => {
            assert(!(quadRes(nonResidue)), nonResidue)
        },
    },
}
