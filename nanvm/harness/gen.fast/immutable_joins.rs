// Fixture source: `fjs/nanvm/fast/immutable_joins/module.f.mjs`; regenerate with `npm run gen`.

use nanvm_lib::vm::unstable::{f64_any, string_any, string_key};
use nanvm_lib::vm::{Any, Array, IStaticFunction, Nullish, ToAny, ToArray, ToObject};

#[rustfmt::skip]
#[allow(clippy::if_same_then_else)]
pub fn module<A: IStaticFunction>(_runtime: Any<A>) -> Result<Any<A>, Any<A>> {
    Ok([(string_key("parameterizedJoin"), A::static_function(|_self, _args| {
        let _b0_3: Any<A> = A::static_function(|_self, _args| { Any::call(A::frame(_self)[0].clone(), [(_args.argument(0) + f64_any(0x4014000000000000))?].to_array().to_any()) }, 1, [_args.argument(2)].to_array(), Some("($1)=>$0($1+5)")).to_any();
        if Any::<A>::to_boolean(_args.argument(0)) {
            if Any::<A>::to_boolean(_args.argument(1)) { return Ok(f64_any(0x4045000000000000)); }
            return Any::call(_b0_3.clone(), [f64_any(0x4008000000000000)].to_array().to_any());
        }
        Any::call(_b0_3.clone(), [f64_any(0x0000000000000000)].to_array().to_any())
    }, 3, Array::default(), Some("($0,$1,$2)=>{const $3=($4)=>$2($4+5);if($0){if($1){return 42;}return $3(3);}return $3(0);}")).to_any()), (string_key("nested"), A::static_function(|_self, _args| {
        let _b0_9: Any<A> = A::static_function(|_self, _args| { Any::call(A::frame(_self)[0].clone(), [_args.argument(0)].to_array().to_any()) }, 1, [_args.argument(3)].to_array(), Some("($1)=>$0($1)")).to_any();
        if Any::<A>::to_boolean(_args.argument(0)) {
            let _b0_11: Any<A> = (Any::call(_args.argument(2), Array::default().to_any()))?;
            let _b0_12: Any<A> = (Any::dot(_b0_11.clone(), string_any("a")).end())?;
            if Any::<A>::to_boolean((Any::dot(_b0_11.clone(), string_any("b")).end())?) { return Any::dot(_b0_11.clone(), string_any("c")).end(); }
            return Any::call(_b0_9.clone(), [_b0_12.clone()].to_array().to_any());
        }
        Any::call(_b0_9.clone(), [_args.argument(1)].to_array().to_any())
    }, 4, Array::default(), Some("($0,$1,$2,$3)=>{const $4=($5)=>$3($5);if($0){const $6=$2();const $7=$6.a;if($6.b){return $6.c;}return $4($7);}return $4($1);}")).to_any()), (string_key("graphParameterizedJoin"), {
        let _b8: Any<A> = A::static_function(|_self, _args| {
            let _b337_17: Any<A> = _args.argument(0);
            let _b338_18: Any<A> = _args.argument(1);
            let _b339_19: Any<A> = _args.argument(2);
            let _b0_20: Any<A> = A::static_function(|_self, _args| { Any::call(A::frame(_self)[0].clone(), [(_args.argument(0) + f64_any(0x4014000000000000))?].to_array().to_any()) }, 1, [_b339_19.clone()].to_array(), Some("($1)=>$0($1+5)")).to_any();
            if Any::<A>::to_boolean(_b337_17.clone()) {
                if Any::<A>::to_boolean(_b338_18.clone()) { return Ok(f64_any(0x4045000000000000)); }
                return Any::call(_b0_20.clone(), [f64_any(0x4008000000000000)].to_array().to_any());
            }
            Any::call(_b0_20.clone(), [f64_any(0x0000000000000000)].to_array().to_any())
        }, 3, Array::default(), Some("($0,$1,$2)=>{const $3=$0;const $4=$1;const $5=$2;const $6=($7)=>$5($7+5);if($3){if($4){return 42;}return $6(3);}return $6(0);}")).to_any();
        _b8.clone()
    }), (string_key("graphNested"), {
        let _b13: Any<A> = A::static_function(|_self, _args| {
            let _b612_27: Any<A> = _args.argument(0);
            let _b613_28: Any<A> = _args.argument(1);
            let _b614_29: Any<A> = _args.argument(2);
            let _b615_30: Any<A> = _args.argument(3);
            let _b0_31: Any<A> = A::static_function(|_self, _args| { Any::call(A::frame(_self)[0].clone(), [_args.argument(0)].to_array().to_any()) }, 1, [_b615_30.clone()].to_array(), Some("($1)=>$0($1)")).to_any();
            if Any::<A>::to_boolean(_b612_27.clone()) {
                let _b2: Any<A> = (Any::call(_b614_29.clone(), Array::default().to_any()))?;
                let _b3: Any<A> = (Any::dot(_b2.clone(), string_any("a")).end())?;
                let _b658: Any<A> = _b3.clone();
                if Any::<A>::to_boolean((Any::dot(_b2.clone(), string_any("b")).end())?) { return Any::dot(_b2.clone(), string_any("c")).end(); }
                return Any::call(_b0_31.clone(), [_b3.clone()].to_array().to_any());
            }
            Any::call(_b0_31.clone(), [_b613_28.clone()].to_array().to_any())
        }, 4, Array::default(), Some("($0,$1,$2,$3)=>{const $4=$0;const $5=$1;const $6=$2;const $7=$3;const $8=($9)=>$7($9);if($4){const $10=$6();const $11=$10.a;const $12=$11;if($10.b){return $10.c;}return $8($11);}return $8($5);}")).to_any();
        _b13.clone()
    }), (string_key("operation"), A::static_function(|_self, _args| {
        let _b0_37: Any<A> = [_args.argument(0)].to_array().to_any();
        Ok([_b0_37.clone(), _b0_37.clone(), A::static_function(|_self, _args| { Ok(A::frame(_self)[0].clone()) }, 0, [_b0_37.clone()].to_array(), Some("()=>$0")).to_any()].to_array().to_any())
    }, 1, Array::default(), Some("($0)=>{const $1=[$0];return [$1,$1,()=>$1];}")).to_any()), (string_key("factoryNormal"), A::static_function(|_self, _args| { Ok([(string_key("a"), f64_any(0x4008000000000000)), (string_key("b"), false.to_any()), (string_key("c"), f64_any(0x4053400000000000))].to_object().to_any()) }, 0, Array::default(), Some("()=>{return {\"a\":3,\"b\":false,\"c\":77};}")).to_any()), (string_key("factoryEarly"), A::static_function(|_self, _args| { Ok([(string_key("a"), f64_any(0x4008000000000000)), (string_key("b"), true.to_any()), (string_key("c"), f64_any(0x4053400000000000))].to_object().to_any()) }, 0, Array::default(), Some("()=>{return {\"a\":3,\"b\":true,\"c\":77};}")).to_any()), (string_key("failing"), A::static_function(|_self, _args| { Err(string_any("selected callback")) }, 0, Array::default(), Some("()=>{throw \"selected callback\";}")).to_any()), (string_key("graphTailSum"), {
        let _b8_39: Any<A> = A::static_function(|_self, _args| {
            let _b659: Any<A> = _args.argument(0);
            let _b660: Any<A> = _args.argument(1);
            let mut _b661: Any<A> = _b659.clone();
            let mut _b662: Any<A> = _b660.clone();
            let mut _b663: Any<A> = Nullish::Undefined.to_any();
            '_loop8: loop {
                let _b337_47: Any<A> = _b661.clone();
                let _b338_48: Any<A> = _b662.clone();
                if Any::<A>::to_boolean((Any::gt(_b337_47.clone(), f64_any(0x0000000000000000)))?) {
                    let _b664: Any<A> = (_b337_47.clone() - f64_any(0x3ff0000000000000))?;
                    let _b665: Any<A> = (_b338_48.clone() + f64_any(0x3ff0000000000000))?;
                    _b661 = _b664.clone();
                    _b662 = _b665.clone();
                    continue '_loop8;
                } else {
                    let _b666: Any<A> = _b338_48.clone();
                    _b663 = _b666.clone();
                    break '_loop8;
                }
            }
            let _b356: Any<A> = _b663.clone();
            Ok(_b356.clone())
        }, 2, Array::default(), Some("($0,$1)=>{const $2=$0;const $3=$1;let $4=$2;let $5=$3;let $6=undefined;L0:while(true){const $7=$4;const $8=$5;if($7>0){const $9=$7-1;const $10=$8+1;$4=$9;$5=$10;continue L0;}else{const $11=$8;$6=$11;break L0;}}const $12=$6;return $12;}")).to_any();
        _b8_39.clone()
    })].to_object().to_any())
}
