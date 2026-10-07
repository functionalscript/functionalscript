/** @import { DemoEvent } from '../../website/demo/types.ts' */

import { sloth, p } from './module.f.mjs'
import { assert, assertEq, assertNotNullish } from '../../asserts/module.f.mjs'
import { demo, hexOfY, parseHex, parseSteps, xOf } from './demo.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'
import { runPure } from '../../effects/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'

const { eval: evalVdf, verify, modSqrt, quadRes } = sloth

// `eval(steps)(x)` expected values for {@link p}; same Sloth algorithm as
// https://github.com/hyperhyperspace/pulsar/blob/main/src/model/SlothVDF.ts and
// https://github.com/jose-compu/dignity.js/blob/main/src/security/sloth-vdf.js

const sampleX = 123456789n
const largeX = 12345678901234567890n
const smallX = 42n
const nonResidue = 2n

const sampleY =
    72412151236937799598582816305571618206681207952550127764586725290711141789888684237028784568532880529360450375677852568362636821341317217048062977639333459511661887862128325859969604061461913896412260750881385045152117694320409864730924775539555636460819549547999218170813228857928921642957426089461925313163n

const smallY =
    145151597037272685697451525487035431973338817762329243361437778785747534269376083577375382484815474368317818719265551745910148543423765263685177263740373969289084400977118144482329577335929842301331443392042760708529572252015473334998752211959790788326970269713683808382892472572910797612141527200051803670965n

const y6 =
    116287514643100261336025249676072556421566393377742705567032370320583145555855278910304225489766306768040386612082033279417845047304479679877515174322332386599890348932893235091525789175564701751964775040887336849457197662999383850490808701700264064812615988837073981567599117932005435532913423970502774287312n

const y4 =
    64401150265223443694244964595084197237814157534040219819342647664782563317539559768554855806938965782018778040933157632467146168153951260465261118025222264314070274636967492909984790708532033331622332323767105919809000393624013423095812833452440384602112677364631962445309757177309466319657219548312354433189n

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
const helloX = 0xa22d1ef8834e3024bb5653a1dbeb38305bef6d1cef486e450e0dfab718b47afdn

export const proof = {
    demo: {
        xOf: () => {
            assertEq(xOf(demo.init.text), helloX)
        },
        parseSteps: () => {
            assertEq(parseSteps('0'), 0n)
            assertEq(parseSteps('01000'), 1000n)
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
            const evaluated = settle(click({ ...demo.init, steps: '4' }, 'evaluate'))
            assert(evaluated.y !== '', evaluated)
            const text = next(evaluated, { kind: 'input', name: 'text', value: 'a' })
            assertEq([text.text, text.steps, text.y, text.run].join(), 'a,4,,')
            const steps = next(evaluated, { kind: 'input', name: 'steps', value: '5' })
            assertEq([steps.text, steps.steps, steps.y, steps.run].join(), `${demo.init.text},5,,`)
            const y = next(evaluated, { kind: 'input', name: 'y', value: '1' })
            assertEq(y.y, '1')
            assertEq(y.run, evaluated.run)
            assertEq(next(evaluated, { kind: 'input', name: 'other', value: '1' }), evaluated)
            assertEq(next(evaluated, { kind: 'start' }), evaluated)
            assertEq(click(evaluated, 'other'), evaluated)
            assertEq(click(evaluated, 'evaluate-next'), evaluated)
            assertEq(click(demo.init, 'evaluate-next'), demo.init)
            const invalid = { ...demo.init, steps: 'x' }
            assertEq(click(invalid, 'evaluate'), invalid)
            assert(htmlToString(demo.view(invalid)).includes('Enter a non-negative decimal number of steps.'), invalid)
        },
        evaluate: () => {
            const schedule = assertNotNullish(demo.nextEvent)
            assertEq(schedule(demo.init), null)
            const initial = htmlToString(demo.view(demo.init))
            assert(initial.includes(`<pre>${helloX.toString(16)}</pre>`), initial)
            assert(initial.includes('Input x = SHA-256 of the text, hex:'), initial)
            assert(initial.includes('Output y, hex'), initial)
            assert(!initial.includes('OpenSSL'), initial)
            assert(initial.includes('>Evaluate</button>'), initial)
            const started = click({ ...demo.init, steps: '25' }, 'evaluate')
            assertEq(started.run?.done, 10n)
            assertEq(started.run?.running, true)
            assertEq(started.y, '')
            const scheduled = assertNotNullish(schedule(started))
            assertEq(scheduled.kind === 'click' ? scheduled.name : '', 'evaluate-next')
            const running = htmlToString(demo.view(started))
            assert(running.includes('Evaluating: step 10 of 25.'), running)
            assert(running.includes('>Stop</button>'), running)
            const stopped = click(started, 'evaluate')
            assertEq(stopped.run?.running, false)
            assertEq(schedule(stopped), null)
            const paused = htmlToString(demo.view(stopped))
            assert(paused.includes('Stopped at step 10 of 25.'), paused)
            assert(paused.includes('>Resume</button>'), paused)
            const done = settle(click(stopped, 'evaluate'))
            assertEq(done.run?.done, 25n)
            assertEq(done.run?.running, false)
            assertEq(done.y, hexOfY(assertNotNullish(evalVdf(25n)(helloX))))
            const finished = htmlToString(demo.view(done))
            assert(finished.includes('Evaluated 25 sequential square roots.'), finished)
            assert(finished.includes('>Evaluate</button>'), finished)
            assert(finished.includes('✓ y verifies'), finished)
            const restarted = click(done, 'evaluate')
            assertEq(restarted.run?.done, 10n)
            assertEq(restarted.run?.running, true)
            assertEq(restarted.run?.value, started.run?.value)
        },
        zeroSteps: () => {
            const done = click({ ...demo.init, steps: '0' }, 'evaluate')
            assertEq(done.y, hexOfY(helloX))
            assertEq(done.run?.running, false)
        },
        verify: () => {
            const done = settle(click({ ...demo.init, steps: '4' }, 'evaluate'))
            /** @type {(y: string) => string} */
            const viewY = y => htmlToString(demo.view({ ...done, y }))
            assert(viewY(done.y).includes('data-result="ok"'), done.y)
            const tampered = `${done.y.slice(0, -1)}${done.y.endsWith('0') ? '1' : '0'}`
            assert(viewY(tampered).includes('✗ y does not verify'), tampered)
            assert(viewY('xyz').includes('Enter y as hexadecimal digits.'), 'xyz')
            assert(viewY(p.toString(16)).includes('y must be less than the modulus p.'), 'p')
            assert(!viewY('').includes('data-result'), '')
            const noSteps = htmlToString(demo.view({ ...done, steps: '' }))
            assert(!noSteps.includes('✓') && !noSteps.includes('✗'), noSteps)
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
