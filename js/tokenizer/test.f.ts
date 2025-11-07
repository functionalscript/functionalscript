import { tokenize, type JsToken, type JsTokenWithMetadata } from './module.f.ts'
import * as list from '../../types/list/module.f.ts'
const { toArray } = list
import * as serializer from '../../djs/serializer/module.f.ts'
import * as o from '../../types/object/module.f.ts'
const { sort } = o
import * as encoding from '../../text/utf16/module.f.ts'

const tokenizeString
    : (s: string) => readonly JsToken[]
    = s => toArray(list.map(withoutMetada)(tokenize(encoding.stringToList(s))('')))

const tokenizeStringWithMetadata
    : (s: string) => readonly JsTokenWithMetadata[]
    = s => toArray(tokenize(encoding.stringToList(s))(''))

const stringify = serializer.stringifyAsTree(sort)

const withoutMetada
    : (tokenWithMetada: JsTokenWithMetadata) => JsToken
    = tokenWithMetada => { return tokenWithMetada.token }

export default {
    djs: [
        () => {
            const result = stringify(tokenizeString(''))
            if (result !== '[{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{'))
            if (result !== '[{"kind":"{"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('}'))
            if (result !== '[{"kind":"}"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString(':'))
            if (result !== '[{"kind":":"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString(','))
            if (result !== '[{"kind":","},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('['))
            if (result !== '[{"kind":"["},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString(']'))
            if (result !== '[{"kind":"]"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('ᄑ'))
            if (result !== '[{"kind":"error","message":"unexpected character"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{ \t\n\r}'))
            if (result !== '[{"kind":"{"},{"kind":"nl"},{"kind":"}"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('""'))
            if (result !== '[{"kind":"string","value":""},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"value"'))
            if (result !== '[{"kind":"string","value":"value"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"value'))
            if (result !== '[{"kind":"error","message":"\\" are missing"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"value1" "value2"'))
            if (result !== '[{"kind":"string","value":"value1"},{"kind":"ws"},{"kind":"string","value":"value2"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"'))
            if (result !== '[{"kind":"error","message":"\\" are missing"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\\\"'))
            if (result !== '[{"kind":"string","value":"\\\\"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\""'))
            if (result !== '[{"kind":"string","value":"\\""},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\/"'))
            if (result !== '[{"kind":"string","value":"/"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\x"'))
            if (result !== '[{"kind":"error","message":"unescaped character"},{"kind":"string","value":"x"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\'))
            if (result !== '[{"kind":"error","message":"\\" are missing"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\r"'))
            if (result !== '[{"kind":"error","message":"unterminated string literal"},{"kind":"nl"},{"kind":"error","message":"\\" are missing"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\n null'))
            if (result !== '[{"kind":"error","message":"unterminated string literal"},{"kind":"nl"},{"kind":"null"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\b\\f\\n\\r\\t"'))
            if (result !== '[{"kind":"string","value":"\\b\\f\\n\\r\\t"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\u1234"'))
            if (result !== '[{"kind":"string","value":"ሴ"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\uaBcDEeFf"'))
            if (result !== '[{"kind":"string","value":"ꯍEeFf"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\uEeFg"'))
            if (result !== '[{"kind":"error","message":"invalid hex value"},{"kind":"string","value":"g"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0'))
            if (result !== '[{"bf":[0n,0],"kind":"number","value":"0"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('[0]'))
            if (result !== '[{"kind":"["},{"bf":[0n,0],"kind":"number","value":"0"},{"kind":"]"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('00'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0abc,'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"abc"},{"kind":","},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('123456789012345678901234567890'))
            if (result !== '[{"bf":[123456789012345678901234567890n,0],"kind":"number","value":"123456789012345678901234567890"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{90}'))
            if (result !== '[{"kind":"{"},{"bf":[90n,0],"kind":"number","value":"90"},{"kind":"}"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('1 2'))
            if (result !== '[{"bf":[1n,0],"kind":"number","value":"1"},{"kind":"ws"},{"bf":[2n,0],"kind":"number","value":"2"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0. 2'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"ws"},{"bf":[2n,0],"kind":"number","value":"2"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('10-0'))
            if (result !== '[{"bf":[10n,0],"kind":"number","value":"10"},{"kind":"-"},{"bf":[0n,0],"kind":"number","value":"0"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('9a:'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"a"},{"kind":":"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-10'))
            if (result !== '[{"kind":"-"},{"bf":[10n,0],"kind":"number","value":"10"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0'))
            if (result !== '[{"kind":"-"},{"bf":[0n,0],"kind":"number","value":"0"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-00'))
            if (result !== '[{"kind":"-"},{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-.123'))
            if (result !== '[{"kind":"-"},{"kind":"."},{"bf":[123n,0],"kind":"number","value":"123"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0.01'))
            if (result !== '[{"bf":[1n,-2],"kind":"number","value":"0.01"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0.9'))
            if (result !== '[{"kind":"-"},{"bf":[9n,-1],"kind":"number","value":"0.9"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0.'))
            if (result !== '[{"kind":"-"},{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0.]'))
            if (result !== '[{"kind":"-"},{"kind":"error","message":"invalid number"},{"kind":"]"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('12.34'))
            if (result !== '[{"bf":[1234n,-2],"kind":"number","value":"12.34"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12.00'))
            if (result !== '[{"kind":"-"},{"bf":[1200n,-2],"kind":"number","value":"12.00"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12.'))
            if (result !== '[{"kind":"-"},{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('12.]'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"]"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e1'))
            if (result !== '[{"bf":[0n,1],"kind":"number","value":"0e1"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e+2'))
            if (result !== '[{"bf":[0n,2],"kind":"number","value":"0e+2"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e-0'))
            if (result !== '[{"bf":[0n,0],"kind":"number","value":"0e-0"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('12e0000'))
            if (result !== '[{"bf":[12n,0],"kind":"number","value":"12e0000"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12e-0001'))
            if (result !== '[{"kind":"-"},{"bf":[12n,-1],"kind":"number","value":"12e-0001"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12.34e1234'))
            if (result !== '[{"kind":"-"},{"bf":[1234n,1232],"kind":"number","value":"12.34e1234"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e-'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('ABCdef1234567890$_'))
            if (result !== '[{"kind":"id","value":"ABCdef1234567890$_"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{ABCdef1234567890$_}'))
            if (result !== '[{"kind":"{"},{"kind":"id","value":"ABCdef1234567890$_"},{"kind":"}"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('123 _123'))
            if (result !== '[{"bf":[123n,0],"kind":"number","value":"123"},{"kind":"ws"},{"kind":"id","value":"_123"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('123 $123'))
            if (result !== '[{"bf":[123n,0],"kind":"number","value":"123"},{"kind":"ws"},{"kind":"id","value":"$123"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('123_123'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"_123"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('123$123'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"$123"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('1234567890n'))
            if (result !== '[{"kind":"bigint","value":1234567890n},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0n'))
            if (result !== '[{"kind":"bigint","value":0n},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('[-1234567890n]'))
            if (result !== '[{"kind":"["},{"kind":"-"},{"kind":"bigint","value":1234567890n},{"kind":"]"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('123.456n'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"n"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('123e456n'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"n"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('1234567890na'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"a"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('1234567890nn'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"n"},{"kind":"eof"}]') { throw result }
        },
    ],
    operators:
    [
        () => {
            const result = stringify(tokenizeString('='))
            if (result !== '[{"kind":"="},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('=a'))
            if (result !== '[{"kind":"="},{"kind":"id","value":"a"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-'))
            if (result !== '[{"kind":"-"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('1*2'))
            if (result !== '[{"bf":[1n,0],"kind":"number","value":"1"},{"kind":"*"},{"bf":[2n,0],"kind":"number","value":"2"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('( )'))
            if (result !== '[{"kind":"("},{"kind":"ws"},{"kind":")"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('== != === !== > >= < <='))
            if (result !== '[{"kind":"=="},{"kind":"ws"},{"kind":"!="},{"kind":"ws"},{"kind":"==="},{"kind":"ws"},{"kind":"!=="},{"kind":"ws"},{"kind":">"},{"kind":"ws"},{"kind":">="},{"kind":"ws"},{"kind":"<"},{"kind":"ws"},{"kind":"<="},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('+ - * / % ++ -- **'))
            if (result !== '[{"kind":"+"},{"kind":"ws"},{"kind":"-"},{"kind":"ws"},{"kind":"*"},{"kind":"ws"},{"kind":"/"},{"kind":"ws"},{"kind":"%"},{"kind":"ws"},{"kind":"++"},{"kind":"ws"},{"kind":"--"},{"kind":"ws"},{"kind":"**"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('= += -= *= /= %= **='))
            if (result !== '[{"kind":"="},{"kind":"ws"},{"kind":"+="},{"kind":"ws"},{"kind":"-="},{"kind":"ws"},{"kind":"*="},{"kind":"ws"},{"kind":"/="},{"kind":"ws"},{"kind":"%="},{"kind":"ws"},{"kind":"**="},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('& | ^ ~ << >> >>>'))
            if (result !== '[{"kind":"&"},{"kind":"ws"},{"kind":"|"},{"kind":"ws"},{"kind":"^"},{"kind":"ws"},{"kind":"~"},{"kind":"ws"},{"kind":"<<"},{"kind":"ws"},{"kind":">>"},{"kind":"ws"},{"kind":">>>"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('&= |= ^= <<= >>= >>>='))
            if (result !== '[{"kind":"&="},{"kind":"ws"},{"kind":"|="},{"kind":"ws"},{"kind":"^="},{"kind":"ws"},{"kind":"<<="},{"kind":"ws"},{"kind":">>="},{"kind":"ws"},{"kind":">>>="},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('&& || ! ??'))
            if (result !== '[{"kind":"&&"},{"kind":"ws"},{"kind":"||"},{"kind":"ws"},{"kind":"!"},{"kind":"ws"},{"kind":"??"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('&&= ||= ??='))
            if (result !== '[{"kind":"&&="},{"kind":"ws"},{"kind":"||="},{"kind":"ws"},{"kind":"??="},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('? ?. . =>'))
            if (result !== '[{"kind":"?"},{"kind":"ws"},{"kind":"?."},{"kind":"ws"},{"kind":"."},{"kind":"ws"},{"kind":"=>"},{"kind":"eof"}]') { throw result }
        },
    ],
    ws: [
        () => {
            const result = stringify(tokenizeString(' '))
            if (result !== '[{"kind":"ws"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('\t'))
            if (result !== '[{"kind":"ws"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString(' \t'))
            if (result !== '[{"kind":"ws"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('\n'))
            if (result !== '[{"kind":"nl"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('\r'))
            if (result !== '[{"kind":"nl"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString(' \t\n\r '))
            if (result !== '[{"kind":"nl"},{"kind":"eof"}]') { throw result }
        },
    ],
    id: [
        () => {
            const result = stringify(tokenizeString('err'))
            if (result !== '[{"kind":"id","value":"err"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{e}'))
            if (result !== '[{"kind":"{"},{"kind":"id","value":"e"},{"kind":"}"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('tru'))
            if (result !== '[{"kind":"id","value":"tru"},{"kind":"eof"}]') { throw result }
        },
    ],
    keywords: [
        () => {
            const result = stringify(tokenizeString('true'))
            if (result !== '[{"kind":"true"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('false'))
            if (result !== '[{"kind":"false"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('null'))
            if (result !== '[{"kind":"null"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('undefined'))
            if (result !== '[{"kind":"undefined"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('[null]'))
            if (result !== '[{"kind":"["},{"kind":"null"},{"kind":"]"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('arguments'))
            if (result !== '[{"kind":"arguments"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('await'))
            if (result !== '[{"kind":"await"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('break'))
            if (result !== '[{"kind":"break"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('case'))
            if (result !== '[{"kind":"case"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('catch'))
            if (result !== '[{"kind":"catch"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('class'))
            if (result !== '[{"kind":"class"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('const'))
            if (result !== '[{"kind":"const"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('continue'))
            if (result !== '[{"kind":"continue"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('debugger'))
            if (result !== '[{"kind":"debugger"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('default'))
            if (result !== '[{"kind":"default"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('delete'))
            if (result !== '[{"kind":"delete"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('do'))
            if (result !== '[{"kind":"do"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('else'))
            if (result !== '[{"kind":"else"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('enum'))
            if (result !== '[{"kind":"enum"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('eval'))
            if (result !== '[{"kind":"eval"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('export'))
            if (result !== '[{"kind":"export"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('extends'))
            if (result !== '[{"kind":"extends"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('finally'))
            if (result !== '[{"kind":"finally"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('for'))
            if (result !== '[{"kind":"for"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('function'))
            if (result !== '[{"kind":"function"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('if'))
            if (result !== '[{"kind":"if"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('implements'))
            if (result !== '[{"kind":"implements"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('import'))
            if (result !== '[{"kind":"import"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('in'))
            if (result !== '[{"kind":"in"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('instanceof'))
            if (result !== '[{"kind":"instanceof"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('interface'))
            if (result !== '[{"kind":"interface"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('let'))
            if (result !== '[{"kind":"let"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('new'))
            if (result !== '[{"kind":"new"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('package'))
            if (result !== '[{"kind":"package"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('private'))
            if (result !== '[{"kind":"private"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('protected'))
            if (result !== '[{"kind":"protected"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('public'))
            if (result !== '[{"kind":"public"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('return'))
            if (result !== '[{"kind":"return"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('static'))
            if (result !== '[{"kind":"static"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('super'))
            if (result !== '[{"kind":"super"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('switch'))
            if (result !== '[{"kind":"switch"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('this'))
            if (result !== '[{"kind":"this"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('throw'))
            if (result !== '[{"kind":"throw"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('try'))
            if (result !== '[{"kind":"try"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('typeof'))
            if (result !== '[{"kind":"typeof"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('var'))
            if (result !== '[{"kind":"var"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('void'))
            if (result !== '[{"kind":"void"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('while'))
            if (result !== '[{"kind":"while"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('with'))
            if (result !== '[{"kind":"with"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('yield'))
            if (result !== '[{"kind":"yield"},{"kind":"eof"}]') { throw result }
        },
    ],
    comments: [
        () => {
            const result = stringify(tokenizeString('//singleline comment'))
            if (result !== '[{"kind":"//","value":"singleline comment"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('true//singleline comment\nfalse'))
            if (result !== '[{"kind":"true"},{"kind":"//","value":"singleline comment"},{"kind":"nl"},{"kind":"false"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('/* multiline comment */'))
            if (result !== '[{"kind":"/*","value":" multiline comment "},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('/* multiline comment *'))
            if (result !== '[{"kind":"error","message":"*/ expected"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('/* multiline comment '))
            if (result !== '[{"kind":"error","message":"*/ expected"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('/* multiline comment \n * **/'))
            if (result !== '[{"kind":"/*","value":" multiline comment \\n * *"},{"kind":"nl"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('/* multiline comment *\n * **/'))
            if (result !== '[{"kind":"/*","value":" multiline comment *\\n * *"},{"kind":"nl"},{"kind":"eof"}]') { throw result }
        },
    ],
    metadata: [
        () => {
            const result = stringify(tokenizeStringWithMetadata('[\ntrue, false\n]'))
            if (result !== '[{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"["}},{"metadata":{"column":1,"line":2,"path":""},"token":{"kind":"nl"}},{"metadata":{"column":5,"line":2,"path":""},"token":{"kind":"true"}},{"metadata":{"column":6,"line":2,"path":""},"token":{"kind":","}},{"metadata":{"column":7,"line":2,"path":""},"token":{"kind":"ws"}},{"metadata":{"column":12,"line":2,"path":""},"token":{"kind":"false"}},{"metadata":{"column":1,"line":3,"path":""},"token":{"kind":"nl"}},{"metadata":{"column":2,"line":3,"path":""},"token":{"kind":"]"}},{"metadata":{"column":2,"line":3,"path":""},"token":{"kind":"eof"}}]') { throw result }
        },
    ]
}
