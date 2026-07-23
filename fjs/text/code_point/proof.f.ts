import {
    isBmpCodePoint,
    isHighSurrogate,
    isLowSurrogate,
    isSupplementaryPlane,
    isTextCodePoint,
    isValidCodePoint,
} from './module.f.ts'

const check = (actual: boolean, expected: boolean) => {
    if (actual !== expected) { throw `${actual} !== ${expected}` }
}

export const proof = {
    isHighSurrogate: [
        () => check(isHighSurrogate(0xd800), true),
        () => check(isHighSurrogate(0xdbff), true),
        () => check(isHighSurrogate(0xd7ff), false),
        () => check(isHighSurrogate(0xdc00), false),
    ],
    isLowSurrogate: [
        () => check(isLowSurrogate(0xdc00), true),
        () => check(isLowSurrogate(0xdfff), true),
        () => check(isLowSurrogate(0xdbff), false),
        () => check(isLowSurrogate(0xe000), false),
    ],
    isBmpCodePoint: [
        // lowBmp branch true
        () => check(isBmpCodePoint(0x0000), true),
        () => check(isBmpCodePoint(0xd7ff), true),
        // lowBmp false, highBmp true
        () => check(isBmpCodePoint(0xe000), true),
        () => check(isBmpCodePoint(0xffff), true),
        // both false: surrogate and supplementary
        () => check(isBmpCodePoint(0xd800), false),
        () => check(isBmpCodePoint(0x10000), false),
    ],
    isSupplementaryPlane: [
        () => check(isSupplementaryPlane(0x10000), true),
        () => check(isSupplementaryPlane(0x10ffff), true),
        () => check(isSupplementaryPlane(0xffff), false),
        () => check(isSupplementaryPlane(0x110000), false),
    ],
    isValidCodePoint: [
        // in range, not surrogate
        () => check(isValidCodePoint(0x0000), true),
        () => check(isValidCodePoint(0x10ffff), true),
        // in range, surrogate -> invalid
        () => check(isValidCodePoint(0xd800), false),
        () => check(isValidCodePoint(0xdfff), false),
        // out of range -> validRange short-circuits false
        () => check(isValidCodePoint(-1), false),
        () => check(isValidCodePoint(0x110000), false),
    ],
    isTextCodePoint: [
        // C0 controls are binary...
        () => check(isTextCodePoint(0x00), false), // NUL
        () => check(isTextCodePoint(0x08), false), // BS
        () => check(isTextCodePoint(0x1b), false), // ESC
        () => check(isTextCodePoint(0x1f), false), // US
        // ...except the whitespace block 0x09 - 0x0D
        () => check(isTextCodePoint(0x09), true), // TAB
        () => check(isTextCodePoint(0x0a), true), // LF
        () => check(isTextCodePoint(0x0b), true), // VT
        () => check(isTextCodePoint(0x0c), true), // FF
        () => check(isTextCodePoint(0x0d), true), // CR
        // printable ASCII is text
        () => check(isTextCodePoint(0x20), true), // space
        () => check(isTextCodePoint(0x41), true), // 'A'
        () => check(isTextCodePoint(0x7e), true), // '~'
        // DEL and the C1 controls are binary
        () => check(isTextCodePoint(0x7f), false), // DEL
        () => check(isTextCodePoint(0x80), false), // C1 start
        () => check(isTextCodePoint(0x9f), false), // C1 end
        // above C1 is text again
        () => check(isTextCodePoint(0xa0), true), // NBSP
        () => check(isTextCodePoint(0x10ffff), true),
    ],
}
