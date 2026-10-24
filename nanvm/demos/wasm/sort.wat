  (func $"<nanvm_lib::vm::lambda::PropertyLambda<nanvm_lib::naive::Naive>>::end_call::<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#3}::{closure#0}>" (;379;) (type 10) (param i32 i32 i32 i32 i32)
    (local i32 i32 i64 i32 i64 i32)
    global.get $__stack_pointer
    i32.const 96
    i32.sub
    local.tee 5
    global.set $__stack_pointer
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            local.get 1
            i32.load8_u
            local.tee 6
            i32.const 255
            i32.ne
            br_if 0 (;@4;)
            local.get 0
            i64.const 1
            i64.store
            local.get 0
            local.get 1
            i64.load offset=16
            i64.store offset=16
            local.get 0
            local.get 1
            i64.load offset=8
            i64.store offset=8
            br 1 (;@3;)
          end
          local.get 1
          i64.load offset=24
          local.set 7
          local.get 4
          i32.load
          local.set 4
          local.get 5
          i32.const 24
          i32.add
          local.get 3
          i32.const 0
          call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load offset=16
                  i32.eqz
                  br_if 0 (;@7;)
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  local.get 4
                                  i32.load offset=12
                                  local.tee 4
                                  i32.load8_u offset=8
                                  local.tee 8
                                  br_table 6 (;@9;) 6 (;@9;) 0 (;@15;) 1 (;@14;) 2 (;@13;) 3 (;@12;) 4 (;@11;) 5 (;@10;) 6 (;@9;)
                                end
                                local.get 4
                                i64.load offset=16
                                local.set 9
                                br 10 (;@4;)
                              end
                              local.get 4
                              i32.load offset=12
                              local.tee 3
                              local.get 3
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 10
                              i32.store
                              local.get 10
                              i32.eqz
                              br_if 7 (;@6;)
                              br 8 (;@5;)
                            end
                            local.get 4
                            i32.load offset=12
                            local.tee 3
                            local.get 3
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 10
                            i32.store
                            local.get 10
                            i32.eqz
                            br_if 6 (;@6;)
                            local.get 4
                            i64.load8_u offset=20
                            i64.const 32
                            i64.shl
                            local.get 4
                            i64.load32_u offset=16
                            i64.or
                            local.set 9
                            br 8 (;@4;)
                          end
                          local.get 4
                          i32.load offset=12
                          local.tee 3
                          local.get 3
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 10
                          i32.store
                          local.get 10
                          br_if 6 (;@5;)
                          br 5 (;@6;)
                        end
                        local.get 4
                        i32.load offset=12
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 10
                        i32.store
                        local.get 10
                        br_if 5 (;@5;)
                        br 4 (;@6;)
                      end
                      local.get 4
                      i32.load offset=12
                      local.tee 3
                      local.get 3
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 4
                      i32.store
                      local.get 4
                      i32.eqz
                      br_if 3 (;@6;)
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.load8_u offset=9
                    local.set 4
                  end
                  br 3 (;@4;)
                end
                i32.const 0
                i32.const 0
                i32.const 1062708
                call $core::panicking::panic_bounds_check
                unreachable
              end
              unreachable
            end
            local.get 4
            i64.load32_u offset=16
            local.set 9
          end
          local.get 5
          local.get 5
          i64.load offset=32
          i64.store offset=56
          local.get 5
          local.get 5
          i64.load offset=24
          i64.store offset=48
          local.get 5
          i32.const 0
          i32.store8 offset=94
          local.get 5
          local.get 9
          i64.store offset=72
          local.get 5
          local.get 3
          i32.store offset=68
          local.get 5
          local.get 4
          i32.store8 offset=65
          local.get 5
          local.get 8
          i32.store8 offset=64
          local.get 5
          i64.const 8589934592
          i64.store offset=40
          local.get 5
          local.get 5
          i32.const 94
          i32.add
          i32.store offset=80
          local.get 5
          i32.const 16
          i32.add
          local.get 5
          i32.const 40
          i32.add
          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
          local.get 5
          local.get 5
          i32.load offset=20
          local.tee 3
          i32.store offset=28
          local.get 5
          local.get 5
          i32.load offset=16
          local.tee 4
          i32.store offset=24
          block ;; label = @4
            local.get 5
            i32.load8_u offset=94
            i32.const 1
            i32.ne
            br_if 0 (;@4;)
            local.get 4
            local.get 4
            i32.load
            i32.const -1
            i32.add
            local.tee 0
            i32.store
            local.get 0
            br_if 3 (;@1;)
            local.get 5
            i32.const 24
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
            br 3 (;@1;)
          end
          local.get 4
          i32.eqz
          br_if 2 (;@1;)
          i32.const 94
          i32.const 2
          local.get 4
          local.get 3
          i32.const 1060111
          i32.const 61
          call $<nanvm_lib::naive::function::Function>::new
          local.set 4
          local.get 5
          i32.const 0
          i32.store8 offset=94
          local.get 5
          local.get 4
          i32.store offset=52
          local.get 5
          i32.const 7
          i32.store8 offset=48
          local.get 5
          i64.const 4294967296
          i64.store offset=40
          local.get 5
          local.get 5
          i32.const 94
          i32.add
          i32.store offset=64
          local.get 5
          i32.const 8
          i32.add
          local.get 5
          i32.const 40
          i32.add
          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
          local.get 5
          local.get 5
          i32.load offset=12
          local.tee 3
          i32.store offset=28
          local.get 5
          local.get 5
          i32.load offset=8
          local.tee 4
          i32.store offset=24
          block ;; label = @4
            local.get 5
            i32.load8_u offset=94
            i32.const 1
            i32.ne
            br_if 0 (;@4;)
            local.get 4
            local.get 4
            i32.load
            i32.const -1
            i32.add
            local.tee 0
            i32.store
            local.get 0
            br_if 2 (;@2;)
            local.get 5
            i32.const 24
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
            br 2 (;@2;)
          end
          local.get 4
          i32.eqz
          br_if 1 (;@2;)
          local.get 0
          local.get 3
          i32.store offset=16
          local.get 0
          local.get 4
          i32.store offset=12
          local.get 0
          i32.const 6
          i32.store8 offset=8
          local.get 0
          i64.const 0
          i64.store
          local.get 5
          local.get 0
          i64.load offset=16
          i64.store offset=32
          local.get 5
          local.get 0
          i64.load offset=8
          i64.store offset=24
          local.get 5
          local.get 6
          i32.store8 offset=40
          local.get 5
          local.get 7
          i64.store offset=64
          local.get 5
          local.get 1
          i32.const 1
          i32.add
          local.tee 1
          i64.load align=1
          i64.store offset=41 align=1
          local.get 5
          local.get 1
          i64.load offset=8 align=1
          i64.store offset=49 align=1
          local.get 5
          local.get 1
          i64.load offset=15 align=1
          i64.store offset=56 align=1
          local.get 0
          local.get 5
          i32.const 40
          i32.add
          local.get 2
          local.get 5
          i32.const 24
          i32.add
          call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::call
        end
        local.get 5
        i32.const 96
        i32.add
        global.set $__stack_pointer
        return
      end
      i32.const 1053928
      i32.const 43
      local.get 5
      i32.const 95
      i32.add
      i32.const 1053912
      i32.const 1053972
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1053928
    i32.const 43
    local.get 5
    i32.const 95
    i32.add
    i32.const 1053912
    i32.const 1053972
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#3}::{closure#0}::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;380;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i64 f64)
    global.get $__stack_pointer
    i32.const 160
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 1
    i32.load
    local.set 5
    local.get 4
    local.get 3
    i32.store offset=4
    local.get 4
    local.get 2
    i32.store
    local.get 4
    i32.const 64
    i32.add
    local.get 4
    i32.const 1
    call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
    local.get 4
    i64.const 0
    i64.store offset=104
    local.get 4
    i32.const 2
    i32.store8 offset=96
    local.get 4
    i32.const 64
    i32.add
    local.get 4
    i32.const 96
    i32.add
    call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::cmp::PartialEq>::eq"
    local.set 1
    local.get 4
    i32.const 96
    i32.add
    call $"#func607 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
    local.get 4
    i32.const 64
    i32.add
    call $"#func607 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
    local.get 4
    local.get 1
    i32.store8 offset=9
    local.get 4
    i32.const 1
    i32.store8 offset=8
    local.get 4
    local.get 1
    i32.store8 offset=97
    local.get 4
    i32.const 1
    i32.store8 offset=96
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      local.get 4
                      i32.const 96
                      i32.add
                      call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::boolean_coercion::BooleanCoercion>
                      br_if 0 (;@9;)
                      block ;; label = @10
                        local.get 5
                        i32.load offset=16
                        i32.eqz
                        br_if 0 (;@10;)
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        local.get 5
                                        i32.load offset=12
                                        local.tee 3
                                        i32.load8_u offset=8
                                        local.tee 2
                                        br_table 6 (;@12;) 6 (;@12;) 0 (;@18;) 1 (;@17;) 2 (;@16;) 3 (;@15;) 4 (;@14;) 5 (;@13;) 6 (;@12;)
                                      end
                                      local.get 3
                                      i64.load offset=16
                                      local.set 6
                                      br 11 (;@6;)
                                    end
                                    local.get 3
                                    i32.load offset=12
                                    local.tee 1
                                    local.get 1
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 5
                                    i32.store
                                    local.get 5
                                    i32.eqz
                                    br_if 8 (;@8;)
                                    br 9 (;@7;)
                                  end
                                  local.get 3
                                  i32.load offset=12
                                  local.tee 1
                                  local.get 1
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 5
                                  i32.store
                                  local.get 5
                                  i32.eqz
                                  br_if 7 (;@8;)
                                  local.get 3
                                  i64.load8_u offset=20
                                  i64.const 32
                                  i64.shl
                                  local.get 3
                                  i64.load32_u offset=16
                                  i64.or
                                  local.set 6
                                  br 9 (;@6;)
                                end
                                local.get 3
                                i32.load offset=12
                                local.tee 1
                                local.get 1
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 5
                                i32.store
                                local.get 5
                                br_if 7 (;@7;)
                                br 6 (;@8;)
                              end
                              local.get 3
                              i32.load offset=12
                              local.tee 1
                              local.get 1
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 5
                              i32.store
                              local.get 5
                              br_if 6 (;@7;)
                              br 5 (;@8;)
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
                            br_if 4 (;@8;)
                            br 1 (;@11;)
                          end
                          local.get 3
                          i32.load8_u offset=9
                          local.set 5
                        end
                        br 4 (;@6;)
                      end
                      i32.const 0
                      i32.const 0
                      i32.const 1062708
                      call $core::panicking::panic_bounds_check
                      unreachable
                    end
                    local.get 0
                    i64.const 0
                    i64.store offset=16
                    local.get 0
                    local.get 1
                    i32.store8 offset=9
                    local.get 0
                    i32.const 1
                    i32.store8 offset=8
                    local.get 0
                    i64.const 0
                    i64.store
                    br 3 (;@5;)
                  end
                  unreachable
                end
                local.get 3
                i64.load32_u offset=16
                local.set 6
              end
              local.get 4
              i32.const 32
              i32.add
              local.set 3
              local.get 4
              local.get 6
              i64.store offset=152
              local.get 4
              local.get 1
              i32.store offset=148
              local.get 4
              local.get 5
              i32.store8 offset=145
              local.get 4
              local.get 2
              i32.store8 offset=144
              local.get 4
              i32.const 64
              i32.add
              local.get 4
              i32.const 1
              call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
              local.get 4
              i64.const 4607182418800017408
              i64.store offset=104
              local.get 4
              i32.const 2
              i32.store8 offset=96
              local.get 4
              i32.const 24
              i32.add
              local.get 4
              i32.const 64
              i32.add
              local.get 4
              i32.const 96
              i32.add
              call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::arith::Sub>::sub>"
              block ;; label = @6
                local.get 4
                i32.load offset=24
                i32.eqz
                br_if 0 (;@6;)
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
                i32.const 144
                i32.add
                call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                br 3 (;@3;)
              end
              local.get 4
              i32.const 96
              i32.add
              local.get 3
              call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::to_numeric
              local.get 4
              f64.load offset=112
              local.set 7
              local.get 4
              i32.load offset=108
              local.set 1
              local.get 4
              i32.load offset=104
              local.set 3
              local.get 4
              i32.load offset=96
              br_if 1 (;@4;)
              block ;; label = @6
                local.get 3
                i32.const 1
                i32.ne
                br_if 0 (;@6;)
                local.get 4
                local.get 7
                f64.store offset=100 align=4
                local.get 4
                local.get 1
                i32.store offset=96
                local.get 4
                i32.const 96
                i32.add
                call $<nanvm_lib::vm::bigint::BigInt<nanvm_lib::naive::Naive>>::to_number
                local.set 7
                local.get 1
                local.get 1
                i32.load
                i32.const -1
                i32.add
                local.tee 3
                i32.store
                local.get 3
                br_if 0 (;@6;)
                local.get 4
                i32.const 96
                i32.add
                call $"<alloc::rc::Rc<[u64]>>::drop_slow"
              end
              local.get 4
              local.get 7
              f64.store offset=56
              local.get 4
              i32.const 2
              i32.store offset=48
              local.get 4
              i32.const 64
              i32.add
              local.get 4
              i32.const 144
              i32.add
              local.get 4
              i32.const 48
              i32.add
              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
              block ;; label = @6
                local.get 4
                i32.load8_u offset=64
                i32.const 255
                i32.ne
                br_if 0 (;@6;)
                local.get 0
                local.get 4
                i64.load offset=80
                i64.store offset=16
                local.get 0
                local.get 4
                i64.load offset=72
                i64.store offset=8
                local.get 0
                i64.const 1
                i64.store
                br 3 (;@3;)
              end
              local.get 4
              local.get 4
              i64.load offset=88
              i64.store offset=120
              local.get 4
              local.get 4
              i64.load offset=80
              i64.store offset=112
              local.get 4
              local.get 4
              i64.load offset=72
              i64.store offset=104
              local.get 4
              local.get 4
              i64.load offset=64
              i64.store offset=96
              local.get 4
              i32.const 144
              i32.add
              local.get 4
              i32.const 96
              i32.add
              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=144
                  i32.const 255
                  i32.eq
                  br_if 0 (;@7;)
                  local.get 4
                  local.get 4
                  i64.load offset=152
                  i64.store offset=136
                  local.get 4
                  local.get 4
                  i64.load offset=144
                  i64.store offset=128
                  br 1 (;@6;)
                end
                local.get 4
                i32.const 256
                i32.store16 offset=128
              end
              local.get 4
              i32.const 96
              i32.add
              call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 112
              i32.add
              call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 144
              i32.add
              local.get 4
              i32.const 0
              call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
              local.get 4
              i32.const 96
              i32.add
              local.get 4
              i32.const 128
              i32.add
              local.get 4
              i32.const 144
              i32.add
              call $nanvm_lib::vm::any::relational::compare::<nanvm_lib::naive::Naive>
              local.get 4
              i32.load8_u offset=97
              local.set 1
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=96
                  local.tee 3
                  i32.const 255
                  i32.eq
                  br_if 0 (;@7;)
                  local.get 0
                  local.get 4
                  i64.load offset=104 align=2
                  i64.store offset=16 align=2
                  local.get 0
                  local.get 4
                  i64.load offset=98 align=2
                  i64.store offset=10 align=2
                  i64.const 1
                  local.set 6
                  br 1 (;@6;)
                end
                i32.const 1
                local.set 3
                local.get 1
                i32.const 1
                i32.add
                i32.const 255
                i32.and
                i32.const 2
                i32.lt_u
                local.set 1
                i64.const 0
                local.set 6
              end
              local.get 0
              local.get 1
              i32.store8 offset=9
              local.get 0
              local.get 3
              i32.store8 offset=8
              local.get 0
              local.get 6
              i64.store
            end
            local.get 4
            i32.const 8
            i32.add
            call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 4
            i32.load
            local.tee 0
            local.get 0
            i32.load
            i32.const -1
            i32.add
            local.tee 0
            i32.store
            local.get 0
            i32.eqz
            br_if 2 (;@2;)
            br 3 (;@1;)
          end
          local.get 0
          local.get 7
          f64.store offset=16
          local.get 0
          local.get 1
          i32.store offset=12
          local.get 0
          local.get 3
          i32.store offset=8
          local.get 0
          i64.const 1
          i64.store
          local.get 4
          i32.const 144
          i32.add
          call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
        end
        local.get 4
        i32.const 8
        i32.add
        call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
        local.get 4
        i32.load
        local.tee 0
        local.get 0
        i32.load
        i32.const -1
        i32.add
        local.tee 0
        i32.store
        local.get 0
        br_if 1 (;@1;)
      end
      local.get 4
      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
    end
    local.get 4
    i32.const 160
    i32.add
    global.set $__stack_pointer
  )
  (func $"<nanvm_lib::vm::lambda::PropertyLambda<nanvm_lib::naive::Naive>>::end_call::<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#4}::{closure#2}>" (;381;) (type 4) (param i32 i32 i32)
    (local i32 i32 i64 i32)
    global.get $__stack_pointer
    i32.const 96
    i32.sub
    local.tee 3
    global.set $__stack_pointer
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          local.get 1
          i32.load8_u
          local.tee 4
          i32.const 255
          i32.ne
          br_if 0 (;@3;)
          local.get 0
          i64.const 1
          i64.store
          local.get 0
          local.get 1
          i64.load offset=16
          i64.store offset=16
          local.get 0
          local.get 1
          i64.load offset=8
          i64.store offset=8
          br 1 (;@2;)
        end
        local.get 1
        i64.load offset=24
        local.set 5
        local.get 3
        local.get 1
        i64.load offset=16 align=1
        i64.store offset=24 align=1
        local.get 3
        local.get 1
        i64.load offset=9 align=1
        i64.store offset=17 align=1
        local.get 3
        local.get 1
        i64.load offset=1 align=1
        i64.store offset=9 align=1
        local.get 3
        i32.const 0
        i32.store8 offset=47
        local.get 3
        i64.const -4616189618054758400
        i64.store offset=72
        local.get 3
        i32.const 2
        i32.store8 offset=64
        local.get 3
        i64.const 4294967296
        i64.store offset=56
        local.get 3
        local.get 3
        i32.const 47
        i32.add
        i32.store offset=80
        local.get 3
        local.get 3
        i32.const 56
        i32.add
        call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
        local.get 3
        local.get 3
        i32.load offset=4
        local.tee 6
        i32.store offset=52
        local.get 3
        local.get 3
        i32.load
        local.tee 1
        i32.store offset=48
        block ;; label = @3
          local.get 3
          i32.load8_u offset=47
          i32.const 1
          i32.ne
          br_if 0 (;@3;)
          local.get 1
          local.get 1
          i32.load
          i32.const -1
          i32.add
          local.tee 0
          i32.store
          local.get 0
          br_if 2 (;@1;)
          local.get 3
          i32.const 48
          i32.add
          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
          br 2 (;@1;)
        end
        local.get 1
        i32.eqz
        br_if 1 (;@1;)
        local.get 0
        local.get 6
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
        local.get 3
        local.get 5
        i64.store offset=32
        local.get 3
        local.get 4
        i32.store8 offset=8
        local.get 3
        local.get 0
        i64.load offset=16
        i64.store offset=64
        local.get 3
        local.get 0
        i64.load offset=8
        i64.store offset=56
        local.get 0
        local.get 3
        i32.const 8
        i32.add
        local.get 2
        local.get 3
        i32.const 56
        i32.add
        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::call
      end
      local.get 3
      i32.const 96
      i32.add
      global.set $__stack_pointer
      return
    end
    i32.const 1053928
    i32.const 43
    local.get 3
    i32.const 95
    i32.add
    i32.const 1053912
    i32.const 1053972
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_lib::vm::lambda::PropertyLambda<nanvm_lib::naive::Naive>>::end_call::<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#2}::{closure#0}::{closure#0}>" (;383;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i64 i32 i64 i32 i32)
    global.get $__stack_pointer
    i32.const 128
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          local.get 1
          i32.load8_u
          local.tee 5
          i32.const 255
          i32.ne
          br_if 0 (;@3;)
          local.get 0
          i64.const 1
          i64.store
          local.get 0
          local.get 1
          i64.load offset=16
          i64.store offset=16
          local.get 0
          local.get 1
          i64.load offset=8
          i64.store offset=8
          br 1 (;@2;)
        end
        local.get 1
        i64.load offset=24
        local.set 6
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
                            block ;; label = @13
                              local.get 3
                              i32.load8_u
                              local.tee 7
                              br_table 6 (;@7;) 6 (;@7;) 0 (;@13;) 1 (;@12;) 2 (;@11;) 3 (;@10;) 4 (;@9;) 5 (;@8;) 6 (;@7;)
                            end
                            local.get 3
                            i64.load offset=8
                            local.set 8
                            br 9 (;@3;)
                          end
                          local.get 3
                          i32.load offset=4
                          local.tee 9
                          local.get 9
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 10
                          i32.store
                          local.get 10
                          i32.eqz
                          br_if 6 (;@5;)
                          br 7 (;@4;)
                        end
                        local.get 3
                        i32.load offset=4
                        local.tee 9
                        local.get 9
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 10
                        i32.store
                        local.get 10
                        i32.eqz
                        br_if 5 (;@5;)
                        local.get 3
                        i64.load8_u offset=12
                        i64.const 32
                        i64.shl
                        local.get 3
                        i64.load32_u offset=8
                        i64.or
                        local.set 8
                        br 7 (;@3;)
                      end
                      local.get 3
                      i32.load offset=4
                      local.tee 9
                      local.get 9
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 10
                      i32.store
                      local.get 10
                      br_if 5 (;@4;)
                      br 4 (;@5;)
                    end
                    local.get 3
                    i32.load offset=4
                    local.tee 9
                    local.get 9
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 10
                    i32.store
                    local.get 10
                    br_if 4 (;@4;)
                    br 3 (;@5;)
                  end
                  local.get 3
                  i32.load offset=4
                  local.tee 9
                  local.get 9
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 3
                  i32.store
                  local.get 3
                  i32.eqz
                  br_if 2 (;@5;)
                  br 1 (;@6;)
                end
                local.get 3
                i32.load8_u offset=1
                local.set 10
              end
              br 2 (;@3;)
            end
            unreachable
          end
          local.get 3
          i64.load32_u offset=8
          local.set 8
        end
        local.get 1
        i32.const 1
        i32.add
        local.set 1
        local.get 4
        i32.const 104
        i32.add
        local.set 3
        local.get 4
        local.get 8
        i64.store offset=72
        local.get 4
        local.get 9
        i32.store offset=68
        local.get 4
        local.get 10
        i32.store8 offset=65
        local.get 4
        local.get 7
        i32.store8 offset=64
        local.get 4
        i64.const 4613937818241073152
        i64.store offset=16
        local.get 4
        i32.const 2
        i32.store8 offset=8
        local.get 4
        i32.const 96
        i32.add
        local.get 4
        i32.const 64
        i32.add
        local.get 4
        i32.const 8
        i32.add
        call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::bit::Shr>::shr>"
        block ;; label = @3
          local.get 4
          i64.load offset=96
          i64.const 1
          i64.ne
          br_if 0 (;@3;)
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
          local.get 5
          i32.store8 offset=8
          local.get 4
          local.get 2
          i32.store offset=40
          local.get 4
          local.get 6
          i64.store offset=32
          local.get 4
          local.get 1
          i64.load align=1
          i64.store offset=9 align=1
          local.get 4
          local.get 1
          i64.load offset=8 align=1
          i64.store offset=17 align=1
          local.get 4
          local.get 1
          i64.load offset=15 align=1
          i64.store offset=24 align=1
          local.get 4
          i32.const 8
          i32.add
          call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          local.get 4
          i32.const 24
          i32.add
          call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          br 1 (;@2;)
        end
        local.get 4
        local.get 3
        i64.load offset=8
        i64.store offset=24
        local.get 4
        local.get 3
        i64.load
        i64.store offset=16
        local.get 4
        i32.const 0
        i32.store8 offset=48
        local.get 4
        i64.const 4294967296
        i64.store offset=8
        local.get 4
        local.get 4
        i32.const 48
        i32.add
        i32.store offset=32
        local.get 4
        local.get 4
        i32.const 8
        i32.add
        call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
        local.get 4
        local.get 4
        i32.load offset=4
        local.tee 9
        i32.store offset=68
        local.get 4
        local.get 4
        i32.load
        local.tee 3
        i32.store offset=64
        block ;; label = @3
          local.get 4
          i32.load8_u offset=48
          i32.const 1
          i32.ne
          br_if 0 (;@3;)
          local.get 3
          local.get 3
          i32.load
          i32.const -1
          i32.add
          local.tee 0
          i32.store
          local.get 0
          br_if 2 (;@1;)
          local.get 4
          i32.const 64
          i32.add
          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
          br 2 (;@1;)
        end
        local.get 3
        i32.eqz
        br_if 1 (;@1;)
        local.get 0
        local.get 9
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
        local.get 0
        i64.load offset=16
        i64.store offset=56
        local.get 4
        local.get 0
        i64.load offset=8
        i64.store offset=48
        local.get 4
        local.get 5
        i32.store8 offset=64
        local.get 4
        local.get 6
        i64.store offset=88
        local.get 4
        local.get 1
        i64.load align=1
        i64.store offset=65 align=1
        local.get 4
        local.get 1
        i64.load offset=8 align=1
        i64.store offset=73 align=1
        local.get 4
        local.get 1
        i64.load offset=15 align=1
        i64.store offset=80 align=1
        local.get 0
        local.get 4
        i32.const 64
        i32.add
        local.get 2
        local.get 4
        i32.const 48
        i32.add
        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::call
      end
      local.get 4
      i32.const 128
      i32.add
      global.set $__stack_pointer
      return
    end
    i32.const 1053928
    i32.const 43
    local.get 4
    i32.const 127
    i32.add
    i32.const 1053912
    i32.const 1053972
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_lib::vm::lambda::PropertyLambda<nanvm_lib::naive::Naive>>::end_call::<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#5}::{closure#0}::{closure#0}>" (;384;) (type 10) (param i32 i32 i32 i32 i32)
    (local i32 i32 i64 i32 i64 i32)
    global.get $__stack_pointer
    i32.const 96
    i32.sub
    local.tee 5
    global.set $__stack_pointer
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            local.get 1
            i32.load8_u
            local.tee 6
            i32.const 255
            i32.ne
            br_if 0 (;@4;)
            local.get 0
            i64.const 1
            i64.store
            local.get 0
            local.get 1
            i64.load offset=16
            i64.store offset=16
            local.get 0
            local.get 1
            i64.load offset=8
            i64.store offset=8
            br 1 (;@3;)
          end
          local.get 1
          i64.load offset=24
          local.set 7
          local.get 4
          i32.load
          local.set 4
          local.get 5
          i32.const 24
          i32.add
          local.get 3
          i32.const 0
          call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load offset=16
                  local.tee 3
                  i32.const 2
                  i32.le_u
                  br_if 0 (;@7;)
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  local.get 4
                                  i32.load offset=12
                                  local.tee 4
                                  i32.load8_u offset=40
                                  local.tee 8
                                  br_table 6 (;@9;) 6 (;@9;) 0 (;@15;) 1 (;@14;) 2 (;@13;) 3 (;@12;) 4 (;@11;) 5 (;@10;) 6 (;@9;)
                                end
                                local.get 4
                                i64.load offset=48
                                local.set 9
                                br 10 (;@4;)
                              end
                              local.get 4
                              i32.load offset=44
                              local.tee 3
                              local.get 3
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 10
                              i32.store
                              local.get 10
                              i32.eqz
                              br_if 7 (;@6;)
                              br 8 (;@5;)
                            end
                            local.get 4
                            i32.load offset=44
                            local.tee 3
                            local.get 3
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 10
                            i32.store
                            local.get 10
                            i32.eqz
                            br_if 6 (;@6;)
                            local.get 4
                            i64.load8_u offset=52
                            i64.const 32
                            i64.shl
                            local.get 4
                            i64.load32_u offset=48
                            i64.or
                            local.set 9
                            br 8 (;@4;)
                          end
                          local.get 4
                          i32.load offset=44
                          local.tee 3
                          local.get 3
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 10
                          i32.store
                          local.get 10
                          br_if 6 (;@5;)
                          br 5 (;@6;)
                        end
                        local.get 4
                        i32.load offset=44
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 10
                        i32.store
                        local.get 10
                        br_if 5 (;@5;)
                        br 4 (;@6;)
                      end
                      local.get 4
                      i32.load offset=44
                      local.tee 3
                      local.get 3
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 4
                      i32.store
                      local.get 4
                      i32.eqz
                      br_if 3 (;@6;)
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.load8_u offset=41
                    local.set 4
                  end
                  br 3 (;@4;)
                end
                i32.const 2
                local.get 3
                i32.const 1062708
                call $core::panicking::panic_bounds_check
                unreachable
              end
              unreachable
            end
            local.get 4
            i64.load32_u offset=48
            local.set 9
          end
          local.get 5
          local.get 5
          i64.load offset=32
          i64.store offset=56
          local.get 5
          local.get 5
          i64.load offset=24
          i64.store offset=48
          local.get 5
          i32.const 0
          i32.store8 offset=94
          local.get 5
          local.get 9
          i64.store offset=72
          local.get 5
          local.get 3
          i32.store offset=68
          local.get 5
          local.get 4
          i32.store8 offset=65
          local.get 5
          local.get 8
          i32.store8 offset=64
          local.get 5
          i64.const 8589934592
          i64.store offset=40
          local.get 5
          local.get 5
          i32.const 94
          i32.add
          i32.store offset=80
          local.get 5
          i32.const 16
          i32.add
          local.get 5
          i32.const 40
          i32.add
          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
          local.get 5
          local.get 5
          i32.load offset=20
          local.tee 3
          i32.store offset=28
          local.get 5
          local.get 5
          i32.load offset=16
          local.tee 4
          i32.store offset=24
          block ;; label = @4
            local.get 5
            i32.load8_u offset=94
            i32.const 1
            i32.ne
            br_if 0 (;@4;)
            local.get 4
            local.get 4
            i32.load
            i32.const -1
            i32.add
            local.tee 0
            i32.store
            local.get 0
            br_if 3 (;@1;)
            local.get 5
            i32.const 24
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
            br 3 (;@1;)
          end
          local.get 4
          i32.eqz
          br_if 2 (;@1;)
          i32.const 95
          i32.const 1
          local.get 4
          local.get 3
          i32.const 1060192
          i32.const 11
          call $<nanvm_lib::naive::function::Function>::new
          local.set 4
          local.get 5
          i32.const 0
          i32.store8 offset=94
          local.get 5
          local.get 4
          i32.store offset=52
          local.get 5
          i32.const 7
          i32.store8 offset=48
          local.get 5
          i64.const 4294967296
          i64.store offset=40
          local.get 5
          local.get 5
          i32.const 94
          i32.add
          i32.store offset=64
          local.get 5
          i32.const 8
          i32.add
          local.get 5
          i32.const 40
          i32.add
          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
          local.get 5
          local.get 5
          i32.load offset=12
          local.tee 3
          i32.store offset=28
          local.get 5
          local.get 5
          i32.load offset=8
          local.tee 4
          i32.store offset=24
          block ;; label = @4
            local.get 5
            i32.load8_u offset=94
            i32.const 1
            i32.ne
            br_if 0 (;@4;)
            local.get 4
            local.get 4
            i32.load
            i32.const -1
            i32.add
            local.tee 0
            i32.store
            local.get 0
            br_if 2 (;@2;)
            local.get 5
            i32.const 24
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
            br 2 (;@2;)
          end
          local.get 4
          i32.eqz
          br_if 1 (;@2;)
          local.get 0
          local.get 3
          i32.store offset=16
          local.get 0
          local.get 4
          i32.store offset=12
          local.get 0
          i32.const 6
          i32.store8 offset=8
          local.get 0
          i64.const 0
          i64.store
          local.get 5
          local.get 0
          i64.load offset=16
          i64.store offset=32
          local.get 5
          local.get 0
          i64.load offset=8
          i64.store offset=24
          local.get 5
          local.get 6
          i32.store8 offset=40
          local.get 5
          local.get 7
          i64.store offset=64
          local.get 5
          local.get 1
          i32.const 1
          i32.add
          local.tee 1
          i64.load align=1
          i64.store offset=41 align=1
          local.get 5
          local.get 1
          i64.load offset=8 align=1
          i64.store offset=49 align=1
          local.get 5
          local.get 1
          i64.load offset=15 align=1
          i64.store offset=56 align=1
          local.get 0
          local.get 5
          i32.const 40
          i32.add
          local.get 2
          local.get 5
          i32.const 24
          i32.add
          call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::call
        end
        local.get 5
        i32.const 96
        i32.add
        global.set $__stack_pointer
        return
      end
      i32.const 1053928
      i32.const 43
      local.get 5
      i32.const 95
      i32.add
      i32.const 1053912
      i32.const 1053972
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1053928
    i32.const 43
    local.get 5
    i32.const 95
    i32.add
    i32.const 1053912
    i32.const 1053972
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#5}::{closure#0}::{closure#0}::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;385;) (type 3) (param i32 i32 i32 i32)
    (local i32 i64 i32)
    global.get $__stack_pointer
    i32.const 64
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 1
    i32.load
    local.set 1
    local.get 4
    local.get 3
    i32.store offset=12
    local.get 4
    local.get 2
    i32.store offset=8
    local.get 4
    i32.const 16
    i32.add
    local.get 4
    i32.const 8
    i32.add
    i32.const 0
    call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
    block ;; label = @1
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
                            local.tee 3
                            i32.load8_u offset=8
                            local.tee 2
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 3
                          i64.load offset=16
                          local.set 5
                          br 10 (;@1;)
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
                        br_if 7 (;@3;)
                        br 8 (;@2;)
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
                      br_if 6 (;@3;)
                      local.get 3
                      i64.load8_u offset=20
                      i64.const 32
                      i64.shl
                      local.get 3
                      i64.load32_u offset=16
                      i64.or
                      local.set 5
                      br 8 (;@1;)
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
                    br_if 6 (;@2;)
                    br 5 (;@3;)
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
                  br_if 5 (;@2;)
                  br 4 (;@3;)
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
                br_if 3 (;@3;)
                br 1 (;@5;)
              end
              local.get 3
              i32.load8_u offset=9
              local.set 3
            end
            br 3 (;@1;)
          end
          i32.const 0
          i32.const 0
          i32.const 1062708
          call $core::panicking::panic_bounds_check
          unreachable
        end
        unreachable
      end
      local.get 3
      i64.load32_u offset=16
      local.set 5
    end
    local.get 4
    local.get 5
    i64.store offset=40
    local.get 4
    local.get 1
    i32.store offset=36
    local.get 4
    local.get 3
    i32.store8 offset=33
    local.get 4
    local.get 2
    i32.store8 offset=32
    local.get 4
    i32.const 48
    i32.add
    local.get 4
    i32.const 16
    i32.add
    local.get 4
    i32.const 32
    i32.add
    call $nanvm_lib::vm::any::relational::compare::<nanvm_lib::naive::Naive>
    local.get 4
    i32.load8_u offset=49
    local.set 1
    block ;; label = @1
      block ;; label = @2
        local.get 4
        i32.load8_u offset=48
        local.tee 3
        i32.const 255
        i32.eq
        br_if 0 (;@2;)
        local.get 0
        local.get 4
        i64.load offset=56 align=2
        i64.store offset=16 align=2
        local.get 0
        local.get 4
        i64.load offset=50 align=2
        i64.store offset=10 align=2
        i64.const 1
        local.set 5
        br 1 (;@1;)
      end
      local.get 1
      i32.const 255
      i32.and
      i32.const 255
      i32.eq
      local.set 1
      i64.const 0
      local.set 5
      i32.const 1
      local.set 3
    end
    local.get 0
    local.get 1
    i32.store8 offset=9
    local.get 0
    local.get 3
    i32.store8 offset=8
    local.get 0
    local.get 5
    i64.store
    local.get 4
    i32.load offset=8
    local.tee 0
    local.get 0
    i32.load
    i32.const -1
    i32.add
    local.tee 0
    i32.store
    block ;; label = @1
      local.get 0
      br_if 0 (;@1;)
      local.get 4
      i32.const 8
      i32.add
      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
    end
    local.get 4
    i32.const 64
    i32.add
    global.set $__stack_pointer
  )
  (func $"<nanvm_lib::vm::lambda::PropertyLambda<nanvm_lib::naive::Naive>>::end_call::<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#5}::{closure#0}::{closure#2}>" (;386;) (type 10) (param i32 i32 i32 i32 i32)
    (local i32 i32 i64 i32 i64 i32)
    global.get $__stack_pointer
    i32.const 96
    i32.sub
    local.tee 5
    global.set $__stack_pointer
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            local.get 1
            i32.load8_u
            local.tee 6
            i32.const 255
            i32.ne
            br_if 0 (;@4;)
            local.get 0
            i64.const 1
            i64.store
            local.get 0
            local.get 1
            i64.load offset=16
            i64.store offset=16
            local.get 0
            local.get 1
            i64.load offset=8
            i64.store offset=8
            br 1 (;@3;)
          end
          local.get 1
          i64.load offset=24
          local.set 7
          local.get 4
          i32.load
          local.set 4
          local.get 5
          i32.const 24
          i32.add
          local.get 3
          i32.const 0
          call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load offset=16
                  local.tee 3
                  i32.const 2
                  i32.le_u
                  br_if 0 (;@7;)
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  local.get 4
                                  i32.load offset=12
                                  local.tee 4
                                  i32.load8_u offset=40
                                  local.tee 8
                                  br_table 6 (;@9;) 6 (;@9;) 0 (;@15;) 1 (;@14;) 2 (;@13;) 3 (;@12;) 4 (;@11;) 5 (;@10;) 6 (;@9;)
                                end
                                local.get 4
                                i64.load offset=48
                                local.set 9
                                br 10 (;@4;)
                              end
                              local.get 4
                              i32.load offset=44
                              local.tee 3
                              local.get 3
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 10
                              i32.store
                              local.get 10
                              i32.eqz
                              br_if 7 (;@6;)
                              br 8 (;@5;)
                            end
                            local.get 4
                            i32.load offset=44
                            local.tee 3
                            local.get 3
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 10
                            i32.store
                            local.get 10
                            i32.eqz
                            br_if 6 (;@6;)
                            local.get 4
                            i64.load8_u offset=52
                            i64.const 32
                            i64.shl
                            local.get 4
                            i64.load32_u offset=48
                            i64.or
                            local.set 9
                            br 8 (;@4;)
                          end
                          local.get 4
                          i32.load offset=44
                          local.tee 3
                          local.get 3
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 10
                          i32.store
                          local.get 10
                          br_if 6 (;@5;)
                          br 5 (;@6;)
                        end
                        local.get 4
                        i32.load offset=44
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 10
                        i32.store
                        local.get 10
                        br_if 5 (;@5;)
                        br 4 (;@6;)
                      end
                      local.get 4
                      i32.load offset=44
                      local.tee 3
                      local.get 3
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 4
                      i32.store
                      local.get 4
                      i32.eqz
                      br_if 3 (;@6;)
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.load8_u offset=41
                    local.set 4
                  end
                  br 3 (;@4;)
                end
                i32.const 2
                local.get 3
                i32.const 1062708
                call $core::panicking::panic_bounds_check
                unreachable
              end
              unreachable
            end
            local.get 4
            i64.load32_u offset=48
            local.set 9
          end
          local.get 5
          local.get 5
          i64.load offset=32
          i64.store offset=56
          local.get 5
          local.get 5
          i64.load offset=24
          i64.store offset=48
          local.get 5
          i32.const 0
          i32.store8 offset=94
          local.get 5
          local.get 9
          i64.store offset=72
          local.get 5
          local.get 3
          i32.store offset=68
          local.get 5
          local.get 4
          i32.store8 offset=65
          local.get 5
          local.get 8
          i32.store8 offset=64
          local.get 5
          i64.const 8589934592
          i64.store offset=40
          local.get 5
          local.get 5
          i32.const 94
          i32.add
          i32.store offset=80
          local.get 5
          i32.const 16
          i32.add
          local.get 5
          i32.const 40
          i32.add
          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
          local.get 5
          local.get 5
          i32.load offset=20
          local.tee 3
          i32.store offset=28
          local.get 5
          local.get 5
          i32.load offset=16
          local.tee 4
          i32.store offset=24
          block ;; label = @4
            local.get 5
            i32.load8_u offset=94
            i32.const 1
            i32.ne
            br_if 0 (;@4;)
            local.get 4
            local.get 4
            i32.load
            i32.const -1
            i32.add
            local.tee 0
            i32.store
            local.get 0
            br_if 3 (;@1;)
            local.get 5
            i32.const 24
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
            br 3 (;@1;)
          end
          local.get 4
          i32.eqz
          br_if 2 (;@1;)
          i32.const 96
          i32.const 1
          local.get 4
          local.get 3
          i32.const 1060203
          i32.const 11
          call $<nanvm_lib::naive::function::Function>::new
          local.set 4
          local.get 5
          i32.const 0
          i32.store8 offset=94
          local.get 5
          local.get 4
          i32.store offset=52
          local.get 5
          i32.const 7
          i32.store8 offset=48
          local.get 5
          i64.const 4294967296
          i64.store offset=40
          local.get 5
          local.get 5
          i32.const 94
          i32.add
          i32.store offset=64
          local.get 5
          i32.const 8
          i32.add
          local.get 5
          i32.const 40
          i32.add
          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
          local.get 5
          local.get 5
          i32.load offset=12
          local.tee 3
          i32.store offset=28
          local.get 5
          local.get 5
          i32.load offset=8
          local.tee 4
          i32.store offset=24
          block ;; label = @4
            local.get 5
            i32.load8_u offset=94
            i32.const 1
            i32.ne
            br_if 0 (;@4;)
            local.get 4
            local.get 4
            i32.load
            i32.const -1
            i32.add
            local.tee 0
            i32.store
            local.get 0
            br_if 2 (;@2;)
            local.get 5
            i32.const 24
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
            br 2 (;@2;)
          end
          local.get 4
          i32.eqz
          br_if 1 (;@2;)
          local.get 0
          local.get 3
          i32.store offset=16
          local.get 0
          local.get 4
          i32.store offset=12
          local.get 0
          i32.const 6
          i32.store8 offset=8
          local.get 0
          i64.const 0
          i64.store
          local.get 5
          local.get 0
          i64.load offset=16
          i64.store offset=32
          local.get 5
          local.get 0
          i64.load offset=8
          i64.store offset=24
          local.get 5
          local.get 6
          i32.store8 offset=40
          local.get 5
          local.get 7
          i64.store offset=64
          local.get 5
          local.get 1
          i32.const 1
          i32.add
          local.tee 1
          i64.load align=1
          i64.store offset=41 align=1
          local.get 5
          local.get 1
          i64.load offset=8 align=1
          i64.store offset=49 align=1
          local.get 5
          local.get 1
          i64.load offset=15 align=1
          i64.store offset=56 align=1
          local.get 0
          local.get 5
          i32.const 40
          i32.add
          local.get 2
          local.get 5
          i32.const 24
          i32.add
          call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::call
        end
        local.get 5
        i32.const 96
        i32.add
        global.set $__stack_pointer
        return
      end
      i32.const 1053928
      i32.const 43
      local.get 5
      i32.const 95
      i32.add
      i32.const 1053912
      i32.const 1053972
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1053928
    i32.const 43
    local.get 5
    i32.const 95
    i32.add
    i32.const 1053912
    i32.const 1053972
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#5}::{closure#0}::{closure#2}::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;387;) (type 3) (param i32 i32 i32 i32)
    (local i32 i64 i32)
    global.get $__stack_pointer
    i32.const 64
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 1
    i32.load
    local.set 1
    local.get 4
    local.get 3
    i32.store offset=12
    local.get 4
    local.get 2
    i32.store offset=8
    local.get 4
    i32.const 16
    i32.add
    local.get 4
    i32.const 8
    i32.add
    i32.const 0
    call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
    block ;; label = @1
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
                            local.tee 3
                            i32.load8_u offset=8
                            local.tee 2
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 3
                          i64.load offset=16
                          local.set 5
                          br 10 (;@1;)
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
                        br_if 7 (;@3;)
                        br 8 (;@2;)
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
                      br_if 6 (;@3;)
                      local.get 3
                      i64.load8_u offset=20
                      i64.const 32
                      i64.shl
                      local.get 3
                      i64.load32_u offset=16
                      i64.or
                      local.set 5
                      br 8 (;@1;)
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
                    br_if 6 (;@2;)
                    br 5 (;@3;)
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
                  br_if 5 (;@2;)
                  br 4 (;@3;)
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
                br_if 3 (;@3;)
                br 1 (;@5;)
              end
              local.get 3
              i32.load8_u offset=9
              local.set 3
            end
            br 3 (;@1;)
          end
          i32.const 0
          i32.const 0
          i32.const 1062708
          call $core::panicking::panic_bounds_check
          unreachable
        end
        unreachable
      end
      local.get 3
      i64.load32_u offset=16
      local.set 5
    end
    local.get 4
    local.get 5
    i64.store offset=40
    local.get 4
    local.get 1
    i32.store offset=36
    local.get 4
    local.get 3
    i32.store8 offset=33
    local.get 4
    local.get 2
    i32.store8 offset=32
    local.get 4
    i32.const 48
    i32.add
    local.get 4
    i32.const 16
    i32.add
    local.get 4
    i32.const 32
    i32.add
    call $nanvm_lib::vm::any::relational::compare::<nanvm_lib::naive::Naive>
    local.get 4
    i32.load8_u offset=49
    local.set 1
    block ;; label = @1
      block ;; label = @2
        local.get 4
        i32.load8_u offset=48
        local.tee 3
        i32.const 255
        i32.eq
        br_if 0 (;@2;)
        local.get 0
        local.get 4
        i64.load offset=56 align=2
        i64.store offset=16 align=2
        local.get 0
        local.get 4
        i64.load offset=50 align=2
        i64.store offset=10 align=2
        i64.const 1
        local.set 5
        br 1 (;@1;)
      end
      i32.const 1
      local.set 3
      local.get 1
      i32.const 255
      i32.and
      i32.const 1
      i32.eq
      local.set 1
      i64.const 0
      local.set 5
    end
    local.get 0
    local.get 1
    i32.store8 offset=9
    local.get 0
    local.get 3
    i32.store8 offset=8
    local.get 0
    local.get 5
    i64.store
    local.get 4
    i32.load offset=8
    local.tee 0
    local.get 0
    i32.load
    i32.const -1
    i32.add
    local.tee 0
    i32.store
    block ;; label = @1
      local.get 0
      br_if 0 (;@1;)
      local.get 4
      i32.const 8
      i32.add
      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
    end
    local.get 4
    i32.const 64
    i32.add
    global.set $__stack_pointer
  )
  (func $"<nanvm_lib::vm::lambda::PropertyLambda<nanvm_lib::naive::Naive>>::end_call::<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#5}::{closure#0}::{closure#1}>" (;388;) (type 10) (param i32 i32 i32 i32 i32)
    (local i32 i32 i64 i32 i64 i32)
    global.get $__stack_pointer
    i32.const 96
    i32.sub
    local.tee 5
    global.set $__stack_pointer
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            local.get 1
            i32.load8_u
            local.tee 6
            i32.const 255
            i32.ne
            br_if 0 (;@4;)
            local.get 0
            i64.const 1
            i64.store
            local.get 0
            local.get 1
            i64.load offset=16
            i64.store offset=16
            local.get 0
            local.get 1
            i64.load offset=8
            i64.store offset=8
            br 1 (;@3;)
          end
          local.get 1
          i64.load offset=24
          local.set 7
          local.get 4
          i32.load
          local.set 4
          local.get 5
          i32.const 24
          i32.add
          local.get 3
          i32.const 0
          call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load offset=16
                  local.tee 3
                  i32.const 2
                  i32.le_u
                  br_if 0 (;@7;)
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  local.get 4
                                  i32.load offset=12
                                  local.tee 4
                                  i32.load8_u offset=40
                                  local.tee 8
                                  br_table 6 (;@9;) 6 (;@9;) 0 (;@15;) 1 (;@14;) 2 (;@13;) 3 (;@12;) 4 (;@11;) 5 (;@10;) 6 (;@9;)
                                end
                                local.get 4
                                i64.load offset=48
                                local.set 9
                                br 10 (;@4;)
                              end
                              local.get 4
                              i32.load offset=44
                              local.tee 3
                              local.get 3
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 10
                              i32.store
                              local.get 10
                              i32.eqz
                              br_if 7 (;@6;)
                              br 8 (;@5;)
                            end
                            local.get 4
                            i32.load offset=44
                            local.tee 3
                            local.get 3
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 10
                            i32.store
                            local.get 10
                            i32.eqz
                            br_if 6 (;@6;)
                            local.get 4
                            i64.load8_u offset=52
                            i64.const 32
                            i64.shl
                            local.get 4
                            i64.load32_u offset=48
                            i64.or
                            local.set 9
                            br 8 (;@4;)
                          end
                          local.get 4
                          i32.load offset=44
                          local.tee 3
                          local.get 3
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 10
                          i32.store
                          local.get 10
                          br_if 6 (;@5;)
                          br 5 (;@6;)
                        end
                        local.get 4
                        i32.load offset=44
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 10
                        i32.store
                        local.get 10
                        br_if 5 (;@5;)
                        br 4 (;@6;)
                      end
                      local.get 4
                      i32.load offset=44
                      local.tee 3
                      local.get 3
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 4
                      i32.store
                      local.get 4
                      i32.eqz
                      br_if 3 (;@6;)
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.load8_u offset=41
                    local.set 4
                  end
                  br 3 (;@4;)
                end
                i32.const 2
                local.get 3
                i32.const 1062708
                call $core::panicking::panic_bounds_check
                unreachable
              end
              unreachable
            end
            local.get 4
            i64.load32_u offset=48
            local.set 9
          end
          local.get 5
          local.get 5
          i64.load offset=32
          i64.store offset=56
          local.get 5
          local.get 5
          i64.load offset=24
          i64.store offset=48
          local.get 5
          i32.const 0
          i32.store8 offset=94
          local.get 5
          local.get 9
          i64.store offset=72
          local.get 5
          local.get 3
          i32.store offset=68
          local.get 5
          local.get 4
          i32.store8 offset=65
          local.get 5
          local.get 8
          i32.store8 offset=64
          local.get 5
          i64.const 8589934592
          i64.store offset=40
          local.get 5
          local.get 5
          i32.const 94
          i32.add
          i32.store offset=80
          local.get 5
          i32.const 16
          i32.add
          local.get 5
          i32.const 40
          i32.add
          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
          local.get 5
          local.get 5
          i32.load offset=20
          local.tee 3
          i32.store offset=28
          local.get 5
          local.get 5
          i32.load offset=16
          local.tee 4
          i32.store offset=24
          block ;; label = @4
            local.get 5
            i32.load8_u offset=94
            i32.const 1
            i32.ne
            br_if 0 (;@4;)
            local.get 4
            local.get 4
            i32.load
            i32.const -1
            i32.add
            local.tee 0
            i32.store
            local.get 0
            br_if 3 (;@1;)
            local.get 5
            i32.const 24
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
            br 3 (;@1;)
          end
          local.get 4
          i32.eqz
          br_if 2 (;@1;)
          i32.const 97
          i32.const 1
          local.get 4
          local.get 3
          i32.const 1060214
          i32.const 13
          call $<nanvm_lib::naive::function::Function>::new
          local.set 4
          local.get 5
          i32.const 0
          i32.store8 offset=94
          local.get 5
          local.get 4
          i32.store offset=52
          local.get 5
          i32.const 7
          i32.store8 offset=48
          local.get 5
          i64.const 4294967296
          i64.store offset=40
          local.get 5
          local.get 5
          i32.const 94
          i32.add
          i32.store offset=64
          local.get 5
          i32.const 8
          i32.add
          local.get 5
          i32.const 40
          i32.add
          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
          local.get 5
          local.get 5
          i32.load offset=12
          local.tee 3
          i32.store offset=28
          local.get 5
          local.get 5
          i32.load offset=8
          local.tee 4
          i32.store offset=24
          block ;; label = @4
            local.get 5
            i32.load8_u offset=94
            i32.const 1
            i32.ne
            br_if 0 (;@4;)
            local.get 4
            local.get 4
            i32.load
            i32.const -1
            i32.add
            local.tee 0
            i32.store
            local.get 0
            br_if 2 (;@2;)
            local.get 5
            i32.const 24
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
            br 2 (;@2;)
          end
          local.get 4
          i32.eqz
          br_if 1 (;@2;)
          local.get 0
          local.get 3
          i32.store offset=16
          local.get 0
          local.get 4
          i32.store offset=12
          local.get 0
          i32.const 6
          i32.store8 offset=8
          local.get 0
          i64.const 0
          i64.store
          local.get 5
          local.get 0
          i64.load offset=16
          i64.store offset=32
          local.get 5
          local.get 0
          i64.load offset=8
          i64.store offset=24
          local.get 5
          local.get 6
          i32.store8 offset=40
          local.get 5
          local.get 7
          i64.store offset=64
          local.get 5
          local.get 1
          i32.const 1
          i32.add
          local.tee 1
          i64.load align=1
          i64.store offset=41 align=1
          local.get 5
          local.get 1
          i64.load offset=8 align=1
          i64.store offset=49 align=1
          local.get 5
          local.get 1
          i64.load offset=15 align=1
          i64.store offset=56 align=1
          local.get 0
          local.get 5
          i32.const 40
          i32.add
          local.get 2
          local.get 5
          i32.const 24
          i32.add
          call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::call
        end
        local.get 5
        i32.const 96
        i32.add
        global.set $__stack_pointer
        return
      end
      i32.const 1053928
      i32.const 43
      local.get 5
      i32.const 95
      i32.add
      i32.const 1053912
      i32.const 1053972
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1053928
    i32.const 43
    local.get 5
    i32.const 95
    i32.add
    i32.const 1053912
    i32.const 1053972
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#5}::{closure#0}::{closure#1}::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;389;) (type 3) (param i32 i32 i32 i32)
    (local i32 i64 i32)
    global.get $__stack_pointer
    i32.const 48
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 1
    i32.load
    local.set 1
    local.get 4
    local.get 3
    i32.store offset=12
    local.get 4
    local.get 2
    i32.store offset=8
    local.get 4
    i32.const 16
    i32.add
    local.get 4
    i32.const 8
    i32.add
    i32.const 0
    call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
    block ;; label = @1
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
                            local.tee 3
                            i32.load8_u offset=8
                            local.tee 2
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 3
                          i64.load offset=16
                          local.set 5
                          br 10 (;@1;)
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
                        br_if 7 (;@3;)
                        br 8 (;@2;)
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
                      br_if 6 (;@3;)
                      local.get 3
                      i64.load8_u offset=20
                      i64.const 32
                      i64.shl
                      local.get 3
                      i64.load32_u offset=16
                      i64.or
                      local.set 5
                      br 8 (;@1;)
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
                    br_if 6 (;@2;)
                    br 5 (;@3;)
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
                  br_if 5 (;@2;)
                  br 4 (;@3;)
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
                br_if 3 (;@3;)
                br 1 (;@5;)
              end
              local.get 3
              i32.load8_u offset=9
              local.set 3
            end
            br 3 (;@1;)
          end
          i32.const 0
          i32.const 0
          i32.const 1062708
          call $core::panicking::panic_bounds_check
          unreachable
        end
        unreachable
      end
      local.get 3
      i64.load32_u offset=16
      local.set 5
    end
    local.get 4
    local.get 5
    i64.store offset=40
    local.get 4
    local.get 1
    i32.store offset=36
    local.get 4
    local.get 3
    i32.store8 offset=33
    local.get 4
    local.get 2
    i32.store8 offset=32
    local.get 0
    local.get 4
    i32.const 16
    i32.add
    local.get 4
    i32.const 32
    i32.add
    call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::cmp::PartialEq>::eq"
    i32.store8 offset=9
    local.get 0
    i32.const 1
    i32.store8 offset=8
    local.get 0
    i64.const 0
    i64.store
    local.get 4
    i32.const 32
    i32.add
    call $"#func607 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
    local.get 4
    i32.const 16
    i32.add
    call $"#func607 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
    local.get 4
    i32.load offset=8
    local.tee 0
    local.get 0
    i32.load
    i32.const -1
    i32.add
    local.tee 0
    i32.store
    block ;; label = @1
      local.get 0
      br_if 0 (;@1;)
      local.get 4
      i32.const 8
      i32.add
      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
    end
    local.get 4
    i32.const 48
    i32.add
    global.set $__stack_pointer
  )
  (func $nanvm_demos::samples::sort::module::<nanvm_lib::naive::Naive> (;693;) (type 1) (param i32 i32)
    (local i32 i32 i64 i32 i32 i32 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 304
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
      i32.store8 offset=152
      local.get 2
      local.get 4
      i64.store offset=216
      local.get 2
      local.get 5
      i32.store offset=212
      local.get 2
      local.get 6
      i32.store8 offset=209
      local.get 2
      local.get 3
      i32.store8 offset=208
      local.get 2
      i64.const 4294967296
      i64.store offset=200
      local.get 2
      local.get 2
      i32.const 152
      i32.add
      i32.store offset=224
      local.get 2
      i32.const 64
      i32.add
      local.get 2
      i32.const 200
      i32.add
      call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
      local.get 2
      local.get 2
      i32.load offset=68
      local.tee 3
      i32.store offset=188
      local.get 2
      local.get 2
      i32.load offset=64
      local.tee 5
      i32.store offset=184
      block ;; label = @2
        block ;; label = @3
          local.get 2
          i32.load8_u offset=152
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
          i32.const 184
          i32.add
          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
          br 1 (;@2;)
        end
        local.get 5
        i32.eqz
        br_if 0 (;@2;)
        local.get 2
        i32.const 231
        i32.const 1
        local.get 5
        local.get 3
        i32.const 1064713
        i32.const 25
        call $<nanvm_lib::naive::function::Function>::new
        local.tee 5
        i32.store offset=76
        local.get 2
        i32.const 7
        i32.store8 offset=72
        local.get 5
        local.get 5
        i32.load
        i32.const 1
        i32.add
        local.tee 3
        i32.store
        local.get 3
        i32.eqz
        br_if 1 (;@1;)
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
                            local.get 1
                            i32.load8_u
                            local.tee 6
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 1
                          i64.load offset=8
                          local.set 4
                          br 8 (;@3;)
                        end
                        local.get 1
                        i32.load offset=4
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
                        br 6 (;@4;)
                      end
                      local.get 1
                      i32.load offset=4
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
                      local.get 1
                      i64.load8_u offset=12
                      i64.const 32
                      i64.shl
                      local.get 1
                      i64.load32_u offset=8
                      i64.or
                      local.set 4
                      br 6 (;@3;)
                    end
                    local.get 1
                    i32.load offset=4
                    local.tee 3
                    local.get 3
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 7
                    i32.store
                    local.get 7
                    i32.eqz
                    br_if 7 (;@1;)
                    br 4 (;@4;)
                  end
                  local.get 1
                  i32.load offset=4
                  local.tee 3
                  local.get 3
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 7
                  i32.store
                  local.get 7
                  i32.eqz
                  br_if 6 (;@1;)
                  br 3 (;@4;)
                end
                local.get 1
                i32.load offset=4
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
              local.get 1
              i32.load8_u offset=1
              local.set 7
            end
            br 1 (;@3;)
          end
          local.get 1
          i64.load32_u offset=8
          local.set 4
        end
        local.get 2
        i32.const 0
        i32.store8 offset=152
        local.get 2
        local.get 4
        i64.store offset=232
        local.get 2
        local.get 3
        i32.store offset=228
        local.get 2
        local.get 7
        i32.store8 offset=225
        local.get 2
        local.get 6
        i32.store8 offset=224
        local.get 2
        local.get 5
        i32.store offset=212
        local.get 2
        i32.const 7
        i32.store8 offset=208
        local.get 2
        i64.const 8589934592
        i64.store offset=200
        local.get 2
        local.get 2
        i32.const 152
        i32.add
        i32.store offset=240
        local.get 2
        i32.const 56
        i32.add
        local.get 2
        i32.const 200
        i32.add
        call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
        local.get 2
        local.get 2
        i32.load offset=60
        local.tee 3
        i32.store offset=188
        local.get 2
        local.get 2
        i32.load offset=56
        local.tee 5
        i32.store offset=184
        block ;; label = @3
          block ;; label = @4
            local.get 2
            i32.load8_u offset=152
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
            i32.const 184
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
            br 1 (;@3;)
          end
          local.get 5
          i32.eqz
          br_if 0 (;@3;)
          local.get 2
          i32.const 232
          i32.const 2
          local.get 5
          local.get 3
          i32.const 1064738
          i32.const 165
          call $<nanvm_lib::naive::function::Function>::new
          local.tee 3
          i32.store offset=92
          local.get 2
          i32.const 7
          i32.store8 offset=88
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              local.get 1
                              i32.load8_u
                              local.tee 6
                              br_table 6 (;@7;) 6 (;@7;) 0 (;@13;) 1 (;@12;) 2 (;@11;) 3 (;@10;) 4 (;@9;) 5 (;@8;) 6 (;@7;)
                            end
                            local.get 1
                            i64.load offset=8
                            local.set 4
                            br 8 (;@4;)
                          end
                          local.get 1
                          i32.load offset=4
                          local.tee 5
                          local.get 5
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 7
                          i32.store
                          local.get 7
                          i32.eqz
                          br_if 10 (;@1;)
                          br 6 (;@5;)
                        end
                        local.get 1
                        i32.load offset=4
                        local.tee 5
                        local.get 5
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 7
                        i32.store
                        local.get 7
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
                        br 6 (;@4;)
                      end
                      local.get 1
                      i32.load offset=4
                      local.tee 5
                      local.get 5
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 7
                      i32.store
                      local.get 7
                      i32.eqz
                      br_if 8 (;@1;)
                      br 4 (;@5;)
                    end
                    local.get 1
                    i32.load offset=4
                    local.tee 5
                    local.get 5
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 7
                    i32.store
                    local.get 7
                    i32.eqz
                    br_if 7 (;@1;)
                    br 3 (;@5;)
                  end
                  local.get 1
                  i32.load offset=4
                  local.tee 5
                  local.get 5
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 7
                  i32.store
                  local.get 7
                  i32.eqz
                  br_if 6 (;@1;)
                  br 1 (;@6;)
                end
                local.get 1
                i32.load8_u offset=1
                local.set 7
              end
              br 1 (;@4;)
            end
            local.get 1
            i64.load32_u offset=8
            local.set 4
          end
          local.get 2
          i32.const 0
          i32.store8 offset=152
          local.get 2
          local.get 4
          i64.store offset=216
          local.get 2
          local.get 5
          i32.store offset=212
          local.get 2
          local.get 7
          i32.store8 offset=209
          local.get 2
          local.get 6
          i32.store8 offset=208
          local.get 2
          i64.const 4294967296
          i64.store offset=200
          local.get 2
          local.get 2
          i32.const 152
          i32.add
          i32.store offset=224
          local.get 2
          i32.const 48
          i32.add
          local.get 2
          i32.const 200
          i32.add
          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
          local.get 2
          local.get 2
          i32.load offset=52
          local.tee 6
          i32.store offset=188
          local.get 2
          local.get 2
          i32.load offset=48
          local.tee 5
          i32.store offset=184
          block ;; label = @4
            block ;; label = @5
              local.get 2
              i32.load8_u offset=152
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
              i32.const 184
              i32.add
              call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
              br 1 (;@4;)
            end
            local.get 5
            i32.eqz
            br_if 0 (;@4;)
            local.get 2
            i32.const 233
            i32.const 1
            local.get 5
            local.get 6
            i32.const 1064903
            i32.const 221
            call $<nanvm_lib::naive::function::Function>::new
            local.tee 6
            i32.store offset=108
            local.get 2
            i32.const 7
            i32.store8 offset=104
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
                                local.get 1
                                i32.load8_u
                                local.tee 7
                                br_table 6 (;@8;) 6 (;@8;) 0 (;@14;) 1 (;@13;) 2 (;@12;) 3 (;@11;) 4 (;@10;) 5 (;@9;) 6 (;@8;)
                              end
                              local.get 1
                              i64.load offset=8
                              local.set 4
                              br 8 (;@5;)
                            end
                            local.get 1
                            i32.load offset=4
                            local.tee 5
                            local.get 5
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 8
                            i32.store
                            local.get 8
                            i32.eqz
                            br_if 11 (;@1;)
                            br 6 (;@6;)
                          end
                          local.get 1
                          i32.load offset=4
                          local.tee 5
                          local.get 5
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 8
                          i32.store
                          local.get 8
                          i32.eqz
                          br_if 10 (;@1;)
                          local.get 1
                          i64.load8_u offset=12
                          i64.const 32
                          i64.shl
                          local.get 1
                          i64.load32_u offset=8
                          i64.or
                          local.set 4
                          br 6 (;@5;)
                        end
                        local.get 1
                        i32.load offset=4
                        local.tee 5
                        local.get 5
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 8
                        i32.store
                        local.get 8
                        i32.eqz
                        br_if 9 (;@1;)
                        br 4 (;@6;)
                      end
                      local.get 1
                      i32.load offset=4
                      local.tee 5
                      local.get 5
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 8
                      i32.store
                      local.get 8
                      i32.eqz
                      br_if 8 (;@1;)
                      br 3 (;@6;)
                    end
                    local.get 1
                    i32.load offset=4
                    local.tee 5
                    local.get 5
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 8
                    i32.store
                    local.get 8
                    i32.eqz
                    br_if 7 (;@1;)
                    br 1 (;@7;)
                  end
                  local.get 1
                  i32.load8_u offset=1
                  local.set 8
                end
                br 1 (;@5;)
              end
              local.get 1
              i64.load32_u offset=8
              local.set 4
            end
            local.get 2
            i32.const 0
            i32.store8 offset=152
            local.get 2
            local.get 4
            i64.store offset=216
            local.get 2
            local.get 5
            i32.store offset=212
            local.get 2
            local.get 8
            i32.store8 offset=209
            local.get 2
            local.get 7
            i32.store8 offset=208
            local.get 2
            i64.const 4294967296
            i64.store offset=200
            local.get 2
            local.get 2
            i32.const 152
            i32.add
            i32.store offset=224
            local.get 2
            i32.const 40
            i32.add
            local.get 2
            i32.const 200
            i32.add
            call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
            local.get 2
            local.get 2
            i32.load offset=44
            local.tee 7
            i32.store offset=188
            local.get 2
            local.get 2
            i32.load offset=40
            local.tee 5
            i32.store offset=184
            block ;; label = @5
              block ;; label = @6
                local.get 2
                i32.load8_u offset=152
                i32.const 1
                i32.ne
                br_if 0 (;@6;)
                local.get 5
                local.get 5
                i32.load
                i32.const -1
                i32.add
                local.tee 1
                i32.store
                local.get 1
                br_if 1 (;@5;)
                local.get 2
                i32.const 184
                i32.add
                call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                br 1 (;@5;)
              end
              local.get 5
              i32.eqz
              br_if 0 (;@5;)
              local.get 2
              i32.const 234
              i32.const 1
              local.get 5
              local.get 7
              i32.const 1065124
              i32.const 77
              call $<nanvm_lib::naive::function::Function>::new
              local.tee 5
              i32.store offset=124
              local.get 2
              i32.const 7
              i32.store8 offset=120
              local.get 5
              local.get 5
              i32.load
              i32.const 1
              i32.add
              local.tee 7
              i32.store
              local.get 7
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
                              block ;; label = @14
                                block ;; label = @15
                                  local.get 1
                                  i32.load8_u
                                  local.tee 8
                                  br_table 6 (;@9;) 6 (;@9;) 0 (;@15;) 1 (;@14;) 2 (;@13;) 3 (;@12;) 4 (;@11;) 5 (;@10;) 6 (;@9;)
                                end
                                local.get 1
                                i64.load offset=8
                                local.set 4
                                br 8 (;@6;)
                              end
                              local.get 1
                              i32.load offset=4
                              local.tee 7
                              local.get 7
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 9
                              i32.store
                              local.get 9
                              i32.eqz
                              br_if 12 (;@1;)
                              br 6 (;@7;)
                            end
                            local.get 1
                            i32.load offset=4
                            local.tee 7
                            local.get 7
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 9
                            i32.store
                            local.get 9
                            i32.eqz
                            br_if 11 (;@1;)
                            local.get 1
                            i64.load8_u offset=12
                            i64.const 32
                            i64.shl
                            local.get 1
                            i64.load32_u offset=8
                            i64.or
                            local.set 4
                            br 6 (;@6;)
                          end
                          local.get 1
                          i32.load offset=4
                          local.tee 7
                          local.get 7
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 9
                          i32.store
                          local.get 9
                          i32.eqz
                          br_if 10 (;@1;)
                          br 4 (;@7;)
                        end
                        local.get 1
                        i32.load offset=4
                        local.tee 7
                        local.get 7
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 9
                        i32.store
                        local.get 9
                        i32.eqz
                        br_if 9 (;@1;)
                        br 3 (;@7;)
                      end
                      local.get 1
                      i32.load offset=4
                      local.tee 7
                      local.get 7
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 9
                      i32.store
                      local.get 9
                      i32.eqz
                      br_if 8 (;@1;)
                      br 1 (;@8;)
                    end
                    local.get 1
                    i32.load8_u offset=1
                    local.set 9
                  end
                  br 1 (;@6;)
                end
                local.get 1
                i64.load32_u offset=8
                local.set 4
              end
              local.get 2
              i32.const 0
              i32.store8 offset=152
              local.get 2
              local.get 4
              i64.store offset=232
              local.get 2
              local.get 7
              i32.store offset=228
              local.get 2
              local.get 9
              i32.store8 offset=225
              local.get 2
              local.get 8
              i32.store8 offset=224
              local.get 2
              local.get 5
              i32.store offset=212
              local.get 2
              i32.const 7
              i32.store8 offset=208
              local.get 2
              i64.const 8589934592
              i64.store offset=200
              local.get 2
              local.get 2
              i32.const 152
              i32.add
              i32.store offset=240
              local.get 2
              i32.const 32
              i32.add
              local.get 2
              i32.const 200
              i32.add
              call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
              local.get 2
              local.get 2
              i32.load offset=36
              local.tee 7
              i32.store offset=188
              local.get 2
              local.get 2
              i32.load offset=32
              local.tee 5
              i32.store offset=184
              block ;; label = @6
                block ;; label = @7
                  local.get 2
                  i32.load8_u offset=152
                  i32.const 1
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 5
                  local.get 5
                  i32.load
                  i32.const -1
                  i32.add
                  local.tee 1
                  i32.store
                  local.get 1
                  br_if 1 (;@6;)
                  local.get 2
                  i32.const 184
                  i32.add
                  call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                  br 1 (;@6;)
                end
                local.get 5
                i32.eqz
                br_if 0 (;@6;)
                local.get 2
                i32.const 235
                i32.const 1
                local.get 5
                local.get 7
                i32.const 1065201
                i32.const 128
                call $<nanvm_lib::naive::function::Function>::new
                local.tee 5
                i32.store offset=140
                local.get 2
                i32.const 7
                i32.store8 offset=136
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    local.get 1
                                    i32.load8_u
                                    local.tee 8
                                    br_table 6 (;@10;) 6 (;@10;) 0 (;@16;) 1 (;@15;) 2 (;@14;) 3 (;@13;) 4 (;@12;) 5 (;@11;) 6 (;@10;)
                                  end
                                  local.get 1
                                  i64.load offset=8
                                  local.set 4
                                  br 8 (;@7;)
                                end
                                local.get 1
                                i32.load offset=4
                                local.tee 7
                                local.get 7
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 9
                                i32.store
                                local.get 9
                                i32.eqz
                                br_if 13 (;@1;)
                                br 6 (;@8;)
                              end
                              local.get 1
                              i32.load offset=4
                              local.tee 7
                              local.get 7
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 9
                              i32.store
                              local.get 9
                              i32.eqz
                              br_if 12 (;@1;)
                              local.get 1
                              i64.load8_u offset=12
                              i64.const 32
                              i64.shl
                              local.get 1
                              i64.load32_u offset=8
                              i64.or
                              local.set 4
                              br 6 (;@7;)
                            end
                            local.get 1
                            i32.load offset=4
                            local.tee 7
                            local.get 7
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 9
                            i32.store
                            local.get 9
                            i32.eqz
                            br_if 11 (;@1;)
                            br 4 (;@8;)
                          end
                          local.get 1
                          i32.load offset=4
                          local.tee 7
                          local.get 7
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 9
                          i32.store
                          local.get 9
                          i32.eqz
                          br_if 10 (;@1;)
                          br 3 (;@8;)
                        end
                        local.get 1
                        i32.load offset=4
                        local.tee 7
                        local.get 7
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 9
                        i32.store
                        local.get 9
                        i32.eqz
                        br_if 9 (;@1;)
                        br 1 (;@9;)
                      end
                      local.get 1
                      i32.load8_u offset=1
                      local.set 9
                    end
                    br 1 (;@7;)
                  end
                  local.get 1
                  i64.load32_u offset=8
                  local.set 4
                end
                local.get 2
                i32.const 0
                i32.store8 offset=152
                local.get 2
                local.get 4
                i64.store offset=216
                local.get 2
                local.get 7
                i32.store offset=212
                local.get 2
                local.get 9
                i32.store8 offset=209
                local.get 2
                local.get 8
                i32.store8 offset=208
                local.get 2
                i64.const 4294967296
                i64.store offset=200
                local.get 2
                local.get 2
                i32.const 152
                i32.add
                i32.store offset=224
                local.get 2
                i32.const 24
                i32.add
                local.get 2
                i32.const 200
                i32.add
                call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                local.get 2
                local.get 2
                i32.load offset=28
                local.tee 8
                i32.store offset=188
                local.get 2
                local.get 2
                i32.load offset=24
                local.tee 7
                i32.store offset=184
                block ;; label = @7
                  block ;; label = @8
                    local.get 2
                    i32.load8_u offset=152
                    i32.const 1
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 7
                    local.get 7
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 1
                    i32.store
                    local.get 1
                    br_if 1 (;@7;)
                    local.get 2
                    i32.const 184
                    i32.add
                    call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                    br 1 (;@7;)
                  end
                  local.get 7
                  i32.eqz
                  br_if 0 (;@7;)
                  local.get 2
                  i32.const 236
                  i32.const 1
                  local.get 7
                  local.get 8
                  i32.const 1065329
                  i32.const 175
                  call $<nanvm_lib::naive::function::Function>::new
                  local.tee 7
                  i32.store offset=156
                  local.get 2
                  i32.const 7
                  i32.store8 offset=152
                  local.get 2
                  i32.const 0
                  i32.store16 offset=180
                  local.get 2
                  i32.const 1064562
                  i32.store offset=176
                  local.get 2
                  i32.const 1064555
                  i32.store offset=172
                  local.get 2
                  i32.const 200
                  i32.add
                  local.get 2
                  i32.const 172
                  i32.add
                  call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        local.get 2
                        i32.load8_u offset=200
                        local.tee 8
                        i32.const 255
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 2
                        i32.load offset=208
                        local.set 9
                        local.get 2
                        i32.load offset=204
                        local.set 10
                        local.get 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 8
                        i32.store
                        local.get 8
                        i32.eqz
                        br_if 9 (;@1;)
                        local.get 6
                        local.get 6
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 8
                        i32.store
                        local.get 8
                        i32.eqz
                        br_if 9 (;@1;)
                        local.get 5
                        local.get 5
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 8
                        i32.store
                        local.get 8
                        i32.eqz
                        br_if 9 (;@1;)
                        local.get 7
                        local.get 7
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 8
                        i32.store
                        local.get 8
                        i32.eqz
                        br_if 9 (;@1;)
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        local.get 1
                                        i32.load8_u
                                        local.tee 11
                                        br_table 6 (;@12;) 6 (;@12;) 0 (;@18;) 1 (;@17;) 2 (;@16;) 3 (;@15;) 4 (;@14;) 5 (;@13;) 6 (;@12;)
                                      end
                                      local.get 1
                                      i64.load offset=8
                                      local.set 4
                                      br 9 (;@8;)
                                    end
                                    local.get 1
                                    i32.load offset=4
                                    local.tee 8
                                    local.get 8
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 12
                                    i32.store
                                    local.get 12
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    br 7 (;@9;)
                                  end
                                  local.get 1
                                  i32.load offset=4
                                  local.tee 8
                                  local.get 8
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 12
                                  i32.store
                                  local.get 12
                                  i32.eqz
                                  br_if 14 (;@1;)
                                  local.get 1
                                  i64.load8_u offset=12
                                  i64.const 32
                                  i64.shl
                                  local.get 1
                                  i64.load32_u offset=8
                                  i64.or
                                  local.set 4
                                  br 7 (;@8;)
                                end
                                local.get 1
                                i32.load offset=4
                                local.tee 8
                                local.get 8
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 12
                                i32.store
                                local.get 12
                                i32.eqz
                                br_if 13 (;@1;)
                                br 5 (;@9;)
                              end
                              local.get 1
                              i32.load offset=4
                              local.tee 8
                              local.get 8
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 12
                              i32.store
                              local.get 12
                              i32.eqz
                              br_if 12 (;@1;)
                              br 4 (;@9;)
                            end
                            local.get 1
                            i32.load offset=4
                            local.tee 8
                            local.get 8
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 12
                            i32.store
                            local.get 12
                            i32.eqz
                            br_if 11 (;@1;)
                            br 1 (;@11;)
                          end
                          local.get 1
                          i32.load8_u offset=1
                          local.set 12
                        end
                        br 2 (;@8;)
                      end
                      local.get 2
                      local.get 2
                      i32.load8_u offset=203
                      i32.store8 offset=187
                      local.get 2
                      local.get 2
                      i32.load16_u offset=201 align=1
                      i32.store16 offset=185 align=1
                      local.get 2
                      local.get 2
                      i32.load offset=212
                      i32.store offset=196
                      local.get 2
                      local.get 2
                      i64.load offset=204 align=4
                      i64.store offset=188 align=4
                      local.get 2
                      local.get 8
                      i32.store8 offset=184
                      i32.const 1055372
                      i32.const 43
                      local.get 2
                      i32.const 184
                      i32.add
                      i32.const 1055356
                      i32.const 1055416
                      call $core::result::unwrap_failed
                      unreachable
                    end
                    local.get 1
                    i64.load32_u offset=8
                    local.set 4
                  end
                  local.get 2
                  i32.const 0
                  i32.store8 offset=172
                  local.get 2
                  local.get 4
                  i64.store offset=280
                  local.get 2
                  local.get 8
                  i32.store offset=276
                  local.get 2
                  local.get 12
                  i32.store8 offset=273
                  local.get 2
                  local.get 11
                  i32.store8 offset=272
                  local.get 2
                  i64.const 0
                  i64.store offset=264
                  local.get 2
                  local.get 7
                  i32.store offset=260
                  local.get 2
                  i32.const 7
                  i32.store8 offset=256
                  local.get 2
                  i64.const 0
                  i64.store offset=248
                  local.get 2
                  local.get 5
                  i32.store offset=244
                  local.get 2
                  i32.const 7
                  i32.store8 offset=240
                  local.get 2
                  i64.const 0
                  i64.store offset=232
                  local.get 2
                  local.get 6
                  i32.store offset=228
                  local.get 2
                  i32.const 7
                  i32.store8 offset=224
                  local.get 2
                  i64.const 0
                  i64.store offset=216
                  local.get 2
                  local.get 3
                  i32.store offset=212
                  local.get 2
                  i32.const 7
                  i32.store8 offset=208
                  local.get 2
                  i64.const 21474836480
                  i64.store offset=200
                  local.get 2
                  local.get 2
                  i32.const 172
                  i32.add
                  i32.store offset=288
                  local.get 2
                  i32.const 16
                  i32.add
                  local.get 2
                  i32.const 200
                  i32.add
                  call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 5>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                  local.get 2
                  local.get 2
                  i32.load offset=20
                  local.tee 3
                  i32.store offset=188
                  local.get 2
                  local.get 2
                  i32.load offset=16
                  local.tee 5
                  i32.store offset=184
                  block ;; label = @8
                    block ;; label = @9
                      local.get 2
                      i32.load8_u offset=172
                      i32.const 1
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 5
                      local.get 5
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 1
                      i32.store
                      local.get 1
                      br_if 1 (;@8;)
                      local.get 2
                      i32.const 184
                      i32.add
                      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                      br 1 (;@8;)
                    end
                    local.get 5
                    i32.eqz
                    br_if 0 (;@8;)
                    i32.const 237
                    i32.const 0
                    local.get 5
                    local.get 3
                    i32.const 1065504
                    i32.const 127
                    call $<nanvm_lib::naive::function::Function>::new
                    local.set 5
                    local.get 2
                    i32.const 0
                    i32.store8 offset=172
                    local.get 2
                    local.get 5
                    i32.store offset=220
                    local.get 2
                    i32.const 7
                    i32.store8 offset=216
                    local.get 2
                    local.get 9
                    i32.store offset=212
                    local.get 2
                    local.get 10
                    i32.store offset=208
                    local.get 2
                    i64.const 4294967296
                    i64.store offset=200
                    local.get 2
                    local.get 2
                    i32.const 172
                    i32.add
                    i32.store offset=232
                    local.get 2
                    i32.const 8
                    i32.add
                    local.get 2
                    i32.const 200
                    i32.add
                    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 1>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
                    local.get 2
                    local.get 2
                    i32.load offset=12
                    local.tee 3
                    i32.store offset=188
                    local.get 2
                    local.get 2
                    i32.load offset=8
                    local.tee 5
                    i32.store offset=184
                    block ;; label = @9
                      block ;; label = @10
                        local.get 2
                        i32.load8_u offset=172
                        i32.const 1
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 5
                        local.get 5
                        i32.load
                        i32.const -1
                        i32.add
                        local.tee 1
                        i32.store
                        local.get 1
                        br_if 1 (;@9;)
                        local.get 2
                        i32.const 184
                        i32.add
                        call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
                        br 1 (;@9;)
                      end
                      local.get 5
                      i32.eqz
                      br_if 0 (;@9;)
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
                      i32.const 152
                      i32.add
                      call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                      local.get 2
                      i32.const 136
                      i32.add
                      call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                      local.get 2
                      i32.const 120
                      i32.add
                      call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                      local.get 2
                      i32.const 104
                      i32.add
                      call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                      local.get 2
                      i32.const 88
                      i32.add
                      call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                      local.get 2
                      i32.const 72
                      i32.add
                      call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                      local.get 1
                      call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                      local.get 2
                      i32.const 304
                      i32.add
                      global.set $__stack_pointer
                      return
                    end
                    i32.const 1053928
                    i32.const 43
                    local.get 2
                    i32.const 303
                    i32.add
                    i32.const 1053912
                    i32.const 1053972
                    call $core::result::unwrap_failed
                    unreachable
                  end
                  i32.const 1053928
                  i32.const 43
                  local.get 2
                  i32.const 303
                  i32.add
                  i32.const 1053912
                  i32.const 1053972
                  call $core::result::unwrap_failed
                  unreachable
                end
                i32.const 1053928
                i32.const 43
                local.get 2
                i32.const 303
                i32.add
                i32.const 1053912
                i32.const 1053972
                call $core::result::unwrap_failed
                unreachable
              end
              i32.const 1053928
              i32.const 43
              local.get 2
              i32.const 303
              i32.add
              i32.const 1053912
              i32.const 1053972
              call $core::result::unwrap_failed
              unreachable
            end
            i32.const 1053928
            i32.const 43
            local.get 2
            i32.const 303
            i32.add
            i32.const 1053912
            i32.const 1053972
            call $core::result::unwrap_failed
            unreachable
          end
          i32.const 1053928
          i32.const 43
          local.get 2
          i32.const 303
          i32.add
          i32.const 1053912
          i32.const 1053972
          call $core::result::unwrap_failed
          unreachable
        end
        i32.const 1053928
        i32.const 43
        local.get 2
        i32.const 303
        i32.add
        i32.const 1053912
        i32.const 1053972
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1053928
      i32.const 43
      local.get 2
      i32.const 303
      i32.add
      i32.const 1053912
      i32.const 1053972
      call $core::result::unwrap_failed
      unreachable
    end
    unreachable
  )
  (func $"<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;694;) (type 3) (param i32 i32 i32 i32)
    (local i32)
    global.get $__stack_pointer
    i32.const 64
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 4
    local.get 3
    i32.store offset=4
    local.get 4
    local.get 2
    i32.store
    local.get 4
    i32.const 32
    i32.add
    local.get 4
    i32.const 0
    call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
    local.get 4
    i64.const 4676867129306251264
    i64.store offset=56
    local.get 4
    i32.const 2
    i32.store8 offset=48
    local.get 4
    i32.const 8
    i32.add
    local.get 4
    i32.const 32
    i32.add
    local.get 4
    i32.const 48
    i32.add
    call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::arith::Mul>::mul>"
    local.get 4
    i32.const 16
    i32.add
    local.set 3
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          local.get 4
          i64.load offset=8
          i64.const 1
          i64.ne
          br_if 0 (;@3;)
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
          i32.load
          local.tee 0
          local.get 0
          i32.load
          i32.const -1
          i32.add
          local.tee 0
          i32.store
          local.get 0
          i32.eqz
          br_if 1 (;@2;)
          br 2 (;@1;)
        end
        local.get 4
        local.get 3
        i64.load offset=8
        i64.store offset=40
        local.get 4
        local.get 3
        i64.load
        i64.store offset=32
        local.get 4
        i64.const 4746794007244308480
        i64.store offset=56
        local.get 4
        i32.const 2
        i32.store8 offset=48
        local.get 0
        local.get 4
        i32.const 32
        i32.add
        local.get 4
        i32.const 48
        i32.add
        call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::arith::Rem>::rem>"
        local.get 4
        i32.load
        local.tee 0
        local.get 0
        i32.load
        i32.const -1
        i32.add
        local.tee 0
        i32.store
        local.get 0
        br_if 1 (;@1;)
      end
      local.get 4
      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
    end
    local.get 4
    i32.const 64
    i32.add
    global.set $__stack_pointer
  )
  (func $"<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#1} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;695;) (type 3) (param i32 i32 i32 i32)
    (local i32 i64 i32 i64 i64 i64)
    global.get $__stack_pointer
    i32.const 512
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 1
    i32.load
    local.set 1
    local.get 4
    local.get 3
    i32.store offset=52
    local.get 4
    local.get 2
    i32.store offset=48
    local.get 4
    i32.const 424
    i32.add
    local.get 4
    i32.const 48
    i32.add
    i32.const 0
    call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
    local.get 4
    i64.const 4607182418800017408
    i64.store offset=464
    local.get 4
    i32.const 2
    i32.store8 offset=456
    local.get 4
    i32.const 424
    i32.add
    local.get 4
    i32.const 456
    i32.add
    call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::cmp::PartialEq>::eq"
    local.set 3
    local.get 4
    i32.const 456
    i32.add
    call $"#func607 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
    local.get 4
    i32.const 424
    i32.add
    call $"#func607 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
    local.get 4
    local.get 3
    i32.store8 offset=313
    local.get 4
    i32.const 1
    i32.store8 offset=312
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
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  local.get 4
                                  i32.const 312
                                  i32.add
                                  call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::boolean_coercion::BooleanCoercion>
                                  br_if 0 (;@15;)
                                  local.get 4
                                  i32.const 392
                                  i32.add
                                  local.get 4
                                  i32.const 48
                                  i32.add
                                  i32.const 0
                                  call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
                                  local.get 4
                                  i64.const 4607182418800017408
                                  i64.store offset=432
                                  local.get 4
                                  i32.const 2
                                  i32.store8 offset=424
                                  local.get 4
                                  i32.const 456
                                  i32.add
                                  local.get 4
                                  i32.const 392
                                  i32.add
                                  local.get 4
                                  i32.const 424
                                  i32.add
                                  call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::bit::Shr>::shr>"
                                  local.get 4
                                  local.get 4
                                  i64.load offset=464
                                  i64.store offset=360
                                  local.get 4
                                  local.get 4
                                  i64.load offset=472
                                  i64.store offset=368
                                  local.get 4
                                  i32.load offset=456
                                  i32.eqz
                                  br_if 1 (;@14;)
                                  local.get 0
                                  local.get 4
                                  i64.load offset=368
                                  i64.store offset=16
                                  local.get 0
                                  local.get 4
                                  i64.load offset=360
                                  i64.store offset=8
                                  local.get 0
                                  i64.const 1
                                  i64.store
                                  br 8 (;@7;)
                                end
                                local.get 4
                                i32.const 456
                                i32.add
                                i32.const 8
                                i32.add
                                local.get 4
                                i32.const 48
                                i32.add
                                i32.const 1
                                call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
                                local.get 4
                                i32.const 0
                                i32.store8 offset=328
                                local.get 4
                                i64.const 4294967296
                                i64.store offset=456
                                local.get 4
                                local.get 4
                                i32.const 328
                                i32.add
                                i32.store offset=480
                                local.get 4
                                i32.const 16
                                i32.add
                                local.get 4
                                i32.const 456
                                i32.add
                                call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                                local.get 4
                                local.get 4
                                i32.load offset=20
                                local.tee 2
                                i32.store offset=396
                                local.get 4
                                local.get 4
                                i32.load offset=16
                                local.tee 3
                                i32.store offset=392
                                block ;; label = @15
                                  local.get 4
                                  i32.load8_u offset=328
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
                                  br_if 14 (;@1;)
                                  local.get 4
                                  i32.const 392
                                  i32.add
                                  call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                                  br 14 (;@1;)
                                end
                                local.get 3
                                i32.eqz
                                br_if 13 (;@1;)
                                local.get 4
                                local.get 2
                                i32.store offset=368
                                local.get 4
                                local.get 3
                                i32.store offset=364
                                local.get 4
                                i32.const 6
                                i32.store8 offset=360
                                local.get 1
                                i32.load offset=16
                                i32.eqz
                                br_if 1 (;@13;)
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        block ;; label = @19
                                          block ;; label = @20
                                            block ;; label = @21
                                              block ;; label = @22
                                                local.get 1
                                                i32.load offset=12
                                                local.tee 1
                                                i32.load8_u offset=8
                                                local.tee 2
                                                br_table 6 (;@16;) 6 (;@16;) 0 (;@22;) 1 (;@21;) 2 (;@20;) 3 (;@19;) 4 (;@18;) 5 (;@17;) 6 (;@16;)
                                              end
                                              local.get 1
                                              i64.load offset=16
                                              local.set 5
                                              br 13 (;@8;)
                                            end
                                            local.get 1
                                            i32.load offset=12
                                            local.tee 3
                                            local.get 3
                                            i32.load
                                            i32.const 1
                                            i32.add
                                            local.tee 6
                                            i32.store
                                            local.get 6
                                            i32.eqz
                                            br_if 10 (;@10;)
                                            br 11 (;@9;)
                                          end
                                          local.get 1
                                          i32.load offset=12
                                          local.tee 3
                                          local.get 3
                                          i32.load
                                          i32.const 1
                                          i32.add
                                          local.tee 6
                                          i32.store
                                          local.get 6
                                          i32.eqz
                                          br_if 9 (;@10;)
                                          local.get 1
                                          i64.load8_u offset=20
                                          i64.const 32
                                          i64.shl
                                          local.get 1
                                          i64.load32_u offset=16
                                          i64.or
                                          local.set 5
                                          br 11 (;@8;)
                                        end
                                        local.get 1
                                        i32.load offset=12
                                        local.tee 3
                                        local.get 3
                                        i32.load
                                        i32.const 1
                                        i32.add
                                        local.tee 6
                                        i32.store
                                        local.get 6
                                        br_if 9 (;@9;)
                                        br 8 (;@10;)
                                      end
                                      local.get 1
                                      i32.load offset=12
                                      local.tee 3
                                      local.get 3
                                      i32.load
                                      i32.const 1
                                      i32.add
                                      local.tee 6
                                      i32.store
                                      local.get 6
                                      br_if 8 (;@9;)
                                      br 7 (;@10;)
                                    end
                                    local.get 1
                                    i32.load offset=12
                                    local.tee 3
                                    local.get 3
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 1
                                    i32.store
                                    local.get 1
                                    i32.eqz
                                    br_if 6 (;@10;)
                                    br 1 (;@15;)
                                  end
                                  local.get 1
                                  i32.load8_u offset=9
                                  local.set 1
                                end
                                br 6 (;@8;)
                              end
                              local.get 4
                              local.get 4
                              i64.load offset=368
                              i64.store offset=88
                              local.get 4
                              local.get 4
                              i64.load offset=360
                              i64.store offset=80
                              local.get 1
                              local.get 1
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 3
                              i32.store
                              local.get 3
                              i32.eqz
                              br_if 3 (;@10;)
                              local.get 4
                              local.get 1
                              i32.store offset=204
                              local.get 4
                              i32.const 7
                              i32.store8 offset=200
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        block ;; label = @19
                                          block ;; label = @20
                                            block ;; label = @21
                                              local.get 4
                                              i32.load8_u offset=80
                                              local.tee 2
                                              br_table 6 (;@15;) 6 (;@15;) 0 (;@21;) 1 (;@20;) 2 (;@19;) 3 (;@18;) 4 (;@17;) 5 (;@16;) 6 (;@15;)
                                            end
                                            local.get 4
                                            i64.load offset=88
                                            local.set 5
                                            br 9 (;@11;)
                                          end
                                          local.get 4
                                          i32.load offset=84
                                          local.tee 3
                                          local.get 3
                                          i32.load
                                          i32.const 1
                                          i32.add
                                          local.tee 6
                                          i32.store
                                          local.get 6
                                          i32.eqz
                                          br_if 9 (;@10;)
                                          br 7 (;@12;)
                                        end
                                        local.get 4
                                        i32.load offset=84
                                        local.tee 3
                                        local.get 3
                                        i32.load
                                        i32.const 1
                                        i32.add
                                        local.tee 6
                                        i32.store
                                        local.get 6
                                        i32.eqz
                                        br_if 8 (;@10;)
                                        local.get 4
                                        i64.load8_u offset=92
                                        i64.const 32
                                        i64.shl
                                        local.get 4
                                        i64.load32_u offset=88
                                        i64.or
                                        local.set 5
                                        br 7 (;@11;)
                                      end
                                      local.get 4
                                      i32.load offset=84
                                      local.tee 3
                                      local.get 3
                                      i32.load
                                      i32.const 1
                                      i32.add
                                      local.tee 6
                                      i32.store
                                      local.get 6
                                      i32.eqz
                                      br_if 7 (;@10;)
                                      br 5 (;@12;)
                                    end
                                    local.get 4
                                    i32.load offset=84
                                    local.tee 3
                                    local.get 3
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 6
                                    i32.store
                                    local.get 6
                                    i32.eqz
                                    br_if 6 (;@10;)
                                    br 4 (;@12;)
                                  end
                                  local.get 4
                                  i32.load offset=84
                                  local.tee 3
                                  local.get 3
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 6
                                  i32.store
                                  local.get 6
                                  i32.eqz
                                  br_if 5 (;@10;)
                                  br 1 (;@14;)
                                end
                                local.get 4
                                i32.load8_u offset=81
                                local.set 6
                              end
                              br 2 (;@11;)
                            end
                            i32.const 0
                            i32.const 0
                            i32.const 1062708
                            call $core::panicking::panic_bounds_check
                            unreachable
                          end
                          local.get 4
                          i64.load32_u offset=88
                          local.set 5
                        end
                        local.get 4
                        i32.const 440
                        i32.add
                        local.get 4
                        i32.const 48
                        i32.add
                        i32.const 1
                        call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
                        local.get 4
                        local.get 3
                        i32.store offset=428
                        local.get 4
                        local.get 6
                        i32.store8 offset=425
                        local.get 4
                        local.get 2
                        i32.store8 offset=424
                        local.get 4
                        local.get 5
                        i64.store offset=432
                        local.get 4
                        i32.const 0
                        i32.store8 offset=232
                        local.get 4
                        i64.const 8589934592
                        i64.store offset=456
                        local.get 4
                        local.get 4
                        i64.load offset=424
                        i64.store offset=464
                        local.get 4
                        local.get 5
                        i64.store offset=472
                        local.get 4
                        local.get 4
                        i64.load offset=440
                        i64.store offset=480
                        local.get 4
                        local.get 4
                        i64.load offset=448
                        i64.store offset=488
                        local.get 4
                        local.get 4
                        i32.const 232
                        i32.add
                        i32.store offset=496
                        local.get 4
                        i32.const 40
                        i32.add
                        local.get 4
                        i32.const 456
                        i32.add
                        call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                        local.get 4
                        local.get 4
                        i32.load offset=44
                        local.tee 2
                        i32.store offset=332
                        local.get 4
                        local.get 4
                        i32.load offset=40
                        local.tee 3
                        i32.store offset=328
                        block ;; label = @11
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=232
                            i32.const 1
                            i32.ne
                            br_if 0 (;@12;)
                            local.get 3
                            local.get 3
                            i32.load
                            i32.const -1
                            i32.add
                            local.tee 0
                            i32.store
                            local.get 0
                            br_if 1 (;@11;)
                            local.get 4
                            i32.const 328
                            i32.add
                            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                            br 1 (;@11;)
                          end
                          local.get 3
                          i32.eqz
                          br_if 0 (;@11;)
                          local.get 4
                          local.get 2
                          i32.store offset=336
                          local.get 4
                          local.get 3
                          i32.store offset=332
                          local.get 4
                          i32.const 6
                          i32.store8 offset=328
                          local.get 4
                          i32.const 456
                          i32.add
                          local.get 4
                          i32.const 200
                          i32.add
                          local.get 4
                          i32.const 328
                          i32.add
                          call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
                          local.get 4
                          local.get 4
                          i64.load offset=464
                          i64.store offset=272
                          local.get 4
                          local.get 4
                          i64.load offset=472
                          i64.store offset=280
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                local.get 4
                                i64.load offset=456
                                i64.const 1
                                i64.ne
                                br_if 0 (;@14;)
                                local.get 0
                                local.get 4
                                i64.load offset=280
                                i64.store offset=16
                                local.get 0
                                local.get 4
                                i64.load offset=272
                                i64.store offset=8
                                local.get 0
                                i64.const 1
                                i64.store
                                br 1 (;@13;)
                              end
                              local.get 4
                              local.get 4
                              i64.load offset=280
                              i64.store offset=408
                              local.get 4
                              local.get 4
                              i64.load offset=272
                              i64.store offset=400
                              local.get 4
                              i64.const 1
                              i64.store offset=392
                              local.get 4
                              i32.const 360
                              i32.add
                              local.get 4
                              i32.const 392
                              i32.add
                              call $"nanvm_lib::vm::unstable::spread_array::<nanvm_lib::naive::Naive, [nanvm_lib::vm::unstable::ArrayItem<nanvm_lib::naive::Naive>; 1]>"
                              local.get 4
                              local.get 4
                              i64.load offset=368
                              i64.store offset=296
                              local.get 4
                              local.get 4
                              i64.load offset=376
                              i64.store offset=304
                              block ;; label = @14
                                local.get 4
                                i64.load offset=360
                                i64.const 1
                                i64.ne
                                br_if 0 (;@14;)
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
                                br 1 (;@13;)
                              end
                              local.get 4
                              local.get 4
                              i64.load offset=304
                              i64.store offset=104
                              local.get 4
                              local.get 4
                              i64.load offset=296
                              i64.store offset=96
                              local.get 1
                              local.get 1
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 3
                              i32.store
                              local.get 3
                              i32.eqz
                              br_if 3 (;@10;)
                              local.get 4
                              local.get 1
                              i32.store offset=300
                              local.get 4
                              i32.const 7
                              i32.store8 offset=296
                              local.get 4
                              i32.const 360
                              i32.add
                              local.get 4
                              i32.const 48
                              i32.add
                              i32.const 0
                              call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        block ;; label = @19
                                          block ;; label = @20
                                            block ;; label = @21
                                              block ;; label = @22
                                                block ;; label = @23
                                                  local.get 4
                                                  i32.load8_u offset=80
                                                  local.tee 2
                                                  br_table 6 (;@17;) 6 (;@17;) 0 (;@23;) 1 (;@22;) 2 (;@21;) 3 (;@20;) 4 (;@19;) 5 (;@18;) 6 (;@17;)
                                                end
                                                local.get 4
                                                i64.load offset=88
                                                local.set 5
                                                br 8 (;@14;)
                                              end
                                              local.get 4
                                              i32.load offset=84
                                              local.tee 3
                                              local.get 3
                                              i32.load
                                              i32.const 1
                                              i32.add
                                              local.tee 1
                                              i32.store
                                              local.get 1
                                              i32.eqz
                                              br_if 11 (;@10;)
                                              br 6 (;@15;)
                                            end
                                            local.get 4
                                            i32.load offset=84
                                            local.tee 3
                                            local.get 3
                                            i32.load
                                            i32.const 1
                                            i32.add
                                            local.tee 1
                                            i32.store
                                            local.get 1
                                            i32.eqz
                                            br_if 10 (;@10;)
                                            local.get 4
                                            i64.load8_u offset=92
                                            i64.const 32
                                            i64.shl
                                            local.get 4
                                            i64.load32_u offset=88
                                            i64.or
                                            local.set 5
                                            br 6 (;@14;)
                                          end
                                          local.get 4
                                          i32.load offset=84
                                          local.tee 3
                                          local.get 3
                                          i32.load
                                          i32.const 1
                                          i32.add
                                          local.tee 1
                                          i32.store
                                          local.get 1
                                          i32.eqz
                                          br_if 9 (;@10;)
                                          br 4 (;@15;)
                                        end
                                        local.get 4
                                        i32.load offset=84
                                        local.tee 3
                                        local.get 3
                                        i32.load
                                        i32.const 1
                                        i32.add
                                        local.tee 1
                                        i32.store
                                        local.get 1
                                        i32.eqz
                                        br_if 8 (;@10;)
                                        br 3 (;@15;)
                                      end
                                      local.get 4
                                      i32.load offset=84
                                      local.tee 3
                                      local.get 3
                                      i32.load
                                      i32.const 1
                                      i32.add
                                      local.tee 1
                                      i32.store
                                      local.get 1
                                      i32.eqz
                                      br_if 7 (;@10;)
                                      br 1 (;@16;)
                                    end
                                    local.get 4
                                    i32.load8_u offset=81
                                    local.set 6
                                  end
                                  br 1 (;@14;)
                                end
                                local.get 4
                                i64.load32_u offset=88
                                local.set 5
                              end
                              local.get 4
                              i32.const 176
                              i32.add
                              i32.const 8
                              i32.add
                              local.set 1
                              local.get 4
                              local.get 5
                              i64.store offset=464
                              local.get 4
                              local.get 3
                              i32.store offset=460
                              local.get 4
                              local.get 6
                              i32.store8 offset=457
                              local.get 4
                              local.get 2
                              i32.store8 offset=456
                              local.get 4
                              i32.const 176
                              i32.add
                              local.get 4
                              i32.const 360
                              i32.add
                              local.get 4
                              i32.const 456
                              i32.add
                              call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::arith::Sub>::sub>"
                              block ;; label = @14
                                block ;; label = @15
                                  local.get 4
                                  i64.load offset=176
                                  i64.const 1
                                  i64.ne
                                  br_if 0 (;@15;)
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
                                  i32.const 296
                                  i32.add
                                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                                  br 1 (;@14;)
                                end
                                local.get 4
                                local.get 1
                                i64.load offset=8
                                i64.store offset=208
                                local.get 4
                                local.get 1
                                i64.load
                                i64.store offset=200
                                local.get 4
                                i32.const 360
                                i32.add
                                local.get 4
                                i32.const 96
                                i32.add
                                call $"#func721 <nanvm_lib::naive::Naive as core::clone::Clone>::clone"
                                local.get 4
                                i64.const 4607182418800017408
                                i64.store offset=464
                                local.get 4
                                i32.const 2
                                i32.store8 offset=456
                                local.get 4
                                i32.const 328
                                i32.add
                                local.get 4
                                i32.const 360
                                i32.add
                                local.get 4
                                i32.const 456
                                i32.add
                                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                                block ;; label = @15
                                  local.get 4
                                  i32.load8_u offset=328
                                  i32.const 255
                                  i32.ne
                                  br_if 0 (;@15;)
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
                                  i32.const 200
                                  i32.add
                                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                                  local.get 4
                                  i32.const 296
                                  i32.add
                                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                                  br 1 (;@14;)
                                end
                                local.get 4
                                i32.const 152
                                i32.add
                                i32.const 8
                                i32.add
                                local.set 3
                                local.get 4
                                local.get 4
                                i64.load offset=352
                                i64.store offset=480
                                local.get 4
                                local.get 4
                                i64.load offset=344
                                i64.store offset=472
                                local.get 4
                                local.get 4
                                i64.load offset=336
                                i64.store offset=464
                                local.get 4
                                local.get 4
                                i64.load offset=328
                                i64.store offset=456
                                local.get 4
                                i32.const 440
                                i32.add
                                local.get 4
                                i32.const 456
                                i32.add
                                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::read
                                local.get 4
                                local.get 1
                                i64.load
                                i64.store offset=424
                                local.get 4
                                local.get 1
                                i64.load offset=8
                                i64.store offset=432
                                local.get 4
                                i32.const 32
                                i32.add
                                local.get 4
                                i32.const 424
                                i32.add
                                call $"<nanvm_lib::naive::container::Container<(), nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as nanvm_lib::vm::internal::icontainer::IContainer<nanvm_lib::naive::Naive>>::new_ok::<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>; 2]>"
                                local.get 4
                                i32.const 6
                                i32.store8 offset=272
                                local.get 4
                                local.get 4
                                i64.load offset=32
                                i64.store offset=276 align=4
                                local.get 4
                                i32.const 152
                                i32.add
                                local.get 4
                                i32.const 296
                                i32.add
                                local.get 4
                                i32.const 272
                                i32.add
                                call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
                                block ;; label = @15
                                  local.get 4
                                  i64.load offset=152
                                  i64.const 1
                                  i64.ne
                                  br_if 0 (;@15;)
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
                                  br 1 (;@14;)
                                end
                                local.get 4
                                i32.const 128
                                i32.add
                                i32.const 8
                                i32.add
                                local.set 1
                                local.get 4
                                local.get 3
                                i64.load offset=8
                                i64.store offset=408
                                local.get 4
                                local.get 3
                                i64.load
                                i64.store offset=400
                                local.get 4
                                i64.const 1
                                i64.store offset=392
                                local.get 4
                                i32.const 128
                                i32.add
                                local.get 4
                                i32.const 392
                                i32.add
                                call $"nanvm_lib::vm::unstable::spread_array::<nanvm_lib::naive::Naive, [nanvm_lib::vm::unstable::ArrayItem<nanvm_lib::naive::Naive>; 1]>"
                                block ;; label = @15
                                  local.get 4
                                  i64.load offset=128
                                  i64.const 1
                                  i64.ne
                                  br_if 0 (;@15;)
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
                                  br 1 (;@14;)
                                end
                                local.get 4
                                local.get 1
                                i64.load offset=8
                                i64.store offset=120
                                local.get 4
                                local.get 1
                                i64.load
                                i64.store offset=112
                                local.get 4
                                i32.const 392
                                i32.add
                                local.get 4
                                i32.const 96
                                i32.add
                                call $"#func721 <nanvm_lib::naive::Naive as core::clone::Clone>::clone"
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
                                i32.const 392
                                i32.add
                                local.get 4
                                i32.const 424
                                i32.add
                                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                                block ;; label = @15
                                  block ;; label = @16
                                    local.get 4
                                    i32.load8_u offset=360
                                    i32.const 255
                                    i32.ne
                                    br_if 0 (;@16;)
                                    local.get 0
                                    local.get 4
                                    i64.load offset=376
                                    i64.store offset=16
                                    local.get 0
                                    local.get 4
                                    i64.load offset=368
                                    i64.store offset=8
                                    local.get 0
                                    i64.const 1
                                    i64.store
                                    br 1 (;@15;)
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
                                  i32.const 280
                                  i32.add
                                  local.tee 1
                                  local.get 4
                                  i32.const 424
                                  i32.add
                                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::read
                                  local.get 4
                                  i64.const 1
                                  i64.store offset=272
                                  local.get 4
                                  i32.const 296
                                  i32.add
                                  local.get 4
                                  i32.const 112
                                  i32.add
                                  call $"#func721 <nanvm_lib::naive::Naive as core::clone::Clone>::clone"
                                  local.get 4
                                  i64.const 0
                                  i64.store offset=432
                                  local.get 4
                                  i32.const 2
                                  i32.store8 offset=424
                                  local.get 4
                                  i32.const 392
                                  i32.add
                                  local.get 4
                                  i32.const 296
                                  i32.add
                                  local.get 4
                                  i32.const 424
                                  i32.add
                                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                                  block ;; label = @16
                                    local.get 4
                                    i32.load8_u offset=392
                                    i32.const 255
                                    i32.ne
                                    br_if 0 (;@16;)
                                    local.get 0
                                    local.get 4
                                    i64.load offset=408
                                    i64.store offset=16
                                    local.get 0
                                    local.get 4
                                    i64.load offset=400
                                    i64.store offset=8
                                    local.get 0
                                    i64.const 1
                                    i64.store
                                    local.get 1
                                    call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                                    br 1 (;@15;)
                                  end
                                  local.get 4
                                  i32.const 248
                                  i32.add
                                  i32.const 8
                                  i32.add
                                  local.set 1
                                  local.get 4
                                  local.get 4
                                  i64.load offset=416
                                  i64.store offset=448
                                  local.get 4
                                  local.get 4
                                  i64.load offset=408
                                  i64.store offset=440
                                  local.get 4
                                  local.get 4
                                  i64.load offset=400
                                  i64.store offset=432
                                  local.get 4
                                  local.get 4
                                  i64.load offset=392
                                  i64.store offset=424
                                  local.get 4
                                  i32.const 488
                                  i32.add
                                  local.get 4
                                  i32.const 424
                                  i32.add
                                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::read
                                  local.get 4
                                  local.get 4
                                  i64.load offset=272
                                  i64.store offset=456
                                  local.get 4
                                  local.get 4
                                  i64.load offset=280
                                  i64.store offset=464
                                  local.get 4
                                  local.get 4
                                  i64.load offset=288
                                  i64.store offset=472
                                  local.get 4
                                  i64.const 1
                                  i64.store offset=480
                                  local.get 4
                                  i32.const 248
                                  i32.add
                                  local.get 4
                                  i32.const 456
                                  i32.add
                                  call $"nanvm_lib::vm::unstable::spread_array::<nanvm_lib::naive::Naive, [nanvm_lib::vm::unstable::ArrayItem<nanvm_lib::naive::Naive>; 2]>"
                                  block ;; label = @16
                                    local.get 4
                                    i64.load offset=248
                                    i64.const 1
                                    i64.ne
                                    br_if 0 (;@16;)
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
                                    br 1 (;@15;)
                                  end
                                  local.get 4
                                  local.get 1
                                  i64.load offset=8
                                  i64.store offset=240
                                  local.get 4
                                  local.get 1
                                  i64.load
                                  i64.store offset=232
                                  local.get 4
                                  i32.const 272
                                  i32.add
                                  local.get 4
                                  i32.const 112
                                  i32.add
                                  call $"#func721 <nanvm_lib::naive::Naive as core::clone::Clone>::clone"
                                  local.get 4
                                  i64.const 4607182418800017408
                                  i64.store offset=464
                                  local.get 4
                                  i32.const 2
                                  i32.store8 offset=456
                                  local.get 4
                                  i32.const 424
                                  i32.add
                                  local.get 4
                                  i32.const 272
                                  i32.add
                                  local.get 4
                                  i32.const 456
                                  i32.add
                                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                                  local.get 4
                                  i32.load8_u offset=424
                                  i32.const 255
                                  i32.ne
                                  br_if 3 (;@12;)
                                  local.get 0
                                  local.get 4
                                  i64.load offset=440
                                  i64.store offset=16
                                  local.get 0
                                  local.get 4
                                  i64.load offset=432
                                  i64.store offset=8
                                  local.get 0
                                  i64.const 1
                                  i64.store
                                  local.get 4
                                  i32.const 232
                                  i32.add
                                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                                end
                                local.get 4
                                i32.const 112
                                i32.add
                                call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                              end
                              local.get 4
                              i32.const 96
                              i32.add
                              call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                            end
                            local.get 4
                            i32.const 80
                            i32.add
                            call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                            br 5 (;@7;)
                          end
                          local.get 4
                          local.get 4
                          i64.load offset=448
                          i64.store offset=480
                          local.get 4
                          local.get 4
                          i64.load offset=440
                          i64.store offset=472
                          local.get 4
                          local.get 4
                          i64.load offset=432
                          i64.store offset=464
                          local.get 4
                          local.get 4
                          i64.load offset=424
                          i64.store offset=456
                          local.get 4
                          i32.const 216
                          i32.add
                          local.get 4
                          i32.const 456
                          i32.add
                          call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::read
                          local.get 4
                          local.get 1
                          i64.load
                          i64.store offset=200
                          local.get 4
                          local.get 1
                          i64.load offset=8
                          i64.store offset=208
                          local.get 4
                          i32.const 24
                          i32.add
                          local.get 4
                          i32.const 200
                          i32.add
                          call $"<nanvm_lib::naive::container::Container<(), nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as nanvm_lib::vm::internal::icontainer::IContainer<nanvm_lib::naive::Naive>>::new_ok::<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>; 2]>"
                          local.get 0
                          local.get 4
                          i64.load offset=24
                          i64.store offset=12 align=4
                          local.get 0
                          i32.const 6
                          i32.store8 offset=8
                          local.get 0
                          i64.const 0
                          i64.store
                          local.get 4
                          i32.const 112
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.const 96
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.const 80
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          br 6 (;@5;)
                        end
                        i32.const 1053928
                        i32.const 43
                        local.get 4
                        i32.const 511
                        i32.add
                        i32.const 1053912
                        i32.const 1053972
                        call $core::result::unwrap_failed
                        unreachable
                      end
                      unreachable
                    end
                    local.get 1
                    i64.load32_u offset=16
                    local.set 5
                  end
                  local.get 4
                  local.get 5
                  i64.store offset=400
                  local.get 4
                  local.get 3
                  i32.store offset=396
                  local.get 4
                  local.get 1
                  i32.store8 offset=393
                  local.get 4
                  local.get 2
                  i32.store8 offset=392
                  local.get 4
                  i32.const 464
                  i32.add
                  local.get 4
                  i32.const 48
                  i32.add
                  i32.const 1
                  call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
                  local.get 4
                  i32.const 0
                  i32.store8 offset=200
                  local.get 4
                  i64.const 4294967296
                  i64.store offset=456
                  local.get 4
                  local.get 4
                  i32.const 200
                  i32.add
                  i32.store offset=480
                  local.get 4
                  i32.const 8
                  i32.add
                  local.get 4
                  i32.const 456
                  i32.add
                  call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                  local.get 4
                  local.get 4
                  i32.load offset=12
                  local.tee 2
                  i32.store offset=332
                  local.get 4
                  local.get 4
                  i32.load offset=8
                  local.tee 1
                  i32.store offset=328
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=200
                    i32.const 1
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 1
                    local.get 1
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 0
                    i32.store
                    local.get 0
                    br_if 6 (;@2;)
                    local.get 4
                    i32.const 328
                    i32.add
                    call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                    br 6 (;@2;)
                  end
                  local.get 1
                  i32.eqz
                  br_if 5 (;@2;)
                  local.get 4
                  i32.const 56
                  i32.add
                  i32.const 8
                  i32.add
                  local.set 3
                  local.get 4
                  local.get 2
                  i32.store offset=464
                  local.get 4
                  local.get 1
                  i32.store offset=460
                  local.get 4
                  i32.const 6
                  i32.store8 offset=456
                  local.get 4
                  i32.const 56
                  i32.add
                  local.get 4
                  i32.const 392
                  i32.add
                  local.get 4
                  i32.const 456
                  i32.add
                  call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
                  local.get 4
                  i32.load offset=56
                  i32.eqz
                  br_if 1 (;@6;)
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
                  i32.const 360
                  i32.add
                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                end
                local.get 4
                i32.load offset=48
                local.tee 0
                local.get 0
                i32.load
                i32.const -1
                i32.add
                local.tee 0
                i32.store
                local.get 0
                i32.eqz
                br_if 2 (;@4;)
                br 3 (;@3;)
              end
              local.get 4
              local.get 4
              i64.load offset=360
              local.tee 5
              i64.store offset=424
              local.get 4
              local.get 4
              i64.load offset=368
              local.tee 7
              i64.store offset=432
              local.get 4
              local.get 3
              i64.load offset=8
              local.tee 8
              i64.store offset=448
              local.get 4
              local.get 3
              i64.load
              local.tee 9
              i64.store offset=440
              local.get 4
              i32.const 0
              i32.store8 offset=360
              local.get 4
              i64.const 8589934592
              i64.store offset=456
              local.get 4
              local.get 5
              i64.store offset=464
              local.get 4
              local.get 7
              i64.store offset=472
              local.get 4
              local.get 9
              i64.store offset=480
              local.get 4
              local.get 8
              i64.store offset=488
              local.get 4
              local.get 4
              i32.const 360
              i32.add
              i32.store offset=496
              local.get 4
              local.get 4
              i32.const 456
              i32.add
              call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
              local.get 4
              local.get 4
              i32.load offset=4
              local.tee 3
              i32.store offset=396
              local.get 4
              local.get 4
              i32.load
              local.tee 1
              i32.store offset=392
              block ;; label = @6
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
                  local.tee 0
                  i32.store
                  local.get 0
                  br_if 1 (;@6;)
                  local.get 4
                  i32.const 392
                  i32.add
                  call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                  br 1 (;@6;)
                end
                local.get 1
                i32.eqz
                br_if 0 (;@6;)
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
                br 1 (;@5;)
              end
              i32.const 1053928
              i32.const 43
              local.get 4
              i32.const 511
              i32.add
              i32.const 1053912
              i32.const 1053972
              call $core::result::unwrap_failed
              unreachable
            end
            local.get 4
            i32.load offset=48
            local.tee 0
            local.get 0
            i32.load
            i32.const -1
            i32.add
            local.tee 0
            i32.store
            local.get 0
            br_if 1 (;@3;)
          end
          local.get 4
          i32.const 48
          i32.add
          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
        end
        local.get 4
        i32.const 512
        i32.add
        global.set $__stack_pointer
        return
      end
      i32.const 1053928
      i32.const 43
      local.get 4
      i32.const 511
      i32.add
      i32.const 1053912
      i32.const 1053972
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1053928
    i32.const 43
    local.get 4
    i32.const 511
    i32.add
    i32.const 1053912
    i32.const 1053972
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#2} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;696;) (type 3) (param i32 i32 i32 i32)
    (local i32 i64 i32)
    global.get $__stack_pointer
    i32.const 224
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 1
    i32.load
    local.set 1
    local.get 4
    local.get 3
    i32.store offset=44
    local.get 4
    local.get 2
    i32.store offset=40
    local.get 4
    i32.const 120
    i32.add
    local.get 4
    i32.const 40
    i32.add
    i32.const 0
    call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
    block ;; label = @1
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
                            local.tee 3
                            i32.load8_u offset=8
                            local.tee 2
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 3
                          i64.load offset=16
                          local.set 5
                          br 9 (;@2;)
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
                        br_if 9 (;@1;)
                        br 7 (;@3;)
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
                      br_if 8 (;@1;)
                      local.get 3
                      i64.load8_u offset=20
                      i64.const 32
                      i64.shl
                      local.get 3
                      i64.load32_u offset=16
                      i64.or
                      local.set 5
                      br 7 (;@2;)
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
                    br_if 5 (;@3;)
                    br 7 (;@1;)
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
                  br_if 4 (;@3;)
                  br 6 (;@1;)
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
                br_if 5 (;@1;)
                br 1 (;@5;)
              end
              local.get 3
              i32.load8_u offset=9
              local.set 3
            end
            br 2 (;@2;)
          end
          i32.const 0
          i32.const 0
          i32.const 1062708
          call $core::panicking::panic_bounds_check
          unreachable
        end
        local.get 3
        i64.load32_u offset=16
        local.set 5
      end
      local.get 4
      local.get 4
      i64.load offset=128
      i64.store offset=168
      local.get 4
      local.get 4
      i64.load offset=120
      i64.store offset=160
      local.get 4
      i32.const 0
      i32.store8 offset=200
      local.get 4
      local.get 5
      i64.store offset=184
      local.get 4
      local.get 1
      i32.store offset=180
      local.get 4
      local.get 3
      i32.store8 offset=177
      local.get 4
      local.get 2
      i32.store8 offset=176
      local.get 4
      i64.const 8589934592
      i64.store offset=152
      local.get 4
      local.get 4
      i32.const 200
      i32.add
      i32.store offset=192
      local.get 4
      i32.const 32
      i32.add
      local.get 4
      i32.const 152
      i32.add
      call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
      local.get 4
      local.get 4
      i32.load offset=36
      local.tee 3
      i32.store offset=124
      local.get 4
      local.get 4
      i32.load offset=32
      local.tee 1
      i32.store offset=120
      block ;; label = @2
        block ;; label = @3
          local.get 4
          i32.load8_u offset=200
          i32.const 1
          i32.ne
          br_if 0 (;@3;)
          local.get 1
          local.get 1
          i32.load
          i32.const -1
          i32.add
          local.tee 0
          i32.store
          local.get 0
          br_if 1 (;@2;)
          local.get 4
          i32.const 120
          i32.add
          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
          br 1 (;@2;)
        end
        local.get 1
        i32.eqz
        br_if 0 (;@2;)
        local.get 4
        i32.const 238
        i32.const 1
        local.get 1
        local.get 3
        i32.const 1066307
        i32.const 181
        call $<nanvm_lib::naive::function::Function>::new
        local.tee 1
        i32.store offset=52
        local.get 4
        i32.const 7
        i32.store8 offset=48
        local.get 1
        local.get 1
        i32.load
        i32.const 1
        i32.add
        local.tee 3
        i32.store
        local.get 3
        i32.eqz
        br_if 1 (;@1;)
        local.get 4
        local.get 1
        i32.store offset=124
        local.get 4
        i32.const 7
        i32.store8 offset=120
        local.get 4
        i32.const 0
        i32.store8 offset=104
        local.get 4
        i64.const 1
        i64.store offset=160
        local.get 4
        i64.const 1
        i64.store offset=152
        local.get 4
        local.get 4
        i32.const 104
        i32.add
        i32.store offset=168
        local.get 4
        i32.const 24
        i32.add
        local.get 4
        i32.const 152
        i32.add
        call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::once::Once<u64>, core::result::Result<u64, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<u64>>::to_rc_slice"
        local.get 4
        local.get 4
        i32.load offset=28
        local.tee 3
        i32.store offset=204
        local.get 4
        local.get 4
        i32.load offset=24
        local.tee 1
        i32.store offset=200
        block ;; label = @3
          block ;; label = @4
            local.get 4
            i32.load8_u offset=104
            i32.const 1
            i32.ne
            br_if 0 (;@4;)
            local.get 1
            local.get 1
            i32.load
            i32.const -1
            i32.add
            local.tee 0
            i32.store
            local.get 0
            br_if 1 (;@3;)
            local.get 4
            i32.const 200
            i32.add
            call $"<alloc::rc::Rc<[u64]>>::drop_slow"
            br 1 (;@3;)
          end
          local.get 1
          i32.eqz
          br_if 0 (;@3;)
          local.get 4
          i32.const 0
          i32.store8 offset=104
          local.get 4
          local.get 3
          i32.store offset=184
          local.get 4
          local.get 1
          i32.store offset=180
          local.get 4
          i32.const 4
          i32.store8 offset=176
          local.get 4
          i64.const 4607182418800017408
          i64.store offset=168
          local.get 4
          i32.const 2
          i32.store8 offset=160
          local.get 4
          i64.const 8589934592
          i64.store offset=152
          local.get 4
          local.get 4
          i32.const 104
          i32.add
          i32.store offset=192
          local.get 4
          i32.const 1
          i32.store8 offset=188
          local.get 4
          i32.const 16
          i32.add
          local.get 4
          i32.const 152
          i32.add
          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
          local.get 4
          local.get 4
          i32.load offset=20
          local.tee 3
          i32.store offset=204
          local.get 4
          local.get 4
          i32.load offset=16
          local.tee 1
          i32.store offset=200
          block ;; label = @4
            block ;; label = @5
              local.get 4
              i32.load8_u offset=104
              i32.const 1
              i32.ne
              br_if 0 (;@5;)
              local.get 1
              local.get 1
              i32.load
              i32.const -1
              i32.add
              local.tee 0
              i32.store
              local.get 0
              br_if 1 (;@4;)
              local.get 4
              i32.const 200
              i32.add
              call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
              br 1 (;@4;)
            end
            local.get 1
            i32.eqz
            br_if 0 (;@4;)
            local.get 4
            i32.const 0
            i32.store8 offset=104
            local.get 4
            local.get 3
            i32.store offset=168
            local.get 4
            local.get 1
            i32.store offset=164
            local.get 4
            i32.const 6
            i32.store8 offset=160
            local.get 4
            i64.const 4294967296
            i64.store offset=152
            local.get 4
            local.get 4
            i32.const 104
            i32.add
            i32.store offset=176
            local.get 4
            i32.const 8
            i32.add
            local.get 4
            i32.const 152
            i32.add
            call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
            local.get 4
            local.get 4
            i32.load offset=12
            local.tee 2
            i32.store offset=204
            local.get 4
            local.get 4
            i32.load offset=8
            local.tee 3
            i32.store offset=200
            block ;; label = @5
              block ;; label = @6
                local.get 4
                i32.load8_u offset=104
                i32.const 1
                i32.ne
                br_if 0 (;@6;)
                local.get 3
                local.get 3
                i32.load
                i32.const -1
                i32.add
                local.tee 1
                i32.store
                local.get 1
                br_if 1 (;@5;)
                local.get 4
                i32.const 200
                i32.add
                call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                br 1 (;@5;)
              end
              local.get 3
              i32.eqz
              br_if 0 (;@5;)
              local.get 4
              i32.const 72
              i32.add
              local.set 1
              local.get 4
              local.get 2
              i32.store offset=160
              local.get 4
              local.get 3
              i32.store offset=156
              local.get 4
              i32.const 6
              i32.store8 offset=152
              local.get 4
              i32.const 64
              i32.add
              local.get 4
              i32.const 120
              i32.add
              local.get 4
              i32.const 152
              i32.add
              call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      local.get 4
                      i32.load offset=64
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 1
                      i64.load offset=8
                      i64.store offset=96
                      local.get 4
                      local.get 1
                      i64.load
                      i64.store offset=88
                      local.get 4
                      i64.const 4607182418800017408
                      i64.store offset=160
                      local.get 4
                      i32.const 2
                      i32.store8 offset=152
                      local.get 4
                      i32.const 120
                      i32.add
                      local.get 4
                      i32.const 88
                      i32.add
                      local.get 4
                      i32.const 152
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                      local.get 4
                      i32.load8_u offset=120
                      i32.const 255
                      i32.ne
                      br_if 1 (;@8;)
                      local.get 4
                      i32.const 128
                      i32.add
                      local.set 1
                    end
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
                    i32.const 48
                    i32.add
                    call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i32.load offset=40
                    local.tee 1
                    local.get 1
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 1
                    i32.store
                    local.get 1
                    i32.eqz
                    br_if 1 (;@7;)
                    br 2 (;@6;)
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
                  local.get 4
                  i64.load offset=128
                  i64.store offset=160
                  local.get 4
                  local.get 4
                  i64.load offset=120
                  i64.store offset=152
                  local.get 4
                  i32.const 200
                  i32.add
                  local.get 4
                  i32.const 152
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                  block ;; label = @8
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=200
                      i32.const 255
                      i32.eq
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 4
                      i64.load offset=208
                      i64.store offset=112
                      local.get 4
                      local.get 4
                      i64.load offset=200
                      i64.store offset=104
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.const 256
                    i32.store16 offset=104
                  end
                  local.get 4
                  i32.const 152
                  i32.add
                  call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i32.const 168
                  i32.add
                  call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 0
                  local.get 4
                  i32.const 104
                  i32.add
                  call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Neg>::neg"
                  local.get 4
                  i32.const 48
                  i32.add
                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i32.load offset=40
                  local.tee 1
                  local.get 1
                  i32.load
                  i32.const -1
                  i32.add
                  local.tee 1
                  i32.store
                  local.get 1
                  br_if 1 (;@6;)
                end
                local.get 4
                i32.const 40
                i32.add
                call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
              end
              local.get 4
              i32.const 224
              i32.add
              global.set $__stack_pointer
              return
            end
            i32.const 1053928
            i32.const 43
            local.get 4
            i32.const 223
            i32.add
            i32.const 1053912
            i32.const 1053972
            call $core::result::unwrap_failed
            unreachable
          end
          i32.const 1053928
          i32.const 43
          local.get 4
          i32.const 223
          i32.add
          i32.const 1053912
          i32.const 1053972
          call $core::result::unwrap_failed
          unreachable
        end
        i32.const 1053928
        i32.const 43
        local.get 4
        i32.const 223
        i32.add
        i32.const 1053912
        i32.const 1053972
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1053928
      i32.const 43
      local.get 4
      i32.const 223
      i32.add
      i32.const 1053912
      i32.const 1053972
      call $core::result::unwrap_failed
      unreachable
    end
    unreachable
  )
  (func $"<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#3} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;697;) (type 3) (param i32 i32 i32 i32)
    (local i32)
    global.get $__stack_pointer
    i32.const 96
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
    i32.const 48
    i32.add
    local.get 4
    i32.const 8
    i32.add
    i32.const 0
    call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
    local.get 4
    i32.const 0
    i32.store16 offset=76
    local.get 4
    i32.const 1066493
    i32.store offset=72
    local.get 4
    i32.const 1066488
    i32.store offset=68
    local.get 4
    i32.const 16
    i32.add
    local.get 4
    i32.const 68
    i32.add
    call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
    block ;; label = @1
      block ;; label = @2
        local.get 4
        i32.load8_u offset=16
        local.tee 3
        i32.const 255
        i32.ne
        br_if 0 (;@2;)
        local.get 4
        local.get 4
        i64.load offset=20 align=4
        i64.store offset=84 align=4
        local.get 4
        i32.const 3
        i32.store8 offset=80
        local.get 4
        i32.const 16
        i32.add
        local.get 4
        i32.const 48
        i32.add
        local.get 4
        i32.const 80
        i32.add
        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
        local.get 1
        i32.load
        local.tee 3
        i32.load offset=16
        i32.eqz
        br_if 1 (;@1;)
        local.get 0
        local.get 4
        i32.const 16
        i32.add
        local.get 3
        i32.load offset=12
        i32.const 8
        i32.add
        local.get 4
        i32.const 8
        i32.add
        local.get 1
        call $"<nanvm_lib::vm::lambda::PropertyLambda<nanvm_lib::naive::Naive>>::end_call::<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#3}::{closure#0}>"
        local.get 4
        i32.load offset=8
        local.tee 1
        local.get 1
        i32.load
        i32.const -1
        i32.add
        local.tee 1
        i32.store
        block ;; label = @3
          local.get 1
          br_if 0 (;@3;)
          local.get 4
          i32.const 8
          i32.add
          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
        end
        local.get 4
        i32.const 96
        i32.add
        global.set $__stack_pointer
        return
      end
      local.get 4
      local.get 4
      i32.load8_u offset=19
      i32.store8 offset=83
      local.get 4
      local.get 4
      i32.load16_u offset=17 align=1
      i32.store16 offset=81 align=1
      local.get 4
      local.get 4
      i32.load offset=28
      i32.store offset=92
      local.get 4
      local.get 4
      i64.load offset=20 align=4
      i64.store offset=84 align=4
      local.get 4
      local.get 3
      i32.store8 offset=80
      i32.const 1055372
      i32.const 43
      local.get 4
      i32.const 80
      i32.add
      i32.const 1055356
      i32.const 1055416
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 0
    i32.const 0
    i32.const 1062708
    call $core::panicking::panic_bounds_check
    unreachable
  )
  (func $"<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#4} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;698;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i64 i32)
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
    block ;; label = @1
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
                            local.tee 2
                            i32.load8_u offset=8
                            local.tee 5
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 2
                          i64.load offset=16
                          local.set 6
                          br 10 (;@1;)
                        end
                        local.get 2
                        i32.load offset=12
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 7
                        i32.store
                        local.get 7
                        i32.eqz
                        br_if 7 (;@3;)
                        br 8 (;@2;)
                      end
                      local.get 2
                      i32.load offset=12
                      local.tee 3
                      local.get 3
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 7
                      i32.store
                      local.get 7
                      i32.eqz
                      br_if 6 (;@3;)
                      local.get 2
                      i64.load8_u offset=20
                      i64.const 32
                      i64.shl
                      local.get 2
                      i64.load32_u offset=16
                      i64.or
                      local.set 6
                      br 8 (;@1;)
                    end
                    local.get 2
                    i32.load offset=12
                    local.tee 3
                    local.get 3
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 7
                    i32.store
                    local.get 7
                    br_if 6 (;@2;)
                    br 5 (;@3;)
                  end
                  local.get 2
                  i32.load offset=12
                  local.tee 3
                  local.get 3
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 7
                  i32.store
                  local.get 7
                  br_if 5 (;@2;)
                  br 4 (;@3;)
                end
                local.get 2
                i32.load offset=12
                local.tee 3
                local.get 3
                i32.load
                i32.const 1
                i32.add
                local.tee 2
                i32.store
                local.get 2
                i32.eqz
                br_if 3 (;@3;)
                br 1 (;@5;)
              end
              local.get 2
              i32.load8_u offset=9
              local.set 2
            end
            br 3 (;@1;)
          end
          i32.const 0
          i32.const 0
          i32.const 1062708
          call $core::panicking::panic_bounds_check
          unreachable
        end
        unreachable
      end
      local.get 2
      i64.load32_u offset=16
      local.set 6
    end
    local.get 4
    local.get 6
    i64.store offset=312
    local.get 4
    local.get 3
    i32.store offset=308
    local.get 4
    local.get 2
    i32.store8 offset=305
    local.get 4
    local.get 5
    i32.store8 offset=304
    local.get 4
    i32.const 432
    i32.add
    local.get 4
    i32.const 32
    i32.add
    i32.const 0
    call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
    local.get 4
    i32.const 0
    i32.store8 offset=384
    local.get 4
    i64.const 4294967296
    i64.store offset=424
    local.get 4
    local.get 4
    i32.const 384
    i32.add
    i32.store offset=448
    local.get 4
    i32.const 24
    i32.add
    local.get 4
    i32.const 424
    i32.add
    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
    local.get 4
    local.get 4
    i32.load offset=28
    local.tee 2
    i32.store offset=356
    local.get 4
    local.get 4
    i32.load offset=24
    local.tee 3
    i32.store offset=352
    block ;; label = @1
      block ;; label = @2
        local.get 4
        i32.load8_u offset=384
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
        i32.const 352
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
        br 1 (;@1;)
      end
      local.get 3
      i32.eqz
      br_if 0 (;@1;)
      local.get 4
      local.get 2
      i32.store offset=360
      local.get 4
      local.get 3
      i32.store offset=356
      local.get 4
      i32.const 6
      i32.store8 offset=352
      local.get 4
      i32.const 424
      i32.add
      local.get 4
      i32.const 304
      i32.add
      local.get 4
      i32.const 352
      i32.add
      call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
      local.get 4
      local.get 4
      i64.load offset=432
      i64.store offset=288
      local.get 4
      local.get 4
      i64.load offset=440
      i64.store offset=296
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                local.get 4
                i64.load offset=424
                i64.const 1
                i64.ne
                br_if 0 (;@6;)
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
                br 1 (;@5;)
              end
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          local.get 4
                          i32.const 288
                          i32.add
                          call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::boolean_coercion::BooleanCoercion>
                          br_if 0 (;@11;)
                          local.get 4
                          i32.const 0
                          i32.store16 offset=312
                          local.get 4
                          i32.const 1066504
                          i32.store offset=308
                          local.get 4
                          i32.const 1066493
                          i32.store offset=304
                          local.get 4
                          i32.const 424
                          i32.add
                          local.get 4
                          i32.const 304
                          i32.add
                          call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                          local.get 4
                          i32.load8_u offset=424
                          local.tee 1
                          i32.const 255
                          i32.ne
                          br_if 1 (;@10;)
                          local.get 0
                          local.get 4
                          i64.load offset=428 align=4
                          i64.store offset=12 align=4
                          local.get 0
                          i32.const 3
                          i32.store8 offset=8
                          local.get 0
                          i64.const 0
                          i64.store
                          br 7 (;@4;)
                        end
                        local.get 4
                        i32.const 0
                        i32.store16 offset=312
                        local.get 4
                        i32.const 1066511
                        i32.store offset=308
                        local.get 4
                        i32.const 1066504
                        i32.store offset=304
                        local.get 4
                        i32.const 424
                        i32.add
                        local.get 4
                        i32.const 304
                        i32.add
                        call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                        local.get 4
                        i32.load8_u offset=424
                        local.tee 3
                        i32.const 255
                        i32.ne
                        br_if 1 (;@9;)
                        local.get 4
                        local.get 4
                        i64.load offset=428 align=4
                        i64.store offset=260 align=4
                        local.get 4
                        i32.const 3
                        i32.store8 offset=256
                        local.get 4
                        i32.const 384
                        i32.add
                        local.get 4
                        i32.const 32
                        i32.add
                        i32.const 0
                        call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
                        local.get 4
                        i32.const 0
                        i32.store16 offset=312
                        local.get 4
                        i32.const 1066307
                        i32.store offset=308
                        local.get 4
                        i32.const 1066301
                        i32.store offset=304
                        local.get 4
                        i32.const 424
                        i32.add
                        local.get 4
                        i32.const 304
                        i32.add
                        call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                        local.get 4
                        i32.load8_u offset=424
                        local.tee 3
                        i32.const 255
                        i32.ne
                        br_if 2 (;@8;)
                        local.get 4
                        local.get 4
                        i64.load offset=428 align=4
                        i64.store offset=356 align=4
                        local.get 4
                        i32.const 3
                        i32.store8 offset=352
                        local.get 4
                        i32.const 304
                        i32.add
                        local.get 4
                        i32.const 384
                        i32.add
                        local.get 4
                        i32.const 352
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=304
                          i32.const 255
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 0
                          local.get 4
                          i64.load offset=320
                          i64.store offset=16
                          local.get 0
                          local.get 4
                          i64.load offset=312
                          i64.store offset=8
                          local.get 0
                          i64.const 1
                          i64.store
                          local.get 4
                          i32.const 256
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          br 6 (;@5;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=328
                        i64.store offset=448
                        local.get 4
                        local.get 4
                        i64.load offset=320
                        i64.store offset=440
                        local.get 4
                        local.get 4
                        i64.load offset=312
                        i64.store offset=432
                        local.get 4
                        local.get 4
                        i64.load offset=304
                        i64.store offset=424
                        local.get 4
                        i32.const 352
                        i32.add
                        local.get 4
                        i32.const 424
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                        block ;; label = @11
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=352
                            i32.const 255
                            i32.eq
                            br_if 0 (;@12;)
                            local.get 4
                            local.get 4
                            i64.load offset=360
                            i64.store offset=344
                            local.get 4
                            local.get 4
                            i64.load offset=352
                            i64.store offset=336
                            br 1 (;@11;)
                          end
                          local.get 4
                          i32.const 256
                          i32.store16 offset=336
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
                        i32.const 272
                        i32.add
                        local.get 4
                        i32.const 336
                        i32.add
                        call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::primitive_dispatch::ViaPrimitive<nanvm_lib::vm::string_coercion::StringCoercion>>
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=272
                          local.tee 3
                          i32.const 255
                          i32.eq
                          br_if 0 (;@11;)
                          local.get 0
                          local.get 4
                          i32.load8_u offset=275
                          i32.store8 offset=11
                          local.get 0
                          local.get 4
                          i32.load16_u offset=273 align=1
                          i32.store16 offset=9 align=1
                          local.get 4
                          i64.load offset=276 align=4
                          local.set 6
                          local.get 0
                          local.get 4
                          i32.load offset=284
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
                          i32.const 256
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          br 6 (;@5;)
                        end
                        local.get 4
                        i32.const 152
                        i32.add
                        i32.const 8
                        i32.add
                        local.set 3
                        local.get 4
                        local.get 4
                        i64.load offset=276 align=4
                        i64.store offset=180 align=4
                        local.get 4
                        i32.const 3
                        i32.store8 offset=176
                        local.get 4
                        i32.const 152
                        i32.add
                        local.get 4
                        i32.const 256
                        i32.add
                        local.get 4
                        i32.const 176
                        i32.add
                        call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
                        block ;; label = @11
                          local.get 4
                          i64.load offset=152
                          i64.const 1
                          i64.ne
                          br_if 0 (;@11;)
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
                          br 6 (;@5;)
                        end
                        local.get 4
                        local.get 3
                        i64.load offset=8
                        i64.store offset=200
                        local.get 4
                        local.get 3
                        i64.load
                        i64.store offset=192
                        local.get 4
                        i32.const 0
                        i32.store16 offset=392
                        local.get 4
                        i32.const 1066531
                        i32.store offset=388
                        local.get 4
                        i32.const 1066511
                        i32.store offset=384
                        local.get 4
                        i32.const 424
                        i32.add
                        local.get 4
                        i32.const 384
                        i32.add
                        call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                        local.get 4
                        i32.load8_u offset=424
                        local.tee 3
                        i32.const 255
                        i32.ne
                        br_if 3 (;@7;)
                        local.get 4
                        i32.const 128
                        i32.add
                        i32.const 8
                        i32.add
                        local.set 3
                        local.get 4
                        local.get 4
                        i64.load offset=428 align=4
                        i64.store offset=356 align=4
                        local.get 4
                        i32.const 3
                        i32.store8 offset=352
                        local.get 4
                        i32.const 128
                        i32.add
                        local.get 4
                        i32.const 192
                        i32.add
                        local.get 4
                        i32.const 352
                        i32.add
                        call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
                        block ;; label = @11
                          local.get 4
                          i64.load offset=128
                          i64.const 1
                          i64.ne
                          br_if 0 (;@11;)
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
                          br 6 (;@5;)
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
                        i32.const 384
                        i32.add
                        local.get 4
                        i32.const 32
                        i32.add
                        i32.const 0
                        call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
                        local.get 4
                        i64.const 0
                        i64.store offset=432
                        local.get 4
                        i32.const 2
                        i32.store8 offset=424
                        local.get 4
                        i32.const 352
                        i32.add
                        local.get 4
                        i32.const 384
                        i32.add
                        local.get 4
                        i32.const 424
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=352
                          i32.const 255
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 0
                          local.get 4
                          i64.load offset=368
                          i64.store offset=16
                          local.get 0
                          local.get 4
                          i64.load offset=360
                          i64.store offset=8
                          local.get 0
                          i64.const 1
                          i64.store
                          local.get 4
                          i32.const 240
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          br 6 (;@5;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=376
                        i64.store offset=448
                        local.get 4
                        local.get 4
                        i64.load offset=368
                        i64.store offset=440
                        local.get 4
                        local.get 4
                        i64.load offset=360
                        i64.store offset=432
                        local.get 4
                        local.get 4
                        i64.load offset=352
                        i64.store offset=424
                        local.get 4
                        i32.const 384
                        i32.add
                        local.get 4
                        i32.const 424
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::read
                        local.get 4
                        i32.const 272
                        i32.add
                        local.get 4
                        i32.const 384
                        i32.add
                        call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::primitive_dispatch::ViaPrimitive<nanvm_lib::vm::string_coercion::StringCoercion>>
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=272
                          local.tee 3
                          i32.const 255
                          i32.eq
                          br_if 0 (;@11;)
                          local.get 0
                          local.get 4
                          i32.load8_u offset=275
                          i32.store8 offset=11
                          local.get 0
                          local.get 4
                          i32.load16_u offset=273 align=1
                          i32.store16 offset=9 align=1
                          local.get 4
                          i64.load offset=276 align=4
                          local.set 6
                          local.get 0
                          local.get 4
                          i32.load offset=284
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
                          i32.const 240
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          br 6 (;@5;)
                        end
                        local.get 4
                        i32.const 104
                        i32.add
                        i32.const 8
                        i32.add
                        local.set 3
                        local.get 4
                        local.get 4
                        i64.load offset=276 align=4
                        i64.store offset=212 align=4
                        local.get 4
                        i32.const 3
                        i32.store8 offset=208
                        local.get 4
                        i32.const 104
                        i32.add
                        local.get 4
                        i32.const 240
                        i32.add
                        local.get 4
                        i32.const 208
                        i32.add
                        call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
                        block ;; label = @11
                          local.get 4
                          i64.load offset=104
                          i64.const 1
                          i64.ne
                          br_if 0 (;@11;)
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
                          br 6 (;@5;)
                        end
                        local.get 4
                        i32.const 80
                        i32.add
                        i32.const 8
                        i32.add
                        local.set 2
                        local.get 4
                        local.get 3
                        i64.load offset=8
                        i64.store offset=232
                        local.get 4
                        local.get 3
                        i64.load
                        i64.store offset=224
                        local.get 4
                        i32.const 16
                        i32.add
                        i32.const 1066531
                        i32.const 10
                        call $"<nanvm_lib::vm::string::String<nanvm_lib::naive::Naive> as core::convert::From<&str>>::from"
                        local.get 4
                        i32.const 3
                        i32.store8 offset=424
                        local.get 4
                        local.get 4
                        i64.load offset=16
                        i64.store offset=428 align=4
                        local.get 4
                        i32.const 80
                        i32.add
                        local.get 4
                        i32.const 224
                        i32.add
                        local.get 4
                        i32.const 424
                        i32.add
                        call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
                        block ;; label = @11
                          local.get 4
                          i64.load offset=80
                          i64.const 1
                          i64.ne
                          br_if 0 (;@11;)
                          local.get 0
                          i64.const 1
                          i64.store
                          local.get 0
                          local.get 2
                          i64.load offset=8
                          i64.store offset=16
                          local.get 0
                          local.get 2
                          i64.load
                          i64.store offset=8
                          br 6 (;@5;)
                        end
                        local.get 4
                        local.get 2
                        i64.load offset=8
                        i64.store offset=72
                        local.get 4
                        local.get 2
                        i64.load
                        i64.store offset=64
                        local.get 4
                        i32.const 256
                        i32.add
                        local.get 4
                        i32.const 32
                        i32.add
                        i32.const 0
                        call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
                        local.get 4
                        i32.const 8
                        i32.add
                        i32.const 1066541
                        i32.const 2
                        call $"<nanvm_lib::vm::string::String<nanvm_lib::naive::Naive> as core::convert::From<&str>>::from"
                        local.get 4
                        i32.const 3
                        i32.store8 offset=272
                        local.get 4
                        local.get 4
                        i64.load offset=8
                        i64.store offset=276 align=4
                        local.get 4
                        i32.const 424
                        i32.add
                        local.get 4
                        i32.const 256
                        i32.add
                        local.get 4
                        i32.const 272
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                        local.get 1
                        i32.load offset=16
                        local.tee 3
                        i32.const 1
                        i32.le_u
                        br_if 4 (;@6;)
                        local.get 4
                        i32.const 400
                        i32.add
                        i32.const 8
                        i32.add
                        local.set 3
                        local.get 4
                        i32.const 400
                        i32.add
                        local.get 4
                        i32.const 424
                        i32.add
                        local.get 1
                        i32.load offset=12
                        i32.const 24
                        i32.add
                        call $"<nanvm_lib::vm::lambda::PropertyLambda<nanvm_lib::naive::Naive>>::end_call::<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#4}::{closure#2}>"
                        block ;; label = @11
                          local.get 4
                          i64.load offset=400
                          i64.const 1
                          i64.ne
                          br_if 0 (;@11;)
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
                          i32.const 64
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          br 6 (;@5;)
                        end
                        local.get 4
                        i32.const 240
                        i32.add
                        local.get 3
                        call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::primitive_dispatch::ViaPrimitive<nanvm_lib::vm::string_coercion::StringCoercion>>
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=240
                          local.tee 1
                          i32.const 255
                          i32.eq
                          br_if 0 (;@11;)
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
                          local.set 6
                          local.get 0
                          local.get 4
                          i32.load offset=252
                          i32.store offset=20
                          local.get 0
                          local.get 6
                          i64.store offset=12 align=4
                          local.get 0
                          local.get 1
                          i32.store8 offset=8
                          local.get 0
                          i64.const 1
                          i64.store
                          local.get 4
                          i32.const 64
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          br 6 (;@5;)
                        end
                        local.get 4
                        i32.const 40
                        i32.add
                        i32.const 8
                        i32.add
                        local.set 1
                        local.get 4
                        local.get 4
                        i64.load offset=244 align=4
                        i64.store offset=260 align=4
                        local.get 4
                        i32.const 3
                        i32.store8 offset=256
                        local.get 4
                        i32.const 40
                        i32.add
                        local.get 4
                        i32.const 64
                        i32.add
                        local.get 4
                        i32.const 256
                        i32.add
                        call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
                        block ;; label = @11
                          local.get 4
                          i64.load offset=40
                          i64.const 1
                          i64.ne
                          br_if 0 (;@11;)
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
                          br 6 (;@5;)
                        end
                        local.get 4
                        local.get 1
                        i64.load offset=8
                        i64.store offset=280
                        local.get 4
                        local.get 1
                        i64.load
                        i64.store offset=272
                        local.get 4
                        i32.const 1066543
                        i32.const 1
                        call $"<nanvm_lib::vm::string::String<nanvm_lib::naive::Naive> as core::convert::From<&str>>::from"
                        local.get 4
                        i32.const 3
                        i32.store8 offset=424
                        local.get 4
                        local.get 4
                        i64.load
                        i64.store offset=428 align=4
                        local.get 0
                        local.get 4
                        i32.const 272
                        i32.add
                        local.get 4
                        i32.const 424
                        i32.add
                        call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
                        br 6 (;@4;)
                      end
                      local.get 4
                      local.get 4
                      i32.load8_u offset=427
                      i32.store8 offset=355
                      local.get 4
                      local.get 4
                      i32.load16_u offset=425 align=1
                      i32.store16 offset=353 align=1
                      local.get 4
                      local.get 4
                      i32.load offset=436
                      i32.store offset=364
                      local.get 4
                      local.get 4
                      i64.load offset=428 align=4
                      i64.store offset=356 align=4
                      local.get 4
                      local.get 1
                      i32.store8 offset=352
                      i32.const 1055372
                      i32.const 43
                      local.get 4
                      i32.const 352
                      i32.add
                      i32.const 1055356
                      i32.const 1055416
                      call $core::result::unwrap_failed
                      unreachable
                    end
                    local.get 4
                    local.get 4
                    i32.load8_u offset=427
                    i32.store8 offset=355
                    local.get 4
                    local.get 4
                    i32.load16_u offset=425 align=1
                    i32.store16 offset=353 align=1
                    local.get 4
                    local.get 4
                    i32.load offset=436
                    i32.store offset=364
                    local.get 4
                    local.get 4
                    i64.load offset=428 align=4
                    i64.store offset=356 align=4
                    local.get 4
                    local.get 3
                    i32.store8 offset=352
                    i32.const 1055372
                    i32.const 43
                    local.get 4
                    i32.const 352
                    i32.add
                    i32.const 1055356
                    i32.const 1055416
                    call $core::result::unwrap_failed
                    unreachable
                  end
                  local.get 4
                  local.get 4
                  i32.load8_u offset=427
                  i32.store8 offset=355
                  local.get 4
                  local.get 4
                  i32.load16_u offset=425 align=1
                  i32.store16 offset=353 align=1
                  local.get 4
                  local.get 4
                  i32.load offset=436
                  i32.store offset=364
                  local.get 4
                  local.get 4
                  i64.load offset=428 align=4
                  i64.store offset=356 align=4
                  local.get 4
                  local.get 3
                  i32.store8 offset=352
                  i32.const 1055372
                  i32.const 43
                  local.get 4
                  i32.const 352
                  i32.add
                  i32.const 1055356
                  i32.const 1055416
                  call $core::result::unwrap_failed
                  unreachable
                end
                local.get 4
                local.get 4
                i32.load8_u offset=427
                i32.store8 offset=355
                local.get 4
                local.get 4
                i32.load16_u offset=425 align=1
                i32.store16 offset=353 align=1
                local.get 4
                local.get 4
                i32.load offset=436
                i32.store offset=364
                local.get 4
                local.get 4
                i64.load offset=428 align=4
                i64.store offset=356 align=4
                local.get 4
                local.get 3
                i32.store8 offset=352
                i32.const 1055372
                i32.const 43
                local.get 4
                i32.const 352
                i32.add
                i32.const 1055356
                i32.const 1055416
                call $core::result::unwrap_failed
                unreachable
              end
              i32.const 1
              local.get 3
              i32.const 1062708
              call $core::panicking::panic_bounds_check
              unreachable
            end
            local.get 4
            i32.load offset=32
            local.tee 0
            local.get 0
            i32.load
            i32.const -1
            i32.add
            local.tee 0
            i32.store
            local.get 0
            i32.eqz
            br_if 1 (;@3;)
            br 2 (;@2;)
          end
          local.get 4
          i32.load offset=32
          local.tee 0
          local.get 0
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
      i32.const 464
      i32.add
      global.set $__stack_pointer
      return
    end
    i32.const 1053928
    i32.const 43
    local.get 4
    i32.const 463
    i32.add
    i32.const 1053912
    i32.const 1053972
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#5} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;699;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i64 i32 f64)
    global.get $__stack_pointer
    i32.const 368
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 1
    i32.load
    local.set 1
    local.get 4
    local.get 3
    i32.store offset=28
    local.get 4
    local.get 2
    i32.store offset=24
    local.get 1
    local.get 1
    i32.load
    i32.const 1
    i32.add
    local.tee 3
    i32.store
    block ;; label = @1
      local.get 3
      i32.eqz
      br_if 0 (;@1;)
      local.get 4
      i32.const 264
      i32.add
      local.get 4
      i32.const 24
      i32.add
      i32.const 0
      call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
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
                            local.tee 2
                            i32.load8_u offset=8
                            local.tee 5
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 2
                          i64.load offset=16
                          local.set 6
                          br 9 (;@2;)
                        end
                        local.get 2
                        i32.load offset=12
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
                      local.get 2
                      i32.load offset=12
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
                      local.get 2
                      i64.load8_u offset=20
                      i64.const 32
                      i64.shl
                      local.get 2
                      i64.load32_u offset=16
                      i64.or
                      local.set 6
                      br 7 (;@2;)
                    end
                    local.get 2
                    i32.load offset=12
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
                  local.get 2
                  i32.load offset=12
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
                local.get 2
                i32.load offset=12
                local.tee 3
                local.get 3
                i32.load
                i32.const 1
                i32.add
                local.tee 2
                i32.store
                local.get 2
                i32.eqz
                br_if 5 (;@1;)
                br 1 (;@5;)
              end
              local.get 2
              i32.load8_u offset=9
              local.set 2
            end
            br 2 (;@2;)
          end
          i32.const 0
          i32.const 0
          i32.const 1062708
          call $core::panicking::panic_bounds_check
          unreachable
        end
        local.get 2
        i64.load32_u offset=16
        local.set 6
      end
      local.get 4
      local.get 4
      i64.load offset=272
      i64.store offset=328
      local.get 4
      local.get 4
      i64.load offset=264
      i64.store offset=320
      local.get 4
      i32.const 0
      i32.store8 offset=232
      local.get 4
      local.get 6
      i64.store offset=344
      local.get 4
      local.get 3
      i32.store offset=340
      local.get 4
      local.get 2
      i32.store8 offset=337
      local.get 4
      local.get 5
      i32.store8 offset=336
      local.get 4
      local.get 1
      i32.store offset=308
      local.get 4
      i32.const 7
      i32.store8 offset=304
      local.get 4
      i64.const 12884901888
      i64.store offset=296
      local.get 4
      local.get 4
      i32.const 232
      i32.add
      i32.store offset=352
      local.get 4
      i32.const 16
      i32.add
      local.get 4
      i32.const 296
      i32.add
      call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 3>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
      local.get 4
      local.get 4
      i32.load offset=20
      local.tee 3
      i32.store offset=268
      local.get 4
      local.get 4
      i32.load offset=16
      local.tee 1
      i32.store offset=264
      block ;; label = @2
        block ;; label = @3
          local.get 4
          i32.load8_u offset=232
          i32.const 1
          i32.ne
          br_if 0 (;@3;)
          local.get 1
          local.get 1
          i32.load
          i32.const -1
          i32.add
          local.tee 0
          i32.store
          local.get 0
          br_if 1 (;@2;)
          local.get 4
          i32.const 264
          i32.add
          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
          br 1 (;@2;)
        end
        local.get 1
        i32.eqz
        br_if 0 (;@2;)
        local.get 4
        i32.const 239
        i32.const 1
        local.get 1
        local.get 3
        i32.const 1066544
        i32.const 95
        call $<nanvm_lib::naive::function::Function>::new
        i32.store offset=36
        local.get 4
        i32.const 7
        i32.store8 offset=32
        local.get 4
        i32.const 232
        i32.add
        local.get 4
        i32.const 24
        i32.add
        i32.const 0
        call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
        local.get 4
        i32.const 0
        i32.store16 offset=192
        local.get 4
        i32.const 1066307
        i32.store offset=188
        local.get 4
        i32.const 1066301
        i32.store offset=184
        local.get 4
        i32.const 296
        i32.add
        local.get 4
        i32.const 184
        i32.add
        call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
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
                            block ;; label = @13
                              local.get 4
                              i32.load8_u offset=296
                              local.tee 1
                              i32.const 255
                              i32.ne
                              br_if 0 (;@13;)
                              local.get 4
                              local.get 4
                              i64.load offset=300 align=4
                              i64.store offset=268 align=4
                              local.get 4
                              i32.const 3
                              i32.store8 offset=264
                              local.get 4
                              i32.const 184
                              i32.add
                              local.get 4
                              i32.const 232
                              i32.add
                              local.get 4
                              i32.const 264
                              i32.add
                              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                              block ;; label = @14
                                local.get 4
                                i32.load8_u offset=184
                                i32.const 255
                                i32.ne
                                br_if 0 (;@14;)
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
                                br 8 (;@6;)
                              end
                              local.get 4
                              local.get 4
                              i64.load offset=208
                              i64.store offset=320
                              local.get 4
                              local.get 4
                              i64.load offset=200
                              i64.store offset=312
                              local.get 4
                              local.get 4
                              i64.load offset=192
                              i64.store offset=304
                              local.get 4
                              local.get 4
                              i64.load offset=184
                              i64.store offset=296
                              local.get 4
                              i32.const 264
                              i32.add
                              local.get 4
                              i32.const 296
                              i32.add
                              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                              block ;; label = @14
                                block ;; label = @15
                                  local.get 4
                                  i32.load8_u offset=264
                                  i32.const 255
                                  i32.eq
                                  br_if 0 (;@15;)
                                  local.get 4
                                  local.get 4
                                  i64.load offset=272
                                  i64.store offset=56
                                  local.get 4
                                  local.get 4
                                  i64.load offset=264
                                  i64.store offset=48
                                  br 1 (;@14;)
                                end
                                local.get 4
                                i32.const 256
                                i32.store16 offset=48
                              end
                              local.get 4
                              i32.const 296
                              i32.add
                              call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                              local.get 4
                              i32.const 312
                              i32.add
                              call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                              local.get 4
                              i64.const 4611686018427387904
                              i64.store offset=272
                              local.get 4
                              i32.const 2
                              i32.store8 offset=264
                              local.get 4
                              i32.const 296
                              i32.add
                              local.get 4
                              i32.const 48
                              i32.add
                              local.get 4
                              i32.const 264
                              i32.add
                              call $nanvm_lib::vm::any::relational::compare::<nanvm_lib::naive::Naive>
                              local.get 4
                              i32.load8_u offset=297
                              local.set 1
                              block ;; label = @14
                                local.get 4
                                i32.load8_u offset=296
                                local.tee 3
                                i32.const 255
                                i32.eq
                                br_if 0 (;@14;)
                                local.get 4
                                local.get 4
                                i64.load offset=304 align=2
                                i64.store offset=224 align=2
                                local.get 4
                                local.get 4
                                i64.load offset=298 align=2
                                i64.store offset=218 align=2
                                local.get 4
                                local.get 1
                                i32.store8 offset=217
                                local.get 4
                                local.get 3
                                i32.store8 offset=216
                                local.get 0
                                local.get 4
                                i64.load offset=216
                                i64.store offset=8
                                local.get 0
                                local.get 4
                                i64.load offset=224
                                i64.store offset=16
                                local.get 0
                                i64.const 1
                                i64.store
                                br 8 (;@6;)
                              end
                              local.get 4
                              i32.const 1
                              i32.store8 offset=216
                              local.get 4
                              local.get 1
                              i32.const 255
                              i32.and
                              i32.const 255
                              i32.eq
                              i32.store8 offset=217
                              local.get 4
                              i32.const 216
                              i32.add
                              call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::boolean_coercion::BooleanCoercion>
                              br_if 1 (;@12;)
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
                                              local.tee 3
                                              br_table 6 (;@15;) 6 (;@15;) 0 (;@21;) 1 (;@20;) 2 (;@19;) 3 (;@18;) 4 (;@17;) 5 (;@16;) 6 (;@15;)
                                            end
                                            local.get 4
                                            i64.load offset=40
                                            local.set 6
                                            br 10 (;@10;)
                                          end
                                          local.get 4
                                          i32.load offset=36
                                          local.tee 1
                                          local.get 1
                                          i32.load
                                          i32.const 1
                                          i32.add
                                          local.tee 2
                                          i32.store
                                          local.get 2
                                          i32.eqz
                                          br_if 18 (;@1;)
                                          br 8 (;@11;)
                                        end
                                        local.get 4
                                        i32.load offset=36
                                        local.tee 1
                                        local.get 1
                                        i32.load
                                        i32.const 1
                                        i32.add
                                        local.tee 2
                                        i32.store
                                        local.get 2
                                        i32.eqz
                                        br_if 17 (;@1;)
                                        local.get 4
                                        i64.load8_u offset=44
                                        i64.const 32
                                        i64.shl
                                        local.get 4
                                        i64.load32_u offset=40
                                        i64.or
                                        local.set 6
                                        br 8 (;@10;)
                                      end
                                      local.get 4
                                      i32.load offset=36
                                      local.tee 1
                                      local.get 1
                                      i32.load
                                      i32.const 1
                                      i32.add
                                      local.tee 2
                                      i32.store
                                      local.get 2
                                      i32.eqz
                                      br_if 16 (;@1;)
                                      br 6 (;@11;)
                                    end
                                    local.get 4
                                    i32.load offset=36
                                    local.tee 1
                                    local.get 1
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 2
                                    i32.store
                                    local.get 2
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    br 5 (;@11;)
                                  end
                                  local.get 4
                                  i32.load offset=36
                                  local.tee 1
                                  local.get 1
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 2
                                  i32.store
                                  local.get 2
                                  i32.eqz
                                  br_if 14 (;@1;)
                                  br 1 (;@14;)
                                end
                                local.get 4
                                i32.load8_u offset=33
                                local.set 2
                              end
                              br 3 (;@10;)
                            end
                            local.get 4
                            local.get 4
                            i32.load8_u offset=299
                            i32.store8 offset=267
                            local.get 4
                            local.get 4
                            i32.load16_u offset=297 align=1
                            i32.store16 offset=265 align=1
                            local.get 4
                            local.get 4
                            i32.load offset=308
                            i32.store offset=276
                            local.get 4
                            local.get 4
                            i64.load offset=300 align=4
                            i64.store offset=268 align=4
                            local.get 4
                            local.get 1
                            i32.store8 offset=264
                            i32.const 1055372
                            i32.const 43
                            local.get 4
                            i32.const 264
                            i32.add
                            i32.const 1055356
                            i32.const 1055416
                            call $core::result::unwrap_failed
                            unreachable
                          end
                          local.get 0
                          i32.const 8
                          i32.add
                          local.get 4
                          i32.const 24
                          i32.add
                          i32.const 0
                          call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
                          local.get 0
                          i64.const 0
                          i64.store
                          br 2 (;@9;)
                        end
                        local.get 4
                        i64.load32_u offset=40
                        local.set 6
                      end
                      local.get 4
                      local.get 6
                      i64.store offset=72
                      local.get 4
                      local.get 1
                      i32.store offset=68
                      local.get 4
                      local.get 2
                      i32.store8 offset=65
                      local.get 4
                      local.get 3
                      i32.store8 offset=64
                      local.get 4
                      i32.const 112
                      i32.add
                      local.get 4
                      i32.const 24
                      i32.add
                      i32.const 0
                      call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
                      local.get 4
                      i32.const 168
                      i32.add
                      local.get 4
                      i32.const 24
                      i32.add
                      i32.const 0
                      call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
                      local.get 4
                      i32.const 0
                      i32.store16 offset=240
                      local.get 4
                      i32.const 1066307
                      i32.store offset=236
                      local.get 4
                      i32.const 1066301
                      i32.store offset=232
                      local.get 4
                      i32.const 296
                      i32.add
                      local.get 4
                      i32.const 232
                      i32.add
                      call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                      local.get 4
                      i32.load8_u offset=296
                      local.tee 1
                      i32.const 255
                      i32.ne
                      br_if 6 (;@3;)
                      local.get 4
                      local.get 4
                      i64.load offset=300 align=4
                      i64.store offset=268 align=4
                      local.get 4
                      i32.const 3
                      i32.store8 offset=264
                      local.get 4
                      i32.const 232
                      i32.add
                      local.get 4
                      i32.const 168
                      i32.add
                      local.get 4
                      i32.const 264
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=232
                        i32.const 255
                        i32.ne
                        br_if 0 (;@10;)
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
                        local.get 4
                        i32.const 112
                        i32.add
                        call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                        br 3 (;@7;)
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
                      i32.const 264
                      i32.add
                      local.get 4
                      i32.const 296
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                      block ;; label = @10
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=264
                          i32.const 255
                          i32.eq
                          br_if 0 (;@11;)
                          local.get 4
                          local.get 4
                          i64.load offset=272
                          i64.store offset=136
                          local.get 4
                          local.get 4
                          i64.load offset=264
                          i64.store offset=128
                          br 1 (;@10;)
                        end
                        local.get 4
                        i32.const 256
                        i32.store16 offset=128
                      end
                      local.get 4
                      i32.const 152
                      i32.add
                      local.set 1
                      local.get 4
                      i32.const 296
                      i32.add
                      call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      i32.const 312
                      i32.add
                      call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      i64.const 4607182418800017408
                      i64.store offset=304
                      local.get 4
                      i32.const 2
                      i32.store8 offset=296
                      local.get 4
                      i32.const 144
                      i32.add
                      local.get 4
                      i32.const 128
                      i32.add
                      local.get 4
                      i32.const 296
                      i32.add
                      call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::bit::Shr>::shr>"
                      block ;; label = @10
                        local.get 4
                        i64.load offset=144
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
                        i32.const 112
                        i32.add
                        call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                        br 3 (;@7;)
                      end
                      local.get 4
                      i32.const 296
                      i32.add
                      local.get 1
                      call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::to_numeric
                      local.get 4
                      f64.load offset=312
                      local.set 8
                      local.get 4
                      i32.load offset=308
                      local.set 1
                      local.get 4
                      i32.load offset=304
                      local.set 3
                      local.get 4
                      i32.load offset=296
                      br_if 1 (;@8;)
                      block ;; label = @10
                        local.get 3
                        i32.const 1
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 4
                        local.get 8
                        f64.store offset=300 align=4
                        local.get 4
                        local.get 1
                        i32.store offset=296
                        local.get 4
                        i32.const 296
                        i32.add
                        call $<nanvm_lib::vm::bigint::BigInt<nanvm_lib::naive::Naive>>::to_number
                        local.set 8
                        local.get 1
                        local.get 1
                        i32.load
                        i32.const -1
                        i32.add
                        local.tee 3
                        i32.store
                        local.get 3
                        br_if 0 (;@10;)
                        local.get 4
                        i32.const 296
                        i32.add
                        call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                      end
                      local.get 4
                      local.get 8
                      f64.store offset=176
                      local.get 4
                      i32.const 2
                      i32.store offset=168
                      local.get 4
                      i32.const 264
                      i32.add
                      local.get 4
                      i32.const 112
                      i32.add
                      local.get 4
                      i32.const 168
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=264
                        i32.const 255
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 0
                        local.get 4
                        i64.load offset=280
                        i64.store offset=16
                        local.get 0
                        local.get 4
                        i64.load offset=272
                        i64.store offset=8
                        local.get 0
                        i64.const 1
                        i64.store
                        br 3 (;@7;)
                      end
                      local.get 4
                      local.get 4
                      i64.load offset=288
                      i64.store offset=320
                      local.get 4
                      local.get 4
                      i64.load offset=280
                      i64.store offset=312
                      local.get 4
                      local.get 4
                      i64.load offset=272
                      i64.store offset=304
                      local.get 4
                      local.get 4
                      i64.load offset=264
                      i64.store offset=296
                      local.get 4
                      i32.const 96
                      i32.add
                      local.get 4
                      i32.const 296
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::read
                      local.get 4
                      i32.const 8
                      i32.add
                      local.get 4
                      i32.const 96
                      i32.add
                      call $"<nanvm_lib::naive::container::Container<(), nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as nanvm_lib::vm::internal::icontainer::IContainer<nanvm_lib::naive::Naive>>::new_ok::<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>; 1]>"
                      local.get 4
                      i32.const 6
                      i32.store8 offset=80
                      local.get 4
                      local.get 4
                      i64.load offset=8
                      i64.store offset=84 align=4
                      local.get 0
                      local.get 4
                      i32.const 64
                      i32.add
                      local.get 4
                      i32.const 80
                      i32.add
                      call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
                    end
                    local.get 4
                    i32.const 32
                    i32.add
                    call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i32.load offset=24
                    local.tee 1
                    local.get 1
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 1
                    i32.store
                    local.get 1
                    i32.eqz
                    br_if 3 (;@5;)
                    br 4 (;@4;)
                  end
                  local.get 0
                  local.get 8
                  f64.store offset=16
                  local.get 0
                  local.get 1
                  i32.store offset=12
                  local.get 0
                  local.get 3
                  i32.store offset=8
                  local.get 0
                  i64.const 1
                  i64.store
                  local.get 4
                  i32.const 112
                  i32.add
                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                end
                local.get 4
                i32.const 64
                i32.add
                call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
              end
              local.get 4
              i32.const 32
              i32.add
              call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.load offset=24
              local.tee 1
              local.get 1
              i32.load
              i32.const -1
              i32.add
              local.tee 1
              i32.store
              local.get 1
              br_if 1 (;@4;)
            end
            local.get 4
            i32.const 24
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
          end
          local.get 4
          i32.const 368
          i32.add
          global.set $__stack_pointer
          return
        end
        local.get 4
        local.get 4
        i32.load8_u offset=299
        i32.store8 offset=267
        local.get 4
        local.get 4
        i32.load16_u offset=297 align=1
        i32.store16 offset=265 align=1
        local.get 4
        local.get 4
        i32.load offset=308
        i32.store offset=276
        local.get 4
        local.get 4
        i64.load offset=300 align=4
        i64.store offset=268 align=4
        local.get 4
        local.get 1
        i32.store8 offset=264
        i32.const 1055372
        i32.const 43
        local.get 4
        i32.const 264
        i32.add
        i32.const 1055356
        i32.const 1055416
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1053928
      i32.const 43
      local.get 4
      i32.const 367
      i32.add
      i32.const 1053912
      i32.const 1053972
      call $core::result::unwrap_failed
      unreachable
    end
    unreachable
  )
  (func $"<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#6} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;700;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i64 i32)
    global.get $__stack_pointer
    i32.const 608
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 1
    i32.load
    local.set 1
    local.get 4
    local.get 3
    i32.store offset=68
    local.get 4
    local.get 2
    i32.store offset=64
    local.get 4
    i32.const 0
    i32.store16 offset=184
    local.get 4
    i32.const 1066646
    i32.store offset=180
    local.get 4
    i32.const 1066639
    i32.store offset=176
    local.get 4
    i32.const 552
    i32.add
    local.get 4
    i32.const 176
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
                    i32.load8_u offset=552
                    local.tee 3
                    i32.const 255
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 4
                    i32.load offset=560
                    local.set 3
                    local.get 4
                    i32.load offset=556
                    local.set 5
                    local.get 4
                    i32.const 0
                    i32.store16 offset=184
                    local.get 4
                    i32.const 1066651
                    i32.store offset=180
                    local.get 4
                    i32.const 1066646
                    i32.store offset=176
                    local.get 4
                    i32.const 552
                    i32.add
                    local.get 4
                    i32.const 176
                    i32.add
                    call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                    local.get 4
                    i32.load8_u offset=552
                    local.tee 6
                    i32.const 255
                    i32.ne
                    br_if 1 (;@7;)
                    local.get 4
                    local.get 4
                    i64.load offset=556 align=4
                    i64.store offset=156 align=4
                    local.get 4
                    i32.const 3
                    i32.store8 offset=152
                    local.get 4
                    local.get 3
                    i32.store offset=148
                    local.get 4
                    local.get 5
                    i32.store offset=144
                    local.get 4
                    i32.const 0
                    i32.store16 offset=184
                    local.get 4
                    i32.const 1066658
                    i32.store offset=180
                    local.get 4
                    i32.const 1066651
                    i32.store offset=176
                    local.get 4
                    i32.const 552
                    i32.add
                    local.get 4
                    i32.const 176
                    i32.add
                    call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                    local.get 4
                    i32.load8_u offset=552
                    local.tee 3
                    i32.const 255
                    i32.ne
                    br_if 2 (;@6;)
                    local.get 4
                    local.get 4
                    i64.load offset=556 align=4
                    i64.store offset=168 align=4
                    local.get 4
                    i32.const 0
                    i32.store16 offset=448
                    local.get 4
                    i32.const 1066664
                    i32.store offset=444
                    local.get 4
                    i32.const 1066658
                    i32.store offset=440
                    local.get 4
                    i32.const 552
                    i32.add
                    local.get 4
                    i32.const 440
                    i32.add
                    call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                    local.get 4
                    i32.load8_u offset=552
                    local.tee 3
                    i32.const 255
                    i32.ne
                    br_if 3 (;@5;)
                    local.get 4
                    local.get 4
                    i64.load offset=556 align=4
                    i64.store offset=212 align=4
                    local.get 4
                    i32.const 3
                    i32.store8 offset=208
                    local.get 1
                    i32.load offset=16
                    local.tee 3
                    i32.const 1
                    i32.le_u
                    br_if 4 (;@4;)
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    local.get 1
                                    i32.load offset=12
                                    local.tee 5
                                    i32.load8_u offset=24
                                    local.tee 6
                                    br_table 6 (;@10;) 6 (;@10;) 0 (;@16;) 1 (;@15;) 2 (;@14;) 3 (;@13;) 4 (;@12;) 5 (;@11;) 6 (;@10;)
                                  end
                                  local.get 5
                                  i64.load offset=32
                                  local.set 7
                                  br 13 (;@2;)
                                end
                                local.get 5
                                i32.load offset=28
                                local.tee 3
                                local.get 3
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 8
                                i32.store
                                local.get 8
                                i32.eqz
                                br_if 13 (;@1;)
                                br 11 (;@3;)
                              end
                              local.get 5
                              i32.load offset=28
                              local.tee 3
                              local.get 3
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 8
                              i32.store
                              local.get 8
                              i32.eqz
                              br_if 12 (;@1;)
                              local.get 5
                              i64.load8_u offset=36
                              i64.const 32
                              i64.shl
                              local.get 5
                              i64.load32_u offset=32
                              i64.or
                              local.set 7
                              br 11 (;@2;)
                            end
                            local.get 5
                            i32.load offset=28
                            local.tee 3
                            local.get 3
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 8
                            i32.store
                            local.get 8
                            br_if 9 (;@3;)
                            br 11 (;@1;)
                          end
                          local.get 5
                          i32.load offset=28
                          local.tee 3
                          local.get 3
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 8
                          i32.store
                          local.get 8
                          br_if 8 (;@3;)
                          br 10 (;@1;)
                        end
                        local.get 5
                        i32.load offset=28
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
                      local.get 5
                      i32.load8_u offset=25
                      local.set 5
                    end
                    br 6 (;@2;)
                  end
                  local.get 4
                  local.get 4
                  i32.load8_u offset=555
                  i32.store8 offset=515
                  local.get 4
                  local.get 4
                  i32.load16_u offset=553 align=1
                  i32.store16 offset=513 align=1
                  local.get 4
                  local.get 4
                  i32.load offset=564
                  i32.store offset=524
                  local.get 4
                  local.get 4
                  i64.load offset=556 align=4
                  i64.store offset=516 align=4
                  local.get 4
                  local.get 3
                  i32.store8 offset=512
                  i32.const 1055372
                  i32.const 43
                  local.get 4
                  i32.const 512
                  i32.add
                  i32.const 1055356
                  i32.const 1055416
                  call $core::result::unwrap_failed
                  unreachable
                end
                local.get 4
                local.get 4
                i32.load8_u offset=555
                i32.store8 offset=515
                local.get 4
                local.get 4
                i32.load16_u offset=553 align=1
                i32.store16 offset=513 align=1
                local.get 4
                local.get 4
                i32.load offset=564
                i32.store offset=524
                local.get 4
                local.get 4
                i64.load offset=556 align=4
                i64.store offset=516 align=4
                local.get 4
                local.get 6
                i32.store8 offset=512
                i32.const 1055372
                i32.const 43
                local.get 4
                i32.const 512
                i32.add
                i32.const 1055356
                i32.const 1055416
                call $core::result::unwrap_failed
                unreachable
              end
              local.get 4
              local.get 4
              i32.load8_u offset=555
              i32.store8 offset=515
              local.get 4
              local.get 4
              i32.load16_u offset=553 align=1
              i32.store16 offset=513 align=1
              local.get 4
              local.get 4
              i32.load offset=564
              i32.store offset=524
              local.get 4
              local.get 4
              i64.load offset=556 align=4
              i64.store offset=516 align=4
              local.get 4
              local.get 3
              i32.store8 offset=512
              i32.const 1055372
              i32.const 43
              local.get 4
              i32.const 512
              i32.add
              i32.const 1055356
              i32.const 1055416
              call $core::result::unwrap_failed
              unreachable
            end
            local.get 4
            local.get 4
            i32.load8_u offset=555
            i32.store8 offset=515
            local.get 4
            local.get 4
            i32.load16_u offset=553 align=1
            i32.store16 offset=513 align=1
            local.get 4
            local.get 4
            i32.load offset=564
            i32.store offset=524
            local.get 4
            local.get 4
            i64.load offset=556 align=4
            i64.store offset=516 align=4
            local.get 4
            local.get 3
            i32.store8 offset=512
            i32.const 1055372
            i32.const 43
            local.get 4
            i32.const 512
            i32.add
            i32.const 1055356
            i32.const 1055416
            call $core::result::unwrap_failed
            unreachable
          end
          i32.const 1
          local.get 3
          i32.const 1062708
          call $core::panicking::panic_bounds_check
          unreachable
        end
        local.get 5
        i64.load32_u offset=32
        local.set 7
      end
      local.get 4
      local.get 7
      i64.store offset=256
      local.get 4
      local.get 3
      i32.store offset=252
      local.get 4
      local.get 5
      i32.store8 offset=249
      local.get 4
      local.get 6
      i32.store8 offset=248
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            local.get 1
            i32.load offset=16
            local.tee 3
            i32.const 2
            i32.le_u
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
                            local.tee 3
                            i32.load8_u offset=40
                            local.tee 6
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 3
                          i64.load offset=48
                          local.set 7
                          br 9 (;@2;)
                        end
                        local.get 3
                        i32.load offset=44
                        local.tee 5
                        local.get 5
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
                      local.get 3
                      i32.load offset=44
                      local.tee 5
                      local.get 5
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 8
                      i32.store
                      local.get 8
                      i32.eqz
                      br_if 8 (;@1;)
                      local.get 3
                      i64.load8_u offset=52
                      i64.const 32
                      i64.shl
                      local.get 3
                      i64.load32_u offset=48
                      i64.or
                      local.set 7
                      br 7 (;@2;)
                    end
                    local.get 3
                    i32.load offset=44
                    local.tee 5
                    local.get 5
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 8
                    i32.store
                    local.get 8
                    i32.eqz
                    br_if 7 (;@1;)
                    br 5 (;@3;)
                  end
                  local.get 3
                  i32.load offset=44
                  local.tee 5
                  local.get 5
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 8
                  i32.store
                  local.get 8
                  i32.eqz
                  br_if 6 (;@1;)
                  br 4 (;@3;)
                end
                local.get 3
                i32.load offset=44
                local.tee 5
                local.get 5
                i32.load
                i32.const 1
                i32.add
                local.tee 3
                i32.store
                local.get 3
                i32.eqz
                br_if 5 (;@1;)
                br 1 (;@5;)
              end
              local.get 3
              i32.load8_u offset=41
              local.set 3
            end
            br 2 (;@2;)
          end
          i32.const 2
          local.get 3
          i32.const 1062708
          call $core::panicking::panic_bounds_check
          unreachable
        end
        local.get 3
        i64.load32_u offset=48
        local.set 7
      end
      local.get 4
      local.get 7
      i64.store offset=312
      local.get 4
      local.get 5
      i32.store offset=308
      local.get 4
      local.get 3
      i32.store8 offset=305
      local.get 4
      local.get 6
      i32.store8 offset=304
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            local.get 1
            i32.load offset=16
            local.tee 3
            i32.const 3
            i32.le_u
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
                            local.tee 3
                            i32.load8_u offset=56
                            local.tee 6
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 3
                          i64.load offset=64
                          local.set 7
                          br 9 (;@2;)
                        end
                        local.get 3
                        i32.load offset=60
                        local.tee 5
                        local.get 5
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
                      local.get 3
                      i32.load offset=60
                      local.tee 5
                      local.get 5
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 8
                      i32.store
                      local.get 8
                      i32.eqz
                      br_if 8 (;@1;)
                      local.get 3
                      i64.load8_u offset=68
                      i64.const 32
                      i64.shl
                      local.get 3
                      i64.load32_u offset=64
                      i64.or
                      local.set 7
                      br 7 (;@2;)
                    end
                    local.get 3
                    i32.load offset=60
                    local.tee 5
                    local.get 5
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 8
                    i32.store
                    local.get 8
                    i32.eqz
                    br_if 7 (;@1;)
                    br 5 (;@3;)
                  end
                  local.get 3
                  i32.load offset=60
                  local.tee 5
                  local.get 5
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 8
                  i32.store
                  local.get 8
                  i32.eqz
                  br_if 6 (;@1;)
                  br 4 (;@3;)
                end
                local.get 3
                i32.load offset=60
                local.tee 5
                local.get 5
                i32.load
                i32.const 1
                i32.add
                local.tee 3
                i32.store
                local.get 3
                i32.eqz
                br_if 5 (;@1;)
                br 1 (;@5;)
              end
              local.get 3
              i32.load8_u offset=57
              local.set 3
            end
            br 2 (;@2;)
          end
          i32.const 3
          local.get 3
          i32.const 1062708
          call $core::panicking::panic_bounds_check
          unreachable
        end
        local.get 3
        i64.load32_u offset=64
        local.set 7
      end
      local.get 4
      local.get 7
      i64.store offset=384
      local.get 4
      local.get 5
      i32.store offset=380
      local.get 4
      local.get 3
      i32.store8 offset=377
      local.get 4
      local.get 6
      i32.store8 offset=376
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
                            local.tee 3
                            i32.load8_u offset=8
                            local.tee 6
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 3
                          i64.load offset=16
                          local.set 7
                          br 9 (;@2;)
                        end
                        local.get 3
                        i32.load offset=12
                        local.tee 5
                        local.get 5
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
                      local.get 3
                      i32.load offset=12
                      local.tee 5
                      local.get 5
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 8
                      i32.store
                      local.get 8
                      i32.eqz
                      br_if 8 (;@1;)
                      local.get 3
                      i64.load8_u offset=20
                      i64.const 32
                      i64.shl
                      local.get 3
                      i64.load32_u offset=16
                      i64.or
                      local.set 7
                      br 7 (;@2;)
                    end
                    local.get 3
                    i32.load offset=12
                    local.tee 5
                    local.get 5
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 8
                    i32.store
                    local.get 8
                    i32.eqz
                    br_if 7 (;@1;)
                    br 5 (;@3;)
                  end
                  local.get 3
                  i32.load offset=12
                  local.tee 5
                  local.get 5
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 8
                  i32.store
                  local.get 8
                  i32.eqz
                  br_if 6 (;@1;)
                  br 4 (;@3;)
                end
                local.get 3
                i32.load offset=12
                local.tee 5
                local.get 5
                i32.load
                i32.const 1
                i32.add
                local.tee 3
                i32.store
                local.get 3
                i32.eqz
                br_if 5 (;@1;)
                br 1 (;@5;)
              end
              local.get 3
              i32.load8_u offset=9
              local.set 3
            end
            br 2 (;@2;)
          end
          i32.const 0
          i32.const 0
          i32.const 1062708
          call $core::panicking::panic_bounds_check
          unreachable
        end
        local.get 3
        i64.load32_u offset=16
        local.set 7
      end
      local.get 4
      local.get 7
      i64.store offset=488
      local.get 4
      local.get 5
      i32.store offset=484
      local.get 4
      local.get 3
      i32.store8 offset=481
      local.get 4
      local.get 6
      i32.store8 offset=480
      local.get 4
      i32.const 0
      i32.store8 offset=551
      local.get 4
      i64.const 4607182418800017408
      i64.store offset=584
      local.get 4
      i32.const 2
      i32.store8 offset=576
      local.get 4
      i64.const 4681608360884174848
      i64.store offset=568
      local.get 4
      i32.const 2
      i32.store8 offset=560
      local.get 4
      i64.const 8589934592
      i64.store offset=552
      local.get 4
      local.get 4
      i32.const 551
      i32.add
      i32.store offset=592
      local.get 4
      i32.const 56
      i32.add
      local.get 4
      i32.const 552
      i32.add
      call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
      local.get 4
      local.get 4
      i32.load offset=60
      local.tee 5
      i32.store offset=500
      local.get 4
      local.get 4
      i32.load offset=56
      local.tee 3
      i32.store offset=496
      block ;; label = @2
        block ;; label = @3
          local.get 4
          i32.load8_u offset=551
          i32.const 1
          i32.ne
          br_if 0 (;@3;)
          local.get 3
          local.get 3
          i32.load
          i32.const -1
          i32.add
          local.tee 1
          i32.store
          local.get 1
          br_if 1 (;@2;)
          local.get 4
          i32.const 496
          i32.add
          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
          br 1 (;@2;)
        end
        local.get 3
        i32.eqz
        br_if 0 (;@2;)
        local.get 4
        i32.const 152
        i32.add
        local.set 6
        local.get 4
        local.get 5
        i32.store offset=504
        local.get 4
        local.get 3
        i32.store offset=500
        local.get 4
        i32.const 6
        i32.store8 offset=496
        local.get 4
        i32.const 552
        i32.add
        local.get 4
        i32.const 480
        i32.add
        local.get 4
        i32.const 496
        i32.add
        call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
        local.get 4
        local.get 4
        i64.load offset=560
        i64.store offset=464
        local.get 4
        local.get 4
        i64.load offset=568
        i64.store offset=472
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
                          i64.load offset=552
                          i64.const 1
                          i64.ne
                          br_if 0 (;@11;)
                          local.get 0
                          local.get 4
                          i64.load offset=472
                          i64.store offset=16
                          local.get 0
                          local.get 4
                          i64.load offset=464
                          i64.store offset=8
                          local.get 0
                          i64.const 1
                          i64.store
                          local.get 4
                          i32.const 376
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.const 304
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.const 248
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.const 208
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.load offset=168
                          local.tee 1
                          local.get 1
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 1
                          i32.store
                          block ;; label = @12
                            local.get 1
                            br_if 0 (;@12;)
                            local.get 4
                            i32.const 168
                            i32.add
                            call $"<alloc::rc::Rc<[u16]>>::drop_slow"
                          end
                          local.get 4
                          i32.load offset=144
                          local.tee 1
                          local.get 1
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 1
                          i32.store
                          block ;; label = @12
                            local.get 1
                            br_if 0 (;@12;)
                            local.get 4
                            i32.const 144
                            i32.add
                            call $"<alloc::rc::Rc<[u16]>>::drop_slow"
                          end
                          local.get 6
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          br 1 (;@10;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=472
                        i64.store offset=528
                        local.get 4
                        local.get 4
                        i64.load offset=464
                        i64.store offset=520
                        local.get 4
                        i64.const 1
                        i64.store offset=512
                        local.get 4
                        i32.const 440
                        i32.add
                        local.get 4
                        i32.const 512
                        i32.add
                        call $"nanvm_lib::vm::unstable::spread_array::<nanvm_lib::naive::Naive, [nanvm_lib::vm::unstable::ArrayItem<nanvm_lib::naive::Naive>; 1]>"
                        local.get 4
                        local.get 4
                        i64.load offset=448
                        i64.store offset=424
                        local.get 4
                        local.get 4
                        i64.load offset=456
                        i64.store offset=432
                        block ;; label = @11
                          local.get 4
                          i64.load offset=440
                          i64.const 1
                          i64.ne
                          br_if 0 (;@11;)
                          local.get 0
                          local.get 4
                          i64.load offset=432
                          i64.store offset=16
                          local.get 0
                          local.get 4
                          i64.load offset=424
                          i64.store offset=8
                          local.get 0
                          i64.const 1
                          i64.store
                          local.get 4
                          i32.const 376
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.const 304
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.const 248
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.const 208
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.load offset=168
                          local.tee 1
                          local.get 1
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 1
                          i32.store
                          block ;; label = @12
                            local.get 1
                            br_if 0 (;@12;)
                            local.get 4
                            i32.const 168
                            i32.add
                            call $"<alloc::rc::Rc<[u16]>>::drop_slow"
                          end
                          local.get 4
                          i32.load offset=144
                          local.tee 1
                          local.get 1
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 1
                          i32.store
                          block ;; label = @12
                            local.get 1
                            br_if 0 (;@12;)
                            local.get 4
                            i32.const 144
                            i32.add
                            call $"<alloc::rc::Rc<[u16]>>::drop_slow"
                          end
                          local.get 6
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          br 1 (;@10;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=432
                        i64.store offset=504
                        local.get 4
                        local.get 4
                        i64.load offset=424
                        i64.store offset=496
                        local.get 4
                        i64.const 0
                        i64.store offset=560
                        local.get 4
                        i32.const 2
                        i32.store8 offset=552
                        local.get 4
                        i32.const 512
                        i32.add
                        local.get 4
                        i32.const 496
                        i32.add
                        local.get 4
                        i32.const 552
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=512
                          i32.const 255
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 0
                          local.get 4
                          i64.load offset=528
                          i64.store offset=16
                          local.get 0
                          local.get 4
                          i64.load offset=520
                          i64.store offset=8
                          local.get 0
                          i64.const 1
                          i64.store
                          local.get 4
                          i32.const 376
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.const 304
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.const 248
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.const 208
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.load offset=168
                          local.tee 1
                          local.get 1
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 1
                          i32.store
                          block ;; label = @12
                            local.get 1
                            br_if 0 (;@12;)
                            local.get 4
                            i32.const 168
                            i32.add
                            call $"<alloc::rc::Rc<[u16]>>::drop_slow"
                          end
                          local.get 4
                          i32.load offset=144
                          local.tee 1
                          local.get 1
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 1
                          i32.store
                          block ;; label = @12
                            local.get 1
                            br_if 0 (;@12;)
                            local.get 4
                            i32.const 144
                            i32.add
                            call $"<alloc::rc::Rc<[u16]>>::drop_slow"
                          end
                          local.get 6
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          br 1 (;@10;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=536
                        i64.store offset=576
                        local.get 4
                        local.get 4
                        i64.load offset=528
                        i64.store offset=568
                        local.get 4
                        local.get 4
                        i64.load offset=520
                        i64.store offset=560
                        local.get 4
                        local.get 4
                        i64.load offset=512
                        i64.store offset=552
                        local.get 4
                        i32.const 440
                        i32.add
                        local.get 4
                        i32.const 552
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                        i32.const 1
                        local.set 3
                        i32.const 0
                        local.set 5
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=440
                          local.tee 8
                          i32.const 255
                          i32.eq
                          br_if 0 (;@11;)
                          local.get 4
                          local.get 4
                          i64.load offset=442 align=2
                          i64.store offset=408
                          local.get 4
                          local.get 4
                          i64.load offset=448 align=2
                          i64.store offset=414 align=2
                          local.get 4
                          i32.load8_u offset=441
                          local.set 3
                          local.get 8
                          local.set 5
                        end
                        local.get 4
                        i32.const 552
                        i32.add
                        call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 568
                        i32.add
                        call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 0
                        i32.store8 offset=480
                        local.get 4
                        local.get 3
                        i32.store8 offset=561
                        local.get 4
                        local.get 5
                        i32.store8 offset=560
                        local.get 4
                        i64.const 4294967296
                        i64.store offset=552
                        local.get 4
                        local.get 4
                        i64.load offset=408
                        i64.store offset=562 align=2
                        local.get 4
                        local.get 4
                        i64.load offset=414 align=2
                        i64.store offset=568 align=2
                        local.get 4
                        local.get 4
                        i32.const 480
                        i32.add
                        i32.store offset=576
                        local.get 4
                        i32.const 48
                        i32.add
                        local.get 4
                        i32.const 552
                        i32.add
                        call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                        local.get 4
                        local.get 4
                        i32.load offset=52
                        local.tee 5
                        i32.store offset=444
                        local.get 4
                        local.get 4
                        i32.load offset=48
                        local.tee 3
                        i32.store offset=440
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=480
                          i32.const 1
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 3
                          local.get 3
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 1
                          i32.store
                          local.get 1
                          br_if 8 (;@3;)
                          local.get 4
                          i32.const 440
                          i32.add
                          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                          br 8 (;@3;)
                        end
                        local.get 3
                        i32.eqz
                        br_if 7 (;@3;)
                        local.get 4
                        local.get 5
                        i32.store offset=400
                        local.get 4
                        local.get 3
                        i32.store offset=396
                        local.get 4
                        i32.const 6
                        i32.store8 offset=392
                        local.get 4
                        i32.const 352
                        i32.add
                        local.get 4
                        i32.const 376
                        i32.add
                        local.get 4
                        i32.const 392
                        i32.add
                        call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
                        local.get 4
                        local.get 4
                        i64.load offset=360
                        i64.store offset=336
                        local.get 4
                        local.get 4
                        i64.load offset=368
                        i64.store offset=344
                        block ;; label = @11
                          local.get 4
                          i64.load offset=352
                          i64.const 1
                          i64.ne
                          br_if 0 (;@11;)
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
                          i32.const 304
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.const 248
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.const 208
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.load offset=168
                          local.tee 1
                          local.get 1
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 1
                          i32.store
                          block ;; label = @12
                            local.get 1
                            br_if 0 (;@12;)
                            local.get 4
                            i32.const 168
                            i32.add
                            call $"<alloc::rc::Rc<[u16]>>::drop_slow"
                          end
                          local.get 4
                          i32.load offset=144
                          local.tee 1
                          local.get 1
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 1
                          i32.store
                          block ;; label = @12
                            local.get 1
                            br_if 0 (;@12;)
                            local.get 4
                            i32.const 144
                            i32.add
                            call $"<alloc::rc::Rc<[u16]>>::drop_slow"
                          end
                          local.get 6
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          br 1 (;@10;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=344
                        i64.store offset=568
                        local.get 4
                        local.get 4
                        i64.load offset=336
                        i64.store offset=560
                        local.get 4
                        i32.const 0
                        i32.store8 offset=352
                        local.get 4
                        i64.const 4294967296
                        i64.store offset=552
                        local.get 4
                        local.get 4
                        i32.const 352
                        i32.add
                        i32.store offset=576
                        local.get 4
                        i32.const 40
                        i32.add
                        local.get 4
                        i32.const 552
                        i32.add
                        call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                        local.get 4
                        local.get 4
                        i32.load offset=44
                        local.tee 8
                        i32.store offset=444
                        local.get 4
                        local.get 4
                        i32.load offset=40
                        local.tee 3
                        i32.store offset=440
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=352
                          i32.const 1
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 3
                          local.get 3
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 1
                          i32.store
                          local.get 1
                          br_if 7 (;@4;)
                          local.get 4
                          i32.const 440
                          i32.add
                          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                          br 7 (;@4;)
                        end
                        local.get 3
                        i32.eqz
                        br_if 6 (;@4;)
                        local.get 4
                        i32.const 280
                        i32.add
                        i32.const 8
                        i32.add
                        local.set 5
                        local.get 4
                        local.get 8
                        i32.store offset=328
                        local.get 4
                        local.get 3
                        i32.store offset=324
                        local.get 4
                        i32.const 6
                        i32.store8 offset=320
                        local.get 4
                        i32.const 280
                        i32.add
                        local.get 4
                        i32.const 304
                        i32.add
                        local.get 4
                        i32.const 320
                        i32.add
                        call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
                        block ;; label = @11
                          local.get 4
                          i64.load offset=280
                          i64.const 1
                          i64.ne
                          br_if 0 (;@11;)
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
                          local.get 4
                          i32.const 248
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.const 208
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.load offset=168
                          local.tee 1
                          local.get 1
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 1
                          i32.store
                          block ;; label = @12
                            local.get 1
                            br_if 0 (;@12;)
                            local.get 4
                            i32.const 168
                            i32.add
                            call $"<alloc::rc::Rc<[u16]>>::drop_slow"
                          end
                          local.get 4
                          i32.load offset=144
                          local.tee 1
                          local.get 1
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 1
                          i32.store
                          block ;; label = @12
                            local.get 1
                            br_if 0 (;@12;)
                            local.get 4
                            i32.const 144
                            i32.add
                            call $"<alloc::rc::Rc<[u16]>>::drop_slow"
                          end
                          local.get 6
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          br 1 (;@10;)
                        end
                        local.get 4
                        local.get 5
                        i64.load offset=8
                        i64.store offset=568
                        local.get 4
                        local.get 5
                        i64.load
                        i64.store offset=560
                        local.get 4
                        i32.const 0
                        i32.store8 offset=352
                        local.get 4
                        i64.const 4294967296
                        i64.store offset=552
                        local.get 4
                        local.get 4
                        i32.const 352
                        i32.add
                        i32.store offset=576
                        local.get 4
                        i32.const 32
                        i32.add
                        local.get 4
                        i32.const 552
                        i32.add
                        call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                        local.get 4
                        local.get 4
                        i32.load offset=36
                        local.tee 6
                        i32.store offset=444
                        local.get 4
                        local.get 4
                        i32.load offset=32
                        local.tee 3
                        i32.store offset=440
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=352
                          i32.const 1
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 3
                          local.get 3
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 1
                          i32.store
                          local.get 1
                          br_if 6 (;@5;)
                          local.get 4
                          i32.const 440
                          i32.add
                          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                          br 6 (;@5;)
                        end
                        local.get 3
                        i32.eqz
                        br_if 5 (;@5;)
                        local.get 4
                        i32.const 224
                        i32.add
                        i32.const 8
                        i32.add
                        local.set 5
                        local.get 4
                        local.get 6
                        i32.store offset=272
                        local.get 4
                        local.get 3
                        i32.store offset=268
                        local.get 4
                        i32.const 6
                        i32.store8 offset=264
                        local.get 4
                        i32.const 224
                        i32.add
                        local.get 4
                        i32.const 248
                        i32.add
                        local.get 4
                        i32.const 264
                        i32.add
                        call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
                        local.get 4
                        i64.load offset=224
                        i64.const 1
                        i64.ne
                        br_if 1 (;@9;)
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
                        local.get 4
                        i32.const 208
                        i32.add
                        call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.load offset=168
                        local.tee 1
                        local.get 1
                        i32.load
                        i32.const -1
                        i32.add
                        local.tee 1
                        i32.store
                        block ;; label = @11
                          local.get 1
                          br_if 0 (;@11;)
                          local.get 4
                          i32.const 168
                          i32.add
                          call $"<alloc::rc::Rc<[u16]>>::drop_slow"
                        end
                        local.get 4
                        i32.const 144
                        i32.add
                        call $"core::ptr::drop_glue::<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>"
                      end
                      local.get 2
                      local.get 2
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 1
                      i32.store
                      local.get 1
                      i32.eqz
                      br_if 1 (;@8;)
                      br 2 (;@7;)
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=208
                    i64.store offset=176
                    local.get 4
                    local.get 4
                    i64.load offset=216
                    i64.store offset=184
                    local.get 4
                    local.get 5
                    i64.load offset=8
                    i64.store offset=200
                    local.get 4
                    local.get 5
                    i64.load
                    i64.store offset=192
                    local.get 4
                    i32.const 24
                    i32.add
                    local.get 4
                    i32.const 176
                    i32.add
                    call $"<nanvm_lib::naive::container::Container<(), nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as nanvm_lib::vm::internal::icontainer::IContainer<nanvm_lib::naive::Naive>>::new_ok::<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>; 2]>"
                    local.get 4
                    i32.const 6
                    i32.store8 offset=104
                    local.get 4
                    local.get 4
                    i64.load offset=24
                    i64.store offset=108 align=4
                    local.get 4
                    i32.load offset=168
                    local.set 3
                    local.get 4
                    i32.load offset=172
                    local.set 5
                    local.get 4
                    i32.const 16
                    i32.add
                    i32.const 1066664
                    i32.const 12
                    call $"<nanvm_lib::vm::string::String<nanvm_lib::naive::Naive> as core::convert::From<&str>>::from"
                    local.get 1
                    i32.load offset=16
                    local.tee 6
                    i32.const 4
                    i32.le_u
                    br_if 2 (;@6;)
                    local.get 4
                    i32.load offset=20
                    local.set 6
                    local.get 4
                    i32.load offset=16
                    local.set 8
                    local.get 4
                    i32.const 552
                    i32.add
                    local.get 1
                    i32.load offset=12
                    i32.const 72
                    i32.add
                    call $"#func721 <nanvm_lib::naive::Naive as core::clone::Clone>::clone"
                    local.get 4
                    i32.const 8
                    i32.add
                    local.get 4
                    i32.const 552
                    i32.add
                    call $"<nanvm_lib::naive::container::Container<(), nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as nanvm_lib::vm::internal::icontainer::IContainer<nanvm_lib::naive::Naive>>::new_ok::<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>; 1]>"
                    local.get 4
                    i32.const 240
                    i32.const 0
                    local.get 4
                    i32.load offset=8
                    local.get 4
                    i32.load offset=12
                    i32.const 1066676
                    i32.const 24
                    call $<nanvm_lib::naive::function::Function>::new
                    i32.store offset=132
                    local.get 4
                    i32.const 7
                    i32.store8 offset=128
                    local.get 4
                    local.get 6
                    i32.store offset=124
                    local.get 4
                    local.get 8
                    i32.store offset=120
                    local.get 4
                    local.get 5
                    i32.store offset=100
                    local.get 4
                    local.get 3
                    i32.store offset=96
                    local.get 4
                    local.get 4
                    i64.load offset=144
                    i64.store offset=72
                    local.get 4
                    local.get 4
                    i64.load offset=152
                    i64.store offset=80
                    local.get 4
                    local.get 4
                    i64.load offset=160
                    i64.store offset=88
                    local.get 4
                    local.get 4
                    i32.const 72
                    i32.add
                    call $"<nanvm_lib::naive::container::Container<(), (nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)> as nanvm_lib::vm::internal::icontainer::IContainer<nanvm_lib::naive::Naive>>::new_ok::<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>); 3]>"
                    local.get 0
                    local.get 4
                    i64.load
                    i64.store offset=12 align=4
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
                    local.tee 1
                    i32.store
                    local.get 1
                    br_if 1 (;@7;)
                  end
                  local.get 4
                  i32.const 64
                  i32.add
                  call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                end
                local.get 4
                i32.const 608
                i32.add
                global.set $__stack_pointer
                return
              end
              i32.const 4
              local.get 6
              i32.const 1062708
              call $core::panicking::panic_bounds_check
              unreachable
            end
            i32.const 1053928
            i32.const 43
            local.get 4
            i32.const 607
            i32.add
            i32.const 1053912
            i32.const 1053972
            call $core::result::unwrap_failed
            unreachable
          end
          i32.const 1053928
          i32.const 43
          local.get 4
          i32.const 607
          i32.add
          i32.const 1053912
          i32.const 1053972
          call $core::result::unwrap_failed
          unreachable
        end
        i32.const 1053928
        i32.const 43
        local.get 4
        i32.const 607
        i32.add
        i32.const 1053912
        i32.const 1053972
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1053928
      i32.const 43
      local.get 4
      i32.const 607
      i32.add
      i32.const 1053912
      i32.const 1053972
      call $core::result::unwrap_failed
      unreachable
    end
    unreachable
  )
  (func $"<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#2}::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;722;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i64 f64 i64)
    global.get $__stack_pointer
    i32.const 752
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 1
    i32.load
    local.set 5
    local.get 4
    local.get 3
    i32.store offset=36
    local.get 4
    local.get 2
    i32.store offset=32
    local.get 4
    i32.const 40
    i32.add
    local.get 4
    i32.const 32
    i32.add
    i32.const 0
    call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
    local.get 4
    i32.const 696
    i32.add
    i32.const 8
    i32.add
    local.set 1
    local.get 4
    i32.const 696
    i32.add
    i32.const 16
    i32.add
    local.set 6
    local.get 4
    i32.const 104
    i32.add
    i32.const 2
    i32.or
    local.set 7
    local.get 4
    i32.const 136
    i32.add
    i32.const 2
    i32.or
    local.set 8
    local.get 4
    i32.const 696
    i32.add
    i32.const 2
    i32.or
    local.set 9
    local.get 4
    i32.const 136
    i32.add
    i32.const 16
    i32.add
    local.set 10
    local.get 4
    i32.const 216
    i32.add
    i32.const 8
    i32.add
    local.set 11
    local.get 4
    i32.const 304
    i32.add
    i32.const 8
    i32.add
    local.set 12
    local.get 4
    i32.const 344
    i32.add
    i32.const 8
    i32.add
    local.set 13
    local.get 4
    i32.const 416
    i32.add
    i32.const 8
    i32.add
    local.set 3
    local.get 4
    i32.const 136
    i32.add
    i32.const 8
    i32.add
    local.set 14
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
                          block ;; label = @12
                            block ;; label = @13
                              loop ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        block ;; label = @19
                                          block ;; label = @20
                                            block ;; label = @21
                                              block ;; label = @22
                                                block ;; label = @23
                                                  block ;; label = @24
                                                    block ;; label = @25
                                                      local.get 4
                                                      i32.load8_u offset=40
                                                      local.tee 15
                                                      br_table 2 (;@23;) 3 (;@22;) 8 (;@17;) 0 (;@25;) 5 (;@20;) 6 (;@19;) 7 (;@18;) 1 (;@24;) 2 (;@23;)
                                                    end
                                                    local.get 4
                                                    i32.load offset=44
                                                    local.tee 2
                                                    local.get 2
                                                    i32.load
                                                    i32.const 1
                                                    i32.add
                                                    local.tee 16
                                                    i32.store
                                                    local.get 16
                                                    br_if 3 (;@21;)
                                                    br 23 (;@1;)
                                                  end
                                                  local.get 4
                                                  i32.load offset=44
                                                  local.tee 2
                                                  local.get 2
                                                  i32.load
                                                  i32.const 1
                                                  i32.add
                                                  local.tee 16
                                                  i32.store
                                                  local.get 16
                                                  i32.eqz
                                                  br_if 22 (;@1;)
                                                  local.get 4
                                                  local.get 2
                                                  i32.store offset=684
                                                  local.get 4
                                                  i32.const 7
                                                  i32.store8 offset=680
                                                  local.get 2
                                                  local.get 2
                                                  i32.load
                                                  i32.const 1
                                                  i32.add
                                                  local.tee 17
                                                  i32.store
                                                  local.get 17
                                                  i32.eqz
                                                  br_if 22 (;@1;)
                                                  br 8 (;@15;)
                                                end
                                                local.get 4
                                                local.get 4
                                                i32.load8_u offset=41
                                                local.tee 16
                                                i32.store8 offset=681
                                                local.get 4
                                                i32.const 0
                                                i32.store8 offset=680
                                                br 7 (;@15;)
                                              end
                                              local.get 4
                                              local.get 4
                                              i32.load8_u offset=41
                                              local.tee 16
                                              i32.store8 offset=681
                                              local.get 4
                                              i32.const 1
                                              i32.store8 offset=680
                                              br 6 (;@15;)
                                            end
                                            local.get 4
                                            local.get 4
                                            i64.load32_u offset=48
                                            local.tee 18
                                            i64.store offset=688
                                            local.get 4
                                            local.get 2
                                            i32.store offset=684
                                            local.get 4
                                            i32.const 3
                                            i32.store8 offset=680
                                            local.get 2
                                            local.get 2
                                            i32.load
                                            i32.const 1
                                            i32.add
                                            local.tee 16
                                            i32.store
                                            local.get 16
                                            i32.eqz
                                            br_if 19 (;@1;)
                                            br 4 (;@16;)
                                          end
                                          local.get 4
                                          i32.load offset=44
                                          local.tee 2
                                          local.get 2
                                          i32.load
                                          i32.const 1
                                          i32.add
                                          local.tee 16
                                          i32.store
                                          local.get 16
                                          i32.eqz
                                          br_if 18 (;@1;)
                                          local.get 4
                                          i64.load8_u offset=52
                                          local.set 18
                                          local.get 4
                                          local.get 2
                                          i32.store offset=684
                                          local.get 4
                                          i32.const 4
                                          i32.store8 offset=680
                                          local.get 4
                                          local.get 18
                                          i64.const 32
                                          i64.shl
                                          local.get 4
                                          i64.load32_u offset=48
                                          i64.or
                                          local.tee 18
                                          i64.store offset=688
                                          local.get 2
                                          local.get 2
                                          i32.load
                                          i32.const 1
                                          i32.add
                                          local.tee 16
                                          i32.store
                                          local.get 16
                                          i32.eqz
                                          br_if 18 (;@1;)
                                          br 3 (;@16;)
                                        end
                                        local.get 4
                                        i32.load offset=44
                                        local.tee 2
                                        local.get 2
                                        i32.load
                                        i32.const 1
                                        i32.add
                                        local.tee 16
                                        i32.store
                                        local.get 16
                                        i32.eqz
                                        br_if 17 (;@1;)
                                        local.get 4
                                        local.get 4
                                        i64.load32_u offset=48
                                        local.tee 18
                                        i64.store offset=688
                                        local.get 4
                                        local.get 2
                                        i32.store offset=684
                                        local.get 4
                                        i32.const 5
                                        i32.store8 offset=680
                                        local.get 2
                                        local.get 2
                                        i32.load
                                        i32.const 1
                                        i32.add
                                        local.tee 16
                                        i32.store
                                        local.get 16
                                        i32.eqz
                                        br_if 17 (;@1;)
                                        br 2 (;@16;)
                                      end
                                      local.get 4
                                      i32.load offset=44
                                      local.tee 2
                                      local.get 2
                                      i32.load
                                      i32.const 1
                                      i32.add
                                      local.tee 16
                                      i32.store
                                      local.get 16
                                      i32.eqz
                                      br_if 16 (;@1;)
                                      local.get 4
                                      local.get 4
                                      i64.load32_u offset=48
                                      local.tee 18
                                      i64.store offset=688
                                      local.get 4
                                      local.get 2
                                      i32.store offset=684
                                      local.get 4
                                      i32.const 6
                                      i32.store8 offset=680
                                      local.get 2
                                      local.get 2
                                      i32.load
                                      i32.const 1
                                      i32.add
                                      local.tee 16
                                      i32.store
                                      local.get 16
                                      i32.eqz
                                      br_if 16 (;@1;)
                                      br 1 (;@16;)
                                    end
                                    local.get 4
                                    local.get 4
                                    f64.load offset=48
                                    local.tee 19
                                    f64.store offset=688
                                    local.get 4
                                    i32.const 2
                                    i32.store8 offset=680
                                    local.get 19
                                    i64.reinterpret_f64
                                    local.set 18
                                  end
                                end
                                local.get 4
                                local.get 18
                                i64.store offset=144
                                local.get 4
                                local.get 2
                                i32.store offset=140
                                local.get 4
                                local.get 16
                                i32.store8 offset=137
                                local.get 4
                                local.get 15
                                i32.store8 offset=136
                                local.get 4
                                i64.const 0
                                i64.store offset=704
                                local.get 4
                                i32.const 2
                                i32.store8 offset=696
                                local.get 4
                                i32.const 536
                                i32.add
                                local.get 4
                                i32.const 136
                                i32.add
                                local.get 4
                                i32.const 696
                                i32.add
                                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                                block ;; label = @15
                                  local.get 4
                                  i32.load8_u offset=536
                                  i32.const 255
                                  i32.ne
                                  br_if 0 (;@15;)
                                  local.get 0
                                  local.get 4
                                  i64.load offset=552
                                  i64.store offset=16
                                  local.get 0
                                  local.get 4
                                  i64.load offset=544
                                  i64.store offset=8
                                  local.get 0
                                  i64.const 1
                                  i64.store
                                  br 10 (;@5;)
                                end
                                local.get 4
                                local.get 4
                                i64.load offset=560
                                i64.store offset=720
                                local.get 4
                                local.get 4
                                i64.load offset=552
                                i64.store offset=712
                                local.get 4
                                local.get 4
                                i64.load offset=544
                                i64.store offset=704
                                local.get 4
                                local.get 4
                                i64.load offset=536
                                i64.store offset=696
                                local.get 4
                                i32.const 136
                                i32.add
                                local.get 4
                                i32.const 696
                                i32.add
                                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                                block ;; label = @15
                                  block ;; label = @16
                                    local.get 4
                                    i32.load8_u offset=136
                                    i32.const 255
                                    i32.eq
                                    br_if 0 (;@16;)
                                    local.get 4
                                    local.get 4
                                    i64.load offset=144
                                    i64.store offset=224
                                    local.get 4
                                    local.get 4
                                    i64.load offset=136
                                    i64.store offset=216
                                    br 1 (;@15;)
                                  end
                                  local.get 4
                                  i32.const 256
                                  i32.store16 offset=216
                                end
                                local.get 4
                                i32.const 696
                                i32.add
                                call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                                local.get 6
                                call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      local.get 5
                                      i32.load offset=16
                                      i32.eqz
                                      br_if 0 (;@17;)
                                      block ;; label = @18
                                        block ;; label = @19
                                          block ;; label = @20
                                            block ;; label = @21
                                              block ;; label = @22
                                                block ;; label = @23
                                                  block ;; label = @24
                                                    local.get 5
                                                    i32.load offset=12
                                                    local.tee 15
                                                    i32.load8_u offset=8
                                                    local.tee 16
                                                    br_table 6 (;@18;) 6 (;@18;) 0 (;@24;) 1 (;@23;) 2 (;@22;) 3 (;@21;) 4 (;@20;) 5 (;@19;) 6 (;@18;)
                                                  end
                                                  local.get 15
                                                  i64.load offset=16
                                                  local.set 18
                                                  br 8 (;@15;)
                                                end
                                                local.get 15
                                                i32.load offset=12
                                                local.tee 2
                                                local.get 2
                                                i32.load
                                                i32.const 1
                                                i32.add
                                                local.tee 17
                                                i32.store
                                                local.get 17
                                                i32.eqz
                                                br_if 21 (;@1;)
                                                br 6 (;@16;)
                                              end
                                              local.get 15
                                              i32.load offset=12
                                              local.tee 2
                                              local.get 2
                                              i32.load
                                              i32.const 1
                                              i32.add
                                              local.tee 17
                                              i32.store
                                              local.get 17
                                              i32.eqz
                                              br_if 20 (;@1;)
                                              local.get 15
                                              i64.load8_u offset=20
                                              i64.const 32
                                              i64.shl
                                              local.get 15
                                              i64.load32_u offset=16
                                              i64.or
                                              local.set 18
                                              br 6 (;@15;)
                                            end
                                            local.get 15
                                            i32.load offset=12
                                            local.tee 2
                                            local.get 2
                                            i32.load
                                            i32.const 1
                                            i32.add
                                            local.tee 17
                                            i32.store
                                            local.get 17
                                            i32.eqz
                                            br_if 19 (;@1;)
                                            br 4 (;@16;)
                                          end
                                          local.get 15
                                          i32.load offset=12
                                          local.tee 2
                                          local.get 2
                                          i32.load
                                          i32.const 1
                                          i32.add
                                          local.tee 17
                                          i32.store
                                          local.get 17
                                          i32.eqz
                                          br_if 18 (;@1;)
                                          br 3 (;@16;)
                                        end
                                        local.get 15
                                        i32.load offset=12
                                        local.tee 2
                                        local.get 2
                                        i32.load
                                        i32.const 1
                                        i32.add
                                        local.tee 17
                                        i32.store
                                        local.get 17
                                        i32.eqz
                                        br_if 17 (;@1;)
                                        br 3 (;@15;)
                                      end
                                      local.get 15
                                      i32.load8_u offset=9
                                      local.set 15
                                      br 2 (;@15;)
                                    end
                                    i32.const 0
                                    i32.const 0
                                    i32.const 1062708
                                    call $core::panicking::panic_bounds_check
                                    unreachable
                                  end
                                  local.get 15
                                  i64.load32_u offset=16
                                  local.set 18
                                end
                                local.get 4
                                local.get 18
                                i64.store offset=352
                                local.get 4
                                local.get 2
                                i32.store offset=348
                                local.get 4
                                local.get 15
                                i32.store8 offset=345
                                local.get 4
                                local.get 16
                                i32.store8 offset=344
                                local.get 4
                                i32.const 0
                                i32.store16 offset=448
                                local.get 4
                                i32.const 1066307
                                i32.store offset=444
                                local.get 4
                                i32.const 1066301
                                i32.store offset=440
                                local.get 4
                                i32.const 696
                                i32.add
                                local.get 4
                                i32.const 440
                                i32.add
                                call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      local.get 4
                                      i32.load8_u offset=696
                                      local.tee 2
                                      i32.const 255
                                      i32.ne
                                      br_if 0 (;@17;)
                                      local.get 4
                                      local.get 4
                                      i64.load offset=700 align=4
                                      i64.store offset=420 align=4
                                      local.get 4
                                      i32.const 3
                                      i32.store8 offset=416
                                      local.get 4
                                      i32.const 568
                                      i32.add
                                      local.get 4
                                      i32.const 344
                                      i32.add
                                      local.get 4
                                      i32.const 416
                                      i32.add
                                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                                      block ;; label = @18
                                        local.get 4
                                        i32.load8_u offset=568
                                        i32.const 255
                                        i32.ne
                                        br_if 0 (;@18;)
                                        local.get 0
                                        local.get 4
                                        i64.load offset=584
                                        i64.store offset=16
                                        local.get 0
                                        local.get 4
                                        i64.load offset=576
                                        i64.store offset=8
                                        local.get 0
                                        i64.const 1
                                        i64.store
                                        local.get 4
                                        i32.const 216
                                        i32.add
                                        call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                                        br 13 (;@5;)
                                      end
                                      local.get 4
                                      local.get 4
                                      i64.load offset=592
                                      i64.store offset=720
                                      local.get 4
                                      local.get 4
                                      i64.load offset=584
                                      i64.store offset=712
                                      local.get 4
                                      local.get 4
                                      i64.load offset=576
                                      i64.store offset=704
                                      local.get 4
                                      local.get 4
                                      i64.load offset=568
                                      i64.store offset=696
                                      local.get 4
                                      i32.const 416
                                      i32.add
                                      local.get 4
                                      i32.const 696
                                      i32.add
                                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                                      block ;; label = @18
                                        block ;; label = @19
                                          local.get 4
                                          i32.load8_u offset=416
                                          i32.const 255
                                          i32.eq
                                          br_if 0 (;@19;)
                                          local.get 4
                                          local.get 4
                                          i64.load offset=424
                                          i64.store offset=64
                                          local.get 4
                                          local.get 4
                                          i64.load offset=416
                                          i64.store offset=56
                                          br 1 (;@18;)
                                        end
                                        local.get 4
                                        i32.const 256
                                        i32.store16 offset=56
                                      end
                                      local.get 4
                                      i32.const 696
                                      i32.add
                                      call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                                      local.get 6
                                      call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                                      local.get 4
                                      i64.const 4620693217682128896
                                      i64.store offset=704
                                      local.get 4
                                      i32.const 2
                                      i32.store8 offset=696
                                      local.get 4
                                      i32.const 136
                                      i32.add
                                      local.get 4
                                      i32.const 56
                                      i32.add
                                      local.get 4
                                      i32.const 696
                                      i32.add
                                      call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::arith::Mul>::mul>"
                                      local.get 4
                                      local.get 14
                                      i64.load
                                      i64.store offset=304
                                      local.get 4
                                      local.get 14
                                      i64.load offset=8
                                      i64.store offset=312
                                      block ;; label = @18
                                        local.get 4
                                        i64.load offset=136
                                        i64.const 1
                                        i64.ne
                                        br_if 0 (;@18;)
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
                                        local.get 4
                                        i32.const 216
                                        i32.add
                                        call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                                        br 13 (;@5;)
                                      end
                                      local.get 4
                                      local.get 4
                                      i64.load offset=312
                                      i64.store offset=80
                                      local.get 4
                                      local.get 4
                                      i64.load offset=304
                                      i64.store offset=72
                                      local.get 4
                                      i32.const 696
                                      i32.add
                                      local.get 4
                                      i32.const 216
                                      i32.add
                                      local.get 4
                                      i32.const 72
                                      i32.add
                                      call $nanvm_lib::vm::any::relational::compare::<nanvm_lib::naive::Naive>
                                      local.get 4
                                      i32.load8_u offset=697
                                      local.set 2
                                      block ;; label = @18
                                        local.get 4
                                        i32.load8_u offset=696
                                        local.tee 15
                                        i32.const 255
                                        i32.eq
                                        br_if 0 (;@18;)
                                        local.get 4
                                        local.get 4
                                        i64.load offset=704 align=2
                                        i64.store offset=478 align=2
                                        local.get 4
                                        local.get 4
                                        i64.load offset=698 align=2
                                        i64.store offset=472
                                        local.get 4
                                        local.get 4
                                        i64.load offset=472
                                        i64.store offset=456
                                        local.get 4
                                        local.get 4
                                        i64.load offset=478 align=2
                                        i64.store offset=462 align=2
                                        local.get 0
                                        local.get 2
                                        i32.store8 offset=9
                                        local.get 0
                                        local.get 15
                                        i32.store8 offset=8
                                        local.get 0
                                        local.get 4
                                        i64.load offset=456
                                        i64.store offset=10 align=2
                                        local.get 0
                                        local.get 4
                                        i64.load offset=462 align=2
                                        i64.store offset=16 align=2
                                        local.get 0
                                        i64.const 1
                                        i64.store
                                        br 13 (;@5;)
                                      end
                                      local.get 4
                                      local.get 4
                                      i64.load offset=472
                                      i64.store offset=456
                                      local.get 4
                                      local.get 4
                                      i64.load offset=478 align=2
                                      i64.store offset=462 align=2
                                      local.get 9
                                      local.get 4
                                      i64.load offset=456
                                      i64.store align=2
                                      local.get 9
                                      local.get 4
                                      i64.load offset=462 align=2
                                      i64.store offset=6 align=2
                                      local.get 4
                                      local.get 2
                                      i32.const 255
                                      i32.and
                                      i32.const 255
                                      i32.eq
                                      i32.store8 offset=697
                                      local.get 4
                                      i32.const 1
                                      i32.store8 offset=696
                                      local.get 4
                                      i32.const 680
                                      i32.add
                                      call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                                      block ;; label = @18
                                        local.get 4
                                        i32.const 696
                                        i32.add
                                        call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::boolean_coercion::BooleanCoercion>
                                        br_if 0 (;@18;)
                                        local.get 4
                                        local.get 4
                                        i64.load offset=48
                                        i64.store offset=704
                                        local.get 4
                                        local.get 4
                                        i64.load offset=40
                                        local.tee 18
                                        i64.store offset=696
                                        block ;; label = @19
                                          block ;; label = @20
                                            block ;; label = @21
                                              block ;; label = @22
                                                block ;; label = @23
                                                  block ;; label = @24
                                                    block ;; label = @25
                                                      block ;; label = @26
                                                        local.get 18
                                                        i32.wrap_i64
                                                        local.tee 5
                                                        i32.const 255
                                                        i32.and
                                                        br_table 6 (;@20;) 6 (;@20;) 0 (;@26;) 1 (;@25;) 2 (;@24;) 3 (;@23;) 4 (;@22;) 5 (;@21;) 6 (;@20;)
                                                      end
                                                      local.get 4
                                                      i64.load offset=704
                                                      local.set 18
                                                      br 19 (;@6;)
                                                    end
                                                    local.get 4
                                                    i32.load offset=700
                                                    local.tee 1
                                                    local.get 1
                                                    i32.load
                                                    i32.const 1
                                                    i32.add
                                                    local.tee 3
                                                    i32.store
                                                    local.get 3
                                                    i32.eqz
                                                    br_if 23 (;@1;)
                                                    br 17 (;@7;)
                                                  end
                                                  local.get 4
                                                  i32.load offset=700
                                                  local.tee 1
                                                  local.get 1
                                                  i32.load
                                                  i32.const 1
                                                  i32.add
                                                  local.tee 3
                                                  i32.store
                                                  local.get 3
                                                  i32.eqz
                                                  br_if 22 (;@1;)
                                                  local.get 4
                                                  i64.load8_u offset=708
                                                  i64.const 32
                                                  i64.shl
                                                  local.get 4
                                                  i64.load32_u offset=704
                                                  i64.or
                                                  local.set 18
                                                  br 17 (;@6;)
                                                end
                                                local.get 4
                                                i32.load offset=700
                                                local.tee 1
                                                local.get 1
                                                i32.load
                                                i32.const 1
                                                i32.add
                                                local.tee 3
                                                i32.store
                                                local.get 3
                                                i32.eqz
                                                br_if 21 (;@1;)
                                                br 15 (;@7;)
                                              end
                                              local.get 4
                                              i32.load offset=700
                                              local.tee 1
                                              local.get 1
                                              i32.load
                                              i32.const 1
                                              i32.add
                                              local.tee 3
                                              i32.store
                                              local.get 3
                                              i32.eqz
                                              br_if 20 (;@1;)
                                              br 14 (;@7;)
                                            end
                                            local.get 4
                                            i32.load offset=700
                                            local.tee 1
                                            local.get 1
                                            i32.load
                                            i32.const 1
                                            i32.add
                                            local.tee 3
                                            i32.store
                                            local.get 3
                                            i32.eqz
                                            br_if 19 (;@1;)
                                            br 1 (;@19;)
                                          end
                                          local.get 4
                                          i32.load8_u offset=697
                                          local.set 3
                                        end
                                        br 12 (;@6;)
                                      end
                                      block ;; label = @18
                                        block ;; label = @19
                                          block ;; label = @20
                                            block ;; label = @21
                                              block ;; label = @22
                                                block ;; label = @23
                                                  block ;; label = @24
                                                    block ;; label = @25
                                                      block ;; label = @26
                                                        block ;; label = @27
                                                          local.get 4
                                                          i32.load8_u offset=40
                                                          local.tee 15
                                                          br_table 1 (;@26;) 2 (;@25;) 7 (;@20;) 3 (;@24;) 4 (;@23;) 5 (;@22;) 6 (;@21;) 0 (;@27;) 1 (;@26;)
                                                        end
                                                        local.get 4
                                                        i32.load offset=44
                                                        local.tee 2
                                                        local.get 2
                                                        i32.load
                                                        i32.const 1
                                                        i32.add
                                                        local.tee 16
                                                        i32.store
                                                        local.get 16
                                                        i32.eqz
                                                        br_if 25 (;@1;)
                                                        local.get 4
                                                        local.get 2
                                                        i32.store offset=92
                                                        local.get 4
                                                        i32.const 7
                                                        i32.store8 offset=88
                                                        local.get 2
                                                        local.get 2
                                                        i32.load
                                                        i32.const 1
                                                        i32.add
                                                        local.tee 17
                                                        i32.store
                                                        local.get 17
                                                        i32.eqz
                                                        br_if 25 (;@1;)
                                                        br 8 (;@18;)
                                                      end
                                                      local.get 4
                                                      local.get 4
                                                      i32.load8_u offset=41
                                                      local.tee 16
                                                      i32.store8 offset=89
                                                      local.get 4
                                                      i32.const 0
                                                      i32.store8 offset=88
                                                      br 7 (;@18;)
                                                    end
                                                    local.get 4
                                                    local.get 4
                                                    i32.load8_u offset=41
                                                    local.tee 16
                                                    i32.store8 offset=89
                                                    local.get 4
                                                    i32.const 1
                                                    i32.store8 offset=88
                                                    br 6 (;@18;)
                                                  end
                                                  local.get 4
                                                  i32.load offset=44
                                                  local.tee 2
                                                  local.get 2
                                                  i32.load
                                                  i32.const 1
                                                  i32.add
                                                  local.tee 16
                                                  i32.store
                                                  local.get 16
                                                  i32.eqz
                                                  br_if 22 (;@1;)
                                                  local.get 4
                                                  local.get 4
                                                  i64.load32_u offset=48
                                                  local.tee 18
                                                  i64.store offset=96
                                                  local.get 4
                                                  local.get 2
                                                  i32.store offset=92
                                                  local.get 4
                                                  i32.const 3
                                                  i32.store8 offset=88
                                                  local.get 2
                                                  local.get 2
                                                  i32.load
                                                  i32.const 1
                                                  i32.add
                                                  local.tee 16
                                                  i32.store
                                                  local.get 16
                                                  i32.eqz
                                                  br_if 22 (;@1;)
                                                  br 4 (;@19;)
                                                end
                                                local.get 4
                                                i32.load offset=44
                                                local.tee 2
                                                local.get 2
                                                i32.load
                                                i32.const 1
                                                i32.add
                                                local.tee 16
                                                i32.store
                                                local.get 16
                                                i32.eqz
                                                br_if 21 (;@1;)
                                                local.get 4
                                                i64.load8_u offset=52
                                                local.set 18
                                                local.get 4
                                                local.get 2
                                                i32.store offset=92
                                                local.get 4
                                                i32.const 4
                                                i32.store8 offset=88
                                                local.get 4
                                                local.get 18
                                                i64.const 32
                                                i64.shl
                                                local.get 4
                                                i64.load32_u offset=48
                                                i64.or
                                                local.tee 18
                                                i64.store offset=96
                                                local.get 2
                                                local.get 2
                                                i32.load
                                                i32.const 1
                                                i32.add
                                                local.tee 16
                                                i32.store
                                                local.get 16
                                                i32.eqz
                                                br_if 21 (;@1;)
                                                br 3 (;@19;)
                                              end
                                              local.get 4
                                              i32.load offset=44
                                              local.tee 2
                                              local.get 2
                                              i32.load
                                              i32.const 1
                                              i32.add
                                              local.tee 16
                                              i32.store
                                              local.get 16
                                              i32.eqz
                                              br_if 20 (;@1;)
                                              local.get 4
                                              local.get 4
                                              i64.load32_u offset=48
                                              local.tee 18
                                              i64.store offset=96
                                              local.get 4
                                              local.get 2
                                              i32.store offset=92
                                              local.get 4
                                              i32.const 5
                                              i32.store8 offset=88
                                              local.get 2
                                              local.get 2
                                              i32.load
                                              i32.const 1
                                              i32.add
                                              local.tee 16
                                              i32.store
                                              local.get 16
                                              i32.eqz
                                              br_if 20 (;@1;)
                                              br 2 (;@19;)
                                            end
                                            local.get 4
                                            i32.load offset=44
                                            local.tee 2
                                            local.get 2
                                            i32.load
                                            i32.const 1
                                            i32.add
                                            local.tee 16
                                            i32.store
                                            local.get 16
                                            i32.eqz
                                            br_if 19 (;@1;)
                                            local.get 4
                                            local.get 4
                                            i64.load32_u offset=48
                                            local.tee 18
                                            i64.store offset=96
                                            local.get 4
                                            local.get 2
                                            i32.store offset=92
                                            local.get 4
                                            i32.const 6
                                            i32.store8 offset=88
                                            local.get 2
                                            local.get 2
                                            i32.load
                                            i32.const 1
                                            i32.add
                                            local.tee 16
                                            i32.store
                                            local.get 16
                                            i32.eqz
                                            br_if 19 (;@1;)
                                            br 1 (;@19;)
                                          end
                                          local.get 4
                                          local.get 4
                                          f64.load offset=48
                                          local.tee 19
                                          f64.store offset=96
                                          local.get 4
                                          i32.const 2
                                          i32.store8 offset=88
                                          local.get 19
                                          i64.reinterpret_f64
                                          local.set 18
                                        end
                                      end
                                      local.get 4
                                      local.get 18
                                      i64.store offset=144
                                      local.get 4
                                      local.get 2
                                      i32.store offset=140
                                      local.get 4
                                      local.get 16
                                      i32.store8 offset=137
                                      local.get 4
                                      local.get 15
                                      i32.store8 offset=136
                                      local.get 4
                                      i64.const 0
                                      i64.store offset=704
                                      local.get 4
                                      i32.const 2
                                      i32.store8 offset=696
                                      local.get 4
                                      i32.const 600
                                      i32.add
                                      local.get 4
                                      i32.const 136
                                      i32.add
                                      local.get 4
                                      i32.const 696
                                      i32.add
                                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                                      block ;; label = @18
                                        local.get 4
                                        i32.load8_u offset=600
                                        i32.const 255
                                        i32.ne
                                        br_if 0 (;@18;)
                                        local.get 0
                                        local.get 4
                                        i64.load offset=616
                                        i64.store offset=16
                                        local.get 0
                                        local.get 4
                                        i64.load offset=608
                                        i64.store offset=8
                                        local.get 0
                                        i64.const 1
                                        i64.store
                                        br 9 (;@9;)
                                      end
                                      local.get 4
                                      local.get 4
                                      i64.load offset=624
                                      i64.store offset=720
                                      local.get 4
                                      local.get 4
                                      i64.load offset=616
                                      i64.store offset=712
                                      local.get 4
                                      local.get 4
                                      i64.load offset=608
                                      i64.store offset=704
                                      local.get 4
                                      local.get 4
                                      i64.load offset=600
                                      i64.store offset=696
                                      local.get 4
                                      i32.const 136
                                      i32.add
                                      local.get 4
                                      i32.const 696
                                      i32.add
                                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                                      block ;; label = @18
                                        block ;; label = @19
                                          local.get 4
                                          i32.load8_u offset=136
                                          local.tee 2
                                          i32.const 255
                                          i32.ne
                                          br_if 0 (;@19;)
                                          local.get 4
                                          i32.const 696
                                          i32.add
                                          call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                                          local.get 6
                                          call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                                          local.get 7
                                          local.get 4
                                          i64.load offset=416
                                          i64.store align=2
                                          local.get 7
                                          local.get 4
                                          i64.load offset=422 align=2
                                          i64.store offset=6 align=2
                                          local.get 4
                                          i32.const 256
                                          i32.store16 offset=104
                                          i32.const 1
                                          local.set 15
                                          i32.const 0
                                          local.set 2
                                          br 1 (;@18;)
                                        end
                                        local.get 4
                                        local.get 8
                                        i64.load align=2
                                        i64.store offset=416
                                        local.get 4
                                        local.get 8
                                        i64.load offset=6 align=2
                                        i64.store offset=422 align=2
                                        local.get 4
                                        i32.load8_u offset=137
                                        local.set 15
                                        local.get 4
                                        i32.const 696
                                        i32.add
                                        call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                                        local.get 6
                                        call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                                        local.get 7
                                        local.get 4
                                        i64.load offset=416
                                        i64.store align=2
                                        local.get 7
                                        local.get 4
                                        i64.load offset=422 align=2
                                        i64.store offset=6 align=2
                                        local.get 4
                                        local.get 15
                                        i32.store8 offset=105
                                        local.get 4
                                        local.get 2
                                        i32.store8 offset=104
                                        block ;; label = @19
                                          block ;; label = @20
                                            block ;; label = @21
                                              block ;; label = @22
                                                block ;; label = @23
                                                  block ;; label = @24
                                                    block ;; label = @25
                                                      local.get 2
                                                      br_table 7 (;@18;) 7 (;@18;) 5 (;@20;) 0 (;@25;) 1 (;@24;) 2 (;@23;) 3 (;@22;) 4 (;@21;) 7 (;@18;)
                                                    end
                                                    local.get 4
                                                    i32.load offset=108
                                                    local.tee 16
                                                    local.get 16
                                                    i32.load
                                                    i32.const 1
                                                    i32.add
                                                    local.tee 2
                                                    i32.store
                                                    local.get 2
                                                    i32.eqz
                                                    br_if 23 (;@1;)
                                                    local.get 4
                                                    i64.load32_u offset=112
                                                    local.set 18
                                                    i32.const 3
                                                    local.set 2
                                                    br 5 (;@19;)
                                                  end
                                                  local.get 4
                                                  i32.load offset=108
                                                  local.tee 16
                                                  local.get 16
                                                  i32.load
                                                  i32.const 1
                                                  i32.add
                                                  local.tee 2
                                                  i32.store
                                                  local.get 2
                                                  i32.eqz
                                                  br_if 22 (;@1;)
                                                  local.get 4
                                                  i64.load8_u offset=116
                                                  i64.const 32
                                                  i64.shl
                                                  local.get 4
                                                  i64.load32_u offset=112
                                                  i64.or
                                                  local.set 18
                                                  i32.const 4
                                                  local.set 2
                                                  br 4 (;@19;)
                                                end
                                                local.get 4
                                                i32.load offset=108
                                                local.tee 16
                                                local.get 16
                                                i32.load
                                                i32.const 1
                                                i32.add
                                                local.tee 2
                                                i32.store
                                                local.get 2
                                                i32.eqz
                                                br_if 21 (;@1;)
                                                local.get 4
                                                i64.load32_u offset=112
                                                local.set 18
                                                i32.const 5
                                                local.set 2
                                                br 3 (;@19;)
                                              end
                                              local.get 4
                                              i32.load offset=108
                                              local.tee 16
                                              local.get 16
                                              i32.load
                                              i32.const 1
                                              i32.add
                                              local.tee 2
                                              i32.store
                                              local.get 2
                                              i32.eqz
                                              br_if 20 (;@1;)
                                              local.get 4
                                              i64.load32_u offset=112
                                              local.set 18
                                              i32.const 6
                                              local.set 2
                                              br 2 (;@19;)
                                            end
                                            local.get 4
                                            i32.load offset=108
                                            local.tee 16
                                            local.get 16
                                            i32.load
                                            i32.const 1
                                            i32.add
                                            local.tee 17
                                            i32.store
                                            i32.const 7
                                            local.set 2
                                            local.get 17
                                            i32.eqz
                                            br_if 19 (;@1;)
                                            br 2 (;@18;)
                                          end
                                          i32.const 2
                                          local.set 2
                                          local.get 4
                                          i64.load offset=112
                                          local.set 18
                                        end
                                      end
                                      local.get 4
                                      local.get 18
                                      i64.store offset=352
                                      local.get 4
                                      local.get 16
                                      i32.store offset=348
                                      local.get 4
                                      local.get 15
                                      i32.store8 offset=345
                                      local.get 4
                                      local.get 2
                                      i32.store8 offset=344
                                      local.get 4
                                      i64.const 4607182418800017408
                                      i64.store offset=424
                                      local.get 4
                                      i32.const 2
                                      i32.store8 offset=416
                                      local.get 4
                                      i32.const 696
                                      i32.add
                                      local.get 4
                                      i32.const 344
                                      i32.add
                                      local.get 4
                                      i32.const 416
                                      i32.add
                                      call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
                                      local.get 4
                                      local.get 1
                                      i64.load
                                      i64.store offset=184
                                      local.get 4
                                      local.get 1
                                      i64.load offset=8
                                      i64.store offset=192
                                      block ;; label = @18
                                        local.get 4
                                        i64.load offset=696
                                        i64.const 1
                                        i64.ne
                                        br_if 0 (;@18;)
                                        local.get 0
                                        local.get 4
                                        i64.load offset=192
                                        i64.store offset=16
                                        local.get 0
                                        local.get 4
                                        i64.load offset=184
                                        i64.store offset=8
                                        local.get 0
                                        i64.const 1
                                        i64.store
                                        br 8 (;@10;)
                                      end
                                      local.get 4
                                      local.get 4
                                      i64.load offset=192
                                      i64.store offset=176
                                      local.get 4
                                      local.get 4
                                      i64.load offset=184
                                      i64.store offset=168
                                      block ;; label = @18
                                        block ;; label = @19
                                          block ;; label = @20
                                            block ;; label = @21
                                              block ;; label = @22
                                                block ;; label = @23
                                                  block ;; label = @24
                                                    local.get 4
                                                    i32.load8_u offset=88
                                                    local.tee 15
                                                    br_table 6 (;@18;) 6 (;@18;) 0 (;@24;) 1 (;@23;) 2 (;@22;) 3 (;@21;) 4 (;@20;) 5 (;@19;) 6 (;@18;)
                                                  end
                                                  local.get 4
                                                  i64.load offset=96
                                                  local.set 18
                                                  br 8 (;@15;)
                                                end
                                                local.get 4
                                                i32.load offset=92
                                                local.tee 2
                                                local.get 2
                                                i32.load
                                                i32.const 1
                                                i32.add
                                                local.tee 16
                                                i32.store
                                                local.get 16
                                                i32.eqz
                                                br_if 21 (;@1;)
                                                br 6 (;@16;)
                                              end
                                              local.get 4
                                              i32.load offset=92
                                              local.tee 2
                                              local.get 2
                                              i32.load
                                              i32.const 1
                                              i32.add
                                              local.tee 16
                                              i32.store
                                              local.get 16
                                              i32.eqz
                                              br_if 20 (;@1;)
                                              local.get 4
                                              i64.load8_u offset=100
                                              i64.const 32
                                              i64.shl
                                              local.get 4
                                              i64.load32_u offset=96
                                              i64.or
                                              local.set 18
                                              br 6 (;@15;)
                                            end
                                            local.get 4
                                            i32.load offset=92
                                            local.tee 2
                                            local.get 2
                                            i32.load
                                            i32.const 1
                                            i32.add
                                            local.tee 16
                                            i32.store
                                            local.get 16
                                            i32.eqz
                                            br_if 19 (;@1;)
                                            br 4 (;@16;)
                                          end
                                          local.get 4
                                          i32.load offset=92
                                          local.tee 2
                                          local.get 2
                                          i32.load
                                          i32.const 1
                                          i32.add
                                          local.tee 16
                                          i32.store
                                          local.get 16
                                          i32.eqz
                                          br_if 18 (;@1;)
                                          br 3 (;@16;)
                                        end
                                        local.get 4
                                        i32.load offset=92
                                        local.tee 2
                                        local.get 2
                                        i32.load
                                        i32.const 1
                                        i32.add
                                        local.tee 17
                                        i32.store
                                        local.get 17
                                        i32.eqz
                                        br_if 17 (;@1;)
                                        br 3 (;@15;)
                                      end
                                      local.get 4
                                      i32.load8_u offset=89
                                      local.set 16
                                      br 2 (;@15;)
                                    end
                                    local.get 4
                                    local.get 4
                                    i32.load8_u offset=699
                                    i32.store8 offset=419
                                    local.get 4
                                    local.get 4
                                    i32.load16_u offset=697 align=1
                                    i32.store16 offset=417 align=1
                                    local.get 4
                                    local.get 4
                                    i32.load offset=708
                                    i32.store offset=428
                                    local.get 4
                                    local.get 4
                                    i64.load offset=700 align=4
                                    i64.store offset=420 align=4
                                    local.get 4
                                    local.get 2
                                    i32.store8 offset=416
                                    i32.const 1055372
                                    i32.const 43
                                    local.get 4
                                    i32.const 416
                                    i32.add
                                    i32.const 1055356
                                    i32.const 1055416
                                    call $core::result::unwrap_failed
                                    unreachable
                                  end
                                  local.get 4
                                  i64.load32_u offset=96
                                  local.set 18
                                end
                                local.get 4
                                local.get 18
                                i64.store offset=352
                                local.get 4
                                local.get 2
                                i32.store offset=348
                                local.get 4
                                local.get 16
                                i32.store8 offset=345
                                local.get 4
                                local.get 15
                                i32.store8 offset=344
                                local.get 4
                                i64.const 4607182418800017408
                                i64.store offset=704
                                local.get 4
                                i32.const 2
                                i32.store8 offset=696
                                local.get 4
                                i32.const 632
                                i32.add
                                local.get 4
                                i32.const 344
                                i32.add
                                local.get 4
                                i32.const 696
                                i32.add
                                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                                block ;; label = @15
                                  local.get 4
                                  i32.load8_u offset=632
                                  i32.const 255
                                  i32.ne
                                  br_if 0 (;@15;)
                                  local.get 0
                                  local.get 4
                                  i64.load offset=648
                                  i64.store offset=16
                                  local.get 0
                                  local.get 4
                                  i64.load offset=640
                                  i64.store offset=8
                                  local.get 0
                                  i64.const 1
                                  i64.store
                                  br 4 (;@11;)
                                end
                                local.get 4
                                local.get 4
                                i64.load offset=656
                                i64.store offset=720
                                local.get 4
                                local.get 4
                                i64.load offset=648
                                i64.store offset=712
                                local.get 4
                                local.get 4
                                i64.load offset=640
                                i64.store offset=704
                                local.get 4
                                local.get 4
                                i64.load offset=632
                                i64.store offset=696
                                local.get 4
                                i32.const 344
                                i32.add
                                local.get 4
                                i32.const 696
                                i32.add
                                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                                block ;; label = @15
                                  block ;; label = @16
                                    local.get 4
                                    i32.load8_u offset=344
                                    i32.const 255
                                    i32.eq
                                    br_if 0 (;@16;)
                                    local.get 4
                                    local.get 4
                                    i64.load offset=352
                                    i64.store offset=280
                                    local.get 4
                                    local.get 4
                                    i64.load offset=344
                                    i64.store offset=272
                                    br 1 (;@15;)
                                  end
                                  local.get 4
                                  i32.const 256
                                  i32.store16 offset=272
                                end
                                local.get 4
                                i32.const 696
                                i32.add
                                call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                                local.get 6
                                call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                                local.get 4
                                i32.const 0
                                i32.store8 offset=304
                                local.get 4
                                i64.const 2
                                i64.store offset=704
                                local.get 4
                                i64.const 1
                                i64.store offset=696
                                local.get 4
                                local.get 4
                                i32.const 304
                                i32.add
                                i32.store offset=712
                                local.get 4
                                i32.const 24
                                i32.add
                                local.get 4
                                i32.const 696
                                i32.add
                                call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::once::Once<u64>, core::result::Result<u64, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<u64>>::to_rc_slice"
                                local.get 4
                                local.get 4
                                i32.load offset=28
                                local.tee 15
                                i32.store offset=348
                                local.get 4
                                local.get 4
                                i32.load offset=24
                                local.tee 2
                                i32.store offset=344
                                block ;; label = @15
                                  local.get 4
                                  i32.load8_u offset=304
                                  i32.const 1
                                  i32.ne
                                  br_if 0 (;@15;)
                                  local.get 2
                                  local.get 2
                                  i32.load
                                  i32.const -1
                                  i32.add
                                  local.tee 1
                                  i32.store
                                  local.get 1
                                  br_if 7 (;@8;)
                                  local.get 4
                                  i32.const 344
                                  i32.add
                                  call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                                  br 7 (;@8;)
                                end
                                local.get 2
                                i32.eqz
                                br_if 6 (;@8;)
                                local.get 4
                                i32.const 1
                                i32.store8 offset=708
                                local.get 4
                                local.get 15
                                i32.store offset=704
                                local.get 4
                                local.get 2
                                i32.store offset=700
                                local.get 4
                                i32.const 4
                                i32.store8 offset=696
                                local.get 4
                                i32.const 416
                                i32.add
                                local.get 4
                                i32.const 272
                                i32.add
                                local.get 4
                                i32.const 696
                                i32.add
                                call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::arith::Mul>::mul>"
                                local.get 4
                                local.get 3
                                i64.load
                                i64.store offset=256
                                local.get 4
                                local.get 3
                                i64.load offset=8
                                i64.store offset=264
                                block ;; label = @15
                                  local.get 4
                                  i64.load offset=416
                                  i64.const 1
                                  i64.ne
                                  br_if 0 (;@15;)
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
                                  br 4 (;@11;)
                                end
                                local.get 4
                                local.get 4
                                i64.load offset=264
                                i64.store offset=248
                                local.get 4
                                local.get 4
                                i64.load offset=256
                                i64.store offset=240
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      local.get 5
                                      i32.load offset=16
                                      i32.eqz
                                      br_if 0 (;@17;)
                                      block ;; label = @18
                                        block ;; label = @19
                                          block ;; label = @20
                                            block ;; label = @21
                                              block ;; label = @22
                                                block ;; label = @23
                                                  block ;; label = @24
                                                    local.get 5
                                                    i32.load offset=12
                                                    local.tee 2
                                                    i32.load8_u offset=8
                                                    local.tee 16
                                                    br_table 6 (;@18;) 6 (;@18;) 0 (;@24;) 1 (;@23;) 2 (;@22;) 3 (;@21;) 4 (;@20;) 5 (;@19;) 6 (;@18;)
                                                  end
                                                  local.get 2
                                                  i64.load offset=16
                                                  local.set 18
                                                  br 8 (;@15;)
                                                end
                                                local.get 2
                                                i32.load offset=12
                                                local.tee 15
                                                local.get 15
                                                i32.load
                                                i32.const 1
                                                i32.add
                                                local.tee 17
                                                i32.store
                                                local.get 17
                                                i32.eqz
                                                br_if 21 (;@1;)
                                                br 6 (;@16;)
                                              end
                                              local.get 2
                                              i32.load offset=12
                                              local.tee 15
                                              local.get 15
                                              i32.load
                                              i32.const 1
                                              i32.add
                                              local.tee 17
                                              i32.store
                                              local.get 17
                                              i32.eqz
                                              br_if 20 (;@1;)
                                              local.get 2
                                              i64.load8_u offset=20
                                              i64.const 32
                                              i64.shl
                                              local.get 2
                                              i64.load32_u offset=16
                                              i64.or
                                              local.set 18
                                              br 6 (;@15;)
                                            end
                                            local.get 2
                                            i32.load offset=12
                                            local.tee 15
                                            local.get 15
                                            i32.load
                                            i32.const 1
                                            i32.add
                                            local.tee 17
                                            i32.store
                                            local.get 17
                                            i32.eqz
                                            br_if 19 (;@1;)
                                            br 4 (;@16;)
                                          end
                                          local.get 2
                                          i32.load offset=12
                                          local.tee 15
                                          local.get 15
                                          i32.load
                                          i32.const 1
                                          i32.add
                                          local.tee 17
                                          i32.store
                                          local.get 17
                                          i32.eqz
                                          br_if 18 (;@1;)
                                          br 3 (;@16;)
                                        end
                                        local.get 2
                                        i32.load offset=12
                                        local.tee 15
                                        local.get 15
                                        i32.load
                                        i32.const 1
                                        i32.add
                                        local.tee 17
                                        i32.store
                                        local.get 17
                                        i32.eqz
                                        br_if 17 (;@1;)
                                        br 3 (;@15;)
                                      end
                                      local.get 2
                                      i32.load8_u offset=9
                                      local.set 2
                                      br 2 (;@15;)
                                    end
                                    i32.const 0
                                    i32.const 0
                                    i32.const 1062708
                                    call $core::panicking::panic_bounds_check
                                    unreachable
                                  end
                                  local.get 2
                                  i64.load32_u offset=16
                                  local.set 18
                                end
                                local.get 4
                                local.get 18
                                i64.store offset=480
                                local.get 4
                                local.get 15
                                i32.store offset=476
                                local.get 4
                                local.get 2
                                i32.store8 offset=473
                                local.get 4
                                local.get 16
                                i32.store8 offset=472
                                local.get 4
                                i32.const 0
                                i32.store16 offset=464
                                local.get 4
                                i32.const 1066855
                                i32.store offset=460
                                local.get 4
                                i32.const 1066845
                                i32.store offset=456
                                local.get 4
                                i32.const 696
                                i32.add
                                local.get 4
                                i32.const 456
                                i32.add
                                call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        local.get 4
                                        i32.load8_u offset=696
                                        local.tee 2
                                        i32.const 255
                                        i32.ne
                                        br_if 0 (;@18;)
                                        local.get 4
                                        local.get 4
                                        i64.load offset=700 align=4
                                        i64.store offset=684 align=4
                                        local.get 4
                                        i32.const 3
                                        i32.store8 offset=680
                                        local.get 4
                                        i32.const 696
                                        i32.add
                                        local.get 4
                                        i32.const 472
                                        i32.add
                                        local.get 4
                                        i32.const 680
                                        i32.add
                                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                                        local.get 5
                                        i32.load offset=16
                                        local.tee 2
                                        i32.const 1
                                        i32.le_u
                                        br_if 1 (;@17;)
                                        local.get 4
                                        i32.const 416
                                        i32.add
                                        local.get 4
                                        i32.const 696
                                        i32.add
                                        local.get 5
                                        i32.load offset=12
                                        i32.const 24
                                        i32.add
                                        local.get 4
                                        i32.const 104
                                        i32.add
                                        call $"<nanvm_lib::vm::lambda::PropertyLambda<nanvm_lib::naive::Naive>>::end_call::<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#2}::{closure#0}::{closure#0}>"
                                        local.get 4
                                        local.get 3
                                        i64.load
                                        i64.store offset=384
                                        local.get 4
                                        local.get 3
                                        i64.load offset=8
                                        i64.store offset=392
                                        block ;; label = @19
                                          local.get 4
                                          i64.load offset=416
                                          i64.const 1
                                          i64.ne
                                          br_if 0 (;@19;)
                                          local.get 0
                                          local.get 4
                                          i64.load offset=392
                                          i64.store offset=16
                                          local.get 0
                                          local.get 4
                                          i64.load offset=384
                                          i64.store offset=8
                                          local.get 0
                                          i64.const 1
                                          i64.store
                                          br 7 (;@12;)
                                        end
                                        local.get 4
                                        local.get 4
                                        i64.load offset=392
                                        i64.store offset=376
                                        local.get 4
                                        local.get 4
                                        i64.load offset=384
                                        i64.store offset=368
                                        local.get 4
                                        i64.const 4619567317775286272
                                        i64.store offset=448
                                        local.get 4
                                        i32.const 2
                                        i32.store8 offset=440
                                        block ;; label = @19
                                          block ;; label = @20
                                            block ;; label = @21
                                              block ;; label = @22
                                                block ;; label = @23
                                                  block ;; label = @24
                                                    block ;; label = @25
                                                      local.get 4
                                                      i32.load8_u offset=104
                                                      local.tee 15
                                                      br_table 6 (;@19;) 6 (;@19;) 0 (;@25;) 1 (;@24;) 2 (;@23;) 3 (;@22;) 4 (;@21;) 5 (;@20;) 6 (;@19;)
                                                    end
                                                    local.get 4
                                                    i64.load offset=112
                                                    local.set 18
                                                    br 9 (;@15;)
                                                  end
                                                  local.get 4
                                                  i32.load offset=108
                                                  local.tee 2
                                                  local.get 2
                                                  i32.load
                                                  i32.const 1
                                                  i32.add
                                                  local.tee 16
                                                  i32.store
                                                  local.get 16
                                                  i32.eqz
                                                  br_if 22 (;@1;)
                                                  br 7 (;@16;)
                                                end
                                                local.get 4
                                                i32.load offset=108
                                                local.tee 2
                                                local.get 2
                                                i32.load
                                                i32.const 1
                                                i32.add
                                                local.tee 16
                                                i32.store
                                                local.get 16
                                                i32.eqz
                                                br_if 21 (;@1;)
                                                local.get 4
                                                i64.load8_u offset=116
                                                i64.const 32
                                                i64.shl
                                                local.get 4
                                                i64.load32_u offset=112
                                                i64.or
                                                local.set 18
                                                br 7 (;@15;)
                                              end
                                              local.get 4
                                              i32.load offset=108
                                              local.tee 2
                                              local.get 2
                                              i32.load
                                              i32.const 1
                                              i32.add
                                              local.tee 16
                                              i32.store
                                              local.get 16
                                              i32.eqz
                                              br_if 20 (;@1;)
                                              br 5 (;@16;)
                                            end
                                            local.get 4
                                            i32.load offset=108
                                            local.tee 2
                                            local.get 2
                                            i32.load
                                            i32.const 1
                                            i32.add
                                            local.tee 16
                                            i32.store
                                            local.get 16
                                            i32.eqz
                                            br_if 19 (;@1;)
                                            br 4 (;@16;)
                                          end
                                          local.get 4
                                          i32.load offset=108
                                          local.tee 2
                                          local.get 2
                                          i32.load
                                          i32.const 1
                                          i32.add
                                          local.tee 17
                                          i32.store
                                          local.get 17
                                          i32.eqz
                                          br_if 18 (;@1;)
                                          br 4 (;@15;)
                                        end
                                        local.get 4
                                        i32.load8_u offset=105
                                        local.set 16
                                        br 3 (;@15;)
                                      end
                                      local.get 4
                                      local.get 4
                                      i32.load8_u offset=699
                                      i32.store8 offset=683
                                      local.get 4
                                      local.get 4
                                      i32.load16_u offset=697 align=1
                                      i32.store16 offset=681 align=1
                                      local.get 4
                                      local.get 4
                                      i32.load offset=708
                                      i32.store offset=692
                                      local.get 4
                                      local.get 4
                                      i64.load offset=700 align=4
                                      i64.store offset=684 align=4
                                      local.get 4
                                      local.get 2
                                      i32.store8 offset=680
                                      i32.const 1055372
                                      i32.const 43
                                      local.get 4
                                      i32.const 680
                                      i32.add
                                      i32.const 1055356
                                      i32.const 1055416
                                      call $core::result::unwrap_failed
                                      unreachable
                                    end
                                    i32.const 1
                                    local.get 2
                                    i32.const 1062708
                                    call $core::panicking::panic_bounds_check
                                    unreachable
                                  end
                                  local.get 4
                                  i64.load32_u offset=112
                                  local.set 18
                                end
                                local.get 4
                                local.get 18
                                i64.store offset=480
                                local.get 4
                                local.get 2
                                i32.store offset=476
                                local.get 4
                                local.get 16
                                i32.store8 offset=473
                                local.get 4
                                local.get 15
                                i32.store8 offset=472
                                local.get 4
                                i64.const 4620693217682128896
                                i64.store offset=688
                                local.get 4
                                i32.const 2
                                i32.store8 offset=680
                                local.get 4
                                i32.const 696
                                i32.add
                                local.get 4
                                i32.const 472
                                i32.add
                                local.get 4
                                i32.const 680
                                i32.add
                                call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::arith::Rem>::rem>"
                                local.get 4
                                local.get 1
                                i64.load
                                i64.store offset=456
                                local.get 4
                                local.get 1
                                i64.load offset=8
                                i64.store offset=464
                                block ;; label = @15
                                  local.get 4
                                  i64.load offset=696
                                  i64.const 1
                                  i64.ne
                                  br_if 0 (;@15;)
                                  local.get 0
                                  local.get 4
                                  i64.load offset=464
                                  i64.store offset=16
                                  local.get 0
                                  local.get 4
                                  i64.load offset=456
                                  i64.store offset=8
                                  local.get 0
                                  i64.const 1
                                  i64.store
                                  local.get 4
                                  i32.const 440
                                  i32.add
                                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                                  local.get 4
                                  i32.const 368
                                  i32.add
                                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                                  br 3 (;@12;)
                                end
                                local.get 4
                                local.get 4
                                i64.load offset=464
                                i64.store offset=496
                                local.get 4
                                local.get 4
                                i64.load offset=456
                                i64.store offset=488
                                local.get 4
                                i32.const 416
                                i32.add
                                local.get 4
                                i32.const 440
                                i32.add
                                local.get 4
                                i32.const 488
                                i32.add
                                call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::arith::Sub>::sub>"
                                local.get 4
                                local.get 3
                                i64.load
                                i64.store offset=400
                                local.get 4
                                local.get 3
                                i64.load offset=8
                                i64.store offset=408
                                block ;; label = @15
                                  local.get 4
                                  i64.load offset=416
                                  i64.const 1
                                  i64.ne
                                  br_if 0 (;@15;)
                                  local.get 0
                                  local.get 4
                                  i64.load offset=408
                                  i64.store offset=16
                                  local.get 0
                                  local.get 4
                                  i64.load offset=400
                                  i64.store offset=8
                                  local.get 0
                                  i64.const 1
                                  i64.store
                                  local.get 4
                                  i32.const 368
                                  i32.add
                                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                                  br 3 (;@12;)
                                end
                                local.get 4
                                local.get 4
                                i64.load offset=408
                                i64.store offset=512
                                local.get 4
                                local.get 4
                                i64.load offset=400
                                i64.store offset=504
                                local.get 4
                                i32.const 344
                                i32.add
                                local.get 4
                                i32.const 368
                                i32.add
                                local.get 4
                                i32.const 504
                                i32.add
                                call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::bit::Shr>::shr>"
                                local.get 4
                                local.get 13
                                i64.load
                                i64.store offset=328
                                local.get 4
                                local.get 13
                                i64.load offset=8
                                i64.store offset=336
                                block ;; label = @15
                                  local.get 4
                                  i64.load offset=344
                                  i64.const 1
                                  i64.ne
                                  br_if 0 (;@15;)
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
                                  br 3 (;@12;)
                                end
                                local.get 4
                                local.get 4
                                i64.load offset=336
                                i64.store offset=528
                                local.get 4
                                local.get 4
                                i64.load offset=328
                                i64.store offset=520
                                local.get 4
                                i64.const 4607182418800017408
                                i64.store offset=704
                                local.get 4
                                i32.const 2
                                i32.store8 offset=696
                                local.get 4
                                i32.const 304
                                i32.add
                                local.get 4
                                i32.const 520
                                i32.add
                                local.get 4
                                i32.const 696
                                i32.add
                                call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::bit::BitAnd>::bitand>"
                                local.get 4
                                local.get 12
                                i64.load
                                i64.store offset=664
                                local.get 4
                                local.get 12
                                i64.load offset=8
                                i64.store offset=672
                                block ;; label = @15
                                  local.get 4
                                  i64.load offset=304
                                  i64.const 1
                                  i64.ne
                                  br_if 0 (;@15;)
                                  local.get 0
                                  local.get 4
                                  i64.load offset=672
                                  i64.store offset=16
                                  local.get 0
                                  local.get 4
                                  i64.load offset=664
                                  i64.store offset=8
                                  local.get 0
                                  i64.const 1
                                  i64.store
                                  br 3 (;@12;)
                                end
                                block ;; label = @15
                                  block ;; label = @16
                                    local.get 4
                                    i32.const 664
                                    i32.add
                                    call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::boolean_coercion::BooleanCoercion>
                                    br_if 0 (;@16;)
                                    local.get 4
                                    i32.const 0
                                    i32.store8 offset=416
                                    local.get 4
                                    i32.const 16
                                    i32.add
                                    local.get 4
                                    i32.const 416
                                    i32.add
                                    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::empty::Empty<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                                    local.get 4
                                    local.get 4
                                    i32.load offset=20
                                    local.tee 15
                                    i32.store offset=700
                                    local.get 4
                                    local.get 4
                                    i32.load offset=16
                                    local.tee 2
                                    i32.store offset=696
                                    block ;; label = @17
                                      block ;; label = @18
                                        local.get 4
                                        i32.load8_u offset=416
                                        i32.const 1
                                        i32.ne
                                        br_if 0 (;@18;)
                                        local.get 2
                                        local.get 2
                                        i32.load
                                        i32.const -1
                                        i32.add
                                        local.tee 1
                                        i32.store
                                        local.get 1
                                        br_if 1 (;@17;)
                                        local.get 4
                                        i32.const 696
                                        i32.add
                                        call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                                        br 1 (;@17;)
                                      end
                                      local.get 2
                                      br_if 2 (;@15;)
                                    end
                                    i32.const 1053928
                                    i32.const 43
                                    local.get 4
                                    i32.const 751
                                    i32.add
                                    i32.const 1053912
                                    i32.const 1053972
                                    call $core::result::unwrap_failed
                                    unreachable
                                  end
                                  local.get 4
                                  i32.const 0
                                  i32.store8 offset=344
                                  local.get 4
                                  i64.const 1
                                  i64.store offset=704
                                  local.get 4
                                  i64.const 1
                                  i64.store offset=696
                                  local.get 4
                                  local.get 4
                                  i32.const 344
                                  i32.add
                                  i32.store offset=712
                                  local.get 4
                                  i32.const 8
                                  i32.add
                                  local.get 4
                                  i32.const 696
                                  i32.add
                                  call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::once::Once<u64>, core::result::Result<u64, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<u64>>::to_rc_slice"
                                  local.get 4
                                  local.get 4
                                  i32.load offset=12
                                  local.tee 15
                                  i32.store offset=420
                                  local.get 4
                                  local.get 4
                                  i32.load offset=8
                                  local.tee 2
                                  i32.store offset=416
                                  block ;; label = @16
                                    local.get 4
                                    i32.load8_u offset=344
                                    i32.const 1
                                    i32.ne
                                    br_if 0 (;@16;)
                                    local.get 2
                                    local.get 2
                                    i32.load
                                    i32.const -1
                                    i32.add
                                    local.tee 1
                                    i32.store
                                    local.get 1
                                    br_if 3 (;@13;)
                                    local.get 4
                                    i32.const 416
                                    i32.add
                                    call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                                    br 3 (;@13;)
                                  end
                                  local.get 2
                                  i32.eqz
                                  br_if 2 (;@13;)
                                end
                                local.get 4
                                i32.const 1
                                i32.store8 offset=300
                                local.get 4
                                local.get 15
                                i32.store offset=296
                                local.get 4
                                local.get 2
                                i32.store offset=292
                                local.get 4
                                i32.const 4
                                i32.store8 offset=288
                                local.get 4
                                i32.const 216
                                i32.add
                                local.get 4
                                i32.const 240
                                i32.add
                                local.get 4
                                i32.const 288
                                i32.add
                                call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
                                local.get 4
                                local.get 11
                                i64.load
                                i64.store offset=200
                                local.get 4
                                local.get 11
                                i64.load offset=8
                                i64.store offset=208
                                block ;; label = @15
                                  local.get 4
                                  i64.load offset=216
                                  i64.const 1
                                  i64.ne
                                  br_if 0 (;@15;)
                                  local.get 0
                                  local.get 4
                                  i64.load offset=208
                                  i64.store offset=16
                                  local.get 0
                                  local.get 4
                                  i64.load offset=200
                                  i64.store offset=8
                                  local.get 0
                                  i64.const 1
                                  i64.store
                                  br 4 (;@11;)
                                end
                                local.get 10
                                local.get 4
                                i64.load offset=208
                                i64.store offset=8
                                local.get 10
                                local.get 4
                                i64.load offset=200
                                i64.store
                                local.get 4
                                local.get 4
                                i64.load offset=168
                                local.tee 18
                                i64.store offset=136
                                local.get 4
                                local.get 4
                                i64.load offset=176
                                local.tee 20
                                i64.store offset=144
                                local.get 4
                                i32.const 0
                                i32.store8 offset=344
                                local.get 1
                                local.get 18
                                i64.store
                                local.get 1
                                local.get 20
                                i64.store offset=8
                                local.get 1
                                local.get 4
                                i64.load offset=152
                                i64.store offset=16
                                local.get 1
                                local.get 4
                                i64.load offset=160
                                i64.store offset=24
                                local.get 4
                                i64.const 8589934592
                                i64.store offset=696
                                local.get 4
                                local.get 4
                                i32.const 344
                                i32.add
                                i32.store offset=736
                                local.get 4
                                local.get 4
                                i32.const 696
                                i32.add
                                call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                                local.get 4
                                local.get 4
                                i32.load offset=4
                                local.tee 15
                                i32.store offset=420
                                local.get 4
                                local.get 4
                                i32.load
                                local.tee 2
                                i32.store offset=416
                                block ;; label = @15
                                  block ;; label = @16
                                    local.get 4
                                    i32.load8_u offset=344
                                    i32.const 1
                                    i32.ne
                                    br_if 0 (;@16;)
                                    local.get 2
                                    local.get 2
                                    i32.load
                                    i32.const -1
                                    i32.add
                                    local.tee 1
                                    i32.store
                                    local.get 1
                                    br_if 1 (;@15;)
                                    local.get 4
                                    i32.const 416
                                    i32.add
                                    call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                                    br 1 (;@15;)
                                  end
                                  local.get 2
                                  i32.eqz
                                  br_if 0 (;@15;)
                                  local.get 4
                                  local.get 15
                                  i32.store offset=128
                                  local.get 4
                                  local.get 2
                                  i32.store offset=124
                                  local.get 4
                                  i32.const 6
                                  i32.store8 offset=120
                                  local.get 2
                                  local.get 2
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 16
                                  i32.store
                                  local.get 16
                                  i32.eqz
                                  br_if 14 (;@1;)
                                  local.get 4
                                  i32.const 40
                                  i32.add
                                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                                  local.get 4
                                  local.get 2
                                  i32.store offset=44
                                  local.get 4
                                  i32.const 6
                                  i32.store8 offset=40
                                  local.get 4
                                  local.get 15
                                  i64.extend_i32_u
                                  i64.store offset=48
                                  local.get 4
                                  i32.const 120
                                  i32.add
                                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                                  local.get 4
                                  i32.const 104
                                  i32.add
                                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                                  local.get 4
                                  i32.const 88
                                  i32.add
                                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                                  br 1 (;@14;)
                                end
                              end
                              i32.const 1053928
                              i32.const 43
                              local.get 4
                              i32.const 751
                              i32.add
                              i32.const 1053912
                              i32.const 1053972
                              call $core::result::unwrap_failed
                              unreachable
                            end
                            i32.const 1053928
                            i32.const 43
                            local.get 4
                            i32.const 751
                            i32.add
                            i32.const 1053912
                            i32.const 1053972
                            call $core::result::unwrap_failed
                            unreachable
                          end
                          local.get 4
                          i32.const 240
                          i32.add
                          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                        end
                        local.get 4
                        i32.const 168
                        i32.add
                        call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                      end
                      local.get 4
                      i32.const 104
                      i32.add
                      call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                    end
                    local.get 4
                    i32.const 88
                    i32.add
                    call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                    br 4 (;@4;)
                  end
                  i32.const 1053928
                  i32.const 43
                  local.get 4
                  i32.const 751
                  i32.add
                  i32.const 1053912
                  i32.const 1053972
                  call $core::result::unwrap_failed
                  unreachable
                end
                local.get 4
                i64.load32_u offset=704
                local.set 18
              end
              local.get 0
              local.get 18
              i64.store offset=16
              local.get 0
              local.get 1
              i32.store offset=12
              local.get 0
              local.get 3
              i32.store8 offset=9
              local.get 0
              local.get 5
              i32.store8 offset=8
              local.get 0
              i64.const 0
              i64.store
              local.get 4
              i32.const 696
              i32.add
              call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.load offset=32
              local.tee 1
              local.get 1
              i32.load
              i32.const -1
              i32.add
              local.tee 1
              i32.store
              local.get 1
              br_if 3 (;@2;)
              br 2 (;@3;)
            end
            local.get 4
            i32.const 680
            i32.add
            call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
          end
          local.get 4
          i32.const 40
          i32.add
          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
          local.get 4
          i32.load offset=32
          local.tee 1
          local.get 1
          i32.load
          i32.const -1
          i32.add
          local.tee 1
          i32.store
          local.get 1
          br_if 1 (;@2;)
        end
        local.get 4
        i32.const 32
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
      end
      local.get 4
      i32.const 752
      i32.add
      global.set $__stack_pointer
      return
    end
    unreachable
  )
  (func $"<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#5}::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;723;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i64 i32)
    global.get $__stack_pointer
    i32.const 368
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 4
    local.get 3
    i32.store offset=20
    local.get 4
    local.get 2
    i32.store offset=16
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            local.get 1
            i32.load
            local.tee 3
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
                            local.get 3
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
                        local.tee 2
                        local.get 2
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
                      local.tee 2
                      local.get 2
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
                    local.tee 2
                    local.get 2
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
                  local.tee 2
                  local.get 2
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
                local.tee 2
                local.get 2
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
          i32.const 1062708
          call $core::panicking::panic_bounds_check
          unreachable
        end
        local.get 5
        i64.load32_u offset=16
        local.set 7
      end
      local.get 4
      local.get 7
      i64.store offset=248
      local.get 4
      local.get 2
      i32.store offset=244
      local.get 4
      local.get 5
      i32.store8 offset=241
      local.get 4
      local.get 6
      i32.store8 offset=240
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            local.get 3
            i32.load offset=16
            local.tee 2
            i32.const 1
            i32.le_u
            br_if 0 (;@4;)
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            local.get 3
                            i32.load offset=12
                            local.tee 2
                            i32.load8_u offset=24
                            local.tee 6
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 2
                          i64.load offset=32
                          local.set 7
                          br 9 (;@2;)
                        end
                        local.get 2
                        i32.load offset=28
                        local.tee 5
                        local.get 5
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
                      local.get 2
                      i32.load offset=28
                      local.tee 5
                      local.get 5
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 8
                      i32.store
                      local.get 8
                      i32.eqz
                      br_if 8 (;@1;)
                      local.get 2
                      i64.load8_u offset=36
                      i64.const 32
                      i64.shl
                      local.get 2
                      i64.load32_u offset=32
                      i64.or
                      local.set 7
                      br 7 (;@2;)
                    end
                    local.get 2
                    i32.load offset=28
                    local.tee 5
                    local.get 5
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 8
                    i32.store
                    local.get 8
                    i32.eqz
                    br_if 7 (;@1;)
                    br 5 (;@3;)
                  end
                  local.get 2
                  i32.load offset=28
                  local.tee 5
                  local.get 5
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 8
                  i32.store
                  local.get 8
                  i32.eqz
                  br_if 6 (;@1;)
                  br 4 (;@3;)
                end
                local.get 2
                i32.load offset=28
                local.tee 5
                local.get 5
                i32.load
                i32.const 1
                i32.add
                local.tee 2
                i32.store
                local.get 2
                i32.eqz
                br_if 5 (;@1;)
                br 1 (;@5;)
              end
              local.get 2
              i32.load8_u offset=25
              local.set 2
            end
            br 2 (;@2;)
          end
          i32.const 1
          local.get 2
          i32.const 1062708
          call $core::panicking::panic_bounds_check
          unreachable
        end
        local.get 2
        i64.load32_u offset=32
        local.set 7
      end
      local.get 4
      local.get 7
      i64.store offset=304
      local.get 4
      local.get 5
      i32.store offset=300
      local.get 4
      local.get 2
      i32.store8 offset=297
      local.get 4
      local.get 6
      i32.store8 offset=296
      local.get 4
      i32.const 0
      i32.store16 offset=184
      local.get 4
      i32.const 1066861
      i32.store offset=180
      local.get 4
      i32.const 1066855
      i32.store offset=176
      local.get 4
      i32.const 328
      i32.add
      local.get 4
      i32.const 176
      i32.add
      call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
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
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                local.get 4
                                i32.load8_u offset=328
                                local.tee 2
                                i32.const 255
                                i32.ne
                                br_if 0 (;@14;)
                                local.get 4
                                local.get 4
                                i64.load offset=332 align=4
                                i64.store offset=196 align=4
                                local.get 4
                                i32.const 3
                                i32.store8 offset=192
                                local.get 4
                                i32.const 328
                                i32.add
                                local.get 4
                                i32.const 296
                                i32.add
                                local.get 4
                                i32.const 192
                                i32.add
                                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                                local.get 3
                                i32.load offset=16
                                local.tee 2
                                i32.const 2
                                i32.le_u
                                br_if 1 (;@13;)
                                local.get 4
                                i32.const 192
                                i32.add
                                local.get 4
                                i32.const 328
                                i32.add
                                local.get 3
                                i32.load offset=12
                                i32.const 40
                                i32.add
                                local.get 4
                                i32.const 16
                                i32.add
                                local.get 1
                                call $"<nanvm_lib::vm::lambda::PropertyLambda<nanvm_lib::naive::Naive>>::end_call::<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#5}::{closure#0}::{closure#0}>"
                                local.get 4
                                local.get 4
                                i64.load offset=200
                                i64.store offset=136
                                local.get 4
                                local.get 4
                                i64.load offset=208
                                i64.store offset=144
                                block ;; label = @15
                                  local.get 4
                                  i64.load offset=192
                                  i64.const 1
                                  i64.ne
                                  br_if 0 (;@15;)
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
                                  local.get 4
                                  i32.const 240
                                  i32.add
                                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                                  br 6 (;@9;)
                                end
                                local.get 4
                                local.get 4
                                i64.load offset=144
                                i64.store offset=344
                                local.get 4
                                local.get 4
                                i64.load offset=136
                                i64.store offset=336
                                local.get 4
                                i32.const 0
                                i32.store8 offset=296
                                local.get 4
                                i64.const 4294967296
                                i64.store offset=328
                                local.get 4
                                local.get 4
                                i32.const 296
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
                                i32.store offset=196
                                local.get 4
                                local.get 4
                                i32.load offset=8
                                local.tee 2
                                i32.store offset=192
                                block ;; label = @15
                                  local.get 4
                                  i32.load8_u offset=296
                                  i32.const 1
                                  i32.ne
                                  br_if 0 (;@15;)
                                  local.get 2
                                  local.get 2
                                  i32.load
                                  i32.const -1
                                  i32.add
                                  local.tee 3
                                  i32.store
                                  local.get 3
                                  br_if 13 (;@2;)
                                  local.get 4
                                  i32.const 192
                                  i32.add
                                  call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                                  br 13 (;@2;)
                                end
                                local.get 2
                                i32.eqz
                                br_if 12 (;@2;)
                                local.get 4
                                local.get 5
                                i32.store offset=264
                                local.get 4
                                local.get 2
                                i32.store offset=260
                                local.get 4
                                i32.const 6
                                i32.store8 offset=256
                                local.get 4
                                i32.const 152
                                i32.add
                                local.get 4
                                i32.const 240
                                i32.add
                                local.get 4
                                i32.const 256
                                i32.add
                                call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
                                local.get 4
                                local.get 4
                                i64.load offset=160
                                i64.store offset=120
                                local.get 4
                                local.get 4
                                i64.load offset=168
                                i64.store offset=128
                                block ;; label = @15
                                  local.get 4
                                  i64.load offset=152
                                  i64.const 1
                                  i64.ne
                                  br_if 0 (;@15;)
                                  local.get 0
                                  local.get 4
                                  i64.load offset=128
                                  i64.store offset=16
                                  local.get 0
                                  local.get 4
                                  i64.load offset=120
                                  i64.store offset=8
                                  local.get 0
                                  i64.const 1
                                  i64.store
                                  br 6 (;@9;)
                                end
                                local.get 4
                                local.get 4
                                i64.load offset=128
                                i64.store offset=112
                                local.get 4
                                local.get 4
                                i64.load offset=120
                                i64.store offset=104
                                local.get 4
                                i64.const 1
                                i64.store offset=96
                                local.get 3
                                i32.load offset=16
                                local.tee 2
                                i32.const 1
                                i32.le_u
                                br_if 2 (;@12;)
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        block ;; label = @19
                                          block ;; label = @20
                                            block ;; label = @21
                                              block ;; label = @22
                                                local.get 3
                                                i32.load offset=12
                                                local.tee 5
                                                i32.load8_u offset=24
                                                local.tee 6
                                                br_table 6 (;@16;) 6 (;@16;) 0 (;@22;) 1 (;@21;) 2 (;@20;) 3 (;@19;) 4 (;@18;) 5 (;@17;) 6 (;@16;)
                                              end
                                              local.get 5
                                              i64.load offset=32
                                              local.set 7
                                              br 11 (;@10;)
                                            end
                                            local.get 5
                                            i32.load offset=28
                                            local.tee 2
                                            local.get 2
                                            i32.load
                                            i32.const 1
                                            i32.add
                                            local.tee 8
                                            i32.store
                                            local.get 8
                                            i32.eqz
                                            br_if 19 (;@1;)
                                            br 9 (;@11;)
                                          end
                                          local.get 5
                                          i32.load offset=28
                                          local.tee 2
                                          local.get 2
                                          i32.load
                                          i32.const 1
                                          i32.add
                                          local.tee 8
                                          i32.store
                                          local.get 8
                                          i32.eqz
                                          br_if 18 (;@1;)
                                          local.get 5
                                          i64.load8_u offset=36
                                          i64.const 32
                                          i64.shl
                                          local.get 5
                                          i64.load32_u offset=32
                                          i64.or
                                          local.set 7
                                          br 9 (;@10;)
                                        end
                                        local.get 5
                                        i32.load offset=28
                                        local.tee 2
                                        local.get 2
                                        i32.load
                                        i32.const 1
                                        i32.add
                                        local.tee 8
                                        i32.store
                                        local.get 8
                                        i32.eqz
                                        br_if 17 (;@1;)
                                        br 7 (;@11;)
                                      end
                                      local.get 5
                                      i32.load offset=28
                                      local.tee 2
                                      local.get 2
                                      i32.load
                                      i32.const 1
                                      i32.add
                                      local.tee 8
                                      i32.store
                                      local.get 8
                                      i32.eqz
                                      br_if 16 (;@1;)
                                      br 6 (;@11;)
                                    end
                                    local.get 5
                                    i32.load offset=28
                                    local.tee 2
                                    local.get 2
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 5
                                    i32.store
                                    local.get 5
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    br 1 (;@15;)
                                  end
                                  local.get 5
                                  i32.load8_u offset=25
                                  local.set 5
                                end
                                br 4 (;@10;)
                              end
                              local.get 4
                              local.get 4
                              i32.load8_u offset=331
                              i32.store8 offset=195
                              local.get 4
                              local.get 4
                              i32.load16_u offset=329 align=1
                              i32.store16 offset=193 align=1
                              local.get 4
                              local.get 4
                              i32.load offset=340
                              i32.store offset=204
                              local.get 4
                              local.get 4
                              i64.load offset=332 align=4
                              i64.store offset=196 align=4
                              local.get 4
                              local.get 2
                              i32.store8 offset=192
                              i32.const 1055372
                              i32.const 43
                              local.get 4
                              i32.const 192
                              i32.add
                              i32.const 1055356
                              i32.const 1055416
                              call $core::result::unwrap_failed
                              unreachable
                            end
                            i32.const 2
                            local.get 2
                            i32.const 1062708
                            call $core::panicking::panic_bounds_check
                            unreachable
                          end
                          i32.const 1
                          local.get 2
                          i32.const 1062708
                          call $core::panicking::panic_bounds_check
                          unreachable
                        end
                        local.get 5
                        i64.load32_u offset=32
                        local.set 7
                      end
                      local.get 4
                      local.get 7
                      i64.store offset=304
                      local.get 4
                      local.get 2
                      i32.store offset=300
                      local.get 4
                      local.get 5
                      i32.store8 offset=297
                      local.get 4
                      local.get 6
                      i32.store8 offset=296
                      local.get 4
                      i32.const 0
                      i32.store16 offset=264
                      local.get 4
                      i32.const 1066861
                      i32.store offset=260
                      local.get 4
                      i32.const 1066855
                      i32.store offset=256
                      local.get 4
                      i32.const 328
                      i32.add
                      local.get 4
                      i32.const 256
                      i32.add
                      call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  local.get 4
                                  i32.load8_u offset=328
                                  local.tee 2
                                  i32.const 255
                                  i32.ne
                                  br_if 0 (;@15;)
                                  local.get 4
                                  local.get 4
                                  i64.load offset=332 align=4
                                  i64.store offset=196 align=4
                                  local.get 4
                                  i32.const 3
                                  i32.store8 offset=192
                                  local.get 4
                                  i32.const 328
                                  i32.add
                                  local.get 4
                                  i32.const 296
                                  i32.add
                                  local.get 4
                                  i32.const 192
                                  i32.add
                                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                                  local.get 3
                                  i32.load offset=16
                                  local.tee 2
                                  i32.const 2
                                  i32.le_u
                                  br_if 1 (;@14;)
                                  local.get 4
                                  i32.const 192
                                  i32.add
                                  local.get 4
                                  i32.const 328
                                  i32.add
                                  local.get 3
                                  i32.load offset=12
                                  i32.const 40
                                  i32.add
                                  local.get 4
                                  i32.const 16
                                  i32.add
                                  local.get 1
                                  call $"<nanvm_lib::vm::lambda::PropertyLambda<nanvm_lib::naive::Naive>>::end_call::<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#5}::{closure#0}::{closure#1}>"
                                  local.get 4
                                  local.get 4
                                  i64.load offset=200
                                  i64.store offset=176
                                  local.get 4
                                  local.get 4
                                  i64.load offset=208
                                  i64.store offset=184
                                  block ;; label = @16
                                    local.get 4
                                    i64.load offset=192
                                    i64.const 1
                                    i64.ne
                                    br_if 0 (;@16;)
                                    local.get 0
                                    local.get 4
                                    i64.load offset=184
                                    i64.store offset=16
                                    local.get 0
                                    local.get 4
                                    i64.load offset=176
                                    i64.store offset=8
                                    local.get 0
                                    i64.const 1
                                    i64.store
                                    br 6 (;@10;)
                                  end
                                  local.get 4
                                  local.get 4
                                  i64.load offset=184
                                  i64.store offset=168
                                  local.get 4
                                  local.get 4
                                  i64.load offset=176
                                  i64.store offset=160
                                  local.get 4
                                  i64.const 1
                                  i64.store offset=152
                                  local.get 3
                                  i32.load offset=16
                                  i32.eqz
                                  br_if 2 (;@13;)
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        block ;; label = @19
                                          block ;; label = @20
                                            block ;; label = @21
                                              block ;; label = @22
                                                block ;; label = @23
                                                  local.get 3
                                                  i32.load offset=12
                                                  local.tee 2
                                                  i32.load8_u offset=8
                                                  local.tee 6
                                                  br_table 6 (;@17;) 6 (;@17;) 0 (;@23;) 1 (;@22;) 2 (;@21;) 3 (;@20;) 4 (;@19;) 5 (;@18;) 6 (;@17;)
                                                end
                                                local.get 2
                                                i64.load offset=16
                                                local.set 7
                                                br 11 (;@11;)
                                              end
                                              local.get 2
                                              i32.load offset=12
                                              local.tee 5
                                              local.get 5
                                              i32.load
                                              i32.const 1
                                              i32.add
                                              local.tee 8
                                              i32.store
                                              local.get 8
                                              i32.eqz
                                              br_if 20 (;@1;)
                                              br 9 (;@12;)
                                            end
                                            local.get 2
                                            i32.load offset=12
                                            local.tee 5
                                            local.get 5
                                            i32.load
                                            i32.const 1
                                            i32.add
                                            local.tee 8
                                            i32.store
                                            local.get 8
                                            i32.eqz
                                            br_if 19 (;@1;)
                                            local.get 2
                                            i64.load8_u offset=20
                                            i64.const 32
                                            i64.shl
                                            local.get 2
                                            i64.load32_u offset=16
                                            i64.or
                                            local.set 7
                                            br 9 (;@11;)
                                          end
                                          local.get 2
                                          i32.load offset=12
                                          local.tee 5
                                          local.get 5
                                          i32.load
                                          i32.const 1
                                          i32.add
                                          local.tee 8
                                          i32.store
                                          local.get 8
                                          i32.eqz
                                          br_if 18 (;@1;)
                                          br 7 (;@12;)
                                        end
                                        local.get 2
                                        i32.load offset=12
                                        local.tee 5
                                        local.get 5
                                        i32.load
                                        i32.const 1
                                        i32.add
                                        local.tee 8
                                        i32.store
                                        local.get 8
                                        i32.eqz
                                        br_if 17 (;@1;)
                                        br 6 (;@12;)
                                      end
                                      local.get 2
                                      i32.load offset=12
                                      local.tee 5
                                      local.get 5
                                      i32.load
                                      i32.const 1
                                      i32.add
                                      local.tee 2
                                      i32.store
                                      local.get 2
                                      i32.eqz
                                      br_if 16 (;@1;)
                                      br 1 (;@16;)
                                    end
                                    local.get 2
                                    i32.load8_u offset=9
                                    local.set 2
                                  end
                                  br 4 (;@11;)
                                end
                                local.get 4
                                local.get 4
                                i32.load8_u offset=331
                                i32.store8 offset=195
                                local.get 4
                                local.get 4
                                i32.load16_u offset=329 align=1
                                i32.store16 offset=193 align=1
                                local.get 4
                                local.get 4
                                i32.load offset=340
                                i32.store offset=204
                                local.get 4
                                local.get 4
                                i64.load offset=332 align=4
                                i64.store offset=196 align=4
                                local.get 4
                                local.get 2
                                i32.store8 offset=192
                                i32.const 1055372
                                i32.const 43
                                local.get 4
                                i32.const 192
                                i32.add
                                i32.const 1055356
                                i32.const 1055416
                                call $core::result::unwrap_failed
                                unreachable
                              end
                              i32.const 2
                              local.get 2
                              i32.const 1062708
                              call $core::panicking::panic_bounds_check
                              unreachable
                            end
                            i32.const 0
                            i32.const 0
                            i32.const 1062708
                            call $core::panicking::panic_bounds_check
                            unreachable
                          end
                          local.get 2
                          i64.load32_u offset=16
                          local.set 7
                        end
                        local.get 4
                        local.get 7
                        i64.store offset=248
                        local.get 4
                        local.get 5
                        i32.store offset=244
                        local.get 4
                        local.get 2
                        i32.store8 offset=241
                        local.get 4
                        local.get 6
                        i32.store8 offset=240
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              local.get 3
                              i32.load offset=16
                              local.tee 2
                              i32.const 1
                              i32.le_u
                              br_if 0 (;@13;)
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        block ;; label = @19
                                          block ;; label = @20
                                            block ;; label = @21
                                              local.get 3
                                              i32.load offset=12
                                              local.tee 2
                                              i32.load8_u offset=24
                                              local.tee 6
                                              br_table 6 (;@15;) 6 (;@15;) 0 (;@21;) 1 (;@20;) 2 (;@19;) 3 (;@18;) 4 (;@17;) 5 (;@16;) 6 (;@15;)
                                            end
                                            local.get 2
                                            i64.load offset=32
                                            local.set 7
                                            br 9 (;@11;)
                                          end
                                          local.get 2
                                          i32.load offset=28
                                          local.tee 5
                                          local.get 5
                                          i32.load
                                          i32.const 1
                                          i32.add
                                          local.tee 8
                                          i32.store
                                          local.get 8
                                          i32.eqz
                                          br_if 18 (;@1;)
                                          br 7 (;@12;)
                                        end
                                        local.get 2
                                        i32.load offset=28
                                        local.tee 5
                                        local.get 5
                                        i32.load
                                        i32.const 1
                                        i32.add
                                        local.tee 8
                                        i32.store
                                        local.get 8
                                        i32.eqz
                                        br_if 17 (;@1;)
                                        local.get 2
                                        i64.load8_u offset=36
                                        i64.const 32
                                        i64.shl
                                        local.get 2
                                        i64.load32_u offset=32
                                        i64.or
                                        local.set 7
                                        br 7 (;@11;)
                                      end
                                      local.get 2
                                      i32.load offset=28
                                      local.tee 5
                                      local.get 5
                                      i32.load
                                      i32.const 1
                                      i32.add
                                      local.tee 8
                                      i32.store
                                      local.get 8
                                      i32.eqz
                                      br_if 16 (;@1;)
                                      br 5 (;@12;)
                                    end
                                    local.get 2
                                    i32.load offset=28
                                    local.tee 5
                                    local.get 5
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 8
                                    i32.store
                                    local.get 8
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    br 4 (;@12;)
                                  end
                                  local.get 2
                                  i32.load offset=28
                                  local.tee 5
                                  local.get 5
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 2
                                  i32.store
                                  local.get 2
                                  i32.eqz
                                  br_if 14 (;@1;)
                                  br 1 (;@14;)
                                end
                                local.get 2
                                i32.load8_u offset=25
                                local.set 2
                              end
                              br 2 (;@11;)
                            end
                            i32.const 1
                            local.get 2
                            i32.const 1062708
                            call $core::panicking::panic_bounds_check
                            unreachable
                          end
                          local.get 2
                          i64.load32_u offset=32
                          local.set 7
                        end
                        local.get 4
                        local.get 7
                        i64.store offset=304
                        local.get 4
                        local.get 5
                        i32.store offset=300
                        local.get 4
                        local.get 2
                        i32.store8 offset=297
                        local.get 4
                        local.get 6
                        i32.store8 offset=296
                        local.get 4
                        i32.const 0
                        i32.store16 offset=324
                        local.get 4
                        i32.const 1066861
                        i32.store offset=320
                        local.get 4
                        i32.const 1066855
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
                        local.tee 2
                        i32.const 255
                        i32.ne
                        br_if 5 (;@5;)
                        local.get 4
                        local.get 4
                        i64.load offset=332 align=4
                        i64.store offset=196 align=4
                        local.get 4
                        i32.const 3
                        i32.store8 offset=192
                        local.get 4
                        i32.const 328
                        i32.add
                        local.get 4
                        i32.const 296
                        i32.add
                        local.get 4
                        i32.const 192
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                        local.get 3
                        i32.load offset=16
                        local.tee 2
                        i32.const 2
                        i32.le_u
                        br_if 6 (;@4;)
                        local.get 4
                        i32.const 272
                        i32.add
                        i32.const 8
                        i32.add
                        local.set 2
                        local.get 4
                        i32.const 272
                        i32.add
                        local.get 4
                        i32.const 328
                        i32.add
                        local.get 3
                        i32.load offset=12
                        i32.const 40
                        i32.add
                        local.get 4
                        i32.const 16
                        i32.add
                        local.get 1
                        call $"<nanvm_lib::vm::lambda::PropertyLambda<nanvm_lib::naive::Naive>>::end_call::<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#5}::{closure#0}::{closure#2}>"
                        block ;; label = @11
                          block ;; label = @12
                            local.get 4
                            i64.load offset=272
                            i64.const 1
                            i64.ne
                            br_if 0 (;@12;)
                            local.get 0
                            i64.const 1
                            i64.store
                            local.get 0
                            local.get 2
                            i64.load offset=8
                            i64.store offset=16
                            local.get 0
                            local.get 2
                            i64.load
                            i64.store offset=8
                            local.get 4
                            i32.const 240
                            i32.add
                            call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                            br 1 (;@11;)
                          end
                          local.get 4
                          local.get 2
                          i64.load offset=8
                          i64.store offset=344
                          local.get 4
                          local.get 2
                          i64.load
                          i64.store offset=336
                          local.get 4
                          i32.const 0
                          i32.store8 offset=296
                          local.get 4
                          i64.const 4294967296
                          i64.store offset=328
                          local.get 4
                          local.get 4
                          i32.const 296
                          i32.add
                          i32.store offset=352
                          local.get 4
                          local.get 4
                          i32.const 328
                          i32.add
                          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                          local.get 4
                          local.get 4
                          i32.load offset=4
                          local.tee 2
                          i32.store offset=196
                          local.get 4
                          local.get 4
                          i32.load
                          local.tee 3
                          i32.store offset=192
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=296
                            i32.const 1
                            i32.ne
                            br_if 0 (;@12;)
                            local.get 3
                            local.get 3
                            i32.load
                            i32.const -1
                            i32.add
                            local.tee 0
                            i32.store
                            local.get 0
                            br_if 9 (;@3;)
                            local.get 4
                            i32.const 192
                            i32.add
                            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                            br 9 (;@3;)
                          end
                          local.get 3
                          i32.eqz
                          br_if 8 (;@3;)
                          local.get 4
                          i32.const 216
                          i32.add
                          i32.const 8
                          i32.add
                          local.set 1
                          local.get 4
                          local.get 2
                          i32.store offset=264
                          local.get 4
                          local.get 3
                          i32.store offset=260
                          local.get 4
                          i32.const 6
                          i32.store8 offset=256
                          local.get 4
                          i32.const 216
                          i32.add
                          local.get 4
                          i32.const 240
                          i32.add
                          local.get 4
                          i32.const 256
                          i32.add
                          call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
                          local.get 4
                          i64.load offset=216
                          i64.const 1
                          i64.ne
                          br_if 3 (;@8;)
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
                        end
                        local.get 4
                        i32.const 160
                        i32.add
                        call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                      end
                      local.get 4
                      i32.const 104
                      i32.add
                      call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                    end
                    local.get 4
                    i32.load offset=16
                    local.tee 3
                    local.get 3
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 3
                    i32.store
                    local.get 3
                    i32.eqz
                    br_if 1 (;@7;)
                    br 2 (;@6;)
                  end
                  local.get 4
                  local.get 4
                  i64.load offset=96
                  i64.store offset=24
                  local.get 4
                  local.get 4
                  i64.load offset=104
                  i64.store offset=32
                  local.get 4
                  local.get 4
                  i64.load offset=112
                  i64.store offset=40
                  local.get 4
                  local.get 4
                  i64.load offset=152
                  i64.store offset=48
                  local.get 4
                  local.get 4
                  i64.load offset=160
                  i64.store offset=56
                  local.get 4
                  local.get 4
                  i64.load offset=168
                  i64.store offset=64
                  local.get 4
                  i64.const 1
                  i64.store offset=72
                  local.get 4
                  local.get 1
                  i64.load offset=8
                  i64.store offset=88
                  local.get 4
                  local.get 1
                  i64.load
                  i64.store offset=80
                  local.get 0
                  local.get 4
                  i32.const 24
                  i32.add
                  call $"nanvm_lib::vm::unstable::spread_array::<nanvm_lib::naive::Naive, [nanvm_lib::vm::unstable::ArrayItem<nanvm_lib::naive::Naive>; 3]>"
                  local.get 4
                  i32.load offset=16
                  local.tee 3
                  local.get 3
                  i32.load
                  i32.const -1
                  i32.add
                  local.tee 3
                  i32.store
                  local.get 3
                  br_if 1 (;@6;)
                end
                local.get 4
                i32.const 16
                i32.add
                call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
              end
              local.get 4
              i32.const 368
              i32.add
              global.set $__stack_pointer
              return
            end
            local.get 4
            local.get 4
            i32.load8_u offset=331
            i32.store8 offset=195
            local.get 4
            local.get 4
            i32.load16_u offset=329 align=1
            i32.store16 offset=193 align=1
            local.get 4
            local.get 4
            i32.load offset=340
            i32.store offset=204
            local.get 4
            local.get 4
            i64.load offset=332 align=4
            i64.store offset=196 align=4
            local.get 4
            local.get 2
            i32.store8 offset=192
            i32.const 1055372
            i32.const 43
            local.get 4
            i32.const 192
            i32.add
            i32.const 1055356
            i32.const 1055416
            call $core::result::unwrap_failed
            unreachable
          end
          i32.const 2
          local.get 2
          i32.const 1062708
          call $core::panicking::panic_bounds_check
          unreachable
        end
        i32.const 1053928
        i32.const 43
        local.get 4
        i32.const 367
        i32.add
        i32.const 1053912
        i32.const 1053972
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1053928
      i32.const 43
      local.get 4
      i32.const 367
      i32.add
      i32.const 1053912
      i32.const 1053972
      call $core::result::unwrap_failed
      unreachable
    end
    unreachable
  )
  (func $"<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#6}::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;724;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i64 i32)
    global.get $__stack_pointer
    i32.const 80
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 1
    i32.load
    local.set 1
    local.get 4
    local.get 3
    i32.store offset=24
    local.get 4
    local.get 2
    i32.store offset=20
    block ;; label = @1
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
                            local.tee 3
                            i32.load8_u offset=8
                            local.tee 5
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 3
                          i64.load offset=16
                          local.set 6
                          br 10 (;@1;)
                        end
                        local.get 3
                        i32.load offset=12
                        local.tee 1
                        local.get 1
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 7
                        i32.store
                        local.get 7
                        i32.eqz
                        br_if 7 (;@3;)
                        br 8 (;@2;)
                      end
                      local.get 3
                      i32.load offset=12
                      local.tee 1
                      local.get 1
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 7
                      i32.store
                      local.get 7
                      i32.eqz
                      br_if 6 (;@3;)
                      local.get 3
                      i64.load8_u offset=20
                      i64.const 32
                      i64.shl
                      local.get 3
                      i64.load32_u offset=16
                      i64.or
                      local.set 6
                      br 8 (;@1;)
                    end
                    local.get 3
                    i32.load offset=12
                    local.tee 1
                    local.get 1
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 7
                    i32.store
                    local.get 7
                    br_if 6 (;@2;)
                    br 5 (;@3;)
                  end
                  local.get 3
                  i32.load offset=12
                  local.tee 1
                  local.get 1
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 7
                  i32.store
                  local.get 7
                  br_if 5 (;@2;)
                  br 4 (;@3;)
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
                br_if 3 (;@3;)
                br 1 (;@5;)
              end
              local.get 3
              i32.load8_u offset=9
              local.set 3
            end
            br 3 (;@1;)
          end
          i32.const 0
          i32.const 0
          i32.const 1062708
          call $core::panicking::panic_bounds_check
          unreachable
        end
        unreachable
      end
      local.get 3
      i64.load32_u offset=16
      local.set 6
    end
    local.get 4
    i32.const 0
    i32.store8 offset=31
    local.get 4
    local.get 6
    i64.store offset=56
    local.get 4
    local.get 1
    i32.store offset=52
    local.get 4
    local.get 3
    i32.store8 offset=49
    local.get 4
    local.get 5
    i32.store8 offset=48
    local.get 4
    i64.const 4294967296
    i64.store offset=40
    local.get 4
    local.get 4
    i32.const 31
    i32.add
    i32.store offset=64
    local.get 4
    i32.const 8
    i32.add
    local.get 4
    i32.const 40
    i32.add
    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
    local.get 4
    local.get 4
    i32.load offset=12
    local.tee 3
    i32.store offset=36
    local.get 4
    local.get 4
    i32.load offset=8
    local.tee 1
    i32.store offset=32
    block ;; label = @1
      block ;; label = @2
        local.get 4
        i32.load8_u offset=31
        i32.const 1
        i32.ne
        br_if 0 (;@2;)
        local.get 1
        local.get 1
        i32.load
        i32.const -1
        i32.add
        local.tee 2
        i32.store
        local.get 2
        br_if 1 (;@1;)
        local.get 4
        i32.const 32
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
        br 1 (;@1;)
      end
      local.get 1
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      i32.const 251
      i32.const 0
      local.get 1
      local.get 3
      i32.const 1066861
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
        i32.const 20
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
      end
      local.get 4
      i32.const 80
      i32.add
      global.set $__stack_pointer
      return
    end
    i32.const 1053928
    i32.const 43
    local.get 4
    i32.const 79
    i32.add
    i32.const 1053912
    i32.const 1053972
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::sort::module<nanvm_lib::naive::Naive>::{closure#6}::{closure#0}::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;727;) (type 3) (param i32 i32 i32 i32)
    (local i32 i64 i32)
    global.get $__stack_pointer
    i32.const 112
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 4
    local.get 3
    i32.store offset=24
    local.get 4
    local.get 2
    i32.store offset=20
    local.get 4
    i32.const 0
    i32.store16 offset=36
    local.get 4
    i32.const 1066883
    i32.store offset=32
    local.get 4
    i32.const 1066881
    i32.store offset=28
    local.get 4
    i32.const 56
    i32.add
    local.get 4
    i32.const 28
    i32.add
    call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
    block ;; label = @1
      block ;; label = @2
        local.get 4
        i32.load8_u offset=56
        local.tee 3
        i32.const 255
        i32.ne
        br_if 0 (;@2;)
        local.get 4
        i64.load offset=60 align=4
        local.set 5
        local.get 4
        i32.const 0
        i32.store8 offset=28
        local.get 4
        i32.const 256
        i32.store16 offset=80
        local.get 4
        local.get 5
        i64.store offset=68 align=4
        local.get 4
        i32.const 3
        i32.store8 offset=64
        local.get 4
        i64.const 8589934592
        i64.store offset=56
        local.get 4
        local.get 4
        i32.const 28
        i32.add
        i32.store offset=96
        local.get 4
        i32.const 8
        i32.add
        local.get 4
        i32.const 56
        i32.add
        call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
        local.get 4
        local.get 4
        i32.load offset=12
        local.tee 6
        i32.store offset=44
        local.get 4
        local.get 4
        i32.load offset=8
        local.tee 3
        i32.store offset=40
        block ;; label = @3
          local.get 4
          i32.load8_u offset=28
          i32.const 1
          i32.ne
          br_if 0 (;@3;)
          local.get 3
          local.get 3
          i32.load
          i32.const -1
          i32.add
          local.tee 0
          i32.store
          local.get 0
          br_if 2 (;@1;)
          local.get 4
          i32.const 40
          i32.add
          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
          br 2 (;@1;)
        end
        local.get 3
        i32.eqz
        br_if 1 (;@1;)
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
        local.get 2
        local.get 2
        i32.load
        i32.const -1
        i32.add
        local.tee 0
        i32.store
        block ;; label = @3
          local.get 0
          br_if 0 (;@3;)
          local.get 4
          i32.const 20
          i32.add
          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
        end
        local.get 4
        i32.const 112
        i32.add
        global.set $__stack_pointer
        return
      end
      local.get 4
      local.get 4
      i32.load8_u offset=59
      i32.store8 offset=43
      local.get 4
      local.get 4
      i32.load16_u offset=57 align=1
      i32.store16 offset=41 align=1
      local.get 4
      local.get 4
      i32.load offset=68
      i32.store offset=52
      local.get 4
      local.get 4
      i64.load offset=60 align=4
      i64.store offset=44 align=4
      local.get 4
      local.get 3
      i32.store8 offset=40
      i32.const 1055372
      i32.const 43
      local.get 4
      i32.const 40
      i32.add
      i32.const 1055356
      i32.const 1055416
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1053928
    i32.const 43
    local.get 4
    i32.const 111
    i32.add
    i32.const 1053912
    i32.const 1053972
    call $core::result::unwrap_failed
    unreachable
  )
