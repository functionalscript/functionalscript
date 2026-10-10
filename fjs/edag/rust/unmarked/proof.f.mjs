import { unmarkedWords, wordsOf } from './module.f.mjs'
import { assertEq } from '../../../asserts/module.f.mjs'

export const proof = {
    wordsOf: () => {
        assertEq(JSON.stringify(wordsOf('')), '[]')
        assertEq(JSON.stringify(wordsOf('let c0: Any<A> = f64_any(0x3ff);')), '["let","c0","Any","A","f64_any","0x3ff"]')
        assertEq(JSON.stringify(wordsOf('..a__b  ')), '["a__b"]')
    },
    unmarkedWords: () => {
        // nothing left unmarked: the words are in runs with a kind
        assertEq(JSON.stringify(unmarkedWords([['let', 'keyword'], [' c0 = '], ['0x1', 'number'], [';']])), '[]')
        // a keyword, a literal word and a number left plain
        assertEq(JSON.stringify(unmarkedWords([['use x; pub fn f() { let a = true; false }']])), '["use","pub","fn","let","true","false"]')
        assertEq(JSON.stringify(unmarkedWords([['.skip(2) c1 '], ['x', 'string'], [' 0x1f']])), '["2","0x1f"]')
        // an identifier that merely contains a keyword is not one
        assertEq(JSON.stringify(unmarkedWords([['lettuce used true_ fn_x c0']])), '[]')
    },
}
