import { sloth, p } from './module.f.ts'
import { assert } from '../../asserts/module.f.ts'

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

export const proof = {
    p: {
        matchesField: () => {
            assert(sloth.p === p, [sloth.p, p])
        },
    },
    eval: {
        steps100: () => {
            const y = evalVdf(100n)(sampleX)
            assert(y === sampleY, [y, sampleY])
        },
        steps10: () => {
            const y = evalVdf(10n)(smallX)
            assert(y === smallY, [y, smallY])
        },
        steps6: () => {
            const y = evalVdf(6n)(largeX)
            assert(y === y6, [y, y6])
        },
        steps4: () => {
            const y = evalVdf(4n)(smallX)
            assert(y === y4, [y, y4])
        },
        zeroSteps: () => {
            const y = evalVdf(0n)(sampleX)
            assert(y === sampleX % p, [y, sampleX % p])
        },
        negativeSteps: () => {
            const y = evalVdf(-1n)(sampleX)
            assert(y === null, y)
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
