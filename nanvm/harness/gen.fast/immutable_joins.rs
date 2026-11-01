// Fixture source: `fjs/nanvm/fast/immutable_joins/module.f.mjs`; regenerate with `npm run gen`.

use nanvm_lib::vm::unstable::{f64_any, string_any, string_key};
use nanvm_lib::vm::{Any, Array, IStaticFunction, ToAny, ToArray, ToObject};

#[rustfmt::skip]
#[allow(clippy::if_same_then_else)]
pub fn module<A: IStaticFunction>(_runtime: Any<A>) -> Result<Any<A>, Any<A>> {
    Ok([(string_key("parameterizedJoin"), A::static_function(|_self, _args| {
        let _b0_3: Any<A> = A::static_function(|_self, _args| { Any::call(A::frame(_self)[0].clone(), [(_args.argument(0) + f64_any(0x4014000000000000))?].to_array().to_any()) }, 1, [_args.argument(2)].to_array(), Some("($1)=>$0($1+5)")).to_any();
        if Any::<A>::to_boolean(_args.argument(0)) {
            if Any::<A>::to_boolean(_args.argument(1)) { return Ok(f64_any(0x4045000000000000)); } else {

            }
            return Any::call(_b0_3.clone(), [f64_any(0x4008000000000000)].to_array().to_any());
        } else {

        }
        Any::call(_b0_3.clone(), [f64_any(0x0000000000000000)].to_array().to_any())
    }, 3, Array::default(), Some("($0,$1,$2)=>{const $3=($4)=>$2($4+5);if($0){if($1){return 42;}else{}return $3(3);}else{}return $3(0);}")).to_any()), (string_key("nested"), A::static_function(|_self, _args| {
        let _b0_9: Any<A> = A::static_function(|_self, _args| { Any::call(A::frame(_self)[0].clone(), [_args.argument(0)].to_array().to_any()) }, 1, [_args.argument(3)].to_array(), Some("($1)=>$0($1)")).to_any();
        if Any::<A>::to_boolean(_args.argument(0)) {
            let _b0_11: Any<A> = (Any::call(_args.argument(2), Array::default().to_any()))?;
            let _b0_12: Any<A> = (Any::dot(_b0_11.clone(), string_any("a")).end())?;
            if Any::<A>::to_boolean((Any::dot(_b0_11.clone(), string_any("b")).end())?) { return Any::dot(_b0_11.clone(), string_any("c")).end(); } else {

            }
            return Any::call(_b0_9.clone(), [_b0_12.clone()].to_array().to_any());
        } else {

        }
        Any::call(_b0_9.clone(), [_args.argument(1)].to_array().to_any())
    }, 4, Array::default(), Some("($0,$1,$2,$3)=>{const $4=($5)=>$3($5);if($0){const $6=$2();const $7=$6.a;if($6.b){return $6.c;}else{}return $4($7);}else{}return $4($1);}")).to_any()), (string_key("operation"), A::static_function(|_self, _args| {
        let _b0_14: Any<A> = [_args.argument(0)].to_array().to_any();
        Ok([_b0_14.clone(), _b0_14.clone(), A::static_function(|_self, _args| { Ok(A::frame(_self)[0].clone()) }, 0, [_b0_14.clone()].to_array(), Some("()=>$0")).to_any()].to_array().to_any())
    }, 1, Array::default(), Some("($0)=>{const $1=[$0];return [$1,$1,()=>$1];}")).to_any()), (string_key("factoryNormal"), A::static_function(|_self, _args| { Ok([(string_key("a"), f64_any(0x4008000000000000)), (string_key("b"), false.to_any()), (string_key("c"), f64_any(0x4053400000000000))].to_object().to_any()) }, 0, Array::default(), Some("()=>{return {\"a\":3,\"b\":false,\"c\":77};}")).to_any()), (string_key("factoryEarly"), A::static_function(|_self, _args| { Ok([(string_key("a"), f64_any(0x4008000000000000)), (string_key("b"), true.to_any()), (string_key("c"), f64_any(0x4053400000000000))].to_object().to_any()) }, 0, Array::default(), Some("()=>{return {\"a\":3,\"b\":true,\"c\":77};}")).to_any()), (string_key("failing"), A::static_function(|_self, _args| { Err(string_any("selected callback")) }, 0, Array::default(), Some("()=>{throw \"selected callback\";}")).to_any())].to_object().to_any())
}
