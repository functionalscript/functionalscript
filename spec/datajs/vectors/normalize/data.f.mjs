const $n0 = [0];
const $n1 = {};
const $n2 = [0];
const $n3 = [[]];
const $n4 = [0];
const $n5 = [$n4];
const $n6 = {};
const $n7 = {"x": $n6};
const $n8 = [0];
const $n9 = {"x": $n8};
const $n10 = {};
const $n11 = [$n10];
const $n12 = [0];
const $n13 = {};
const $n14 = [0];
const $n15 = {};
const $n16 = [0];
const $n17 = {};
const $n18 = {};
const $n19 = {};
const $n20 = {};
const $n21 = {};
const $n22 = {};
const $n23 = {};
const $n24 = {};
const $n25 = {};
const $n26 = {};
const $n27 = {};
const $n28 = {};
const $s0 = [0];
const $s1 = [1, 2];
export default [
    {"id": "norm-string-escape-quote", "class": "string/escape/quote", "input": "\"", "text": "export default \"\\\"\";"},
    {"id": "norm-key-escape-quote", "class": "key/string/escape/quote", "input": {"\"": 0}, "text": "export default {\"\\\"\":0};"},
    {"id": "norm-string-escape-backslash", "class": "string/escape/backslash", "input": "\\", "text": "export default \"\\\\\";"},
    {"id": "norm-key-escape-backslash", "class": "key/string/escape/backslash", "input": {"\\": 0}, "text": "export default {\"\\\\\":0};"},
    {"id": "norm-string-escape-b", "class": "string/escape/b", "input": "\u0008", "text": "export default \"\\b\";"},
    {"id": "norm-key-escape-b", "class": "key/string/escape/b", "input": {"\u0008": 0}, "text": "export default {\"\\b\":0};"},
    {"id": "norm-string-escape-t", "class": "string/escape/t", "input": "\u0009", "text": "export default \"\\t\";"},
    {"id": "norm-key-escape-t", "class": "key/string/escape/t", "input": {"\u0009": 0}, "text": "export default {\"\\t\":0};"},
    {"id": "norm-string-escape-n", "class": "string/escape/n", "input": "\u000a", "text": "export default \"\\n\";"},
    {"id": "norm-key-escape-n", "class": "key/string/escape/n", "input": {"\u000a": 0}, "text": "export default {\"\\n\":0};"},
    {"id": "norm-string-escape-f", "class": "string/escape/f", "input": "\u000c", "text": "export default \"\\f\";"},
    {"id": "norm-key-escape-f", "class": "key/string/escape/f", "input": {"\u000c": 0}, "text": "export default {\"\\f\":0};"},
    {"id": "norm-string-escape-r", "class": "string/escape/r", "input": "\u000d", "text": "export default \"\\r\";"},
    {"id": "norm-key-escape-r", "class": "key/string/escape/r", "input": {"\u000d": 0}, "text": "export default {\"\\r\":0};"},
    {"id": "norm-string-escape-u00-0000", "class": "string/escape/u00/0000", "input": "\u0000", "text": "export default \"\\u0000\";"},
    {"id": "norm-key-escape-u00-0000", "class": "key/string/escape/u00/0000", "input": {"\u0000": 0}, "text": "export default {\"\\u0000\":0};"},
    {"id": "norm-string-escape-u00-0007", "class": "string/escape/u00/0007", "input": "\u0007", "text": "export default \"\\u0007\";"},
    {"id": "norm-key-escape-u00-0007", "class": "key/string/escape/u00/0007", "input": {"\u0007": 0}, "text": "export default {\"\\u0007\":0};"},
    {"id": "norm-string-escape-u00-000b", "class": "string/escape/u00/000b", "input": "\u000b", "text": "export default \"\\u000b\";"},
    {"id": "norm-key-escape-u00-000b", "class": "key/string/escape/u00/000b", "input": {"\u000b": 0}, "text": "export default {\"\\u000b\":0};"},
    {"id": "norm-string-escape-u00-000e", "class": "string/escape/u00/000e", "input": "\u000e", "text": "export default \"\\u000e\";"},
    {"id": "norm-key-escape-u00-000e", "class": "key/string/escape/u00/000e", "input": {"\u000e": 0}, "text": "export default {\"\\u000e\":0};"},
    {"id": "norm-string-escape-u00-000f", "class": "string/escape/u00/000f", "input": "\u000f", "text": "export default \"\\u000f\";"},
    {"id": "norm-key-escape-u00-000f", "class": "key/string/escape/u00/000f", "input": {"\u000f": 0}, "text": "export default {\"\\u000f\":0};"},
    {"id": "norm-string-escape-u00-0010", "class": "string/escape/u00/0010", "input": "\u0010", "text": "export default \"\\u0010\";"},
    {"id": "norm-key-escape-u00-0010", "class": "key/string/escape/u00/0010", "input": {"\u0010": 0}, "text": "export default {\"\\u0010\":0};"},
    {"id": "norm-string-escape-u00-0019", "class": "string/escape/u00/0019", "input": "\u0019", "text": "export default \"\\u0019\";"},
    {"id": "norm-key-escape-u00-0019", "class": "key/string/escape/u00/0019", "input": {"\u0019": 0}, "text": "export default {\"\\u0019\":0};"},
    {"id": "norm-string-escape-u00-001a", "class": "string/escape/u00/001a", "input": "\u001a", "text": "export default \"\\u001a\";"},
    {"id": "norm-key-escape-u00-001a", "class": "key/string/escape/u00/001a", "input": {"\u001a": 0}, "text": "export default {\"\\u001a\":0};"},
    {"id": "norm-string-escape-u00-001f", "class": "string/escape/u00/001f", "input": "\u001f", "text": "export default \"\\u001f\";"},
    {"id": "norm-key-escape-u00-001f", "class": "key/string/escape/u00/001f", "input": {"\u001f": 0}, "text": "export default {\"\\u001f\":0};"},
    {"id": "norm-string-surrogate-lone-d800", "class": "string/surrogate/lone/d800", "input": "\ud800", "text": "export default \"\\ud800\";"},
    {"id": "norm-key-surrogate-lone-d800", "class": "key/string/surrogate/lone/d800", "input": {"\ud800": 0}, "text": "export default {\"\\ud800\":0};"},
    {"id": "norm-string-surrogate-lone-dbff", "class": "string/surrogate/lone/dbff", "input": "\udbff", "text": "export default \"\\udbff\";"},
    {"id": "norm-key-surrogate-lone-dbff", "class": "key/string/surrogate/lone/dbff", "input": {"\udbff": 0}, "text": "export default {\"\\udbff\":0};"},
    {"id": "norm-string-surrogate-lone-dc00", "class": "string/surrogate/lone/dc00", "input": "\udc00", "text": "export default \"\\udc00\";"},
    {"id": "norm-key-surrogate-lone-dc00", "class": "key/string/surrogate/lone/dc00", "input": {"\udc00": 0}, "text": "export default {\"\\udc00\":0};"},
    {"id": "norm-string-surrogate-lone-dfff", "class": "string/surrogate/lone/dfff", "input": "\udfff", "text": "export default \"\\udfff\";"},
    {"id": "norm-key-surrogate-lone-dfff", "class": "key/string/surrogate/lone/dfff", "input": {"\udfff": 0}, "text": "export default {\"\\udfff\":0};"},
    {"id": "norm-string-raw-slash", "class": "string/raw/slash", "input": "/", "text": "export default \"/\";"},
    {"id": "norm-key-raw-slash", "class": "key/string/raw/slash", "input": {"/": 0}, "text": "export default {\"/\":0};"},
    {"id": "norm-string-raw-0020", "class": "string/raw/range/0020-0021/low", "input": " ", "text": "export default \" \";"},
    {"id": "norm-key-raw-0020", "class": "key/string/raw/range/0020-0021/low", "input": {" ": 0}, "text": "export default {\" \":0};"},
    {"id": "norm-string-raw-0021", "class": "string/raw/range/0020-0021/high", "input": "!", "text": "export default \"!\";"},
    {"id": "norm-key-raw-0021", "class": "key/string/raw/range/0020-0021/high", "input": {"!": 0}, "text": "export default {\"!\":0};"},
    {"id": "norm-string-raw-0023", "class": "string/raw/range/0023-005b/low", "input": "#", "text": "export default \"#\";"},
    {"id": "norm-key-raw-0023", "class": "key/string/raw/range/0023-005b/low", "input": {"#": 0}, "text": "export default {\"#\":0};"},
    {"id": "norm-string-raw-005b", "class": "string/raw/range/0023-005b/high", "input": "[", "text": "export default \"[\";"},
    {"id": "norm-key-raw-005b", "class": "key/string/raw/range/0023-005b/high", "input": {"[": 0}, "text": "export default {\"[\":0};"},
    {"id": "norm-string-raw-005d", "class": "string/raw/range/005d-10ffff/low", "input": "]", "text": "export default \"]\";"},
    {"id": "norm-key-raw-005d", "class": "key/string/raw/range/005d-10ffff/low", "input": {"]": 0}, "text": "export default {\"]\":0};"},
    {"id": "norm-string-raw-007f", "class": "string/raw/007f", "input": "", "text": "export default \"\u007f\";"},
    {"id": "norm-key-raw-007f", "class": "key/string/raw/007f", "input": {"": 0}, "text": "export default {\"\u007f\":0};"},
    {"id": "norm-string-raw-d7ff", "class": "string/raw/surrogate-hole/d7ff", "input": "퟿", "text": "export default \"\ud7ff\";"},
    {"id": "norm-key-raw-d7ff", "class": "key/string/raw/surrogate-hole/d7ff", "input": {"퟿": 0}, "text": "export default {\"\ud7ff\":0};"},
    {"id": "norm-string-raw-e000", "class": "string/raw/surrogate-hole/e000", "input": "", "text": "export default \"\ue000\";"},
    {"id": "norm-key-raw-e000", "class": "key/string/raw/surrogate-hole/e000", "input": {"": 0}, "text": "export default {\"\ue000\":0};"},
    {"id": "norm-string-raw-ffff", "class": "string/raw/bmp/ffff", "input": "￿", "text": "export default \"\uffff\";"},
    {"id": "norm-key-raw-ffff", "class": "key/string/raw/bmp/ffff", "input": {"￿": 0}, "text": "export default {\"\uffff\":0};"},
    {"id": "norm-string-raw-10000", "class": "string/raw/astral/10000", "input": "𐀀", "text": "export default \"\ud800\udc00\";"},
    {"id": "norm-key-raw-10000", "class": "key/string/raw/astral/10000", "input": {"𐀀": 0}, "text": "export default {\"\ud800\udc00\":0};"},
    {"id": "norm-string-raw-10ffff", "class": "string/raw/range/005d-10ffff/high", "input": "􏿿", "text": "export default \"\udbff\udfff\";"},
    {"id": "norm-key-raw-10ffff", "class": "key/string/raw/range/005d-10ffff/high", "input": {"􏿿": 0}, "text": "export default {\"\udbff\udfff\":0};"},
    {"id": "norm-string-empty", "class": "string/empty", "input": "", "text": "export default \"\";"},
    {"id": "norm-key-empty", "class": "key/string/empty", "input": {"": 0}, "text": "export default {\"\":0};"},
    {"id": "norm-string-mixed", "class": "string/mixed", "input": "\u0009a\"é\udfff", "text": "export default \"\\ta\\\"\u00e9\\udfff\";"},
    {"id": "norm-key-mixed", "class": "key/string/mixed", "input": {"\u0009a\"é\udfff": 0}, "text": "export default {\"\\ta\\\"\u00e9\\udfff\":0};"},
    {"id": "norm-hoist-only-if-array", "class": "const/hoist/only-if/array", "input": [], "text": "export default [];"},
    {"id": "norm-hoist-only-if-object", "class": "const/hoist/only-if/object", "input": {}, "text": "export default {};"},
    {"id": "norm-shared-leaf", "class": "const/shared/leaf", "input": [1, 1], "text": "export default [1,1];"},
    {"id": "norm-shared-twice", "class": "const/shared/twice", "input": [$n0, $n0], "text": "const $0=[0];export default [$0,$0];"},
    {"id": "norm-shared-object", "class": "const/shared/object", "input": {"a": $n1, "b": $n1}, "text": "const $0={};export default {\"a\":$0,\"b\":$0};"},
    {"id": "norm-shared-mixed", "class": "const/shared/mixed", "input": [[$n2], {"x": $n2}], "text": "const $0=[0];export default [[$0],{\"x\":$0}];"},
    {"id": "norm-unshared-array-empty", "class": "array/unshared", "input": [[], []], "text": "export default [[],[]];"},
    {"id": "norm-hoist-occurrences", "class": "const/hoist/occurrences", "input": [$n3, $n3], "text": "const $0=[[]];export default [$0,$0];"},
    {"id": "norm-name-post-order-array-array", "class": "const/name/post-order/array/array", "input": [$n5, $n5, $n4], "text": "const $0=[0];const $1=[$0];export default [$1,$1,$0];"},
    {"id": "norm-name-post-order-object-object", "class": "const/name/post-order/object/object", "input": {"a": $n7, "b": $n7, "c": $n6}, "text": "const $0={};const $1={\"x\":$0};export default {\"a\":$1,\"b\":$1,\"c\":$0};"},
    {"id": "norm-name-post-order-object-array", "class": "const/name/post-order/object/array", "input": {"a": $n9, "b": $n9, "c": $n8}, "text": "const $0=[0];const $1={\"x\":$0};export default {\"a\":$1,\"b\":$1,\"c\":$0};"},
    {"id": "norm-name-post-order-array-object", "class": "const/name/post-order/array/object", "input": [$n11, $n11, $n10], "text": "const $0={};const $1=[$0];export default [$1,$1,$0];"},
    {"id": "norm-shared-two-nodes", "class": "const/shared/two-nodes", "input": [$n12, $n13, $n12, $n13], "text": "const $0=[0];const $1={};export default [$0,$1,$0,$1];"},
    {"id": "norm-shared-two-nodes-object", "class": "const/shared/two-nodes/object", "input": {"a": $n14, "b": $n15, "c": $n14, "d": $n15}, "text": "const $0=[0];const $1={};export default {\"a\":$0,\"b\":$1,\"c\":$0,\"d\":$1};"},
    {"id": "norm-shared-two-nodes-key-order", "class": "const/shared/two-nodes/key-order", "input": {"b": $n16, "0": $n17, "c": $n16, "1": $n17}, "text": "const $0={};const $1=[0];export default {\"0\":$0,\"1\":$0,\"b\":$1,\"c\":$1};"},
    {"id": "norm-name-counter-two-digits", "class": "const/name/counter/two-digits", "input": [$n18, $n18, $n19, $n19, $n20, $n20, $n21, $n21, $n22, $n22, $n23, $n23, $n24, $n24, $n25, $n25, $n26, $n26, $n27, $n27, $n28, $n28], "text": "const $0={};const $1={};const $2={};const $3={};const $4={};const $5={};const $6={};const $7={};const $8={};const $9={};const $10={};export default [$0,$0,$1,$1,$2,$2,$3,$3,$4,$4,$5,$5,$6,$6,$7,$7,$8,$8,$9,$9,$10,$10];"},
    {"id": "norm-number-0", "class": "number/int/zero", "input": 0, "text": "export default 0;"},
    {"id": "norm-number-neg-0", "class": "number/int/zero/neg", "input": -0, "text": "export default -0;"},
    {"id": "norm-number-109", "class": "number/int/digits", "input": 109, "text": "export default 109;"},
    {"id": "norm-number-neg-109", "class": "number/int/digits/neg", "input": -109, "text": "export default -109;"},
    {"id": "norm-number-1.5", "class": "number/frac", "input": 1.5, "text": "export default 1.5;"},
    {"id": "norm-number-neg-1.5", "class": "number/frac/neg", "input": -1.5, "text": "export default -1.5;"},
    {"id": "norm-number-1e20", "class": "number/notation/fixed/high", "input": 1e20, "text": "export default 100000000000000000000;"},
    {"id": "norm-number-neg-1e20", "class": "number/notation/fixed/high/neg", "input": -1e20, "text": "export default -100000000000000000000;"},
    {"id": "norm-number-1e21", "class": "number/notation/exp/high", "input": 1e21, "text": "export default 1e+21;"},
    {"id": "norm-number-neg-1e21", "class": "number/notation/exp/high/neg", "input": -1e21, "text": "export default -1e+21;"},
    {"id": "norm-number-1e-6", "class": "number/notation/fixed/low", "input": 1e-6, "text": "export default 0.000001;"},
    {"id": "norm-number-neg-1e-6", "class": "number/notation/fixed/low/neg", "input": -1e-6, "text": "export default -0.000001;"},
    {"id": "norm-number-1e-7", "class": "number/notation/exp/low", "input": 1e-7, "text": "export default 1e-7;"},
    {"id": "norm-number-neg-1e-7", "class": "number/notation/exp/low/neg", "input": -1e-7, "text": "export default -1e-7;"},
    {"id": "norm-number-subnormal", "class": "number/binary64/subnormal", "input": 5e-324, "text": "export default 5e-324;"},
    {"id": "norm-number-neg-subnormal", "class": "number/binary64/subnormal/neg", "input": -5e-324, "text": "export default -5e-324;"},
    {"id": "norm-number-max", "class": "number/binary64/max", "input": 1.7976931348623157e308, "text": "export default 1.7976931348623157e+308;"},
    {"id": "norm-number-neg-max", "class": "number/binary64/max/neg", "input": -1.7976931348623157e308, "text": "export default -1.7976931348623157e+308;"},
    {"id": "norm-number-shortest-int", "class": "number/shortest/int", "input": 1000000000000000128, "text": "export default 1000000000000000100;"},
    {"id": "norm-number-neg-shortest-int", "class": "number/shortest/int/neg", "input": -1000000000000000128, "text": "export default -1000000000000000100;"},
    {"id": "norm-number-shortest-frac", "class": "number/shortest/frac", "input": 0.1, "text": "export default 0.1;"},
    {"id": "norm-number-neg-shortest-frac", "class": "number/shortest/frac/neg", "input": -0.1, "text": "export default -0.1;"},
    {"id": "norm-infinity", "class": "infinity/plus", "input": Infinity, "text": "export default Infinity;"},
    {"id": "norm-neg-infinity", "class": "infinity/minus", "input": -Infinity, "text": "export default -Infinity;"},
    {"id": "norm-bigint-0", "class": "bigint/zero", "input": 0n, "text": "export default 0n;"},
    {"id": "norm-bigint-109", "class": "bigint/digits", "input": 109n, "text": "export default 109n;"},
    {"id": "norm-bigint-neg-109", "class": "bigint/digits/neg", "input": -109n, "text": "export default -109n;"},
    {"id": "norm-document-spelling-one-line", "class": "document/spelling/one-line", "input": [$s1, {"a": $s1, "b": 0}], "text": "const $0=[1,2];export default [$0,{\"a\":$0,\"b\":0}];"},
    {"id": "norm-ws-required-default-true", "class": "whitespace/required/default/true", "input": true, "text": "export default true;"},
    {"id": "norm-ws-required-default-false", "class": "whitespace/required/default/false", "input": false, "text": "export default false;"},
    {"id": "norm-ws-required-default-null", "class": "whitespace/required/default/null", "input": null, "text": "export default null;"},
    {"id": "norm-ws-required-default-undefined", "class": "whitespace/required/default/undefined", "input": undefined, "text": "export default undefined;"},
    {"id": "norm-ws-required-default-nan", "class": "whitespace/required/default/nan", "input": NaN, "text": "export default NaN;"},
    {"id": "norm-ws-required-default-number", "class": "whitespace/required/default/number", "input": 1, "text": "export default 1;"},
    {"id": "norm-ws-required-default-negative", "class": "whitespace/required/default/negative", "input": -1, "text": "export default -1;"},
    {"id": "norm-ws-required-default-bigint", "class": "whitespace/required/default/bigint", "input": 1n, "text": "export default 1n;"},
    {"id": "norm-ws-required-default-negative-bigint", "class": "whitespace/required/default/negative-bigint", "input": -1n, "text": "export default -1n;"},
    {"id": "norm-ws-required-default-array", "class": "whitespace/required/default/array", "input": [1], "text": "export default [1];"},
    {"id": "norm-ws-required-default-object", "class": "whitespace/required/default/object", "input": {"a": 1}, "text": "export default {\"a\":1};"},
    {"id": "norm-ws-required-default-string", "class": "whitespace/required/default/string", "input": "a", "text": "export default \"a\";"},
    {"id": "norm-object-key-order-index-before-name", "class": "object/key-order/index-before-name", "input": {"10": 1, "2": 2, "z": 3, "a": 4}, "text": "export default {\"2\":2,\"10\":1,\"z\":3,\"a\":4};"},
    {"id": "norm-object-key-order-names-first-occurrence", "class": "object/key-order/names/first-occurrence", "input": {"b": 0, "a": 1, "c": 2}, "text": "export default {\"b\":0,\"a\":1,\"c\":2};"},
    {"id": "norm-key-proto", "class": "key/proto", "input": {["__proto__"]: 1}, "text": "export default {[\"__proto__\"]:1};"},
    {"id": "norm-key-proto-among", "class": "key/proto/among", "input": {"a": 1, ["__proto__"]: 2, "b": 3}, "text": "export default {\"a\":1,[\"__proto__\"]:2,\"b\":3};"},
    {"id": "norm-number-exp-low-mantissa", "class": "number/notation/exp/low/mantissa", "input": 1.5e-7, "text": "export default 1.5e-7;"},
    {"id": "norm-number-exp-low-mantissa-neg", "class": "number/notation/exp/low/mantissa/neg", "input": -1.5e-7, "text": "export default -1.5e-7;"},
];
