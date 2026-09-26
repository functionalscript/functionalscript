use crate::{
    common::sized_index::SizedIndex,
    vm::{
        Any, Array, Function, IVm, Nullish, Number, ToAny, ToArray, Unpacked,
        array::callback::callback,
    },
};

/// A built-in member function: the receiver and the arguments, already the
/// `Array` a call spreads — `Member::call` converts them before any
/// built-in runs, throwing for a non-array as `Any::call` does — answering
/// the value or the throw.
pub(crate) type Method<A> = fn(Any<A>, Array<A>) -> Result<Any<A>, Any<A>>;

/// The built-in member function a key names on the receiver's type, for
/// the receiver a call step has found no own property on. The names a
/// module may call are `allowedCalls` in `fjs/js/prototype`, and which of
/// them this table answers, type by type, is
/// `nanvm-lib/todo/member-functions.md`; a name the table lacks is `None`,
/// and the call throws as JavaScript throws on a type without the method.
///
/// `toString` needs no receiver type: every type has it. Every other name
/// is the receiver type's own table, one function per type below.
pub(crate) fn method<A: IVm>(receiver: &Any<A>, key: &Any<A>) -> Option<Method<A>> {
    if *key == "toString".into() {
        return Some(to_string);
    }
    match Unpacked::from(receiver.clone()) {
        Unpacked::Array(_) => array(key),
        Unpacked::String(_) => super::string::string(key),
        _ => None,
    }
}

/// The entry of `table` whose name is `key`.
pub(super) fn lookup<A: IVm, const N: usize>(
    table: [(&str, Method<A>); N],
    key: &Any<A>,
) -> Option<Method<A>> {
    table
        .into_iter()
        .find(|(name, _)| *key == (*name).into())
        .map(|(_, m)| m)
}

/// `Array.prototype`'s.
fn array<A: IVm>(key: &Any<A>) -> Option<Method<A>> {
    let table: [(&str, Method<A>); 23] = [
        ("at", array_at),
        ("concat", array_concat),
        ("every", array_every),
        ("filter", array_filter),
        ("find", array_find),
        ("findIndex", array_find_index),
        ("findLast", array_find_last),
        ("findLastIndex", array_find_last_index),
        ("flat", array_flat),
        ("flatMap", array_flat_map),
        ("includes", array_includes),
        ("indexOf", array_index_of),
        ("join", array_join),
        ("lastIndexOf", array_last_index_of),
        ("map", array_map),
        ("reduce", array_reduce),
        ("reduceRight", array_reduce_right),
        ("slice", array_slice),
        ("some", array_some),
        ("toReversed", array_to_reversed),
        ("toSorted", array_to_sorted),
        ("toSpliced", array_to_spliced),
        ("with", array_with),
    ];
    lookup(table, key)
}

/// The `i`-th argument, or `undefined` past the end, as a built-in reads
/// a parameter the call left out.
pub(super) fn argument<A: IVm>(args: &Array<A>, i: u32) -> Any<A> {
    if i < args.length() {
        args[i].clone()
    } else {
        Nullish::Undefined.to_any()
    }
}

/// The `i`-th argument if the call passed one, `undefined` included, and
/// `None` if it did not: for the few built-ins whose answer depends on
/// whether an argument is there, not only on its value — `lastIndexOf(x)`
/// searches from the end, `lastIndexOf(x, undefined)` from `0`.
pub(super) fn present<A: IVm>(args: &Array<A>, i: u32) -> Option<Any<A>> {
    (i < args.length()).then(|| args[i].clone())
}

/// The arguments from the `i`-th on, as a rest parameter reads them.
pub(super) fn rest<A: IVm>(args: &Array<A>, i: u32) -> Array<A> {
    (i..args.length().max(i))
        .map(|k| args[k].clone())
        .to_array()
}

/// A search's position as JavaScript answers it: the index, or `-1`.
pub(super) fn position<A: IVm>(found: Option<u32>) -> Any<A> {
    Number::from(found.map_or(-1.0, f64::from)).to_any()
}

/// `toString()`: a dispatch to `Any::to_string`, the `String(x)` conversion,
/// which answers what the method answers for a number, a boolean, a
/// bigint, a string, an object and an array. Two things it does not do yet,
/// both tracked in `member-functions.md`: a function answers the placeholder
/// the conversion answers, not its source, and a radix is not applied.
///
/// So a number or a bigint given a radix other than the default — absent,
/// `undefined` or `10` — throws rather than answers in radix ten:
/// `(255).toString(16)` is `"ff"` in JavaScript, and `"255"` would be a
/// different successful value (DESIGN.md §10). Every other type's
/// `toString` ignores its arguments, as JavaScript's does.
fn to_string<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    if matches!(
        Unpacked::from(receiver.clone()),
        Unpacked::Number(_) | Unpacked::BigInt(_)
    ) {
        let default_radix = match Unpacked::from(argument(&args, 0)) {
            Unpacked::Nullish(Nullish::Undefined) => true,
            Unpacked::Number(radix) => f64::from(radix) == 10.0,
            _ => false,
        };
        if !default_radix {
            return Err("RangeError: a toString radix other than 10 is not supported yet".into());
        }
    }
    receiver.to_string().map(|s| s.to_any())
}

/// `Array.prototype.at`, `vm/array/at.rs`. The receiver is the array
/// [`method`] matched, so the conversion cannot throw.
fn array_at<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    Array::try_from(receiver)?.at(argument(&args, 0))
}

/// `Array.prototype.includes`, `vm/array/includes.rs`.
fn array_includes<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let found = Array::try_from(receiver)?.includes(&argument(&args, 0), argument(&args, 1))?;
    Ok(found.to_any())
}

/// `Array.prototype.indexOf`, `vm/array/index_of.rs`.
fn array_index_of<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let found = Array::try_from(receiver)?.index_of(&argument(&args, 0), argument(&args, 1))?;
    Ok(position(found))
}

/// `Array.prototype.concat`, `vm/array/concat.rs`: every argument an item.
fn array_concat<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(Array::try_from(receiver)?.concat(args)?.to_any())
}

/// `Array.prototype.slice`, `vm/array/slice.rs`.
fn array_slice<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let a = Array::try_from(receiver)?;
    Ok(a.slice(argument(&args, 0), argument(&args, 1))?.to_any())
}

/// `Array.prototype.toReversed`, `vm/array/to_reversed.rs`.
fn array_to_reversed<A: IVm>(receiver: Any<A>, _: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(Array::try_from(receiver)?.to_reversed().to_any())
}

/// `Array.prototype.toSpliced`, `vm/array/to_spliced.rs`: whether `start`
/// and `skip` were passed decides how many elements go, so both are read
/// as present or not.
fn array_to_spliced<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let a = Array::try_from(receiver)?;
    Ok(
        a.to_spliced(present(&args, 0), present(&args, 1), rest(&args, 2))?
            .to_any(),
    )
}

/// `Array.prototype.with`, `vm/array/with.rs`.
fn array_with<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let a = Array::try_from(receiver)?;
    Ok(a.with(argument(&args, 0), argument(&args, 1))?.to_any())
}

/// The receiver and the callback of an iteration or a fold, the callback
/// checked before anything is visited (`vm/array/callback.rs`). A second
/// argument, `thisArg`, is never read: no function here reads `this`.
fn with_callback<A: IVm>(
    receiver: Any<A>,
    args: &Array<A>,
) -> Result<(Array<A>, Function<A>), Any<A>> {
    Ok((Array::try_from(receiver)?, callback(argument(args, 0))?))
}

/// `Array.prototype.every`, `vm/array/every.rs`.
fn array_every<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let (a, f) = with_callback(receiver, &args)?;
    Ok(a.every(&f)?.to_any())
}

/// `Array.prototype.some`, `vm/array/some.rs`.
fn array_some<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let (a, f) = with_callback(receiver, &args)?;
    Ok(a.some(&f)?.to_any())
}

/// `Array.prototype.find`, `vm/array/find.rs`.
fn array_find<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let (a, f) = with_callback(receiver, &args)?;
    a.find(&f)
}

/// `Array.prototype.findLast`, `vm/array/find.rs`.
fn array_find_last<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let (a, f) = with_callback(receiver, &args)?;
    a.find_last(&f)
}

/// `Array.prototype.findIndex`, `vm/array/find_index.rs`.
fn array_find_index<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let (a, f) = with_callback(receiver, &args)?;
    Ok(position(a.find_index(&f)?))
}

/// `Array.prototype.findLastIndex`, `vm/array/find_last_index.rs`.
fn array_find_last_index<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let (a, f) = with_callback(receiver, &args)?;
    Ok(position(a.find_last_index(&f)?))
}

/// `Array.prototype.map`, `vm/array/map.rs`.
fn array_map<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let (a, f) = with_callback(receiver, &args)?;
    Ok(a.map(&f)?.to_any())
}

/// `Array.prototype.filter`, `vm/array/filter.rs`.
fn array_filter<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let (a, f) = with_callback(receiver, &args)?;
    Ok(a.filter(&f)?.to_any())
}

/// `Array.prototype.reduce`, `vm/array/reduce.rs`: the initial value read
/// only when passed, since `[].reduce(f)` throws where
/// `[].reduce(f, undefined)` answers `undefined`.
fn array_reduce<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let (a, f) = with_callback(receiver, &args)?;
    a.reduce(&f, present(&args, 1))
}

/// `Array.prototype.reduceRight`, `vm/array/reduce.rs`.
fn array_reduce_right<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let (a, f) = with_callback(receiver, &args)?;
    a.reduce_right(&f, present(&args, 1))
}

/// `Array.prototype.flat`, `vm/array/flat.rs`: the depth `1` when absent or
/// `undefined`, and otherwise `ToIntegerOrInfinity` of it, a bigint's throw
/// included.
fn array_flat<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let a = Array::try_from(receiver)?;
    let depth = argument(&args, 0);
    let depth = match Unpacked::from(depth.clone()) {
        Unpacked::Nullish(Nullish::Undefined) => 1.0,
        _ => f64::from(depth.to_number()?.to_integer_or_infinity()),
    };
    Ok(a.flat(depth)?.to_any())
}

/// `Array.prototype.flatMap`, `vm/array/flat.rs`.
fn array_flat_map<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let (a, f) = with_callback(receiver, &args)?;
    Ok(a.flat_map(&f)?.to_any())
}

/// `Array.prototype.toSorted`, `vm/array/to_sorted.rs`: the comparator
/// `undefined`, passed or not, or a function, and anything else — `null`
/// included — the `TypeError` JavaScript throws before any element is read.
fn array_to_sorted<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let compare = argument(&args, 0);
    let compare = match Unpacked::from(compare.clone()) {
        Unpacked::Nullish(Nullish::Undefined) => None,
        Unpacked::Function(f) => Some(f),
        _ => {
            return Err(
                "TypeError: The comparison function must be either a function or undefined".into(),
            );
        }
    };
    Ok(Array::try_from(receiver)?.to_sorted(compare)?.to_any())
}

/// `Array.prototype.join`, `vm/array/join.rs`: the separator `","` when
/// absent or `undefined`, and otherwise `ToString` of it, so `null` joins
/// with `"null"`.
fn array_join<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let a = Array::try_from(receiver)?;
    let separator = argument(&args, 0);
    let separator = match Unpacked::from(separator.clone()) {
        Unpacked::Nullish(Nullish::Undefined) => ",".into(),
        _ => separator.to_string()?,
    };
    Ok(a.join(separator)?.to_any())
}

/// `Array.prototype.lastIndexOf`, `vm/array/last_index_of.rs`: the one of
/// the three whose position is read only when passed.
fn array_last_index_of<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let found = Array::try_from(receiver)?.last_index_of(&argument(&args, 0), present(&args, 1))?;
    Ok(position(found))
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, BigInt, IStaticFunction, Nullish, ToAny, ToArray, ToObject},
    };

    type A = Naive;

    fn to_string_with(receiver: Any<A>, radix: Any<A>) -> Result<Any<A>, Any<A>> {
        receiver
            .dot("toString".into())
            .end_call(|| Ok([radix].to_array().to_any()))
    }

    /// A radix on a number or a bigint: the default reads as radix ten, any
    /// other throws until radixes land, rather than answer in radix ten
    /// (`member-functions.md`). Other types ignore the argument.
    #[test]
    fn to_string_radix() {
        let refused = Err("RangeError: a toString radix other than 10 is not supported yet".into());
        let n = || 255.0.to_any();
        let b = || BigInt::<A>::from(255i64).to_any();
        assert_eq!(to_string_with(n(), 10.0.to_any()), Ok("255".into()));
        assert_eq!(
            to_string_with(n(), Nullish::Undefined.to_any()),
            Ok("255".into())
        );
        assert_eq!(to_string_with(n(), 16.0.to_any()), refused);
        assert_eq!(to_string_with(n(), 2.0.to_any()), refused);
        assert_eq!(to_string_with(b(), 10.0.to_any()), Ok("255".into()));
        assert_eq!(to_string_with(b(), 16.0.to_any()), refused);
        assert_eq!(to_string(b()), Ok("255".into()));
        assert_eq!(
            to_string_with([1.0.to_any()].to_array().to_any(), 16.0.to_any()),
            Ok("1".into())
        );
        assert_eq!(
            to_string_with(true.to_any(), 16.0.to_any()),
            Ok("true".into())
        );
    }

    fn no_args() -> Result<Any<A>, Any<A>> {
        Ok([].to_array().to_any())
    }
    fn to_string(receiver: Any<A>) -> Result<Any<A>, Any<A>> {
        receiver.dot("toString".into()).end_call(no_args)
    }

    /// `toString()` on every type answers what `String(x)` answers.
    #[test]
    fn to_string_on_every_type() {
        assert_eq!(to_string(1.5.to_any()), Ok("1.5".into()));
        assert_eq!(to_string(true.to_any()), Ok("true".into()));
        assert_eq!(to_string("ab".into()), Ok("ab".into()));
        assert_eq!(
            to_string([].to_object().to_any()),
            Ok("[object Object]".into())
        );
        assert_eq!(
            to_string([1.0.to_any(), "b".into()].to_array().to_any()),
            Ok("1,b".into())
        );
        let f: Any<A> = A::static_function(|_, _| Ok(1.0.to_any()), 0, [].to_array()).to_any();
        // the conversion's placeholder, not the source text —
        // `member-functions.md`
        assert_eq!(to_string(f), Ok("function".into()));
    }

    /// Through a region as well: `a?.toString()`, `(a?.toString)()`, and
    /// `a?.b.toString()` reading then calling.
    #[test]
    fn to_string_in_a_region() {
        let arr: Any<A> = [1.0.to_any(), 2.0.to_any()].to_array().to_any();
        assert_eq!(
            arr.clone()
                .option_dot(|| Ok("toString".into()))
                .call(no_args)
                .end(),
            Ok("1,2".into())
        );
        assert_eq!(
            arr.clone()
                .option_dot(|| Ok("toString".into()))
                .end_call(no_args),
            Ok("1,2".into())
        );
        let o: Any<A> = [("b".into(), arr)].to_object().to_any();
        assert_eq!(
            o.option_dot(|| Ok("b".into()))
                .dot(|| Ok("toString".into()))
                .call(no_args)
                .end(),
            Ok("1,2".into())
        );
    }

    /// `at` on an array, through a call: the index converted, the end
    /// counted from, out of range `undefined`, and a missing argument
    /// element `0`.
    #[test]
    fn array_at() {
        let arr: Any<A> = [1.0.to_any(), 2.0.to_any(), 3.0.to_any()]
            .to_array()
            .to_any();
        let at = |index: Any<A>| {
            arr.clone()
                .dot("at".into())
                .end_call(|| Ok([index].to_array().to_any()))
        };
        assert_eq!(at(0.0.to_any()), Ok(1.0.to_any()));
        assert_eq!(at((-1.0f64).to_any()), Ok(3.0.to_any()));
        assert_eq!(at("1".into()), Ok(2.0.to_any()));
        assert_eq!(at(3.0.to_any()), Ok(Nullish::Undefined.to_any()));
        assert_eq!(arr.dot("at".into()).end_call(no_args), Ok(1.0.to_any()));
    }

    /// A receiver of each type the completeness table names.
    fn receiver(type_: &str) -> Any<A> {
        match type_ {
            "object" => [].to_object().to_any(),
            "array" => [].to_array().to_any(),
            "string" => "".into(),
            "number" => 0.0.to_any(),
            "boolean" => true.to_any(),
            "bigint" => BigInt::<A>::from(0i64).to_any(),
            "function" => A::static_function(|_, _| Ok(1.0.to_any()), 0, [].to_array()).to_any(),
            _ => panic!("no receiver of type {type_}"),
        }
    }

    /// The table matches `allowedCalls` and `prohibitedCalls`, both ways:
    /// every answered pair has an entry, no pending pair has one yet, so
    /// landing a built-in fails here until its pair leaves the pending list
    /// in `fjs/nanvm/methods`, and no prohibited pair has one ever.
    #[test]
    fn completeness() {
        use super::super::methods_table::{ABSENT, ANSWERED, PENDING, PROHIBITED};
        let has = |(type_, name): &(&str, &str)| {
            super::method::<A>(&receiver(type_), &(*name).into()).is_some()
        };
        for pair in ANSWERED {
            assert!(has(pair), "{pair:?} is answered but has no entry");
        }
        for pair in PENDING {
            assert!(
                !has(pair),
                "{pair:?} has an entry: remove it from the pending list"
            );
        }
        for pair in PROHIBITED {
            assert!(!has(pair), "{pair:?} is prohibited but has an entry");
        }
        for pair in ABSENT {
            assert!(
                !has(pair),
                "{pair:?} is not on the type's prototype but has an entry"
            );
        }
    }

    /// A name is a method of its receiver's type alone: `at` is an
    /// array's, not an object's or a number's, and a key that is no name
    /// is nobody's.
    #[test]
    fn unknown_name_is_none() {
        let arr: Any<A> = [].to_array().to_any();
        let object: Any<A> = [].to_object().to_any();
        assert!(super::method::<A>(&arr, &"at".into()).is_some());
        assert!(super::method::<A>(&object, &"at".into()).is_none());
        assert!(super::method::<A>(&1.0.to_any(), &"at".into()).is_none());
        assert!(super::method::<A>(&arr, &"push".into()).is_none());
        assert!(super::method::<A>(&arr, &0.0.to_any()).is_none());
    }
}
