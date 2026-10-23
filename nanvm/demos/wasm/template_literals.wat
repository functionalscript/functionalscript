  (func $nanvm_demos::samples::template_literals::module::<nanvm_lib::naive::Naive> (;229;) (type 1) (param i32 i32)
    (local i32 i32 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 112
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    local.get 2
    i32.const 255
    i32.store8 offset=40
    local.get 2
    i32.const 0
    i32.store16 offset=72
    local.get 2
    i32.const 1055183
    i32.store offset=68
    local.get 2
    i32.const 1055176
    i32.store offset=64
    local.get 2
    local.get 2
    i32.const 40
    i32.add
    i32.store offset=76
    local.get 2
    i32.const 24
    i32.add
    local.get 2
    i32.const 64
    i32.add
    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>> as alloc::rc::ToRcSlice<u16>>::to_rc_slice"
    local.get 2
    local.get 2
    i32.load offset=28
    local.tee 3
    i32.store offset=60
    local.get 2
    local.get 2
    i32.load offset=24
    local.tee 4
    i32.store offset=56
    block ;; label = @1
      local.get 2
      i32.load8_u offset=40
      local.tee 5
      i32.const 255
      i32.eq
      br_if 0 (;@1;)
      local.get 2
      i32.load offset=44
      local.set 0
      local.get 2
      i32.load offset=48
      local.set 3
      local.get 2
      i32.load offset=52
      local.set 1
      local.get 2
      i32.load16_u offset=41 align=1
      local.set 6
      local.get 2
      i32.load8_u offset=43
      local.set 7
      local.get 4
      local.get 4
      i32.load
      i32.const -1
      i32.add
      local.tee 8
      i32.store
      local.get 2
      local.get 7
      i32.store8 offset=38
      local.get 2
      local.get 6
      i32.store16 offset=36
      block ;; label = @2
        local.get 8
        br_if 0 (;@2;)
        local.get 2
        i32.const 56
        i32.add
        call $"<alloc::rc::Rc<[u16]>>::drop_slow"
      end
      local.get 2
      local.get 5
      i32.store8 offset=64
      local.get 2
      local.get 2
      i32.load16_u offset=36
      i32.store16 offset=65 align=1
      local.get 2
      local.get 2
      i32.load8_u offset=38
      i32.store8 offset=67
      local.get 2
      local.get 1
      i32.store offset=76
      local.get 2
      local.get 3
      i32.store offset=72
      local.get 2
      local.get 0
      i32.store offset=68
      i32.const 1055372
      i32.const 43
      local.get 2
      i32.const 64
      i32.add
      i32.const 1055356
      i32.const 1055416
      call $core::result::unwrap_failed
      unreachable
    end
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
    i32.store offset=68
    local.get 2
    local.get 2
    i32.load offset=16
    local.tee 5
    i32.store offset=64
    block ;; label = @1
      block ;; label = @2
        local.get 2
        i32.load8_u offset=40
        i32.const 1
        i32.ne
        br_if 0 (;@2;)
        local.get 5
        local.get 5
        i32.load
        i32.const -1
        i32.add
        local.tee 0
        i32.store
        local.get 0
        br_if 1 (;@1;)
        local.get 2
        i32.const 64
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
        br 1 (;@1;)
      end
      local.get 5
      i32.eqz
      br_if 0 (;@1;)
      i32.const 8
      i32.const 0
      local.get 5
      local.get 6
      i32.const 1055239
      i32.const 68
      call $<nanvm_lib::naive::function::Function>::new
      local.set 5
      local.get 2
      i32.const 0
      i32.store8 offset=56
      local.get 2
      local.get 5
      i32.store offset=84
      local.get 2
      i32.const 7
      i32.store8 offset=80
      local.get 2
      local.get 3
      i32.store offset=76
      local.get 2
      local.get 4
      i32.store offset=72
      local.get 2
      i64.const 4294967296
      i64.store offset=64
      local.get 2
      local.get 2
      i32.const 56
      i32.add
      i32.store offset=96
      local.get 2
      i32.const 8
      i32.add
      local.get 2
      i32.const 64
      i32.add
      call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 1>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
      local.get 2
      local.get 2
      i32.load offset=12
      local.tee 4
      i32.store offset=44
      local.get 2
      local.get 2
      i32.load offset=8
      local.tee 5
      i32.store offset=40
      block ;; label = @2
        block ;; label = @3
          local.get 2
          i32.load8_u offset=56
          i32.const 1
          i32.ne
          br_if 0 (;@3;)
          local.get 5
          local.get 5
          i32.load
          i32.const -1
          i32.add
          local.tee 0
          i32.store
          local.get 0
          br_if 1 (;@2;)
          local.get 2
          i32.const 40
          i32.add
          call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
          br 1 (;@2;)
        end
        local.get 5
        i32.eqz
        br_if 0 (;@2;)
        local.get 0
        local.get 4
        i32.store offset=16
        local.get 0
        local.get 5
        i32.store offset=12
        local.get 0
        i32.const 5
        i32.store8 offset=8
        local.get 0
        i64.const 0
        i64.store
        local.get 1
        call $"#func226 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
        local.get 2
        i32.const 112
        i32.add
        global.set $__stack_pointer
        return
      end
      i32.const 1053928
      i32.const 43
      local.get 2
      i32.const 111
      i32.add
      i32.const 1053912
      i32.const 1053972
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1053928
    i32.const 43
    local.get 2
    i32.const 111
    i32.add
    i32.const 1053912
    i32.const 1053972
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::template_literals::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;230;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i32 i32 i32 i64)
    global.get $__stack_pointer
    i32.const 384
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 4
    local.get 3
    i32.store offset=52
    local.get 4
    local.get 2
    i32.store offset=48
    local.get 2
    local.get 2
    i32.load
    i32.const 1
    i32.add
    local.tee 5
    i32.store
    block ;; label = @1
      local.get 5
      i32.eqz
      br_if 0 (;@1;)
      local.get 4
      local.get 3
      i32.store offset=64
      local.get 4
      local.get 2
      i32.store offset=60
      local.get 4
      i32.const 6
      i32.store8 offset=56
      local.get 4
      i32.const 255
      i32.store8 offset=256
      local.get 4
      i32.const 0
      i32.store16 offset=344
      local.get 4
      i32.const 1055439
      i32.store offset=340
      local.get 4
      i32.const 1055432
      i32.store offset=336
      local.get 4
      local.get 4
      i32.const 256
      i32.add
      i32.store offset=348
      local.get 4
      i32.const 40
      i32.add
      local.get 4
      i32.const 336
      i32.add
      call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>> as alloc::rc::ToRcSlice<u16>>::to_rc_slice"
      local.get 4
      local.get 4
      i32.load offset=44
      local.tee 5
      i32.store offset=372
      local.get 4
      local.get 4
      i32.load offset=40
      local.tee 3
      i32.store offset=368
      block ;; label = @2
        local.get 4
        i32.load8_u offset=256
        local.tee 6
        i32.const 255
        i32.eq
        br_if 0 (;@2;)
        local.get 4
        i32.load offset=260
        local.set 2
        local.get 4
        i32.load offset=264
        local.set 0
        local.get 4
        i32.load offset=268
        local.set 5
        local.get 4
        i32.load16_u offset=257 align=1
        local.set 7
        local.get 4
        i32.load8_u offset=259
        local.set 8
        local.get 3
        local.get 3
        i32.load
        i32.const -1
        i32.add
        local.tee 9
        i32.store
        local.get 4
        local.get 8
        i32.store8 offset=290
        local.get 4
        local.get 7
        i32.store16 offset=288
        block ;; label = @3
          local.get 9
          br_if 0 (;@3;)
          local.get 4
          i32.const 368
          i32.add
          call $"<alloc::rc::Rc<[u16]>>::drop_slow"
        end
        local.get 4
        local.get 6
        i32.store8 offset=336
        local.get 4
        local.get 4
        i32.load16_u offset=288
        i32.store16 offset=337 align=1
        local.get 4
        local.get 4
        i32.load8_u offset=290
        i32.store8 offset=339
        local.get 4
        local.get 5
        i32.store offset=348
        local.get 4
        local.get 0
        i32.store offset=344
        local.get 4
        local.get 2
        i32.store offset=340
        i32.const 1055372
        i32.const 43
        local.get 4
        i32.const 336
        i32.add
        i32.const 1055356
        i32.const 1055416
        call $core::result::unwrap_failed
        unreachable
      end
      local.get 4
      local.get 5
      i32.store offset=232
      local.get 4
      local.get 3
      i32.store offset=228
      local.get 4
      i32.const 3
      i32.store8 offset=224
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=56
                          local.tee 5
                          br_table 6 (;@5;) 6 (;@5;) 0 (;@11;) 1 (;@10;) 2 (;@9;) 3 (;@8;) 4 (;@7;) 5 (;@6;) 6 (;@5;)
                        end
                        local.get 4
                        i64.load offset=64
                        local.set 10
                        br 8 (;@2;)
                      end
                      local.get 4
                      i32.load offset=60
                      local.tee 3
                      local.get 3
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 6
                      i32.store
                      local.get 6
                      i32.eqz
                      br_if 8 (;@1;)
                      br 6 (;@3;)
                    end
                    local.get 4
                    i32.load offset=60
                    local.tee 3
                    local.get 3
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 6
                    i32.store
                    local.get 6
                    i32.eqz
                    br_if 7 (;@1;)
                    local.get 4
                    i64.load8_u offset=68
                    i64.const 32
                    i64.shl
                    local.get 4
                    i64.load32_u offset=64
                    i64.or
                    local.set 10
                    br 6 (;@2;)
                  end
                  local.get 4
                  i32.load offset=60
                  local.tee 3
                  local.get 3
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 6
                  i32.store
                  local.get 6
                  br_if 4 (;@3;)
                  br 6 (;@1;)
                end
                local.get 4
                i32.load offset=60
                local.tee 3
                local.get 3
                i32.load
                i32.const 1
                i32.add
                local.tee 6
                i32.store
                local.get 6
                br_if 3 (;@3;)
                br 5 (;@1;)
              end
              local.get 4
              i32.load offset=60
              local.tee 3
              local.get 3
              i32.load
              i32.const 1
              i32.add
              local.tee 6
              i32.store
              local.get 6
              i32.eqz
              br_if 4 (;@1;)
              br 1 (;@4;)
            end
            local.get 4
            i32.load8_u offset=57
            local.set 6
          end
          br 1 (;@2;)
        end
        local.get 4
        i64.load32_u offset=64
        local.set 10
      end
      local.get 4
      local.get 10
      i64.store offset=376
      local.get 4
      local.get 3
      i32.store offset=372
      local.get 4
      local.get 6
      i32.store8 offset=369
      local.get 4
      local.get 5
      i32.store8 offset=368
      local.get 4
      i64.const 0
      i64.store offset=344
      local.get 4
      i32.const 2
      i32.store8 offset=336
      local.get 4
      i32.const 256
      i32.add
      local.get 4
      i32.const 368
      i32.add
      local.get 4
      i32.const 336
      i32.add
      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              local.get 4
              i32.load8_u offset=256
              i32.const 255
              i32.ne
              br_if 0 (;@5;)
              local.get 0
              local.get 4
              i64.load offset=272
              i64.store offset=16
              local.get 0
              local.get 4
              i64.load offset=264
              i64.store offset=8
              local.get 0
              i64.const 1
              i64.store
              local.get 4
              i32.const 224
              i32.add
              call $"#func226 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              br 1 (;@4;)
            end
            local.get 4
            local.get 4
            i64.load offset=280
            i64.store offset=360
            local.get 4
            local.get 4
            i64.load offset=272
            i64.store offset=352
            local.get 4
            local.get 4
            i64.load offset=264
            i64.store offset=344
            local.get 4
            local.get 4
            i64.load offset=256
            i64.store offset=336
            local.get 4
            i32.const 368
            i32.add
            local.get 4
            i32.const 336
            i32.add
            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
            block ;; label = @5
              block ;; label = @6
                local.get 4
                i32.load8_u offset=368
                i32.const 255
                i32.eq
                br_if 0 (;@6;)
                local.get 4
                local.get 4
                i64.load offset=376
                i64.store offset=296
                local.get 4
                local.get 4
                i64.load offset=368
                i64.store offset=288
                br 1 (;@5;)
              end
              local.get 4
              i32.const 256
              i32.store16 offset=288
            end
            local.get 4
            i32.const 336
            i32.add
            call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 4
            i32.const 352
            i32.add
            call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 4
            i32.const 240
            i32.add
            local.get 4
            i32.const 288
            i32.add
            call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::primitive_dispatch::ViaPrimitive<nanvm_lib::vm::string_coercion::StringCoercion>>
            block ;; label = @5
              local.get 4
              i32.load8_u offset=240
              local.tee 3
              i32.const 255
              i32.eq
              br_if 0 (;@5;)
              local.get 0
              local.get 4
              i32.load8_u offset=243
              i32.store8 offset=11
              local.get 0
              local.get 4
              i32.load16_u offset=241 align=1
              i32.store16 offset=9 align=1
              local.get 4
              i64.load offset=244 align=4
              local.set 10
              local.get 0
              local.get 4
              i32.load offset=252
              i32.store offset=20
              local.get 0
              local.get 10
              i64.store offset=12 align=4
              local.get 0
              local.get 3
              i32.store8 offset=8
              local.get 0
              i64.const 1
              i64.store
              local.get 4
              i32.const 224
              i32.add
              call $"#func226 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              br 1 (;@4;)
            end
            local.get 4
            local.get 4
            i64.load offset=244 align=4
            i64.store offset=172 align=4
            local.get 4
            i32.const 3
            i32.store8 offset=168
            local.get 4
            i32.const 304
            i32.add
            local.get 4
            i32.const 224
            i32.add
            local.get 4
            i32.const 168
            i32.add
            call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
            local.get 4
            local.get 4
            i64.load offset=312
            i64.store offset=152
            local.get 4
            local.get 4
            i64.load offset=320
            i64.store offset=160
            block ;; label = @5
              local.get 4
              i64.load offset=304
              i64.const 1
              i64.ne
              br_if 0 (;@5;)
              local.get 0
              local.get 4
              i64.load offset=160
              i64.store offset=16
              local.get 0
              local.get 4
              i64.load offset=152
              i64.store offset=8
              local.get 0
              i64.const 1
              i64.store
              br 1 (;@4;)
            end
            local.get 4
            local.get 4
            i64.load offset=160
            i64.store offset=192
            local.get 4
            local.get 4
            i64.load offset=152
            i64.store offset=184
            local.get 4
            i32.const 255
            i32.store8 offset=304
            local.get 4
            i32.const 0
            i32.store16 offset=344
            local.get 4
            i32.const 1055445
            i32.store offset=340
            local.get 4
            i32.const 1055439
            i32.store offset=336
            local.get 4
            local.get 4
            i32.const 304
            i32.add
            i32.store offset=348
            local.get 4
            i32.const 32
            i32.add
            local.get 4
            i32.const 336
            i32.add
            call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>> as alloc::rc::ToRcSlice<u16>>::to_rc_slice"
            local.get 4
            local.get 4
            i32.load offset=36
            local.tee 5
            i32.store offset=372
            local.get 4
            local.get 4
            i32.load offset=32
            local.tee 3
            i32.store offset=368
            block ;; label = @5
              local.get 4
              i32.load8_u offset=304
              local.tee 6
              i32.const 255
              i32.eq
              br_if 0 (;@5;)
              local.get 4
              i32.load offset=308
              local.set 2
              local.get 4
              i32.load offset=312
              local.set 0
              local.get 4
              i32.load offset=316
              local.set 5
              local.get 4
              i32.load16_u offset=305 align=1
              local.set 7
              local.get 4
              i32.load8_u offset=307
              local.set 8
              local.get 3
              local.get 3
              i32.load
              i32.const -1
              i32.add
              local.tee 9
              i32.store
              local.get 4
              local.get 8
              i32.store8 offset=242
              local.get 4
              local.get 7
              i32.store16 offset=240
              block ;; label = @6
                local.get 9
                br_if 0 (;@6;)
                local.get 4
                i32.const 368
                i32.add
                call $"<alloc::rc::Rc<[u16]>>::drop_slow"
              end
              local.get 4
              local.get 6
              i32.store8 offset=336
              local.get 4
              local.get 4
              i32.load16_u offset=240
              i32.store16 offset=337 align=1
              local.get 4
              local.get 4
              i32.load8_u offset=242
              i32.store8 offset=339
              local.get 4
              local.get 5
              i32.store offset=348
              local.get 4
              local.get 0
              i32.store offset=344
              local.get 4
              local.get 2
              i32.store offset=340
              i32.const 1055372
              i32.const 43
              local.get 4
              i32.const 336
              i32.add
              i32.const 1055356
              i32.const 1055416
              call $core::result::unwrap_failed
              unreachable
            end
            local.get 4
            local.get 5
            i32.store offset=344
            local.get 4
            local.get 3
            i32.store offset=340
            local.get 4
            i32.const 3
            i32.store8 offset=336
            local.get 4
            i32.const 128
            i32.add
            local.get 4
            i32.const 184
            i32.add
            local.get 4
            i32.const 336
            i32.add
            call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
            local.get 4
            local.get 4
            i64.load offset=136
            i64.store offset=112
            local.get 4
            local.get 4
            i64.load offset=144
            i64.store offset=120
            block ;; label = @5
              local.get 4
              i64.load offset=128
              i64.const 1
              i64.ne
              br_if 0 (;@5;)
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
              br 1 (;@4;)
            end
            local.get 4
            local.get 4
            i64.load offset=120
            i64.store offset=104
            local.get 4
            local.get 4
            i64.load offset=112
            i64.store offset=96
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                local.get 4
                                i32.load8_u offset=56
                                local.tee 5
                                br_table 6 (;@8;) 6 (;@8;) 0 (;@14;) 1 (;@13;) 2 (;@12;) 3 (;@11;) 4 (;@10;) 5 (;@9;) 6 (;@8;)
                              end
                              local.get 4
                              i64.load offset=64
                              local.set 10
                              br 8 (;@5;)
                            end
                            local.get 4
                            i32.load offset=60
                            local.tee 3
                            local.get 3
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 6
                            i32.store
                            local.get 6
                            i32.eqz
                            br_if 11 (;@1;)
                            br 6 (;@6;)
                          end
                          local.get 4
                          i32.load offset=60
                          local.tee 3
                          local.get 3
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 6
                          i32.store
                          local.get 6
                          i32.eqz
                          br_if 10 (;@1;)
                          local.get 4
                          i64.load8_u offset=68
                          i64.const 32
                          i64.shl
                          local.get 4
                          i64.load32_u offset=64
                          i64.or
                          local.set 10
                          br 6 (;@5;)
                        end
                        local.get 4
                        i32.load offset=60
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 6
                        i32.store
                        local.get 6
                        i32.eqz
                        br_if 9 (;@1;)
                        br 4 (;@6;)
                      end
                      local.get 4
                      i32.load offset=60
                      local.tee 3
                      local.get 3
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 6
                      i32.store
                      local.get 6
                      i32.eqz
                      br_if 8 (;@1;)
                      br 3 (;@6;)
                    end
                    local.get 4
                    i32.load offset=60
                    local.tee 3
                    local.get 3
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 6
                    i32.store
                    local.get 6
                    i32.eqz
                    br_if 7 (;@1;)
                    br 1 (;@7;)
                  end
                  local.get 4
                  i32.load8_u offset=57
                  local.set 6
                end
                br 1 (;@5;)
              end
              local.get 4
              i64.load32_u offset=64
              local.set 10
            end
            local.get 4
            local.get 10
            i64.store offset=136
            local.get 4
            local.get 3
            i32.store offset=132
            local.get 4
            local.get 6
            i32.store8 offset=129
            local.get 4
            local.get 5
            i32.store8 offset=128
            local.get 4
            i64.const 0
            i64.store offset=344
            local.get 4
            i32.const 2
            i32.store8 offset=336
            local.get 4
            i32.const 304
            i32.add
            local.get 4
            i32.const 128
            i32.add
            local.get 4
            i32.const 336
            i32.add
            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=304
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 4
                  i32.const 312
                  i32.add
                  local.set 3
                  br 1 (;@6;)
                end
                local.get 4
                local.get 4
                i64.load offset=328
                i64.store offset=360
                local.get 4
                local.get 4
                i64.load offset=320
                i64.store offset=352
                local.get 4
                local.get 4
                i64.load offset=312
                i64.store offset=344
                local.get 4
                local.get 4
                i64.load offset=304
                i64.store offset=336
                local.get 4
                i32.const 128
                i32.add
                local.get 4
                i32.const 336
                i32.add
                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=128
                    i32.const 255
                    i32.eq
                    br_if 0 (;@8;)
                    local.get 4
                    local.get 4
                    i64.load offset=136
                    i64.store offset=216
                    local.get 4
                    local.get 4
                    i64.load offset=128
                    i64.store offset=208
                    br 1 (;@7;)
                  end
                  local.get 4
                  i32.const 256
                  i32.store16 offset=208
                end
                local.get 4
                i32.const 336
                i32.add
                call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i32.const 352
                i32.add
                call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i64.const 4607182418800017408
                i64.store offset=376
                local.get 4
                i32.const 2
                i32.store8 offset=368
                local.get 4
                i32.const 336
                i32.add
                local.get 4
                i32.const 208
                i32.add
                local.get 4
                i32.const 368
                i32.add
                call $nanvm_lib::vm::any::relational::compare::<nanvm_lib::naive::Naive>
                local.get 4
                i32.load8_u offset=337
                local.set 3
                local.get 4
                i32.load8_u offset=336
                local.tee 5
                i32.const 255
                i32.eq
                br_if 1 (;@5;)
                local.get 4
                local.get 4
                i64.load offset=344 align=2
                i64.store offset=136 align=2
                local.get 4
                local.get 4
                i64.load offset=338 align=2
                i64.store offset=130 align=2
                local.get 4
                local.get 3
                i32.store8 offset=129
                local.get 4
                local.get 5
                i32.store8 offset=128
                local.get 4
                i32.const 128
                i32.add
                local.set 3
              end
              local.get 0
              i64.const 1
              i64.store
              local.get 0
              local.get 3
              i64.load offset=8
              i64.store offset=16
              local.get 0
              local.get 3
              i64.load
              i64.store offset=8
              local.get 4
              i32.const 96
              i32.add
              call $"#func226 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              br 1 (;@4;)
            end
            local.get 4
            i32.const 1
            i32.store8 offset=128
            local.get 4
            local.get 3
            i32.const 255
            i32.and
            i32.const 1
            i32.eq
            i32.store8 offset=129
            block ;; label = @5
              block ;; label = @6
                local.get 4
                i32.const 128
                i32.add
                call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::boolean_coercion::BooleanCoercion>
                br_if 0 (;@6;)
                local.get 4
                i32.const 24
                i32.add
                i32.const 1
                i32.const 0
                call $"<nanvm_lib::vm::string::String<nanvm_lib::naive::Naive> as core::convert::From<&str>>::from"
                local.get 4
                i32.load offset=28
                local.set 3
                local.get 4
                i32.load offset=24
                local.set 5
                br 1 (;@5;)
              end
              local.get 4
              i32.const 16
              i32.add
              i32.const 1055445
              i32.const 1
              call $"<nanvm_lib::vm::string::String<nanvm_lib::naive::Naive> as core::convert::From<&str>>::from"
              local.get 4
              i32.load offset=20
              local.set 3
              local.get 4
              i32.load offset=16
              local.set 5
            end
            local.get 4
            local.get 5
            i32.store offset=340
            local.get 4
            i32.const 3
            i32.store8 offset=336
            local.get 4
            local.get 3
            i32.store offset=344
            local.get 4
            i32.const 240
            i32.add
            local.get 4
            i32.const 336
            i32.add
            call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::primitive_dispatch::ViaPrimitive<nanvm_lib::vm::string_coercion::StringCoercion>>
            block ;; label = @5
              local.get 4
              i32.load8_u offset=240
              local.tee 3
              i32.const 255
              i32.eq
              br_if 0 (;@5;)
              local.get 4
              local.get 4
              i32.load8_u offset=243
              local.tee 5
              i32.store8 offset=206
              local.get 4
              local.get 4
              i32.load16_u offset=241 align=1
              local.tee 6
              i32.store16 offset=204
              local.get 4
              i64.load offset=244 align=4
              local.set 10
              local.get 4
              i32.load offset=252
              local.set 7
              local.get 0
              local.get 3
              i32.store8 offset=8
              local.get 0
              local.get 6
              i32.store16 offset=9 align=1
              local.get 0
              local.get 5
              i32.store8 offset=11
              local.get 0
              local.get 7
              i32.store offset=20
              local.get 0
              local.get 10
              i64.store offset=12 align=4
              local.get 0
              i64.const 1
              i64.store
              local.get 4
              i32.const 96
              i32.add
              call $"#func226 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              br 1 (;@4;)
            end
            local.get 4
            i32.const 80
            i32.add
            local.set 3
            local.get 4
            i32.const 3
            i32.store8 offset=224
            local.get 4
            local.get 4
            i32.load16_u offset=204
            i32.store16 offset=225 align=1
            local.get 4
            local.get 4
            i32.load8_u offset=206
            i32.store8 offset=227
            local.get 4
            local.get 4
            i64.load offset=244 align=4
            i64.store offset=228 align=4
            local.get 4
            i32.const 72
            i32.add
            local.get 4
            i32.const 96
            i32.add
            local.get 4
            i32.const 224
            i32.add
            call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
            block ;; label = @5
              local.get 4
              i64.load offset=72
              i64.const 1
              i64.ne
              br_if 0 (;@5;)
              local.get 0
              i64.const 1
              i64.store
              local.get 0
              local.get 3
              i64.load offset=8
              i64.store offset=16
              local.get 0
              local.get 3
              i64.load
              i64.store offset=8
              br 1 (;@4;)
            end
            local.get 4
            local.get 3
            i64.load offset=8
            i64.store offset=248
            local.get 4
            local.get 3
            i64.load
            i64.store offset=240
            local.get 4
            i32.const 8
            i32.add
            i32.const 1055446
            i32.const 1
            call $"<nanvm_lib::vm::string::String<nanvm_lib::naive::Naive> as core::convert::From<&str>>::from"
            local.get 4
            i32.const 3
            i32.store8 offset=368
            local.get 4
            local.get 4
            i64.load offset=8
            i64.store offset=372 align=4
            local.get 0
            local.get 4
            i32.const 240
            i32.add
            local.get 4
            i32.const 368
            i32.add
            call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
            local.get 4
            i32.const 56
            i32.add
            call $"#func226 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 2
            local.get 2
            i32.load
            i32.const -1
            i32.add
            local.tee 0
            i32.store
            local.get 0
            br_if 2 (;@2;)
            br 1 (;@3;)
          end
          local.get 4
          i32.const 56
          i32.add
          call $"#func226 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          local.get 2
          local.get 2
          i32.load
          i32.const -1
          i32.add
          local.tee 0
          i32.store
          local.get 0
          br_if 1 (;@2;)
        end
        local.get 4
        i32.const 48
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
      end
      local.get 4
      i32.const 384
      i32.add
      global.set $__stack_pointer
      return
    end
    unreachable
  )
