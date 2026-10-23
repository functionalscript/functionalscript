  (func $nanvm_demos::samples::parameters::module::<nanvm_lib::naive::Naive> (;565;) (type 1) (param i32 i32)
    (local i32 i32 i64 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 128
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    block ;; label = @1
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
                          local.get 1
                          i32.load8_u
                          local.tee 3
                          br_table 6 (;@5;) 6 (;@5;) 0 (;@11;) 1 (;@10;) 2 (;@9;) 3 (;@8;) 4 (;@7;) 5 (;@6;) 6 (;@5;)
                        end
                        local.get 1
                        i64.load offset=8
                        local.set 4
                        br 8 (;@2;)
                      end
                      local.get 1
                      i32.load offset=4
                      local.tee 5
                      local.get 5
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
                    local.get 1
                    i32.load offset=4
                    local.tee 5
                    local.get 5
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 6
                    i32.store
                    local.get 6
                    i32.eqz
                    br_if 7 (;@1;)
                    local.get 1
                    i64.load8_u offset=12
                    i64.const 32
                    i64.shl
                    local.get 1
                    i64.load32_u offset=8
                    i64.or
                    local.set 4
                    br 6 (;@2;)
                  end
                  local.get 1
                  i32.load offset=4
                  local.tee 5
                  local.get 5
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 6
                  i32.store
                  local.get 6
                  br_if 4 (;@3;)
                  br 6 (;@1;)
                end
                local.get 1
                i32.load offset=4
                local.tee 5
                local.get 5
                i32.load
                i32.const 1
                i32.add
                local.tee 6
                i32.store
                local.get 6
                br_if 3 (;@3;)
                br 5 (;@1;)
              end
              local.get 1
              i32.load offset=4
              local.tee 5
              local.get 5
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
            local.get 1
            i32.load8_u offset=1
            local.set 6
          end
          br 1 (;@2;)
        end
        local.get 1
        i64.load32_u offset=8
        local.set 4
      end
      local.get 2
      i32.const 0
      i32.store8 offset=24
      local.get 2
      local.get 4
      i64.store offset=88
      local.get 2
      local.get 5
      i32.store offset=84
      local.get 2
      local.get 6
      i32.store8 offset=81
      local.get 2
      local.get 3
      i32.store8 offset=80
      local.get 2
      i64.const 4294967296
      i64.store offset=72
      local.get 2
      local.get 2
      i32.const 24
      i32.add
      i32.store offset=96
      local.get 2
      i32.const 16
      i32.add
      local.get 2
      i32.const 72
      i32.add
      call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
      local.get 2
      local.get 2
      i32.load offset=20
      local.tee 6
      i32.store offset=60
      local.get 2
      local.get 2
      i32.load offset=16
      local.tee 5
      i32.store offset=56
      block ;; label = @2
        block ;; label = @3
          local.get 2
          i32.load8_u offset=24
          i32.const 1
          i32.ne
          br_if 0 (;@3;)
          local.get 5
          local.get 5
          i32.load
          i32.const -1
          i32.add
          local.tee 1
          i32.store
          local.get 1
          br_if 1 (;@2;)
          local.get 2
          i32.const 56
          i32.add
          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
          br 1 (;@2;)
        end
        local.get 5
        i32.eqz
        br_if 0 (;@2;)
        local.get 2
        i32.const 185
        i32.const 1
        local.get 5
        local.get 6
        i32.const 1063660
        i32.const 81
        call $<nanvm_lib::naive::function::Function>::new
        local.tee 5
        i32.store offset=28
        local.get 2
        i32.const 7
        i32.store8 offset=24
        local.get 2
        i32.const 0
        i32.store16 offset=52
        local.get 2
        i32.const 1063748
        i32.store offset=48
        local.get 2
        i32.const 1063741
        i32.store offset=44
        local.get 2
        i32.const 72
        i32.add
        local.get 2
        i32.const 44
        i32.add
        call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              local.get 2
              i32.load8_u offset=72
              local.tee 6
              i32.const 255
              i32.ne
              br_if 0 (;@5;)
              local.get 2
              i32.load offset=80
              local.set 7
              local.get 2
              i32.load offset=76
              local.set 8
              local.get 5
              local.get 5
              i32.load
              i32.const 1
              i32.add
              local.tee 6
              i32.store
              local.get 6
              i32.eqz
              br_if 4 (;@1;)
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              local.get 3
                              br_table 6 (;@7;) 6 (;@7;) 0 (;@13;) 1 (;@12;) 2 (;@11;) 3 (;@10;) 4 (;@9;) 5 (;@8;) 6 (;@7;)
                            end
                            local.get 1
                            i64.load offset=8
                            local.set 4
                            br 9 (;@3;)
                          end
                          local.get 1
                          i32.load offset=4
                          local.tee 6
                          local.get 6
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 9
                          i32.store
                          local.get 9
                          i32.eqz
                          br_if 10 (;@1;)
                          br 7 (;@4;)
                        end
                        local.get 1
                        i32.load offset=4
                        local.tee 6
                        local.get 6
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 9
                        i32.store
                        local.get 9
                        i32.eqz
                        br_if 9 (;@1;)
                        local.get 1
                        i64.load8_u offset=12
                        i64.const 32
                        i64.shl
                        local.get 1
                        i64.load32_u offset=8
                        i64.or
                        local.set 4
                        br 7 (;@3;)
                      end
                      local.get 1
                      i32.load offset=4
                      local.tee 6
                      local.get 6
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 9
                      i32.store
                      local.get 9
                      i32.eqz
                      br_if 8 (;@1;)
                      br 5 (;@4;)
                    end
                    local.get 1
                    i32.load offset=4
                    local.tee 6
                    local.get 6
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 9
                    i32.store
                    local.get 9
                    i32.eqz
                    br_if 7 (;@1;)
                    br 4 (;@4;)
                  end
                  local.get 1
                  i32.load offset=4
                  local.tee 6
                  local.get 6
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 9
                  i32.store
                  local.get 9
                  i32.eqz
                  br_if 6 (;@1;)
                  br 1 (;@6;)
                end
                local.get 1
                i32.load8_u offset=1
                local.set 9
              end
              br 2 (;@3;)
            end
            local.get 2
            local.get 2
            i32.load8_u offset=75
            i32.store8 offset=59
            local.get 2
            local.get 2
            i32.load16_u offset=73 align=1
            i32.store16 offset=57 align=1
            local.get 2
            local.get 2
            i32.load offset=84
            i32.store offset=68
            local.get 2
            local.get 2
            i64.load offset=76 align=4
            i64.store offset=60 align=4
            local.get 2
            local.get 6
            i32.store8 offset=56
            i32.const 1063112
            i32.const 43
            local.get 2
            i32.const 56
            i32.add
            i32.const 1063096
            i32.const 1063156
            call $core::result::unwrap_failed
            unreachable
          end
          local.get 1
          i64.load32_u offset=8
          local.set 4
        end
        local.get 2
        i32.const 0
        i32.store8 offset=44
        local.get 2
        local.get 4
        i64.store offset=104
        local.get 2
        local.get 6
        i32.store offset=100
        local.get 2
        local.get 9
        i32.store8 offset=97
        local.get 2
        local.get 3
        i32.store8 offset=96
        local.get 2
        i64.const 0
        i64.store offset=88
        local.get 2
        local.get 5
        i32.store offset=84
        local.get 2
        i32.const 7
        i32.store8 offset=80
        local.get 2
        i64.const 8589934592
        i64.store offset=72
        local.get 2
        local.get 2
        i32.const 44
        i32.add
        i32.store offset=112
        local.get 2
        i32.const 8
        i32.add
        local.get 2
        i32.const 72
        i32.add
        call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
        local.get 2
        local.get 2
        i32.load offset=12
        local.tee 3
        i32.store offset=60
        local.get 2
        local.get 2
        i32.load offset=8
        local.tee 5
        i32.store offset=56
        block ;; label = @3
          block ;; label = @4
            local.get 2
            i32.load8_u offset=44
            i32.const 1
            i32.ne
            br_if 0 (;@4;)
            local.get 5
            local.get 5
            i32.load
            i32.const -1
            i32.add
            local.tee 1
            i32.store
            local.get 1
            br_if 1 (;@3;)
            local.get 2
            i32.const 56
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
            br 1 (;@3;)
          end
          local.get 5
          i32.eqz
          br_if 0 (;@3;)
          i32.const 186
          i32.const 0
          local.get 5
          local.get 3
          i32.const 1063748
          i32.const 42
          call $<nanvm_lib::naive::function::Function>::new
          local.set 5
          local.get 2
          i32.const 0
          i32.store8 offset=44
          local.get 2
          local.get 5
          i32.store offset=92
          local.get 2
          i32.const 7
          i32.store8 offset=88
          local.get 2
          local.get 7
          i32.store offset=84
          local.get 2
          local.get 8
          i32.store offset=80
          local.get 2
          i64.const 4294967296
          i64.store offset=72
          local.get 2
          local.get 2
          i32.const 44
          i32.add
          i32.store offset=104
          local.get 2
          local.get 2
          i32.const 72
          i32.add
          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 1>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
          local.get 2
          local.get 2
          i32.load offset=4
          local.tee 3
          i32.store offset=60
          local.get 2
          local.get 2
          i32.load
          local.tee 5
          i32.store offset=56
          block ;; label = @4
            block ;; label = @5
              local.get 2
              i32.load8_u offset=44
              i32.const 1
              i32.ne
              br_if 0 (;@5;)
              local.get 5
              local.get 5
              i32.load
              i32.const -1
              i32.add
              local.tee 1
              i32.store
              local.get 1
              br_if 1 (;@4;)
              local.get 2
              i32.const 56
              i32.add
              call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
              br 1 (;@4;)
            end
            local.get 5
            i32.eqz
            br_if 0 (;@4;)
            local.get 0
            local.get 3
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
            local.get 2
            i32.const 24
            i32.add
            call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 1
            call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 2
            i32.const 128
            i32.add
            global.set $__stack_pointer
            return
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
    unreachable
  )
  (func $"<nanvm_demos::samples::parameters::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;566;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i64 i64 i64 i64)
    global.get $__stack_pointer
    i32.const 400
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 1
    i32.load
    local.set 5
    local.get 4
    local.get 2
    i32.store offset=24
    local.get 4
    local.get 3
    i32.store offset=28
    local.get 4
    i32.const 0
    i32.store8 offset=184
    local.get 4
    i32.const 1
    i32.store offset=332
    local.get 4
    local.get 3
    i32.const 1
    local.get 3
    i32.const 1
    i32.gt_u
    select
    i32.store offset=336
    local.get 4
    local.get 4
    i32.const 184
    i32.add
    i32.store offset=340
    local.get 4
    local.get 4
    i32.const 24
    i32.add
    i32.store offset=328
    local.get 4
    i32.const 16
    i32.add
    local.get 4
    i32.const 328
    i32.add
    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::adapters::map::Map<core::ops::range::Range<u32>, <nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::rest::{closure#0}>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
    local.get 4
    local.get 4
    i32.load offset=20
    local.tee 1
    i32.store offset=284
    local.get 4
    local.get 4
    i32.load offset=16
    local.tee 3
    i32.store offset=280
    block ;; label = @1
      block ;; label = @2
        local.get 4
        i32.load8_u offset=184
        i32.const 1
        i32.ne
        br_if 0 (;@2;)
        local.get 3
        local.get 3
        i32.load
        i32.const -1
        i32.add
        local.tee 0
        i32.store
        local.get 0
        br_if 1 (;@1;)
        local.get 4
        i32.const 280
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
        br 1 (;@1;)
      end
      local.get 3
      i32.eqz
      br_if 0 (;@1;)
      local.get 4
      local.get 1
      i32.store offset=40
      local.get 4
      local.get 3
      i32.store offset=36
      local.get 4
      i32.const 6
      i32.store8 offset=32
      local.get 3
      local.get 3
      i32.load
      i32.const 1
      i32.add
      local.tee 2
      i32.store
      block ;; label = @2
        local.get 2
        i32.eqz
        br_if 0 (;@2;)
        local.get 4
        local.get 3
        i32.store offset=284
        local.get 4
        i32.const 6
        i32.store8 offset=280
        local.get 4
        local.get 1
        i64.extend_i32_u
        i64.store offset=288
        local.get 4
        i64.const 0
        i64.store offset=336
        local.get 4
        i32.const 2
        i32.store8 offset=328
        local.get 4
        i32.const 184
        i32.add
        local.get 4
        i32.const 280
        i32.add
        local.get 4
        i32.const 328
        i32.add
        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=184
                            i32.const 255
                            i32.ne
                            br_if 0 (;@12;)
                            local.get 0
                            local.get 4
                            i64.load offset=200
                            i64.store offset=16
                            local.get 0
                            local.get 4
                            i64.load offset=192
                            i64.store offset=8
                            local.get 0
                            i64.const 1
                            i64.store
                            br 1 (;@11;)
                          end
                          local.get 4
                          local.get 4
                          i64.load offset=208
                          i64.store offset=352
                          local.get 4
                          local.get 4
                          i64.load offset=200
                          i64.store offset=344
                          local.get 4
                          local.get 4
                          i64.load offset=192
                          i64.store offset=336
                          local.get 4
                          local.get 4
                          i64.load offset=184
                          i64.store offset=328
                          local.get 4
                          i32.const 280
                          i32.add
                          local.get 4
                          i32.const 328
                          i32.add
                          call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                          block ;; label = @12
                            block ;; label = @13
                              local.get 4
                              i32.load8_u offset=280
                              local.tee 3
                              i32.const 255
                              i32.ne
                              br_if 0 (;@13;)
                              i32.const 1
                              local.set 1
                              i32.const 0
                              local.set 3
                              br 1 (;@12;)
                            end
                            local.get 4
                            local.get 4
                            i64.load offset=282 align=2
                            i64.store offset=64
                            local.get 4
                            local.get 4
                            i64.load offset=288 align=2
                            i64.store offset=70 align=2
                            local.get 4
                            i32.load8_u offset=281
                            local.set 1
                          end
                          local.get 4
                          i32.const 328
                          i32.add
                          call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.const 344
                          i32.add
                          call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                          local.get 4
                          local.get 1
                          i32.store8 offset=49
                          local.get 4
                          local.get 3
                          i32.store8 offset=48
                          local.get 4
                          local.get 4
                          i64.load offset=64
                          i64.store offset=50 align=2
                          local.get 4
                          local.get 4
                          i64.load offset=70 align=2
                          i64.store offset=56 align=2
                          local.get 4
                          i32.const 96
                          i32.add
                          local.get 4
                          i32.const 24
                          i32.add
                          i32.const 0
                          call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        local.get 3
                                        br_table 6 (;@12;) 6 (;@12;) 5 (;@13;) 0 (;@18;) 1 (;@17;) 2 (;@16;) 3 (;@15;) 4 (;@14;) 6 (;@12;)
                                      end
                                      local.get 4
                                      i32.load offset=52
                                      local.tee 2
                                      local.get 2
                                      i32.load
                                      i32.const 1
                                      i32.add
                                      local.tee 6
                                      i32.store
                                      local.get 6
                                      i32.eqz
                                      br_if 15 (;@2;)
                                      local.get 4
                                      i64.load32_u offset=56
                                      local.set 7
                                      br 5 (;@12;)
                                    end
                                    local.get 4
                                    i32.load offset=52
                                    local.tee 2
                                    local.get 2
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 6
                                    i32.store
                                    local.get 6
                                    i32.eqz
                                    br_if 14 (;@2;)
                                    local.get 4
                                    i64.load8_u offset=60
                                    i64.const 32
                                    i64.shl
                                    local.get 4
                                    i64.load32_u offset=56
                                    i64.or
                                    local.set 7
                                    br 4 (;@12;)
                                  end
                                  local.get 4
                                  i32.load offset=52
                                  local.tee 2
                                  local.get 2
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 6
                                  i32.store
                                  local.get 6
                                  i32.eqz
                                  br_if 13 (;@2;)
                                  local.get 4
                                  i64.load32_u offset=56
                                  local.set 7
                                  br 3 (;@12;)
                                end
                                local.get 4
                                i32.load offset=52
                                local.tee 2
                                local.get 2
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 6
                                i32.store
                                local.get 6
                                i32.eqz
                                br_if 12 (;@2;)
                                local.get 4
                                i64.load32_u offset=56
                                local.set 7
                                br 2 (;@12;)
                              end
                              local.get 4
                              i32.load offset=52
                              local.tee 2
                              local.get 2
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 6
                              i32.store
                              local.get 6
                              i32.eqz
                              br_if 11 (;@2;)
                              br 1 (;@12;)
                            end
                            local.get 4
                            i64.load offset=56
                            local.set 7
                          end
                          local.get 4
                          local.get 7
                          i64.store offset=288
                          local.get 4
                          local.get 2
                          i32.store offset=284
                          local.get 4
                          local.get 1
                          i32.store8 offset=281
                          local.get 4
                          local.get 3
                          i32.store8 offset=280
                          local.get 4
                          i32.const 256
                          i32.store16 offset=328
                          local.get 4
                          i32.const 280
                          i32.add
                          local.get 4
                          i32.const 328
                          i32.add
                          call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::cmp::PartialEq>::eq"
                          local.set 2
                          local.get 4
                          i32.const 328
                          i32.add
                          call $"#func383 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.const 280
                          i32.add
                          call $"#func383 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                          local.get 4
                          local.get 2
                          i32.store8 offset=217
                          local.get 4
                          i32.const 1
                          i32.store8 offset=216
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    local.get 4
                                    i32.const 216
                                    i32.add
                                    call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::boolean_coercion::BooleanCoercion>
                                    br_if 0 (;@16;)
                                    block ;; label = @17
                                      block ;; label = @18
                                        block ;; label = @19
                                          block ;; label = @20
                                            block ;; label = @21
                                              block ;; label = @22
                                                local.get 3
                                                br_table 9 (;@13;) 9 (;@13;) 5 (;@17;) 0 (;@22;) 1 (;@21;) 2 (;@20;) 3 (;@19;) 4 (;@18;) 9 (;@13;)
                                              end
                                              local.get 4
                                              i32.load offset=52
                                              local.tee 2
                                              local.get 2
                                              i32.load
                                              i32.const 1
                                              i32.add
                                              local.tee 1
                                              i32.store
                                              local.get 1
                                              i32.eqz
                                              br_if 19 (;@2;)
                                              br 6 (;@15;)
                                            end
                                            local.get 4
                                            i32.load offset=52
                                            local.tee 2
                                            local.get 2
                                            i32.load
                                            i32.const 1
                                            i32.add
                                            local.tee 1
                                            i32.store
                                            local.get 1
                                            i32.eqz
                                            br_if 18 (;@2;)
                                            local.get 4
                                            i64.load8_u offset=60
                                            i64.const 32
                                            i64.shl
                                            local.get 4
                                            i64.load32_u offset=56
                                            i64.or
                                            local.set 7
                                            br 6 (;@14;)
                                          end
                                          local.get 4
                                          i32.load offset=52
                                          local.tee 2
                                          local.get 2
                                          i32.load
                                          i32.const 1
                                          i32.add
                                          local.tee 1
                                          i32.store
                                          local.get 1
                                          br_if 4 (;@15;)
                                          br 17 (;@2;)
                                        end
                                        local.get 4
                                        i32.load offset=52
                                        local.tee 2
                                        local.get 2
                                        i32.load
                                        i32.const 1
                                        i32.add
                                        local.tee 1
                                        i32.store
                                        local.get 1
                                        br_if 3 (;@15;)
                                        br 16 (;@2;)
                                      end
                                      local.get 4
                                      i32.load offset=52
                                      local.tee 2
                                      local.get 2
                                      i32.load
                                      i32.const 1
                                      i32.add
                                      local.tee 1
                                      i32.store
                                      local.get 1
                                      i32.eqz
                                      br_if 15 (;@2;)
                                      br 4 (;@13;)
                                    end
                                    local.get 4
                                    i64.load offset=56
                                    local.set 7
                                    br 2 (;@14;)
                                  end
                                  local.get 4
                                  i32.const 2
                                  i32.store8 offset=112
                                  i64.const 4621819117588971520
                                  local.set 7
                                  br 3 (;@12;)
                                end
                                local.get 4
                                i64.load32_u offset=56
                                local.set 7
                              end
                            end
                            local.get 4
                            local.get 2
                            i32.store offset=116
                            local.get 4
                            local.get 1
                            i32.store8 offset=113
                            local.get 4
                            local.get 3
                            i32.store8 offset=112
                          end
                          local.get 4
                          local.get 7
                          i64.store offset=120
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        block ;; label = @19
                                          block ;; label = @20
                                            block ;; label = @21
                                              local.get 4
                                              i32.load8_u offset=32
                                              local.tee 1
                                              br_table 6 (;@15;) 6 (;@15;) 0 (;@21;) 1 (;@20;) 2 (;@19;) 3 (;@18;) 4 (;@17;) 5 (;@16;) 6 (;@15;)
                                            end
                                            local.get 4
                                            i64.load offset=40
                                            local.set 7
                                            br 8 (;@12;)
                                          end
                                          local.get 4
                                          i32.load offset=36
                                          local.tee 3
                                          local.get 3
                                          i32.load
                                          i32.const 1
                                          i32.add
                                          local.tee 2
                                          i32.store
                                          local.get 2
                                          i32.eqz
                                          br_if 17 (;@2;)
                                          br 6 (;@13;)
                                        end
                                        local.get 4
                                        i32.load offset=36
                                        local.tee 3
                                        local.get 3
                                        i32.load
                                        i32.const 1
                                        i32.add
                                        local.tee 2
                                        i32.store
                                        local.get 2
                                        i32.eqz
                                        br_if 16 (;@2;)
                                        local.get 4
                                        i64.load8_u offset=44
                                        i64.const 32
                                        i64.shl
                                        local.get 4
                                        i64.load32_u offset=40
                                        i64.or
                                        local.set 7
                                        br 6 (;@12;)
                                      end
                                      local.get 4
                                      i32.load offset=36
                                      local.tee 3
                                      local.get 3
                                      i32.load
                                      i32.const 1
                                      i32.add
                                      local.tee 2
                                      i32.store
                                      local.get 2
                                      i32.eqz
                                      br_if 15 (;@2;)
                                      br 4 (;@13;)
                                    end
                                    local.get 4
                                    i32.load offset=36
                                    local.tee 3
                                    local.get 3
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 2
                                    i32.store
                                    local.get 2
                                    i32.eqz
                                    br_if 14 (;@2;)
                                    br 3 (;@13;)
                                  end
                                  local.get 4
                                  i32.load offset=36
                                  local.tee 3
                                  local.get 3
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 2
                                  i32.store
                                  local.get 2
                                  i32.eqz
                                  br_if 13 (;@2;)
                                  br 1 (;@14;)
                                end
                                local.get 4
                                i32.load8_u offset=33
                                local.set 2
                              end
                              br 1 (;@12;)
                            end
                            local.get 4
                            i64.load32_u offset=40
                            local.set 7
                          end
                          local.get 4
                          local.get 7
                          i64.store offset=176
                          local.get 4
                          local.get 3
                          i32.store offset=172
                          local.get 4
                          local.get 2
                          i32.store8 offset=169
                          local.get 4
                          local.get 1
                          i32.store8 offset=168
                          local.get 4
                          i32.const 0
                          i32.store16 offset=324
                          local.get 4
                          i32.const 1064269
                          i32.store offset=320
                          local.get 4
                          i32.const 1064264
                          i32.store offset=316
                          local.get 4
                          i32.const 328
                          i32.add
                          local.get 4
                          i32.const 316
                          i32.add
                          call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                          local.get 4
                          i32.load8_u offset=328
                          local.tee 3
                          i32.const 255
                          i32.ne
                          br_if 4 (;@7;)
                          local.get 4
                          local.get 4
                          i64.load offset=332 align=4
                          i64.store offset=284 align=4
                          local.get 4
                          i32.const 3
                          i32.store8 offset=280
                          local.get 4
                          i32.const 232
                          i32.add
                          local.get 4
                          i32.const 168
                          i32.add
                          local.get 4
                          i32.const 280
                          i32.add
                          call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                          local.get 5
                          i32.load offset=16
                          i32.eqz
                          br_if 5 (;@6;)
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  local.get 4
                                  i32.load8_u offset=232
                                  local.tee 1
                                  i32.const 255
                                  i32.and
                                  i32.const 255
                                  i32.ne
                                  br_if 0 (;@15;)
                                  local.get 4
                                  local.get 4
                                  i64.load offset=248
                                  i64.store offset=160
                                  local.get 4
                                  local.get 4
                                  i64.load offset=240
                                  i64.store offset=152
                                  br 1 (;@14;)
                                end
                                local.get 4
                                i64.load offset=256
                                local.set 7
                                local.get 5
                                i32.load offset=12
                                local.set 2
                                local.get 4
                                local.get 4
                                i32.const 232
                                i32.add
                                i32.const 1
                                i32.or
                                local.tee 3
                                i64.load offset=15 align=1
                                i64.store offset=296 align=1
                                local.get 4
                                local.get 3
                                i64.load offset=8 align=1
                                i64.store offset=289 align=1
                                local.get 4
                                local.get 3
                                i64.load align=1
                                i64.store offset=281 align=1
                                local.get 4
                                i32.const 0
                                i32.store8 offset=316
                                local.get 4
                                i64.const 4607182418800017408
                                i64.store offset=344
                                local.get 4
                                i32.const 2
                                i32.store8 offset=336
                                local.get 4
                                i64.const 4294967296
                                i64.store offset=328
                                local.get 4
                                local.get 4
                                i32.const 316
                                i32.add
                                i32.store offset=352
                                local.get 4
                                i32.const 8
                                i32.add
                                local.get 4
                                i32.const 328
                                i32.add
                                call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                                local.get 4
                                local.get 4
                                i32.load offset=12
                                local.tee 5
                                i32.store offset=172
                                local.get 4
                                local.get 4
                                i32.load offset=8
                                local.tee 3
                                i32.store offset=168
                                block ;; label = @15
                                  local.get 4
                                  i32.load8_u offset=316
                                  i32.const 1
                                  i32.ne
                                  br_if 0 (;@15;)
                                  local.get 3
                                  local.get 3
                                  i32.load
                                  i32.const -1
                                  i32.add
                                  local.tee 0
                                  i32.store
                                  local.get 0
                                  br_if 12 (;@3;)
                                  local.get 4
                                  i32.const 168
                                  i32.add
                                  call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                                  br 12 (;@3;)
                                end
                                local.get 3
                                i32.eqz
                                br_if 11 (;@3;)
                                local.get 4
                                local.get 3
                                i32.store offset=156
                                local.get 4
                                i32.const 6
                                i32.store8 offset=152
                                local.get 4
                                local.get 5
                                i32.store offset=160
                                local.get 4
                                i64.const 0
                                i64.store offset=144
                                local.get 4
                                local.get 7
                                i64.store offset=304
                                local.get 4
                                local.get 1
                                i32.store8 offset=280
                                local.get 4
                                local.get 4
                                i64.load offset=160
                                i64.store offset=336
                                local.get 4
                                local.get 4
                                i64.load offset=152
                                i64.store offset=328
                                local.get 4
                                i32.const 144
                                i32.add
                                local.get 4
                                i32.const 280
                                i32.add
                                local.get 2
                                i32.const 8
                                i32.add
                                local.get 4
                                i32.const 328
                                i32.add
                                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::call
                                local.get 4
                                i64.load offset=144
                                i64.const 1
                                i64.ne
                                br_if 1 (;@13;)
                              end
                              local.get 4
                              local.get 4
                              i64.load offset=160
                              i64.store offset=136
                              local.get 4
                              local.get 4
                              i64.load offset=152
                              i64.store offset=128
                              local.get 4
                              i32.const 128
                              i32.add
                              local.set 3
                              br 1 (;@12;)
                            end
                            local.get 4
                            local.get 4
                            i32.const 152
                            i32.add
                            local.tee 3
                            i64.load offset=8
                            local.tee 7
                            i64.store offset=136
                            local.get 4
                            local.get 3
                            i64.load
                            local.tee 8
                            i64.store offset=128
                            local.get 4
                            local.get 8
                            i64.store offset=168
                            local.get 4
                            local.get 7
                            i64.store offset=176
                            local.get 4
                            i32.const 0
                            i32.store16 offset=324
                            local.get 4
                            i32.const 1064275
                            i32.store offset=320
                            local.get 4
                            i32.const 1064269
                            i32.store offset=316
                            local.get 4
                            i32.const 328
                            i32.add
                            local.get 4
                            i32.const 316
                            i32.add
                            call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                            local.get 4
                            i32.load8_u offset=328
                            local.tee 3
                            i32.const 255
                            i32.ne
                            br_if 7 (;@5;)
                            local.get 4
                            local.get 4
                            i64.load offset=332 align=4
                            i64.store offset=148 align=4
                            local.get 4
                            i32.const 3
                            i32.store8 offset=144
                            local.get 4
                            i32.const 280
                            i32.add
                            local.get 4
                            i32.const 168
                            i32.add
                            local.get 4
                            i32.const 144
                            i32.add
                            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                            local.get 4
                            i32.load8_u offset=280
                            i32.const 255
                            i32.ne
                            br_if 2 (;@10;)
                            local.get 4
                            i32.const 288
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
                          i32.const 112
                          i32.add
                          call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.const 96
                          i32.add
                          call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.const 48
                          i32.add
                          call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        end
                        local.get 4
                        i32.const 32
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.load offset=24
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const -1
                        i32.add
                        local.tee 3
                        i32.store
                        local.get 3
                        i32.eqz
                        br_if 1 (;@9;)
                        br 2 (;@8;)
                      end
                      local.get 4
                      local.get 4
                      i64.load offset=304
                      i64.store offset=352
                      local.get 4
                      local.get 4
                      i64.load offset=296
                      i64.store offset=344
                      local.get 4
                      local.get 4
                      i64.load offset=288
                      i64.store offset=336
                      local.get 4
                      local.get 4
                      i64.load offset=280
                      i64.store offset=328
                      local.get 4
                      i32.const 144
                      i32.add
                      local.get 4
                      i32.const 328
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                      i32.const 0
                      local.set 3
                      i32.const 1
                      local.set 1
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=144
                        local.tee 2
                        i32.const 255
                        i32.eq
                        br_if 0 (;@10;)
                        local.get 4
                        local.get 4
                        i64.load offset=146 align=2
                        i64.store offset=264
                        local.get 4
                        local.get 4
                        i64.load offset=152 align=2
                        i64.store offset=270 align=2
                        local.get 4
                        i32.load8_u offset=145
                        local.set 1
                        local.get 2
                        local.set 3
                      end
                      local.get 4
                      i32.const 328
                      i32.add
                      call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      i32.const 344
                      i32.add
                      call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      local.get 4
                      i64.load offset=104
                      local.tee 7
                      i64.store offset=72
                      local.get 4
                      local.get 4
                      i64.load offset=96
                      local.tee 8
                      i64.store offset=64
                      local.get 4
                      local.get 4
                      i64.load offset=120
                      local.tee 9
                      i64.store offset=88
                      local.get 4
                      local.get 4
                      i64.load offset=112
                      local.tee 10
                      i64.store offset=80
                      local.get 4
                      i32.const 0
                      i32.store8 offset=112
                      local.get 4
                      i64.const 12884901888
                      i64.store offset=328
                      local.get 4
                      local.get 8
                      i64.store offset=336
                      local.get 4
                      local.get 7
                      i64.store offset=344
                      local.get 4
                      local.get 10
                      i64.store offset=352
                      local.get 4
                      local.get 9
                      i64.store offset=360
                      local.get 4
                      local.get 1
                      i32.store8 offset=369
                      local.get 4
                      local.get 3
                      i32.store8 offset=368
                      local.get 4
                      local.get 4
                      i64.load offset=264
                      i64.store offset=370 align=2
                      local.get 4
                      local.get 4
                      i64.load offset=270 align=2
                      i64.store offset=376 align=2
                      local.get 4
                      local.get 4
                      i32.const 112
                      i32.add
                      i32.store offset=384
                      local.get 4
                      local.get 4
                      i32.const 328
                      i32.add
                      call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 3>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                      local.get 4
                      local.get 4
                      i32.load offset=4
                      local.tee 1
                      i32.store offset=148
                      local.get 4
                      local.get 4
                      i32.load
                      local.tee 3
                      i32.store offset=144
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=112
                        i32.const 1
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 3
                        local.get 3
                        i32.load
                        i32.const -1
                        i32.add
                        local.tee 0
                        i32.store
                        local.get 0
                        br_if 6 (;@4;)
                        local.get 4
                        i32.const 144
                        i32.add
                        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                        br 6 (;@4;)
                      end
                      local.get 3
                      i32.eqz
                      br_if 5 (;@4;)
                      local.get 0
                      local.get 1
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
                      call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      i32.const 32
                      i32.add
                      call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      i32.load offset=24
                      local.tee 3
                      local.get 3
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 3
                      i32.store
                      local.get 3
                      br_if 1 (;@8;)
                    end
                    local.get 4
                    i32.const 24
                    i32.add
                    call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                  end
                  local.get 4
                  i32.const 400
                  i32.add
                  global.set $__stack_pointer
                  return
                end
                local.get 4
                local.get 4
                i32.load8_u offset=331
                i32.store8 offset=283
                local.get 4
                local.get 4
                i32.load16_u offset=329 align=1
                i32.store16 offset=281 align=1
                local.get 4
                local.get 4
                i32.load offset=340
                i32.store offset=292
                local.get 4
                local.get 4
                i64.load offset=332 align=4
                i64.store offset=284 align=4
                local.get 4
                local.get 3
                i32.store8 offset=280
                i32.const 1063112
                i32.const 43
                local.get 4
                i32.const 280
                i32.add
                i32.const 1063096
                i32.const 1063156
                call $core::result::unwrap_failed
                unreachable
              end
              i32.const 0
              i32.const 0
              i32.const 1065308
              call $core::panicking::panic_bounds_check
              unreachable
            end
            local.get 4
            local.get 4
            i32.load8_u offset=331
            i32.store8 offset=283
            local.get 4
            local.get 4
            i32.load16_u offset=329 align=1
            i32.store16 offset=281 align=1
            local.get 4
            local.get 4
            i32.load offset=340
            i32.store offset=292
            local.get 4
            local.get 4
            i64.load offset=332 align=4
            i64.store offset=284 align=4
            local.get 4
            local.get 3
            i32.store8 offset=280
            i32.const 1063112
            i32.const 43
            local.get 4
            i32.const 280
            i32.add
            i32.const 1063096
            i32.const 1063156
            call $core::result::unwrap_failed
            unreachable
          end
          i32.const 1059464
          i32.const 43
          local.get 4
          i32.const 399
          i32.add
          i32.const 1059448
          i32.const 1059508
          call $core::result::unwrap_failed
          unreachable
        end
        i32.const 1059464
        i32.const 43
        local.get 4
        i32.const 399
        i32.add
        i32.const 1059448
        i32.const 1059508
        call $core::result::unwrap_failed
        unreachable
      end
      unreachable
    end
    i32.const 1059464
    i32.const 43
    local.get 4
    i32.const 399
    i32.add
    i32.const 1059448
    i32.const 1059508
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::parameters::module<nanvm_lib::naive::Naive>::{closure#1} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;567;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i64 i32 i64 i64 i64)
    global.get $__stack_pointer
    i32.const 464
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 1
    i32.load
    local.set 1
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
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            local.get 1
            i32.load offset=16
            i32.eqz
            br_if 0 (;@4;)
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            local.get 1
                            i32.load offset=12
                            local.tee 5
                            i32.load8_u offset=8
                            local.tee 6
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 5
                          i64.load offset=16
                          local.set 7
                          br 9 (;@2;)
                        end
                        local.get 5
                        i32.load offset=12
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 8
                        i32.store
                        local.get 8
                        i32.eqz
                        br_if 9 (;@1;)
                        br 7 (;@3;)
                      end
                      local.get 5
                      i32.load offset=12
                      local.tee 3
                      local.get 3
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 8
                      i32.store
                      local.get 8
                      i32.eqz
                      br_if 8 (;@1;)
                      local.get 5
                      i64.load8_u offset=20
                      i64.const 32
                      i64.shl
                      local.get 5
                      i64.load32_u offset=16
                      i64.or
                      local.set 7
                      br 7 (;@2;)
                    end
                    local.get 5
                    i32.load offset=12
                    local.tee 3
                    local.get 3
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 8
                    i32.store
                    local.get 8
                    br_if 5 (;@3;)
                    br 7 (;@1;)
                  end
                  local.get 5
                  i32.load offset=12
                  local.tee 3
                  local.get 3
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 8
                  i32.store
                  local.get 8
                  br_if 4 (;@3;)
                  br 6 (;@1;)
                end
                local.get 5
                i32.load offset=12
                local.tee 3
                local.get 3
                i32.load
                i32.const 1
                i32.add
                local.tee 5
                i32.store
                local.get 5
                i32.eqz
                br_if 5 (;@1;)
                br 1 (;@5;)
              end
              local.get 5
              i32.load8_u offset=9
              local.set 5
            end
            br 2 (;@2;)
          end
          i32.const 0
          i32.const 0
          i32.const 1065308
          call $core::panicking::panic_bounds_check
          unreachable
        end
        local.get 5
        i64.load32_u offset=16
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
                          i32.load8_u offset=40
                          local.tee 5
                          br_table 6 (;@5;) 6 (;@5;) 0 (;@11;) 1 (;@10;) 2 (;@9;) 3 (;@8;) 4 (;@7;) 5 (;@6;) 6 (;@5;)
                        end
                        local.get 4
                        i64.load offset=48
                        local.set 7
                        br 8 (;@2;)
                      end
                      local.get 4
                      i32.load offset=44
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
                    i32.load offset=44
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
                    i64.load8_u offset=52
                    i64.const 32
                    i64.shl
                    local.get 4
                    i64.load32_u offset=48
                    i64.or
                    local.set 7
                    br 6 (;@2;)
                  end
                  local.get 4
                  i32.load offset=44
                  local.tee 3
                  local.get 3
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 6
                  i32.store
                  local.get 6
                  i32.eqz
                  br_if 6 (;@1;)
                  br 4 (;@3;)
                end
                local.get 4
                i32.load offset=44
                local.tee 3
                local.get 3
                i32.load
                i32.const 1
                i32.add
                local.tee 6
                i32.store
                local.get 6
                i32.eqz
                br_if 5 (;@1;)
                br 3 (;@3;)
              end
              local.get 4
              i32.load offset=44
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
            i32.load8_u offset=41
            local.set 6
          end
          br 1 (;@2;)
        end
        local.get 4
        i64.load32_u offset=48
        local.set 7
      end
      local.get 4
      local.get 7
      i64.store offset=320
      local.get 4
      local.get 3
      i32.store offset=316
      local.get 4
      local.get 6
      i32.store8 offset=313
      local.get 4
      local.get 5
      i32.store8 offset=312
      local.get 4
      i64.const 0
      i64.store offset=384
      local.get 4
      i32.const 2
      i32.store8 offset=376
      local.get 4
      i32.const 248
      i32.add
      local.get 4
      i32.const 312
      i32.add
      local.get 4
      i32.const 376
      i32.add
      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=248
                      i32.const 255
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 0
                      local.get 4
                      i64.load offset=264
                      i64.store offset=16
                      local.get 0
                      local.get 4
                      i64.load offset=256
                      i64.store offset=8
                      local.get 0
                      i64.const 1
                      i64.store
                      local.get 4
                      i32.const 360
                      i32.add
                      call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      br 1 (;@8;)
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=272
                    i64.store offset=336
                    local.get 4
                    local.get 4
                    i64.load offset=264
                    i64.store offset=328
                    local.get 4
                    local.get 4
                    i64.load offset=256
                    i64.store offset=320
                    local.get 4
                    local.get 4
                    i64.load offset=248
                    i64.store offset=312
                    local.get 4
                    i32.const 376
                    i32.add
                    local.get 4
                    i32.const 312
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                    i32.const 0
                    local.set 3
                    i32.const 1
                    local.set 5
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=376
                      local.tee 6
                      i32.const 255
                      i32.eq
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 4
                      i64.load offset=378 align=2
                      i64.store offset=208
                      local.get 4
                      local.get 4
                      i64.load offset=384 align=2
                      i64.store offset=214 align=2
                      local.get 4
                      i32.load8_u offset=377
                      local.set 5
                      local.get 6
                      local.set 3
                    end
                    local.get 4
                    i32.const 312
                    i32.add
                    call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i32.const 328
                    i32.add
                    call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    local.get 4
                    i64.load offset=214 align=2
                    i64.store offset=392 align=2
                    local.get 4
                    local.get 4
                    i64.load offset=208
                    i64.store offset=386 align=2
                    local.get 4
                    i32.const 0
                    i32.store8 offset=208
                    local.get 4
                    local.get 5
                    i32.store8 offset=385
                    local.get 4
                    local.get 3
                    i32.store8 offset=384
                    local.get 4
                    i64.const 4294967296
                    i64.store offset=376
                    local.get 4
                    local.get 4
                    i32.const 208
                    i32.add
                    i32.store offset=400
                    local.get 4
                    i32.const 24
                    i32.add
                    local.get 4
                    i32.const 376
                    i32.add
                    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                    local.get 4
                    local.get 4
                    i32.load offset=28
                    local.tee 5
                    i32.store offset=316
                    local.get 4
                    local.get 4
                    i32.load offset=24
                    local.tee 3
                    i32.store offset=312
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=208
                      i32.const 1
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 3
                      local.get 3
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 2
                      i32.store
                      local.get 2
                      br_if 7 (;@2;)
                      local.get 4
                      i32.const 312
                      i32.add
                      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                      br 7 (;@2;)
                    end
                    local.get 3
                    i32.eqz
                    br_if 6 (;@2;)
                    local.get 4
                    local.get 5
                    i32.store offset=184
                    local.get 4
                    local.get 3
                    i32.store offset=180
                    local.get 4
                    i32.const 6
                    i32.store8 offset=176
                    local.get 4
                    i32.const 280
                    i32.add
                    local.get 4
                    i32.const 360
                    i32.add
                    local.get 4
                    i32.const 176
                    i32.add
                    call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
                    local.get 4
                    local.get 4
                    i64.load offset=288
                    i64.store offset=104
                    local.get 4
                    local.get 4
                    i64.load offset=296
                    i64.store offset=112
                    block ;; label = @9
                      local.get 4
                      i64.load offset=280
                      i64.const 1
                      i64.ne
                      br_if 0 (;@9;)
                      local.get 0
                      local.get 4
                      i64.load offset=112
                      i64.store offset=16
                      local.get 0
                      local.get 4
                      i64.load offset=104
                      i64.store offset=8
                      local.get 0
                      i64.const 1
                      i64.store
                      br 1 (;@8;)
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=112
                    i64.store offset=96
                    local.get 4
                    local.get 4
                    i64.load offset=104
                    i64.store offset=88
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          local.get 1
                          i32.load offset=16
                          i32.eqz
                          br_if 0 (;@11;)
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        block ;; label = @19
                                          local.get 1
                                          i32.load offset=12
                                          local.tee 3
                                          i32.load8_u offset=8
                                          local.tee 5
                                          br_table 6 (;@13;) 6 (;@13;) 0 (;@19;) 1 (;@18;) 2 (;@17;) 3 (;@16;) 4 (;@15;) 5 (;@14;) 6 (;@13;)
                                        end
                                        local.get 3
                                        i64.load offset=16
                                        local.set 7
                                        br 9 (;@9;)
                                      end
                                      local.get 3
                                      i32.load offset=12
                                      local.tee 1
                                      local.get 1
                                      i32.load
                                      i32.const 1
                                      i32.add
                                      local.tee 6
                                      i32.store
                                      local.get 6
                                      i32.eqz
                                      br_if 16 (;@1;)
                                      br 7 (;@10;)
                                    end
                                    local.get 3
                                    i32.load offset=12
                                    local.tee 1
                                    local.get 1
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 6
                                    i32.store
                                    local.get 6
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    local.get 3
                                    i64.load8_u offset=20
                                    i64.const 32
                                    i64.shl
                                    local.get 3
                                    i64.load32_u offset=16
                                    i64.or
                                    local.set 7
                                    br 7 (;@9;)
                                  end
                                  local.get 3
                                  i32.load offset=12
                                  local.tee 1
                                  local.get 1
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 6
                                  i32.store
                                  local.get 6
                                  i32.eqz
                                  br_if 14 (;@1;)
                                  br 5 (;@10;)
                                end
                                local.get 3
                                i32.load offset=12
                                local.tee 1
                                local.get 1
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 6
                                i32.store
                                local.get 6
                                i32.eqz
                                br_if 13 (;@1;)
                                br 4 (;@10;)
                              end
                              local.get 3
                              i32.load offset=12
                              local.tee 1
                              local.get 1
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 3
                              i32.store
                              local.get 3
                              i32.eqz
                              br_if 12 (;@1;)
                              br 1 (;@12;)
                            end
                            local.get 3
                            i32.load8_u offset=9
                            local.set 3
                          end
                          br 2 (;@9;)
                        end
                        i32.const 0
                        i32.const 0
                        i32.const 1065308
                        call $core::panicking::panic_bounds_check
                        unreachable
                      end
                      local.get 3
                      i64.load32_u offset=16
                      local.set 7
                    end
                    local.get 4
                    local.get 7
                    i64.store offset=152
                    local.get 4
                    local.get 1
                    i32.store offset=148
                    local.get 4
                    local.get 3
                    i32.store8 offset=145
                    local.get 4
                    local.get 5
                    i32.store8 offset=144
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        local.get 4
                                        i32.load8_u offset=40
                                        local.tee 3
                                        br_table 6 (;@12;) 6 (;@12;) 0 (;@18;) 1 (;@17;) 2 (;@16;) 3 (;@15;) 4 (;@14;) 5 (;@13;) 6 (;@12;)
                                      end
                                      local.get 4
                                      i64.load offset=48
                                      local.set 7
                                      br 8 (;@9;)
                                    end
                                    local.get 4
                                    i32.load offset=44
                                    local.tee 1
                                    local.get 1
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 5
                                    i32.store
                                    local.get 5
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    br 6 (;@10;)
                                  end
                                  local.get 4
                                  i32.load offset=44
                                  local.tee 1
                                  local.get 1
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 5
                                  i32.store
                                  local.get 5
                                  i32.eqz
                                  br_if 14 (;@1;)
                                  local.get 4
                                  i64.load8_u offset=52
                                  i64.const 32
                                  i64.shl
                                  local.get 4
                                  i64.load32_u offset=48
                                  i64.or
                                  local.set 7
                                  br 6 (;@9;)
                                end
                                local.get 4
                                i32.load offset=44
                                local.tee 1
                                local.get 1
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 5
                                i32.store
                                local.get 5
                                i32.eqz
                                br_if 13 (;@1;)
                                br 4 (;@10;)
                              end
                              local.get 4
                              i32.load offset=44
                              local.tee 1
                              local.get 1
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 5
                              i32.store
                              local.get 5
                              i32.eqz
                              br_if 12 (;@1;)
                              br 3 (;@10;)
                            end
                            local.get 4
                            i32.load offset=44
                            local.tee 1
                            local.get 1
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 5
                            i32.store
                            local.get 5
                            i32.eqz
                            br_if 11 (;@1;)
                            br 1 (;@11;)
                          end
                          local.get 4
                          i32.load8_u offset=41
                          local.set 5
                        end
                        br 1 (;@9;)
                      end
                      local.get 4
                      i64.load32_u offset=48
                      local.set 7
                    end
                    local.get 4
                    local.get 7
                    i64.store offset=320
                    local.get 4
                    local.get 1
                    i32.store offset=316
                    local.get 4
                    local.get 5
                    i32.store8 offset=313
                    local.get 4
                    local.get 3
                    i32.store8 offset=312
                    local.get 4
                    i64.const 0
                    i64.store offset=384
                    local.get 4
                    i32.const 2
                    i32.store8 offset=376
                    local.get 4
                    i32.const 280
                    i32.add
                    local.get 4
                    i32.const 312
                    i32.add
                    local.get 4
                    i32.const 376
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                    block ;; label = @9
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=280
                        i32.const 255
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 0
                        local.get 4
                        i64.load offset=296
                        i64.store offset=16
                        local.get 0
                        local.get 4
                        i64.load offset=288
                        i64.store offset=8
                        local.get 0
                        i64.const 1
                        i64.store
                        local.get 4
                        i32.const 144
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        br 1 (;@9;)
                      end
                      local.get 4
                      local.get 4
                      i64.load offset=304
                      i64.store offset=400
                      local.get 4
                      local.get 4
                      i64.load offset=296
                      i64.store offset=392
                      local.get 4
                      local.get 4
                      i64.load offset=288
                      i64.store offset=384
                      local.get 4
                      local.get 4
                      i64.load offset=280
                      i64.store offset=376
                      local.get 4
                      i32.const 312
                      i32.add
                      local.get 4
                      i32.const 376
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                      block ;; label = @10
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=312
                          local.tee 1
                          i32.const 255
                          i32.ne
                          br_if 0 (;@11;)
                          i32.const 1
                          local.set 3
                          i32.const 0
                          local.set 1
                          br 1 (;@10;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=314 align=2
                        i64.store offset=360
                        local.get 4
                        local.get 4
                        i64.load offset=320 align=2
                        i64.store offset=366 align=2
                        local.get 4
                        i32.load8_u offset=313
                        local.set 3
                      end
                      local.get 4
                      i32.const 376
                      i32.add
                      call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      i32.const 392
                      i32.add
                      call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      local.get 3
                      i32.store8 offset=209
                      local.get 4
                      local.get 1
                      i32.store8 offset=208
                      local.get 4
                      local.get 4
                      i64.load offset=360
                      i64.store offset=210 align=2
                      local.get 4
                      local.get 4
                      i64.load offset=366 align=2
                      i64.store offset=216 align=2
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        block ;; label = @19
                                          local.get 4
                                          i32.load8_u offset=40
                                          local.tee 3
                                          br_table 6 (;@13;) 6 (;@13;) 0 (;@19;) 1 (;@18;) 2 (;@17;) 3 (;@16;) 4 (;@15;) 5 (;@14;) 6 (;@13;)
                                        end
                                        local.get 4
                                        i64.load offset=48
                                        local.set 7
                                        br 8 (;@10;)
                                      end
                                      local.get 4
                                      i32.load offset=44
                                      local.tee 1
                                      local.get 1
                                      i32.load
                                      i32.const 1
                                      i32.add
                                      local.tee 5
                                      i32.store
                                      local.get 5
                                      i32.eqz
                                      br_if 16 (;@1;)
                                      br 6 (;@11;)
                                    end
                                    local.get 4
                                    i32.load offset=44
                                    local.tee 1
                                    local.get 1
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 5
                                    i32.store
                                    local.get 5
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    local.get 4
                                    i64.load8_u offset=52
                                    i64.const 32
                                    i64.shl
                                    local.get 4
                                    i64.load32_u offset=48
                                    i64.or
                                    local.set 7
                                    br 6 (;@10;)
                                  end
                                  local.get 4
                                  i32.load offset=44
                                  local.tee 1
                                  local.get 1
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 5
                                  i32.store
                                  local.get 5
                                  i32.eqz
                                  br_if 14 (;@1;)
                                  br 4 (;@11;)
                                end
                                local.get 4
                                i32.load offset=44
                                local.tee 1
                                local.get 1
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 5
                                i32.store
                                local.get 5
                                i32.eqz
                                br_if 13 (;@1;)
                                br 3 (;@11;)
                              end
                              local.get 4
                              i32.load offset=44
                              local.tee 1
                              local.get 1
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 5
                              i32.store
                              local.get 5
                              i32.eqz
                              br_if 12 (;@1;)
                              br 1 (;@12;)
                            end
                            local.get 4
                            i32.load8_u offset=41
                            local.set 5
                          end
                          br 1 (;@10;)
                        end
                        local.get 4
                        i64.load32_u offset=48
                        local.set 7
                      end
                      local.get 4
                      local.get 7
                      i64.store offset=368
                      local.get 4
                      local.get 1
                      i32.store offset=364
                      local.get 4
                      local.get 5
                      i32.store8 offset=361
                      local.get 4
                      local.get 3
                      i32.store8 offset=360
                      local.get 4
                      i64.const 0
                      i64.store offset=384
                      local.get 4
                      i32.const 2
                      i32.store8 offset=376
                      local.get 4
                      i32.const 312
                      i32.add
                      local.get 4
                      i32.const 360
                      i32.add
                      local.get 4
                      i32.const 376
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=312
                        i32.const 255
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 0
                        local.get 4
                        i64.load offset=328
                        i64.store offset=16
                        local.get 0
                        local.get 4
                        i64.load offset=320
                        i64.store offset=8
                        local.get 0
                        i64.const 1
                        i64.store
                        local.get 4
                        i32.const 208
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 144
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        br 1 (;@9;)
                      end
                      local.get 4
                      local.get 4
                      i64.load offset=336
                      i64.store offset=400
                      local.get 4
                      local.get 4
                      i64.load offset=328
                      i64.store offset=392
                      local.get 4
                      local.get 4
                      i64.load offset=320
                      i64.store offset=384
                      local.get 4
                      local.get 4
                      i64.load offset=312
                      i64.store offset=376
                      local.get 4
                      i32.const 360
                      i32.add
                      local.get 4
                      i32.const 376
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                      block ;; label = @10
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=360
                          i32.const 255
                          i32.eq
                          br_if 0 (;@11;)
                          local.get 4
                          local.get 4
                          i64.load offset=368
                          i64.store offset=352
                          local.get 4
                          local.get 4
                          i64.load offset=360
                          i64.store offset=344
                          br 1 (;@10;)
                        end
                        local.get 4
                        i32.const 256
                        i32.store16 offset=344
                      end
                      local.get 4
                      i32.const 224
                      i32.add
                      i32.const 8
                      i32.add
                      local.set 1
                      local.get 4
                      i32.const 376
                      i32.add
                      call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      i32.const 392
                      i32.add
                      call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      i64.const 4611686018427387904
                      i64.store offset=384
                      local.get 4
                      i32.const 2
                      i32.store8 offset=376
                      local.get 4
                      i32.const 224
                      i32.add
                      local.get 4
                      i32.const 344
                      i32.add
                      local.get 4
                      i32.const 376
                      i32.add
                      call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::arith::Mul>::mul>"
                      block ;; label = @10
                        local.get 4
                        i64.load offset=224
                        i64.const 1
                        i64.ne
                        br_if 0 (;@10;)
                        local.get 0
                        i64.const 1
                        i64.store
                        local.get 0
                        local.get 1
                        i64.load offset=8
                        i64.store offset=16
                        local.get 0
                        local.get 1
                        i64.load
                        i64.store offset=8
                        local.get 4
                        i32.const 208
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 144
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        br 1 (;@9;)
                      end
                      local.get 4
                      local.get 4
                      i64.load offset=208
                      local.tee 7
                      i64.store offset=176
                      local.get 4
                      local.get 4
                      i64.load offset=216
                      local.tee 9
                      i64.store offset=184
                      local.get 4
                      local.get 1
                      i64.load offset=8
                      local.tee 10
                      i64.store offset=200
                      local.get 4
                      local.get 1
                      i64.load
                      local.tee 11
                      i64.store offset=192
                      local.get 4
                      i32.const 0
                      i32.store8 offset=208
                      local.get 4
                      i64.const 17179869184
                      i64.store offset=376
                      local.get 4
                      local.get 7
                      i64.store offset=384
                      local.get 4
                      local.get 9
                      i64.store offset=392
                      local.get 4
                      local.get 11
                      i64.store offset=400
                      local.get 4
                      local.get 10
                      i64.store offset=408
                      local.get 4
                      i64.const 4620693217682128896
                      i64.store offset=440
                      local.get 4
                      i32.const 2
                      i32.store8 offset=432
                      local.get 4
                      i64.const 4619567317775286272
                      i64.store offset=424
                      local.get 4
                      i32.const 2
                      i32.store8 offset=416
                      local.get 4
                      local.get 4
                      i32.const 208
                      i32.add
                      i32.store offset=448
                      local.get 4
                      i32.const 16
                      i32.add
                      local.get 4
                      i32.const 376
                      i32.add
                      call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 4>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                      local.get 4
                      local.get 4
                      i32.load offset=20
                      local.tee 5
                      i32.store offset=364
                      local.get 4
                      local.get 4
                      i32.load offset=16
                      local.tee 1
                      i32.store offset=360
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=208
                        i32.const 1
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 1
                        local.get 1
                        i32.load
                        i32.const -1
                        i32.add
                        local.tee 2
                        i32.store
                        local.get 2
                        br_if 7 (;@3;)
                        local.get 4
                        i32.const 360
                        i32.add
                        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                        br 7 (;@3;)
                      end
                      local.get 1
                      i32.eqz
                      br_if 6 (;@3;)
                      local.get 4
                      i32.const 120
                      i32.add
                      i32.const 8
                      i32.add
                      local.set 3
                      local.get 4
                      local.get 5
                      i32.store offset=168
                      local.get 4
                      local.get 1
                      i32.store offset=164
                      local.get 4
                      i32.const 6
                      i32.store8 offset=160
                      local.get 4
                      i32.const 120
                      i32.add
                      local.get 4
                      i32.const 144
                      i32.add
                      local.get 4
                      i32.const 160
                      i32.add
                      call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
                      local.get 4
                      i64.load offset=120
                      i64.const 1
                      i64.ne
                      br_if 2 (;@7;)
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
                    end
                    local.get 4
                    i32.const 88
                    i32.add
                    call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  end
                  local.get 4
                  i32.const 40
                  i32.add
                  call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 2
                  local.get 2
                  i32.load
                  i32.const -1
                  i32.add
                  local.tee 0
                  i32.store
                  local.get 0
                  i32.eqz
                  br_if 1 (;@6;)
                  br 2 (;@5;)
                end
                local.get 4
                local.get 4
                i64.load offset=88
                local.tee 7
                i64.store offset=56
                local.get 4
                local.get 4
                i64.load offset=96
                local.tee 9
                i64.store offset=64
                local.get 4
                local.get 3
                i64.load offset=8
                local.tee 10
                i64.store offset=80
                local.get 4
                local.get 3
                i64.load
                local.tee 11
                i64.store offset=72
                local.get 4
                i32.const 0
                i32.store8 offset=360
                local.get 4
                i64.const 8589934592
                i64.store offset=376
                local.get 4
                local.get 7
                i64.store offset=384
                local.get 4
                local.get 9
                i64.store offset=392
                local.get 4
                local.get 11
                i64.store offset=400
                local.get 4
                local.get 10
                i64.store offset=408
                local.get 4
                local.get 4
                i32.const 360
                i32.add
                i32.store offset=416
                local.get 4
                i32.const 8
                i32.add
                local.get 4
                i32.const 376
                i32.add
                call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                local.get 4
                local.get 4
                i32.load offset=12
                local.tee 3
                i32.store offset=180
                local.get 4
                local.get 4
                i32.load offset=8
                local.tee 1
                i32.store offset=176
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=360
                  i32.const 1
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 1
                  local.get 1
                  i32.load
                  i32.const -1
                  i32.add
                  local.tee 2
                  i32.store
                  local.get 2
                  br_if 3 (;@4;)
                  local.get 4
                  i32.const 176
                  i32.add
                  call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                  br 3 (;@4;)
                end
                local.get 1
                i32.eqz
                br_if 2 (;@4;)
                local.get 0
                local.get 3
                i32.store offset=16
                local.get 0
                local.get 1
                i32.store offset=12
                local.get 0
                i32.const 6
                i32.store8 offset=8
                local.get 0
                i64.const 0
                i64.store
                local.get 4
                i32.const 40
                i32.add
                call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 2
                local.get 2
                i32.load
                i32.const -1
                i32.add
                local.tee 0
                i32.store
                local.get 0
                br_if 1 (;@5;)
              end
              local.get 4
              i32.const 32
              i32.add
              call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
            end
            local.get 4
            i32.const 464
            i32.add
            global.set $__stack_pointer
            return
          end
          i32.const 1059464
          i32.const 43
          local.get 4
          i32.const 463
          i32.add
          i32.const 1059448
          i32.const 1059508
          call $core::result::unwrap_failed
          unreachable
        end
        i32.const 1059464
        i32.const 43
        local.get 4
        i32.const 463
        i32.add
        i32.const 1059448
        i32.const 1059508
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1059464
      i32.const 43
      local.get 4
      i32.const 463
      i32.add
      i32.const 1059448
      i32.const 1059508
      call $core::result::unwrap_failed
      unreachable
    end
    unreachable
  )
