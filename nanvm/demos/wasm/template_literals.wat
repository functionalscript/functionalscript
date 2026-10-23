  (func $nanvm_demos::samples::template_literals::module::<nanvm_lib::naive::Naive> (;524;) (type 1) (param i32 i32)
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
    i32.const 1063377
    i32.store offset=24
    local.get 2
    i32.const 1063370
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
          i32.const 176
          i32.const 0
          local.get 3
          local.get 6
          i32.const 1063432
          i32.const 68
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
          call $"#func520 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
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
  (func $"<nanvm_demos::samples::template_literals::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;525;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i64 i32 i32)
    global.get $__stack_pointer
    i32.const 368
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 4
    local.get 3
    i32.store offset=36
    local.get 4
    local.get 2
    i32.store offset=32
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
      i32.store offset=48
      local.get 4
      local.get 2
      i32.store offset=44
      local.get 4
      i32.const 6
      i32.store8 offset=40
      local.get 4
      i32.const 0
      i32.store16 offset=360
      local.get 4
      i32.const 1063602
      i32.store offset=356
      local.get 4
      i32.const 1063595
      i32.store offset=352
      local.get 4
      i32.const 320
      i32.add
      local.get 4
      i32.const 352
      i32.add
      call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            local.get 4
            i32.load8_u offset=320
            local.tee 3
            i32.const 255
            i32.ne
            br_if 0 (;@4;)
            local.get 4
            local.get 4
            i64.load offset=324 align=4
            i64.store offset=212 align=4
            local.get 4
            i32.const 3
            i32.store8 offset=208
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=40
                            local.tee 5
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 4
                          i64.load offset=48
                          local.set 6
                          br 9 (;@2;)
                        end
                        local.get 4
                        i32.load offset=44
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 7
                        i32.store
                        local.get 7
                        i32.eqz
                        br_if 9 (;@1;)
                        br 7 (;@3;)
                      end
                      local.get 4
                      i32.load offset=44
                      local.tee 3
                      local.get 3
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 7
                      i32.store
                      local.get 7
                      i32.eqz
                      br_if 8 (;@1;)
                      local.get 4
                      i64.load8_u offset=52
                      i64.const 32
                      i64.shl
                      local.get 4
                      i64.load32_u offset=48
                      i64.or
                      local.set 6
                      br 7 (;@2;)
                    end
                    local.get 4
                    i32.load offset=44
                    local.tee 3
                    local.get 3
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 7
                    i32.store
                    local.get 7
                    br_if 5 (;@3;)
                    br 7 (;@1;)
                  end
                  local.get 4
                  i32.load offset=44
                  local.tee 3
                  local.get 3
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 7
                  i32.store
                  local.get 7
                  br_if 4 (;@3;)
                  br 6 (;@1;)
                end
                local.get 4
                i32.load offset=44
                local.tee 3
                local.get 3
                i32.load
                i32.const 1
                i32.add
                local.tee 7
                i32.store
                local.get 7
                i32.eqz
                br_if 5 (;@1;)
                br 1 (;@5;)
              end
              local.get 4
              i32.load8_u offset=41
              local.set 7
            end
            br 2 (;@2;)
          end
          local.get 4
          local.get 4
          i32.load8_u offset=323
          i32.store8 offset=243
          local.get 4
          local.get 4
          i32.load16_u offset=321 align=1
          i32.store16 offset=241 align=1
          local.get 4
          local.get 4
          i32.load offset=332
          i32.store offset=252
          local.get 4
          local.get 4
          i64.load offset=324 align=4
          i64.store offset=244 align=4
          local.get 4
          local.get 3
          i32.store8 offset=240
          i32.const 1063112
          i32.const 43
          local.get 4
          i32.const 240
          i32.add
          i32.const 1063096
          i32.const 1063156
          call $core::result::unwrap_failed
          unreachable
        end
        local.get 4
        i64.load32_u offset=48
        local.set 6
      end
      local.get 4
      local.get 6
      i64.store offset=360
      local.get 4
      local.get 3
      i32.store offset=356
      local.get 4
      local.get 7
      i32.store8 offset=353
      local.get 4
      local.get 5
      i32.store8 offset=352
      local.get 4
      i64.const 0
      i64.store offset=328
      local.get 4
      i32.const 2
      i32.store8 offset=320
      local.get 4
      i32.const 240
      i32.add
      local.get 4
      i32.const 352
      i32.add
      local.get 4
      i32.const 320
      i32.add
      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              local.get 4
              i32.load8_u offset=240
              i32.const 255
              i32.ne
              br_if 0 (;@5;)
              local.get 0
              local.get 4
              i64.load offset=256
              i64.store offset=16
              local.get 0
              local.get 4
              i64.load offset=248
              i64.store offset=8
              local.get 0
              i64.const 1
              i64.store
              local.get 4
              i32.const 208
              i32.add
              call $"#func520 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
              br 1 (;@4;)
            end
            local.get 4
            local.get 4
            i64.load offset=264
            i64.store offset=344
            local.get 4
            local.get 4
            i64.load offset=256
            i64.store offset=336
            local.get 4
            local.get 4
            i64.load offset=248
            i64.store offset=328
            local.get 4
            local.get 4
            i64.load offset=240
            i64.store offset=320
            local.get 4
            i32.const 352
            i32.add
            local.get 4
            i32.const 320
            i32.add
            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
            block ;; label = @5
              block ;; label = @6
                local.get 4
                i32.load8_u offset=352
                i32.const 255
                i32.eq
                br_if 0 (;@6;)
                local.get 4
                local.get 4
                i64.load offset=360
                i64.store offset=280
                local.get 4
                local.get 4
                i64.load offset=352
                i64.store offset=272
                br 1 (;@5;)
              end
              local.get 4
              i32.const 256
              i32.store16 offset=272
            end
            local.get 4
            i32.const 320
            i32.add
            call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 4
            i32.const 336
            i32.add
            call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 4
            i32.const 224
            i32.add
            local.get 4
            i32.const 272
            i32.add
            call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::primitive_dispatch::ViaPrimitive<nanvm_lib::vm::string_coercion::StringCoercion>>
            block ;; label = @5
              local.get 4
              i32.load8_u offset=224
              local.tee 3
              i32.const 255
              i32.eq
              br_if 0 (;@5;)
              local.get 0
              local.get 4
              i32.load8_u offset=227
              i32.store8 offset=11
              local.get 0
              local.get 4
              i32.load16_u offset=225 align=1
              i32.store16 offset=9 align=1
              local.get 4
              i64.load offset=228 align=4
              local.set 6
              local.get 0
              local.get 4
              i32.load offset=236
              i32.store offset=20
              local.get 0
              local.get 6
              i64.store offset=12 align=4
              local.get 0
              local.get 3
              i32.store8 offset=8
              local.get 0
              i64.const 1
              i64.store
              local.get 4
              i32.const 208
              i32.add
              call $"#func520 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
              br 1 (;@4;)
            end
            local.get 4
            local.get 4
            i64.load offset=228 align=4
            i64.store offset=156 align=4
            local.get 4
            i32.const 3
            i32.store8 offset=152
            local.get 4
            i32.const 288
            i32.add
            local.get 4
            i32.const 208
            i32.add
            local.get 4
            i32.const 152
            i32.add
            call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
            local.get 4
            local.get 4
            i64.load offset=296
            i64.store offset=136
            local.get 4
            local.get 4
            i64.load offset=304
            i64.store offset=144
            block ;; label = @5
              local.get 4
              i64.load offset=288
              i64.const 1
              i64.ne
              br_if 0 (;@5;)
              local.get 0
              local.get 4
              i64.load offset=144
              i64.store offset=16
              local.get 0
              local.get 4
              i64.load offset=136
              i64.store offset=8
              local.get 0
              i64.const 1
              i64.store
              br 1 (;@4;)
            end
            local.get 4
            local.get 4
            i64.load offset=144
            i64.store offset=176
            local.get 4
            local.get 4
            i64.load offset=136
            i64.store offset=168
            local.get 4
            i32.const 0
            i32.store16 offset=360
            local.get 4
            i32.const 1063608
            i32.store offset=356
            local.get 4
            i32.const 1063602
            i32.store offset=352
            local.get 4
            i32.const 320
            i32.add
            local.get 4
            i32.const 352
            i32.add
            call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=320
                  local.tee 3
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 4
                  local.get 4
                  i64.load offset=324 align=4
                  i64.store offset=292 align=4
                  local.get 4
                  i32.const 3
                  i32.store8 offset=288
                  local.get 4
                  i32.const 112
                  i32.add
                  local.get 4
                  i32.const 168
                  i32.add
                  local.get 4
                  i32.const 288
                  i32.add
                  call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
                  local.get 4
                  local.get 4
                  i64.load offset=120
                  i64.store offset=96
                  local.get 4
                  local.get 4
                  i64.load offset=128
                  i64.store offset=104
                  block ;; label = @8
                    local.get 4
                    i64.load offset=112
                    i64.const 1
                    i64.ne
                    br_if 0 (;@8;)
                    local.get 0
                    local.get 4
                    i64.load offset=104
                    i64.store offset=16
                    local.get 0
                    local.get 4
                    i64.load offset=96
                    i64.store offset=8
                    local.get 0
                    i64.const 1
                    i64.store
                    br 4 (;@4;)
                  end
                  local.get 4
                  local.get 4
                  i64.load offset=104
                  i64.store offset=88
                  local.get 4
                  local.get 4
                  i64.load offset=96
                  i64.store offset=80
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  local.get 4
                                  i32.load8_u offset=40
                                  local.tee 5
                                  br_table 6 (;@9;) 6 (;@9;) 0 (;@15;) 1 (;@14;) 2 (;@13;) 3 (;@12;) 4 (;@11;) 5 (;@10;) 6 (;@9;)
                                end
                                local.get 4
                                i64.load offset=48
                                local.set 6
                                br 9 (;@5;)
                              end
                              local.get 4
                              i32.load offset=44
                              local.tee 3
                              local.get 3
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 7
                              i32.store
                              local.get 7
                              i32.eqz
                              br_if 12 (;@1;)
                              br 7 (;@6;)
                            end
                            local.get 4
                            i32.load offset=44
                            local.tee 3
                            local.get 3
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 7
                            i32.store
                            local.get 7
                            i32.eqz
                            br_if 11 (;@1;)
                            local.get 4
                            i64.load8_u offset=52
                            i64.const 32
                            i64.shl
                            local.get 4
                            i64.load32_u offset=48
                            i64.or
                            local.set 6
                            br 7 (;@5;)
                          end
                          local.get 4
                          i32.load offset=44
                          local.tee 3
                          local.get 3
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 7
                          i32.store
                          local.get 7
                          i32.eqz
                          br_if 10 (;@1;)
                          br 5 (;@6;)
                        end
                        local.get 4
                        i32.load offset=44
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 7
                        i32.store
                        local.get 7
                        i32.eqz
                        br_if 9 (;@1;)
                        br 4 (;@6;)
                      end
                      local.get 4
                      i32.load offset=44
                      local.tee 3
                      local.get 3
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 7
                      i32.store
                      local.get 7
                      i32.eqz
                      br_if 8 (;@1;)
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.load8_u offset=41
                    local.set 7
                  end
                  br 2 (;@5;)
                end
                local.get 4
                local.get 4
                i32.load8_u offset=323
                i32.store8 offset=291
                local.get 4
                local.get 4
                i32.load16_u offset=321 align=1
                i32.store16 offset=289 align=1
                local.get 4
                local.get 4
                i32.load offset=332
                i32.store offset=300
                local.get 4
                local.get 4
                i64.load offset=324 align=4
                i64.store offset=292 align=4
                local.get 4
                local.get 3
                i32.store8 offset=288
                i32.const 1063112
                i32.const 43
                local.get 4
                i32.const 288
                i32.add
                i32.const 1063096
                i32.const 1063156
                call $core::result::unwrap_failed
                unreachable
              end
              local.get 4
              i64.load32_u offset=48
              local.set 6
            end
            local.get 4
            local.get 6
            i64.store offset=120
            local.get 4
            local.get 3
            i32.store offset=116
            local.get 4
            local.get 7
            i32.store8 offset=113
            local.get 4
            local.get 5
            i32.store8 offset=112
            local.get 4
            i64.const 0
            i64.store offset=328
            local.get 4
            i32.const 2
            i32.store8 offset=320
            local.get 4
            i32.const 288
            i32.add
            local.get 4
            i32.const 112
            i32.add
            local.get 4
            i32.const 320
            i32.add
            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=288
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 4
                  i32.const 296
                  i32.add
                  local.set 3
                  br 1 (;@6;)
                end
                local.get 4
                local.get 4
                i64.load offset=312
                i64.store offset=344
                local.get 4
                local.get 4
                i64.load offset=304
                i64.store offset=336
                local.get 4
                local.get 4
                i64.load offset=296
                i64.store offset=328
                local.get 4
                local.get 4
                i64.load offset=288
                i64.store offset=320
                local.get 4
                i32.const 112
                i32.add
                local.get 4
                i32.const 320
                i32.add
                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=112
                    i32.const 255
                    i32.eq
                    br_if 0 (;@8;)
                    local.get 4
                    local.get 4
                    i64.load offset=120
                    i64.store offset=200
                    local.get 4
                    local.get 4
                    i64.load offset=112
                    i64.store offset=192
                    br 1 (;@7;)
                  end
                  local.get 4
                  i32.const 256
                  i32.store16 offset=192
                end
                local.get 4
                i32.const 320
                i32.add
                call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i32.const 336
                i32.add
                call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i64.const 4607182418800017408
                i64.store offset=360
                local.get 4
                i32.const 2
                i32.store8 offset=352
                local.get 4
                i32.const 320
                i32.add
                local.get 4
                i32.const 192
                i32.add
                local.get 4
                i32.const 352
                i32.add
                call $nanvm_lib::vm::any::relational::compare::<nanvm_lib::naive::Naive>
                local.get 4
                i32.load8_u offset=321
                local.set 3
                local.get 4
                i32.load8_u offset=320
                local.tee 5
                i32.const 255
                i32.eq
                br_if 1 (;@5;)
                local.get 4
                local.get 4
                i64.load offset=328 align=2
                i64.store offset=120 align=2
                local.get 4
                local.get 4
                i64.load offset=322 align=2
                i64.store offset=114 align=2
                local.get 4
                local.get 3
                i32.store8 offset=113
                local.get 4
                local.get 5
                i32.store8 offset=112
                local.get 4
                i32.const 112
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
              i32.const 80
              i32.add
              call $"#func520 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
              br 1 (;@4;)
            end
            local.get 4
            i32.const 1
            i32.store8 offset=112
            local.get 4
            local.get 3
            i32.const 255
            i32.and
            i32.const 1
            i32.eq
            i32.store8 offset=113
            block ;; label = @5
              block ;; label = @6
                local.get 4
                i32.const 112
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
              i32.const 1063608
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
            i32.store offset=324
            local.get 4
            i32.const 3
            i32.store8 offset=320
            local.get 4
            local.get 3
            i32.store offset=328
            local.get 4
            i32.const 224
            i32.add
            local.get 4
            i32.const 320
            i32.add
            call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::primitive_dispatch::ViaPrimitive<nanvm_lib::vm::string_coercion::StringCoercion>>
            block ;; label = @5
              local.get 4
              i32.load8_u offset=224
              local.tee 3
              i32.const 255
              i32.eq
              br_if 0 (;@5;)
              local.get 4
              local.get 4
              i32.load8_u offset=227
              local.tee 5
              i32.store8 offset=190
              local.get 4
              local.get 4
              i32.load16_u offset=225 align=1
              local.tee 7
              i32.store16 offset=188
              local.get 4
              i64.load offset=228 align=4
              local.set 6
              local.get 4
              i32.load offset=236
              local.set 8
              local.get 0
              local.get 3
              i32.store8 offset=8
              local.get 0
              local.get 7
              i32.store16 offset=9 align=1
              local.get 0
              local.get 5
              i32.store8 offset=11
              local.get 0
              local.get 8
              i32.store offset=20
              local.get 0
              local.get 6
              i64.store offset=12 align=4
              local.get 0
              i64.const 1
              i64.store
              local.get 4
              i32.const 80
              i32.add
              call $"#func520 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
              br 1 (;@4;)
            end
            local.get 4
            i32.const 64
            i32.add
            local.set 3
            local.get 4
            i32.const 3
            i32.store8 offset=208
            local.get 4
            local.get 4
            i32.load16_u offset=188
            i32.store16 offset=209 align=1
            local.get 4
            local.get 4
            i32.load8_u offset=190
            i32.store8 offset=211
            local.get 4
            local.get 4
            i64.load offset=228 align=4
            i64.store offset=212 align=4
            local.get 4
            i32.const 56
            i32.add
            local.get 4
            i32.const 80
            i32.add
            local.get 4
            i32.const 208
            i32.add
            call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
            block ;; label = @5
              local.get 4
              i64.load offset=56
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
            i64.store offset=232
            local.get 4
            local.get 3
            i64.load
            i64.store offset=224
            local.get 4
            i32.const 8
            i32.add
            i32.const 1063609
            i32.const 1
            call $"<nanvm_lib::vm::string::String<nanvm_lib::naive::Naive> as core::convert::From<&str>>::from"
            local.get 4
            i32.const 3
            i32.store8 offset=352
            local.get 4
            local.get 4
            i64.load offset=8
            i64.store offset=356 align=4
            local.get 0
            local.get 4
            i32.const 224
            i32.add
            local.get 4
            i32.const 352
            i32.add
            call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
            local.get 4
            i32.const 40
            i32.add
            call $"#func520 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
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
          i32.const 40
          i32.add
          call $"#func520 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
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
        i32.const 32
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
      end
      local.get 4
      i32.const 368
      i32.add
      global.set $__stack_pointer
      return
    end
    unreachable
  )
