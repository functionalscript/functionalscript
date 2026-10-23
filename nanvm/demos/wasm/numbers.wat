  (func $nanvm_demos::samples::numbers::module::<nanvm_lib::naive::Naive> (;404;) (type 1) (param i32 i32)
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
    i32.const 1059328
    i32.store offset=24
    local.get 2
    i32.const 1059321
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
          i32.const 108
          i32.const 0
          local.get 3
          local.get 6
          i32.const 1059746
          i32.const 44
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
          call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
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
        i32.const 1055372
        i32.const 43
        local.get 2
        i32.const 32
        i32.add
        i32.const 1055356
        i32.const 1055416
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1053928
      i32.const 43
      local.get 2
      i32.const 95
      i32.add
      i32.const 1053912
      i32.const 1053972
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1053928
    i32.const 43
    local.get 2
    i32.const 95
    i32.add
    i32.const 1053912
    i32.const 1053972
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::numbers::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;405;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 f64)
    global.get $__stack_pointer
    i32.const 256
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 4
    local.get 3
    i32.store offset=20
    local.get 4
    local.get 2
    i32.store offset=16
    local.get 2
    local.get 2
    i32.load
    i32.const 1
    i32.add
    local.tee 5
    i32.store
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            local.get 5
            i32.eqz
            br_if 0 (;@4;)
            local.get 4
            local.get 3
            i32.store offset=32
            local.get 4
            local.get 2
            i32.store offset=28
            local.get 4
            i32.const 6
            i32.store8 offset=24
            local.get 4
            i32.const 0
            i32.store8 offset=56
            local.get 4
            i64.const 4502148214488346440
            i64.store offset=232
            local.get 4
            i32.const 2
            i32.store8 offset=224
            local.get 4
            i64.const 4643985272004935680
            i64.store offset=216
            local.get 4
            i32.const 2
            i32.store8 offset=208
            local.get 4
            i64.const -4592193876290174976
            i64.store offset=200
            local.get 4
            i32.const 2
            i32.store8 offset=192
            local.get 4
            i64.const 0
            i64.store offset=184
            local.get 4
            i32.const 2
            i32.store8 offset=176
            local.get 4
            i64.const 17179869184
            i64.store offset=168
            local.get 4
            local.get 4
            i32.const 56
            i32.add
            i32.store offset=240
            local.get 4
            i32.const 8
            i32.add
            local.get 4
            i32.const 168
            i32.add
            call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 4>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
            local.get 4
            local.get 4
            i32.load offset=12
            local.tee 6
            i32.store offset=108
            local.get 4
            local.get 4
            i32.load offset=8
            local.tee 5
            i32.store offset=104
            block ;; label = @5
              local.get 4
              i32.load8_u offset=56
              i32.const 1
              i32.ne
              br_if 0 (;@5;)
              local.get 5
              local.get 5
              i32.load
              i32.const -1
              i32.add
              local.tee 2
              i32.store
              local.get 2
              br_if 4 (;@1;)
              local.get 4
              i32.const 104
              i32.add
              call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
              br 4 (;@1;)
            end
            local.get 5
            i32.eqz
            br_if 3 (;@1;)
            local.get 4
            local.get 6
            i32.store offset=160
            local.get 4
            local.get 5
            i32.store offset=156
            local.get 4
            i32.const 6
            i32.store8 offset=152
            local.get 2
            local.get 2
            i32.load
            i32.const 1
            i32.add
            local.tee 5
            i32.store
            local.get 5
            i32.eqz
            br_if 0 (;@4;)
            local.get 4
            local.get 2
            i32.store offset=108
            local.get 4
            i32.const 6
            i32.store8 offset=104
            local.get 4
            local.get 3
            i64.extend_i32_u
            i64.store offset=112
            local.get 4
            i64.const 0
            i64.store offset=176
            local.get 4
            i32.const 2
            i32.store8 offset=168
            local.get 4
            i32.const 56
            i32.add
            local.get 4
            i32.const 104
            i32.add
            local.get 4
            i32.const 168
            i32.add
            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
            block ;; label = @5
              block ;; label = @6
                local.get 4
                i32.load8_u offset=56
                i32.const 255
                i32.ne
                br_if 0 (;@6;)
                local.get 0
                local.get 4
                i64.load offset=72
                i64.store offset=16
                local.get 0
                local.get 4
                i64.load offset=64
                i64.store offset=8
                local.get 0
                i64.const 1
                i64.store
                local.get 4
                i32.const 152
                i32.add
                call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                br 1 (;@5;)
              end
              local.get 4
              local.get 4
              i64.load offset=80
              i64.store offset=192
              local.get 4
              local.get 4
              i64.load offset=72
              i64.store offset=184
              local.get 4
              local.get 4
              i64.load offset=64
              i64.store offset=176
              local.get 4
              local.get 4
              i64.load offset=56
              i64.store offset=168
              local.get 4
              i32.const 104
              i32.add
              local.get 4
              i32.const 168
              i32.add
              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=104
                  i32.const 255
                  i32.eq
                  br_if 0 (;@7;)
                  local.get 4
                  local.get 4
                  i64.load offset=112
                  i64.store offset=96
                  local.get 4
                  local.get 4
                  i64.load offset=104
                  i64.store offset=88
                  br 1 (;@6;)
                end
                local.get 4
                i32.const 256
                i32.store16 offset=88
              end
              local.get 4
              i32.const 168
              i32.add
              call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 184
              i32.add
              call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 168
              i32.add
              local.get 4
              i32.const 88
              i32.add
              call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::to_numeric
              local.get 4
              f64.load offset=184
              local.set 7
              local.get 4
              i32.load offset=180
              local.set 3
              local.get 4
              i32.load offset=176
              local.set 5
              block ;; label = @6
                local.get 4
                i32.load offset=168
                br_if 0 (;@6;)
                block ;; label = @7
                  local.get 5
                  i32.const 1
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 4
                  local.get 7
                  f64.store offset=172 align=4
                  local.get 4
                  local.get 3
                  i32.store offset=168
                  local.get 4
                  i32.const 168
                  i32.add
                  call $<nanvm_lib::vm::bigint::BigInt<nanvm_lib::naive::Naive>>::to_number
                  local.set 7
                  local.get 3
                  local.get 3
                  i32.load
                  i32.const -1
                  i32.add
                  local.tee 5
                  i32.store
                  local.get 5
                  br_if 0 (;@7;)
                  local.get 4
                  i32.const 168
                  i32.add
                  call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                end
                local.get 4
                local.get 7
                f64.store offset=48
                local.get 4
                i32.const 2
                i32.store offset=40
                local.get 4
                i32.const 104
                i32.add
                local.get 4
                i32.const 152
                i32.add
                local.get 4
                i32.const 40
                i32.add
                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=104
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 0
                  local.get 4
                  i64.load offset=120
                  i64.store offset=16
                  local.get 0
                  local.get 4
                  i64.load offset=112
                  i64.store offset=8
                  local.get 0
                  i64.const 1
                  i64.store
                  br 2 (;@5;)
                end
                local.get 4
                local.get 4
                i64.load offset=128
                i64.store offset=192
                local.get 4
                local.get 4
                i64.load offset=120
                i64.store offset=184
                local.get 4
                local.get 4
                i64.load offset=112
                i64.store offset=176
                local.get 4
                local.get 4
                i64.load offset=104
                i64.store offset=168
                local.get 4
                i32.const 152
                i32.add
                local.get 4
                i32.const 168
                i32.add
                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=152
                    i32.const 255
                    i32.eq
                    br_if 0 (;@8;)
                    local.get 4
                    local.get 4
                    i64.load offset=160
                    i64.store offset=144
                    local.get 4
                    local.get 4
                    i64.load offset=152
                    i64.store offset=136
                    br 1 (;@7;)
                  end
                  local.get 4
                  i32.const 256
                  i32.store16 offset=136
                end
                local.get 4
                i32.const 168
                i32.add
                call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i32.const 184
                i32.add
                call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i64.const 4611686018427387904
                i64.store offset=176
                local.get 4
                i32.const 2
                i32.store8 offset=168
                local.get 0
                local.get 4
                i32.const 136
                i32.add
                local.get 4
                i32.const 168
                i32.add
                call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::arith::Mul>::mul>"
                local.get 4
                i32.const 24
                i32.add
                call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 2
                local.get 2
                i32.load
                i32.const -1
                i32.add
                local.tee 3
                i32.store
                local.get 3
                br_if 4 (;@2;)
                br 3 (;@3;)
              end
              local.get 0
              local.get 7
              f64.store offset=16
              local.get 0
              local.get 3
              i32.store offset=12
              local.get 0
              local.get 5
              i32.store offset=8
              local.get 0
              i64.const 1
              i64.store
              local.get 4
              i32.const 152
              i32.add
              call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            end
            local.get 4
            i32.const 24
            i32.add
            call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
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
          unreachable
        end
        local.get 4
        i32.const 16
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
      end
      local.get 4
      i32.const 256
      i32.add
      global.set $__stack_pointer
      return
    end
    i32.const 1053928
    i32.const 43
    local.get 4
    i32.const 255
    i32.add
    i32.const 1053912
    i32.const 1053972
    call $core::result::unwrap_failed
    unreachable
  )
