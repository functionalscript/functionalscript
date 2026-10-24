  (func $nanvm_demos::samples::values::module::<nanvm_lib::naive::Naive> (;431;) (type 1) (param i32 i32)
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
    i32.const 1060284
    i32.store offset=24
    local.get 2
    i32.const 1060277
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
          i32.const 115
          i32.const 0
          local.get 3
          local.get 6
          i32.const 1060321
          i32.const 55
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
          call $"#func426 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
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
  (func $"<nanvm_demos::samples::values::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;432;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i64)
    global.get $__stack_pointer
    i32.const 560
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 4
    local.get 3
    i32.store offset=44
    local.get 4
    local.get 2
    i32.store offset=40
    local.get 2
    local.get 2
    i32.load
    local.tee 5
    i32.const 1
    i32.add
    local.tee 6
    i32.store
    block ;; label = @1
      local.get 6
      i32.eqz
      br_if 0 (;@1;)
      local.get 4
      local.get 3
      i32.store offset=56
      local.get 4
      local.get 2
      i32.store offset=52
      local.get 4
      i32.const 6
      i32.store8 offset=48
      local.get 2
      local.get 5
      i32.const 2
      i32.add
      local.tee 6
      i32.store
      local.get 6
      i32.eqz
      br_if 0 (;@1;)
      local.get 4
      local.get 2
      i32.store offset=364
      local.get 4
      i32.const 6
      i32.store8 offset=360
      local.get 4
      local.get 3
      i64.extend_i32_u
      i64.store offset=368
      local.get 4
      i64.const 0
      i64.store offset=432
      local.get 4
      i32.const 2
      i32.store8 offset=424
      local.get 4
      i32.const 296
      i32.add
      local.get 4
      i32.const 360
      i32.add
      local.get 4
      i32.const 424
      i32.add
      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                local.get 4
                i32.load8_u offset=296
                i32.const 255
                i32.ne
                br_if 0 (;@6;)
                local.get 0
                local.get 4
                i64.load offset=312
                i64.store offset=16
                local.get 0
                local.get 4
                i64.load offset=304
                i64.store offset=8
                local.get 0
                i64.const 1
                i64.store
                br 1 (;@5;)
              end
              local.get 4
              local.get 4
              i64.load offset=320
              i64.store offset=448
              local.get 4
              local.get 4
              i64.load offset=312
              i64.store offset=440
              local.get 4
              local.get 4
              i64.load offset=304
              i64.store offset=432
              local.get 4
              local.get 4
              i64.load offset=296
              i64.store offset=424
              local.get 4
              i32.const 360
              i32.add
              local.get 4
              i32.const 424
              i32.add
              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=360
                  i32.const 255
                  i32.eq
                  br_if 0 (;@7;)
                  local.get 4
                  local.get 4
                  i64.load offset=368
                  i64.store offset=168
                  local.get 4
                  local.get 4
                  i64.load offset=360
                  i64.store offset=160
                  br 1 (;@6;)
                end
                local.get 4
                i32.const 256
                i32.store16 offset=160
              end
              local.get 4
              i32.const 424
              i32.add
              call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 440
              i32.add
              call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 0
              i32.store16 offset=336
              local.get 4
              i32.const 1061765
              i32.store offset=332
              local.get 4
              i32.const 1061764
              i32.store offset=328
              local.get 4
              i32.const 424
              i32.add
              local.get 4
              i32.const 328
              i32.add
              call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=424
                    local.tee 3
                    i32.const 255
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 4
                    local.get 4
                    i64.load offset=428 align=4
                    i64.store offset=180 align=4
                    local.get 4
                    i32.const 3
                    i32.store8 offset=176
                    local.get 4
                    i32.const 257
                    i32.store16 offset=192
                    local.get 4
                    i32.const 0
                    i32.store16 offset=208
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    local.get 4
                                    i32.load8_u offset=48
                                    local.tee 6
                                    br_table 6 (;@10;) 6 (;@10;) 0 (;@16;) 1 (;@15;) 2 (;@14;) 3 (;@13;) 4 (;@12;) 5 (;@11;) 6 (;@10;)
                                  end
                                  local.get 4
                                  i64.load offset=56
                                  local.set 7
                                  br 9 (;@6;)
                                end
                                local.get 4
                                i32.load offset=52
                                local.tee 3
                                local.get 3
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 5
                                i32.store
                                local.get 5
                                i32.eqz
                                br_if 13 (;@1;)
                                br 7 (;@7;)
                              end
                              local.get 4
                              i32.load offset=52
                              local.tee 3
                              local.get 3
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 5
                              i32.store
                              local.get 5
                              i32.eqz
                              br_if 12 (;@1;)
                              local.get 4
                              i64.load8_u offset=60
                              i64.const 32
                              i64.shl
                              local.get 4
                              i64.load32_u offset=56
                              i64.or
                              local.set 7
                              br 7 (;@6;)
                            end
                            local.get 4
                            i32.load offset=52
                            local.tee 3
                            local.get 3
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 5
                            i32.store
                            local.get 5
                            br_if 5 (;@7;)
                            br 11 (;@1;)
                          end
                          local.get 4
                          i32.load offset=52
                          local.tee 3
                          local.get 3
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 5
                          i32.store
                          local.get 5
                          br_if 4 (;@7;)
                          br 10 (;@1;)
                        end
                        local.get 4
                        i32.load offset=52
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 5
                        i32.store
                        local.get 5
                        i32.eqz
                        br_if 9 (;@1;)
                        br 1 (;@9;)
                      end
                      local.get 4
                      i32.load8_u offset=49
                      local.set 5
                    end
                    br 2 (;@6;)
                  end
                  local.get 4
                  local.get 4
                  i32.load8_u offset=427
                  i32.store8 offset=363
                  local.get 4
                  local.get 4
                  i32.load16_u offset=425 align=1
                  i32.store16 offset=361 align=1
                  local.get 4
                  local.get 4
                  i32.load offset=436
                  i32.store offset=372
                  local.get 4
                  local.get 4
                  i64.load offset=428 align=4
                  i64.store offset=364 align=4
                  local.get 4
                  local.get 3
                  i32.store8 offset=360
                  i32.const 1055372
                  i32.const 43
                  local.get 4
                  i32.const 360
                  i32.add
                  i32.const 1055356
                  i32.const 1055416
                  call $core::result::unwrap_failed
                  unreachable
                end
                local.get 4
                i64.load32_u offset=56
                local.set 7
              end
              local.get 4
              local.get 7
              i64.store offset=368
              local.get 4
              local.get 3
              i32.store offset=364
              local.get 4
              local.get 5
              i32.store8 offset=361
              local.get 4
              local.get 6
              i32.store8 offset=360
              local.get 4
              i64.const 0
              i64.store offset=432
              local.get 4
              i32.const 2
              i32.store8 offset=424
              local.get 4
              i32.const 328
              i32.add
              local.get 4
              i32.const 360
              i32.add
              local.get 4
              i32.const 424
              i32.add
              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
              block ;; label = @6
                local.get 4
                i32.load8_u offset=328
                i32.const 255
                i32.ne
                br_if 0 (;@6;)
                local.get 0
                local.get 4
                i64.load offset=344
                i64.store offset=16
                local.get 0
                local.get 4
                i64.load offset=336
                i64.store offset=8
                local.get 0
                i64.const 1
                i64.store
                local.get 4
                i32.const 208
                i32.add
                call $"#func426 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i32.const 192
                i32.add
                call $"#func426 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i32.const 176
                i32.add
                call $"#func426 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i32.const 160
                i32.add
                call $"#func426 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                br 1 (;@5;)
              end
              local.get 4
              local.get 4
              i64.load offset=352
              i64.store offset=448
              local.get 4
              local.get 4
              i64.load offset=344
              i64.store offset=440
              local.get 4
              local.get 4
              i64.load offset=336
              i64.store offset=432
              local.get 4
              local.get 4
              i64.load offset=328
              i64.store offset=424
              local.get 4
              i32.const 360
              i32.add
              local.get 4
              i32.const 424
              i32.add
              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
              i32.const 1
              local.set 3
              i32.const 0
              local.set 6
              block ;; label = @6
                local.get 4
                i32.load8_u offset=360
                local.tee 5
                i32.const 255
                i32.eq
                br_if 0 (;@6;)
                local.get 4
                local.get 4
                i64.load offset=362 align=2
                i64.store offset=408
                local.get 4
                local.get 4
                i64.load offset=368 align=2
                i64.store offset=414 align=2
                local.get 4
                i32.load8_u offset=361
                local.set 3
                local.get 5
                local.set 6
              end
              local.get 4
              i32.const 424
              i32.add
              call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 440
              i32.add
              call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 0
              i32.store8 offset=280
              local.get 4
              local.get 3
              i32.store8 offset=433
              local.get 4
              local.get 6
              i32.store8 offset=432
              local.get 4
              i64.const 4294967296
              i64.store offset=424
              local.get 4
              local.get 4
              i64.load offset=408
              i64.store offset=434 align=2
              local.get 4
              local.get 4
              i64.load offset=414 align=2
              i64.store offset=440 align=2
              local.get 4
              local.get 4
              i32.const 280
              i32.add
              i32.store offset=448
              local.get 4
              i32.const 32
              i32.add
              local.get 4
              i32.const 424
              i32.add
              call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
              local.get 4
              local.get 4
              i32.load offset=36
              local.tee 6
              i32.store offset=364
              local.get 4
              local.get 4
              i32.load offset=32
              local.tee 3
              i32.store offset=360
              block ;; label = @6
                local.get 4
                i32.load8_u offset=280
                i32.const 1
                i32.ne
                br_if 0 (;@6;)
                local.get 3
                local.get 3
                i32.load
                i32.const -1
                i32.add
                local.tee 2
                i32.store
                local.get 2
                br_if 4 (;@2;)
                local.get 4
                i32.const 360
                i32.add
                call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                br 4 (;@2;)
              end
              local.get 3
              i32.eqz
              br_if 3 (;@2;)
              local.get 4
              local.get 6
              i32.store offset=232
              local.get 4
              local.get 3
              i32.store offset=228
              local.get 4
              i32.const 6
              i32.store8 offset=224
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  local.get 4
                                  i32.load8_u offset=48
                                  local.tee 6
                                  br_table 6 (;@9;) 6 (;@9;) 0 (;@15;) 1 (;@14;) 2 (;@13;) 3 (;@12;) 4 (;@11;) 5 (;@10;) 6 (;@9;)
                                end
                                local.get 4
                                i64.load offset=56
                                local.set 7
                                br 8 (;@6;)
                              end
                              local.get 4
                              i32.load offset=52
                              local.tee 3
                              local.get 3
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 5
                              i32.store
                              local.get 5
                              i32.eqz
                              br_if 12 (;@1;)
                              br 6 (;@7;)
                            end
                            local.get 4
                            i32.load offset=52
                            local.tee 3
                            local.get 3
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 5
                            i32.store
                            local.get 5
                            i32.eqz
                            br_if 11 (;@1;)
                            local.get 4
                            i64.load8_u offset=60
                            i64.const 32
                            i64.shl
                            local.get 4
                            i64.load32_u offset=56
                            i64.or
                            local.set 7
                            br 6 (;@6;)
                          end
                          local.get 4
                          i32.load offset=52
                          local.tee 3
                          local.get 3
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 5
                          i32.store
                          local.get 5
                          i32.eqz
                          br_if 10 (;@1;)
                          br 4 (;@7;)
                        end
                        local.get 4
                        i32.load offset=52
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 5
                        i32.store
                        local.get 5
                        i32.eqz
                        br_if 9 (;@1;)
                        br 3 (;@7;)
                      end
                      local.get 4
                      i32.load offset=52
                      local.tee 3
                      local.get 3
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 5
                      i32.store
                      local.get 5
                      i32.eqz
                      br_if 8 (;@1;)
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.load8_u offset=49
                    local.set 5
                  end
                  br 1 (;@6;)
                end
                local.get 4
                i64.load32_u offset=56
                local.set 7
              end
              local.get 4
              local.get 7
              i64.store offset=416
              local.get 4
              local.get 3
              i32.store offset=412
              local.get 4
              local.get 5
              i32.store8 offset=409
              local.get 4
              local.get 6
              i32.store8 offset=408
              local.get 4
              i64.const 0
              i64.store offset=432
              local.get 4
              i32.const 2
              i32.store8 offset=424
              local.get 4
              i32.const 360
              i32.add
              local.get 4
              i32.const 408
              i32.add
              local.get 4
              i32.const 424
              i32.add
              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=360
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 4
                  i32.const 368
                  i32.add
                  local.set 3
                  br 1 (;@6;)
                end
                local.get 4
                local.get 4
                i64.load offset=384
                i64.store offset=448
                local.get 4
                local.get 4
                i64.load offset=376
                i64.store offset=440
                local.get 4
                local.get 4
                i64.load offset=368
                i64.store offset=432
                local.get 4
                local.get 4
                i64.load offset=360
                i64.store offset=424
                local.get 4
                i32.const 408
                i32.add
                local.get 4
                i32.const 424
                i32.add
                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=408
                    i32.const 255
                    i32.eq
                    br_if 0 (;@8;)
                    local.get 4
                    local.get 4
                    i64.load offset=416
                    i64.store offset=272
                    local.get 4
                    local.get 4
                    i64.load offset=408
                    i64.store offset=264
                    br 1 (;@7;)
                  end
                  local.get 4
                  i32.const 256
                  i32.store16 offset=264
                end
                local.get 4
                i32.const 248
                i32.add
                local.set 3
                local.get 4
                i32.const 424
                i32.add
                call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i32.const 440
                i32.add
                call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i32.const 240
                i32.add
                local.get 4
                i32.const 264
                i32.add
                call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Neg>::neg"
                local.get 4
                i32.load offset=240
                br_if 0 (;@6;)
                local.get 4
                i32.const 0
                i32.store8 offset=280
                local.get 4
                i64.const 1
                i64.store offset=432
                local.get 4
                i64.const 1
                i64.store offset=424
                local.get 4
                local.get 4
                i32.const 280
                i32.add
                i32.store offset=440
                local.get 4
                i32.const 24
                i32.add
                local.get 4
                i32.const 424
                i32.add
                call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::once::Once<u64>, core::result::Result<u64, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<u64>>::to_rc_slice"
                local.get 4
                local.get 4
                i32.load offset=28
                local.tee 5
                i32.store offset=412
                local.get 4
                local.get 4
                i32.load offset=24
                local.tee 6
                i32.store offset=408
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=280
                    i32.const 1
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 6
                    local.get 6
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 2
                    i32.store
                    local.get 2
                    br_if 1 (;@7;)
                    local.get 4
                    i32.const 408
                    i32.add
                    call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                    br 1 (;@7;)
                  end
                  local.get 6
                  i32.eqz
                  br_if 0 (;@7;)
                  local.get 4
                  i32.const 1
                  i32.store8 offset=292
                  local.get 4
                  local.get 5
                  i32.store offset=288
                  local.get 4
                  local.get 6
                  i32.store offset=284
                  local.get 4
                  i32.const 4
                  i32.store8 offset=280
                  local.get 4
                  i32.const 16
                  i32.add
                  local.get 4
                  i32.const 280
                  i32.add
                  call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::any::typeof_::TypeOf>
                  local.get 4
                  i32.load offset=20
                  local.set 5
                  local.get 4
                  i32.load offset=16
                  local.set 6
                  local.get 4
                  i32.const 0
                  i32.store16 offset=404
                  local.get 4
                  local.get 6
                  local.get 5
                  i32.add
                  i32.store offset=400
                  local.get 4
                  local.get 6
                  i32.store offset=396
                  local.get 4
                  i32.const 424
                  i32.add
                  local.get 4
                  i32.const 396
                  i32.add
                  call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                  block ;; label = @8
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=424
                      local.tee 6
                      i32.const 255
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 4
                      i64.load offset=160
                      i64.store offset=64
                      local.get 4
                      local.get 4
                      i64.load offset=168
                      i64.store offset=72
                      local.get 4
                      local.get 4
                      i64.load offset=176
                      i64.store offset=80
                      local.get 4
                      local.get 4
                      i64.load offset=184
                      i64.store offset=88
                      local.get 4
                      local.get 4
                      i64.load offset=192
                      i64.store offset=96
                      local.get 4
                      local.get 4
                      i64.load offset=200
                      i64.store offset=104
                      local.get 4
                      local.get 4
                      i64.load offset=216
                      i64.store offset=120
                      local.get 4
                      local.get 4
                      i64.load offset=208
                      i64.store offset=112
                      local.get 4
                      i64.load offset=428 align=4
                      local.set 7
                      local.get 4
                      local.get 4
                      i64.load offset=232
                      i64.store offset=136
                      local.get 4
                      local.get 4
                      i64.load offset=224
                      i64.store offset=128
                      local.get 4
                      local.get 3
                      i64.load
                      i64.store offset=144
                      local.get 4
                      local.get 3
                      i64.load offset=8
                      i64.store offset=152
                      local.get 4
                      i32.const 0
                      i32.store8 offset=280
                      local.get 4
                      i64.const 30064771072
                      i64.store offset=424
                      local.get 4
                      i32.const 432
                      i32.add
                      local.get 4
                      i32.const 64
                      i32.add
                      i32.const 96
                      memory.copy
                      local.get 4
                      local.get 7
                      i64.store offset=532 align=4
                      local.get 4
                      i32.const 3
                      i32.store8 offset=528
                      local.get 4
                      local.get 4
                      i32.const 280
                      i32.add
                      i32.store offset=544
                      local.get 4
                      i32.const 8
                      i32.add
                      local.get 4
                      i32.const 424
                      i32.add
                      call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 7>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                      local.get 4
                      local.get 4
                      i32.load offset=12
                      local.tee 6
                      i32.store offset=412
                      local.get 4
                      local.get 4
                      i32.load offset=8
                      local.tee 3
                      i32.store offset=408
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=280
                        i32.const 1
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 3
                        local.get 3
                        i32.load
                        i32.const -1
                        i32.add
                        local.tee 2
                        i32.store
                        local.get 2
                        br_if 2 (;@8;)
                        local.get 4
                        i32.const 408
                        i32.add
                        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                        br 2 (;@8;)
                      end
                      local.get 3
                      i32.eqz
                      br_if 1 (;@8;)
                      local.get 0
                      local.get 6
                      i32.store offset=16
                      local.get 0
                      local.get 3
                      i32.store offset=12
                      local.get 0
                      i32.const 6
                      i32.store8 offset=8
                      local.get 0
                      i64.const 0
                      i64.store
                      local.get 4
                      i32.const 48
                      i32.add
                      call $"#func426 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 2
                      local.get 2
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 0
                      i32.store
                      local.get 0
                      br_if 6 (;@3;)
                      br 5 (;@4;)
                    end
                    local.get 4
                    local.get 4
                    i32.load8_u offset=427
                    i32.store8 offset=411
                    local.get 4
                    local.get 4
                    i32.load16_u offset=425 align=1
                    i32.store16 offset=409 align=1
                    local.get 4
                    local.get 4
                    i32.load offset=436
                    i32.store offset=420
                    local.get 4
                    local.get 4
                    i64.load offset=428 align=4
                    i64.store offset=412 align=4
                    local.get 4
                    local.get 6
                    i32.store8 offset=408
                    i32.const 1055372
                    i32.const 43
                    local.get 4
                    i32.const 408
                    i32.add
                    i32.const 1055356
                    i32.const 1055416
                    call $core::result::unwrap_failed
                    unreachable
                  end
                  i32.const 1053928
                  i32.const 43
                  local.get 4
                  i32.const 559
                  i32.add
                  i32.const 1053912
                  i32.const 1053972
                  call $core::result::unwrap_failed
                  unreachable
                end
                i32.const 1053928
                i32.const 43
                local.get 4
                i32.const 559
                i32.add
                i32.const 1053912
                i32.const 1053972
                call $core::result::unwrap_failed
                unreachable
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
              i32.const 224
              i32.add
              call $"#func426 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 208
              i32.add
              call $"#func426 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 192
              i32.add
              call $"#func426 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 176
              i32.add
              call $"#func426 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 160
              i32.add
              call $"#func426 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            end
            local.get 4
            i32.const 48
            i32.add
            call $"#func426 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 2
            local.get 2
            i32.load
            i32.const -1
            i32.add
            local.tee 0
            i32.store
            local.get 0
            br_if 1 (;@3;)
          end
          local.get 4
          i32.const 40
          i32.add
          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
        end
        local.get 4
        i32.const 560
        i32.add
        global.set $__stack_pointer
        return
      end
      i32.const 1053928
      i32.const 43
      local.get 4
      i32.const 559
      i32.add
      i32.const 1053912
      i32.const 1053972
      call $core::result::unwrap_failed
      unreachable
    end
    unreachable
  )
