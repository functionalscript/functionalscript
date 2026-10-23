  (func $nanvm_demos::samples::bigints::module::<nanvm_lib::naive::Naive> (;264;) (type 1) (param i32 i32)
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
    i32.const 1059341
    i32.store offset=68
    local.get 2
    i32.const 1059334
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
      i32.const 52
      i32.const 0
      local.get 5
      local.get 6
      i32.const 1059341
      i32.const 53
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
        call $"#func263 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
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
  (func $"<nanvm_demos::samples::bigints::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;265;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i32 i32 i32 i64 f64 i64 i64 i64)
    global.get $__stack_pointer
    i32.const 384
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 4
    local.get 3
    i32.store offset=68
    local.get 4
    local.get 2
    i32.store offset=64
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
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  local.get 5
                  i32.eqz
                  br_if 0 (;@7;)
                  local.get 4
                  local.get 3
                  i32.store offset=80
                  local.get 4
                  local.get 2
                  i32.store offset=76
                  local.get 4
                  i32.const 6
                  i32.store8 offset=72
                  local.get 4
                  i32.const 0
                  i32.store8 offset=232
                  local.get 4
                  i32.const 56
                  i32.add
                  local.get 4
                  i32.const 232
                  i32.add
                  call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::empty::Empty<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                  local.get 4
                  local.get 4
                  i32.load offset=60
                  local.tee 6
                  i32.store offset=300
                  local.get 4
                  local.get 4
                  i32.load offset=56
                  local.tee 3
                  i32.store offset=296
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=232
                    i32.const 1
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 3
                    local.get 3
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 2
                    i32.store
                    local.get 2
                    br_if 7 (;@1;)
                    local.get 4
                    i32.const 296
                    i32.add
                    call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                    br 7 (;@1;)
                  end
                  local.get 3
                  i32.eqz
                  br_if 6 (;@1;)
                  local.get 4
                  i32.const 0
                  i32.store8 offset=200
                  local.get 4
                  i64.const 34
                  i64.store offset=304
                  local.get 4
                  i64.const 1
                  i64.store offset=296
                  local.get 4
                  local.get 4
                  i32.const 200
                  i32.add
                  i32.store offset=312
                  local.get 4
                  i32.const 48
                  i32.add
                  local.get 4
                  i32.const 296
                  i32.add
                  call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::once::Once<u64>, core::result::Result<u64, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<u64>>::to_rc_slice"
                  local.get 4
                  local.get 4
                  i32.load offset=52
                  local.tee 7
                  i32.store offset=236
                  local.get 4
                  local.get 4
                  i32.load offset=48
                  local.tee 5
                  i32.store offset=232
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=200
                    i32.const 1
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 5
                    local.get 5
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 2
                    i32.store
                    local.get 2
                    br_if 6 (;@2;)
                    local.get 4
                    i32.const 232
                    i32.add
                    call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                    br 6 (;@2;)
                  end
                  local.get 5
                  i32.eqz
                  br_if 5 (;@2;)
                  local.get 4
                  i32.const 0
                  i32.store8 offset=200
                  local.get 4
                  i64.const 34
                  i64.store offset=304
                  local.get 4
                  i64.const 1
                  i64.store offset=296
                  local.get 4
                  local.get 4
                  i32.const 200
                  i32.add
                  i32.store offset=312
                  local.get 4
                  i32.const 40
                  i32.add
                  local.get 4
                  i32.const 296
                  i32.add
                  call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::once::Once<u64>, core::result::Result<u64, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<u64>>::to_rc_slice"
                  local.get 4
                  local.get 4
                  i32.load offset=44
                  local.tee 8
                  i32.store offset=236
                  local.get 4
                  local.get 4
                  i32.load offset=40
                  local.tee 9
                  i32.store offset=232
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=200
                    i32.const 1
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 9
                    local.get 9
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 2
                    i32.store
                    local.get 2
                    br_if 5 (;@3;)
                    local.get 4
                    i32.const 232
                    i32.add
                    call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                    br 5 (;@3;)
                  end
                  local.get 9
                  i32.eqz
                  br_if 4 (;@3;)
                  local.get 4
                  i32.const 0
                  i32.store8 offset=200
                  local.get 4
                  i32.const 255
                  i32.store8 offset=348
                  local.get 4
                  local.get 8
                  i32.store offset=344
                  local.get 4
                  local.get 9
                  i32.store offset=340
                  local.get 4
                  i32.const 4
                  i32.store8 offset=336
                  local.get 4
                  i32.const 1
                  i32.store8 offset=332
                  local.get 4
                  local.get 7
                  i32.store offset=328
                  local.get 4
                  local.get 5
                  i32.store offset=324
                  local.get 4
                  i32.const 4
                  i32.store8 offset=320
                  local.get 4
                  i32.const 1
                  i32.store8 offset=316
                  local.get 4
                  local.get 6
                  i32.store offset=312
                  local.get 4
                  local.get 3
                  i32.store offset=308
                  local.get 4
                  i32.const 4
                  i32.store8 offset=304
                  local.get 4
                  i64.const 12884901888
                  i64.store offset=296
                  local.get 4
                  local.get 4
                  i32.const 200
                  i32.add
                  i32.store offset=352
                  local.get 4
                  i32.const 32
                  i32.add
                  local.get 4
                  i32.const 296
                  i32.add
                  call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 3>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                  local.get 4
                  local.get 4
                  i32.load offset=36
                  local.tee 5
                  i32.store offset=236
                  local.get 4
                  local.get 4
                  i32.load offset=32
                  local.tee 3
                  i32.store offset=232
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=200
                    i32.const 1
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 3
                    local.get 3
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 2
                    i32.store
                    local.get 2
                    br_if 4 (;@4;)
                    local.get 4
                    i32.const 232
                    i32.add
                    call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                    br 4 (;@4;)
                  end
                  local.get 3
                  i32.eqz
                  br_if 3 (;@4;)
                  local.get 4
                  local.get 5
                  i32.store offset=368
                  local.get 4
                  local.get 3
                  i32.store offset=364
                  local.get 4
                  i32.const 6
                  i32.store8 offset=360
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  local.get 4
                                  i32.load8_u offset=72
                                  local.tee 5
                                  br_table 6 (;@9;) 6 (;@9;) 0 (;@15;) 1 (;@14;) 2 (;@13;) 3 (;@12;) 4 (;@11;) 5 (;@10;) 6 (;@9;)
                                end
                                local.get 4
                                i64.load offset=80
                                local.set 10
                                br 9 (;@5;)
                              end
                              local.get 4
                              i32.load offset=76
                              local.tee 3
                              local.get 3
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 9
                              i32.store
                              local.get 9
                              i32.eqz
                              br_if 6 (;@7;)
                              br 7 (;@6;)
                            end
                            local.get 4
                            i32.load offset=76
                            local.tee 3
                            local.get 3
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 9
                            i32.store
                            local.get 9
                            i32.eqz
                            br_if 5 (;@7;)
                            local.get 4
                            i64.load8_u offset=84
                            i64.const 32
                            i64.shl
                            local.get 4
                            i64.load32_u offset=80
                            i64.or
                            local.set 10
                            br 7 (;@5;)
                          end
                          local.get 4
                          i32.load offset=76
                          local.tee 3
                          local.get 3
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 9
                          i32.store
                          local.get 9
                          br_if 5 (;@6;)
                          br 4 (;@7;)
                        end
                        local.get 4
                        i32.load offset=76
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 9
                        i32.store
                        local.get 9
                        br_if 4 (;@6;)
                        br 3 (;@7;)
                      end
                      local.get 4
                      i32.load offset=76
                      local.tee 3
                      local.get 3
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 9
                      i32.store
                      local.get 9
                      i32.eqz
                      br_if 2 (;@7;)
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.load8_u offset=73
                    local.set 9
                  end
                  br 2 (;@5;)
                end
                unreachable
              end
              local.get 4
              i64.load32_u offset=80
              local.set 10
            end
            local.get 4
            local.get 10
            i64.store offset=240
            local.get 4
            local.get 3
            i32.store offset=236
            local.get 4
            local.get 9
            i32.store8 offset=233
            local.get 4
            local.get 5
            i32.store8 offset=232
            local.get 4
            i64.const 0
            i64.store offset=304
            local.get 4
            i32.const 2
            i32.store8 offset=296
            local.get 4
            i32.const 200
            i32.add
            local.get 4
            i32.const 232
            i32.add
            local.get 4
            i32.const 296
            i32.add
            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=200
                          i32.const 255
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 0
                          local.get 4
                          i64.load offset=216
                          i64.store offset=16
                          local.get 0
                          local.get 4
                          i64.load offset=208
                          i64.store offset=8
                          local.get 0
                          i64.const 1
                          i64.store
                          local.get 4
                          i32.const 360
                          i32.add
                          call $"#func263 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          br 1 (;@10;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=224
                        i64.store offset=320
                        local.get 4
                        local.get 4
                        i64.load offset=216
                        i64.store offset=312
                        local.get 4
                        local.get 4
                        i64.load offset=208
                        i64.store offset=304
                        local.get 4
                        local.get 4
                        i64.load offset=200
                        i64.store offset=296
                        local.get 4
                        i32.const 232
                        i32.add
                        local.get 4
                        i32.const 296
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                        block ;; label = @11
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=232
                            i32.const 255
                            i32.eq
                            br_if 0 (;@12;)
                            local.get 4
                            local.get 4
                            i64.load offset=240
                            i64.store offset=136
                            local.get 4
                            local.get 4
                            i64.load offset=232
                            i64.store offset=128
                            br 1 (;@11;)
                          end
                          local.get 4
                          i32.const 256
                          i32.store16 offset=128
                        end
                        local.get 4
                        i32.const 296
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 312
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 296
                        i32.add
                        local.get 4
                        i32.const 128
                        i32.add
                        call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::to_numeric
                        local.get 4
                        f64.load offset=312
                        local.set 11
                        local.get 4
                        i32.load offset=308
                        local.set 3
                        local.get 4
                        i32.load offset=304
                        local.set 5
                        block ;; label = @11
                          local.get 4
                          i32.load offset=296
                          br_if 0 (;@11;)
                          block ;; label = @12
                            local.get 5
                            i32.const 1
                            i32.ne
                            br_if 0 (;@12;)
                            local.get 4
                            local.get 11
                            f64.store offset=300 align=4
                            local.get 4
                            local.get 3
                            i32.store offset=296
                            local.get 4
                            i32.const 296
                            i32.add
                            call $<nanvm_lib::vm::bigint::BigInt<nanvm_lib::naive::Naive>>::to_number
                            local.set 11
                            local.get 3
                            local.get 3
                            i32.load
                            i32.const -1
                            i32.add
                            local.tee 5
                            i32.store
                            local.get 5
                            br_if 0 (;@12;)
                            local.get 4
                            i32.const 296
                            i32.add
                            call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                          end
                          local.get 4
                          local.get 11
                          f64.store offset=152
                          local.get 4
                          i32.const 2
                          i32.store offset=144
                          local.get 4
                          i32.const 232
                          i32.add
                          local.get 4
                          i32.const 360
                          i32.add
                          local.get 4
                          i32.const 144
                          i32.add
                          call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=232
                            i32.const 255
                            i32.ne
                            br_if 0 (;@12;)
                            local.get 0
                            local.get 4
                            i64.load offset=248
                            i64.store offset=16
                            local.get 0
                            local.get 4
                            i64.load offset=240
                            i64.store offset=8
                            local.get 0
                            i64.const 1
                            i64.store
                            br 2 (;@10;)
                          end
                          local.get 4
                          local.get 4
                          i64.load offset=256
                          i64.store offset=320
                          local.get 4
                          local.get 4
                          i64.load offset=248
                          i64.store offset=312
                          local.get 4
                          local.get 4
                          i64.load offset=240
                          i64.store offset=304
                          local.get 4
                          local.get 4
                          i64.load offset=232
                          i64.store offset=296
                          local.get 4
                          i32.const 360
                          i32.add
                          local.get 4
                          i32.const 296
                          i32.add
                          call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                          block ;; label = @12
                            block ;; label = @13
                              local.get 4
                              i32.load8_u offset=360
                              i32.const 255
                              i32.eq
                              br_if 0 (;@13;)
                              local.get 4
                              local.get 4
                              i64.load offset=368
                              i64.store offset=168
                              local.get 4
                              local.get 4
                              i64.load offset=360
                              i64.store offset=160
                              br 1 (;@12;)
                            end
                            local.get 4
                            i32.const 256
                            i32.store16 offset=160
                          end
                          local.get 4
                          i32.const 296
                          i32.add
                          call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.const 312
                          i32.add
                          call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.const 0
                          i32.store8 offset=382
                          local.get 4
                          i64.const 2
                          i64.store offset=304
                          local.get 4
                          i64.const 1
                          i64.store offset=296
                          local.get 4
                          local.get 4
                          i32.const 382
                          i32.add
                          i32.store offset=312
                          local.get 4
                          i32.const 24
                          i32.add
                          local.get 4
                          i32.const 296
                          i32.add
                          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::once::Once<u64>, core::result::Result<u64, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<u64>>::to_rc_slice"
                          local.get 4
                          local.get 4
                          i32.load offset=28
                          local.tee 9
                          i32.store offset=364
                          local.get 4
                          local.get 4
                          i32.load offset=24
                          local.tee 5
                          i32.store offset=360
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=382
                            i32.const 1
                            i32.ne
                            br_if 0 (;@12;)
                            local.get 5
                            local.get 5
                            i32.load
                            i32.const -1
                            i32.add
                            local.tee 2
                            i32.store
                            local.get 2
                            br_if 7 (;@5;)
                            local.get 4
                            i32.const 360
                            i32.add
                            call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                            br 7 (;@5;)
                          end
                          local.get 5
                          i32.eqz
                          br_if 6 (;@5;)
                          local.get 4
                          i32.const 104
                          i32.add
                          i32.const 8
                          i32.add
                          local.set 3
                          local.get 4
                          i32.const 1
                          i32.store8 offset=308
                          local.get 4
                          local.get 9
                          i32.store offset=304
                          local.get 4
                          local.get 5
                          i32.store offset=300
                          local.get 4
                          i32.const 4
                          i32.store8 offset=296
                          local.get 4
                          i32.const 104
                          i32.add
                          local.get 4
                          i32.const 160
                          i32.add
                          local.get 4
                          i32.const 296
                          i32.add
                          call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::arith::Mul>::mul>"
                          block ;; label = @12
                            local.get 4
                            i64.load offset=104
                            i64.const 1
                            i64.ne
                            br_if 0 (;@12;)
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
                            br 2 (;@10;)
                          end
                          local.get 4
                          local.get 3
                          i64.load offset=8
                          i64.store offset=96
                          local.get 4
                          local.get 3
                          i64.load
                          i64.store offset=88
                          local.get 4
                          i32.const 0
                          i32.store8 offset=382
                          local.get 4
                          i64.const 34
                          i64.store offset=304
                          local.get 4
                          i64.const 1
                          i64.store offset=296
                          local.get 4
                          local.get 4
                          i32.const 382
                          i32.add
                          i32.store offset=312
                          local.get 4
                          i32.const 16
                          i32.add
                          local.get 4
                          i32.const 296
                          i32.add
                          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::once::Once<u64>, core::result::Result<u64, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<u64>>::to_rc_slice"
                          local.get 4
                          local.get 4
                          i32.load offset=20
                          local.tee 6
                          i32.store offset=364
                          local.get 4
                          local.get 4
                          i32.load offset=16
                          local.tee 5
                          i32.store offset=360
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=382
                            i32.const 1
                            i32.ne
                            br_if 0 (;@12;)
                            local.get 5
                            local.get 5
                            i32.load
                            i32.const -1
                            i32.add
                            local.tee 2
                            i32.store
                            local.get 2
                            br_if 6 (;@6;)
                            local.get 4
                            i32.const 360
                            i32.add
                            call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                            br 6 (;@6;)
                          end
                          local.get 5
                          i32.eqz
                          br_if 5 (;@6;)
                          local.get 4
                          i32.const 176
                          i32.add
                          i32.const 8
                          i32.add
                          local.set 9
                          local.get 4
                          i32.const 1
                          i32.store8 offset=308
                          local.get 4
                          local.get 6
                          i32.store offset=304
                          local.get 4
                          local.get 5
                          i32.store offset=300
                          local.get 4
                          i32.const 4
                          i32.store8 offset=296
                          local.get 4
                          i32.const 176
                          i32.add
                          local.get 4
                          i32.const 296
                          i32.add
                          call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::typeof_
                          block ;; label = @12
                            local.get 4
                            i64.load offset=176
                            i64.const 1
                            i64.ne
                            br_if 0 (;@12;)
                            local.get 0
                            i64.const 1
                            i64.store
                            local.get 0
                            local.get 9
                            i64.load offset=8
                            i64.store offset=16
                            local.get 0
                            local.get 9
                            i64.load
                            i64.store offset=8
                            local.get 4
                            i32.const 88
                            i32.add
                            call $"#func263 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                            br 2 (;@10;)
                          end
                          local.get 4
                          local.get 9
                          i64.load offset=8
                          local.tee 10
                          i64.store offset=288
                          local.get 4
                          local.get 9
                          i64.load
                          local.tee 12
                          i64.store offset=280
                          local.get 4
                          local.get 3
                          i64.load
                          local.tee 13
                          i64.store offset=264
                          local.get 4
                          local.get 3
                          i64.load offset=8
                          local.tee 14
                          i64.store offset=272
                          local.get 4
                          i32.const 0
                          i32.store8 offset=88
                          local.get 4
                          i64.const 8589934592
                          i64.store offset=296
                          local.get 4
                          local.get 13
                          i64.store offset=304
                          local.get 4
                          local.get 14
                          i64.store offset=312
                          local.get 4
                          local.get 12
                          i64.store offset=320
                          local.get 4
                          local.get 10
                          i64.store offset=328
                          local.get 4
                          local.get 4
                          i32.const 88
                          i32.add
                          i32.store offset=336
                          local.get 4
                          i32.const 8
                          i32.add
                          local.get 4
                          i32.const 296
                          i32.add
                          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                          local.get 4
                          local.get 4
                          i32.load offset=12
                          local.tee 5
                          i32.store offset=364
                          local.get 4
                          local.get 4
                          i32.load offset=8
                          local.tee 3
                          i32.store offset=360
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=88
                            i32.const 1
                            i32.ne
                            br_if 0 (;@12;)
                            local.get 3
                            local.get 3
                            i32.load
                            i32.const -1
                            i32.add
                            local.tee 2
                            i32.store
                            local.get 2
                            br_if 5 (;@7;)
                            local.get 4
                            i32.const 360
                            i32.add
                            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                            br 5 (;@7;)
                          end
                          local.get 3
                          i32.eqz
                          br_if 4 (;@7;)
                          local.get 0
                          local.get 5
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
                          i32.const 72
                          i32.add
                          call $"#func263 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          local.get 2
                          local.get 2
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 0
                          i32.store
                          local.get 0
                          br_if 3 (;@8;)
                          br 2 (;@9;)
                        end
                        local.get 0
                        local.get 11
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
                        i32.const 360
                        i32.add
                        call $"#func263 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                      end
                      local.get 4
                      i32.const 72
                      i32.add
                      call $"#func263 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                      local.get 2
                      local.get 2
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 0
                      i32.store
                      local.get 0
                      br_if 1 (;@8;)
                    end
                    local.get 4
                    i32.const 64
                    i32.add
                    call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                  end
                  local.get 4
                  i32.const 384
                  i32.add
                  global.set $__stack_pointer
                  return
                end
                i32.const 1059464
                i32.const 43
                local.get 4
                i32.const 383
                i32.add
                i32.const 1059448
                i32.const 1059508
                call $core::result::unwrap_failed
                unreachable
              end
              i32.const 1059464
              i32.const 43
              local.get 4
              i32.const 383
              i32.add
              i32.const 1059448
              i32.const 1059508
              call $core::result::unwrap_failed
              unreachable
            end
            i32.const 1059464
            i32.const 43
            local.get 4
            i32.const 383
            i32.add
            i32.const 1059448
            i32.const 1059508
            call $core::result::unwrap_failed
            unreachable
          end
          i32.const 1059464
          i32.const 43
          local.get 4
          i32.const 383
          i32.add
          i32.const 1059448
          i32.const 1059508
          call $core::result::unwrap_failed
          unreachable
        end
        i32.const 1059464
        i32.const 43
        local.get 4
        i32.const 383
        i32.add
        i32.const 1059448
        i32.const 1059508
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1059464
      i32.const 43
      local.get 4
      i32.const 383
      i32.add
      i32.const 1059448
      i32.const 1059508
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1059464
    i32.const 43
    local.get 4
    i32.const 383
    i32.add
    i32.const 1059448
    i32.const 1059508
    call $core::result::unwrap_failed
    unreachable
  )
