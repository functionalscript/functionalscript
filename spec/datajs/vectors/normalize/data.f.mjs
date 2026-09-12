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
const $s1 = [1, 2];
const $n29 = [1];
const $n30 = ["\u2028", "\ud800", "\u0000", "\u2028"];
const $n31 = {"\u2028": 0};
const $n32 = [0];
const $n33 = [null, true, false, undefined, NaN, Infinity, -Infinity, 0, -0, 9, -9, 1.5, 1e2, 1n, -1n, "", "a", "\u2028", "\ud800", "\u0000", "\ud800\udc00", [], {}, 1];
const $n34 = {"a": null, "b": true, "c": false, "d": undefined, "e": NaN, "f": Infinity, "g": -Infinity, "h": 0, "i": -0, "j": 9, "k": -9, "l": 1.5, "m": 1e2, "n": 1n, "o": -1n, "p": "", "q": "a", "r": "\u2028", "s": "\ud800", "t": "\u0000", "u": [], "v": {}, "w": 1, "x": "\ud800\udc00"};
const $n35 = {"d": 0, "c": 1};
const $n36 = {["__proto__"]: 1};
const $p0 = [null, 0];
const $p1 = [undefined, 0];
const $p2 = [NaN, 0];
const $p3 = [Infinity, 0];
const $p4 = [-Infinity, 0];
const $p5 = [-0, 0];
const $p6 = [false, 0];
const $p7 = [true, 0];
const $p8 = ["", 0];
const $p9 = ["a", 0];
const $p10 = [1n, 0];
const $p11 = [-1n, 0];
const $p12 = [0n, 0];
const $p13 = [109n, 0];
const $p14 = [-1, 0];
const $p15 = [[], 0];
const $p16 = [{}, 0];
const $p17 = [109, 0];
const $p18 = [1.5, 0];
const $p19 = [0.1, 0];
const $p20 = [1000000000000000100, 0];
const $p21 = [1e20, 0];
const $p22 = [1e21, 0];
const $p23 = [-1e21, 0];
const $p24 = [1e-6, 0];
const $p25 = [1e-7, 0];
const $p26 = [1.5e-7, 0];
const $p27 = [-1.5e-7, 0];
const $p28 = [5e-324, 0];
const $p29 = [9007199254740992, 0];
const $p30 = [9007199254740993, 0];
const $p31 = [1.7976931348623157e308, 0];
const $p32 = [9007199254740993n, 0];
const $p33 = [18446744073709551617n, 0];
const $p34 = [340282366920938463463374607431768211457n, 0];
const $q0 = {"a": null, "b": 0};
const $q1 = {"a": undefined, "b": 0};
const $q2 = {"a": NaN, "b": 0};
const $q3 = {"a": Infinity, "b": 0};
const $q4 = {"a": -Infinity, "b": 0};
const $q5 = {"a": -0, "b": 0};
const $q6 = {"a": false, "b": 0};
const $q7 = {"a": true, "b": 0};
const $q8 = {"a": "", "b": 0};
const $q9 = {"a": "a", "b": 0};
const $q10 = {"a": 1n, "b": 0};
const $q11 = {"a": -1n, "b": 0};
const $q12 = {"a": 0n, "b": 0};
const $q13 = {"a": 109n, "b": 0};
const $q14 = {"a": -1, "b": 0};
const $q15 = {"a": [], "b": 0};
const $q16 = {"a": {}, "b": 0};
const $q17 = {"a": 109, "b": 0};
const $q18 = {"a": 1.5, "b": 0};
const $q19 = {"a": 0.1, "b": 0};
const $q20 = {"a": 1000000000000000100, "b": 0};
const $q21 = {"a": 1e20, "b": 0};
const $q22 = {"a": 1e21, "b": 0};
const $q23 = {"a": -1e21, "b": 0};
const $q24 = {"a": 1e-6, "b": 0};
const $q25 = {"a": 1e-7, "b": 0};
const $q26 = {"a": 1.5e-7, "b": 0};
const $q27 = {"a": -1.5e-7, "b": 0};
const $q28 = {"a": 5e-324, "b": 0};
const $q29 = {"a": 9007199254740992, "b": 0};
const $q30 = {"a": 9007199254740993, "b": 0};
const $q31 = {"a": 1.7976931348623157e308, "b": 0};
const $q32 = {"a": 9007199254740993n, "b": 0};
const $q33 = {"a": 18446744073709551617n, "b": 0};
const $q34 = {"a": 340282366920938463463374607431768211457n, "b": 0};
const $n38 = {"a": 0, "\u2028": 1};
const $n37 = {"\"": "\"", "\\": "\\", "\b": "\b", "\t": "\t", "\n": "\n", "\f": "\f", "\r": "\r", "\u0000": "\u0000", "\u001f": "\u001f"};
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
    {"id": "norm-string-raw-bmp-latin", "class": "string/raw/bmp", "input": "é", "text": "export default \"é\";"},
    {"id": "norm-key-raw-bmp-latin", "class": "key/string/raw/bmp", "input": {"é": 0}, "text": "export default {\"é\":0};"},
    {"id": "norm-string-raw-astral-emoji", "class": "string/raw/astral", "input": "😀", "text": "export default \"😀\";"},
    {"id": "norm-key-raw-astral-emoji", "class": "key/string/raw/astral", "input": {"😀": 0}, "text": "export default {\"😀\":0};"},
    {"id": "norm-bigint-2p53", "class": "bigint/past-2p53", "input": 9007199254740993n, "text": "export default 9007199254740993n;"},
    {"id": "norm-bigint-neg-2p53", "class": "bigint/past-2p53/neg", "input": -9007199254740993n, "text": "export default -9007199254740993n;"},
    {"id": "norm-bigint-2p64", "class": "bigint/past-2p64", "input": 18446744073709551617n, "text": "export default 18446744073709551617n;"},
    {"id": "norm-bigint-neg-2p64", "class": "bigint/past-2p64/neg", "input": -18446744073709551617n, "text": "export default -18446744073709551617n;"},
    {"id": "norm-bigint-2p128", "class": "bigint/past-2p128", "input": 340282366920938463463374607431768211457n, "text": "export default 340282366920938463463374607431768211457n;"},
    {"id": "norm-bigint-neg-2p128", "class": "bigint/past-2p128/neg", "input": -340282366920938463463374607431768211457n, "text": "export default -340282366920938463463374607431768211457n;"},
    {"id": "norm-unshared-array-equal", "class": "array/unshared/equal", "input": [[1], [1]], "text": "export default [[1],[1]];"},
    {"id": "norm-unshared-object-equal", "class": "object/unshared/equal", "input": [{"a": 0}, {"a": 0}], "text": "export default [{\"a\":0},{\"a\":0}];"},
    {"id": "norm-object-key-order-boundaries", "class": "object/key-order/boundaries", "input": {"z": 0, "4294967295": 0, "4294967294": 0, "2147483648": 0, "1": 0, "01": 0, "1.0": 0, "0": 0}, "text": "export default {\"0\":0,\"1\":0,\"2147483648\":0,\"4294967294\":0,\"z\":0,\"4294967295\":0,\"01\":0,\"1.0\":0};"},
    {"id": "norm-array-elements-every-value", "class": "array/elements/every-value", "input": [null, true, false, undefined, NaN, Infinity, -Infinity, 0, -0, 9, -9, 1.5, 1e2, 1n, -1n, "", "a", "\u2028", "\ud800", "\u0000", "\ud800\udc00", [], {}, 1], "text": "export default [null,true,false,undefined,NaN,Infinity,-Infinity,0,-0,9,-9,1.5,100,1n,-1n,\"\",\"a\",\"\u2028\",\"\\ud800\",\"\\u0000\",\"\ud800\udc00\",[],{},1];"},
    {"id": "norm-object-members-every-value", "class": "object/members/every-value", "input": {"a": null, "b": true, "c": false, "d": undefined, "e": NaN, "f": Infinity, "g": -Infinity, "h": 0, "i": -0, "j": 9, "k": -9, "l": 1.5, "m": 1e2, "n": 1n, "o": -1n, "p": "", "q": "a", "r": "\u2028", "s": "\ud800", "t": "\u0000", "u": [], "v": {}, "w": 1, "x": "\ud800\udc00"}, "text": "export default {\"a\":null,\"b\":true,\"c\":false,\"d\":undefined,\"e\":NaN,\"f\":Infinity,\"g\":-Infinity,\"h\":0,\"i\":-0,\"j\":9,\"k\":-9,\"l\":1.5,\"m\":100,\"n\":1n,\"o\":-1n,\"p\":\"\",\"q\":\"a\",\"r\":\"\u2028\",\"s\":\"\\ud800\",\"t\":\"\\u0000\",\"u\":[],\"v\":{},\"w\":1,\"x\":\"\ud800\udc00\"};"},
    {"id": "norm-string-raw-ws-like-2028", "class": "string/raw/ws-like/2028", "input": "\u2028", "text": "export default \"\u2028\";"},
    {"id": "norm-key-raw-ws-like-2028", "class": "key/string/raw/ws-like/2028", "input": {"\u2028": 0}, "text": "export default {\"\u2028\":0};"},
    {"id": "norm-string-raw-ws-like-2029", "class": "string/raw/ws-like/2029", "input": "\u2029", "text": "export default \"\u2029\";"},
    {"id": "norm-key-raw-ws-like-2029", "class": "key/string/raw/ws-like/2029", "input": {"\u2029": 0}, "text": "export default {\"\u2029\":0};"},
    {"id": "norm-string-raw-ws-like-feff", "class": "string/raw/ws-like/feff", "input": "\ufeff", "text": "export default \"\ufeff\";"},
    {"id": "norm-key-raw-ws-like-feff", "class": "key/string/raw/ws-like/feff", "input": {"\ufeff": 0}, "text": "export default {\"\ufeff\":0};"},
    {"id": "norm-string-raw-ws-like-00a0", "class": "string/raw/ws-like/00a0", "input": "\u00a0", "text": "export default \"\u00a0\";"},
    {"id": "norm-key-raw-ws-like-00a0", "class": "key/string/raw/ws-like/00a0", "input": {"\u00a0": 0}, "text": "export default {\"\u00a0\":0};"},
    {"id": "norm-string-raw-ws-like-1680", "class": "string/raw/ws-like/1680", "input": "\u1680", "text": "export default \"\u1680\";"},
    {"id": "norm-key-raw-ws-like-1680", "class": "key/string/raw/ws-like/1680", "input": {"\u1680": 0}, "text": "export default {\"\u1680\":0};"},
    {"id": "norm-string-raw-ws-like-2000", "class": "string/raw/ws-like/2000", "input": "\u2000", "text": "export default \"\u2000\";"},
    {"id": "norm-key-raw-ws-like-2000", "class": "key/string/raw/ws-like/2000", "input": {"\u2000": 0}, "text": "export default {\"\u2000\":0};"},
    {"id": "norm-string-raw-ws-like-2001", "class": "string/raw/ws-like/2001", "input": "\u2001", "text": "export default \"\u2001\";"},
    {"id": "norm-key-raw-ws-like-2001", "class": "key/string/raw/ws-like/2001", "input": {"\u2001": 0}, "text": "export default {\"\u2001\":0};"},
    {"id": "norm-string-raw-ws-like-2002", "class": "string/raw/ws-like/2002", "input": "\u2002", "text": "export default \"\u2002\";"},
    {"id": "norm-key-raw-ws-like-2002", "class": "key/string/raw/ws-like/2002", "input": {"\u2002": 0}, "text": "export default {\"\u2002\":0};"},
    {"id": "norm-string-raw-ws-like-2003", "class": "string/raw/ws-like/2003", "input": "\u2003", "text": "export default \"\u2003\";"},
    {"id": "norm-key-raw-ws-like-2003", "class": "key/string/raw/ws-like/2003", "input": {"\u2003": 0}, "text": "export default {\"\u2003\":0};"},
    {"id": "norm-string-raw-ws-like-2004", "class": "string/raw/ws-like/2004", "input": "\u2004", "text": "export default \"\u2004\";"},
    {"id": "norm-key-raw-ws-like-2004", "class": "key/string/raw/ws-like/2004", "input": {"\u2004": 0}, "text": "export default {\"\u2004\":0};"},
    {"id": "norm-string-raw-ws-like-2005", "class": "string/raw/ws-like/2005", "input": "\u2005", "text": "export default \"\u2005\";"},
    {"id": "norm-key-raw-ws-like-2005", "class": "key/string/raw/ws-like/2005", "input": {"\u2005": 0}, "text": "export default {\"\u2005\":0};"},
    {"id": "norm-string-raw-ws-like-2006", "class": "string/raw/ws-like/2006", "input": "\u2006", "text": "export default \"\u2006\";"},
    {"id": "norm-key-raw-ws-like-2006", "class": "key/string/raw/ws-like/2006", "input": {"\u2006": 0}, "text": "export default {\"\u2006\":0};"},
    {"id": "norm-string-raw-ws-like-2007", "class": "string/raw/ws-like/2007", "input": "\u2007", "text": "export default \"\u2007\";"},
    {"id": "norm-key-raw-ws-like-2007", "class": "key/string/raw/ws-like/2007", "input": {"\u2007": 0}, "text": "export default {\"\u2007\":0};"},
    {"id": "norm-string-raw-ws-like-2008", "class": "string/raw/ws-like/2008", "input": "\u2008", "text": "export default \"\u2008\";"},
    {"id": "norm-key-raw-ws-like-2008", "class": "key/string/raw/ws-like/2008", "input": {"\u2008": 0}, "text": "export default {\"\u2008\":0};"},
    {"id": "norm-string-raw-ws-like-2009", "class": "string/raw/ws-like/2009", "input": "\u2009", "text": "export default \"\u2009\";"},
    {"id": "norm-key-raw-ws-like-2009", "class": "key/string/raw/ws-like/2009", "input": {"\u2009": 0}, "text": "export default {\"\u2009\":0};"},
    {"id": "norm-string-raw-ws-like-200a", "class": "string/raw/ws-like/200a", "input": "\u200a", "text": "export default \"\u200a\";"},
    {"id": "norm-key-raw-ws-like-200a", "class": "key/string/raw/ws-like/200a", "input": {"\u200a": 0}, "text": "export default {\"\u200a\":0};"},
    {"id": "norm-string-raw-ws-like-202f", "class": "string/raw/ws-like/202f", "input": "\u202f", "text": "export default \"\u202f\";"},
    {"id": "norm-key-raw-ws-like-202f", "class": "key/string/raw/ws-like/202f", "input": {"\u202f": 0}, "text": "export default {\"\u202f\":0};"},
    {"id": "norm-string-raw-ws-like-205f", "class": "string/raw/ws-like/205f", "input": "\u205f", "text": "export default \"\u205f\";"},
    {"id": "norm-key-raw-ws-like-205f", "class": "key/string/raw/ws-like/205f", "input": {"\u205f": 0}, "text": "export default {\"\u205f\":0};"},
    {"id": "norm-string-raw-ws-like-3000", "class": "string/raw/ws-like/3000", "input": "\u3000", "text": "export default \"\u3000\";"},
    {"id": "norm-key-raw-ws-like-3000", "class": "key/string/raw/ws-like/3000", "input": {"\u3000": 0}, "text": "export default {\"\u3000\":0};"},
    {"id": "norm-string-surrogate-adjacent-hh-d800", "class": "string/surrogate/adjacent/hh-d800", "input": "\ud800\ud800", "text": "export default \"\\ud800\\ud800\";"},
    {"id": "norm-key-surrogate-adjacent-hh-d800", "class": "key/string/surrogate/adjacent/hh-d800", "input": {"\ud800\ud800": 0}, "text": "export default {\"\\ud800\\ud800\":0};"},
    {"id": "norm-string-surrogate-adjacent-lh-dc00-d800", "class": "string/surrogate/adjacent/lh-dc00-d800", "input": "\udc00\ud800", "text": "export default \"\\udc00\\ud800\";"},
    {"id": "norm-key-surrogate-adjacent-lh-dc00-d800", "class": "key/string/surrogate/adjacent/lh-dc00-d800", "input": {"\udc00\ud800": 0}, "text": "export default {\"\\udc00\\ud800\":0};"},
    {"id": "norm-string-surrogate-adjacent-ll-dc00", "class": "string/surrogate/adjacent/ll-dc00", "input": "\udc00\udc00", "text": "export default \"\\udc00\\udc00\";"},
    {"id": "norm-key-surrogate-adjacent-ll-dc00", "class": "key/string/surrogate/adjacent/ll-dc00", "input": {"\udc00\udc00": 0}, "text": "export default {\"\\udc00\\udc00\":0};"},
    {"id": "norm-string-surrogate-adjacent-hh-dbff", "class": "string/surrogate/adjacent/hh-dbff", "input": "\udbff\udbff", "text": "export default \"\\udbff\\udbff\";"},
    {"id": "norm-key-surrogate-adjacent-hh-dbff", "class": "key/string/surrogate/adjacent/hh-dbff", "input": {"\udbff\udbff": 0}, "text": "export default {\"\\udbff\\udbff\":0};"},
    {"id": "norm-string-surrogate-adjacent-lh-dfff-dbff", "class": "string/surrogate/adjacent/lh-dfff-dbff", "input": "\udfff\udbff", "text": "export default \"\\udfff\\udbff\";"},
    {"id": "norm-key-surrogate-adjacent-lh-dfff-dbff", "class": "key/string/surrogate/adjacent/lh-dfff-dbff", "input": {"\udfff\udbff": 0}, "text": "export default {\"\\udfff\\udbff\":0};"},
    {"id": "norm-string-surrogate-adjacent-ll-dfff", "class": "string/surrogate/adjacent/ll-dfff", "input": "\udfff\udfff", "text": "export default \"\\udfff\\udfff\";"},
    {"id": "norm-key-surrogate-adjacent-ll-dfff", "class": "key/string/surrogate/adjacent/ll-dfff", "input": {"\udfff\udfff": 0}, "text": "export default {\"\\udfff\\udfff\":0};"},
    {"id": "norm-string-surrogate-adjacent-hh-d800-dbff", "class": "string/surrogate/adjacent/hh-d800-dbff", "input": "\ud800\udbff", "text": "export default \"\\ud800\\udbff\";"},
    {"id": "norm-key-surrogate-adjacent-hh-d800-dbff", "class": "key/string/surrogate/adjacent/hh-d800-dbff", "input": {"\ud800\udbff": 0}, "text": "export default {\"\\ud800\\udbff\":0};"},
    {"id": "norm-object-key-order-non-index-negative", "class": "object/key-order/non-index/negative", "input": {"z": 0, "-1": 1, "1": 2}, "text": "export default {\"1\":2,\"z\":0,\"-1\":1};"},
    {"id": "norm-object-key-order-non-index-negative-zero", "class": "object/key-order/non-index/negative-zero", "input": {"z": 0, "-0": 1, "1": 2}, "text": "export default {\"1\":2,\"z\":0,\"-0\":1};"},
    {"id": "norm-object-key-order-non-index-plus", "class": "object/key-order/non-index/plus", "input": {"z": 0, "+1": 1, "1": 2}, "text": "export default {\"1\":2,\"z\":0,\"+1\":1};"},
    {"id": "norm-object-key-order-non-index-space", "class": "object/key-order/non-index/space", "input": {"z": 0, " 1": 1, "1": 2}, "text": "export default {\"1\":2,\"z\":0,\" 1\":1};"},
    {"id": "norm-object-key-order-non-index-hex", "class": "object/key-order/non-index/hex", "input": {"z": 0, "0x1": 1, "1": 2}, "text": "export default {\"1\":2,\"z\":0,\"0x1\":1};"},
    {"id": "norm-object-key-order-non-index-exp", "class": "object/key-order/non-index/exp", "input": {"z": 0, "1e0": 1, "1": 2}, "text": "export default {\"1\":2,\"z\":0,\"1e0\":1};"},
    {"id": "norm-object-key-order-non-index-above", "class": "object/key-order/non-index/above", "input": {"z": 0, "4294967296": 1, "1": 2}, "text": "export default {\"1\":2,\"z\":0,\"4294967296\":1};"},
    {"id": "norm-key-proto-nested", "class": "key/proto/nested", "input": [{["__proto__"]: {["__proto__"]: 1}}], "text": "export default [{[\"__proto__\"]:{[\"__proto__\"]:1}}];"},
    {"id": "norm-number-rounding", "class": "number/binary64/rounding", "input": 9007199254740992, "text": "export default 9007199254740992;"},
    {"id": "norm-number-neg-rounding", "class": "number/binary64/rounding/neg", "input": -9007199254740992, "text": "export default -9007199254740992;"},
    {"id": "norm-string-raw-0080", "class": "string/raw/bmp", "input": "\u0080", "text": "export default \"\u0080\";"},
    {"id": "norm-key-raw-0080", "class": "key/string/raw/bmp", "input": {"\u0080": 0}, "text": "export default {\"\u0080\":0};"},
    {"id": "norm-string-raw-07ff", "class": "string/raw/bmp", "input": "\u07ff", "text": "export default \"\u07ff\";"},
    {"id": "norm-key-raw-07ff", "class": "key/string/raw/bmp", "input": {"\u07ff": 0}, "text": "export default {\"\u07ff\":0};"},
    {"id": "norm-string-raw-0800", "class": "string/raw/bmp", "input": "\u0800", "text": "export default \"\u0800\";"},
    {"id": "norm-key-raw-0800", "class": "key/string/raw/bmp", "input": {"\u0800": 0}, "text": "export default {\"\u0800\":0};"},
    {"id": "norm-shared-three-paths", "class": "const/shared/three-paths", "input": [$n29, {"a": $n29}, {"b": [$n29]}], "text": "const $0=[1];export default [$0,{\"a\":$0},{\"b\":[$0]}];"},
    {"id": "norm-unshared-object-parent-array", "class": "array/unshared/equal", "input": {"a": [1], "b": [1]}, "text": "export default {\"a\":[1],\"b\":[1]};"},
    {"id": "norm-unshared-object-parent-object", "class": "object/unshared/equal", "input": {"a": {"x": 0}, "b": {"x": 0}}, "text": "export default {\"a\":{\"x\":0},\"b\":{\"x\":0}};"},
    {"id": "norm-key-raw-ws-like-2028-nested", "class": "key/string/raw/ws-like/2028", "input": {"a": {"\u2028": 0}}, "text": "export default {\"a\":{\"\u2028\":0}};"},
    {"id": "norm-key-raw-ws-like-2028-after-first", "class": "key/string/raw/ws-like/2028", "input": {"a": 0, "\u2028": 0}, "text": "export default {\"a\":0,\"\u2028\":0};"},
    {"id": "norm-const-body-escaping-values", "class": "const/shared/twice", "input": [$n30, $n30], "text": "const $0=[\"\u2028\",\"\\ud800\",\"\\u0000\",\"\u2028\"];export default [$0,$0];"},
    {"id": "norm-const-body-escaping-key", "class": "const/shared/object", "input": [$n31, $n31], "text": "const $0={\"\u2028\":0};export default [$0,$0];"},
    {"id": "norm-key-proto-value-shared", "class": "key/proto/value/shared", "input": {["__proto__"]: $n32, "a": $n32}, "text": "const $0=[0];export default {[\"__proto__\"]:$0,\"a\":$0};"},
    {"id": "norm-const-every-value-array", "class": "const/shared/twice", "input": [$n33, $n33], "text": "const $0=[null,true,false,undefined,NaN,Infinity,-Infinity,0,-0,9,-9,1.5,100,1n,-1n,\"\",\"a\",\"\u2028\",\"\\ud800\",\"\\u0000\",\"\ud800\udc00\",[],{},1];export default [$0,$0];"},
    {"id": "norm-const-every-value-object", "class": "const/shared/object", "input": [$n34, $n34], "text": "const $0={\"a\":null,\"b\":true,\"c\":false,\"d\":undefined,\"e\":NaN,\"f\":Infinity,\"g\":-Infinity,\"h\":0,\"i\":-0,\"j\":9,\"k\":-9,\"l\":1.5,\"m\":100,\"n\":1n,\"o\":-1n,\"p\":\"\",\"q\":\"a\",\"r\":\"\u2028\",\"s\":\"\\ud800\",\"t\":\"\\u0000\",\"u\":[],\"v\":{},\"w\":1,\"x\":\"\ud800\udc00\"};export default [$0,$0];"},
    {"id": "norm-string-surrogate-pair-mixed", "class": "string/surrogate/pair/mixed", "input": "\ud800\udfff", "text": "export default \"\ud800\udfff\";"},
    {"id": "norm-key-surrogate-pair-mixed", "class": "key/string/surrogate/pair/mixed", "input": {"\ud800\udfff": 0}, "text": "export default {\"\ud800\udfff\":0};"},
    {"id": "norm-array-elements-negative-first", "class": "array/elements/negative-first", "input": [-1, -1n, -Infinity], "text": "export default [-1,-1n,-Infinity];"},
    {"id": "norm-array-elements-negative-zero-first", "class": "array/elements/negative-first", "input": [-0, 1], "text": "export default [-0,1];"},
    {"id": "norm-array-elements-negative-bigint-first", "class": "array/elements/negative-first", "input": [-1n, 1], "text": "export default [-1n,1];"},
    {"id": "norm-array-elements-negative-infinity-first", "class": "array/elements/negative-first", "input": [-Infinity, 1], "text": "export default [-Infinity,1];"},
    {"id": "norm-object-members-negative-first-zero", "class": "object/members/negative-first", "input": {"a": -0, "b": 1}, "text": "export default {\"a\":-0,\"b\":1};"},
    {"id": "norm-object-members-negative-first-number", "class": "object/members/negative-first", "input": {"a": -1, "b": 1}, "text": "export default {\"a\":-1,\"b\":1};"},
    {"id": "norm-object-members-negative-first-bigint", "class": "object/members/negative-first", "input": {"a": -1n, "b": 1}, "text": "export default {\"a\":-1n,\"b\":1};"},
    {"id": "norm-object-members-negative-first-infinity", "class": "object/members/negative-first", "input": {"a": -Infinity, "b": 1}, "text": "export default {\"a\":-Infinity,\"b\":1};"},
    {"id": "norm-string-escape-quote-every-slot", "class": "string/escape/quote", "input": ["\"", 0, "\""], "text": "export default [\"\\\"\",0,\"\\\"\"];"},
    {"id": "norm-key-escape-quote-every-slot", "class": "key/string/escape/quote", "input": [{"\"": "\"", "a": 1}, {"a": 0, "\"": "\""}], "text": "export default [{\"\\\"\":\"\\\"\",\"a\":1},{\"a\":0,\"\\\"\":\"\\\"\"}];"},
    {"id": "norm-string-escape-backslash-every-slot", "class": "string/escape/backslash", "input": ["\\", 0, "\\"], "text": "export default [\"\\\\\",0,\"\\\\\"];"},
    {"id": "norm-key-escape-backslash-every-slot", "class": "key/string/escape/backslash", "input": [{"\\": "\\", "a": 1}, {"a": 0, "\\": "\\"}], "text": "export default [{\"\\\\\":\"\\\\\",\"a\":1},{\"a\":0,\"\\\\\":\"\\\\\"}];"},
    {"id": "norm-string-escape-b-every-slot", "class": "string/escape/b", "input": ["\b", 0, "\b"], "text": "export default [\"\\b\",0,\"\\b\"];"},
    {"id": "norm-key-escape-b-every-slot", "class": "key/string/escape/b", "input": [{"\b": "\b", "a": 1}, {"a": 0, "\b": "\b"}], "text": "export default [{\"\\b\":\"\\b\",\"a\":1},{\"a\":0,\"\\b\":\"\\b\"}];"},
    {"id": "norm-string-escape-t-every-slot", "class": "string/escape/t", "input": ["\t", 0, "\t"], "text": "export default [\"\\t\",0,\"\\t\"];"},
    {"id": "norm-key-escape-t-every-slot", "class": "key/string/escape/t", "input": [{"\t": "\t", "a": 1}, {"a": 0, "\t": "\t"}], "text": "export default [{\"\\t\":\"\\t\",\"a\":1},{\"a\":0,\"\\t\":\"\\t\"}];"},
    {"id": "norm-string-escape-n-every-slot", "class": "string/escape/n", "input": ["\n", 0, "\n"], "text": "export default [\"\\n\",0,\"\\n\"];"},
    {"id": "norm-key-escape-n-every-slot", "class": "key/string/escape/n", "input": [{"\n": "\n", "a": 1}, {"a": 0, "\n": "\n"}], "text": "export default [{\"\\n\":\"\\n\",\"a\":1},{\"a\":0,\"\\n\":\"\\n\"}];"},
    {"id": "norm-string-escape-f-every-slot", "class": "string/escape/f", "input": ["\f", 0, "\f"], "text": "export default [\"\\f\",0,\"\\f\"];"},
    {"id": "norm-key-escape-f-every-slot", "class": "key/string/escape/f", "input": [{"\f": "\f", "a": 1}, {"a": 0, "\f": "\f"}], "text": "export default [{\"\\f\":\"\\f\",\"a\":1},{\"a\":0,\"\\f\":\"\\f\"}];"},
    {"id": "norm-string-escape-r-every-slot", "class": "string/escape/r", "input": ["\r", 0, "\r"], "text": "export default [\"\\r\",0,\"\\r\"];"},
    {"id": "norm-key-escape-r-every-slot", "class": "key/string/escape/r", "input": [{"\r": "\r", "a": 1}, {"a": 0, "\r": "\r"}], "text": "export default [{\"\\r\":\"\\r\",\"a\":1},{\"a\":0,\"\\r\":\"\\r\"}];"},
    {"id": "norm-string-escape-u00-0000-every-slot", "class": "string/escape/u00/0000", "input": ["\u0000", 0, "\u0000"], "text": "export default [\"\\u0000\",0,\"\\u0000\"];"},
    {"id": "norm-key-escape-u00-0000-every-slot", "class": "key/string/escape/u00/0000", "input": [{"\u0000": "\u0000", "a": 1}, {"a": 0, "\u0000": "\u0000"}], "text": "export default [{\"\\u0000\":\"\\u0000\",\"a\":1},{\"a\":0,\"\\u0000\":\"\\u0000\"}];"},
    {"id": "norm-string-escape-u00-0007-every-slot", "class": "string/escape/u00/0007", "input": ["\u0007", 0, "\u0007"], "text": "export default [\"\\u0007\",0,\"\\u0007\"];"},
    {"id": "norm-key-escape-u00-0007-every-slot", "class": "key/string/escape/u00/0007", "input": [{"\u0007": "\u0007", "a": 1}, {"a": 0, "\u0007": "\u0007"}], "text": "export default [{\"\\u0007\":\"\\u0007\",\"a\":1},{\"a\":0,\"\\u0007\":\"\\u0007\"}];"},
    {"id": "norm-string-escape-u00-000b-every-slot", "class": "string/escape/u00/000b", "input": ["\u000b", 0, "\u000b"], "text": "export default [\"\\u000b\",0,\"\\u000b\"];"},
    {"id": "norm-key-escape-u00-000b-every-slot", "class": "key/string/escape/u00/000b", "input": [{"\u000b": "\u000b", "a": 1}, {"a": 0, "\u000b": "\u000b"}], "text": "export default [{\"\\u000b\":\"\\u000b\",\"a\":1},{\"a\":0,\"\\u000b\":\"\\u000b\"}];"},
    {"id": "norm-string-escape-u00-000e-every-slot", "class": "string/escape/u00/000e", "input": ["\u000e", 0, "\u000e"], "text": "export default [\"\\u000e\",0,\"\\u000e\"];"},
    {"id": "norm-key-escape-u00-000e-every-slot", "class": "key/string/escape/u00/000e", "input": [{"\u000e": "\u000e", "a": 1}, {"a": 0, "\u000e": "\u000e"}], "text": "export default [{\"\\u000e\":\"\\u000e\",\"a\":1},{\"a\":0,\"\\u000e\":\"\\u000e\"}];"},
    {"id": "norm-string-escape-u00-000f-every-slot", "class": "string/escape/u00/000f", "input": ["\u000f", 0, "\u000f"], "text": "export default [\"\\u000f\",0,\"\\u000f\"];"},
    {"id": "norm-key-escape-u00-000f-every-slot", "class": "key/string/escape/u00/000f", "input": [{"\u000f": "\u000f", "a": 1}, {"a": 0, "\u000f": "\u000f"}], "text": "export default [{\"\\u000f\":\"\\u000f\",\"a\":1},{\"a\":0,\"\\u000f\":\"\\u000f\"}];"},
    {"id": "norm-string-escape-u00-0010-every-slot", "class": "string/escape/u00/0010", "input": ["\u0010", 0, "\u0010"], "text": "export default [\"\\u0010\",0,\"\\u0010\"];"},
    {"id": "norm-key-escape-u00-0010-every-slot", "class": "key/string/escape/u00/0010", "input": [{"\u0010": "\u0010", "a": 1}, {"a": 0, "\u0010": "\u0010"}], "text": "export default [{\"\\u0010\":\"\\u0010\",\"a\":1},{\"a\":0,\"\\u0010\":\"\\u0010\"}];"},
    {"id": "norm-string-escape-u00-0019-every-slot", "class": "string/escape/u00/0019", "input": ["\u0019", 0, "\u0019"], "text": "export default [\"\\u0019\",0,\"\\u0019\"];"},
    {"id": "norm-key-escape-u00-0019-every-slot", "class": "key/string/escape/u00/0019", "input": [{"\u0019": "\u0019", "a": 1}, {"a": 0, "\u0019": "\u0019"}], "text": "export default [{\"\\u0019\":\"\\u0019\",\"a\":1},{\"a\":0,\"\\u0019\":\"\\u0019\"}];"},
    {"id": "norm-string-escape-u00-001a-every-slot", "class": "string/escape/u00/001a", "input": ["\u001a", 0, "\u001a"], "text": "export default [\"\\u001a\",0,\"\\u001a\"];"},
    {"id": "norm-key-escape-u00-001a-every-slot", "class": "key/string/escape/u00/001a", "input": [{"\u001a": "\u001a", "a": 1}, {"a": 0, "\u001a": "\u001a"}], "text": "export default [{\"\\u001a\":\"\\u001a\",\"a\":1},{\"a\":0,\"\\u001a\":\"\\u001a\"}];"},
    {"id": "norm-string-escape-u00-001f-every-slot", "class": "string/escape/u00/001f", "input": ["\u001f", 0, "\u001f"], "text": "export default [\"\\u001f\",0,\"\\u001f\"];"},
    {"id": "norm-key-escape-u00-001f-every-slot", "class": "key/string/escape/u00/001f", "input": [{"\u001f": "\u001f", "a": 1}, {"a": 0, "\u001f": "\u001f"}], "text": "export default [{\"\\u001f\":\"\\u001f\",\"a\":1},{\"a\":0,\"\\u001f\":\"\\u001f\"}];"},
    {"id": "norm-array-elements-every-value-first", "class": "array/elements/every-value-first", "input": [[null, 0], [true, 0], [false, 0], [undefined, 0], [NaN, 0], [Infinity, 0], [-Infinity, 0], [0, 0], [-0, 0], [9, 0], [-9, 0], [1.5, 0], [1e2, 0], [1n, 0], [-1n, 0], [0n, 0], ["", 0], ["a", 0], ["\u2028", 0], ["\ud800", 0], ["\u0000", 0], ["\ud800\udc00", 0], [[], 0], [{}, 0]], "text": "export default [[null,0],[true,0],[false,0],[undefined,0],[NaN,0],[Infinity,0],[-Infinity,0],[0,0],[-0,0],[9,0],[-9,0],[1.5,0],[100,0],[1n,0],[-1n,0],[0n,0],[\"\",0],[\"a\",0],[\"\u2028\",0],[\"\\ud800\",0],[\"\\u0000\",0],[\"\ud800\udc00\",0],[[],0],[{},0]];"},
    {"id": "norm-object-members-every-value-first", "class": "object/members/every-value-first", "input": [{"a": null, "b": 0}, {"a": true, "b": 0}, {"a": false, "b": 0}, {"a": undefined, "b": 0}, {"a": NaN, "b": 0}, {"a": Infinity, "b": 0}, {"a": -Infinity, "b": 0}, {"a": 0, "b": 0}, {"a": -0, "b": 0}, {"a": 9, "b": 0}, {"a": -9, "b": 0}, {"a": 1.5, "b": 0}, {"a": 1e2, "b": 0}, {"a": 1n, "b": 0}, {"a": -1n, "b": 0}, {"a": 0n, "b": 0}, {"a": "", "b": 0}, {"a": "a", "b": 0}, {"a": "\u2028", "b": 0}, {"a": "\ud800", "b": 0}, {"a": "\u0000", "b": 0}, {"a": "\ud800\udc00", "b": 0}, {"a": [], "b": 0}, {"a": {}, "b": 0}], "text": "export default [{\"a\":null,\"b\":0},{\"a\":true,\"b\":0},{\"a\":false,\"b\":0},{\"a\":undefined,\"b\":0},{\"a\":NaN,\"b\":0},{\"a\":Infinity,\"b\":0},{\"a\":-Infinity,\"b\":0},{\"a\":0,\"b\":0},{\"a\":-0,\"b\":0},{\"a\":9,\"b\":0},{\"a\":-9,\"b\":0},{\"a\":1.5,\"b\":0},{\"a\":100,\"b\":0},{\"a\":1n,\"b\":0},{\"a\":-1n,\"b\":0},{\"a\":0n,\"b\":0},{\"a\":\"\",\"b\":0},{\"a\":\"a\",\"b\":0},{\"a\":\"\u2028\",\"b\":0},{\"a\":\"\\ud800\",\"b\":0},{\"a\":\"\\u0000\",\"b\":0},{\"a\":\"\ud800\udc00\",\"b\":0},{\"a\":[],\"b\":0},{\"a\":{},\"b\":0}];"},
    {"id": "norm-object-key-order-nested", "class": "object/key-order/nested", "input": [{"b": 0, "a": 1}, {"x": {"b": 0, "a": 1}}, $n35, $n35], "text": "const $0={\"d\":0,\"c\":1};export default [{\"b\":0,\"a\":1},{\"x\":{\"b\":0,\"a\":1}},$0,$0];"},
    {"id": "norm-object-keys-every-string", "class": "object/keys/every-string", "input": [{"\u2028": 0, "\ud800": 1, "\u0000": 2, "\ud800\udc00": 3, "a": 4}], "text": "export default [{\"\u2028\":0,\"\\ud800\":1,\"\\u0000\":2,\"\ud800\udc00\":3,\"a\":4}];"},
    {"id": "norm-const-body-key-proto", "class": "const/shared/object", "input": [$n36, $n36], "text": "const $0={[\"__proto__\"]:1};export default [$0,$0];"},
    {"id": "norm-const-body-escaped-keys", "class": "const/shared/object", "input": [$n37, $n37], "text": "const $0={\"\\\"\":\"\\\"\",\"\\\\\":\"\\\\\",\"\\b\":\"\\b\",\"\\t\":\"\\t\",\"\\n\":\"\\n\",\"\\f\":\"\\f\",\"\\r\":\"\\r\",\"\\u0000\":\"\\u0000\",\"\\u001f\":\"\\u001f\"};export default [$0,$0];"},
    {"id": "norm-const-body-escaping-key-after-first", "class": "const/shared/object", "input": [$n38, $n38], "text": "const $0={\"a\":0,\"\u2028\":1};export default [$0,$0];"},
    {"id": "norm-const-body-first-slot-array", "class": "const/shared/twice", "input": [$p0, $p0, $p1, $p1, $p2, $p2, $p3, $p3, $p4, $p4, $p5, $p5, $p6, $p6, $p7, $p7, $p8, $p8, $p9, $p9, $p10, $p10, $p11, $p11, $p12, $p12, $p13, $p13, $p14, $p14, $p15, $p15, $p16, $p16, $p17, $p17, $p18, $p18, $p19, $p19, $p20, $p20, $p21, $p21, $p22, $p22, $p23, $p23, $p24, $p24, $p25, $p25, $p26, $p26, $p27, $p27, $p28, $p28, $p29, $p29, $p30, $p30, $p31, $p31, $p32, $p32, $p33, $p33, $p34, $p34], "text": "const $0=[null,0];const $1=[undefined,0];const $2=[NaN,0];const $3=[Infinity,0];const $4=[-Infinity,0];const $5=[-0,0];const $6=[false,0];const $7=[true,0];const $8=[\"\",0];const $9=[\"a\",0];const $10=[1n,0];const $11=[-1n,0];const $12=[0n,0];const $13=[109n,0];const $14=[-1,0];const $15=[[],0];const $16=[{},0];const $17=[109,0];const $18=[1.5,0];const $19=[0.1,0];const $20=[1000000000000000100,0];const $21=[100000000000000000000,0];const $22=[1e+21,0];const $23=[-1e+21,0];const $24=[0.000001,0];const $25=[1e-7,0];const $26=[1.5e-7,0];const $27=[-1.5e-7,0];const $28=[5e-324,0];const $29=[9007199254740992,0];const $30=[9007199254740992,0];const $31=[1.7976931348623157e+308,0];const $32=[9007199254740993n,0];const $33=[18446744073709551617n,0];const $34=[340282366920938463463374607431768211457n,0];export default [$0,$0,$1,$1,$2,$2,$3,$3,$4,$4,$5,$5,$6,$6,$7,$7,$8,$8,$9,$9,$10,$10,$11,$11,$12,$12,$13,$13,$14,$14,$15,$15,$16,$16,$17,$17,$18,$18,$19,$19,$20,$20,$21,$21,$22,$22,$23,$23,$24,$24,$25,$25,$26,$26,$27,$27,$28,$28,$29,$29,$30,$30,$31,$31,$32,$32,$33,$33,$34,$34];"},
    {"id": "norm-const-body-first-slot-object", "class": "const/shared/object", "input": [$q0, $q0, $q1, $q1, $q2, $q2, $q3, $q3, $q4, $q4, $q5, $q5, $q6, $q6, $q7, $q7, $q8, $q8, $q9, $q9, $q10, $q10, $q11, $q11, $q12, $q12, $q13, $q13, $q14, $q14, $q15, $q15, $q16, $q16, $q17, $q17, $q18, $q18, $q19, $q19, $q20, $q20, $q21, $q21, $q22, $q22, $q23, $q23, $q24, $q24, $q25, $q25, $q26, $q26, $q27, $q27, $q28, $q28, $q29, $q29, $q30, $q30, $q31, $q31, $q32, $q32, $q33, $q33, $q34, $q34], "text": "const $0={\"a\":null,\"b\":0};const $1={\"a\":undefined,\"b\":0};const $2={\"a\":NaN,\"b\":0};const $3={\"a\":Infinity,\"b\":0};const $4={\"a\":-Infinity,\"b\":0};const $5={\"a\":-0,\"b\":0};const $6={\"a\":false,\"b\":0};const $7={\"a\":true,\"b\":0};const $8={\"a\":\"\",\"b\":0};const $9={\"a\":\"a\",\"b\":0};const $10={\"a\":1n,\"b\":0};const $11={\"a\":-1n,\"b\":0};const $12={\"a\":0n,\"b\":0};const $13={\"a\":109n,\"b\":0};const $14={\"a\":-1,\"b\":0};const $15={\"a\":[],\"b\":0};const $16={\"a\":{},\"b\":0};const $17={\"a\":109,\"b\":0};const $18={\"a\":1.5,\"b\":0};const $19={\"a\":0.1,\"b\":0};const $20={\"a\":1000000000000000100,\"b\":0};const $21={\"a\":100000000000000000000,\"b\":0};const $22={\"a\":1e+21,\"b\":0};const $23={\"a\":-1e+21,\"b\":0};const $24={\"a\":0.000001,\"b\":0};const $25={\"a\":1e-7,\"b\":0};const $26={\"a\":1.5e-7,\"b\":0};const $27={\"a\":-1.5e-7,\"b\":0};const $28={\"a\":5e-324,\"b\":0};const $29={\"a\":9007199254740992,\"b\":0};const $30={\"a\":9007199254740992,\"b\":0};const $31={\"a\":1.7976931348623157e+308,\"b\":0};const $32={\"a\":9007199254740993n,\"b\":0};const $33={\"a\":18446744073709551617n,\"b\":0};const $34={\"a\":340282366920938463463374607431768211457n,\"b\":0};export default [$0,$0,$1,$1,$2,$2,$3,$3,$4,$4,$5,$5,$6,$6,$7,$7,$8,$8,$9,$9,$10,$10,$11,$11,$12,$12,$13,$13,$14,$14,$15,$15,$16,$16,$17,$17,$18,$18,$19,$19,$20,$20,$21,$21,$22,$22,$23,$23,$24,$24,$25,$25,$26,$26,$27,$27,$28,$28,$29,$29,$30,$30,$31,$31,$32,$32,$33,$33,$34,$34];"}
];
