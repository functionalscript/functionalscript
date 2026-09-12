const $s0 = [0];
const $s1 = {"a": 0};
const $s2 = [0];
const $s3 = [0];
const $s4 = {"a": 0};
const $s5 = [1];
const $s6 = [0];
const $s7 = [0];
const $s8 = [$s7];
const $s9 = {"x": $s7};
const $s10 = {"d": 0, "c": 1};
const $s11 = {};
const $s12 = {["__proto__"]: 0, "x": 1};
const $s14 = {"x": 0, ["__proto__"]: 1};
const $f0 = [null, 0, null];
const $f1 = [undefined, 0, undefined];
const $f2 = [NaN, 0, NaN];
const $f3 = [Infinity, 0, Infinity];
const $f4 = [-Infinity, 0, -Infinity];
const $f5 = [-0, 0, -0];
const $f6 = [false, 0, false];
const $f7 = [true, 0, true];
const $f8 = ["", 0, ""];
const $f9 = ["a", 0, "a"];
const $f10 = [1n, 0, 1n];
const $f11 = [-1n, 0, -1n];
const $f12 = [0n, 0, 0n];
const $f13 = [-1, 0, -1];
const $f14 = [[], 0, []];
const $f15 = [{}, 0, {}];
const $f16 = ["\"", 0, "\""];
const $f17 = ["\\", 0, "\\"];
const $f18 = ["\b", 0, "\b"];
const $f19 = ["\t", 0, "\t"];
const $f20 = ["\n", 0, "\n"];
const $f21 = ["\f", 0, "\f"];
const $f22 = ["\r", 0, "\r"];
const $f23 = ["\u0000", 0, "\u0000"];
const $f24 = ["\u001f", 0, "\u001f"];
const $g0 = {"a": null, "b": 0, "c": null};
const $g1 = {"a": undefined, "b": 0, "c": undefined};
const $g2 = {"a": NaN, "b": 0, "c": NaN};
const $g3 = {"a": Infinity, "b": 0, "c": Infinity};
const $g4 = {"a": -Infinity, "b": 0, "c": -Infinity};
const $g5 = {"a": -0, "b": 0, "c": -0};
const $g6 = {"a": false, "b": 0, "c": false};
const $g7 = {"a": true, "b": 0, "c": true};
const $g8 = {"a": "", "b": 0, "c": ""};
const $g9 = {"a": "a", "b": 0, "c": "a"};
const $g10 = {"a": 1n, "b": 0, "c": 1n};
const $g11 = {"a": -1n, "b": 0, "c": -1n};
const $g12 = {"a": 0n, "b": 0, "c": 0n};
const $g13 = {"a": -1, "b": 0, "c": -1};
const $g14 = {"a": [], "b": 0, "c": []};
const $g15 = {"a": {}, "b": 0, "c": {}};
const $g16 = {"a": "\"", "b": 0, "c": "\""};
const $g17 = {"a": "\\", "b": 0, "c": "\\"};
const $g18 = {"a": "\b", "b": 0, "c": "\b"};
const $g19 = {"a": "\t", "b": 0, "c": "\t"};
const $g20 = {"a": "\n", "b": 0, "c": "\n"};
const $g21 = {"a": "\f", "b": 0, "c": "\f"};
const $g22 = {"a": "\r", "b": 0, "c": "\r"};
const $g23 = {"a": "\u0000", "b": 0, "c": "\u0000"};
const $g24 = {"a": "\u001f", "b": 0, "c": "\u001f"};
const $s13 = {"\"": "\"", "\\": "\\", "\b": "\b", "\t": "\t", "\n": "\n", "\f": "\f", "\r": "\r", "\u0000": "\u0000", "\u001f": "\u001f"};
const $h0 = {"\"": 0, "a": 1};
const $h1 = {"\\": 0, "a": 1};
const $h2 = {"\b": 0, "a": 1};
const $h3 = {"\t": 0, "a": 1};
const $h4 = {"\n": 0, "a": 1};
const $h5 = {"\f": 0, "a": 1};
const $h6 = {"\r": 0, "a": 1};
const $h7 = {"\u0000": 0, "a": 1};
const $h8 = {"\u001f": 0, "a": 1};
const $h9 = {"a": 0, "\"": 1};
const $h10 = {"a": 0, "\\": 1};
const $h11 = {"a": 0, "\b": 1};
const $h12 = {"a": 0, "\t": 1};
const $h13 = {"a": 0, "\n": 1};
const $h14 = {"a": 0, "\f": 1};
const $h15 = {"a": 0, "\r": 1};
const $h16 = {"a": 0, "\u0000": 1};
const $h17 = {"a": 0, "\u001f": 1};
const $f25 = ["\u2028", 0, "\u2028"];
const $f26 = ["\ud800", 0, "\ud800"];
const $f27 = ["\ud800\udc00", 0, "\ud800\udc00"];
const $g25 = {"a": "\u2028", "b": 0, "c": "\u2028"};
const $g26 = {"a": "\ud800", "b": 0, "c": "\ud800"};
const $g27 = {"a": "\ud800\udc00", "b": 0, "c": "\ud800\udc00"};
const $h18 = {"\u2028": 0, "a": 1};
const $h19 = {"\ud800": 0, "a": 1};
const $h20 = {"\ud800\udc00": 0, "a": 1};
const $h21 = {"a": 0, "\u2028": 1};
const $h22 = {"a": 0, "\ud800": 1};
const $h23 = {"a": 0, "\ud800\udc00": 1};
const $t0 = [0];
export default [
    {"id": "ser-null", "class": "leaf/null", "input": null},
    {"id": "ser-true", "class": "leaf/boolean/true", "input": true},
    {"id": "ser-false", "class": "leaf/boolean/false", "input": false},
    {"id": "ser-undefined", "class": "leaf/undefined", "input": undefined},
    {"id": "ser-nan", "class": "leaf/nan", "input": NaN},
    {"id": "ser-infinity", "class": "infinity/plus", "input": Infinity},
    {"id": "ser-neg-infinity", "class": "infinity/minus", "input": -Infinity},
    {"id": "ser-number-0", "class": "number/int/zero", "input": 0},
    {"id": "ser-number-neg-0", "class": "number/int/zero/neg", "input": -0},
    {"id": "ser-number-9", "class": "number/int/digit9", "input": 9},
    {"id": "ser-number-neg-9", "class": "number/int/digit9/neg", "input": -9},
    {"id": "ser-number-109", "class": "number/int/digits", "input": 109},
    {"id": "ser-number-neg-109", "class": "number/int/digits/neg", "input": -109},
    {"id": "ser-number-1.5", "class": "number/frac", "input": 1.5},
    {"id": "ser-number-neg-1.5", "class": "number/frac/neg", "input": -1.5},
    {"id": "ser-number-subnormal", "class": "number/binary64/subnormal", "input": 5e-324},
    {"id": "ser-number-neg-subnormal", "class": "number/binary64/subnormal/neg", "input": -5e-324},
    {"id": "ser-number-max", "class": "number/binary64/max", "input": 1.7976931348623157e308},
    {"id": "ser-number-neg-max", "class": "number/binary64/max/neg", "input": -1.7976931348623157e308},
    {"id": "ser-bigint-0", "class": "bigint/zero", "input": 0n},
    {"id": "ser-bigint-109", "class": "bigint/digits", "input": 109n},
    {"id": "ser-bigint-neg-109", "class": "bigint/digits/neg", "input": -109n},
    {"id": "ser-bigint-2p53", "class": "bigint/past-2p53", "input": 9007199254740993n},
    {"id": "ser-bigint-neg-2p53", "class": "bigint/past-2p53/neg", "input": -9007199254740993n},
    {"id": "ser-bigint-2p64", "class": "bigint/past-2p64", "input": 18446744073709551617n},
    {"id": "ser-bigint-neg-2p64", "class": "bigint/past-2p64/neg", "input": -18446744073709551617n},
    {"id": "ser-bigint-2p128", "class": "bigint/past-2p128", "input": 340282366920938463463374607431768211457n},
    {"id": "ser-bigint-neg-2p128", "class": "bigint/past-2p128/neg", "input": -340282366920938463463374607431768211457n},
    {"id": "ser-array-empty", "class": "array/empty", "input": []},
    {"id": "ser-array-one", "class": "array/one", "input": [1]},
    {"id": "ser-array-three", "class": "array/three", "input": [1, 2, 3]},
    {"id": "ser-object-empty", "class": "object/empty", "input": {}},
    {"id": "ser-object-one", "class": "object/one", "input": {"a": 1}},
    {"id": "ser-object-three", "class": "object/three", "input": {"a": 1, "b": 2, "c": 3}},
    {"id": "ser-array-nested-array", "class": "array/nested/array", "input": [[1]]},
    {"id": "ser-array-nested-object", "class": "array/nested/object", "input": [{"a": 1}]},
    {"id": "ser-object-nested-object", "class": "object/nested/object", "input": {"a": {"b": 1}}},
    {"id": "ser-object-nested-array", "class": "object/nested/array", "input": {"a": [1]}},
    {"id": "ser-array-elements-every-value", "class": "array/elements/every-value", "input": [null, true, false, undefined, NaN, Infinity, -Infinity, 0, -0, 1.5, -1.5, 109n, -109n, "", "a", "\u2028", "\ud800", "\u0000", "\ud800\udc00", [], {}]},
    {"id": "ser-object-members-every-value", "class": "object/members/every-value", "input": {"a": null, "b": true, "c": false, "d": undefined, "e": NaN, "f": Infinity, "g": -Infinity, "h": 0, "i": -0, "j": 1.5, "k": -1.5, "l": 109n, "m": -109n, "n": "", "o": "a", "p": [], "q": {}, "r": "\u2028", "s": "\ud800", "t": "\u0000", "u": "\ud800\udc00"}},
    {"id": "ser-object-key-order-names-first-occurrence", "class": "object/key-order/names/first-occurrence", "input": {"b": 1, "a": 2, "c": 3}},
    {"id": "ser-object-key-order-index-before-name", "class": "object/key-order/index-before-name", "input": {"10": 1, "2": 2, "z": 3, "a": 4}},
    {"id": "ser-key-proto", "class": "key/proto", "input": {["__proto__"]: 1}},
    {"id": "ser-key-proto-among", "class": "key/proto/among", "input": {"a": 1, ["__proto__"]: 2, "b": 3}},
    {"id": "ser-string-escape-quote", "class": "string/escape/quote", "input": "\""},
    {"id": "ser-key-escape-quote", "class": "key/string/escape/quote", "input": {"\"": 0}},
    {"id": "ser-string-escape-backslash", "class": "string/escape/backslash", "input": "\\"},
    {"id": "ser-key-escape-backslash", "class": "key/string/escape/backslash", "input": {"\\": 0}},
    {"id": "ser-string-escape-u00-0000", "class": "string/escape/u00/0000", "input": "\u0000"},
    {"id": "ser-key-escape-u00-0000", "class": "key/string/escape/u00/0000", "input": {"\u0000": 0}},
    {"id": "ser-string-escape-u00-001f", "class": "string/escape/u00/001f", "input": "\u001f"},
    {"id": "ser-key-escape-u00-001f", "class": "key/string/escape/u00/001f", "input": {"\u001f": 0}},
    {"id": "ser-string-escape-b", "class": "string/escape/b", "input": "\b"},
    {"id": "ser-key-escape-b", "class": "key/string/escape/b", "input": {"\b": 0}},
    {"id": "ser-string-escape-t", "class": "string/escape/t", "input": "\t"},
    {"id": "ser-key-escape-t", "class": "key/string/escape/t", "input": {"\t": 0}},
    {"id": "ser-string-escape-n", "class": "string/escape/n", "input": "\n"},
    {"id": "ser-key-escape-n", "class": "key/string/escape/n", "input": {"\n": 0}},
    {"id": "ser-string-escape-f", "class": "string/escape/f", "input": "\f"},
    {"id": "ser-key-escape-f", "class": "key/string/escape/f", "input": {"\f": 0}},
    {"id": "ser-string-escape-r", "class": "string/escape/r", "input": "\r"},
    {"id": "ser-key-escape-r", "class": "key/string/escape/r", "input": {"\r": 0}},
    {"id": "ser-string-surrogate-lone-d800", "class": "string/surrogate/lone/d800", "input": "\ud800"},
    {"id": "ser-key-surrogate-lone-d800", "class": "key/string/surrogate/lone/d800", "input": {"\ud800": 0}},
    {"id": "ser-string-surrogate-lone-dbff", "class": "string/surrogate/lone/dbff", "input": "\udbff"},
    {"id": "ser-key-surrogate-lone-dbff", "class": "key/string/surrogate/lone/dbff", "input": {"\udbff": 0}},
    {"id": "ser-string-surrogate-lone-dc00", "class": "string/surrogate/lone/dc00", "input": "\udc00"},
    {"id": "ser-key-surrogate-lone-dc00", "class": "key/string/surrogate/lone/dc00", "input": {"\udc00": 0}},
    {"id": "ser-string-surrogate-lone-dfff", "class": "string/surrogate/lone/dfff", "input": "\udfff"},
    {"id": "ser-key-surrogate-lone-dfff", "class": "key/string/surrogate/lone/dfff", "input": {"\udfff": 0}},
    {"id": "ser-string-surrogate-pair-interior", "class": "string/surrogate/pair/interior", "input": "😀"},
    {"id": "ser-key-surrogate-pair-interior", "class": "key/string/surrogate/pair/interior", "input": {"😀": 0}},
    {"id": "ser-string-surrogate-pair-mixed", "class": "string/surrogate/pair/mixed", "input": "\ud800\udfff"},
    {"id": "ser-key-surrogate-pair-mixed", "class": "key/string/surrogate/pair/mixed", "input": {"\ud800\udfff": 0}},
    {"id": "ser-string-raw-latin", "class": "string/raw/bmp", "input": "é"},
    {"id": "ser-key-raw-latin", "class": "key/string/raw/bmp", "input": {"é": 0}},
    {"id": "ser-string-raw-0020", "class": "string/raw/range/0020-0021/low", "input": " "},
    {"id": "ser-key-raw-0020", "class": "key/string/raw/range/0020-0021/low", "input": {" ": 0}},
    {"id": "ser-string-raw-0800", "class": "string/raw/bmp", "input": "ࠀ"},
    {"id": "ser-key-raw-0800", "class": "key/string/raw/bmp", "input": {"ࠀ": 0}},
    {"id": "ser-string-raw-10000", "class": "string/raw/astral", "input": "𐀀"},
    {"id": "ser-key-raw-10000", "class": "key/string/raw/astral", "input": {"𐀀": 0}},
    {"id": "ser-string-raw-10ffff", "class": "string/raw/range/005d-10ffff/high", "input": "􏿿"},
    {"id": "ser-key-raw-10ffff", "class": "key/string/raw/range/005d-10ffff/high", "input": {"􏿿": 0}},
    {"id": "ser-string-raw-ws-like-00a0", "class": "string/raw/ws-like/00a0", "input": " "},
    {"id": "ser-key-raw-ws-like-00a0", "class": "key/string/raw/ws-like/00a0", "input": {" ": 0}},
    {"id": "ser-string-raw-ws-like-1680", "class": "string/raw/ws-like/1680", "input": " "},
    {"id": "ser-key-raw-ws-like-1680", "class": "key/string/raw/ws-like/1680", "input": {" ": 0}},
    {"id": "ser-string-raw-ws-like-2000", "class": "string/raw/ws-like/2000", "input": " "},
    {"id": "ser-key-raw-ws-like-2000", "class": "key/string/raw/ws-like/2000", "input": {" ": 0}},
    {"id": "ser-string-raw-ws-like-2001", "class": "string/raw/ws-like/2001", "input": " "},
    {"id": "ser-key-raw-ws-like-2001", "class": "key/string/raw/ws-like/2001", "input": {" ": 0}},
    {"id": "ser-string-raw-ws-like-2002", "class": "string/raw/ws-like/2002", "input": " "},
    {"id": "ser-key-raw-ws-like-2002", "class": "key/string/raw/ws-like/2002", "input": {" ": 0}},
    {"id": "ser-string-raw-ws-like-2003", "class": "string/raw/ws-like/2003", "input": " "},
    {"id": "ser-key-raw-ws-like-2003", "class": "key/string/raw/ws-like/2003", "input": {" ": 0}},
    {"id": "ser-string-raw-ws-like-2004", "class": "string/raw/ws-like/2004", "input": " "},
    {"id": "ser-key-raw-ws-like-2004", "class": "key/string/raw/ws-like/2004", "input": {" ": 0}},
    {"id": "ser-string-raw-ws-like-2005", "class": "string/raw/ws-like/2005", "input": " "},
    {"id": "ser-key-raw-ws-like-2005", "class": "key/string/raw/ws-like/2005", "input": {" ": 0}},
    {"id": "ser-string-raw-ws-like-2006", "class": "string/raw/ws-like/2006", "input": " "},
    {"id": "ser-key-raw-ws-like-2006", "class": "key/string/raw/ws-like/2006", "input": {" ": 0}},
    {"id": "ser-string-raw-ws-like-2007", "class": "string/raw/ws-like/2007", "input": " "},
    {"id": "ser-key-raw-ws-like-2007", "class": "key/string/raw/ws-like/2007", "input": {" ": 0}},
    {"id": "ser-string-raw-ws-like-2008", "class": "string/raw/ws-like/2008", "input": " "},
    {"id": "ser-key-raw-ws-like-2008", "class": "key/string/raw/ws-like/2008", "input": {" ": 0}},
    {"id": "ser-string-raw-ws-like-2009", "class": "string/raw/ws-like/2009", "input": " "},
    {"id": "ser-key-raw-ws-like-2009", "class": "key/string/raw/ws-like/2009", "input": {" ": 0}},
    {"id": "ser-string-raw-ws-like-200a", "class": "string/raw/ws-like/200a", "input": " "},
    {"id": "ser-key-raw-ws-like-200a", "class": "key/string/raw/ws-like/200a", "input": {" ": 0}},
    {"id": "ser-string-raw-ws-like-2028", "class": "string/raw/ws-like/2028", "input": " "},
    {"id": "ser-key-raw-ws-like-2028", "class": "key/string/raw/ws-like/2028", "input": {" ": 0}},
    {"id": "ser-string-raw-ws-like-2029", "class": "string/raw/ws-like/2029", "input": " "},
    {"id": "ser-key-raw-ws-like-2029", "class": "key/string/raw/ws-like/2029", "input": {" ": 0}},
    {"id": "ser-string-raw-ws-like-202f", "class": "string/raw/ws-like/202f", "input": " "},
    {"id": "ser-key-raw-ws-like-202f", "class": "key/string/raw/ws-like/202f", "input": {" ": 0}},
    {"id": "ser-string-raw-ws-like-205f", "class": "string/raw/ws-like/205f", "input": " "},
    {"id": "ser-key-raw-ws-like-205f", "class": "key/string/raw/ws-like/205f", "input": {" ": 0}},
    {"id": "ser-string-raw-ws-like-3000", "class": "string/raw/ws-like/3000", "input": "　"},
    {"id": "ser-key-raw-ws-like-3000", "class": "key/string/raw/ws-like/3000", "input": {"　": 0}},
    {"id": "ser-string-raw-ws-like-feff", "class": "string/raw/ws-like/feff", "input": "﻿"},
    {"id": "ser-key-raw-ws-like-feff", "class": "key/string/raw/ws-like/feff", "input": {"﻿": 0}},
    {"id": "ser-string-empty", "class": "string/empty", "input": ""},
    {"id": "ser-key-empty", "class": "key/string/empty", "input": {"": 0}},
    {"id": "ser-sharing-array", "class": "const/shared/twice", "input": [$s0, $s0]},
    {"id": "ser-sharing-object", "class": "const/shared/object", "input": {"x": $s1, "y": $s1}},
    {"id": "ser-sharing-mixed", "class": "const/shared/mixed", "input": [[$s2], {"x": $s2}]},
    {"id": "ser-string-raw-slash", "class": "string/raw/slash", "input": "/"},
    {"id": "ser-key-raw-slash", "class": "key/string/raw/slash", "input": {"/": 0}},
    {"id": "ser-string-raw-0023", "class": "string/raw/range/0023-005b/low", "input": "#"},
    {"id": "ser-key-raw-0023", "class": "key/string/raw/range/0023-005b/low", "input": {"#": 0}},
    {"id": "ser-string-raw-005b", "class": "string/raw/range/0023-005b/high", "input": "["},
    {"id": "ser-key-raw-005b", "class": "key/string/raw/range/0023-005b/high", "input": {"[": 0}},
    {"id": "ser-string-surrogate-adjacent-hh-d800", "class": "string/surrogate/adjacent/hh-d800", "input": "\ud800\ud800"},
    {"id": "ser-key-surrogate-adjacent-hh-d800", "class": "key/string/surrogate/adjacent/hh-d800", "input": {"\ud800\ud800": 0}},
    {"id": "ser-string-surrogate-adjacent-lh-dc00-d800", "class": "string/surrogate/adjacent/lh-dc00-d800", "input": "\udc00\ud800"},
    {"id": "ser-key-surrogate-adjacent-lh-dc00-d800", "class": "key/string/surrogate/adjacent/lh-dc00-d800", "input": {"\udc00\ud800": 0}},
    {"id": "ser-string-surrogate-adjacent-ll-dc00", "class": "string/surrogate/adjacent/ll-dc00", "input": "\udc00\udc00"},
    {"id": "ser-key-surrogate-adjacent-ll-dc00", "class": "key/string/surrogate/adjacent/ll-dc00", "input": {"\udc00\udc00": 0}},
    {"id": "ser-string-surrogate-adjacent-hh-dbff", "class": "string/surrogate/adjacent/hh-dbff", "input": "\udbff\udbff"},
    {"id": "ser-key-surrogate-adjacent-hh-dbff", "class": "key/string/surrogate/adjacent/hh-dbff", "input": {"\udbff\udbff": 0}},
    {"id": "ser-string-surrogate-adjacent-lh-dfff-dbff", "class": "string/surrogate/adjacent/lh-dfff-dbff", "input": "\udfff\udbff"},
    {"id": "ser-key-surrogate-adjacent-lh-dfff-dbff", "class": "key/string/surrogate/adjacent/lh-dfff-dbff", "input": {"\udfff\udbff": 0}},
    {"id": "ser-string-surrogate-adjacent-ll-dfff", "class": "string/surrogate/adjacent/ll-dfff", "input": "\udfff\udfff"},
    {"id": "ser-key-surrogate-adjacent-ll-dfff", "class": "key/string/surrogate/adjacent/ll-dfff", "input": {"\udfff\udfff": 0}},
    {"id": "ser-string-surrogate-adjacent-hh-d800-dbff", "class": "string/surrogate/adjacent/hh-d800-dbff", "input": "\ud800\udbff"},
    {"id": "ser-key-surrogate-adjacent-hh-d800-dbff", "class": "key/string/surrogate/adjacent/hh-d800-dbff", "input": {"\ud800\udbff": 0}},
    {"id": "ser-shared-two-nodes", "class": "const/shared/two-nodes", "input": [$s3, $s4, $s3, $s4]},
    {"id": "ser-key-proto-nested", "class": "key/proto/nested", "input": [{["__proto__"]: {["__proto__"]: 1}}]},
    {"id": "ser-key-proto-value-shared", "class": "key/proto/value/shared", "input": {["__proto__"]: $s6, "x": $s6}},
    {"id": "ser-string-raw-007f", "class": "string/raw/bmp", "input": "\u007f"},
    {"id": "ser-key-raw-007f", "class": "key/string/raw/bmp", "input": {"\u007f": 0}},
    {"id": "ser-string-raw-0080", "class": "string/raw/bmp", "input": "\u0080"},
    {"id": "ser-key-raw-0080", "class": "key/string/raw/bmp", "input": {"\u0080": 0}},
    {"id": "ser-string-raw-07ff", "class": "string/raw/bmp", "input": "\u07ff"},
    {"id": "ser-key-raw-07ff", "class": "key/string/raw/bmp", "input": {"\u07ff": 0}},
    {"id": "ser-string-raw-d7ff", "class": "string/raw/bmp", "input": "\ud7ff"},
    {"id": "ser-key-raw-d7ff", "class": "key/string/raw/bmp", "input": {"\ud7ff": 0}},
    {"id": "ser-string-raw-e000", "class": "string/raw/bmp", "input": "\ue000"},
    {"id": "ser-key-raw-e000", "class": "key/string/raw/bmp", "input": {"\ue000": 0}},
    {"id": "ser-string-raw-ffff", "class": "string/raw/bmp", "input": "\uffff"},
    {"id": "ser-key-raw-ffff", "class": "key/string/raw/bmp", "input": {"\uffff": 0}},
    {"id": "ser-const-shared-nested", "class": "const/shared/nested", "input": [$s8, $s8, $s7]},
    {"id": "ser-shared-three-paths", "class": "const/shared/three-paths", "input": [$s5, {"a": $s5}, {"b": [$s5]}]},
    {"id": "ser-string-raw-0021", "class": "string/raw/range/0020-0021/high", "input": "!"},
    {"id": "ser-key-raw-0021", "class": "key/string/raw/range/0020-0021/high", "input": {"!": 0}},
    {"id": "ser-string-raw-005d", "class": "string/raw/range/005d-10ffff/low", "input": "]"},
    {"id": "ser-key-raw-005d", "class": "key/string/raw/range/005d-10ffff/low", "input": {"]": 0}},
    {"id": "ser-array-elements-negative-first", "class": "array/elements/negative-first", "input": [-1, -1n, -Infinity]},
    {"id": "ser-array-elements-negative-zero-first", "class": "array/elements/negative-first", "input": [-0, 1]},
    {"id": "ser-array-elements-negative-bigint-first", "class": "array/elements/negative-first", "input": [-1n, 1]},
    {"id": "ser-array-elements-negative-infinity-first", "class": "array/elements/negative-first", "input": [-Infinity, 1]},
    {"id": "ser-object-members-negative-first-zero", "class": "object/members/negative-first", "input": {"a": -0, "b": 1}},
    {"id": "ser-object-members-negative-first-number", "class": "object/members/negative-first", "input": {"a": -1, "b": 1}},
    {"id": "ser-object-members-negative-first-bigint", "class": "object/members/negative-first", "input": {"a": -1n, "b": 1}},
    {"id": "ser-object-members-negative-first-infinity", "class": "object/members/negative-first", "input": {"a": -Infinity, "b": 1}},
    {"id": "ser-object-key-order-boundaries", "class": "object/key-order/boundaries", "input": {"z": 0, "4294967295": 0, "4294967294": 0, "2147483648": 0, "1": 0, "01": 0, "1.0": 0, "0": 0}},
    {"id": "ser-object-key-order-non-index-negative", "class": "object/key-order/non-index/negative", "input": {"z": 0, "-1": 1, "1": 2}},
    {"id": "ser-object-key-order-non-index-negative-zero", "class": "object/key-order/non-index/negative-zero", "input": {"z": 0, "-0": 1, "1": 2}},
    {"id": "ser-object-key-order-non-index-plus", "class": "object/key-order/non-index/plus", "input": {"z": 0, "+1": 1, "1": 2}},
    {"id": "ser-object-key-order-non-index-space", "class": "object/key-order/non-index/space", "input": {"z": 0, " 1": 1, "1": 2}},
    {"id": "ser-object-key-order-non-index-hex", "class": "object/key-order/non-index/hex", "input": {"z": 0, "0x1": 1, "1": 2}},
    {"id": "ser-object-key-order-non-index-exp", "class": "object/key-order/non-index/exp", "input": {"z": 0, "1e0": 1, "1": 2}},
    {"id": "ser-object-key-order-non-index-above", "class": "object/key-order/non-index/above", "input": {"z": 0, "4294967296": 1, "1": 2}},
    {"id": "ser-string-escape-quote-every-slot", "class": "string/escape/quote", "input": ["\"", 0, "\""]},
    {"id": "ser-key-escape-quote-every-slot", "class": "key/string/escape/quote", "input": [{"\"": "\"", "a": 1}, {"a": 0, "\"": "\""}]},
    {"id": "ser-string-escape-backslash-every-slot", "class": "string/escape/backslash", "input": ["\\", 0, "\\"]},
    {"id": "ser-key-escape-backslash-every-slot", "class": "key/string/escape/backslash", "input": [{"\\": "\\", "a": 1}, {"a": 0, "\\": "\\"}]},
    {"id": "ser-string-escape-b-every-slot", "class": "string/escape/b", "input": ["\b", 0, "\b"]},
    {"id": "ser-key-escape-b-every-slot", "class": "key/string/escape/b", "input": [{"\b": "\b", "a": 1}, {"a": 0, "\b": "\b"}]},
    {"id": "ser-string-escape-t-every-slot", "class": "string/escape/t", "input": ["\t", 0, "\t"]},
    {"id": "ser-key-escape-t-every-slot", "class": "key/string/escape/t", "input": [{"\t": "\t", "a": 1}, {"a": 0, "\t": "\t"}]},
    {"id": "ser-string-escape-n-every-slot", "class": "string/escape/n", "input": ["\n", 0, "\n"]},
    {"id": "ser-key-escape-n-every-slot", "class": "key/string/escape/n", "input": [{"\n": "\n", "a": 1}, {"a": 0, "\n": "\n"}]},
    {"id": "ser-string-escape-f-every-slot", "class": "string/escape/f", "input": ["\f", 0, "\f"]},
    {"id": "ser-key-escape-f-every-slot", "class": "key/string/escape/f", "input": [{"\f": "\f", "a": 1}, {"a": 0, "\f": "\f"}]},
    {"id": "ser-string-escape-r-every-slot", "class": "string/escape/r", "input": ["\r", 0, "\r"]},
    {"id": "ser-key-escape-r-every-slot", "class": "key/string/escape/r", "input": [{"\r": "\r", "a": 1}, {"a": 0, "\r": "\r"}]},
    {"id": "ser-string-escape-u00-0000-every-slot", "class": "string/escape/u00/0000", "input": ["\u0000", 0, "\u0000"]},
    {"id": "ser-key-escape-u00-0000-every-slot", "class": "key/string/escape/u00/0000", "input": [{"\u0000": "\u0000", "a": 1}, {"a": 0, "\u0000": "\u0000"}]},
    {"id": "ser-string-escape-u00-001f-every-slot", "class": "string/escape/u00/001f", "input": ["\u001f", 0, "\u001f"]},
    {"id": "ser-key-escape-u00-001f-every-slot", "class": "key/string/escape/u00/001f", "input": [{"\u001f": "\u001f", "a": 1}, {"a": 0, "\u001f": "\u001f"}]},
    {"id": "ser-array-elements-every-value-first", "class": "array/elements/every-value-first", "input": [[null, 0], [true, 0], [false, 0], [undefined, 0], [NaN, 0], [Infinity, 0], [-Infinity, 0], [0, 0], [-0, 0], [1.5, 0], [-1.5, 0], [109n, 0], [-109n, 0], [0n, 0], ["", 0], ["a", 0], ["\u2028", 0], ["\ud800", 0], ["\u0000", 0], ["\ud800\udc00", 0], [[], 0], [{}, 0]]},
    {"id": "ser-object-members-every-value-first", "class": "object/members/every-value-first", "input": [{"a": null, "b": 0}, {"a": true, "b": 0}, {"a": false, "b": 0}, {"a": undefined, "b": 0}, {"a": NaN, "b": 0}, {"a": Infinity, "b": 0}, {"a": -Infinity, "b": 0}, {"a": 0, "b": 0}, {"a": -0, "b": 0}, {"a": 1.5, "b": 0}, {"a": -1.5, "b": 0}, {"a": 109n, "b": 0}, {"a": -109n, "b": 0}, {"a": 0n, "b": 0}, {"a": "", "b": 0}, {"a": "a", "b": 0}, {"a": "\u2028", "b": 0}, {"a": "\ud800", "b": 0}, {"a": "\u0000", "b": 0}, {"a": "\ud800\udc00", "b": 0}, {"a": [], "b": 0}, {"a": {}, "b": 0}]},
    {"id": "ser-object-key-order-nested", "class": "object/key-order/nested", "input": [{"b": 0, "a": 1}, {"x": {"b": 0, "a": 1}}, $s10, $s10]},
    {"id": "ser-const-shared-nested-object-parent", "class": "const/shared/nested", "input": [$s9, $s9, $s7]},
    {"id": "ser-object-keys-every-string", "class": "object/keys/every-string", "input": [{"\u2028": 0, "\ud800": 1, "\u0000": 2, "\ud800\udc00": 3, "a": 4}]},
    {"id": "ser-shared-empty-object", "class": "const/shared/object", "input": [$s11, $s11]},
    {"id": "ser-shared-empty-object-object-parent", "class": "const/shared/object", "input": {"x": $s11, "y": $s11}},
    {"id": "ser-shared-object-proto-key", "class": "const/shared/object", "input": [$s12, $s12, $s14, $s14]},
    {"id": "ser-shared-object-escaped-keys", "class": "const/shared/object", "input": [$s13, $s13]},
    {"id": "ser-const-body-every-slot-array", "class": "const/shared/twice", "input": [$f0, $f0, $f1, $f1, $f2, $f2, $f3, $f3, $f4, $f4, $f5, $f5, $f6, $f6, $f7, $f7, $f8, $f8, $f9, $f9, $f10, $f10, $f11, $f11, $f12, $f12, $f13, $f13, $f14, $f14, $f15, $f15, $f16, $f16, $f17, $f17, $f18, $f18, $f19, $f19, $f20, $f20, $f21, $f21, $f22, $f22, $f23, $f23, $f24, $f24, $f25, $f25, $f26, $f26, $f27, $f27]},
    {"id": "ser-const-body-every-slot-object", "class": "const/shared/object", "input": [$g0, $g0, $g1, $g1, $g2, $g2, $g3, $g3, $g4, $g4, $g5, $g5, $g6, $g6, $g7, $g7, $g8, $g8, $g9, $g9, $g10, $g10, $g11, $g11, $g12, $g12, $g13, $g13, $g14, $g14, $g15, $g15, $g16, $g16, $g17, $g17, $g18, $g18, $g19, $g19, $g20, $g20, $g21, $g21, $g22, $g22, $g23, $g23, $g24, $g24, $g25, $g25, $g26, $g26, $g27, $g27]},
    {"id": "ser-shared-object-escaping-key-every-slot", "class": "const/shared/object", "input": [$h0, $h0, $h1, $h1, $h2, $h2, $h3, $h3, $h4, $h4, $h5, $h5, $h6, $h6, $h7, $h7, $h8, $h8, $h9, $h9, $h10, $h10, $h11, $h11, $h12, $h12, $h13, $h13, $h14, $h14, $h15, $h15, $h16, $h16, $h17, $h17, $h18, $h18, $h19, $h19, $h20, $h20, $h21, $h21, $h22, $h22, $h23, $h23]},
    {"id": "ser-key-proto-value-shared-later", "class": "key/proto/value/shared", "input": {"x": $t0, ["__proto__"]: $t0}}
];
