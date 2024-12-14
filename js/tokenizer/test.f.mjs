import * as tokenizer from './module.f.mjs'
import * as list from '../../types/list/module.f.mjs'
const { toArray } = list
import * as djs from '../../djs/module.f.mjs'
import * as o from '../../types/object/module.f.mjs'
const { sort } = o
import * as encoding from '../../text/utf16/module.f.mjs'

/** @type {(s: string) => readonly tokenizer.JsToken[]} */
const tokenizeString = s => toArray(tokenizer.tokenize(encoding.stringToList(s)))

const stringify = djs.stringify(sort)

export default {
    djs: [
        () => {
            const result = tokenizeString('')
            if (result.length !== 0) { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{'))
            if (result !== '[{"kind":"{"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('}'))
            if (result !== '[{"kind":"}"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString(':'))
            if (result !== '[{"kind":":"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString(','))
            if (result !== '[{"kind":","}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('['))
            if (result !== '[{"kind":"["}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString(']'))
            if (result !== '[{"kind":"]"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('ᄑ'))
            if (result !== '[{"kind":"error","message":"unexpected character"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{ \t\n\r}'))
            if (result !== '[{"kind":"{"},{"kind":"nl"},{"kind":"}"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('""'))
            if (result !== '[{"kind":"string","value":""}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"value"'))
            if (result !== '[{"kind":"string","value":"value"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"value'))
            if (result !== '[{"kind":"error","message":"\\" are missing"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"value1" "value2"'))
            if (result !== '[{"kind":"string","value":"value1"},{"kind":"ws"},{"kind":"string","value":"value2"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"'))
            if (result !== '[{"kind":"error","message":"\\" are missing"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\\\"'))
            if (result !== '[{"kind":"string","value":"\\\\"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\""'))
            if (result !== '[{"kind":"string","value":"\\""}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\/"'))
            if (result !== '[{"kind":"string","value":"/"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\x"'))
            if (result !== '[{"kind":"error","message":"unescaped character"},{"kind":"string","value":"x"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\'))
            if (result !== '[{"kind":"error","message":"\\" are missing"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\r"'))
            if (result !== '[{"kind":"error","message":"unterminated string literal"},{"kind":"nl"},{"kind":"error","message":"\\" are missing"}]') { throw result }            
        },
        () => {
            const result = stringify(tokenizeString('"\n null'))
            if (result !== '[{"kind":"error","message":"unterminated string literal"},{"kind":"nl"},{"kind":"null"}]') { throw result }            
        },
        () => {
            const result = stringify(tokenizeString('"\\b\\f\\n\\r\\t"'))
            if (result !== '[{"kind":"string","value":"\\b\\f\\n\\r\\t"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\u1234"'))
            if (result !== '[{"kind":"string","value":"ሴ"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\uaBcDEeFf"'))
            if (result !== '[{"kind":"string","value":"ꯍEeFf"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\uEeFg"'))
            if (result !== '[{"kind":"error","message":"invalid hex value"},{"kind":"string","value":"g"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0'))
            if (result !== '[{"bf":[0n,0],"kind":"number","value":"0"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('[0]'))
            if (result !== '[{"kind":"["},{"bf":[0n,0],"kind":"number","value":"0"},{"kind":"]"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('00'))
            if (result !== '[{"kind":"error","message":"invalid number"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0abc,'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"abc"},{"kind":","}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('123456789012345678901234567890'))
            if (result !== '[{"bf":[123456789012345678901234567890n,0],"kind":"number","value":"123456789012345678901234567890"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{90}'))
            if (result !== '[{"kind":"{"},{"bf":[90n,0],"kind":"number","value":"90"},{"kind":"}"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('1 2'))
            if (result !== '[{"bf":[1n,0],"kind":"number","value":"1"},{"kind":"ws"},{"bf":[2n,0],"kind":"number","value":"2"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0. 2'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"ws"},{"bf":[2n,0],"kind":"number","value":"2"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('10-0'))
            if (result !== '[{"bf":[10n,0],"kind":"number","value":"10"},{"kind":"-"},{"bf":[0n,0],"kind":"number","value":"0"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('9a:'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"a"},{"kind":":"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-10'))
            if (result !== '[{"kind":"-"},{"bf":[10n,0],"kind":"number","value":"10"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0'))
            if (result !== '[{"kind":"-"},{"bf":[0n,0],"kind":"number","value":"0"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-00'))
            if (result !== '[{"kind":"-"},{"kind":"error","message":"invalid number"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-.123'))
            if (result !== '[{"kind":"-"},{"kind":"."},{"bf":[123n,0],"kind":"number","value":"123"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0.01'))
            if (result !== '[{"bf":[1n,-2],"kind":"number","value":"0.01"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0.9'))
            if (result !== '[{"kind":"-"},{"bf":[9n,-1],"kind":"number","value":"0.9"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0.'))
            if (result !== '[{"kind":"-"},{"kind":"error","message":"invalid number"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0.]'))
            if (result !== '[{"kind":"-"},{"kind":"error","message":"invalid number"},{"kind":"]"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('12.34'))
            if (result !== '[{"bf":[1234n,-2],"kind":"number","value":"12.34"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12.00'))
            if (result !== '[{"kind":"-"},{"bf":[1200n,-2],"kind":"number","value":"12.00"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12.'))
            if (result !== '[{"kind":"-"},{"kind":"error","message":"invalid number"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('12.]'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"]"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e1'))
            if (result !== '[{"bf":[0n,1],"kind":"number","value":"0e1"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e+2'))
            if (result !== '[{"bf":[0n,2],"kind":"number","value":"0e+2"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e-0'))
            if (result !== '[{"bf":[0n,0],"kind":"number","value":"0e-0"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('12e0000'))
            if (result !== '[{"bf":[12n,0],"kind":"number","value":"12e0000"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12e-0001'))
            if (result !== '[{"kind":"-"},{"bf":[12n,-1],"kind":"number","value":"12e-0001"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12.34e1234'))
            if (result !== '[{"kind":"-"},{"bf":[1234n,1232],"kind":"number","value":"12.34e1234"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e'))
            if (result !== '[{"kind":"error","message":"invalid number"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e-'))
            if (result !== '[{"kind":"error","message":"invalid number"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('ABCdef1234567890$_'))
            if (result !== '[{"kind":"id","value":"ABCdef1234567890$_"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{ABCdef1234567890$_}'))
            if (result !== '[{"kind":"{"},{"kind":"id","value":"ABCdef1234567890$_"},{"kind":"}"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('123 _123'))
            if (result !== '[{"bf":[123n,0],"kind":"number","value":"123"},{"kind":"ws"},{"kind":"id","value":"_123"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('123 $123'))
            if (result !== '[{"bf":[123n,0],"kind":"number","value":"123"},{"kind":"ws"},{"kind":"id","value":"$123"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('123_123'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"_123"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('123$123'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"$123"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('1234567890n'))
            if (result !== '[{"kind":"bigint","value":1234567890n}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0n'))
            if (result !== '[{"kind":"bigint","value":0n}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('[-1234567890n]'))
            if (result !== '[{"kind":"["},{"kind":"-"},{"kind":"bigint","value":1234567890n},{"kind":"]"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('123.456n'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"n"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('123e456n'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"n"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('1234567890na'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"a"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('1234567890nn'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"n"}]') { throw result }
        },
    ],
    operators:
    [
        () => {
            const result = stringify(tokenizeString('='))
            if (result !== '[{"kind":"="}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('=a'))
            if (result !== '[{"kind":"="},{"kind":"id","value":"a"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-'))
            if (result !== '[{"kind":"-"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('1*2'))
            if (result !== '[{"bf":[1n,0],"kind":"number","value":"1"},{"kind":"*"},{"bf":[2n,0],"kind":"number","value":"2"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('( )'))
            if (result !== '[{"kind":"("},{"kind":"ws"},{"kind":")"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('== != === !== > >= < <='))
            if (result !== '[{"kind":"=="},{"kind":"ws"},{"kind":"!="},{"kind":"ws"},{"kind":"==="},{"kind":"ws"},{"kind":"!=="},{"kind":"ws"},{"kind":">"},{"kind":"ws"},{"kind":">="},{"kind":"ws"},{"kind":"<"},{"kind":"ws"},{"kind":"<="}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('+ - * / % ++ -- **'))
            if (result !== '[{"kind":"+"},{"kind":"ws"},{"kind":"-"},{"kind":"ws"},{"kind":"*"},{"kind":"ws"},{"kind":"/"},{"kind":"ws"},{"kind":"%"},{"kind":"ws"},{"kind":"++"},{"kind":"ws"},{"kind":"--"},{"kind":"ws"},{"kind":"**"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('= += -= *= /= %= **='))
            if (result !== '[{"kind":"="},{"kind":"ws"},{"kind":"+="},{"kind":"ws"},{"kind":"-="},{"kind":"ws"},{"kind":"*="},{"kind":"ws"},{"kind":"/="},{"kind":"ws"},{"kind":"%="},{"kind":"ws"},{"kind":"**="}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('& | ^ ~ << >> >>>'))
            if (result !== '[{"kind":"&"},{"kind":"ws"},{"kind":"|"},{"kind":"ws"},{"kind":"^"},{"kind":"ws"},{"kind":"~"},{"kind":"ws"},{"kind":"<<"},{"kind":"ws"},{"kind":">>"},{"kind":"ws"},{"kind":">>>"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('&= |= ^= <<= >>= >>>='))
            if (result !== '[{"kind":"&="},{"kind":"ws"},{"kind":"|="},{"kind":"ws"},{"kind":"^="},{"kind":"ws"},{"kind":"<<="},{"kind":"ws"},{"kind":">>="},{"kind":"ws"},{"kind":">>>="}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('&& || ! ??'))
            if (result !== '[{"kind":"&&"},{"kind":"ws"},{"kind":"||"},{"kind":"ws"},{"kind":"!"},{"kind":"ws"},{"kind":"??"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('&&= ||= ??='))
            if (result !== '[{"kind":"&&="},{"kind":"ws"},{"kind":"||="},{"kind":"ws"},{"kind":"??="}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('? ?. . =>'))
            if (result !== '[{"kind":"?"},{"kind":"ws"},{"kind":"?."},{"kind":"ws"},{"kind":"."},{"kind":"ws"},{"kind":"=>"}]') { throw result }
        },
    ],
    ws: [
        () => {
            const result = stringify(tokenizeString(' '))
            if (result !== '[{"kind":"ws"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('\t'))
            if (result !== '[{"kind":"ws"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString(' \t'))
            if (result !== '[{"kind":"ws"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('\n'))
            if (result !== '[{"kind":"nl"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('\r'))
            if (result !== '[{"kind":"nl"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString(' \t\n\r '))
            if (result !== '[{"kind":"nl"}]') { throw result }
        },
    ],
    id: [
        () => {
            const result = stringify(tokenizeString('err'))
            if (result !== '[{"kind":"id","value":"err"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{e}'))
            if (result !== '[{"kind":"{"},{"kind":"id","value":"e"},{"kind":"}"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('tru'))
            if (result !== '[{"kind":"id","value":"tru"}]') { throw result }
        },
    ],
    keywords: [
        () => {
            const result = stringify(tokenizeString('true'))
            if (result !== '[{"kind":"true"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('false'))
            if (result !== '[{"kind":"false"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('null'))
            if (result !== '[{"kind":"null"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('undefined'))
            if (result !== '[{"kind":"undefined"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('[null]'))
            if (result !== '[{"kind":"["},{"kind":"null"},{"kind":"]"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('arguments'))
            if (result !== '[{"kind":"arguments"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('await'))
            if (result !== '[{"kind":"await"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('break'))
            if (result !== '[{"kind":"break"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('case'))
            if (result !== '[{"kind":"case"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('catch'))
            if (result !== '[{"kind":"catch"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('class'))
            if (result !== '[{"kind":"class"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('const'))
            if (result !== '[{"kind":"const"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('continue'))
            if (result !== '[{"kind":"continue"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('debugger'))
            if (result !== '[{"kind":"debugger"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('default'))
            if (result !== '[{"kind":"default"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('delete'))
            if (result !== '[{"kind":"delete"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('do'))
            if (result !== '[{"kind":"do"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('else'))
            if (result !== '[{"kind":"else"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('enum'))
            if (result !== '[{"kind":"enum"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('eval'))
            if (result !== '[{"kind":"eval"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('export'))
            if (result !== '[{"kind":"export"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('extends'))
            if (result !== '[{"kind":"extends"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('finally'))
            if (result !== '[{"kind":"finally"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('for'))
            if (result !== '[{"kind":"for"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('function'))
            if (result !== '[{"kind":"function"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('if'))
            if (result !== '[{"kind":"if"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('implements'))
            if (result !== '[{"kind":"implements"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('import'))
            if (result !== '[{"kind":"import"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('in'))
            if (result !== '[{"kind":"in"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('instanceof'))
            if (result !== '[{"kind":"instanceof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('interface'))
            if (result !== '[{"kind":"interface"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('let'))
            if (result !== '[{"kind":"let"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('new'))
            if (result !== '[{"kind":"new"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('package'))
            if (result !== '[{"kind":"package"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('private'))
            if (result !== '[{"kind":"private"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('protected'))
            if (result !== '[{"kind":"protected"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('public'))
            if (result !== '[{"kind":"public"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('return'))
            if (result !== '[{"kind":"return"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('static'))
            if (result !== '[{"kind":"static"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('super'))
            if (result !== '[{"kind":"super"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('switch'))
            if (result !== '[{"kind":"switch"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('this'))
            if (result !== '[{"kind":"this"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('throw'))
            if (result !== '[{"kind":"throw"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('try'))
            if (result !== '[{"kind":"try"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('typeof'))
            if (result !== '[{"kind":"typeof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('var'))
            if (result !== '[{"kind":"var"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('void'))
            if (result !== '[{"kind":"void"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('while'))
            if (result !== '[{"kind":"while"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('with'))
            if (result !== '[{"kind":"with"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('yield'))
            if (result !== '[{"kind":"yield"}]') { throw result }
        },
    ],
    comments: [
        () => {
            const result = stringify(tokenizeString('//singleline comment'))
            if (result !== '[{"kind":"//","value":"singleline comment"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('true//singleline comment\nfalse'))
            if (result !== '[{"kind":"true"},{"kind":"//","value":"singleline comment"},{"kind":"nl"},{"kind":"false"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('/* multiline comment */'))
            if (result !== '[{"kind":"/*","value":" multiline comment "}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('/* multiline comment *'))
            if (result !== '[{"kind":"error","message":"*/ expected"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('/* multiline comment '))
            if (result !== '[{"kind":"error","message":"*/ expected"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('/* multiline comment \n * **/'))
            if (result !== '[{"kind":"/*","value":" multiline comment \\n * *"},{"kind":"nl"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('/* multiline comment *\n * **/'))
            if (result !== '[{"kind":"/*","value":" multiline comment *\\n * *"},{"kind":"nl"}]') { throw result }
        },
    ]
}