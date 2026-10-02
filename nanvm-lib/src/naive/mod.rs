mod container;
mod function;

use core::{
    cell::{Cell, RefCell},
    mem,
};

use crate::{
    naive::{container::Container, function::Function},
    sign::Sign,
    vm::{Any, Array, IStaticFunction, IVm, Nullish, Property, StaticCode, Unpacked},
};

/// Note: we can't use `type InternalAny = Unpacked<InternalAny>;` because Rust doesn't support
/// recursive type aliases.
#[derive(Clone)]
pub struct Naive(Unpacked<Naive>);

impl<T: Into<Unpacked<Naive>>> From<T> for Naive {
    fn from(value: T) -> Self {
        Naive(value.into())
    }
}

/// How many nested drops run on the stack before the next is parked: a few
/// hundred frames, which the 2 MiB stack of a test thread holds many times
/// over, and a value of any depth then unwinds from the outermost drop.
const DROP_DEPTH: usize = 256;

thread_local! {
    /// The drops now on this thread's stack. A `Cell` of a `usize` has no
    /// destructor, so it is usable for as long as the thread runs, including
    /// while its other thread-locals are being destroyed.
    static DEPTH: Cell<usize> = const { Cell::new(0) };
    /// The values a drop passed over for being too deep, waiting for the
    /// outermost drop to release them one at a time.
    static PARKED: RefCell<Vec<Unpacked<Naive>>> = const { RefCell::new(Vec::new()) };
}

/// Whether a value can hold other values: only these can make a drop deep.
fn holds_values(u: &Unpacked<Naive>) -> bool {
    matches!(
        u,
        Unpacked::Object(_) | Unpacked::Array(_) | Unpacked::Function(_)
    )
}

/// Dropping a value drops what it holds, which may hold more, so a value `n`
/// levels deep would take `n` frames of the stack to drop, and a program can
/// build one a million levels deep with a fold. A drop deeper than
/// [`DROP_DEPTH`] therefore does not recurse: it parks the value, and the
/// outermost drop, back at depth zero, releases the parked values one by one,
/// each again with the whole depth to spend. Nothing observes the order.
///
/// If the thread's parked list is already destroyed, the value is dropped in
/// place, as a plain `Rc` would.
impl Drop for Naive {
    fn drop(&mut self) {
        if !holds_values(&self.0) {
            return;
        }
        let inner = mem::replace(&mut self.0, Unpacked::Nullish(Nullish::Undefined));
        let depth = DEPTH.get();
        if depth >= DROP_DEPTH {
            let mut slot = Some(inner);
            // A destroyed list leaves the value in `slot`, which drops it in
            // place on the way out, the old way.
            let _ = PARKED.try_with(|p| p.borrow_mut().extend(slot.take()));
            return;
        }
        DEPTH.set(depth + 1);
        drop(inner);
        DEPTH.set(depth);
        if depth == 0 {
            release_parked();
        }
    }
}

/// Drops every parked value, each at depth one, until none is left: dropping
/// one may park more.
fn release_parked() {
    while let Some(v) = PARKED.try_with(|p| p.borrow_mut().pop()).ok().flatten() {
        DEPTH.set(1);
        drop(v);
        DEPTH.set(0);
    }
}

impl IVm for Naive {
    type InternalString = Container<(), u16>;
    type InternalBigInt = Container<Sign, u64>;
    type InternalObject = Container<(), Property<Naive>>;
    type InternalArray = Container<(), Any<Naive>>;
    type InternalFunction = Function;

    fn to_unpacked(mut self) -> Unpacked<Self> {
        // `Naive` has a `Drop`, so its value cannot be moved out, only swapped.
        mem::replace(&mut self.0, Unpacked::Nullish(Nullish::Undefined))
    }
}

/// `naive` holds a static function, and makes a function no other way.
impl IStaticFunction for Naive {
    fn static_function(
        code: StaticCode<Naive>,
        length: u32,
        frame: Array<Naive>,
        text: Option<&'static str>,
    ) -> crate::vm::Function<Naive> {
        crate::vm::Function::new(Function::new(code, length, frame, text))
    }

    fn frame(self_: &Function) -> &Array<Naive> {
        self_.frame()
    }
}

#[cfg(test)]
mod tests {
    use std::thread;

    use crate::{
        naive::Naive,
        vm::{Any, Nullish, String, ToAny, ToArray, ToObject, unstable::f64_any},
    };

    /// A thread with a stack far smaller than the default 2 MiB: a value
    /// whose drop recursed would not fit on it at a depth of 100,000.
    fn small_stack(f: impl FnOnce() + Send + 'static) {
        thread::Builder::new()
            .stack_size(256 * 1024)
            .spawn(f)
            .unwrap()
            .join()
            .unwrap();
    }

    const DEEP: usize = 1_000_000;

    fn nested_arrays(depth: usize) -> Any<Naive> {
        (0..depth).fold(Nullish::Null.to_any(), |a, _| [a].to_array().to_any())
    }

    fn nested_objects(depth: usize) -> Any<Naive> {
        (0..depth).fold(Nullish::Null.to_any(), |a, _| {
            [(String::<Naive>::from("a"), a)].to_object().to_any()
        })
    }

    #[test]
    fn drops_a_deep_array() {
        small_stack(|| drop(nested_arrays(DEEP)));
    }

    #[test]
    fn drops_a_deep_object() {
        small_stack(|| drop(nested_objects(DEEP)));
    }

    /// Objects and arrays alternating, a function's frame in the chain.
    #[test]
    fn drops_a_deep_mixture() {
        small_stack(|| {
            let mut a: Any<Naive> = Nullish::Null.to_any();
            for i in 0..DEEP / 4 {
                a = [a].to_array().to_any();
                a = [(String::<Naive>::from("k"), a)].to_object().to_any();
                a = crate::vm::IStaticFunction::static_function(
                    |_, _| Ok(Nullish::Undefined.to_any()),
                    0,
                    [a].to_array(),
                    None,
                )
                .to_any();
                a = [a, f64_any(i as u64)].to_array().to_any();
            }
            drop(a);
        });
    }

    /// Only the last reference unwinds: a clone keeps the whole value alive
    /// and readable, and it is the clone's drop that releases it.
    #[test]
    fn a_shared_deep_value_survives_one_drop() {
        small_stack(|| {
            let a = nested_arrays(DEEP);
            let b = a.clone();
            drop(a);
            assert!(b == b.clone());
            let top = crate::vm::Array::try_from(b).unwrap();
            assert_eq!(crate::common::sized_index::SizedIndex::length(&top), 1);
            drop(top);
        });
    }

    /// A wide value of deep values: the parked ones are released one after
    /// another, each with the whole depth to spend.
    #[test]
    fn drops_many_deep_values() {
        small_stack(|| {
            let wide: Vec<Any<Naive>> = (0..8).map(|_| nested_arrays(DEEP / 8)).collect();
            drop(wide.to_array().to_any::<Naive>());
        });
    }

    /// Values that hold no container drop as before, and a shallow value
    /// leaves nothing parked.
    #[test]
    fn shallow_values_are_unaffected() {
        let shallow: Any<Naive> = [Any::from("x"), f64_any(0)].to_array().to_any();
        drop(shallow.clone());
        assert!(shallow == shallow.clone());
        drop(Any::<Naive>::from("s"));
    }
}
