  (func $nanvm_demos::samples::member_functions::module::<nanvm_lib::naive::Naive> (;334;) (type 1) (param i32 i32)
    (local i32 i32 i32 i32 i32 i64 i32)
    global.get $__stack_pointer
    i32.const 96
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    local.get 2
    i32.const 0
    i32.store16 offset=28
    local.get 2
    i32.const 1057339
    i32.store offset=24
    local.get 2
    i32.const 1057332
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
          block ;; label = @4
            local.get 2
            i32.load8_u offset=48
            local.tee 3
            i32.const 255
            i32.ne
            br_if 0 (;@4;)
            local.get 2
            i32.load offset=56
            local.set 4
            local.get 2
            i32.load offset=52
            local.set 5
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
                          local.set 7
                          br 10 (;@1;)
                        end
                        local.get 1
                        i32.load offset=4
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 8
                        i32.store
                        local.get 8
                        i32.eqz
                        br_if 7 (;@3;)
                        br 8 (;@2;)
                      end
                      local.get 1
                      i32.load offset=4
                      local.tee 3
                      local.get 3
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 8
                      i32.store
                      local.get 8
                      i32.eqz
                      br_if 6 (;@3;)
                      local.get 1
                      i64.load8_u offset=12
                      i64.const 32
                      i64.shl
                      local.get 1
                      i64.load32_u offset=8
                      i64.or
                      local.set 7
                      br 8 (;@1;)
                    end
                    local.get 1
                    i32.load offset=4
                    local.tee 3
                    local.get 3
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 8
                    i32.store
                    local.get 8
                    br_if 6 (;@2;)
                    br 5 (;@3;)
                  end
                  local.get 1
                  i32.load offset=4
                  local.tee 3
                  local.get 3
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 8
                  i32.store
                  local.get 8
                  br_if 5 (;@2;)
                  br 4 (;@3;)
                end
                local.get 1
                i32.load offset=4
                local.tee 3
                local.get 3
                i32.load
                i32.const 1
                i32.add
                local.tee 8
                i32.store
                local.get 8
                i32.eqz
                br_if 3 (;@3;)
                br 1 (;@5;)
              end
              local.get 1
              i32.load8_u offset=1
              local.set 8
            end
            br 3 (;@1;)
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
        unreachable
      end
      local.get 1
      i64.load32_u offset=8
      local.set 7
    end
    local.get 2
    i32.const 0
    i32.store8 offset=20
    local.get 2
    local.get 7
    i64.store offset=64
    local.get 2
    local.get 3
    i32.store offset=60
    local.get 2
    local.get 8
    i32.store8 offset=57
    local.get 2
    local.get 6
    i32.store8 offset=56
    local.get 2
    i64.const 4294967296
    i64.store offset=48
    local.get 2
    local.get 2
    i32.const 20
    i32.add
    i32.store offset=72
    local.get 2
    i32.const 8
    i32.add
    local.get 2
    i32.const 48
    i32.add
    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
    local.get 2
    local.get 2
    i32.load offset=12
    local.tee 6
    i32.store offset=36
    local.get 2
    local.get 2
    i32.load offset=8
    local.tee 3
    i32.store offset=32
    block ;; label = @1
      block ;; label = @2
        local.get 2
        i32.load8_u offset=20
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
        local.get 2
        i32.const 32
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
        br 1 (;@1;)
      end
      local.get 3
      i32.eqz
      br_if 0 (;@1;)
      i32.const 76
      i32.const 0
      local.get 3
      local.get 6
      i32.const 1057486
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
      local.tee 6
      i32.store offset=36
      local.get 2
      local.get 2
      i32.load
      local.tee 3
      i32.store offset=32
      block ;; label = @2
        block ;; label = @3
          local.get 2
          i32.load8_u offset=20
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
          br_if 1 (;@2;)
          local.get 2
          i32.const 32
          i32.add
          call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
          br 1 (;@2;)
        end
        local.get 3
        i32.eqz
        br_if 0 (;@2;)
        local.get 0
        local.get 6
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
        call $"#func328 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
        local.get 2
        i32.const 96
        i32.add
        global.set $__stack_pointer
        return
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
  (func $"<nanvm_demos::samples::member_functions::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;335;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32)
    global.get $__stack_pointer
    i32.const 272
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 4
    local.get 3
    i32.store offset=12
    local.get 4
    local.get 2
    i32.store offset=8
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
                  block ;; label = @8
                    local.get 5
                    i32.eqz
                    br_if 0 (;@8;)
                    local.get 4
                    local.get 3
                    i32.store offset=24
                    local.get 4
                    local.get 2
                    i32.store offset=20
                    local.get 4
                    i32.const 6
                    i32.store8 offset=16
                    local.get 4
                    i32.const 0
                    i32.store8 offset=144
                    local.get 4
                    i64.const 4616189618054758400
                    i64.store offset=224
                    local.get 4
                    i32.const 2
                    i32.store8 offset=216
                    local.get 4
                    i64.const 4613937818241073152
                    i64.store offset=208
                    local.get 4
                    i32.const 2
                    i32.store8 offset=200
                    local.get 4
                    i64.const 4611686018427387904
                    i64.store offset=192
                    local.get 4
                    i32.const 2
                    i32.store8 offset=184
                    local.get 4
                    i64.const 4607182418800017408
                    i64.store offset=176
                    local.get 4
                    i32.const 2
                    i32.store8 offset=168
                    local.get 4
                    i64.const 17179869184
                    i64.store offset=160
                    local.get 4
                    local.get 4
                    i32.const 144
                    i32.add
                    i32.store offset=232
                    local.get 4
                    local.get 4
                    i32.const 160
                    i32.add
                    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 4>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                    local.get 4
                    local.get 4
                    i32.load offset=4
                    local.tee 5
                    i32.store offset=244
                    local.get 4
                    local.get 4
                    i32.load
                    local.tee 3
                    i32.store offset=240
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=144
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
                      br_if 8 (;@1;)
                      local.get 4
                      i32.const 240
                      i32.add
                      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                      br 8 (;@1;)
                    end
                    local.get 3
                    i32.eqz
                    br_if 7 (;@1;)
                    local.get 4
                    local.get 5
                    i32.store offset=152
                    local.get 4
                    local.get 3
                    i32.store offset=148
                    local.get 4
                    i32.const 6
                    i32.store8 offset=144
                    local.get 4
                    i32.const 0
                    i32.store16 offset=264
                    local.get 4
                    i32.const 1058682
                    i32.store offset=260
                    local.get 4
                    i32.const 1058676
                    i32.store offset=256
                    local.get 4
                    i32.const 160
                    i32.add
                    local.get 4
                    i32.const 256
                    i32.add
                    call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                    local.get 4
                    i32.load8_u offset=160
                    local.tee 3
                    i32.const 255
                    i32.ne
                    br_if 1 (;@7;)
                    local.get 4
                    local.get 4
                    i64.load offset=164 align=4
                    i64.store offset=244 align=4
                    local.get 4
                    i32.const 3
                    i32.store8 offset=240
                    local.get 4
                    i32.const 160
                    i32.add
                    local.get 4
                    i32.const 144
                    i32.add
                    local.get 4
                    i32.const 240
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                    local.get 1
                    i32.load
                    local.tee 3
                    i32.load offset=16
                    i32.eqz
                    br_if 2 (;@6;)
                    local.get 4
                    i32.const 120
                    i32.add
                    i32.const 8
                    i32.add
                    local.set 5
                    local.get 4
                    i32.const 120
                    i32.add
                    local.get 4
                    i32.const 160
                    i32.add
                    local.get 3
                    i32.load offset=12
                    i32.const 8
                    i32.add
                    local.get 4
                    i32.const 16
                    i32.add
                    local.get 1
                    call $"<nanvm_lib::vm::lambda::PropertyLambda<nanvm_lib::naive::Naive>>::end_call::<nanvm_demos::samples::member_functions::module<nanvm_lib::naive::Naive>::{closure#0}::{closure#0}>"
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              local.get 4
                              i64.load offset=120
                              i64.const 1
                              i64.ne
                              br_if 0 (;@13;)
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
                              br 1 (;@12;)
                            end
                            local.get 4
                            local.get 5
                            i64.load offset=8
                            i64.store offset=152
                            local.get 4
                            local.get 5
                            i64.load
                            i64.store offset=144
                            local.get 4
                            i32.const 0
                            i32.store16 offset=264
                            local.get 4
                            i32.const 1058685
                            i32.store offset=260
                            local.get 4
                            i32.const 1058682
                            i32.store offset=256
                            local.get 4
                            i32.const 160
                            i32.add
                            local.get 4
                            i32.const 256
                            i32.add
                            call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                            local.get 4
                            i32.load8_u offset=160
                            local.tee 5
                            i32.const 255
                            i32.ne
                            br_if 7 (;@5;)
                            local.get 4
                            local.get 4
                            i64.load offset=164 align=4
                            i64.store offset=244 align=4
                            local.get 4
                            i32.const 3
                            i32.store8 offset=240
                            local.get 4
                            i32.const 88
                            i32.add
                            local.get 4
                            i32.const 144
                            i32.add
                            local.get 4
                            i32.const 240
                            i32.add
                            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                            local.get 3
                            i32.load offset=16
                            i32.eqz
                            br_if 8 (;@4;)
                            local.get 4
                            i32.const 64
                            i32.add
                            i32.const 8
                            i32.add
                            local.set 5
                            local.get 4
                            i32.const 64
                            i32.add
                            local.get 4
                            i32.const 88
                            i32.add
                            local.get 3
                            i32.load offset=12
                            i32.const 8
                            i32.add
                            local.get 1
                            call $"<nanvm_lib::vm::lambda::PropertyLambda<nanvm_lib::naive::Naive>>::end_call::<nanvm_demos::samples::member_functions::module<nanvm_lib::naive::Naive>::{closure#0}::{closure#1}>"
                            local.get 4
                            i64.load offset=64
                            i64.const 1
                            i64.ne
                            br_if 1 (;@11;)
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
                          end
                          local.get 4
                          i32.const 16
                          i32.add
                          call $"#func328 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                          local.get 2
                          local.get 2
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 1
                          i32.store
                          local.get 1
                          i32.eqz
                          br_if 1 (;@10;)
                          br 2 (;@9;)
                        end
                        local.get 4
                        local.get 5
                        i64.load offset=8
                        i64.store offset=248
                        local.get 4
                        local.get 5
                        i64.load
                        i64.store offset=240
                        local.get 4
                        i32.const 0
                        i32.store16 offset=264
                        local.get 4
                        i32.const 1058689
                        i32.store offset=260
                        local.get 4
                        i32.const 1058685
                        i32.store offset=256
                        local.get 4
                        i32.const 160
                        i32.add
                        local.get 4
                        i32.const 256
                        i32.add
                        call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                        local.get 4
                        i32.load8_u offset=160
                        local.tee 1
                        i32.const 255
                        i32.ne
                        br_if 7 (;@3;)
                        local.get 4
                        local.get 4
                        i64.load offset=164 align=4
                        i64.store offset=92 align=4
                        local.get 4
                        i32.const 3
                        i32.store8 offset=88
                        local.get 4
                        i32.const 32
                        i32.add
                        local.get 4
                        i32.const 240
                        i32.add
                        local.get 4
                        i32.const 88
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                        local.get 3
                        i32.load offset=16
                        i32.eqz
                        br_if 8 (;@2;)
                        local.get 0
                        local.get 4
                        i32.const 32
                        i32.add
                        local.get 3
                        i32.load offset=12
                        i32.const 8
                        i32.add
                        call $"<nanvm_lib::vm::lambda::PropertyLambda<nanvm_lib::naive::Naive>>::end_call::<nanvm_demos::samples::member_functions::module<nanvm_lib::naive::Naive>::{closure#0}::{closure#2}>"
                        local.get 4
                        i32.const 16
                        i32.add
                        call $"#func328 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                        local.get 2
                        local.get 2
                        i32.load
                        i32.const -1
                        i32.add
                        local.tee 1
                        i32.store
                        local.get 1
                        br_if 1 (;@9;)
                      end
                      local.get 4
                      i32.const 8
                      i32.add
                      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                    end
                    local.get 4
                    i32.const 272
                    i32.add
                    global.set $__stack_pointer
                    return
                  end
                  unreachable
                end
                local.get 4
                local.get 4
                i32.load8_u offset=163
                i32.store8 offset=243
                local.get 4
                local.get 4
                i32.load16_u offset=161 align=1
                i32.store16 offset=241 align=1
                local.get 4
                local.get 4
                i32.load offset=172
                i32.store offset=252
                local.get 4
                local.get 4
                i64.load offset=164 align=4
                i64.store offset=244 align=4
                local.get 4
                local.get 3
                i32.store8 offset=240
                i32.const 1055372
                i32.const 43
                local.get 4
                i32.const 240
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
            end
            local.get 4
            local.get 4
            i32.load8_u offset=163
            i32.store8 offset=243
            local.get 4
            local.get 4
            i32.load16_u offset=161 align=1
            i32.store16 offset=241 align=1
            local.get 4
            local.get 4
            i32.load offset=172
            i32.store offset=252
            local.get 4
            local.get 4
            i64.load offset=164 align=4
            i64.store offset=244 align=4
            local.get 4
            local.get 5
            i32.store8 offset=240
            i32.const 1055372
            i32.const 43
            local.get 4
            i32.const 240
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
        end
        local.get 4
        local.get 4
        i32.load8_u offset=163
        i32.store8 offset=91
        local.get 4
        local.get 4
        i32.load16_u offset=161 align=1
        i32.store16 offset=89 align=1
        local.get 4
        local.get 4
        i32.load offset=172
        i32.store offset=100
        local.get 4
        local.get 4
        i64.load offset=164 align=4
        i64.store offset=92 align=4
        local.get 4
        local.get 1
        i32.store8 offset=88
        i32.const 1055372
        i32.const 43
        local.get 4
        i32.const 88
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
    end
    i32.const 1053928
    i32.const 43
    local.get 4
    i32.const 271
    i32.add
    i32.const 1053912
    i32.const 1053972
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_lib::vm::lambda::PropertyLambda<nanvm_lib::naive::Naive>>::end_call::<nanvm_demos::samples::member_functions::module<nanvm_lib::naive::Naive>::{closure#0}::{closure#0}>" (;374;) (type 10) (param i32 i32 i32 i32 i32)
    (local i32 i32 i64 i32 i64 i32 i32 i32 i64 i32)
    global.get $__stack_pointer
    i32.const 96
    i32.sub
    local.tee 5
    global.set $__stack_pointer
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              local.get 1
              i32.load8_u
              local.tee 6
              i32.const 255
              i32.ne
              br_if 0 (;@5;)
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
              br 1 (;@4;)
            end
            local.get 4
            i32.load
            local.set 4
            local.get 1
            i64.load offset=24
            local.set 7
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
                                local.get 3
                                i32.load8_u
                                local.tee 8
                                br_table 6 (;@8;) 6 (;@8;) 0 (;@14;) 1 (;@13;) 2 (;@12;) 3 (;@11;) 4 (;@10;) 5 (;@9;) 6 (;@8;)
                              end
                              local.get 3
                              i64.load offset=8
                              local.set 9
                              br 8 (;@5;)
                            end
                            local.get 3
                            i32.load offset=4
                            local.tee 10
                            local.get 10
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 11
                            i32.store
                            local.get 11
                            i32.eqz
                            br_if 11 (;@1;)
                            br 6 (;@6;)
                          end
                          local.get 3
                          i32.load offset=4
                          local.tee 10
                          local.get 10
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 11
                          i32.store
                          local.get 11
                          i32.eqz
                          br_if 10 (;@1;)
                          local.get 3
                          i64.load8_u offset=12
                          i64.const 32
                          i64.shl
                          local.get 3
                          i64.load32_u offset=8
                          i64.or
                          local.set 9
                          br 6 (;@5;)
                        end
                        local.get 3
                        i32.load offset=4
                        local.tee 10
                        local.get 10
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 11
                        i32.store
                        local.get 11
                        br_if 4 (;@6;)
                        br 9 (;@1;)
                      end
                      local.get 3
                      i32.load offset=4
                      local.tee 10
                      local.get 10
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 11
                      i32.store
                      local.get 11
                      br_if 3 (;@6;)
                      br 8 (;@1;)
                    end
                    local.get 3
                    i32.load offset=4
                    local.tee 10
                    local.get 10
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 3
                    i32.store
                    local.get 3
                    i32.eqz
                    br_if 7 (;@1;)
                    br 1 (;@7;)
                  end
                  local.get 3
                  i32.load8_u offset=1
                  local.set 11
                end
                br 1 (;@5;)
              end
              local.get 3
              i64.load32_u offset=8
              local.set 9
            end
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
                                  local.tee 12
                                  br_table 6 (;@9;) 6 (;@9;) 0 (;@15;) 1 (;@14;) 2 (;@13;) 3 (;@12;) 4 (;@11;) 5 (;@10;) 6 (;@9;)
                                end
                                local.get 4
                                i64.load offset=16
                                local.set 13
                                br 9 (;@5;)
                              end
                              local.get 4
                              i32.load offset=12
                              local.tee 3
                              local.get 3
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 14
                              i32.store
                              local.get 14
                              i32.eqz
                              br_if 12 (;@1;)
                              br 7 (;@6;)
                            end
                            local.get 4
                            i32.load offset=12
                            local.tee 3
                            local.get 3
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 14
                            i32.store
                            local.get 14
                            i32.eqz
                            br_if 11 (;@1;)
                            local.get 4
                            i64.load8_u offset=20
                            i64.const 32
                            i64.shl
                            local.get 4
                            i64.load32_u offset=16
                            i64.or
                            local.set 13
                            br 7 (;@5;)
                          end
                          local.get 4
                          i32.load offset=12
                          local.tee 3
                          local.get 3
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 14
                          i32.store
                          local.get 14
                          i32.eqz
                          br_if 10 (;@1;)
                          br 5 (;@6;)
                        end
                        local.get 4
                        i32.load offset=12
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 14
                        i32.store
                        local.get 14
                        i32.eqz
                        br_if 9 (;@1;)
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
                      br_if 8 (;@1;)
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.load8_u offset=9
                    local.set 4
                  end
                  br 2 (;@5;)
                end
                i32.const 0
                i32.const 0
                i32.const 1062708
                call $core::panicking::panic_bounds_check
                unreachable
              end
              local.get 4
              i64.load32_u offset=16
              local.set 13
            end
            local.get 5
            i32.const 0
            i32.store8 offset=94
            local.get 5
            local.get 13
            i64.store offset=72
            local.get 5
            local.get 3
            i32.store offset=68
            local.get 5
            local.get 4
            i32.store8 offset=65
            local.get 5
            local.get 12
            i32.store8 offset=64
            local.get 5
            local.get 9
            i64.store offset=56
            local.get 5
            local.get 10
            i32.store offset=52
            local.get 5
            local.get 11
            i32.store8 offset=49
            local.get 5
            local.get 8
            i32.store8 offset=48
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
            local.tee 4
            i32.store offset=28
            local.get 5
            local.get 5
            i32.load offset=16
            local.tee 3
            i32.store offset=24
            block ;; label = @5
              local.get 5
              i32.load8_u offset=94
              i32.const 1
              i32.ne
              br_if 0 (;@5;)
              local.get 3
              local.get 3
              i32.load
              i32.const -1
              i32.add
              local.tee 0
              i32.store
              local.get 0
              br_if 3 (;@2;)
              local.get 5
              i32.const 24
              i32.add
              call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
              br 3 (;@2;)
            end
            local.get 3
            i32.eqz
            br_if 2 (;@2;)
            i32.const 92
            i32.const 1
            local.get 3
            local.get 4
            i32.const 1060082
            i32.const 14
            call $<nanvm_lib::naive::function::Function>::new
            local.set 3
            local.get 5
            i32.const 0
            i32.store8 offset=94
            local.get 5
            local.get 3
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
            local.tee 4
            i32.store offset=28
            local.get 5
            local.get 5
            i32.load offset=8
            local.tee 3
            i32.store offset=24
            block ;; label = @5
              local.get 5
              i32.load8_u offset=94
              i32.const 1
              i32.ne
              br_if 0 (;@5;)
              local.get 3
              local.get 3
              i32.load
              i32.const -1
              i32.add
              local.tee 0
              i32.store
              local.get 0
              br_if 2 (;@3;)
              local.get 5
              i32.const 24
              i32.add
              call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
              br 2 (;@3;)
            end
            local.get 3
            i32.eqz
            br_if 1 (;@3;)
            local.get 0
            local.get 4
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
    end
    unreachable
  )
  (func $"<nanvm_demos::samples::member_functions::module<nanvm_lib::naive::Naive>::{closure#0}::{closure#0}::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;375;) (type 3) (param i32 i32 i32 i32)
    (local i32 i64 i32)
    global.get $__stack_pointer
    i32.const 128
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
    i64.store offset=120
    local.get 4
    local.get 1
    i32.store offset=116
    local.get 4
    local.get 3
    i32.store8 offset=113
    local.get 4
    local.get 2
    i32.store8 offset=112
    local.get 4
    i64.const 0
    i64.store offset=72
    local.get 4
    i32.const 2
    i32.store8 offset=64
    local.get 4
    i32.const 32
    i32.add
    local.get 4
    i32.const 112
    i32.add
    local.get 4
    i32.const 64
    i32.add
    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          local.get 4
          i32.load8_u offset=32
          i32.const 255
          i32.ne
          br_if 0 (;@3;)
          local.get 0
          local.get 4
          i64.load offset=48
          i64.store offset=16
          local.get 0
          local.get 4
          i64.load offset=40
          i64.store offset=8
          local.get 0
          i64.const 1
          i64.store
          local.get 4
          i32.const 16
          i32.add
          call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          local.get 4
          i32.load offset=8
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
        local.get 4
        i64.load offset=56
        i64.store offset=88
        local.get 4
        local.get 4
        i64.load offset=48
        i64.store offset=80
        local.get 4
        local.get 4
        i64.load offset=40
        i64.store offset=72
        local.get 4
        local.get 4
        i64.load offset=32
        i64.store offset=64
        local.get 4
        i32.const 112
        i32.add
        local.get 4
        i32.const 64
        i32.add
        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
        block ;; label = @3
          block ;; label = @4
            local.get 4
            i32.load8_u offset=112
            i32.const 255
            i32.eq
            br_if 0 (;@4;)
            local.get 4
            local.get 4
            i64.load offset=120
            i64.store offset=104
            local.get 4
            local.get 4
            i64.load offset=112
            i64.store offset=96
            br 1 (;@3;)
          end
          local.get 4
          i32.const 256
          i32.store16 offset=96
        end
        local.get 4
        i32.const 64
        i32.add
        call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
        local.get 4
        i32.const 80
        i32.add
        call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
        local.get 4
        i32.const 64
        i32.add
        local.get 4
        i32.const 16
        i32.add
        local.get 4
        i32.const 96
        i32.add
        call $nanvm_lib::vm::any::relational::compare::<nanvm_lib::naive::Naive>
        local.get 4
        i32.load8_u offset=65
        local.set 1
        block ;; label = @3
          block ;; label = @4
            local.get 4
            i32.load8_u offset=64
            local.tee 3
            i32.const 255
            i32.eq
            br_if 0 (;@4;)
            local.get 0
            local.get 4
            i64.load offset=72 align=2
            i64.store offset=16 align=2
            local.get 0
            local.get 4
            i64.load offset=66 align=2
            i64.store offset=10 align=2
            i64.const 1
            local.set 5
            br 1 (;@3;)
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
        local.get 0
        br_if 1 (;@1;)
      end
      local.get 4
      i32.const 8
      i32.add
      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
    end
    local.get 4
    i32.const 128
    i32.add
    global.set $__stack_pointer
  )
  (func $"<nanvm_lib::vm::lambda::PropertyLambda<nanvm_lib::naive::Naive>>::end_call::<nanvm_demos::samples::member_functions::module<nanvm_lib::naive::Naive>::{closure#0}::{closure#2}>" (;376;) (type 4) (param i32 i32 i32)
    (local i32 i32 i64 i64 i32)
    global.get $__stack_pointer
    i32.const 112
    i32.sub
    local.tee 3
    global.set $__stack_pointer
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            local.get 1
            i32.load8_u
            local.tee 4
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
          i32.store16 offset=52
          local.get 3
          i32.const 1060097
          i32.store offset=48
          local.get 3
          i32.const 1060096
          i32.store offset=44
          local.get 3
          i32.const 72
          i32.add
          local.get 3
          i32.const 44
          i32.add
          call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
          local.get 3
          i32.load8_u offset=72
          local.tee 1
          i32.const 255
          i32.ne
          br_if 1 (;@2;)
          local.get 3
          i64.load offset=76 align=4
          local.set 6
          local.get 3
          i32.const 0
          i32.store8 offset=44
          local.get 3
          local.get 6
          i64.store offset=84 align=4
          local.get 3
          i32.const 3
          i32.store8 offset=80
          local.get 3
          i64.const 4294967296
          i64.store offset=72
          local.get 3
          local.get 3
          i32.const 44
          i32.add
          i32.store offset=96
          local.get 3
          local.get 3
          i32.const 72
          i32.add
          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
          local.get 3
          local.get 3
          i32.load offset=4
          local.tee 7
          i32.store offset=60
          local.get 3
          local.get 3
          i32.load
          local.tee 1
          i32.store offset=56
          block ;; label = @4
            local.get 3
            i32.load8_u offset=44
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
            br_if 3 (;@1;)
            local.get 3
            i32.const 56
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
            br 3 (;@1;)
          end
          local.get 1
          i32.eqz
          br_if 2 (;@1;)
          local.get 0
          local.get 7
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
          i64.store offset=80
          local.get 3
          local.get 0
          i64.load offset=8
          i64.store offset=72
          local.get 0
          local.get 3
          i32.const 8
          i32.add
          local.get 2
          local.get 3
          i32.const 72
          i32.add
          call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::call
        end
        local.get 3
        i32.const 112
        i32.add
        global.set $__stack_pointer
        return
      end
      local.get 3
      local.get 3
      i32.load8_u offset=75
      i32.store8 offset=59
      local.get 3
      local.get 3
      i32.load16_u offset=73 align=1
      i32.store16 offset=57 align=1
      local.get 3
      local.get 3
      i32.load offset=84
      i32.store offset=68
      local.get 3
      local.get 3
      i64.load offset=76 align=4
      i64.store offset=60 align=4
      local.get 3
      local.get 1
      i32.store8 offset=56
      i32.const 1055372
      i32.const 43
      local.get 3
      i32.const 56
      i32.add
      i32.const 1055356
      i32.const 1055416
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1053928
    i32.const 43
    local.get 3
    i32.const 111
    i32.add
    i32.const 1053912
    i32.const 1053972
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_lib::vm::lambda::PropertyLambda<nanvm_lib::naive::Naive>>::end_call::<nanvm_demos::samples::member_functions::module<nanvm_lib::naive::Naive>::{closure#0}::{closure#1}>" (;377;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i64 i32 i64 i32 i32)
    global.get $__stack_pointer
    i32.const 80
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            local.get 1
            i32.load8_u
            local.tee 5
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
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  local.get 3
                  i32.load
                  local.tee 3
                  i32.load offset=16
                  i32.eqz
                  br_if 0 (;@7;)
                  local.get 1
                  i64.load offset=24
                  local.set 6
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  local.get 3
                                  i32.load offset=12
                                  local.tee 3
                                  i32.load8_u offset=8
                                  local.tee 7
                                  br_table 6 (;@9;) 6 (;@9;) 0 (;@15;) 1 (;@14;) 2 (;@13;) 3 (;@12;) 4 (;@11;) 5 (;@10;) 6 (;@9;)
                                end
                                local.get 3
                                i64.load offset=16
                                local.set 8
                                br 10 (;@4;)
                              end
                              local.get 3
                              i32.load offset=12
                              local.tee 9
                              local.get 9
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
                            local.get 3
                            i32.load offset=12
                            local.tee 9
                            local.get 9
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 10
                            i32.store
                            local.get 10
                            i32.eqz
                            br_if 6 (;@6;)
                            local.get 3
                            i64.load8_u offset=20
                            i64.const 32
                            i64.shl
                            local.get 3
                            i64.load32_u offset=16
                            i64.or
                            local.set 8
                            br 8 (;@4;)
                          end
                          local.get 3
                          i32.load offset=12
                          local.tee 9
                          local.get 9
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 10
                          i32.store
                          local.get 10
                          br_if 6 (;@5;)
                          br 5 (;@6;)
                        end
                        local.get 3
                        i32.load offset=12
                        local.tee 9
                        local.get 9
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 10
                        i32.store
                        local.get 10
                        br_if 5 (;@5;)
                        br 4 (;@6;)
                      end
                      local.get 3
                      i32.load offset=12
                      local.tee 9
                      local.get 9
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 3
                      i32.store
                      local.get 3
                      i32.eqz
                      br_if 3 (;@6;)
                      br 1 (;@8;)
                    end
                    local.get 3
                    i32.load8_u offset=9
                    local.set 3
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
            local.get 3
            i64.load32_u offset=16
            local.set 8
          end
          local.get 4
          i32.const 0
          i32.store8 offset=39
          local.get 4
          local.get 8
          i64.store offset=56
          local.get 4
          local.get 9
          i32.store offset=52
          local.get 4
          local.get 3
          i32.store8 offset=49
          local.get 4
          local.get 7
          i32.store8 offset=48
          local.get 4
          i64.const 4294967296
          i64.store offset=40
          local.get 4
          local.get 4
          i32.const 39
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
          local.tee 9
          i32.store offset=20
          local.get 4
          local.get 4
          i32.load offset=8
          local.tee 3
          i32.store offset=16
          block ;; label = @4
            local.get 4
            i32.load8_u offset=39
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
            local.get 4
            i32.const 16
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
            br 3 (;@1;)
          end
          local.get 3
          i32.eqz
          br_if 2 (;@1;)
          i32.const 93
          i32.const 1
          local.get 3
          local.get 9
          i32.const 1060097
          i32.const 11
          call $<nanvm_lib::naive::function::Function>::new
          local.set 3
          local.get 4
          i32.const 0
          i32.store8 offset=39
          local.get 4
          local.get 3
          i32.store offset=52
          local.get 4
          i32.const 7
          i32.store8 offset=48
          local.get 4
          i64.const 4294967296
          i64.store offset=40
          local.get 4
          local.get 4
          i32.const 39
          i32.add
          i32.store offset=64
          local.get 4
          local.get 4
          i32.const 40
          i32.add
          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
          local.get 4
          local.get 4
          i32.load offset=4
          local.tee 9
          i32.store offset=20
          local.get 4
          local.get 4
          i32.load
          local.tee 3
          i32.store offset=16
          block ;; label = @4
            local.get 4
            i32.load8_u offset=39
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
            local.get 4
            i32.const 16
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
            br 2 (;@2;)
          end
          local.get 3
          i32.eqz
          br_if 1 (;@2;)
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
          i64.store offset=24
          local.get 4
          local.get 0
          i64.load offset=8
          i64.store offset=16
          local.get 4
          local.get 5
          i32.store8 offset=40
          local.get 4
          local.get 6
          i64.store offset=64
          local.get 4
          local.get 1
          i32.const 1
          i32.add
          local.tee 1
          i64.load align=1
          i64.store offset=41 align=1
          local.get 4
          local.get 1
          i64.load offset=8 align=1
          i64.store offset=49 align=1
          local.get 4
          local.get 1
          i64.load offset=15 align=1
          i64.store offset=56 align=1
          local.get 0
          local.get 4
          i32.const 40
          i32.add
          local.get 2
          local.get 4
          i32.const 16
          i32.add
          call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::call
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
  (func $"<nanvm_demos::samples::member_functions::module<nanvm_lib::naive::Naive>::{closure#0}::{closure#1}::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;378;) (type 3) (param i32 i32 i32 i32)
    (local i32)
    global.get $__stack_pointer
    i32.const 48
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
    i32.const 16
    i32.add
    local.get 4
    i32.const 8
    i32.add
    i32.const 0
    call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
    local.get 4
    i64.const 4621819117588971520
    i64.store offset=40
    local.get 4
    i32.const 2
    i32.store8 offset=32
    local.get 0
    local.get 4
    i32.const 16
    i32.add
    local.get 4
    i32.const 32
    i32.add
    call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::arith::Mul>::mul>"
    local.get 4
    i32.load offset=8
    local.tee 3
    local.get 3
    i32.load
    i32.const -1
    i32.add
    local.tee 3
    i32.store
    block ;; label = @1
      local.get 3
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
