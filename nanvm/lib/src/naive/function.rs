use std::rc::Rc;

use crate::{
    naive::Naive,
    vm::{
        Any, Array, ContainerWrapper, GroupEntry, IComplex, IContainer, IFunction, StaticCode,
        StaticFunction,
    },
};

pub(super) enum Text {
    Utf8(&'static str),
    Vm(crate::vm::String<Naive>),
}

struct Entry {
    code: StaticCode<Naive>,
    length: u32,
    text: Option<Text>,
}

/// A single closure can capture a pre-existing array. The compiler gives a
/// group its slots directly, so both its slots and code live inside its Rc.
trait Slots {
    fn slots(&self) -> &[Any<Naive>];
}

impl Slots for Array<Naive> {
    fn slots(&self) -> &[Any<Naive>] {
        self.internal().items()
    }
}

impl<const N: usize> Slots for [Any<Naive>; N] {
    fn slots(&self) -> &[Any<Naive>] {
        self
    }
}

struct Group<Frame, const N: usize> {
    frame: Frame,
    entries: [Entry; N],
}

/// Erase the two array lengths from a function value. The group holds code
/// and captured values, so returning a sibling adds no back edge.
trait Members {
    fn frame(&self) -> &[Any<Naive>];
    fn entries(&self) -> &[Entry];
}

impl<Frame: Slots, const N: usize> Members for Group<Frame, N> {
    fn frame(&self) -> &[Any<Naive>] {
        self.frame.slots()
    }
    fn entries(&self) -> &[Entry] {
        &self.entries
    }
}

#[derive(Clone)]
enum Value {
    Dynamic {
        group: Rc<dyn Members>,
        index: usize,
    },
    Static(&'static StaticFunction<Naive>),
}

#[derive(Clone)]
pub struct Function(Value);

impl Function {
    fn dynamic<const N: usize>(frame: impl Slots + 'static, entries: [Entry; N]) -> Self {
        assert!(N > 0);
        Self(Value::Dynamic {
            group: Rc::new(Group { frame, entries }),
            index: 0,
        })
    }

    pub(super) fn new(
        code: StaticCode<Naive>,
        length: u32,
        frame: Array<Naive>,
        text: Option<Text>,
    ) -> Self {
        Self::dynamic(frame, [Entry { code, length, text }])
    }

    pub(super) fn group<const S: usize, const N: usize>(
        frame: [Any<Naive>; S],
        entries: [GroupEntry<Naive>; N],
    ) -> Self {
        Self::dynamic(
            frame,
            entries.map(|entry| Entry {
                code: entry.code,
                length: entry.length,
                text: entry.text.map(Text::Utf8),
            }),
        )
    }

    pub(super) fn member(&self, index: usize) -> Self {
        let Value::Dynamic { group, .. } = &self.0 else {
            unreachable!("constant members name one another by descriptor")
        };
        assert!(index < group.entries().len());
        Self(Value::Dynamic {
            group: Rc::clone(group),
            index,
        })
    }

    pub(super) fn from_static(descriptor: &'static StaticFunction<Naive>) -> Self {
        Self(Value::Static(descriptor))
    }

    pub fn frame(&self) -> &[Any<Naive>] {
        match &self.0 {
            Value::Dynamic { group, .. } => group.frame(),
            Value::Static(_) => &[],
        }
    }
}

impl IComplex<Naive> for Function {
    fn ptr_eq(&self, other: &Self) -> bool {
        self.address() == other.address()
    }
    fn address(&self) -> usize {
        match &self.0 {
            Value::Dynamic { group, index } => {
                core::ptr::from_ref(&group.entries()[*index]) as usize
            }
            Value::Static(descriptor) => core::ptr::from_ref(*descriptor) as usize,
        }
    }
}

impl IFunction<Naive> for Function {
    fn call(&self, args: Array<Naive>) -> Result<Any<Naive>, Any<Naive>> {
        let code = match &self.0 {
            Value::Dynamic { group, index } => group.entries()[*index].code,
            Value::Static(descriptor) => descriptor.code,
        };
        code(self, args)
    }

    fn length(&self) -> u32 {
        match &self.0 {
            Value::Dynamic { group, index } => group.entries()[*index].length,
            Value::Static(descriptor) => descriptor.length,
        }
    }

    fn text(&self) -> Option<crate::vm::String<Naive>> {
        match &self.0 {
            Value::Dynamic { group, index } => {
                group.entries()[*index]
                    .text
                    .as_ref()
                    .map(|text| match text {
                        Text::Utf8(s) => (*s).into(),
                        Text::Vm(s) => s.clone(),
                    })
            }
            Value::Static(descriptor) => descriptor.text.map(crate::vm::String::from_static),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vm::{Function as VmFunction, IVm, ToAny, ToArray};

    fn pair(value: Any<Naive>) -> VmFunction<Naive> {
        Naive::function_group(
            [value],
            [
                GroupEntry {
                    code: |self_, _| Ok(Naive::group_member(self_, 1).to_any()),
                    length: 0,
                    text: None,
                },
                GroupEntry {
                    code: |self_, args| {
                        if args.argument(0) == Any::undefined() {
                            Ok(Naive::group_member(self_, 0).to_any())
                        } else {
                            Ok(Naive::frame(self_)[0].clone())
                        }
                    },
                    length: 1,
                    text: Some("x => x ? captured : first"),
                },
            ],
        )
    }

    #[test]
    fn members_return_one_another_and_share_their_frame() {
        let first = pair(42.0.to_any());
        let Value::Dynamic { group, .. } = &first.internal().0 else {
            unreachable!()
        };
        let weak = Rc::downgrade(group);
        let second = first.group_member(1);
        assert_eq!(first, second.group_member(0));
        assert_ne!(first, second);
        assert_ne!(first, pair(99.0.to_any()));
        assert_eq!(second.length(), 1);
        assert_eq!(second.text(), Ok("x => x ? captured : first".into()));
        assert_eq!(first.call([].to_array()), Ok(second.clone().to_any()));
        assert_eq!(second.call([].to_array()), Ok(first.clone().to_any()));
        drop(first);
        assert_eq!(second.call([true.to_any()].to_array()), Ok(42.0.to_any()));
        drop(second);
        assert!(weak.upgrade().is_none());
    }

    #[test]
    fn member_index_can_exceed_one_byte() {
        let entries: [_; 257] = core::array::from_fn(|_| GroupEntry {
            code: |self_, _| Ok(Naive::group_member(self_, 256).to_any()),
            length: 0,
            text: None,
        });
        let first = Naive::function_group([], entries);
        let last = first.group_member(256);
        assert_ne!(first, last);
        assert_eq!(first.call([].to_array()), Ok(last.clone().to_any()));
        assert_eq!(last.call([].to_array()), Ok(last.clone().to_any()));
    }
}
