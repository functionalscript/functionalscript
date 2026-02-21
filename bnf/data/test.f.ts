import { stringify } from '../../json/module.f.ts'
import { type CodePoint, stringToCodePointList } from '../../text/utf16/module.f.ts'
import { identity } from '../../types/function/module.f.ts'
import { map, toArray } from '../../types/list/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import { join0Plus, option, range, repeat0Plus, type Rule, set } from '../module.f.ts'
import { classic, deterministic } from '../testlib.f.ts'
import { dispatchMap, type MatchResult, parser, parserRuleSet, type RuleSet, toData, createEmptyTagMap, descentParser, type DescentMatch, type CodePointMeta, type DescentMatchResult } from './module.f.ts'

const mapCodePoint = (cp: CodePoint): CodePointMeta<unknown> => [cp, undefined]

const descentParserCpOnly = (m: DescentMatch<unknown>, name: string, cp: readonly CodePoint[]): DescentMatchResult<unknown> => {
    const cpm = toArray(map(mapCodePoint)(cp))
    return m(name, cpm)
}

export default {
    range: () => {
        const offset = 24
        const mask = (1 << offset) - 1

        const r1 = 0x000079_000087
        const decoded1 = stringify(sort)([r1 >>> offset, r1 & mask])
        if (decoded1 !== '[121,135]') { throw decoded1 }

        const r2 = 0x000080_000087
        const decoded2 = stringify(sort)([r2 >>> offset, r2 & mask])
        if (decoded2 !== '[128,135]') { throw decoded2 }
    },
    toData: [
        () => {
            const c = toData(classic())
            const d = toData(deterministic())
        },
        () => {
            const stringRule = 'true'
            const result = stringify(sort)(toData(stringRule))
            if (result !== '[{"":["0","1","2","3"],"0":1946157172,"1":1912602738,"2":1962934389,"3":1694498917},""]') { throw result }
        },
        () => {
            const terminalRangeRule = range('AF')
            const result = stringify(sort)(toData(terminalRangeRule))
            if (result !== '[{"":1090519110},""]') { throw result } //1090519110 = 65 * 2^24 + 70
        },
        () => {
            const sequenceRangeRule = [range('AF'), range('af')]
            const result = stringify(sort)(toData(sequenceRangeRule))
            if (result !== '[{"":["0","1"],"0":1090519110,"1":1627390054},""]') { throw result }
        },
        () => {
            const lazyRule = () => 'true'
            const result = stringify(sort)(toData(lazyRule))
            if (result !== '[{"":1946157172,"0":1912602738,"1":1962934389,"2":1694498917,"lazyRule":["","0","1","2"]},"lazyRule"]') { throw result }
        },
        () => {
            const varintRule = { true: 'true', false: 'false'}
            const result = stringify(sort)(toData(varintRule))
            const expected = '[{"":{"false":"5","true":"0"},"0":["1","2","3","4"],"1":1946157172,"2":1912602738,"3":1962934389,"4":1694498917,"5":["6","7","8","9","4"],"6":1711276134,"7":1627390049,"8":1811939436,"9":1929379955},""]'
            if (result !== expected) { throw [result, expected] }
        },        
        () => {
            const lazyRule = () => 'true'
            const lazyRule0 = () => 'false'            
            const result = stringify(sort)(toData([lazyRule, lazyRule0]))
            const expected = '[{"":["lazyRule","lazyRule0"],"0":1946157172,"1":1912602738,"2":1962934389,"3":1694498917,"4":1711276134,"5":1627390049,"6":1811939436,"7":1929379955,"lazyRule":["0","1","2","3"],"lazyRule0":["4","5","6","7","3"]},""]'
            if (result !== expected) { throw [result, expected] }
        },
        () => {
            const emptyRule = ''
            const result = stringify(sort)(toData(emptyRule))
            const expected = '[{"":[]},""]'
            if (result !== expected) { throw [result, expected] }
        },
        () => {
            const optionRule = option('a')
            const result = stringify(identity)(toData(optionRule))
            if (result !== '[{"0":["1"],"1":1627390049,"2":[],"":{"some":"0","none":"2"}},""]') { throw result }
        },
        () => {
            const repeatRule = repeat0Plus(option('a'))
            const result = stringify(identity)(toData(repeatRule))
            if (result !== '[{"0":{"some":"1","none":"3"},"1":["2"],"2":1627390049,"3":[],"":["0","r"],"r":{"some":"","none":"3"}},"r"]') { throw result }
        },
        () => {
            const repeatRule = repeat0Plus(set(' \n\r\t'))
            const result = stringify(identity)(toData(repeatRule))
            if (result !== '[{"0":{" ":"1","\\n":"2","\\r":"3","\\t":"4"},"1":536870944,"2":167772170,"3":218103821,"4":150994953,"5":[],"":["0","r"],"r":{"some":"","none":"5"}},"r"]') { throw result }
        }
    ],
    emptyTags: [
        () => {
            const stringRule = 'true'
            const data = toData(stringRule)
            const emptyTags = createEmptyTagMap(data)
            const result = JSON.stringify(emptyTags)
            if (result !== '{"0":false,"1":false,"2":false,"3":false,"":false}') { throw result }
        },
        () => {
            const terminalRangeRule = range('AF')
            const data = toData(terminalRangeRule)
            const emptyTags = createEmptyTagMap(data)
            const result = JSON.stringify(emptyTags)
            if (result !== '{"":false}') { throw result }
        },
        () => {
            const varintRule = { true: 'true', false: 'false'}
            const data = toData(varintRule)
            const emptyTags = createEmptyTagMap(data)
            const result = JSON.stringify(emptyTags)
            if (result !== '{"0":false,"1":false,"2":false,"3":false,"4":false,"5":false,"6":false,"7":false,"8":false,"9":false,"":false}') { throw result }
        },
        () => {
            const emptyRule = ''
            const data = toData(emptyRule)
            const emptyTags = createEmptyTagMap(data)
            const result = JSON.stringify(emptyTags)
            if (result !== '{"":true}') { throw result }
        },
        () => {
            const emptyRule = ''
            const varintRule = { true: 'true', e: emptyRule}
            const data = toData(varintRule)
            const emptyTags = createEmptyTagMap(data)
            const result = JSON.stringify(emptyTags)
            if (result !== '{"0":false,"1":false,"2":false,"3":false,"4":false,"5":true,"":"e"}') { throw result }
        },
        () => {
            const repeatRule = repeat0Plus(option('a'))
            const data = toData(repeatRule)
            const emptyTags = createEmptyTagMap(data)
            const result = JSON.stringify(emptyTags)
            if (result !== '{"0":"none","1":false,"2":false,"3":true,"r":"none","":true}') { throw result }
        },
        () => {
            const repeatRule = repeat0Plus(set(' \n\r\t'))
            const data = toData(repeatRule)
            const emptyTags = createEmptyTagMap(data)
            const result = JSON.stringify(emptyTags)
            if (result !== '{"0":false,"1":false,"2":false,"3":false,"4":false,"5":true,"r":"none","":true}') { throw result }
        }
    ],    
    variantTest: () => {
        const varintRule = { a: 'a', b: 'b'}
        const result = stringify(sort)(toData(varintRule))
        if (result !== '[{"":{"a":"0","b":"2"},"0":["1"],"1":1627390049,"2":["3"],"3":1644167266},""]') { throw result }
    },
    dispatch: [
        () => {
            const terminalRangeRule = range('AF')
            const data = toData(terminalRangeRule)
            const dm = dispatchMap(data[0])
            const result = JSON.stringify(dm)
            if (result !== '{"":{"rangeMap":[[null,64],[{"rules":[]},70]]}}') { throw result }
        },
        () => {
            const stringRule = 'AB'
            const data = toData(stringRule)
            const dm = dispatchMap(data[0])
            const result = JSON.stringify(dm)
            if (result !== '{"0":{"rangeMap":[[null,64],[{"rules":[]},65]]},"1":{"rangeMap":[[null,65],[{"rules":[]},66]]},"":{"rangeMap":[[null,64],[{"rules":["1"]},65]]}}') { throw result }
        },        
        () => {
            const a = range('AA')
            const b = range('BB')
            const ab = [a, b]
            const data = toData(ab)
            const dm = dispatchMap(data[0])
            const result = JSON.stringify(dm)
            if (result !== '{"0":{"rangeMap":[[null,64],[{"rules":[]},65]]},"1":{"rangeMap":[[null,65],[{"rules":[]},66]]},"":{"rangeMap":[[null,64],[{"rules":["1"]},65]]}}') { throw result }
        },
        () => {
            const emptyRule = ''
            const data = toData(emptyRule)
            const dm = dispatchMap(data[0])
            const result = JSON.stringify(dm)
            if (result !== '{"":{"emptyTag":true,"rangeMap":[]}}') { throw result }
        },
        () => {
            const variantRule = { 'a': range('AA'), 'b': range('BB')}
            const data = toData(variantRule)
            const dm = dispatchMap(data[0])
            const result = JSON.stringify(dm)
            if (result !== '{"0":{"rangeMap":[[null,64],[{"rules":[]},65]]},"1":{"rangeMap":[[null,65],[{"rules":[]},66]]},"":{"rangeMap":[[null,64],[{"tag":"a","rules":[]},65],[{"tag":"b","rules":[]},66]]}}') { throw result }
        },
        () => {
            const emptyRule = ''
            const variantRule = { 'e': emptyRule, 'a': range('AA')}
            const data = toData(variantRule)
            const dm = dispatchMap(data[0])
            const result = JSON.stringify(dm)
            if (result !== '{"0":{"emptyTag":true,"rangeMap":[]},"1":{"rangeMap":[[null,64],[{"rules":[]},65]]},"":{"emptyTag":"e","rangeMap":[[null,64],[{"tag":"a","rules":[]},65]]}}') { throw result }
        },
        () => {
            const emptyRule = ''            
            const minursRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minursRule}
            const digitRule = range('09')
            const numberRule = [optionalMinusRule, digitRule]
            const data = toData(numberRule)
            const dm = dispatchMap(data[0])
            const result = JSON.stringify(dm)
            if (result !== '{"0":{"emptyTag":"none","rangeMap":[[null,44],[{"tag":"minus","rules":[]},45]]},"1":{"emptyTag":true,"rangeMap":[]},"2":{"rangeMap":[[null,44],[{"rules":[]},45]]},"3":{"rangeMap":[[null,47],[{"rules":[]},57]]},"":{"rangeMap":[[null,44],[{"tag":"minus","rules":["3"]},45],[null,47],[{"rules":[]},57]]}}') { throw result }
        },        
        () => {
            const emptyRule = ''
            const spaceRule = range('  ')
            const optionalSpaceRule = { 'none': emptyRule, 'space': spaceRule}
            const minusRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minusRule}
            const digitRule = range('09')
            const numberRule = [optionalSpaceRule, optionalMinusRule, digitRule]
            const data = toData(numberRule)
            const dm = dispatchMap(data[0])
            const result = JSON.stringify(dm)
            if (result !== '{"0":{"emptyTag":"none","rangeMap":[[null,31],[{"tag":"space","rules":[]},32]]},"1":{"emptyTag":true,"rangeMap":[]},"2":{"rangeMap":[[null,31],[{"rules":[]},32]]},"3":{"emptyTag":"none","rangeMap":[[null,44],[{"tag":"minus","rules":[]},45]]},"4":{"rangeMap":[[null,44],[{"rules":[]},45]]},"5":{"rangeMap":[[null,47],[{"rules":[]},57]]},"":{"rangeMap":[[null,31],[{"tag":"space","rules":["3","5"]},32],[null,44],[{"tag":"minus","rules":["5"]},45],[null,47],[{"rules":[]},57]]}}') { throw result }
        }
    ],
    parser: [
        () => {
            const emptyRule = ''
            const m = parser(emptyRule)
            const mr = m("", [])
            const result = JSON.stringify(mr)
            if (result !== '[{"tag":true,"sequence":[]},true,[]]') { throw result }
        },
        () => {
            const emptyRule = ''
            const m = parser(emptyRule)
            const mr = m("", [65, 70])
            const result = JSON.stringify(mr)
            if (result !== '[{"tag":true,"sequence":[]},true,[65,70]]') { throw result }
        },
        () => {
            const terminalRangeRule = range('AF')
            const m = parser(terminalRangeRule)
            const mr = m("", [65])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[65]},true,[]]') { throw result }
        },
        () => {
            const terminalRangeRule = 0x000079_000087
            const m = parser(terminalRangeRule)
            const mr = m("", [64])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},false,[64]]') { throw result }       
        },
        () => {
            const terminalRangeRule = 0x000080_000087 //broken range
            const m = parser(terminalRangeRule)
            const mr = m("", [64])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},false,[64]]') { throw result }       
        },
        () => {
            const variantRule = { 'a': range('AA'), 'b': range('BB')}
            const m = parser(variantRule)
            const mr = m("", [65])
            const result = JSON.stringify(mr)
            if (result !== '[{"tag":"a","sequence":[65]},true,[]]') { throw result }
        },
        () => {
            const variantRule = { 'a': range('AA'), 'b': range('BB')}
            const m = parser(variantRule)
            const mr = m("", [64])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},false,[64]]') { throw result }
        },
        () => {
            const emptyRule = ''
            const variantRule = { 'e': emptyRule, 'a': range('AA')}
             const m = parser(variantRule)
            const mr = m("", [])
            const result = JSON.stringify(mr)
            if (result !== '[{"tag":"e","sequence":[]},true,[]]') { throw result }
        },
        () => {
            const emptyRule = ''
            const variantRule = { 'e': emptyRule, 'a': range('AA')}
            const m = parser(variantRule)
            const mr = m("", [64])
            const result = JSON.stringify(mr)
            if (result !== '[{"tag":"e","sequence":[]},true,[64]]') { throw result }
        },
        () => {
            const stringRule = 'AB'
            const m = parser(stringRule)
            const mr = m("", [65,66])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[65,{"sequence":[66]}]},true,[]]') { throw result }
        },
        () => {
            const stringRule = 'AB'
            const m = parser(stringRule)
            const mr = m("", [65,67])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},false,[67]]') { throw result }
        },
        () => {
            const emptyRule = ''            
            const minursRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minursRule}
            const digitRule = range('09')
            const numberRule = [optionalMinusRule, digitRule]
            const m = parser(numberRule)
            const mr = m("", [50])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[50]},true,[]]') { throw result }
        },
        () => {
            const emptyRule = ''            
            const minusRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minusRule}
            const digitRule = range('09')
            const numberRule = [optionalMinusRule, digitRule]
            const m = parser(numberRule)
            const mr = m("", [45,50])
            const result = JSON.stringify(mr)
            if (result !== '[{"tag":"minus","sequence":[45,{"sequence":[50]}]},true,[]]') { throw result }
        },
        () => {
            const emptyRule = ''            
            const minusRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minusRule}
            const digitRule = range('09')
            const numberRule = [optionalMinusRule, digitRule]
            const m = parser(numberRule)
            const mr = m("", [])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},true,null]') { throw result } //if remainder is null it means failed
        },
        () => {                        
            const m = parser(option('a'))

            const isSuccess = (mr: MatchResult) => mr[1] && mr[2]?.length === 0
            const expect = (s: string, success: boolean) => {
                const mr = m('', toArray(stringToCodePointList(s)))
                if (isSuccess(mr) !== success) {
                    throw mr
                }
            }

            expect('a', true)
            expect('', true)
            expect('aa', false)
            expect('b', false)
        },
        () => {       
            const ws = repeat0Plus(set(' \n\r\t'))

            const commaJoin0Plus = ([open, close]: string, a: Rule) => [
                open,
                ws,
                join0Plus([a, ws], [',', ws]),
                close,
            ]
             
            const value = () => ({                
                object: commaJoin0Plus('{}', 'a'),
                array: commaJoin0Plus('[]', 'a')
            })

            value.name //bun will fail if no usage of name found

            const m = parser(value)

            const isSuccess = (mr: MatchResult) => mr[1] && mr[2]?.length === 0
            const expect = (s: string, success: boolean) => {
                const mr = m('value', toArray(stringToCodePointList(s)))
                if (isSuccess(mr) !== success) {
                    throw mr
                }
            }

            expect('', false)
            expect('[]', true)
            expect('[a]', true)            
            expect('[a, a]', true)            
            expect('{a}', true)
        },
        () => {
            const m = parser(deterministic())
            
            const isSuccess = (mr: MatchResult) => mr[1] && mr[2]?.length === 0
            const expect = (s: string, success: boolean) => {
                const mr = m('', toArray(stringToCodePointList(s)))
                if (isSuccess(mr) !== success) {
                    throw mr
                }
            }

            expect('   true   ', true)
            expect('   tr2ue   ', false)
            expect('   true"   ', false)
            expect('   "Hello"   ', true)
            expect('   "Hello   ', false)
            expect('   "Hello\\n\\r\\""   ', true)
            expect('   -56.7e+5  ', true)
            expect('   h-56.7e+5   ', false)
            expect('   -56.7e+5   3', false)
            expect('   [] ', true)
            expect('   {} ', true)
            expect('   [[[]]] ', true)
            expect('   [1] ', true)
            expect('   [ 12, false, "a"]  ', true)
            expect('   [ 12, false2, "a"]  ', false)
            expect('   { "q": [ 12, false, [{"b" : "c"}], "a"] }  ', true)
            expect('   { "q": [ 12, false, [{}], "a"] }  ', true)
            expect('   { "q": [ 12, false, [}], "a"] }  ', false)
            expect('   [{ "q": [ 12, false, [{}], "a"] }]  ', true)
            expect('   [{ "q": [ 12, false, [}], "a"] }]  ', false)
        }
    ],
    descentParser: [
        () => {
            const emptyRule = ''
            const m = descentParser(emptyRule)
            const mr = m("", [])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},true,0]') { throw result }
        },
        () => {
            const emptyRule = ''
            const m = descentParser(emptyRule)
            const mr = descentParserCpOnly(m, "", [65, 70])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},true,0]') { throw result }
        },
        () => {
            const terminalRangeRule = range('AF')
            const m = descentParser(terminalRangeRule)
            const mr = descentParserCpOnly(m, "", [65])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[[65,null]]},true,1]') { throw result }       
        },
        () => {
            const terminalRangeRule = range('AF')
            const m = descentParser(terminalRangeRule)
            const mr =descentParserCpOnly(m, "", [64])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},false,0]') { throw result }       
        },
        () => {
            const variantRule = { 'a': range('AA'), 'b': range('BB')}
            const m = descentParser(variantRule)
            const mr = descentParserCpOnly(m, "", [65])
            const result = JSON.stringify(mr)
            if (result !== '[{"tag":"a","sequence":[[65,null]]},true,1]') { throw result }
        },
        () => {
            const variantRule = { 'a': range('AA'), 'b': range('BB')}
            const m = descentParser(variantRule)
            const mr = descentParserCpOnly(m, "", [64])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},false,0]') { throw result }
        },
        () => {
            const emptyRule = ''
            const variantRule = { 'e': emptyRule, 'a': range('AA')}
             const m = descentParser(variantRule)
            const mr = m("", [])
            const result = JSON.stringify(mr)
            if (result !== '[{"tag":"e","sequence":[]},true,0]') { throw result }
        },
        () => {
            const emptyRule = ''
            const variantRule = { 'e': emptyRule, 'a': range('AA')}
            const m = descentParser(variantRule)
            const mr = descentParserCpOnly(m, "", [64])
            const result = JSON.stringify(mr)
            if (result !== '[{"tag":"e","sequence":[]},true,0]') { throw result }
        },
        () => {
            const stringRule = 'AB'
            const m = descentParser(stringRule)
            const mr = descentParserCpOnly(m, "", [65,66])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[{"sequence":[[65,null]]},{"sequence":[[66,null]]}]},true,2]') { throw result }
        },
        () => {
            const stringRule = 'AB'
            const m = descentParser(stringRule)
            const mr = descentParserCpOnly(m, "", [65,67])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},false,0]') { throw result }
        },
        () => {
            const emptyRule = ''            
            const minursRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minursRule}
            const digitRule = range('09')
            const numberRule = [optionalMinusRule, digitRule]
            const m = descentParser(numberRule)
            const mr = descentParserCpOnly(m, "", [50])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[{"tag":"none","sequence":[]},{"sequence":[[50,null]]}]},true,1]') { throw result }
        },       
        () => {
            const emptyRule = ''            
            const minusRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minusRule}
            const digitRule = range('09')
            const numberRule = [optionalMinusRule, digitRule]
            const m = descentParser(numberRule)
            const mr = descentParserCpOnly(m, "", [45,50])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[{"tag":"minus","sequence":[[45,null]]},{"sequence":[[50,null]]}]},true,2]') { throw result }
        },
        () => {
            const emptyRule = ''            
            const minursRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minursRule}
            const digitRule = range('09')
            const numberRule = [optionalMinusRule, digitRule]
            const m = descentParser(numberRule)
            const mr = m("", [])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},false,0]') { throw result }
        },
        () => {                        
            const m = descentParser(option('a'))

            const expect = (s: string, expected: boolean) => {
                const cp = toArray(stringToCodePointList(s))
                const mr = descentParserCpOnly(m, '', cp)
                const success = mr[1] && mr[2] === cp.length
                if (success !== expected) {
                    throw mr
                }
            }

            expect('a', true)
            expect('', true)
            expect('aa', false)
            expect('b', false)
        },
        () => {       
            const ws = repeat0Plus(set(' \n\r\t'))

            const commaJoin0Plus = ([open, close]: string, a: Rule) => [
                open,
                ws,
                join0Plus([a, ws], [',', ws]),
                close,
            ]
             
            const value = () => ({                
                object: commaJoin0Plus('{}', 'a'),
                array: commaJoin0Plus('[]', 'a')
            })

            value.name //bun will fail if no usage of name found

            const m = descentParser(value)

            const expect = (s: string, expected: boolean) => {
                const cp = toArray(stringToCodePointList(s))
                const mr = descentParserCpOnly(m, 'value', cp)
                const success = mr[1] && mr[2] === cp.length
                if (success !== expected) {
                    throw mr
                }
            }                   
            
            expect('', false)
            expect('[]', true)
            expect('[a]', true)
            expect('[a, a]', true)
            expect('{a}', true)
        },
        () => {
            const m = descentParser(deterministic())
            
            const expect = (s: string, expected: boolean) => {
                const cp = toArray(stringToCodePointList(s))
                const mr = descentParserCpOnly(m, '', cp)
                const success = mr[1] && mr[2] === cp.length
                if (success !== expected) {
                    throw mr
                }
            }
            
            expect('   true   ', true)
            expect('   tr2ue   ', false)
            expect('   true"   ', false)
            expect('   "Hello"   ', true)
            expect('   "Hello   ', false)
            expect('   "Hello\\n\\r\\""   ', true)
            expect('   -56.7e+5  ', true)
            expect('   h-56.7e+5   ', false)
            expect('   -56.7e+5   3', false)
            expect('   [] ', true)
            expect('   {} ', true)
            expect('   [[[]]] ', true)
            expect('   [1] ', true)
            expect('   [ 12, false, "a"]  ', true)
            expect('   [ 12, false2, "a"]  ', false)
            expect('   { "q": [ 12, false, [{"b" : "c"}], "a"] }  ', true)
            expect('   { "q": [ 12, false, [{}], "a"] }  ', true)
            expect('   { "q": [ 12, false, [}], "a"] }  ', false)
            expect('   [{ "q": [ 12, false, [{}], "a"] }]  ', true)
            expect('   [{ "q": [ 12, false, [}], "a"] }]  ', false)
        }
    ],
    descentParserWithMeta: [
        () => {
            const emptyRule = ''            
            const minusRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minusRule}
            const digitRule = range('09')
            const numberRule = [optionalMinusRule, digitRule]
            const m = descentParser(numberRule)
            const mr = m("", [[45, 'minus'], [50, 'two']])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[{"tag":"minus","sequence":[[45,"minus"]]},{"sequence":[[50,"two"]]}]},true,2]') { throw result }
        },
    ],
    repeat: [
        () => {            
            const repeatData: readonly [RuleSet, string] = [{"":["ws","repa"],"ws":[],"repa":["a",""],"a":1090519105},""]
            const dm = dispatchMap(repeatData[0])
            const result = JSON.stringify(dm)
            if (result !== '{"ws":{"emptyTag":true,"rangeMap":[]},"a":{"rangeMap":[[null,64],[{"rules":[]},65]]},"repa":{"rangeMap":[[null,64],[{"rules":[""]},65]]},"":{"rangeMap":[[null,64],[{"rules":[""]},65]]}}') { throw result }
        }
    ],
    repeatParser: [
        () => {
            const repeatData: readonly [RuleSet, string] = [{"":["ws","repa"],"ws":[],"repa":["a",""],"a":1090519105},""]
            const m = parserRuleSet(repeatData[0])
            const mr = m("", [])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},true,null]') { throw result }
        },
        () => {
            const repeatData: readonly [RuleSet, string] = [{"":["ws","repa"],"ws":[],"repa":["a",""],"a":1090519105},""]
            const m = parserRuleSet(repeatData[0])
            const mr = m("", [65])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[65,{"sequence":[]}]},true,null]') { throw result }
        },
        () => {
            const repeatData: readonly [RuleSet, string] = [{"":["ws","repa"],"ws":[],"repa":["a",""],"a":1090519105},""]
            const m = parserRuleSet(repeatData[0])
            const mr = m("", [65,65,65])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[65,{"sequence":[65,{"sequence":[65,{"sequence":[]}]}]}]},true,null]') { throw result }
        },
        () => {
            const repeatData: readonly [RuleSet, string] = [{"":["ws","repa"],"ws":[],"repa":["a",""],"a":1090519105},""]
            const m = parserRuleSet(repeatData[0])
            const mr = m("", [66])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},false,[66]]') { throw result }
        }
    ],
    example: () => {
        const grammar = {
            space: 0x000020_000020,
            digit: 0x000030_000039,
            sequence: ['space', 'digit'],
            spaceOrDigit: {
                'whiteSpace': 'space',
                'digit': 'digit',
            }
        }
    }
}
