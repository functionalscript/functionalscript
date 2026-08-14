import { isBareInteger, isIntegral, numberLexeme } from './module.f.mjs'
import { assert, assertStructurallySame } from '../../../asserts/module.f.mjs'

/** @type {(value: string) => boolean} */
const integral = value => isIntegral(numberLexeme(value))

/** @type {(value: string) => boolean} */
const bareInteger = value => isBareInteger(numberLexeme(value))

// An exponent long enough that representing it as a `number` loses digits and
// `10 ** exponent` is not a computation anyone can afford. Every check below
// that uses it must be decided by the token's shape alone.
const hugeExp = '99999999999999999999'

export const proof = {
    numberLexeme: {
        int: () => assertStructurallySame(
            numberLexeme('123'),
            { sign: '', int: '123', frac: '', expSign: '', exp: '' }),
        negative: () => assertStructurallySame(
            numberLexeme('-123'),
            { sign: '-', int: '123', frac: '', expSign: '', exp: '' }),
        fraction: () => assertStructurallySame(
            numberLexeme('-0.125'),
            { sign: '-', int: '0', frac: '125', expSign: '', exp: '' }),
        exponent: () => assertStructurallySame(
            numberLexeme('1e10'),
            { sign: '', int: '1', frac: '', expSign: '', exp: '10' }),
        capitalExponent: () => assertStructurallySame(
            numberLexeme('1.5E10'),
            { sign: '', int: '1', frac: '5', expSign: '', exp: '10' }),
        plusExponent: () => assertStructurallySame(
            numberLexeme('1e+10'),
            { sign: '', int: '1', frac: '', expSign: '+', exp: '10' }),
        minusExponent: () => assertStructurallySame(
            numberLexeme('1e-10'),
            { sign: '', int: '1', frac: '', expSign: '-', exp: '10' }),
        // nothing is narrowed, so an unrepresentable exponent is just text
        unbounded: () => assertStructurallySame(
            numberLexeme(`-1.5e-${hugeExp}`),
            { sign: '-', int: '1', frac: '5', expSign: '-', exp: hugeExp }),
    },
    // bare integer syntax: no `.` and no `e`/`E`, whatever the value is
    isBareInteger: {
        int: () => assert(bareInteger('-1230')),
        zero: () => assert(bareInteger('-0')),
        fraction: () => assert(!bareInteger('1.0')),
        exponent: () => assert(!bareInteger('1e3')),
    },
    isIntegral: {
        // a zero coefficient is integral at any exponent, and is decided
        // without looking at the exponent at all
        zero: [
            () => assert(integral('0')),
            () => assert(integral('-0.000')),
            () => assert(integral(`0.0e-${hugeExp}`)),
        ],
        plain: [
            () => assert(integral('123')),
            () => assert(integral('1.00')),
            () => assert(!integral('1.5')),
            () => assert(!integral('1.50')),
        ],
        // the exponent moves the point; only the coefficient's own trailing
        // zeros can absorb a move to the right
        exponent: [
            () => assert(integral('1e3')),
            () => assert(integral('1.5e1')),
            () => assert(integral('1.5e2')),
            () => assert(integral('150e-1')),
            () => assert(!integral('1.5e-1')),
            () => assert(!integral('15e-2')),
            () => assert(!integral('1.55e1')),
            () => assert(!integral('1.0000000000001e5')),
            // leading zeros in the exponent are not extra magnitude
            () => assert(integral('1.5e001')),
        ],
        // decided from lengths and a sign, never by representing the exponent
        unbounded: [
            () => assert(integral(`1e${hugeExp}`)),
            () => assert(integral(`1.5e${hugeExp}`)),
            () => assert(!integral(`1e-${hugeExp}`)),
            () => assert(!integral(`1.5e-${hugeExp}`)),
        ],
    },
}
