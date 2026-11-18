import { unmarkedWords, wordsOf } from './module.f.js'
import { assertEq } from '../../../asserts/module.f.js'
import { toJson } from '../../../media/json/module.f.js'

export const proof = {
    wordsOf: () => {
        assertEq(toJson(wordsOf('')), '[]')
        assertEq(toJson(wordsOf('let c0: Any<A> = f64_any(0x3ff);')), '["let","c0","Any","A","f64_any","0x3ff"]')
        assertEq(toJson(wordsOf('..a__b  ')), '["a__b"]')
    },
    unmarkedWords: () => {
        // nothing left unmarked: the words are in runs with a kind
        assertEq(toJson(unmarkedWords([['let', 'keyword'], [' c0 = '], ['0x1', 'number'], [';']])), '[]')
        // a keyword, a literal word and a number left plain
        assertEq(toJson(unmarkedWords([['use x; pub fn f() { let a = true; false }']])), '["use","pub","fn","let","true","false"]')
        assertEq(toJson(unmarkedWords([['.skip(2) c1 '], ['x', 'string'], [' 0x1f']])), '["2","0x1f"]')
        // an identifier that merely contains a keyword is not one
        assertEq(toJson(unmarkedWords([['lettuce used true_ fn_x c0']])), '[]')
    },
}
