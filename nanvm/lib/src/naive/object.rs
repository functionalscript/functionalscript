use crate::{
    naive::Naive,
    vm::{Any, ContainerWrapper, IComplex, IContainer, IObject, Property, StaticObject, String},
};
use std::rc::Rc;

#[derive(Clone)]
pub enum Object {
    Owned(Rc<[Property<Naive>]>),
    Static(&'static StaticObject<Naive>),
}

impl core::fmt::Debug for Object {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        use crate::vm::container_fmt::container_fmt;
        match self {
            Self::Owned(items) => container_fmt(items.iter(), '{', '}', f),
            Self::Static(_) => {
                container_fmt((0..self.length()).map(|i| self.property_at(i)), '{', '}', f)
            }
        }
    }
}

impl IComplex<Naive> for Object {
    fn ptr_eq(&self, other: &Self) -> bool {
        self.address() == other.address()
    }
    fn address(&self) -> usize {
        match self {
            Self::Owned(items) => Rc::as_ptr(items).cast::<()>() as usize,
            Self::Static(object) => core::ptr::from_ref(*object) as usize,
        }
    }
}

impl IObject<Naive> for Object {
    fn from_properties(properties: impl IntoIterator<Item = Property<Naive>>) -> Self {
        Self::Owned(properties.into_iter().collect())
    }
    fn length(&self) -> u32 {
        match self {
            Self::Owned(items) => items.len() as u32,
            Self::Static(object) => object.0.len() as u32,
        }
    }
    fn property_at(&self, index: u32) -> Property<Naive> {
        match self {
            Self::Owned(items) => items[index as usize].clone(),
            Self::Static(object) => {
                let (key, value) = &object.0[index as usize];
                (String::from_static(key), value.load())
            }
        }
    }
    fn own_property(&self, key: &String<Naive>) -> Option<Any<Naive>> {
        match self {
            Self::Owned(items) => items
                .iter()
                .rev()
                .find(|(k, _)| k == key)
                .map(|(_, v)| v.clone()),
            Self::Static(object) => {
                let units = key.internal().items();
                object
                    .0
                    .iter()
                    .find(|(k, _)| k.0 == units)
                    .map(|(_, v)| v.load())
            }
        }
    }
}
