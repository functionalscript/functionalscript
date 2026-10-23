  (func $nanvm_demos::samples::grouping::module::<nanvm_lib::naive::Naive> (;486;) (type 1) (param i32 i32)
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
    i32.const 1062526
    i32.store offset=68
    local.get 2
    i32.const 1062519
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
      i32.const 1063112
      i32.const 43
      local.get 2
      i32.const 64
      i32.add
      i32.const 1063096
      i32.const 1063156
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
      i32.const 122
      i32.const 0
      local.get 5
      local.get 6
      i32.const 1062526
      i32.const 48
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
        call $"#func462 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
        local.get 2
        i32.const 112
        i32.add
        global.set $__stack_pointer
        return
      end
      i32.const 1059464
      i32.const 43
      local.get 2
      i32.const 111
      i32.add
      i32.const 1059448
      i32.const 1059508
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1059464
    i32.const 43
    local.get 2
    i32.const 111
    i32.add
    i32.const 1059448
    i32.const 1059508
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::grouping::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;487;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i64 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 432
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 4
    local.get 3
    i32.store offset=28
    local.get 4
    local.get 2
    i32.store offset=24
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    local.get 2
                    i32.load
                    local.tee 5
                    i32.const -1
                    i32.eq
                    br_if 0 (;@8;)
                    local.get 4
                    local.get 3
                    i32.store offset=40
                    local.get 4
                    local.get 2
                    i32.store offset=36
                    local.get 4
                    i32.const 6
                    i32.store8 offset=32
                    local.get 2
                    local.get 5
                    i32.const 2
                    i32.add
                    local.tee 5
                    i32.store
                    local.get 5
                    i32.eqz
                    br_if 0 (;@8;)
                    local.get 4
                    local.get 2
                    i32.store offset=356
                    local.get 4
                    i32.const 6
                    i32.store8 offset=352
                    local.get 4
                    local.get 3
                    i64.extend_i32_u
                    i64.store offset=360
                    local.get 4
                    i64.const 0
                    i64.store offset=376
                    local.get 4
                    i32.const 2
                    i32.store8 offset=368
                    local.get 4
                    i32.const 256
                    i32.add
                    local.get 4
                    i32.const 352
                    i32.add
                    local.get 4
                    i32.const 368
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=256
                      i32.const 255
                      i32.ne
                      br_if 0 (;@9;)
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
                      br 4 (;@5;)
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=280
                    i64.store offset=392
                    local.get 4
                    local.get 4
                    i64.load offset=272
                    i64.store offset=384
                    local.get 4
                    local.get 4
                    i64.load offset=264
                    i64.store offset=376
                    local.get 4
                    local.get 4
                    i64.load offset=256
                    i64.store offset=368
                    local.get 4
                    i32.const 352
                    i32.add
                    local.get 4
                    i32.const 368
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                    block ;; label = @9
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=352
                        i32.const 255
                        i32.eq
                        br_if 0 (;@10;)
                        local.get 4
                        local.get 4
                        i64.load offset=360
                        i64.store offset=152
                        local.get 4
                        local.get 4
                        i64.load offset=352
                        i64.store offset=144
                        br 1 (;@9;)
                      end
                      local.get 4
                      i32.const 256
                      i32.store16 offset=144
                    end
                    local.get 4
                    i32.const 368
                    i32.add
                    call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i32.const 384
                    i32.add
                    call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i64.const 4611686018427387904
                    i64.store offset=376
                    local.get 4
                    i32.const 2
                    i32.store8 offset=368
                    local.get 4
                    i32.const 320
                    i32.add
                    local.get 4
                    i32.const 144
                    i32.add
                    local.get 4
                    i32.const 368
                    i32.add
                    call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
                    local.get 4
                    local.get 4
                    i64.load offset=328
                    i64.store offset=128
                    local.get 4
                    local.get 4
                    i64.load offset=336
                    i64.store offset=136
                    block ;; label = @9
                      local.get 4
                      i64.load offset=320
                      i64.const 1
                      i64.ne
                      br_if 0 (;@9;)
                      local.get 0
                      local.get 4
                      i64.load offset=136
                      i64.store offset=16
                      local.get 0
                      local.get 4
                      i64.load offset=128
                      i64.store offset=8
                      local.get 0
                      i64.const 1
                      i64.store
                      br 4 (;@5;)
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=136
                    i64.store offset=168
                    local.get 4
                    local.get 4
                    i64.load offset=128
                    i64.store offset=160
                    local.get 4
                    i64.const 4613937818241073152
                    i64.store offset=376
                    local.get 4
                    i32.const 2
                    i32.store8 offset=368
                    local.get 4
                    i32.const 288
                    i32.add
                    local.get 4
                    i32.const 160
                    i32.add
                    local.get 4
                    i32.const 368
                    i32.add
                    call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::arith::Mul>::mul>"
                    local.get 4
                    local.get 4
                    i64.load offset=296
                    i64.store offset=112
                    local.get 4
                    local.get 4
                    i64.load offset=304
                    i64.store offset=120
                    block ;; label = @9
                      local.get 4
                      i64.load offset=288
                      i64.const 1
                      i64.ne
                      br_if 0 (;@9;)
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
                      br 4 (;@5;)
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=120
                    i64.store offset=104
                    local.get 4
                    local.get 4
                    i64.load offset=112
                    i64.store offset=96
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    local.get 4
                                    i32.load8_u offset=32
                                    local.tee 5
                                    br_table 6 (;@10;) 6 (;@10;) 0 (;@16;) 1 (;@15;) 2 (;@14;) 3 (;@13;) 4 (;@12;) 5 (;@11;) 6 (;@10;)
                                  end
                                  local.get 4
                                  i64.load offset=40
                                  local.set 6
                                  br 9 (;@6;)
                                end
                                local.get 4
                                i32.load offset=36
                                local.tee 3
                                local.get 3
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 7
                                i32.store
                                local.get 7
                                i32.eqz
                                br_if 6 (;@8;)
                                br 7 (;@7;)
                              end
                              local.get 4
                              i32.load offset=36
                              local.tee 3
                              local.get 3
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 7
                              i32.store
                              local.get 7
                              i32.eqz
                              br_if 5 (;@8;)
                              local.get 4
                              i64.load8_u offset=44
                              i64.const 32
                              i64.shl
                              local.get 4
                              i64.load32_u offset=40
                              i64.or
                              local.set 6
                              br 7 (;@6;)
                            end
                            local.get 4
                            i32.load offset=36
                            local.tee 3
                            local.get 3
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 7
                            i32.store
                            local.get 7
                            br_if 5 (;@7;)
                            br 4 (;@8;)
                          end
                          local.get 4
                          i32.load offset=36
                          local.tee 3
                          local.get 3
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 7
                          i32.store
                          local.get 7
                          br_if 4 (;@7;)
                          br 3 (;@8;)
                        end
                        local.get 4
                        i32.load offset=36
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 7
                        i32.store
                        local.get 7
                        i32.eqz
                        br_if 2 (;@8;)
                        br 1 (;@9;)
                      end
                      local.get 4
                      i32.load8_u offset=33
                      local.set 7
                    end
                    br 2 (;@6;)
                  end
                  unreachable
                end
                local.get 4
                i64.load32_u offset=40
                local.set 6
              end
              local.get 4
              local.get 6
              i64.store offset=328
              local.get 4
              local.get 3
              i32.store offset=324
              local.get 4
              local.get 7
              i32.store8 offset=321
              local.get 4
              local.get 5
              i32.store8 offset=320
              local.get 4
              i64.const 0
              i64.store offset=376
              local.get 4
              i32.const 2
              i32.store8 offset=368
              local.get 4
              i32.const 288
              i32.add
              local.get 4
              i32.const 320
              i32.add
              local.get 4
              i32.const 368
              i32.add
              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=288
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 0
                  local.get 4
                  i64.load offset=304
                  i64.store offset=16
                  local.get 0
                  local.get 4
                  i64.load offset=296
                  i64.store offset=8
                  local.get 0
                  i64.const 1
                  i64.store
                  br 1 (;@6;)
                end
                local.get 4
                local.get 4
                i64.load offset=312
                i64.store offset=392
                local.get 4
                local.get 4
                i64.load offset=304
                i64.store offset=384
                local.get 4
                local.get 4
                i64.load offset=296
                i64.store offset=376
                local.get 4
                local.get 4
                i64.load offset=288
                i64.store offset=368
                local.get 4
                i32.const 320
                i32.add
                local.get 4
                i32.const 368
                i32.add
                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=320
                    i32.const 255
                    i32.eq
                    br_if 0 (;@8;)
                    local.get 4
                    local.get 4
                    i64.load offset=328
                    i64.store offset=360
                    local.get 4
                    local.get 4
                    i64.load offset=320
                    i64.store offset=352
                    br 1 (;@7;)
                  end
                  local.get 4
                  i32.const 256
                  i32.store16 offset=352
                end
                local.get 4
                i32.const 216
                i32.add
                i32.const 8
                i32.add
                local.set 3
                local.get 4
                i32.const 368
                i32.add
                call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i32.const 384
                i32.add
                call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i64.const 4611686018427387904
                i64.store offset=328
                local.get 4
                i32.const 2
                i32.store8 offset=320
                local.get 4
                i64.const 4613937818241073152
                i64.store offset=376
                local.get 4
                i32.const 2
                i32.store8 offset=368
                local.get 4
                i32.const 216
                i32.add
                local.get 4
                i32.const 320
                i32.add
                local.get 4
                i32.const 368
                i32.add
                call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::arith::Mul>::mul>"
                block ;; label = @7
                  local.get 4
                  i64.load offset=216
                  i64.const 1
                  i64.ne
                  br_if 0 (;@7;)
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
                  i32.const 352
                  i32.add
                  call $"#func462 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  br 1 (;@6;)
                end
                local.get 4
                i32.const 192
                i32.add
                i32.const 8
                i32.add
                local.set 5
                local.get 4
                local.get 3
                i64.load offset=8
                i64.store offset=248
                local.get 4
                local.get 3
                i64.load
                i64.store offset=240
                local.get 4
                i32.const 192
                i32.add
                local.get 4
                i32.const 352
                i32.add
                local.get 4
                i32.const 240
                i32.add
                call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
                block ;; label = @7
                  local.get 4
                  i64.load offset=192
                  i64.const 1
                  i64.ne
                  br_if 0 (;@7;)
                  local.get 0
                  i64.const 1
                  i64.store
                  local.get 0
                  local.get 5
                  i64.load offset=8
                  i64.store offset=16
                  local.get 0
                  local.get 5
                  i64.load
                  i64.store offset=8
                  br 1 (;@6;)
                end
                local.get 4
                local.get 5
                i64.load offset=8
                i64.store offset=184
                local.get 4
                local.get 5
                i64.load
                i64.store offset=176
                local.get 4
                i32.const 0
                i32.store8 offset=352
                local.get 4
                i64.const 4646500954609287168
                i64.store offset=400
                local.get 4
                i32.const 2
                i32.store8 offset=392
                local.get 4
                i64.const 4635329916471083008
                i64.store offset=384
                local.get 4
                i32.const 2
                i32.store8 offset=376
                local.get 4
                i64.const 8589934592
                i64.store offset=368
                local.get 4
                local.get 4
                i32.const 352
                i32.add
                i32.store offset=408
                local.get 4
                i32.const 16
                i32.add
                local.get 4
                i32.const 368
                i32.add
                call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                local.get 4
                local.get 4
                i32.load offset=20
                local.tee 7
                i32.store offset=324
                local.get 4
                local.get 4
                i32.load offset=16
                local.tee 3
                i32.store offset=320
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=352
                  i32.const 1
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 3
                  local.get 3
                  i32.load
                  i32.const -1
                  i32.add
                  local.tee 2
                  i32.store
                  local.get 2
                  br_if 6 (;@1;)
                  local.get 4
                  i32.const 320
                  i32.add
                  call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                  br 6 (;@1;)
                end
                local.get 3
                i32.eqz
                br_if 5 (;@1;)
                local.get 4
                local.get 7
                i32.store offset=360
                local.get 4
                local.get 3
                i32.store offset=356
                local.get 4
                i32.const 6
                i32.store8 offset=352
                local.get 4
                i32.const 255
                i32.store8 offset=320
                local.get 4
                i32.const 0
                i32.store16 offset=376
                local.get 4
                i32.const 1063198
                i32.store offset=372
                local.get 4
                i32.const 1063192
                i32.store offset=368
                local.get 4
                local.get 4
                i32.const 320
                i32.add
                i32.store offset=380
                local.get 4
                i32.const 8
                i32.add
                local.get 4
                i32.const 368
                i32.add
                call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>> as alloc::rc::ToRcSlice<u16>>::to_rc_slice"
                local.get 4
                local.get 4
                i32.load offset=12
                local.tee 7
                i32.store offset=424
                local.get 4
                local.get 4
                i32.load offset=8
                local.tee 3
                i32.store offset=420
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=320
                  local.tee 8
                  i32.const 255
                  i32.eq
                  br_if 0 (;@7;)
                  local.get 4
                  i32.load offset=324
                  local.set 2
                  local.get 4
                  i32.load offset=328
                  local.set 0
                  local.get 4
                  i32.load offset=332
                  local.set 5
                  local.get 4
                  i32.load16_u offset=321 align=1
                  local.set 7
                  local.get 4
                  i32.load8_u offset=323
                  local.set 9
                  local.get 3
                  local.get 3
                  i32.load
                  i32.const -1
                  i32.add
                  local.tee 10
                  i32.store
                  local.get 4
                  local.get 9
                  i32.store8 offset=418
                  local.get 4
                  local.get 7
                  i32.store16 offset=416
                  block ;; label = @8
                    local.get 10
                    br_if 0 (;@8;)
                    local.get 4
                    i32.const 420
                    i32.add
                    call $"<alloc::rc::Rc<[u16]>>::drop_slow"
                  end
                  local.get 4
                  local.get 8
                  i32.store8 offset=368
                  local.get 4
                  local.get 4
                  i32.load16_u offset=416
                  i32.store16 offset=369 align=1
                  local.get 4
                  local.get 4
                  i32.load8_u offset=418
                  i32.store8 offset=371
                  local.get 4
                  local.get 5
                  i32.store offset=380
                  local.get 4
                  local.get 0
                  i32.store offset=376
                  local.get 4
                  local.get 2
                  i32.store offset=372
                  i32.const 1063112
                  i32.const 43
                  local.get 4
                  i32.const 368
                  i32.add
                  i32.const 1063096
                  i32.const 1063156
                  call $core::result::unwrap_failed
                  unreachable
                end
                local.get 4
                local.get 7
                i32.store offset=376
                local.get 4
                local.get 3
                i32.store offset=372
                local.get 4
                i32.const 3
                i32.store8 offset=368
                local.get 4
                i32.const 320
                i32.add
                local.get 4
                i32.const 352
                i32.add
                local.get 4
                i32.const 368
                i32.add
                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                local.get 4
                i32.load8_u offset=320
                i32.const 255
                i32.ne
                br_if 2 (;@4;)
                local.get 0
                local.get 4
                i64.load offset=336
                i64.store offset=16
                local.get 0
                local.get 4
                i64.load offset=328
                i64.store offset=8
                local.get 0
                i64.const 1
                i64.store
                local.get 4
                i32.const 176
                i32.add
                call $"#func462 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              end
              local.get 4
              i32.const 96
              i32.add
              call $"#func462 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            end
            local.get 4
            i32.const 32
            i32.add
            call $"#func462 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
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
          i64.load offset=344
          i64.store offset=392
          local.get 4
          local.get 4
          i64.load offset=336
          i64.store offset=384
          local.get 4
          local.get 4
          i64.load offset=328
          i64.store offset=376
          local.get 4
          local.get 4
          i64.load offset=320
          i64.store offset=368
          local.get 4
          i32.const 80
          i32.add
          local.get 4
          i32.const 368
          i32.add
          call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::read
          local.get 4
          local.get 4
          i64.load offset=96
          i64.store offset=48
          local.get 4
          local.get 4
          i64.load offset=104
          i64.store offset=56
          local.get 4
          local.get 5
          i64.load
          i64.store offset=64
          local.get 4
          local.get 5
          i64.load offset=8
          i64.store offset=72
          local.get 4
          local.get 4
          i32.const 48
          i32.add
          call $"<nanvm_lib::naive::container::Container<(), nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as nanvm_lib::vm::internal::icontainer::IContainer<nanvm_lib::naive::Naive>>::new_ok::<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>; 3]>"
          local.get 0
          local.get 4
          i64.load
          i64.store offset=12 align=4
          local.get 0
          i32.const 6
          i32.store8 offset=8
          local.get 0
          i64.const 0
          i64.store
          local.get 4
          i32.const 32
          i32.add
          call $"#func462 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
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
        i32.const 24
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
      end
      local.get 4
      i32.const 432
      i32.add
      global.set $__stack_pointer
      return
    end
    i32.const 1059464
    i32.const 43
    local.get 4
    i32.const 431
    i32.add
    i32.const 1059448
    i32.const 1059508
    call $core::result::unwrap_failed
    unreachable
  )
