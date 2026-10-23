  (func $nanvm_demos::samples::hello::module::<nanvm_lib::naive::Naive> (;237;) (type 1) (param i32 i32)
    (local i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 96
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    local.get 2
    i32.const 0
    i32.store16 offset=28
    local.get 2
    i32.const 1056904
    i32.store offset=24
    local.get 2
    i32.const 1056897
    i32.store offset=20
    local.get 2
    i32.const 48
    i32.add
    local.get 2
    i32.const 20
    i32.add
    call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          local.get 2
          i32.load8_u offset=48
          local.tee 3
          i32.const 255
          i32.ne
          br_if 0 (;@3;)
          local.get 2
          i32.load offset=56
          local.set 4
          local.get 2
          i32.load offset=52
          local.set 5
          local.get 2
          i32.const 0
          i32.store8 offset=32
          local.get 2
          i32.const 8
          i32.add
          local.get 2
          i32.const 32
          i32.add
          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::empty::Empty<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
          local.get 2
          local.get 2
          i32.load offset=12
          local.tee 6
          i32.store offset=52
          local.get 2
          local.get 2
          i32.load offset=8
          local.tee 3
          i32.store offset=48
          block ;; label = @4
            local.get 2
            i32.load8_u offset=32
            i32.const 1
            i32.ne
            br_if 0 (;@4;)
            local.get 3
            local.get 3
            i32.load
            i32.const -1
            i32.add
            local.tee 0
            i32.store
            local.get 0
            br_if 3 (;@1;)
            local.get 2
            i32.const 48
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
            br 3 (;@1;)
          end
          local.get 3
          i32.eqz
          br_if 2 (;@1;)
          i32.const 42
          i32.const 0
          local.get 3
          local.get 6
          i32.const 1058027
          i32.const 129
          call $<nanvm_lib::naive::function::Function>::new
          local.set 3
          local.get 2
          i32.const 0
          i32.store8 offset=20
          local.get 2
          local.get 3
          i32.store offset=68
          local.get 2
          i32.const 7
          i32.store8 offset=64
          local.get 2
          local.get 4
          i32.store offset=60
          local.get 2
          local.get 5
          i32.store offset=56
          local.get 2
          i64.const 4294967296
          i64.store offset=48
          local.get 2
          local.get 2
          i32.const 20
          i32.add
          i32.store offset=80
          local.get 2
          local.get 2
          i32.const 48
          i32.add
          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 1>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
          local.get 2
          local.get 2
          i32.load offset=4
          local.tee 4
          i32.store offset=36
          local.get 2
          local.get 2
          i32.load
          local.tee 3
          i32.store offset=32
          block ;; label = @4
            local.get 2
            i32.load8_u offset=20
            i32.const 1
            i32.ne
            br_if 0 (;@4;)
            local.get 3
            local.get 3
            i32.load
            i32.const -1
            i32.add
            local.tee 0
            i32.store
            local.get 0
            br_if 2 (;@2;)
            local.get 2
            i32.const 32
            i32.add
            call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
            br 2 (;@2;)
          end
          local.get 3
          i32.eqz
          br_if 1 (;@2;)
          local.get 0
          local.get 4
          i32.store offset=16
          local.get 0
          local.get 3
          i32.store offset=12
          local.get 0
          i32.const 5
          i32.store8 offset=8
          local.get 0
          i64.const 0
          i64.store
          local.get 1
          call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          local.get 2
          i32.const 96
          i32.add
          global.set $__stack_pointer
          return
        end
        local.get 2
        local.get 2
        i32.load8_u offset=51
        i32.store8 offset=35
        local.get 2
        local.get 2
        i32.load16_u offset=49 align=1
        i32.store16 offset=33 align=1
        local.get 2
        local.get 2
        i32.load offset=60
        i32.store offset=44
        local.get 2
        local.get 2
        i64.load offset=52 align=4
        i64.store offset=36 align=4
        local.get 2
        local.get 3
        i32.store8 offset=32
        i32.const 1063112
        i32.const 43
        local.get 2
        i32.const 32
        i32.add
        i32.const 1063096
        i32.const 1063156
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1059464
      i32.const 43
      local.get 2
      i32.const 95
      i32.add
      i32.const 1059448
      i32.const 1059508
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1059464
    i32.const 43
    local.get 2
    i32.const 95
    i32.add
    i32.const 1059448
    i32.const 1059508
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::hello::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;238;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i32 i32 i32 i32 i64 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 176
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 4
    local.get 3
    i32.store offset=28
    local.get 4
    local.get 2
    i32.store offset=24
    local.get 4
    i32.const 0
    i32.store16 offset=60
    local.get 4
    i32.const 1059028
    i32.store offset=56
    local.get 4
    i32.const 1059021
    i32.store offset=52
    local.get 4
    i32.const 80
    i32.add
    local.get 4
    i32.const 52
    i32.add
    call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=80
                    local.tee 3
                    i32.const 255
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 4
                    i32.load offset=88
                    local.set 5
                    local.get 4
                    i32.load offset=84
                    local.set 6
                    local.get 4
                    i32.const 0
                    i32.store16 offset=60
                    local.get 4
                    i32.const 1059033
                    i32.store offset=56
                    local.get 4
                    i32.const 1059028
                    i32.store offset=52
                    local.get 4
                    i32.const 80
                    i32.add
                    local.get 4
                    i32.const 52
                    i32.add
                    call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                    local.get 4
                    i32.load8_u offset=80
                    local.tee 3
                    i32.const 255
                    i32.ne
                    br_if 1 (;@7;)
                    local.get 4
                    i32.load offset=88
                    local.set 7
                    local.get 4
                    i32.load offset=84
                    local.set 8
                    local.get 4
                    i32.const 0
                    i32.store16 offset=60
                    local.get 4
                    i32.const 1059040
                    i32.store offset=56
                    local.get 4
                    i32.const 1059033
                    i32.store offset=52
                    local.get 4
                    i32.const 80
                    i32.add
                    local.get 4
                    i32.const 52
                    i32.add
                    call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                    local.get 4
                    i32.load8_u offset=80
                    local.tee 3
                    i32.const 255
                    i32.ne
                    br_if 2 (;@6;)
                    local.get 4
                    i32.load offset=88
                    local.set 9
                    local.get 4
                    i32.load offset=84
                    local.set 10
                    local.get 4
                    i32.const 0
                    i32.store16 offset=60
                    local.get 4
                    i32.const 1059046
                    i32.store offset=56
                    local.get 4
                    i32.const 1059040
                    i32.store offset=52
                    local.get 4
                    i32.const 80
                    i32.add
                    local.get 4
                    i32.const 52
                    i32.add
                    call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                    local.get 4
                    i32.load8_u offset=80
                    local.tee 3
                    i32.const 255
                    i32.ne
                    br_if 3 (;@5;)
                    local.get 4
                    i64.load offset=84 align=4
                    local.set 11
                    local.get 4
                    i32.const 32
                    i32.add
                    i32.const 4
                    i32.or
                    i32.const 255
                    i32.const 1059104
                    i32.const 1059120
                    call $<nanvm_lib::vm::bigint::BigInt<nanvm_lib::naive::Naive>>::normalize_new::<core::iter::adapters::copied::Copied<core::slice::iter::Iter<u64>>>
                    local.get 4
                    i32.const 4
                    i32.store8 offset=32
                    local.get 4
                    i32.const 0
                    i32.store8 offset=52
                    local.get 4
                    local.get 11
                    i64.store offset=92 align=4
                    local.get 4
                    i32.const 3
                    i32.store8 offset=88
                    local.get 4
                    i64.const 8589934592
                    i64.store offset=80
                    local.get 4
                    local.get 4
                    i64.load offset=32
                    i64.store offset=104
                    local.get 4
                    local.get 4
                    i64.load offset=40
                    i64.store offset=112
                    local.get 4
                    local.get 4
                    i32.const 52
                    i32.add
                    i32.store offset=120
                    local.get 4
                    i32.const 16
                    i32.add
                    local.get 4
                    i32.const 80
                    i32.add
                    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                    local.get 4
                    local.get 4
                    i32.load offset=20
                    local.tee 12
                    i32.store offset=68
                    local.get 4
                    local.get 4
                    i32.load offset=16
                    local.tee 3
                    i32.store offset=64
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=52
                      i32.const 1
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 3
                      local.get 3
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 0
                      i32.store
                      local.get 0
                      br_if 8 (;@1;)
                      local.get 4
                      i32.const 64
                      i32.add
                      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                      br 8 (;@1;)
                    end
                    local.get 3
                    i32.eqz
                    br_if 7 (;@1;)
                    local.get 4
                    i32.const 0
                    i32.store16 offset=60
                    local.get 4
                    i32.const 1059058
                    i32.store offset=56
                    local.get 4
                    i32.const 1059046
                    i32.store offset=52
                    local.get 4
                    i32.const 80
                    i32.add
                    local.get 4
                    i32.const 52
                    i32.add
                    call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                    local.get 4
                    i32.load8_u offset=80
                    local.tee 13
                    i32.const 255
                    i32.ne
                    br_if 4 (;@4;)
                    local.get 4
                    i32.load offset=88
                    local.set 14
                    local.get 4
                    i32.load offset=84
                    local.set 15
                    local.get 4
                    i32.const 0
                    i32.store8 offset=64
                    local.get 4
                    i32.const 8
                    i32.add
                    local.get 4
                    i32.const 64
                    i32.add
                    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::empty::Empty<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                    local.get 4
                    local.get 4
                    i32.load offset=12
                    local.tee 16
                    i32.store offset=84
                    local.get 4
                    local.get 4
                    i32.load offset=8
                    local.tee 13
                    i32.store offset=80
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=64
                      i32.const 1
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 13
                      local.get 13
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 0
                      i32.store
                      local.get 0
                      br_if 7 (;@2;)
                      local.get 4
                      i32.const 80
                      i32.add
                      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                      br 7 (;@2;)
                    end
                    local.get 13
                    i32.eqz
                    br_if 6 (;@2;)
                    i32.const 43
                    i32.const 0
                    local.get 13
                    local.get 16
                    i32.const 1059058
                    i32.const 24
                    call $<nanvm_lib::naive::function::Function>::new
                    local.set 13
                    local.get 4
                    i32.const 0
                    i32.store8 offset=52
                    local.get 4
                    local.get 13
                    i32.store offset=148
                    local.get 4
                    i32.const 7
                    i32.store8 offset=144
                    local.get 4
                    local.get 14
                    i32.store offset=140
                    local.get 4
                    local.get 15
                    i32.store offset=136
                    local.get 4
                    local.get 12
                    i32.store offset=128
                    local.get 4
                    local.get 3
                    i32.store offset=124
                    local.get 4
                    i32.const 6
                    i32.store8 offset=120
                    local.get 4
                    local.get 9
                    i32.store offset=116
                    local.get 4
                    local.get 10
                    i32.store offset=112
                    local.get 4
                    local.get 7
                    i32.store offset=104
                    local.get 4
                    local.get 8
                    i32.store offset=100
                    local.get 4
                    i32.const 3
                    i32.store8 offset=96
                    local.get 4
                    local.get 5
                    i32.store offset=92
                    local.get 4
                    local.get 6
                    i32.store offset=88
                    local.get 4
                    i64.const 12884901888
                    i64.store offset=80
                    local.get 4
                    local.get 4
                    i32.const 52
                    i32.add
                    i32.store offset=160
                    local.get 4
                    local.get 4
                    i32.const 80
                    i32.add
                    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 3>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
                    local.get 4
                    local.get 4
                    i32.load offset=4
                    local.tee 13
                    i32.store offset=68
                    local.get 4
                    local.get 4
                    i32.load
                    local.tee 3
                    i32.store offset=64
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=52
                      i32.const 1
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 3
                      local.get 3
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 0
                      i32.store
                      local.get 0
                      br_if 6 (;@3;)
                      local.get 4
                      i32.const 64
                      i32.add
                      call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
                      br 6 (;@3;)
                    end
                    local.get 3
                    i32.eqz
                    br_if 5 (;@3;)
                    local.get 0
                    local.get 13
                    i32.store offset=16
                    local.get 0
                    local.get 3
                    i32.store offset=12
                    local.get 0
                    i32.const 5
                    i32.store8 offset=8
                    local.get 0
                    i64.const 0
                    i64.store
                    local.get 2
                    local.get 2
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 0
                    i32.store
                    block ;; label = @9
                      local.get 0
                      br_if 0 (;@9;)
                      local.get 4
                      i32.const 24
                      i32.add
                      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                    end
                    local.get 4
                    i32.const 176
                    i32.add
                    global.set $__stack_pointer
                    return
                  end
                  local.get 4
                  local.get 4
                  i32.load8_u offset=83
                  i32.store8 offset=67
                  local.get 4
                  local.get 4
                  i32.load16_u offset=81 align=1
                  i32.store16 offset=65 align=1
                  local.get 4
                  local.get 4
                  i32.load offset=92
                  i32.store offset=76
                  local.get 4
                  local.get 4
                  i64.load offset=84 align=4
                  i64.store offset=68 align=4
                  local.get 4
                  local.get 3
                  i32.store8 offset=64
                  i32.const 1063112
                  i32.const 43
                  local.get 4
                  i32.const 64
                  i32.add
                  i32.const 1063096
                  i32.const 1063156
                  call $core::result::unwrap_failed
                  unreachable
                end
                local.get 4
                local.get 4
                i32.load8_u offset=83
                i32.store8 offset=67
                local.get 4
                local.get 4
                i32.load16_u offset=81 align=1
                i32.store16 offset=65 align=1
                local.get 4
                local.get 4
                i32.load offset=92
                i32.store offset=76
                local.get 4
                local.get 4
                i64.load offset=84 align=4
                i64.store offset=68 align=4
                local.get 4
                local.get 3
                i32.store8 offset=64
                i32.const 1063112
                i32.const 43
                local.get 4
                i32.const 64
                i32.add
                i32.const 1063096
                i32.const 1063156
                call $core::result::unwrap_failed
                unreachable
              end
              local.get 4
              local.get 4
              i32.load8_u offset=83
              i32.store8 offset=67
              local.get 4
              local.get 4
              i32.load16_u offset=81 align=1
              i32.store16 offset=65 align=1
              local.get 4
              local.get 4
              i32.load offset=92
              i32.store offset=76
              local.get 4
              local.get 4
              i64.load offset=84 align=4
              i64.store offset=68 align=4
              local.get 4
              local.get 3
              i32.store8 offset=64
              i32.const 1063112
              i32.const 43
              local.get 4
              i32.const 64
              i32.add
              i32.const 1063096
              i32.const 1063156
              call $core::result::unwrap_failed
              unreachable
            end
            local.get 4
            local.get 4
            i32.load8_u offset=83
            i32.store8 offset=67
            local.get 4
            local.get 4
            i32.load16_u offset=81 align=1
            i32.store16 offset=65 align=1
            local.get 4
            local.get 4
            i32.load offset=92
            i32.store offset=76
            local.get 4
            local.get 4
            i64.load offset=84 align=4
            i64.store offset=68 align=4
            local.get 4
            local.get 3
            i32.store8 offset=64
            i32.const 1063112
            i32.const 43
            local.get 4
            i32.const 64
            i32.add
            i32.const 1063096
            i32.const 1063156
            call $core::result::unwrap_failed
            unreachable
          end
          local.get 4
          local.get 4
          i32.load8_u offset=83
          i32.store8 offset=67
          local.get 4
          local.get 4
          i32.load16_u offset=81 align=1
          i32.store16 offset=65 align=1
          local.get 4
          local.get 4
          i32.load offset=92
          i32.store offset=76
          local.get 4
          local.get 4
          i64.load offset=84 align=4
          i64.store offset=68 align=4
          local.get 4
          local.get 13
          i32.store8 offset=64
          i32.const 1063112
          i32.const 43
          local.get 4
          i32.const 64
          i32.add
          i32.const 1063096
          i32.const 1063156
          call $core::result::unwrap_failed
          unreachable
        end
        i32.const 1059464
        i32.const 43
        local.get 4
        i32.const 175
        i32.add
        i32.const 1059448
        i32.const 1059508
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1059464
      i32.const 43
      local.get 4
      i32.const 175
      i32.add
      i32.const 1059448
      i32.const 1059508
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1059464
    i32.const 43
    local.get 4
    i32.const 175
    i32.add
    i32.const 1059448
    i32.const 1059508
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::hello::module<nanvm_lib::naive::Naive>::{closure#0}::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;260;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32)
    global.get $__stack_pointer
    i32.const 32
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 4
    local.get 3
    i32.store offset=12
    local.get 4
    local.get 2
    i32.store offset=8
    local.get 4
    i32.const 0
    i32.store8 offset=19
    local.get 4
    local.get 4
    i32.const 19
    i32.add
    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::empty::Empty<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
    local.get 4
    local.get 4
    i32.load offset=4
    local.tee 5
    i32.store offset=24
    local.get 4
    local.get 4
    i32.load
    local.tee 3
    i32.store offset=20
    block ;; label = @1
      block ;; label = @2
        local.get 4
        i32.load8_u offset=19
        i32.const 1
        i32.ne
        br_if 0 (;@2;)
        local.get 3
        local.get 3
        i32.load
        i32.const -1
        i32.add
        local.tee 2
        i32.store
        local.get 2
        br_if 1 (;@1;)
        local.get 4
        i32.const 20
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
        br 1 (;@1;)
      end
      local.get 3
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      i32.const 51
      i32.const 0
      local.get 3
      local.get 5
      i32.const 1059261
      i32.const 20
      call $<nanvm_lib::naive::function::Function>::new
      i32.store offset=12
      local.get 0
      i32.const 7
      i32.store8 offset=8
      local.get 0
      i64.const 0
      i64.store
      local.get 2
      local.get 2
      i32.load
      i32.const -1
      i32.add
      local.tee 0
      i32.store
      block ;; label = @2
        local.get 0
        br_if 0 (;@2;)
        local.get 4
        i32.const 8
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
      end
      local.get 4
      i32.const 32
      i32.add
      global.set $__stack_pointer
      return
    end
    i32.const 1059464
    i32.const 43
    local.get 4
    i32.const 31
    i32.add
    i32.const 1059448
    i32.const 1059508
    call $core::result::unwrap_failed
    unreachable
  )
