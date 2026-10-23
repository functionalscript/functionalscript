  (func $nanvm_demos::samples::loops::module::<nanvm_lib::naive::Naive> (;705;) (type 1) (param i32 i32)
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
    i32.const 1064562
    i32.store offset=24
    local.get 2
    i32.const 1064555
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
          i32.const 245
          i32.const 1
          local.get 3
          local.get 6
          i32.const 1065754
          i32.const 135
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
          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
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
  (func $"<nanvm_demos::samples::loops::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;706;) (type 3) (param i32 i32 i32 i32)
    (local i32)
    global.get $__stack_pointer
    i32.const 112
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 4
    local.get 3
    i32.store offset=20
    local.get 4
    local.get 2
    i32.store offset=16
    local.get 4
    i32.const 80
    i32.add
    local.get 4
    i32.const 16
    i32.add
    i32.const 0
    call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
    local.get 4
    i32.const 0
    i32.store8 offset=24
    local.get 4
    i64.const 4294967296
    i64.store offset=72
    local.get 4
    local.get 4
    i32.const 24
    i32.add
    i32.store offset=96
    local.get 4
    i32.const 8
    i32.add
    local.get 4
    i32.const 72
    i32.add
    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
    local.get 4
    local.get 4
    i32.load offset=12
    local.tee 2
    i32.store offset=44
    local.get 4
    local.get 4
    i32.load offset=8
    local.tee 3
    i32.store offset=40
    block ;; label = @1
      block ;; label = @2
        local.get 4
        i32.load8_u offset=24
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
        i32.const 40
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
        br 1 (;@1;)
      end
      local.get 3
      i32.eqz
      br_if 0 (;@1;)
      local.get 4
      i32.const 246
      i32.const 1
      local.get 3
      local.get 2
      i32.const 1066720
      i32.const 104
      call $<nanvm_lib::naive::function::Function>::new
      local.tee 3
      i32.store offset=28
      local.get 4
      i32.const 7
      i32.store8 offset=24
      local.get 3
      local.get 3
      i32.load
      i32.const 1
      i32.add
      local.tee 2
      i32.store
      block ;; label = @2
        block ;; label = @3
          local.get 2
          i32.eqz
          br_if 0 (;@3;)
          local.get 4
          local.get 3
          i32.store offset=44
          local.get 4
          i32.const 7
          i32.store8 offset=40
          local.get 4
          i32.const 0
          i32.store8 offset=63
          local.get 4
          i64.const 4607182418800017408
          i64.store offset=88
          local.get 4
          i32.const 2
          i32.store8 offset=80
          local.get 4
          i64.const 4294967296
          i64.store offset=72
          local.get 4
          local.get 4
          i32.const 63
          i32.add
          i32.store offset=96
          local.get 4
          local.get 4
          i32.const 72
          i32.add
          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
          local.get 4
          local.get 4
          i32.load offset=4
          local.tee 2
          i32.store offset=68
          local.get 4
          local.get 4
          i32.load
          local.tee 3
          i32.store offset=64
          block ;; label = @4
            local.get 4
            i32.load8_u offset=63
            i32.const 1
            i32.ne
            br_if 0 (;@4;)
            local.get 3
            local.get 3
            i32.load
            i32.const -1
            i32.add
            local.tee 2
            i32.store
            local.get 2
            br_if 2 (;@2;)
            local.get 4
            i32.const 64
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
            br 2 (;@2;)
          end
          local.get 3
          i32.eqz
          br_if 1 (;@2;)
          local.get 4
          local.get 2
          i32.store offset=80
          local.get 4
          local.get 3
          i32.store offset=76
          local.get 4
          i32.const 6
          i32.store8 offset=72
          local.get 0
          local.get 4
          i32.const 40
          i32.add
          local.get 4
          i32.const 72
          i32.add
          call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
          local.get 4
          i32.const 24
          i32.add
          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
          local.get 4
          i32.load offset=16
          local.tee 3
          local.get 3
          i32.load
          i32.const -1
          i32.add
          local.tee 3
          i32.store
          block ;; label = @4
            local.get 3
            br_if 0 (;@4;)
            local.get 4
            i32.const 16
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
          end
          local.get 4
          i32.const 112
          i32.add
          global.set $__stack_pointer
          return
        end
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
  (func $"<nanvm_demos::samples::loops::module<nanvm_lib::naive::Naive>::{closure#0}::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;726;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i32 i32 i64 f64)
    global.get $__stack_pointer
    i32.const 128
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
    i32.const 8
    i32.add
    local.get 4
    i32.const 0
    call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
    local.get 4
    i32.const 72
    i32.add
    i32.const 2
    i32.or
    local.set 2
    local.get 4
    i32.const 80
    i32.add
    local.set 6
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              loop ;; label = @6
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
                                    block ;; label = @17
                                      local.get 4
                                      i32.load8_u offset=8
                                      local.tee 3
                                      br_table 2 (;@15;) 3 (;@14;) 8 (;@9;) 0 (;@17;) 5 (;@12;) 6 (;@11;) 7 (;@10;) 1 (;@16;) 2 (;@15;)
                                    end
                                    local.get 4
                                    i32.load offset=12
                                    local.tee 1
                                    local.get 1
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 7
                                    i32.store
                                    local.get 7
                                    br_if 3 (;@13;)
                                    br 15 (;@1;)
                                  end
                                  local.get 4
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
                                  br_if 14 (;@1;)
                                  local.get 4
                                  local.get 1
                                  i32.store offset=60
                                  local.get 4
                                  i32.const 7
                                  i32.store8 offset=56
                                  local.get 1
                                  local.get 1
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 8
                                  i32.store
                                  local.get 8
                                  i32.eqz
                                  br_if 14 (;@1;)
                                  br 8 (;@7;)
                                end
                                local.get 4
                                local.get 4
                                i32.load8_u offset=9
                                local.tee 7
                                i32.store8 offset=57
                                local.get 4
                                i32.const 0
                                i32.store8 offset=56
                                br 7 (;@7;)
                              end
                              local.get 4
                              local.get 4
                              i32.load8_u offset=9
                              local.tee 7
                              i32.store8 offset=57
                              local.get 4
                              i32.const 1
                              i32.store8 offset=56
                              br 6 (;@7;)
                            end
                            local.get 4
                            local.get 4
                            i64.load32_u offset=16
                            local.tee 9
                            i64.store offset=64
                            local.get 4
                            local.get 1
                            i32.store offset=60
                            local.get 4
                            i32.const 3
                            i32.store8 offset=56
                            local.get 1
                            local.get 1
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 7
                            i32.store
                            local.get 7
                            i32.eqz
                            br_if 11 (;@1;)
                            br 4 (;@8;)
                          end
                          local.get 4
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
                          br_if 10 (;@1;)
                          local.get 4
                          i64.load8_u offset=20
                          local.set 9
                          local.get 4
                          local.get 1
                          i32.store offset=60
                          local.get 4
                          i32.const 4
                          i32.store8 offset=56
                          local.get 4
                          local.get 9
                          i64.const 32
                          i64.shl
                          local.get 4
                          i64.load32_u offset=16
                          i64.or
                          local.tee 9
                          i64.store offset=64
                          local.get 1
                          local.get 1
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 7
                          i32.store
                          local.get 7
                          i32.eqz
                          br_if 10 (;@1;)
                          br 3 (;@8;)
                        end
                        local.get 4
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
                        br_if 9 (;@1;)
                        local.get 4
                        local.get 4
                        i64.load32_u offset=16
                        local.tee 9
                        i64.store offset=64
                        local.get 4
                        local.get 1
                        i32.store offset=60
                        local.get 4
                        i32.const 5
                        i32.store8 offset=56
                        local.get 1
                        local.get 1
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 7
                        i32.store
                        local.get 7
                        i32.eqz
                        br_if 9 (;@1;)
                        br 2 (;@8;)
                      end
                      local.get 4
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
                      br_if 8 (;@1;)
                      local.get 4
                      local.get 4
                      i64.load32_u offset=16
                      local.tee 9
                      i64.store offset=64
                      local.get 4
                      local.get 1
                      i32.store offset=60
                      local.get 4
                      i32.const 6
                      i32.store8 offset=56
                      local.get 1
                      local.get 1
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
                    local.get 4
                    f64.load offset=16
                    local.tee 10
                    f64.store offset=64
                    local.get 4
                    i32.const 2
                    i32.store8 offset=56
                    local.get 10
                    i64.reinterpret_f64
                    local.set 9
                  end
                end
                local.get 4
                local.get 9
                i64.store offset=104
                local.get 4
                local.get 1
                i32.store offset=100
                local.get 4
                local.get 7
                i32.store8 offset=97
                local.get 4
                local.get 3
                i32.store8 offset=96
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      local.get 5
                      i32.load offset=16
                      i32.eqz
                      br_if 0 (;@9;)
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    local.get 5
                                    i32.load offset=12
                                    local.tee 3
                                    i32.load8_u offset=8
                                    local.tee 7
                                    br_table 6 (;@10;) 6 (;@10;) 0 (;@16;) 1 (;@15;) 2 (;@14;) 3 (;@13;) 4 (;@12;) 5 (;@11;) 6 (;@10;)
                                  end
                                  local.get 3
                                  i64.load offset=16
                                  local.set 9
                                  br 8 (;@7;)
                                end
                                local.get 3
                                i32.load offset=12
                                local.tee 1
                                local.get 1
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 8
                                i32.store
                                local.get 8
                                i32.eqz
                                br_if 13 (;@1;)
                                br 6 (;@8;)
                              end
                              local.get 3
                              i32.load offset=12
                              local.tee 1
                              local.get 1
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 8
                              i32.store
                              local.get 8
                              i32.eqz
                              br_if 12 (;@1;)
                              local.get 3
                              i64.load8_u offset=20
                              i64.const 32
                              i64.shl
                              local.get 3
                              i64.load32_u offset=16
                              i64.or
                              local.set 9
                              br 6 (;@7;)
                            end
                            local.get 3
                            i32.load offset=12
                            local.tee 1
                            local.get 1
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 8
                            i32.store
                            local.get 8
                            i32.eqz
                            br_if 11 (;@1;)
                            br 4 (;@8;)
                          end
                          local.get 3
                          i32.load offset=12
                          local.tee 1
                          local.get 1
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 8
                          i32.store
                          local.get 8
                          i32.eqz
                          br_if 10 (;@1;)
                          br 3 (;@8;)
                        end
                        local.get 3
                        i32.load offset=12
                        local.tee 1
                        local.get 1
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 8
                        i32.store
                        local.get 8
                        i32.eqz
                        br_if 9 (;@1;)
                        br 3 (;@7;)
                      end
                      local.get 3
                      i32.load8_u offset=9
                      local.set 3
                      br 2 (;@7;)
                    end
                    i32.const 0
                    i32.const 0
                    i32.const 1062708
                    call $core::panicking::panic_bounds_check
                    unreachable
                  end
                  local.get 3
                  i64.load32_u offset=16
                  local.set 9
                end
                local.get 4
                local.get 9
                i64.store offset=120
                local.get 4
                local.get 1
                i32.store offset=116
                local.get 4
                local.get 3
                i32.store8 offset=113
                local.get 4
                local.get 7
                i32.store8 offset=112
                local.get 4
                i32.const 72
                i32.add
                local.get 4
                i32.const 96
                i32.add
                local.get 4
                i32.const 112
                i32.add
                call $nanvm_lib::vm::any::relational::compare::<nanvm_lib::naive::Naive>
                local.get 4
                i32.load8_u offset=73
                local.set 1
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=72
                  local.tee 3
                  i32.const 255
                  i32.eq
                  br_if 0 (;@7;)
                  local.get 4
                  local.get 4
                  i64.load offset=80 align=2
                  i64.store offset=46 align=2
                  local.get 4
                  local.get 4
                  i64.load offset=74 align=2
                  i64.store offset=40
                  local.get 4
                  local.get 4
                  i64.load offset=40
                  i64.store offset=24
                  local.get 4
                  local.get 4
                  i64.load offset=46 align=2
                  i64.store offset=30 align=2
                  local.get 0
                  local.get 1
                  i32.store8 offset=9
                  local.get 0
                  local.get 3
                  i32.store8 offset=8
                  local.get 0
                  local.get 4
                  i64.load offset=24
                  i64.store offset=10 align=2
                  local.get 0
                  local.get 4
                  i64.load offset=30 align=2
                  i64.store offset=16 align=2
                  local.get 0
                  i64.const 1
                  i64.store
                  local.get 4
                  i32.const 56
                  i32.add
                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                  br 3 (;@4;)
                end
                local.get 4
                local.get 4
                i64.load offset=40
                i64.store offset=24
                local.get 4
                local.get 4
                i64.load offset=46 align=2
                i64.store offset=30 align=2
                local.get 2
                local.get 4
                i64.load offset=24
                i64.store align=2
                local.get 2
                local.get 4
                i64.load offset=30 align=2
                i64.store offset=6 align=2
                local.get 4
                local.get 1
                i32.const 255
                i32.and
                i32.const 255
                i32.eq
                i32.store8 offset=73
                local.get 4
                i32.const 1
                i32.store8 offset=72
                local.get 4
                i32.const 56
                i32.add
                call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.const 72
                    i32.add
                    call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::boolean_coercion::BooleanCoercion>
                    br_if 0 (;@8;)
                    local.get 4
                    local.get 4
                    i64.load offset=16
                    i64.store offset=80
                    local.get 4
                    local.get 4
                    i64.load offset=8
                    local.tee 9
                    i64.store offset=72
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    local.get 9
                                    i32.wrap_i64
                                    local.tee 3
                                    i32.const 255
                                    i32.and
                                    br_table 6 (;@10;) 6 (;@10;) 0 (;@16;) 1 (;@15;) 2 (;@14;) 3 (;@13;) 4 (;@12;) 5 (;@11;) 6 (;@10;)
                                  end
                                  local.get 4
                                  i64.load offset=80
                                  local.set 9
                                  br 10 (;@5;)
                                end
                                local.get 4
                                i32.load offset=76
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
                                br 7 (;@7;)
                              end
                              local.get 4
                              i32.load offset=76
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
                              local.get 4
                              i64.load8_u offset=84
                              i64.const 32
                              i64.shl
                              local.get 4
                              i64.load32_u offset=80
                              i64.or
                              local.set 9
                              br 8 (;@5;)
                            end
                            local.get 4
                            i32.load offset=76
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
                            br 5 (;@7;)
                          end
                          local.get 4
                          i32.load offset=76
                          local.tee 1
                          local.get 1
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
                        i32.load offset=76
                        local.tee 1
                        local.get 1
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
                      i32.load8_u offset=73
                      local.set 5
                    end
                    br 3 (;@5;)
                  end
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      local.get 4
                                      i32.load8_u offset=8
                                      local.tee 3
                                      br_table 1 (;@16;) 2 (;@15;) 7 (;@10;) 3 (;@14;) 4 (;@13;) 5 (;@12;) 6 (;@11;) 0 (;@17;) 1 (;@16;)
                                    end
                                    local.get 4
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
                                    br_if 15 (;@1;)
                                    local.get 4
                                    local.get 1
                                    i32.store offset=28
                                    local.get 4
                                    i32.const 7
                                    i32.store8 offset=24
                                    local.get 1
                                    local.get 1
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 8
                                    i32.store
                                    local.get 8
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    br 8 (;@8;)
                                  end
                                  local.get 4
                                  local.get 4
                                  i32.load8_u offset=9
                                  local.tee 7
                                  i32.store8 offset=25
                                  local.get 4
                                  i32.const 0
                                  i32.store8 offset=24
                                  br 7 (;@8;)
                                end
                                local.get 4
                                local.get 4
                                i32.load8_u offset=9
                                local.tee 7
                                i32.store8 offset=25
                                local.get 4
                                i32.const 1
                                i32.store8 offset=24
                                br 6 (;@8;)
                              end
                              local.get 4
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
                              br_if 12 (;@1;)
                              local.get 4
                              local.get 4
                              i64.load32_u offset=16
                              local.tee 9
                              i64.store offset=32
                              local.get 4
                              local.get 1
                              i32.store offset=28
                              local.get 4
                              i32.const 3
                              i32.store8 offset=24
                              local.get 1
                              local.get 1
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 7
                              i32.store
                              local.get 7
                              i32.eqz
                              br_if 12 (;@1;)
                              br 4 (;@9;)
                            end
                            local.get 4
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
                            br_if 11 (;@1;)
                            local.get 4
                            i64.load8_u offset=20
                            local.set 9
                            local.get 4
                            local.get 1
                            i32.store offset=28
                            local.get 4
                            i32.const 4
                            i32.store8 offset=24
                            local.get 4
                            local.get 9
                            i64.const 32
                            i64.shl
                            local.get 4
                            i64.load32_u offset=16
                            i64.or
                            local.tee 9
                            i64.store offset=32
                            local.get 1
                            local.get 1
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 7
                            i32.store
                            local.get 7
                            i32.eqz
                            br_if 11 (;@1;)
                            br 3 (;@9;)
                          end
                          local.get 4
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
                          br_if 10 (;@1;)
                          local.get 4
                          local.get 4
                          i64.load32_u offset=16
                          local.tee 9
                          i64.store offset=32
                          local.get 4
                          local.get 1
                          i32.store offset=28
                          local.get 4
                          i32.const 5
                          i32.store8 offset=24
                          local.get 1
                          local.get 1
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 7
                          i32.store
                          local.get 7
                          i32.eqz
                          br_if 10 (;@1;)
                          br 2 (;@9;)
                        end
                        local.get 4
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
                        br_if 9 (;@1;)
                        local.get 4
                        local.get 4
                        i64.load32_u offset=16
                        local.tee 9
                        i64.store offset=32
                        local.get 4
                        local.get 1
                        i32.store offset=28
                        local.get 4
                        i32.const 6
                        i32.store8 offset=24
                        local.get 1
                        local.get 1
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 7
                        i32.store
                        local.get 7
                        i32.eqz
                        br_if 9 (;@1;)
                        br 1 (;@9;)
                      end
                      local.get 4
                      local.get 4
                      f64.load offset=16
                      local.tee 10
                      f64.store offset=32
                      local.get 4
                      i32.const 2
                      i32.store8 offset=24
                      local.get 10
                      i64.reinterpret_f64
                      local.set 9
                    end
                  end
                  local.get 4
                  local.get 9
                  i64.store offset=104
                  local.get 4
                  local.get 1
                  i32.store offset=100
                  local.get 4
                  local.get 7
                  i32.store8 offset=97
                  local.get 4
                  local.get 3
                  i32.store8 offset=96
                  local.get 4
                  i64.const 4611686018427387904
                  i64.store offset=120
                  local.get 4
                  i32.const 2
                  i32.store8 offset=112
                  local.get 4
                  i32.const 72
                  i32.add
                  local.get 4
                  i32.const 96
                  i32.add
                  local.get 4
                  i32.const 112
                  i32.add
                  call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::arith::Mul>::mul>"
                  local.get 4
                  local.get 6
                  i64.load
                  i64.store offset=56
                  local.get 4
                  local.get 6
                  i64.load offset=8
                  i64.store offset=64
                  block ;; label = @8
                    local.get 4
                    i32.load offset=72
                    i32.eqz
                    br_if 0 (;@8;)
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
                    i32.const 24
                    i32.add
                    call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                    br 4 (;@4;)
                  end
                  local.get 4
                  local.get 4
                  i64.load offset=64
                  i64.store offset=48
                  local.get 4
                  local.get 4
                  i64.load offset=56
                  local.tee 9
                  i64.store offset=40
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    local.get 9
                                    i32.wrap_i64
                                    local.tee 3
                                    i32.const 255
                                    i32.and
                                    br_table 6 (;@10;) 6 (;@10;) 0 (;@16;) 1 (;@15;) 2 (;@14;) 3 (;@13;) 4 (;@12;) 5 (;@11;) 6 (;@10;)
                                  end
                                  local.get 4
                                  i64.load offset=48
                                  local.set 9
                                  br 7 (;@8;)
                                end
                                local.get 4
                                i32.load offset=44
                                local.tee 1
                                local.get 1
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 7
                                i32.store
                                local.get 7
                                i32.eqz
                                br_if 13 (;@1;)
                                br 5 (;@9;)
                              end
                              local.get 4
                              i32.load offset=44
                              local.tee 1
                              local.get 1
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 7
                              i32.store
                              local.get 7
                              i32.eqz
                              br_if 12 (;@1;)
                              local.get 4
                              i64.load8_u offset=52
                              i64.const 32
                              i64.shl
                              local.get 4
                              i64.load32_u offset=48
                              i64.or
                              local.set 9
                              br 5 (;@8;)
                            end
                            local.get 4
                            i32.load offset=44
                            local.tee 1
                            local.get 1
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 7
                            i32.store
                            local.get 7
                            i32.eqz
                            br_if 11 (;@1;)
                            br 3 (;@9;)
                          end
                          local.get 4
                          i32.load offset=44
                          local.tee 1
                          local.get 1
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 7
                          i32.store
                          local.get 7
                          i32.eqz
                          br_if 10 (;@1;)
                          br 2 (;@9;)
                        end
                        local.get 4
                        i32.load offset=44
                        local.tee 1
                        local.get 1
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 8
                        i32.store
                        local.get 8
                        i32.eqz
                        br_if 9 (;@1;)
                        br 2 (;@8;)
                      end
                      local.get 4
                      i32.load8_u offset=41
                      local.set 7
                      br 1 (;@8;)
                    end
                    local.get 4
                    i64.load32_u offset=48
                    local.set 9
                  end
                  local.get 4
                  i32.const 8
                  i32.add
                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                  local.get 4
                  local.get 9
                  i64.store offset=16
                  local.get 4
                  local.get 1
                  i32.store offset=12
                  local.get 4
                  local.get 7
                  i32.store8 offset=9
                  local.get 4
                  local.get 3
                  i32.store8 offset=8
                  local.get 4
                  i32.const 40
                  i32.add
                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i32.const 24
                  i32.add
                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                  br 1 (;@6;)
                end
              end
              local.get 4
              i64.load32_u offset=80
              local.set 9
            end
            local.get 0
            local.get 9
            i64.store offset=16
            local.get 0
            local.get 1
            i32.store offset=12
            local.get 0
            local.get 5
            i32.store8 offset=9
            local.get 0
            local.get 3
            i32.store8 offset=8
            local.get 0
            i64.const 0
            i64.store
            local.get 4
            i32.const 72
            i32.add
            call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
            local.get 4
            i32.load
            local.tee 1
            local.get 1
            i32.load
            i32.const -1
            i32.add
            local.tee 1
            i32.store
            local.get 1
            br_if 2 (;@2;)
            br 1 (;@3;)
          end
          local.get 4
          i32.const 8
          i32.add
          call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
          local.get 4
          i32.load
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
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
      end
      local.get 4
      i32.const 128
      i32.add
      global.set $__stack_pointer
      return
    end
    unreachable
  )
