import { assertEq } from '../../../../asserts/module.f.js'
import { spansOf } from './module.f.js'

/** Which characters each span covers, as `kind:text`. @type {(text: string) => string} */
const covered = text => spansOf(text).map(({ start, length, kind }) =>
    `${kind}:${[...text].slice(start, start + length).join('')}`).join(' | ')

export const proof = {
    // The shapes `wasmprinter` writes, and `wat` after it.
    printed: () => assertEq(covered([
        '(module',
        '  (type $"#type1 " (@name "") (;1;) (func (param i32) (result i64)))',
        '  (func $f (;0;) (type 0)',
        '    block ;; label = @1',
        '      br 0 (;@1;)',
        '    end',
        '    f32.const nan:0x400001 (;=NaN;)',
        '    i64.load offset=8',
        '  )',
        ')',
    ].join('\n')), [
        'keyword:module',
        'keyword:type', 'identifier:$"#type1 "', 'keyword:@name', 'string:""', 'comment:(;1;)',
        'keyword:func', 'keyword:param', 'keyword:i32', 'keyword:result', 'keyword:i64',
        'keyword:func', 'identifier:$f', 'comment:(;0;)', 'keyword:type', 'number:0',
        'keyword:block', 'comment:;; label = @1',
        'keyword:br', 'number:0', 'comment:(;@1;)',
        'keyword:end',
        'keyword:f32.const', 'number:nan:0x400001', 'comment:(;=NaN;)',
        'keyword:i64.load', 'keyword:offset=8',
    ].join(' | ')),
    // A number signed or not, in hexadecimal, and the two named ones.
    numbers: () => assertEq(covered('+1 -0x1p+0 1_000 inf -nan'),
        'number:+1 | number:-0x1p+0 | number:1_000 | number:inf | number:-nan'),
    // A word that opens with neither `$`, a digit, a lower-case letter nor
    // `@` stays plain.
    plainWords: () => assertEq(covered('A + = x'), 'keyword:x'),
    // A string holds escapes, an escaped quote among them, and a character
    // beyond U+FFFF counts once in the offsets after it.
    strings: () => assertEq(covered('"a\\"b\\u{2713}" "😀" i32'), 'string:"a\\"b\\u{2713}" | string:"😀" | keyword:i32'),
    // A block comment nests; a line comment ends before its line break.
    comments: () => assertEq(covered('(; a (; b ;) c ;) x ;; d\r\ny'), 'comment:(; a (; b ;) c ;) | keyword:x | comment:;; d | keyword:y'),
    // What does not tokenize leaves the whole text plain.
    refused: () => {
        for (const text of ['x "a', 'x "a\nb"', 'x (; a', 'x (; (; ;)', 'x $"a', 'x, y', 'x [y]', 'é']) {
            assertEq(spansOf(text).length, 0)
        }
    },
}
