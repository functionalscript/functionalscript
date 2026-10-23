  (func $nanvm_demos::samples::exports::module::<nanvm_lib::naive::Naive> (;577;) (type 1) (param i32 i32)
    (local i32 i32 i32 i32 i32 i64)
    global.get $__stack_pointer
    i32.const 128
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    local.get 2
    i32.const 0
    i32.store16 offset=36
    local.get 2
    i32.const 1063748
    i32.store offset=32
    local.get 2
    i32.const 1063741
    i32.store offset=28
    local.get 2
    i32.const 56
    i32.add
    local.get 2
    i32.const 28
    i32.add
    call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            local.get 2
            i32.load8_u offset=56
            local.tee 3
            i32.const 255
            i32.ne
            br_if 0 (;@4;)
            local.get 2
            i32.load offset=64
            local.set 4
            local.get 2
            i32.load offset=60
            local.set 5
            local.get 2
            i32.const 0
            i32.store8 offset=40
            local.get 2
            i32.const 16
            i32.add
            local.get 2
            i32.const 40
            i32.add
            call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::empty::Empty<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
            local.get 2
            local.get 2
            i32.load offset=20
            local.tee 6
            i32.store offset=60
            local.get 2
            local.get 2
            i32.load offset=16
            local.tee 3
            i32.store offset=56
            block ;; label = @5
              local.get 2
              i32.load8_u offset=40
              i32.const 1
              i32.ne
              br_if 0 (;@5;)
              local.get 3
              local.get 3
              i32.load
              i32.const -1
              i32.add
              local.tee 0
              i32.store
              local.get 0
              br_if 4 (;@1;)
              local.get 2
              i32.const 56
              i32.add
              call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
              br 4 (;@1;)
            end
            local.get 3
            i32.eqz
            br_if 3 (;@1;)
            i32.const 193
            i32.const 0
            local.get 3
            local.get 6
            i32.const 1064037
            i32.const 16
            call $<nanvm_lib::naive::function::Function>::new
            local.set 3
            local.get 2
            i32.const 0
            i32.store16 offset=36
            local.get 2
            i32.const 1064057
            i32.store offset=32
            local.get 2
            i32.const 1064053
            i32.store offset=28
            local.get 2
            i32.const 56
            i32.add
            local.get 2
            i32.const 28
            i32.add
            call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
            local.get 2
            i32.load8_u offset=56
            local.tee 6
            i32.const 255
            i32.ne
            br_if 1 (;@3;)
            local.get 2
            i64.load offset=60 align=4
            local.set 7
            local.get 2
            i32.const 0
            i32.store8 offset=28
            local.get 2
            i64.const 4617315517961601024
            i64.store offset=104
            local.get 2
            i32.const 2
            i32.store8 offset=96
            local.get 2
            local.get 7
            i64.store offset=88
            local.get 2
            local.get 3
            i32.store offset=76
            local.get 2
            i32.const 7
            i32.store8 offset=72
            local.get 2
            local.get 4
            i32.store offset=68
            local.get 2
            local.get 5
            i32.store offset=64
            local.get 2
            i64.const 8589934592
            i64.store offset=56
            local.get 2
            local.get 2
            i32.const 28
            i32.add
            i32.store offset=112
            local.get 2
            i32.const 8
            i32.add
            local.get 2
            i32.const 56
            i32.add
            call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 2>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
            local.get 2
            local.get 2
            i32.load offset=12
            local.tee 6
            i32.store offset=44
            local.get 2
            local.get 2
            i32.load offset=8
            local.tee 3
            i32.store offset=40
            block ;; label = @5
              local.get 2
              i32.load8_u offset=28
              i32.const 1
              i32.ne
              br_if 0 (;@5;)
              local.get 3
              local.get 3
              i32.load
              i32.const -1
              i32.add
              local.tee 0
              i32.store
              local.get 0
              br_if 3 (;@2;)
              local.get 2
              i32.const 40
              i32.add
              call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
              br 3 (;@2;)
            end
            local.get 3
            i32.eqz
            br_if 2 (;@2;)
            local.get 0
            local.get 6
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
            call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 2
            i32.const 128
            i32.add
            global.set $__stack_pointer
            return
          end
          local.get 2
          local.get 2
          i32.load8_u offset=59
          i32.store8 offset=43
          local.get 2
          local.get 2
          i32.load16_u offset=57 align=1
          i32.store16 offset=41 align=1
          local.get 2
          local.get 2
          i32.load offset=68
          i32.store offset=52
          local.get 2
          local.get 2
          i64.load offset=60 align=4
          i64.store offset=44 align=4
          local.get 2
          local.get 3
          i32.store8 offset=40
          i32.const 1063112
          i32.const 43
          local.get 2
          i32.const 40
          i32.add
          i32.const 1063096
          i32.const 1063156
          call $core::result::unwrap_failed
          unreachable
        end
        local.get 2
        local.get 2
        i32.load8_u offset=59
        i32.store8 offset=43
        local.get 2
        local.get 2
        i32.load16_u offset=57 align=1
        i32.store16 offset=41 align=1
        local.get 2
        local.get 2
        i32.load offset=68
        i32.store offset=52
        local.get 2
        local.get 2
        i64.load offset=60 align=4
        i64.store offset=44 align=4
        local.get 2
        local.get 6
        i32.store8 offset=40
        i32.const 1063112
        i32.const 43
        local.get 2
        i32.const 40
        i32.add
        i32.const 1063096
        i32.const 1063156
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1059464
      i32.const 43
      local.get 2
      i32.const 127
      i32.add
      i32.const 1059448
      i32.const 1059508
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1059464
    i32.const 43
    local.get 2
    i32.const 127
    i32.add
    i32.const 1059448
    i32.const 1059508
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::exports::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;578;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32)
    global.get $__stack_pointer
    i32.const 144
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 4
    local.get 3
    i32.store offset=12
    local.get 4
    local.get 2
    i32.store offset=8
    block ;; label = @1
      local.get 2
      i32.load
      local.tee 5
      i32.const -1
      i32.eq
      br_if 0 (;@1;)
      local.get 4
      local.get 3
      i32.store offset=24
      local.get 4
      local.get 2
      i32.store offset=20
      local.get 4
      i32.const 6
      i32.store8 offset=16
      local.get 4
      i64.const 4617315517961601024
      i64.store offset=40
      local.get 4
      i32.const 2
      i32.store8 offset=32
      local.get 2
      local.get 5
      i32.const 2
      i32.add
      local.tee 5
      i32.store
      local.get 5
      i32.eqz
      br_if 0 (;@1;)
      local.get 4
      local.get 2
      i32.store offset=132
      local.get 4
      i32.const 6
      i32.store8 offset=128
      local.get 4
      local.get 3
      i64.extend_i32_u
      i64.store offset=136
      local.get 4
      i64.const 0
      i64.store offset=88
      local.get 4
      i32.const 2
      i32.store8 offset=80
      local.get 4
      i32.const 48
      i32.add
      local.get 4
      i32.const 128
      i32.add
      local.get 4
      i32.const 80
      i32.add
      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            local.get 4
            i32.load8_u offset=48
            i32.const 255
            i32.ne
            br_if 0 (;@4;)
            local.get 0
            local.get 4
            i64.load offset=64
            i64.store offset=16
            local.get 0
            local.get 4
            i64.load offset=56
            i64.store offset=8
            local.get 0
            i64.const 1
            i64.store
            local.get 4
            i32.const 32
            i32.add
            call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 4
            i32.const 16
            i32.add
            call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 2
            local.get 2
            i32.load
            i32.const -1
            i32.add
            local.tee 3
            i32.store
            local.get 3
            i32.eqz
            br_if 1 (;@3;)
            br 2 (;@2;)
          end
          local.get 4
          local.get 4
          i64.load offset=72
          i64.store offset=104
          local.get 4
          local.get 4
          i64.load offset=64
          i64.store offset=96
          local.get 4
          local.get 4
          i64.load offset=56
          i64.store offset=88
          local.get 4
          local.get 4
          i64.load offset=48
          i64.store offset=80
          local.get 4
          i32.const 128
          i32.add
          local.get 4
          i32.const 80
          i32.add
          call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
          block ;; label = @4
            block ;; label = @5
              local.get 4
              i32.load8_u offset=128
              i32.const 255
              i32.eq
              br_if 0 (;@5;)
              local.get 4
              local.get 4
              i64.load offset=136
              i64.store offset=120
              local.get 4
              local.get 4
              i64.load offset=128
              i64.store offset=112
              br 1 (;@4;)
            end
            local.get 4
            i32.const 256
            i32.store16 offset=112
          end
          local.get 4
          i32.const 80
          i32.add
          call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          local.get 4
          i32.const 96
          i32.add
          call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          local.get 0
          local.get 4
          i32.const 32
          i32.add
          local.get 4
          i32.const 112
          i32.add
          call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::arith::Mul>::mul>"
          local.get 4
          i32.const 16
          i32.add
          call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          local.get 2
          local.get 2
          i32.load
          i32.const -1
          i32.add
          local.tee 3
          i32.store
          local.get 3
          br_if 1 (;@2;)
        end
        local.get 4
        i32.const 8
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
      end
      local.get 4
      i32.const 144
      i32.add
      global.set $__stack_pointer
      return
    end
    unreachable
  )
