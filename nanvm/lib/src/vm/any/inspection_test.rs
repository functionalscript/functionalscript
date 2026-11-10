//! Inspection must not clone a VM value, clone its heap payload, or consume it
//! merely to discover its variant. These implementations refuse each path so
//! moving a caller's clone into unpacking or dispatch cannot pass unnoticed.

use core::fmt::Debug;
use std::rc::Rc;

use crate::{
    sign::Sign,
    vm::{
        Any, Array, BigInt, Constructor, Function, IComplex, IContainer, IFunction, IVm, Nullish,
        Property, StaticCode, ToAny, ToArray, ToObject, Unpacked,
    },
};

struct InspectVm(Unpacked<Self>);

impl Clone for InspectVm {
    fn clone(&self) -> Self {
        panic!("inspection cloned the VM value")
    }
}

impl From<Unpacked<Self>> for InspectVm {
    fn from(value: Unpacked<Self>) -> Self {
        Self(value)
    }
}

impl IVm for InspectVm {
    type InternalString = InspectContainer<(), u16>;
    type InternalBigInt = InspectContainer<Sign, u64>;
    type InternalObject = InspectContainer<(), Property<Self>>;
    type InternalArray = InspectContainer<(), Any<Self>>;
    type InternalFunction = InspectFunction;

    fn to_unpacked(self) -> Unpacked<Self> {
        panic!("inspection consumed the VM value")
    }

    fn with_unpacked<R>(&self, f: impl FnOnce(&Unpacked<Self>) -> R) -> R {
        f(&self.0)
    }

    fn static_function(
        _: StaticCode<Self>,
        _: u32,
        frame: Array<Self>,
        _: Option<&'static str>,
    ) -> Function<Self> {
        Function::new(InspectFunction(Rc::new(frame)))
    }

    fn frame(self_: &Self::InternalFunction) -> &Array<Self> {
        &self_.0
    }
}

struct InspectContainer<H, I> {
    header: H,
    items: Rc<[I]>,
}

impl<H, I> Clone for InspectContainer<H, I> {
    fn clone(&self) -> Self {
        panic!("inspection cloned a container payload")
    }
}

impl<H: PartialEq, I> IComplex<InspectVm> for InspectContainer<H, I> {
    fn ptr_eq(&self, other: &Self) -> bool {
        self.header == other.header && Rc::ptr_eq(&self.items, &other.items)
    }
}

impl<H: Clone + PartialEq, I: Clone + Debug> IContainer<InspectVm> for InspectContainer<H, I> {
    type Header = H;
    type Item = I;
    type Items = [I];

    fn new<E>(header: H, items: impl IntoIterator<Item = Result<I, E>>) -> Result<Self, E> {
        Ok(Self {
            header,
            items: items.into_iter().collect::<Result<_, _>>()?,
        })
    }

    fn header(&self) -> &H {
        &self.header
    }

    fn items(&self) -> &[I] {
        &self.items
    }
}

struct InspectFunction(Rc<Array<InspectVm>>);

impl Clone for InspectFunction {
    fn clone(&self) -> Self {
        panic!("inspection cloned a function payload")
    }
}

impl IComplex<InspectVm> for InspectFunction {
    fn ptr_eq(&self, other: &Self) -> bool {
        Rc::ptr_eq(&self.0, &other.0)
    }
}

impl IFunction<InspectVm> for InspectFunction {
    fn call(&self, _: Array<InspectVm>) -> Result<Any<InspectVm>, Any<InspectVm>> {
        panic!("inspection called a function")
    }

    fn length(&self) -> u32 {
        0
    }

    fn text(&self) -> Option<&'static str> {
        None
    }
}

fn n(value: f64) -> Any<InspectVm> {
    value.to_any()
}

fn function() -> Any<InspectVm> {
    InspectVm::static_function(
        |_, _| panic!("inspection called a function"),
        0,
        [].to_array(),
        None,
    )
    .to_any()
}

#[test]
fn every_variant_can_be_inspected_repeatedly_without_cloning() {
    for (value, truthy, tag, nullish, nan, array) in [
        (Any::undefined(), false, "undefined", true, false, false),
        (Nullish::Null.to_any(), false, "object", true, false, false),
        (false.to_any(), false, "boolean", false, false, false),
        (true.to_any(), true, "boolean", false, false, false),
        (n(-0.0), false, "number", false, false, false),
        (n(f64::NAN), false, "number", false, true, false),
        (n(-1.0), true, "number", false, false, false),
        (n(f64::INFINITY), true, "number", false, false, false),
        ("".into(), false, "string", false, false, false),
        ("hello".into(), true, "string", false, false, false),
        (
            BigInt::from(0u64).to_any(),
            false,
            "bigint",
            false,
            false,
            false,
        ),
        (
            BigInt::from(1u64).to_any(),
            true,
            "bigint",
            false,
            false,
            false,
        ),
        ([].to_array().to_any(), true, "object", false, false, true),
        ([].to_object().to_any(), true, "object", false, false, false),
        (function(), true, "function", false, false, false),
    ] {
        assert_eq!(value.is_nullish(), nullish);
        assert_eq!(value.is_nan(), nan);
        assert_eq!(value.to_boolean(), truthy);
        assert_eq!(value.typeof_(), Ok(tag.into()));
        assert_eq!(value.instanceof_(Constructor::Array), Ok(array.to_any()));
        assert_eq!(!&value, Ok((!truthy).to_any()));
        // Keep using the same operand after every borrowed operation.
        assert_eq!(value.to_boolean(), truthy);
    }
}

#[test]
fn equality_keeps_number_and_identity_semantics_without_cloning() {
    let zero = n(0.0);
    let negative_zero = n(-0.0);
    let nan = n(f64::NAN);
    let another_nan = n(f64::NAN);
    assert_eq!(zero, negative_zero);
    assert!(!zero.same_value(&negative_zero));
    assert!(zero.same_value_zero(&negative_zero));
    assert_ne!(nan, another_nan);
    assert!(nan.same_value(&another_nan));
    assert!(nan.same_value_zero(&another_nan));
    assert!(!nan.same_value_zero(&zero));

    let text: Any<InspectVm> = "hello".into();
    assert_eq!(text, "hello".into());
    assert_ne!(text, "other".into());
    assert!(text.is_str("hello"));
    assert!(!text.is_str("hell"));
    assert!(!text.same_value(&zero));

    for (value, other) in [
        ([].to_array().to_any(), [].to_array().to_any()),
        ([].to_object().to_any(), [].to_object().to_any()),
        (function(), function()),
    ] {
        assert!(PartialEq::eq(&value, &value));
        assert!(value.same_value(&value));
        assert!(value.same_value_zero(&value));
        assert_ne!(value, other);
        assert!(!value.same_value(&other));
        assert!(!value.same_value_zero(&other));
    }
}

#[test]
fn defined_moves_only_the_selected_value() {
    assert!(Any::<InspectVm>::undefined().defined().is_none());
    let null = Nullish::Null.to_any::<InspectVm>().defined().unwrap();
    assert!(null.is_nullish());
    let object = [].to_object().to_any::<InspectVm>().defined().unwrap();
    assert!(object.to_boolean());
}

#[test]
fn debug_borrows_the_vm_value() {
    let value = n(7.0);
    assert_eq!(format!("{value:?}"), "7.0");
    assert_eq!(value, n(7.0));
    let text: Any<InspectVm> = "hello".into();
    assert_eq!(format!("{text:?}"), "\"hello\"");
    assert!(text.is_str("hello"));
    let nested: Any<InspectVm> = [text].to_array().to_any();
    assert_eq!(format!("{nested:?}"), "[\"hello\"]");
    assert!(nested.to_boolean());
}
