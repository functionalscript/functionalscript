import * as tokenizer from './module.f.ts'
import * as list from '../../types/list/module.f.ts'
const { toArray } = list
import * as serializer from '../serializer/module.f.ts'
import * as o from '../../types/object/module.f.ts'
const { sort } = o
import * as encoding from '../../text/utf16/module.f.ts'

const tokenizeString
    : (s: string) => readonly tokenizer.DjsToken[]
    = s => toArray(list.map(withoutMetada)(tokenizer.tokenize(encoding.stringToList(s))('')))

const stringify = serializer.stringifyAsTree(sort)

const withoutMetada
    : (tokenWithMetada: tokenizer.DjsTokenWithMetadata) => tokenizer.DjsToken
    = tokenWithMetada => { return tokenWithMetada.token }

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
            if (result !== '[{"bf":[10n,0],"kind":"number","value":"10"},{"bf":[0n,0],"kind":"number","value":"-0"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('9a:'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"a"},{"kind":":"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-10'))
            if (result !== '[{"bf":[-10n,0],"kind":"number","value":"-10"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-'))
            if (result !== '[{"kind":"error","message":"invalid token"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('--'))
            if (result !== '[{"kind":"error","message":"invalid token"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('---'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"error","message":"invalid token"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0'))
            if (result !== '[{"bf":[0n,0],"kind":"number","value":"-0"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-00'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"error","message":"invalid number"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-.123'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"."},{"bf":[123n,0],"kind":"number","value":"123"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0.01'))
            if (result !== '[{"bf":[1n,-2],"kind":"number","value":"0.01"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0.9'))
            if (result !== '[{"bf":[-9n,-1],"kind":"number","value":"-0.9"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0.'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"error","message":"invalid number"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0.]'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"error","message":"invalid number"},{"kind":"]"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('12.34'))
            if (result !== '[{"bf":[1234n,-2],"kind":"number","value":"12.34"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12.00'))
            if (result !== '[{"bf":[-1200n,-2],"kind":"number","value":"-12.00"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12.'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"error","message":"invalid number"}]') { throw result }
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
            if (result !== '[{"bf":[-12n,-1],"kind":"number","value":"-12e-0001"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12.34e1234'))
            if (result !== '[{"bf":[-1234n,1232],"kind":"number","value":"-12.34e1234"}]') { throw result }
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
            if (result !== '[{"kind":"["},{"kind":"bigint","value":-1234567890n},{"kind":"]"}]') { throw result }
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
        () => {
            const result = stringify(tokenizeString('break'))
            if (result !== '[{"kind":"id","value":"break"}]') { throw result }
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
