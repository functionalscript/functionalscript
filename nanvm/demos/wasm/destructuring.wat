  (func $nanvm_demos::samples::destructuring::module::<nanvm_lib::naive::Naive> (;183;) (type 1) (param i32 i32)
    (local i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 128
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    local.get 2
    i32.const 0
    i32.store8 offset=64
    local.get 2
    i32.const 24
    i32.add
    local.get 2
    i32.const 64
    i32.add
    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::empty::Empty<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
    local.get 2
    local.get 2
    i32.load offset=28
    local.tee 3
    i32.store offset=84
    local.get 2
    local.get 2
    i32.load offset=24
    local.tee 4
    i32.store offset=80
    block ;; label = @1
      block ;; label = @2
        local.get 2
        i32.load8_u offset=64
        i32.const 1
        i32.ne
        br_if 0 (;@2;)
        local.get 4
        local.get 4
        i32.load
        i32.const -1
        i32.add
        local.tee 0
        i32.store
        local.get 0
        br_if 1 (;@1;)
        local.get 2
        i32.const 80
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
        br 1 (;@1;)
      end
      local.get 4
      i32.eqz
      br_if 0 (;@1;)
      local.get 2
      i32.const 6
      i32.const 1
      local.get 4
      local.get 3
      i32.const 1054919
      i32.const 62
      call $<nanvm_lib::naive::function::Function>::new
      local.tee 4
      i32.store offset=36
      local.get 2
      i32.const 7
      i32.store8 offset=32
      local.get 2
      i32.const 0
      i32.store16 offset=60
      local.get 2
      i32.const 1054903
      i32.store offset=56
      local.get 2
      i32.const 1054896
      i32.store offset=52
      local.get 2
      i32.const 80
      i32.add
      local.get 2
      i32.const 52
      i32.add
      call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              local.get 2
              i32.load8_u offset=80
              local.tee 3
              i32.const 255
              i32.ne
              br_if 0 (;@5;)
              local.get 2
              i32.load offset=88
              local.set 5
              local.get 2
              i32.load offset=84
              local.set 6
              local.get 4
              local.get 4
              i32.load
              i32.const 1
              i32.add
              local.tee 3
              i32.store
              local.get 3
              i32.eqz
              br_if 1 (;@4;)
              local.get 2
              i32.const 0
              i32.store8 offset=52
              local.get 2
              i64.const 0
              i64.store offset=96
              local.get 2
              local.get 4
              i32.store offset=92
              local.get 2
              i32.const 7
              i32.store8 offset=88
              local.get 2
              i64.const 4294967296
              i64.store offset=80
              local.get 2
              local.get 2
              i32.const 52
              i32.add
              i32.store offset=104
              local.get 2
              i32.const 16
              i32.add
              local.get 2
              i32.const 80
              i32.add
              call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
              local.get 2
              local.get 2
              i32.load offset=20
              local.tee 3
              i32.store offset=68
              local.get 2
              local.get 2
              i32.load offset=16
              local.tee 4
              i32.store offset=64
              block ;; label = @6
                local.get 2
                i32.load8_u offset=52
                i32.const 1
                i32.ne
                br_if 0 (;@6;)
                local.get 4
                local.get 4
                i32.load
                i32.const -1
                i32.add
                local.tee 0
                i32.store
                local.get 0
                br_if 4 (;@2;)
                local.get 2
                i32.const 64
                i32.add
                call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                br 4 (;@2;)
              end
              local.get 4
              i32.eqz
              br_if 3 (;@2;)
              i32.const 7
              i32.const 0
              local.get 4
              local.get 3
              i32.const 1054981
              i32.const 92
              call $<nanvm_lib::naive::function::Function>::new
              local.set 4
              local.get 2
              i32.const 0
              i32.store8 offset=52
              local.get 2
              local.get 4
              i32.store offset=100
              local.get 2
              i32.const 7
              i32.store8 offset=96
              local.get 2
              local.get 5
              i32.store offset=92
              local.get 2
              local.get 6
              i32.store offset=88
              local.get 2
              i64.const 4294967296
              i64.store offset=80
              local.get 2
              local.get 2
              i32.const 52
              i32.add
              i32.store offset=112
              local.get 2
              i32.const 8
              i32.add
              local.get 2
              i32.const 80
              i32.add
              call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 1>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
              local.get 2
              local.get 2
              i32.load offset=12
              local.tee 3
              i32.store offset=68
              local.get 2
              local.get 2
              i32.load offset=8
              local.tee 4
              i32.store offset=64
              block ;; label = @6
                local.get 2
                i32.load8_u offset=52
                i32.const 1
                i32.ne
                br_if 0 (;@6;)
                local.get 4
                local.get 4
                i32.load
                i32.const -1
                i32.add
                local.tee 0
                i32.store
                local.get 0
                br_if 3 (;@3;)
                local.get 2
                i32.const 64
                i32.add
                call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
                br 3 (;@3;)
              end
              local.get 4
              i32.eqz
              br_if 2 (;@3;)
              local.get 0
              local.get 3
              i32.store offset=16
              local.get 0
              local.get 4
              i32.store offset=12
              local.get 0
              i32.const 5
              i32.store8 offset=8
              local.get 0
              i64.const 0
              i64.store
              local.get 2
              i32.const 32
              i32.add
              call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 1
              call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 2
              i32.const 128
              i32.add
              global.set $__stack_pointer
              return
            end
            local.get 2
            local.get 2
            i32.load8_u offset=83
            i32.store8 offset=67
            local.get 2
            local.get 2
            i32.load16_u offset=81 align=1
            i32.store16 offset=65 align=1
            local.get 2
            local.get 2
            i32.load offset=92
            i32.store offset=76
            local.get 2
            local.get 2
            i64.load offset=84 align=4
            i64.store offset=68 align=4
            local.get 2
            local.get 3
            i32.store8 offset=64
            i32.const 1063112
            i32.const 43
            local.get 2
            i32.const 64
            i32.add
            i32.const 1063096
            i32.const 1063156
            call $core::result::unwrap_failed
          end
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
  (func $"<nanvm_demos::samples::destructuring::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;184;) (type 3) (param i32 i32 i32 i32)
    (local i32 i64 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 288
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 4
    local.get 2
    i32.store offset=16
    local.get 4
    local.get 3
    i32.store offset=20
    local.get 4
    i32.const 0
    i32.store8 offset=200
    local.get 4
    i32.const 1
    i32.store offset=220
    local.get 4
    local.get 3
    i32.const 1
    local.get 3
    i32.const 1
    i32.gt_u
    select
    i32.store offset=224
    local.get 4
    local.get 4
    i32.const 200
    i32.add
    i32.store offset=228
    local.get 4
    local.get 4
    i32.const 16
    i32.add
    i32.store offset=216
    local.get 4
    i32.const 8
    i32.add
    local.get 4
    i32.const 216
    i32.add
    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::adapters::map::Map<core::ops::range::Range<u32>, <nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::rest::{closure#0}>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
    local.get 4
    local.get 4
    i32.load offset=12
    local.tee 2
    i32.store offset=108
    local.get 4
    local.get 4
    i32.load offset=8
    local.tee 3
    i32.store offset=104
    block ;; label = @1
      block ;; label = @2
        local.get 4
        i32.load8_u offset=200
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
        i32.const 104
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
        br 1 (;@1;)
      end
      local.get 3
      i32.eqz
      br_if 0 (;@1;)
      local.get 4
      local.get 2
      i32.store offset=32
      local.get 4
      local.get 3
      i32.store offset=28
      local.get 4
      i32.const 6
      i32.store8 offset=24
      local.get 4
      i32.const 224
      i32.add
      local.get 4
      i32.const 16
      i32.add
      i32.const 0
      call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
      local.get 4
      i64.const 1
      i64.store offset=216
      local.get 4
      i32.const 104
      i32.add
      local.get 4
      i32.const 216
      i32.add
      call $"nanvm_lib::vm::unstable::spread_array::<nanvm_lib::naive::Naive, [nanvm_lib::vm::unstable::ArrayItem<nanvm_lib::naive::Naive>; 1]>"
      local.get 4
      local.get 4
      i64.load offset=112
      i64.store offset=200
      local.get 4
      local.get 4
      i64.load offset=120
      i64.store offset=208
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                local.get 4
                i64.load offset=104
                i64.const 1
                i64.ne
                br_if 0 (;@6;)
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
                br 1 (;@5;)
              end
              local.get 4
              local.get 4
              i64.load offset=208
              i64.store offset=48
              local.get 4
              local.get 4
              i64.load offset=200
              local.tee 5
              i64.store offset=40
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
                                  local.get 5
                                  i32.wrap_i64
                                  local.tee 2
                                  i32.const 255
                                  i32.and
                                  br_table 6 (;@9;) 6 (;@9;) 0 (;@15;) 1 (;@14;) 2 (;@13;) 3 (;@12;) 4 (;@11;) 5 (;@10;) 6 (;@9;)
                                end
                                local.get 4
                                i64.load offset=48
                                local.set 5
                                br 8 (;@6;)
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
                              br_if 11 (;@2;)
                              br 6 (;@7;)
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
                            br_if 10 (;@2;)
                            local.get 4
                            i64.load8_u offset=52
                            i64.const 32
                            i64.shl
                            local.get 4
                            i64.load32_u offset=48
                            i64.or
                            local.set 5
                            br 6 (;@6;)
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
                          br_if 4 (;@7;)
                          br 9 (;@2;)
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
                        br_if 3 (;@7;)
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
                      br_if 7 (;@2;)
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.load8_u offset=41
                    local.set 6
                  end
                  br 1 (;@6;)
                end
                local.get 4
                i64.load32_u offset=48
                local.set 5
              end
              local.get 4
              local.get 5
              i64.store offset=208
              local.get 4
              local.get 3
              i32.store offset=204
              local.get 4
              local.get 6
              i32.store8 offset=201
              local.get 4
              local.get 2
              i32.store8 offset=200
              local.get 4
              i64.const 0
              i64.store offset=224
              local.get 4
              i32.const 2
              i32.store8 offset=216
              local.get 4
              i32.const 104
              i32.add
              local.get 4
              i32.const 200
              i32.add
              local.get 4
              i32.const 216
              i32.add
              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
              block ;; label = @6
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
                  br 1 (;@6;)
                end
                local.get 4
                local.get 4
                i64.load offset=128
                i64.store offset=240
                local.get 4
                local.get 4
                i64.load offset=120
                i64.store offset=232
                local.get 4
                local.get 4
                i64.load offset=112
                i64.store offset=224
                local.get 4
                local.get 4
                i64.load offset=104
                i64.store offset=216
                local.get 4
                i32.const 200
                i32.add
                local.get 4
                i32.const 216
                i32.add
                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=200
                    i32.const 255
                    i32.eq
                    br_if 0 (;@8;)
                    local.get 4
                    local.get 4
                    i64.load offset=208
                    i64.store offset=64
                    local.get 4
                    local.get 4
                    i64.load offset=200
                    i64.store offset=56
                    br 1 (;@7;)
                  end
                  local.get 4
                  i32.const 256
                  i32.store16 offset=56
                end
                local.get 4
                i32.const 216
                i32.add
                call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i32.const 232
                i32.add
                call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
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
                                    local.get 4
                                    i32.load8_u offset=40
                                    local.tee 2
                                    br_table 6 (;@10;) 6 (;@10;) 0 (;@16;) 1 (;@15;) 2 (;@14;) 3 (;@13;) 4 (;@12;) 5 (;@11;) 6 (;@10;)
                                  end
                                  local.get 4
                                  i64.load offset=48
                                  local.set 5
                                  br 8 (;@7;)
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
                                br_if 12 (;@2;)
                                br 6 (;@8;)
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
                              br_if 11 (;@2;)
                              local.get 4
                              i64.load8_u offset=52
                              i64.const 32
                              i64.shl
                              local.get 4
                              i64.load32_u offset=48
                              i64.or
                              local.set 5
                              br 6 (;@7;)
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
                            br_if 10 (;@2;)
                            br 4 (;@8;)
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
                          br_if 9 (;@2;)
                          br 3 (;@8;)
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
                        br_if 8 (;@2;)
                        br 1 (;@9;)
                      end
                      local.get 4
                      i32.load8_u offset=41
                      local.set 6
                    end
                    br 1 (;@7;)
                  end
                  local.get 4
                  i64.load32_u offset=48
                  local.set 5
                end
                local.get 4
                local.get 5
                i64.store offset=208
                local.get 4
                local.get 3
                i32.store offset=204
                local.get 4
                local.get 6
                i32.store8 offset=201
                local.get 4
                local.get 2
                i32.store8 offset=200
                local.get 4
                i64.const 4607182418800017408
                i64.store offset=224
                local.get 4
                i32.const 2
                i32.store8 offset=216
                local.get 4
                i32.const 136
                i32.add
                local.get 4
                i32.const 200
                i32.add
                local.get 4
                i32.const 216
                i32.add
                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=136
                    i32.const 255
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 4
                    i32.const 136
                    i32.add
                    i32.const 8
                    i32.add
                    local.set 3
                    br 1 (;@7;)
                  end
                  local.get 4
                  local.get 4
                  i64.load offset=160
                  i64.store offset=240
                  local.get 4
                  local.get 4
                  i64.load offset=152
                  i64.store offset=232
                  local.get 4
                  local.get 4
                  i64.load offset=144
                  i64.store offset=224
                  local.get 4
                  local.get 4
                  i64.load offset=136
                  i64.store offset=216
                  local.get 4
                  i32.const 200
                  i32.add
                  local.get 4
                  i32.const 216
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
                      i64.store offset=80
                      local.get 4
                      local.get 4
                      i64.load offset=200
                      i64.store offset=72
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.const 256
                    i32.store16 offset=72
                  end
                  local.get 4
                  i32.const 216
                  i32.add
                  call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i32.const 232
                  i32.add
                  call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i32.const 0
                  i32.store16 offset=96
                  local.get 4
                  i32.const 1056374
                  i32.store offset=92
                  local.get 4
                  i32.const 1056368
                  i32.store offset=88
                  local.get 4
                  i32.const 216
                  i32.add
                  local.get 4
                  i32.const 88
                  i32.add
                  call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=216
                        local.tee 3
                        i32.const 255
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 4
                        local.get 4
                        i64.load offset=220 align=4
                        i64.store offset=204 align=4
                        local.get 4
                        i32.const 3
                        i32.store8 offset=200
                        local.get 4
                        i32.const 168
                        i32.add
                        local.get 4
                        i32.const 72
                        i32.add
                        local.get 4
                        i32.const 200
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=168
                          i32.const 255
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 4
                          i32.const 168
                          i32.add
                          i32.const 8
                          i32.add
                          local.set 3
                          br 4 (;@7;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=192
                        i64.store offset=240
                        local.get 4
                        local.get 4
                        i64.load offset=184
                        i64.store offset=232
                        local.get 4
                        local.get 4
                        i64.load offset=176
                        i64.store offset=224
                        local.get 4
                        local.get 4
                        i64.load offset=168
                        i64.store offset=216
                        local.get 4
                        i32.const 200
                        i32.add
                        local.get 4
                        i32.const 216
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                        block ;; label = @11
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=200
                            local.tee 2
                            i32.const 255
                            i32.ne
                            br_if 0 (;@12;)
                            i32.const 1
                            local.set 6
                            i32.const 0
                            local.set 2
                            br 1 (;@11;)
                          end
                          local.get 4
                          local.get 4
                          i64.load offset=202 align=2
                          i64.store offset=88
                          local.get 4
                          local.get 4
                          i64.load offset=208 align=2
                          i64.store offset=94 align=2
                          local.get 4
                          i32.load8_u offset=201
                          local.set 6
                        end
                        local.get 4
                        i32.const 216
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 232
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        local.get 4
                                        i32.load8_u offset=24
                                        local.tee 7
                                        br_table 6 (;@12;) 6 (;@12;) 0 (;@18;) 1 (;@17;) 2 (;@16;) 3 (;@15;) 4 (;@14;) 5 (;@13;) 6 (;@12;)
                                      end
                                      local.get 4
                                      i64.load offset=32
                                      local.set 5
                                      br 9 (;@8;)
                                    end
                                    local.get 4
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
                                    br_if 14 (;@2;)
                                    br 7 (;@9;)
                                  end
                                  local.get 4
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
                                  br_if 13 (;@2;)
                                  local.get 4
                                  i64.load8_u offset=36
                                  i64.const 32
                                  i64.shl
                                  local.get 4
                                  i64.load32_u offset=32
                                  i64.or
                                  local.set 5
                                  br 7 (;@8;)
                                end
                                local.get 4
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
                                br_if 12 (;@2;)
                                br 5 (;@9;)
                              end
                              local.get 4
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
                              br_if 11 (;@2;)
                              br 4 (;@9;)
                            end
                            local.get 4
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
                            br_if 10 (;@2;)
                            br 1 (;@11;)
                          end
                          local.get 4
                          i32.load8_u offset=25
                          local.set 8
                        end
                        br 2 (;@8;)
                      end
                      local.get 4
                      local.get 4
                      i32.load8_u offset=219
                      i32.store8 offset=203
                      local.get 4
                      local.get 4
                      i32.load16_u offset=217 align=1
                      i32.store16 offset=201 align=1
                      local.get 4
                      local.get 4
                      i32.load offset=228
                      i32.store offset=212
                      local.get 4
                      local.get 4
                      i64.load offset=220 align=4
                      i64.store offset=204 align=4
                      local.get 4
                      local.get 3
                      i32.store8 offset=200
                      i32.const 1063112
                      i32.const 43
                      local.get 4
                      i32.const 200
                      i32.add
                      i32.const 1063096
                      i32.const 1063156
                      call $core::result::unwrap_failed
                      unreachable
                    end
                    local.get 4
                    i64.load32_u offset=32
                    local.set 5
                  end
                  local.get 4
                  local.get 4
                  i64.load offset=64
                  i64.store offset=232
                  local.get 4
                  local.get 4
                  i64.load offset=56
                  i64.store offset=224
                  local.get 4
                  local.get 4
                  i64.load offset=88
                  i64.store offset=242 align=2
                  local.get 4
                  local.get 4
                  i64.load offset=94 align=2
                  i64.store offset=248 align=2
                  local.get 4
                  i32.const 0
                  i32.store8 offset=56
                  local.get 4
                  local.get 5
                  i64.store offset=264
                  local.get 4
                  local.get 3
                  i32.store offset=260
                  local.get 4
                  local.get 8
                  i32.store8 offset=257
                  local.get 4
                  local.get 7
                  i32.store8 offset=256
                  local.get 4
                  local.get 6
                  i32.store8 offset=241
                  local.get 4
                  local.get 2
                  i32.store8 offset=240
                  local.get 4
                  i64.const 12884901888
                  i64.store offset=216
                  local.get 4
                  local.get 4
                  i32.const 56
                  i32.add
                  i32.store offset=272
                  local.get 4
                  local.get 4
                  i32.const 216
                  i32.add
                  call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 3>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                  local.get 4
                  local.get 4
                  i32.load offset=4
                  local.tee 2
                  i32.store offset=204
                  local.get 4
                  local.get 4
                  i32.load
                  local.tee 3
                  i32.store offset=200
                  block ;; label = @8
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=56
                      i32.const 1
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 3
                      local.get 3
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 0
                      i32.store
                      local.get 0
                      br_if 1 (;@8;)
                      local.get 4
                      i32.const 200
                      i32.add
                      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                      br 1 (;@8;)
                    end
                    local.get 3
                    i32.eqz
                    br_if 0 (;@8;)
                    local.get 0
                    local.get 2
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
                    i32.const 40
                    i32.add
                    call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i32.const 24
                    i32.add
                    call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i32.load offset=16
                    local.tee 0
                    local.get 0
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 0
                    i32.store
                    local.get 0
                    br_if 5 (;@3;)
                    br 4 (;@4;)
                  end
                  i32.const 1059464
                  i32.const 43
                  local.get 4
                  i32.const 287
                  i32.add
                  i32.const 1059448
                  i32.const 1059508
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
                i32.const 56
                i32.add
                call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              end
              local.get 4
              i32.const 40
              i32.add
              call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            end
            local.get 4
            i32.const 24
            i32.add
            call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 4
            i32.load offset=16
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
          i32.const 16
          i32.add
          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
        end
        local.get 4
        i32.const 288
        i32.add
        global.set $__stack_pointer
        return
      end
      unreachable
    end
    i32.const 1059464
    i32.const 43
    local.get 4
    i32.const 287
    i32.add
    i32.const 1059448
    i32.const 1059508
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::destructuring::module<nanvm_lib::naive::Naive>::{closure#1} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;185;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i32 i64 i32)
    global.get $__stack_pointer
    i32.const 480
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 1
    i32.load
    local.set 5
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
    local.tee 1
    i32.store
    block ;; label = @1
      local.get 1
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
      i32.const 0
      i32.store16 offset=288
      local.get 4
      i32.const 1056375
      i32.store offset=284
      local.get 4
      i32.const 1056374
      i32.store offset=280
      local.get 4
      i32.const 408
      i32.add
      local.get 4
      i32.const 280
      i32.add
      call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            local.get 4
            i32.load8_u offset=408
            local.tee 3
            i32.const 255
            i32.ne
            br_if 0 (;@4;)
            local.get 4
            local.get 4
            i32.load offset=416
            local.tee 6
            i32.store offset=252
            local.get 4
            local.get 4
            i32.load offset=412
            local.tee 1
            i32.store offset=248
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=56
                            local.tee 7
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 4
                          i64.load offset=64
                          local.set 8
                          br 9 (;@2;)
                        end
                        local.get 4
                        i32.load offset=60
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 9
                        i32.store
                        local.get 9
                        i32.eqz
                        br_if 9 (;@1;)
                        br 7 (;@3;)
                      end
                      local.get 4
                      i32.load offset=60
                      local.tee 3
                      local.get 3
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 9
                      i32.store
                      local.get 9
                      i32.eqz
                      br_if 8 (;@1;)
                      local.get 4
                      i64.load8_u offset=68
                      i64.const 32
                      i64.shl
                      local.get 4
                      i64.load32_u offset=64
                      i64.or
                      local.set 8
                      br 7 (;@2;)
                    end
                    local.get 4
                    i32.load offset=60
                    local.tee 3
                    local.get 3
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 9
                    i32.store
                    local.get 9
                    br_if 5 (;@3;)
                    br 7 (;@1;)
                  end
                  local.get 4
                  i32.load offset=60
                  local.tee 3
                  local.get 3
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 9
                  i32.store
                  local.get 9
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
                local.tee 9
                i32.store
                local.get 9
                i32.eqz
                br_if 5 (;@1;)
                br 1 (;@5;)
              end
              local.get 4
              i32.load8_u offset=57
              local.set 9
            end
            br 2 (;@2;)
          end
          local.get 4
          local.get 4
          i32.load8_u offset=411
          i32.store8 offset=347
          local.get 4
          local.get 4
          i32.load16_u offset=409 align=1
          i32.store16 offset=345 align=1
          local.get 4
          local.get 4
          i32.load offset=420
          i32.store offset=356
          local.get 4
          local.get 4
          i64.load offset=412 align=4
          i64.store offset=348 align=4
          local.get 4
          local.get 3
          i32.store8 offset=344
          i32.const 1063112
          i32.const 43
          local.get 4
          i32.const 344
          i32.add
          i32.const 1063096
          i32.const 1063156
          call $core::result::unwrap_failed
          unreachable
        end
        local.get 4
        i64.load32_u offset=64
        local.set 8
      end
      local.get 4
      local.get 8
      i64.store offset=352
      local.get 4
      local.get 3
      i32.store offset=348
      local.get 4
      local.get 9
      i32.store8 offset=345
      local.get 4
      local.get 7
      i32.store8 offset=344
      local.get 4
      i64.const 0
      i64.store offset=416
      local.get 4
      i32.const 2
      i32.store8 offset=408
      local.get 4
      i32.const 216
      i32.add
      local.get 4
      i32.const 344
      i32.add
      local.get 4
      i32.const 408
      i32.add
      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              local.get 4
              i32.load8_u offset=216
              i32.const 255
              i32.ne
              br_if 0 (;@5;)
              local.get 0
              local.get 4
              i64.load offset=232
              i64.store offset=16
              local.get 0
              local.get 4
              i64.load offset=224
              i64.store offset=8
              local.get 0
              i64.const 1
              i64.store
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
              i32.const 248
              i32.add
              call $"<alloc::rc::Rc<[u16]>>::drop_slow"
              br 1 (;@4;)
            end
            local.get 4
            local.get 4
            i64.load offset=240
            i64.store offset=432
            local.get 4
            local.get 4
            i64.load offset=232
            i64.store offset=424
            local.get 4
            local.get 4
            i64.load offset=224
            i64.store offset=416
            local.get 4
            local.get 4
            i64.load offset=216
            i64.store offset=408
            local.get 4
            i32.const 344
            i32.add
            local.get 4
            i32.const 408
            i32.add
            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
            local.get 4
            i32.const 320
            i32.add
            local.set 3
            block ;; label = @5
              block ;; label = @6
                local.get 4
                i32.load8_u offset=344
                i32.const 255
                i32.eq
                br_if 0 (;@6;)
                local.get 3
                local.get 4
                i64.load offset=352
                i64.store offset=8
                local.get 3
                local.get 4
                i64.load offset=344
                i64.store
                br 1 (;@5;)
              end
              local.get 4
              i32.const 256
              i32.store16 offset=320
            end
            local.get 4
            i32.const 408
            i32.add
            call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 4
            i32.const 424
            i32.add
            call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 4
            local.get 6
            i32.store offset=316
            local.get 4
            local.get 1
            i32.store offset=312
            local.get 4
            i32.const 0
            i32.store16 offset=288
            local.get 4
            i32.const 1056376
            i32.store offset=284
            local.get 4
            i32.const 1056375
            i32.store offset=280
            local.get 4
            i32.const 408
            i32.add
            local.get 4
            i32.const 280
            i32.add
            call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=408
                  local.tee 1
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 4
                  local.get 4
                  i64.load offset=412 align=4
                  i64.store offset=200 align=4
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  local.get 4
                                  i32.load8_u offset=56
                                  local.tee 7
                                  br_table 6 (;@9;) 6 (;@9;) 0 (;@15;) 1 (;@14;) 2 (;@13;) 3 (;@12;) 4 (;@11;) 5 (;@10;) 6 (;@9;)
                                end
                                local.get 4
                                i64.load offset=64
                                local.set 8
                                br 9 (;@5;)
                              end
                              local.get 4
                              i32.load offset=60
                              local.tee 1
                              local.get 1
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 9
                              i32.store
                              local.get 9
                              i32.eqz
                              br_if 12 (;@1;)
                              br 7 (;@6;)
                            end
                            local.get 4
                            i32.load offset=60
                            local.tee 1
                            local.get 1
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 9
                            i32.store
                            local.get 9
                            i32.eqz
                            br_if 11 (;@1;)
                            local.get 4
                            i64.load8_u offset=68
                            i64.const 32
                            i64.shl
                            local.get 4
                            i64.load32_u offset=64
                            i64.or
                            local.set 8
                            br 7 (;@5;)
                          end
                          local.get 4
                          i32.load offset=60
                          local.tee 1
                          local.get 1
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 9
                          i32.store
                          local.get 9
                          i32.eqz
                          br_if 10 (;@1;)
                          br 5 (;@6;)
                        end
                        local.get 4
                        i32.load offset=60
                        local.tee 1
                        local.get 1
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 9
                        i32.store
                        local.get 9
                        i32.eqz
                        br_if 9 (;@1;)
                        br 4 (;@6;)
                      end
                      local.get 4
                      i32.load offset=60
                      local.tee 1
                      local.get 1
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
                    local.get 4
                    i32.load8_u offset=57
                    local.set 9
                  end
                  br 2 (;@5;)
                end
                local.get 4
                local.get 4
                i32.load8_u offset=411
                i32.store8 offset=347
                local.get 4
                local.get 4
                i32.load16_u offset=409 align=1
                i32.store16 offset=345 align=1
                local.get 4
                local.get 4
                i32.load offset=420
                i32.store offset=356
                local.get 4
                local.get 4
                i64.load offset=412 align=4
                i64.store offset=348 align=4
                local.get 4
                local.get 1
                i32.store8 offset=344
                i32.const 1063112
                i32.const 43
                local.get 4
                i32.const 344
                i32.add
                i32.const 1063096
                i32.const 1063156
                call $core::result::unwrap_failed
                unreachable
              end
              local.get 4
              i64.load32_u offset=64
              local.set 8
            end
            local.get 4
            local.get 8
            i64.store offset=288
            local.get 4
            local.get 1
            i32.store offset=284
            local.get 4
            local.get 9
            i32.store8 offset=281
            local.get 4
            local.get 7
            i32.store8 offset=280
            local.get 4
            i64.const 0
            i64.store offset=416
            local.get 4
            i32.const 2
            i32.store8 offset=408
            local.get 4
            i32.const 248
            i32.add
            local.get 4
            i32.const 280
            i32.add
            local.get 4
            i32.const 408
            i32.add
            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=248
                    i32.const 255
                    i32.ne
                    br_if 0 (;@8;)
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
                    i32.load offset=200
                    local.tee 0
                    local.get 0
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 0
                    i32.store
                    block ;; label = @9
                      local.get 0
                      br_if 0 (;@9;)
                      local.get 4
                      i32.const 200
                      i32.add
                      call $"<alloc::rc::Rc<[u16]>>::drop_slow"
                    end
                    local.get 4
                    i32.load offset=312
                    local.tee 0
                    local.get 0
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 0
                    i32.store
                    local.get 0
                    i32.eqz
                    br_if 1 (;@7;)
                    br 3 (;@5;)
                  end
                  local.get 4
                  local.get 4
                  i64.load offset=272
                  i64.store offset=432
                  local.get 4
                  local.get 4
                  i64.load offset=264
                  i64.store offset=424
                  local.get 4
                  local.get 4
                  i64.load offset=256
                  i64.store offset=416
                  local.get 4
                  local.get 4
                  i64.load offset=248
                  i64.store offset=408
                  local.get 4
                  i32.const 280
                  i32.add
                  local.get 4
                  i32.const 408
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                  block ;; label = @8
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=280
                      i32.const 255
                      i32.eq
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 4
                      i64.load offset=288
                      i64.store offset=96
                      local.get 4
                      local.get 4
                      i64.load offset=280
                      i64.store offset=88
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.const 256
                    i32.store16 offset=88
                  end
                  local.get 4
                  i32.const 408
                  i32.add
                  call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i32.const 424
                  i32.add
                  call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i64.const 4611686018427387904
                  i64.store offset=416
                  local.get 4
                  i32.const 2
                  i32.store8 offset=408
                  local.get 4
                  i32.const 344
                  i32.add
                  local.get 4
                  i32.const 88
                  i32.add
                  local.get 4
                  i32.const 408
                  i32.add
                  call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::arith::Mul>::mul>"
                  local.get 4
                  local.get 4
                  i64.load offset=352
                  i64.store offset=392
                  local.get 4
                  local.get 4
                  i64.load offset=360
                  i64.store offset=400
                  local.get 4
                  i64.load offset=344
                  i64.const 1
                  i64.ne
                  br_if 1 (;@6;)
                  local.get 0
                  local.get 4
                  i64.load offset=400
                  i64.store offset=16
                  local.get 0
                  local.get 4
                  i64.load offset=392
                  i64.store offset=8
                  local.get 0
                  i64.const 1
                  i64.store
                  local.get 4
                  i32.load offset=200
                  local.tee 0
                  local.get 0
                  i32.load
                  i32.const -1
                  i32.add
                  local.tee 0
                  i32.store
                  block ;; label = @8
                    local.get 0
                    br_if 0 (;@8;)
                    local.get 4
                    i32.const 200
                    i32.add
                    call $"<alloc::rc::Rc<[u16]>>::drop_slow"
                  end
                  local.get 4
                  i32.load offset=312
                  local.tee 0
                  local.get 0
                  i32.load
                  i32.const -1
                  i32.add
                  local.tee 0
                  i32.store
                  local.get 0
                  br_if 2 (;@5;)
                end
                local.get 4
                i32.const 312
                i32.add
                call $"<alloc::rc::Rc<[u16]>>::drop_slow"
                local.get 3
                call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                br 2 (;@4;)
              end
              local.get 4
              local.get 4
              i64.load offset=400
              i64.store offset=424
              local.get 4
              local.get 4
              i64.load offset=392
              i64.store offset=416
              local.get 4
              i32.const 0
              i32.store8 offset=280
              local.get 4
              i64.const 4294967296
              i64.store offset=408
              local.get 4
              local.get 4
              i32.const 280
              i32.add
              i32.store offset=432
              local.get 4
              i32.const 40
              i32.add
              local.get 4
              i32.const 408
              i32.add
              call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
              local.get 4
              local.get 4
              i32.load offset=44
              local.tee 1
              i32.store offset=348
              local.get 4
              local.get 4
              i32.load offset=40
              local.tee 3
              i32.store offset=344
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=280
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
                  br_if 1 (;@6;)
                  local.get 4
                  i32.const 344
                  i32.add
                  call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                  br 1 (;@6;)
                end
                local.get 3
                i32.eqz
                br_if 0 (;@6;)
                local.get 4
                i64.load offset=200 align=4
                local.set 8
                local.get 4
                local.get 4
                i64.load offset=328
                i64.store offset=432
                local.get 4
                local.get 4
                i64.load offset=320
                i64.store offset=424
                local.get 4
                local.get 4
                i64.load offset=312
                i64.store offset=416
                local.get 4
                i32.const 0
                i32.store8 offset=312
                local.get 4
                local.get 1
                i32.store offset=456
                local.get 4
                local.get 3
                i32.store offset=452
                local.get 4
                i32.const 6
                i32.store8 offset=448
                local.get 4
                local.get 8
                i64.store offset=440
                local.get 4
                i64.const 8589934592
                i64.store offset=408
                local.get 4
                local.get 4
                i32.const 312
                i32.add
                i32.store offset=464
                local.get 4
                i32.const 32
                i32.add
                local.get 4
                i32.const 408
                i32.add
                call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 2>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
                local.get 4
                local.get 4
                i32.load offset=36
                local.tee 1
                i32.store offset=348
                local.get 4
                local.get 4
                i32.load offset=32
                local.tee 3
                i32.store offset=344
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=312
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
                    br_if 1 (;@7;)
                    local.get 4
                    i32.const 344
                    i32.add
                    call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
                    br 1 (;@7;)
                  end
                  local.get 3
                  i32.eqz
                  br_if 0 (;@7;)
                  local.get 4
                  local.get 1
                  i32.store offset=80
                  local.get 4
                  local.get 3
                  i32.store offset=76
                  local.get 4
                  i32.const 5
                  i32.store8 offset=72
                  block ;; label = @8
                    block ;; label = @9
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
                                        local.tee 7
                                        br_table 6 (;@12;) 6 (;@12;) 0 (;@18;) 1 (;@17;) 2 (;@16;) 3 (;@15;) 4 (;@14;) 5 (;@13;) 6 (;@12;)
                                      end
                                      local.get 3
                                      i64.load offset=16
                                      local.set 8
                                      br 9 (;@8;)
                                    end
                                    local.get 3
                                    i32.load offset=12
                                    local.tee 1
                                    local.get 1
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 9
                                    i32.store
                                    local.get 9
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    br 7 (;@9;)
                                  end
                                  local.get 3
                                  i32.load offset=12
                                  local.tee 1
                                  local.get 1
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 9
                                  i32.store
                                  local.get 9
                                  i32.eqz
                                  br_if 14 (;@1;)
                                  local.get 3
                                  i64.load8_u offset=20
                                  i64.const 32
                                  i64.shl
                                  local.get 3
                                  i64.load32_u offset=16
                                  i64.or
                                  local.set 8
                                  br 7 (;@8;)
                                end
                                local.get 3
                                i32.load offset=12
                                local.tee 1
                                local.get 1
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 9
                                i32.store
                                local.get 9
                                i32.eqz
                                br_if 13 (;@1;)
                                br 5 (;@9;)
                              end
                              local.get 3
                              i32.load offset=12
                              local.tee 1
                              local.get 1
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 9
                              i32.store
                              local.get 9
                              i32.eqz
                              br_if 12 (;@1;)
                              br 4 (;@9;)
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
                            br_if 11 (;@1;)
                            br 1 (;@11;)
                          end
                          local.get 3
                          i32.load8_u offset=9
                          local.set 3
                        end
                        br 2 (;@8;)
                      end
                      i32.const 0
                      i32.const 0
                      i32.const 1065308
                      call $core::panicking::panic_bounds_check
                      unreachable
                    end
                    local.get 3
                    i64.load32_u offset=16
                    local.set 8
                  end
                  local.get 4
                  local.get 8
                  i64.store offset=112
                  local.get 4
                  local.get 1
                  i32.store offset=108
                  local.get 4
                  local.get 3
                  i32.store8 offset=105
                  local.get 4
                  local.get 7
                  i32.store8 offset=104
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
                                      i32.load8_u offset=72
                                      local.tee 1
                                      br_table 6 (;@11;) 6 (;@11;) 0 (;@17;) 1 (;@16;) 2 (;@15;) 3 (;@14;) 4 (;@13;) 5 (;@12;) 6 (;@11;)
                                    end
                                    local.get 4
                                    i64.load offset=80
                                    local.set 8
                                    br 8 (;@8;)
                                  end
                                  local.get 4
                                  i32.load offset=76
                                  local.tee 3
                                  local.get 3
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 7
                                  i32.store
                                  local.get 7
                                  i32.eqz
                                  br_if 14 (;@1;)
                                  br 6 (;@9;)
                                end
                                local.get 4
                                i32.load offset=76
                                local.tee 3
                                local.get 3
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 7
                                i32.store
                                local.get 7
                                i32.eqz
                                br_if 13 (;@1;)
                                local.get 4
                                i64.load8_u offset=84
                                i64.const 32
                                i64.shl
                                local.get 4
                                i64.load32_u offset=80
                                i64.or
                                local.set 8
                                br 6 (;@8;)
                              end
                              local.get 4
                              i32.load offset=76
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
                              br 4 (;@9;)
                            end
                            local.get 4
                            i32.load offset=76
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
                            br 3 (;@9;)
                          end
                          local.get 4
                          i32.load offset=76
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
                          br 1 (;@10;)
                        end
                        local.get 4
                        i32.load8_u offset=73
                        local.set 7
                      end
                      br 1 (;@8;)
                    end
                    local.get 4
                    i64.load32_u offset=80
                    local.set 8
                  end
                  local.get 4
                  local.get 8
                  i64.store offset=320
                  local.get 4
                  local.get 3
                  i32.store offset=316
                  local.get 4
                  local.get 7
                  i32.store8 offset=313
                  local.get 4
                  local.get 1
                  i32.store8 offset=312
                  local.get 4
                  i32.const 0
                  i32.store16 offset=288
                  local.get 4
                  i32.const 1056375
                  i32.store offset=284
                  local.get 4
                  i32.const 1056374
                  i32.store offset=280
                  local.get 4
                  i32.const 408
                  i32.add
                  local.get 4
                  i32.const 280
                  i32.add
                  call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=408
                            local.tee 3
                            i32.const 255
                            i32.ne
                            br_if 0 (;@12;)
                            local.get 4
                            local.get 4
                            i64.load offset=412 align=4
                            i64.store offset=348 align=4
                            local.get 4
                            i32.const 3
                            i32.store8 offset=344
                            local.get 4
                            i32.const 280
                            i32.add
                            local.get 4
                            i32.const 312
                            i32.add
                            local.get 4
                            i32.const 344
                            i32.add
                            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                            block ;; label = @13
                              local.get 4
                              i32.load8_u offset=280
                              i32.const 255
                              i32.ne
                              br_if 0 (;@13;)
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
                              br 5 (;@8;)
                            end
                            local.get 4
                            local.get 4
                            i64.load offset=304
                            i64.store offset=432
                            local.get 4
                            local.get 4
                            i64.load offset=296
                            i64.store offset=424
                            local.get 4
                            local.get 4
                            i64.load offset=288
                            i64.store offset=416
                            local.get 4
                            local.get 4
                            i64.load offset=280
                            i64.store offset=408
                            local.get 4
                            i32.const 344
                            i32.add
                            local.get 4
                            i32.const 408
                            i32.add
                            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                            block ;; label = @13
                              block ;; label = @14
                                local.get 4
                                i32.load8_u offset=344
                                i32.const 255
                                i32.eq
                                br_if 0 (;@14;)
                                local.get 4
                                local.get 4
                                i64.load offset=352
                                i64.store offset=144
                                local.get 4
                                local.get 4
                                i64.load offset=344
                                i64.store offset=136
                                br 1 (;@13;)
                              end
                              local.get 4
                              i32.const 256
                              i32.store16 offset=136
                            end
                            local.get 4
                            i32.const 408
                            i32.add
                            call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                            local.get 4
                            i32.const 424
                            i32.add
                            call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                            local.get 4
                            i32.const 0
                            i32.store16 offset=320
                            local.get 4
                            i32.const 1056374
                            i32.store offset=316
                            local.get 4
                            i32.const 1056368
                            i32.store offset=312
                            local.get 4
                            i32.const 408
                            i32.add
                            local.get 4
                            i32.const 312
                            i32.add
                            call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                            local.get 4
                            i32.load8_u offset=408
                            local.tee 3
                            i32.const 255
                            i32.ne
                            br_if 1 (;@11;)
                            local.get 4
                            local.get 4
                            i32.load offset=416
                            local.tee 6
                            i32.store offset=172
                            local.get 4
                            local.get 4
                            i32.load offset=412
                            local.tee 3
                            i32.store offset=168
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        block ;; label = @19
                                          block ;; label = @20
                                            local.get 4
                                            i32.load8_u offset=72
                                            local.tee 7
                                            br_table 6 (;@14;) 6 (;@14;) 0 (;@20;) 1 (;@19;) 2 (;@18;) 3 (;@17;) 4 (;@16;) 5 (;@15;) 6 (;@14;)
                                          end
                                          local.get 4
                                          i64.load offset=80
                                          local.set 8
                                          br 10 (;@9;)
                                        end
                                        local.get 4
                                        i32.load offset=76
                                        local.tee 1
                                        local.get 1
                                        i32.load
                                        i32.const 1
                                        i32.add
                                        local.tee 9
                                        i32.store
                                        local.get 9
                                        i32.eqz
                                        br_if 17 (;@1;)
                                        br 8 (;@10;)
                                      end
                                      local.get 4
                                      i32.load offset=76
                                      local.tee 1
                                      local.get 1
                                      i32.load
                                      i32.const 1
                                      i32.add
                                      local.tee 9
                                      i32.store
                                      local.get 9
                                      i32.eqz
                                      br_if 16 (;@1;)
                                      local.get 4
                                      i64.load8_u offset=84
                                      i64.const 32
                                      i64.shl
                                      local.get 4
                                      i64.load32_u offset=80
                                      i64.or
                                      local.set 8
                                      br 8 (;@9;)
                                    end
                                    local.get 4
                                    i32.load offset=76
                                    local.tee 1
                                    local.get 1
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 9
                                    i32.store
                                    local.get 9
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    br 6 (;@10;)
                                  end
                                  local.get 4
                                  i32.load offset=76
                                  local.tee 1
                                  local.get 1
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 9
                                  i32.store
                                  local.get 9
                                  i32.eqz
                                  br_if 14 (;@1;)
                                  br 5 (;@10;)
                                end
                                local.get 4
                                i32.load offset=76
                                local.tee 1
                                local.get 1
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 9
                                i32.store
                                local.get 9
                                i32.eqz
                                br_if 13 (;@1;)
                                br 1 (;@13;)
                              end
                              local.get 4
                              i32.load8_u offset=73
                              local.set 9
                            end
                            br 3 (;@9;)
                          end
                          local.get 4
                          local.get 4
                          i32.load8_u offset=411
                          i32.store8 offset=347
                          local.get 4
                          local.get 4
                          i32.load16_u offset=409 align=1
                          i32.store16 offset=345 align=1
                          local.get 4
                          local.get 4
                          i32.load offset=420
                          i32.store offset=356
                          local.get 4
                          local.get 4
                          i64.load offset=412 align=4
                          i64.store offset=348 align=4
                          local.get 4
                          local.get 3
                          i32.store8 offset=344
                          i32.const 1063112
                          i32.const 43
                          local.get 4
                          i32.const 344
                          i32.add
                          i32.const 1063096
                          i32.const 1063156
                          call $core::result::unwrap_failed
                          unreachable
                        end
                        local.get 4
                        local.get 4
                        i32.load8_u offset=411
                        i32.store8 offset=347
                        local.get 4
                        local.get 4
                        i32.load16_u offset=409 align=1
                        i32.store16 offset=345 align=1
                        local.get 4
                        local.get 4
                        i32.load offset=420
                        i32.store offset=356
                        local.get 4
                        local.get 4
                        i64.load offset=412 align=4
                        i64.store offset=348 align=4
                        local.get 4
                        local.get 3
                        i32.store8 offset=344
                        i32.const 1063112
                        i32.const 43
                        local.get 4
                        i32.const 344
                        i32.add
                        i32.const 1063096
                        i32.const 1063156
                        call $core::result::unwrap_failed
                        unreachable
                      end
                      local.get 4
                      i64.load32_u offset=80
                      local.set 8
                    end
                    local.get 4
                    local.get 8
                    i64.store offset=208
                    local.get 4
                    local.get 1
                    i32.store offset=204
                    local.get 4
                    local.get 9
                    i32.store8 offset=201
                    local.get 4
                    local.get 7
                    i32.store8 offset=200
                    local.get 4
                    i32.const 0
                    i32.store16 offset=388
                    local.get 4
                    i32.const 1056376
                    i32.store offset=384
                    local.get 4
                    i32.const 1056375
                    i32.store offset=380
                    local.get 4
                    i32.const 408
                    i32.add
                    local.get 4
                    i32.const 380
                    i32.add
                    call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              local.get 4
                              i32.load8_u offset=408
                              local.tee 1
                              i32.const 255
                              i32.ne
                              br_if 0 (;@13;)
                              local.get 4
                              local.get 4
                              i64.load offset=412 align=4
                              i64.store offset=396 align=4
                              local.get 4
                              i32.const 3
                              i32.store8 offset=392
                              local.get 4
                              i32.const 312
                              i32.add
                              local.get 4
                              i32.const 200
                              i32.add
                              local.get 4
                              i32.const 392
                              i32.add
                              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    local.get 4
                                    i32.load8_u offset=312
                                    i32.const 255
                                    i32.ne
                                    br_if 0 (;@16;)
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
                                    local.get 3
                                    local.get 3
                                    i32.load
                                    i32.const -1
                                    i32.add
                                    local.tee 0
                                    i32.store
                                    local.get 0
                                    br_if 7 (;@9;)
                                    br 1 (;@15;)
                                  end
                                  local.get 4
                                  local.get 4
                                  i64.load offset=336
                                  i64.store offset=432
                                  local.get 4
                                  local.get 4
                                  i64.load offset=328
                                  i64.store offset=424
                                  local.get 4
                                  local.get 4
                                  i64.load offset=320
                                  i64.store offset=416
                                  local.get 4
                                  local.get 4
                                  i64.load offset=312
                                  i64.store offset=408
                                  local.get 4
                                  i32.const 392
                                  i32.add
                                  local.get 4
                                  i32.const 408
                                  i32.add
                                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                                  block ;; label = @16
                                    block ;; label = @17
                                      local.get 4
                                      i32.load8_u offset=392
                                      i32.const 255
                                      i32.eq
                                      br_if 0 (;@17;)
                                      local.get 4
                                      i32.const 352
                                      i32.add
                                      local.tee 1
                                      local.get 4
                                      i64.load offset=400
                                      i64.store offset=8
                                      local.get 1
                                      local.get 4
                                      i64.load offset=392
                                      i64.store
                                      br 1 (;@16;)
                                    end
                                    local.get 4
                                    i32.const 256
                                    i32.store16 offset=352
                                  end
                                  local.get 4
                                  i32.const 184
                                  i32.add
                                  local.set 1
                                  local.get 4
                                  i32.const 408
                                  i32.add
                                  call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                                  local.get 4
                                  i32.const 424
                                  i32.add
                                  call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                                  local.get 4
                                  i64.const 1
                                  i64.store offset=344
                                  local.get 4
                                  i32.const 176
                                  i32.add
                                  local.get 4
                                  i32.const 344
                                  i32.add
                                  call $"nanvm_lib::vm::unstable::spread_array::<nanvm_lib::naive::Naive, [nanvm_lib::vm::unstable::ArrayItem<nanvm_lib::naive::Naive>; 1]>"
                                  block ;; label = @16
                                    local.get 4
                                    i64.load offset=176
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
                                    local.get 3
                                    local.get 3
                                    i32.load
                                    i32.const -1
                                    i32.add
                                    local.tee 0
                                    i32.store
                                    local.get 0
                                    i32.eqz
                                    br_if 1 (;@15;)
                                    br 7 (;@9;)
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
                                  i64.const 0
                                  i64.store offset=416
                                  local.get 4
                                  i32.const 2
                                  i32.store8 offset=408
                                  local.get 4
                                  i32.const 344
                                  i32.add
                                  local.get 4
                                  i32.const 200
                                  i32.add
                                  local.get 4
                                  i32.const 408
                                  i32.add
                                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                                  local.get 4
                                  i32.load8_u offset=344
                                  i32.const 255
                                  i32.ne
                                  br_if 1 (;@14;)
                                  local.get 0
                                  local.get 4
                                  i64.load offset=360
                                  i64.store offset=16
                                  local.get 0
                                  local.get 4
                                  i64.load offset=352
                                  i64.store offset=8
                                  local.get 0
                                  i64.const 1
                                  i64.store
                                  local.get 3
                                  local.get 3
                                  i32.load
                                  i32.const -1
                                  i32.add
                                  local.tee 0
                                  i32.store
                                  local.get 0
                                  br_if 6 (;@9;)
                                end
                                local.get 4
                                i32.const 168
                                i32.add
                                call $"<alloc::rc::Rc<[u16]>>::drop_slow"
                                br 5 (;@9;)
                              end
                              local.get 4
                              local.get 4
                              i64.load offset=368
                              i64.store offset=432
                              local.get 4
                              local.get 4
                              i64.load offset=360
                              i64.store offset=424
                              local.get 4
                              local.get 4
                              i64.load offset=352
                              i64.store offset=416
                              local.get 4
                              local.get 4
                              i64.load offset=344
                              i64.store offset=408
                              local.get 4
                              i32.const 392
                              i32.add
                              local.get 4
                              i32.const 408
                              i32.add
                              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                              i32.const 0
                              local.set 1
                              i32.const 1
                              local.set 7
                              block ;; label = @14
                                local.get 4
                                i32.load8_u offset=392
                                local.tee 9
                                i32.const 255
                                i32.eq
                                br_if 0 (;@14;)
                                local.get 4
                                local.get 4
                                i64.load offset=394 align=2
                                i64.store offset=152
                                local.get 4
                                local.get 4
                                i64.load offset=400 align=2
                                i64.store offset=158 align=2
                                local.get 4
                                i32.load8_u offset=393
                                local.set 7
                                local.get 9
                                local.set 1
                              end
                              local.get 4
                              i32.const 408
                              i32.add
                              call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                              local.get 4
                              i32.const 424
                              i32.add
                              call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                              local.get 4
                              i32.const 0
                              i32.store8 offset=380
                              local.get 4
                              local.get 7
                              i32.store8 offset=425
                              local.get 4
                              local.get 1
                              i32.store8 offset=424
                              local.get 4
                              local.get 6
                              i32.store offset=420
                              local.get 4
                              local.get 3
                              i32.store offset=416
                              local.get 4
                              i64.const 4294967296
                              i64.store offset=408
                              local.get 4
                              local.get 4
                              i64.load offset=152
                              i64.store offset=426 align=2
                              local.get 4
                              local.get 4
                              i64.load offset=158 align=2
                              i64.store offset=432 align=2
                              local.get 4
                              local.get 4
                              i32.const 380
                              i32.add
                              i32.store offset=440
                              local.get 4
                              i32.const 24
                              i32.add
                              local.get 4
                              i32.const 408
                              i32.add
                              call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 1>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
                              local.get 4
                              local.get 4
                              i32.load offset=28
                              local.tee 1
                              i32.store offset=396
                              local.get 4
                              local.get 4
                              i32.load offset=24
                              local.tee 3
                              i32.store offset=392
                              block ;; label = @14
                                local.get 4
                                i32.load8_u offset=380
                                i32.const 1
                                i32.ne
                                br_if 0 (;@14;)
                                local.get 3
                                local.get 3
                                i32.load
                                i32.const -1
                                i32.add
                                local.tee 2
                                i32.store
                                local.get 2
                                br_if 4 (;@10;)
                                local.get 4
                                i32.const 392
                                i32.add
                                call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
                                br 4 (;@10;)
                              end
                              local.get 3
                              i32.eqz
                              br_if 3 (;@10;)
                              local.get 4
                              local.get 4
                              i64.load offset=144
                              i64.store offset=424
                              local.get 4
                              local.get 4
                              i64.load offset=136
                              i64.store offset=416
                              local.get 4
                              i32.const 0
                              i32.store8 offset=136
                              local.get 4
                              local.get 1
                              i32.store offset=440
                              local.get 4
                              local.get 3
                              i32.store offset=436
                              local.get 4
                              i32.const 5
                              i32.store8 offset=432
                              local.get 4
                              i64.const 8589934592
                              i64.store offset=408
                              local.get 4
                              local.get 4
                              i32.const 136
                              i32.add
                              i32.store offset=448
                              local.get 4
                              i32.const 16
                              i32.add
                              local.get 4
                              i32.const 408
                              i32.add
                              call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                              local.get 4
                              local.get 4
                              i32.load offset=20
                              local.tee 1
                              i32.store offset=396
                              local.get 4
                              local.get 4
                              i32.load offset=16
                              local.tee 3
                              i32.store offset=392
                              block ;; label = @14
                                local.get 4
                                i32.load8_u offset=136
                                i32.const 1
                                i32.ne
                                br_if 0 (;@14;)
                                local.get 3
                                local.get 3
                                i32.load
                                i32.const -1
                                i32.add
                                local.tee 2
                                i32.store
                                local.get 2
                                br_if 3 (;@11;)
                                local.get 4
                                i32.const 392
                                i32.add
                                call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                                br 3 (;@11;)
                              end
                              local.get 3
                              i32.eqz
                              br_if 2 (;@11;)
                              local.get 4
                              i32.const 0
                              i32.store8 offset=136
                              local.get 4
                              i64.const 4616189618054758400
                              i64.store offset=456
                              local.get 4
                              i32.const 2
                              i32.store8 offset=448
                              local.get 4
                              i64.const 4613937818241073152
                              i64.store offset=440
                              local.get 4
                              i32.const 2
                              i32.store8 offset=432
                              local.get 4
                              local.get 1
                              i32.store offset=424
                              local.get 4
                              local.get 3
                              i32.store offset=420
                              local.get 4
                              i32.const 6
                              i32.store8 offset=416
                              local.get 4
                              i64.const 12884901888
                              i64.store offset=408
                              local.get 4
                              local.get 4
                              i32.const 136
                              i32.add
                              i32.store offset=464
                              local.get 4
                              i32.const 8
                              i32.add
                              local.get 4
                              i32.const 408
                              i32.add
                              call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 3>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                              local.get 4
                              local.get 4
                              i32.load offset=12
                              local.tee 1
                              i32.store offset=396
                              local.get 4
                              local.get 4
                              i32.load offset=8
                              local.tee 3
                              i32.store offset=392
                              block ;; label = @14
                                local.get 4
                                i32.load8_u offset=136
                                i32.const 1
                                i32.ne
                                br_if 0 (;@14;)
                                local.get 3
                                local.get 3
                                i32.load
                                i32.const -1
                                i32.add
                                local.tee 2
                                i32.store
                                local.get 2
                                br_if 2 (;@12;)
                                local.get 4
                                i32.const 392
                                i32.add
                                call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                                br 2 (;@12;)
                              end
                              local.get 3
                              i32.eqz
                              br_if 1 (;@12;)
                              local.get 4
                              local.get 1
                              i32.store offset=128
                              local.get 4
                              local.get 3
                              i32.store offset=124
                              local.get 4
                              i32.const 6
                              i32.store8 offset=120
                              local.get 0
                              local.get 4
                              i32.const 104
                              i32.add
                              local.get 4
                              i32.const 120
                              i32.add
                              call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
                              local.get 4
                              i32.const 72
                              i32.add
                              call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                              local.get 4
                              i32.const 56
                              i32.add
                              call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                              local.get 2
                              local.get 2
                              i32.load
                              i32.const -1
                              i32.add
                              local.tee 0
                              i32.store
                              local.get 0
                              br_if 11 (;@2;)
                              br 10 (;@3;)
                            end
                            local.get 4
                            local.get 4
                            i32.load8_u offset=411
                            i32.store8 offset=315
                            local.get 4
                            local.get 4
                            i32.load16_u offset=409 align=1
                            i32.store16 offset=313 align=1
                            local.get 4
                            local.get 4
                            i32.load offset=420
                            i32.store offset=324
                            local.get 4
                            local.get 4
                            i64.load offset=412 align=4
                            i64.store offset=316 align=4
                            local.get 4
                            local.get 1
                            i32.store8 offset=312
                            i32.const 1063112
                            i32.const 43
                            local.get 4
                            i32.const 312
                            i32.add
                            i32.const 1063096
                            i32.const 1063156
                            call $core::result::unwrap_failed
                            unreachable
                          end
                          i32.const 1059464
                          i32.const 43
                          local.get 4
                          i32.const 479
                          i32.add
                          i32.const 1059448
                          i32.const 1059508
                          call $core::result::unwrap_failed
                          unreachable
                        end
                        i32.const 1059464
                        i32.const 43
                        local.get 4
                        i32.const 479
                        i32.add
                        i32.const 1059448
                        i32.const 1059508
                        call $core::result::unwrap_failed
                        unreachable
                      end
                      i32.const 1059464
                      i32.const 43
                      local.get 4
                      i32.const 479
                      i32.add
                      i32.const 1059448
                      i32.const 1059508
                      call $core::result::unwrap_failed
                      unreachable
                    end
                    local.get 4
                    i32.const 136
                    i32.add
                    call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  end
                  local.get 4
                  i32.const 104
                  i32.add
                  call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i32.const 72
                  i32.add
                  call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  br 3 (;@4;)
                end
                i32.const 1059464
                i32.const 43
                local.get 4
                i32.const 479
                i32.add
                i32.const 1059448
                i32.const 1059508
                call $core::result::unwrap_failed
                unreachable
              end
              i32.const 1059464
              i32.const 43
              local.get 4
              i32.const 479
              i32.add
              i32.const 1059448
              i32.const 1059508
              call $core::result::unwrap_failed
              unreachable
            end
            local.get 3
            call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          end
          local.get 4
          i32.const 56
          i32.add
          call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
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
      i32.const 480
      i32.add
      global.set $__stack_pointer
      return
    end
    unreachable
  )
