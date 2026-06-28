import {
    isBmpCodePoint,
    isHighSurrogate,
    isLowSurrogate,
    isSupplementaryPlane,
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
}
