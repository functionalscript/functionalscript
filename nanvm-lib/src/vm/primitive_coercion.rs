use crate::{
    nullish::Nullish,
    vm::{
        dispatch::Dispatch, join::Join, primitive::Primitive, Any, Array, BigInt, Function, IVm,
        Object, String,
    },
};

use std::result::Result;

const CANNOT_CONVERT_TO_PRIMITIVE_VALUE: &str = "TypeError: Cannot convert to primitive value";

fn arr_element_to_string<A: IVm>(v: Any<A>) -> Result<String<A>, Any<A>> {
    // https://tc39.es/ecma262/#sec-array.prototype.join: in case the element is nullish, on
    // joining it is represented as an empty string (see point 7.c: If element is neither undefined
    // nor null, then...)
    Nullish::try_from(v.clone())
        .map(|_| Ok("".into()))
        .unwrap_or_else(|_| v.to_string())
}

/// Preferred type for coercion to primitive, as per ECMAScript specification.
/// <https://tc39.es/ecma262/#sec-toprimitive>
/// Note that preferredType can be absent - we express that by using None value of
/// Option<ToPrimitivePreferredType>.
#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToPrimitivePreferredType {
    Number,
    String,
}

fn value_of<A: IVm, T>(
    _: T, /* Object<A> | Array<A> | Function<A> */
) -> Option<Result<Primitive<A>, Any<A>>> {
    // https://tc39.es/ecma262/#sec-object.prototype.valueof
    // TODO: implement a call to user-defined "valueOf" method.
    // For now, we return None since in ECMAScript the default Object.prototype.valueOf value is the
    // object itself, which is not a primitive.
    None
}

fn obj_to_string<A: IVm>(_o: Object<A>) -> Option<Result<Primitive<A>, Any<A>>> {
    // https://tc39.es/ecma262/#sec-object.prototype.tostring
    // TODO: implement a call to user-defined "toString" method, also, pay attention to built-in
    // values of %Symbol.toStringTag% property (which are different for different built-in types
    // more specific than Object: "Date", "RegExp", "Map" and so on).
    Some(Ok(Primitive::String("[object Object]".into())))
}

fn arr_to_string<A: IVm>(a: Array<A>) -> Option<Result<Primitive<A>, Any<A>>> {
    // https://tc39.es/ecma262/#sec-array.prototype.tostring
    // https://tc39.es/ecma262/#sec-array.prototype.join
    // TODO: implement a call to user-defined "toString" method, and, while implementing the default
    // behavior, implement a call to user-defined "join" methods. For now we shortcut to joining
    // the array elements - coerced to strings - with "," separator (that is the default separator:
    // per standard, Array.prototype.toString calls "join" with undefined separator).
    let s = a
        .into_iter()
        .map(|v| arr_element_to_string(v))
        .join(",".into());
    Some(s.map(Primitive::String))
}

fn fn_to_string<A: IVm>(_f: Function<A>) -> Option<Result<Primitive<A>, Any<A>>> {
    // https://tc39.es/ecma262/#sec-function.prototype.tostring
    // TODO: implement a call to user-defined "toString" method, and then the real implementation of
    // Function.prototype.toString (which returns the source code of the function as a string). For
    // now, we return "function" as a placeholder.
    Some(Ok(Primitive::String("function".into())))
}

fn obj_to_primitive<A: IVm>(
    o: Object<A>,
    preferred_type: ToPrimitivePreferredType,
) -> Result<Primitive<A>, Any<A>> {
    match preferred_type {
        ToPrimitivePreferredType::Number => match value_of(o.clone()) {
            Some(res) => res,
            None => match obj_to_string(o) {
                Some(res) => res,
                None => Err(CANNOT_CONVERT_TO_PRIMITIVE_VALUE.into()),
            },
        },
        ToPrimitivePreferredType::String => match obj_to_string(o.clone()) {
            Some(res) => res,
            None => match value_of(o) {
                Some(res) => res,
                None => Err(CANNOT_CONVERT_TO_PRIMITIVE_VALUE.into()),
            },
        },
    }
}

fn arr_to_primitive<A: IVm>(
    a: Array<A>,
    preferred_type: ToPrimitivePreferredType,
) -> Result<Primitive<A>, Any<A>> {
    match preferred_type {
        ToPrimitivePreferredType::Number => match value_of(a.clone()) {
            Some(res) => res,
            None => match arr_to_string(a) {
                Some(res) => res,
                None => Err(CANNOT_CONVERT_TO_PRIMITIVE_VALUE.into()),
            },
        },
        ToPrimitivePreferredType::String => match arr_to_string(a.clone()) {
            Some(res) => res,
            None => match value_of(a) {
                Some(res) => res,
                None => Err(CANNOT_CONVERT_TO_PRIMITIVE_VALUE.into()),
            },
        },
    }
}

fn fn_to_primitive<A: IVm>(
    f: Function<A>,
    preferred_type: ToPrimitivePreferredType,
) -> Result<Primitive<A>, Any<A>> {
    match preferred_type {
        ToPrimitivePreferredType::Number => match value_of(f.clone()) {
            Some(res) => res,
            None => match fn_to_string(f) {
                Some(res) => res,
                None => Err(CANNOT_CONVERT_TO_PRIMITIVE_VALUE.into()),
            },
        },
        ToPrimitivePreferredType::String => match fn_to_string(f.clone()) {
            Some(res) => res,
            None => match value_of(f) {
                Some(res) => res,
                None => Err(CANNOT_CONVERT_TO_PRIMITIVE_VALUE.into()),
            },
        },
    }
}

/// Coerces the value to a primitive type `Primitive<A>`, possibly producing an error result.
/// <https://tc39.es/ecma262/#sec-toprimitive>
#[allow(dead_code)]
pub struct PrimitiveCoercionOp(pub Option<ToPrimitivePreferredType>);

impl<A: IVm> Dispatch<A> for PrimitiveCoercionOp {
    type Result = std::result::Result<Primitive<A>, Any<A>>;

    fn nullish(self, v: Nullish) -> Self::Result {
        Ok(Primitive::Nullish(v))
    }

    fn bool(self, v: bool) -> Self::Result {
        Ok(Primitive::Boolean(v))
    }

    fn number(self, v: f64) -> Self::Result {
        Ok(Primitive::Number(v))
    }

    fn string(self, v: String<A>) -> Self::Result {
        Ok(Primitive::String(v))
    }

    fn bigint(self, v: BigInt<A>) -> Self::Result {
        Ok(Primitive::BigInt(v))
    }

    fn object(self, o: Object<A>) -> Self::Result {
        // https://tc39.es/ecma262/#sec-ordinarytoprimitive - point 2 defaults to number preference
        obj_to_primitive(o, self.0.unwrap_or(ToPrimitivePreferredType::Number))
    }

    fn array(self, a: Array<A>) -> Self::Result {
        // https://tc39.es/ecma262/#sec-ordinarytoprimitive - point 2 defaults to number preference
        arr_to_primitive(a, self.0.unwrap_or(ToPrimitivePreferredType::Number))
    }

    fn function(self, f: Function<A>) -> Self::Result {
        // https://tc39.es/ecma262/#sec-ordinarytoprimitive - point 2 defaults to number preference
        fn_to_primitive(f, self.0.unwrap_or(ToPrimitivePreferredType::Number))
    }
}
