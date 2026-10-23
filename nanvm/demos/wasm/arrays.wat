  (func $nanvm_demos::samples::arrays::module::<nanvm_lib::naive::Naive> (;707;) (type 1) (param i32 i32)
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
          i32.const 247
          i32.const 0
          local.get 3
          local.get 6
          i32.const 1065889
          i32.const 92
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
  (func $"<nanvm_demos::samples::arrays::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;708;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i64 i32 i32 i64 i64 i64)
    global.get $__stack_pointer
    i32.const 544
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 4
    local.get 3
    i32.store offset=28
    local.get 4
    local.get 2
    i32.store offset=24
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
      i32.store offset=40
      local.get 4
      local.get 2
      i32.store offset=36
      local.get 4
      i32.const 6
      i32.store8 offset=32
      local.get 4
      i32.const 0
      i32.store16 offset=272
      local.get 4
      i32.const 1066829
      i32.store offset=268
      local.get 4
      i32.const 1066824
      i32.store offset=264
      local.get 4
      i32.const 472
      i32.add
      local.get 4
      i32.const 264
      i32.add
      call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            local.get 4
            i32.load8_u offset=472
            local.tee 3
            i32.const 255
            i32.ne
            br_if 0 (;@4;)
            local.get 4
            local.get 4
            i64.load offset=476 align=4
            i64.store offset=332 align=4
            local.get 4
            i32.const 3
            i32.store8 offset=328
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=32
                            local.tee 5
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 4
                          i64.load offset=40
                          local.set 6
                          br 9 (;@2;)
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
                        br_if 9 (;@1;)
                        br 7 (;@3;)
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
                      br_if 8 (;@1;)
                      local.get 4
                      i64.load8_u offset=44
                      i64.const 32
                      i64.shl
                      local.get 4
                      i64.load32_u offset=40
                      i64.or
                      local.set 6
                      br 7 (;@2;)
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
                    br_if 5 (;@3;)
                    br 7 (;@1;)
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
                  br_if 4 (;@3;)
                  br 6 (;@1;)
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
                br_if 5 (;@1;)
                br 1 (;@5;)
              end
              local.get 4
              i32.load8_u offset=33
              local.set 7
            end
            br 2 (;@2;)
          end
          local.get 4
          local.get 4
          i32.load8_u offset=475
          i32.store8 offset=363
          local.get 4
          local.get 4
          i32.load16_u offset=473 align=1
          i32.store16 offset=361 align=1
          local.get 4
          local.get 4
          i32.load offset=484
          i32.store offset=372
          local.get 4
          local.get 4
          i64.load offset=476 align=4
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
        i64.load32_u offset=40
        local.set 6
      end
      local.get 4
      local.get 6
      i64.store offset=368
      local.get 4
      local.get 3
      i32.store offset=364
      local.get 4
      local.get 7
      i32.store8 offset=361
      local.get 4
      local.get 5
      i32.store8 offset=360
      local.get 4
      i64.const 0
      i64.store offset=480
      local.get 4
      i32.const 2
      i32.store8 offset=472
      local.get 4
      i32.const 264
      i32.add
      local.get 4
      i32.const 360
      i32.add
      local.get 4
      i32.const 472
      i32.add
      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=264
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
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
                  local.get 4
                  i32.const 328
                  i32.add
                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                  br 1 (;@6;)
                end
                local.get 4
                local.get 4
                i64.load offset=288
                i64.store offset=496
                local.get 4
                local.get 4
                i64.load offset=280
                i64.store offset=488
                local.get 4
                local.get 4
                i64.load offset=272
                i64.store offset=480
                local.get 4
                local.get 4
                i64.load offset=264
                i64.store offset=472
                local.get 4
                i32.const 360
                i32.add
                local.get 4
                i32.const 472
                i32.add
                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                i32.const 1
                local.set 5
                i32.const 0
                local.set 7
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=360
                  local.tee 3
                  i32.const 255
                  i32.eq
                  br_if 0 (;@7;)
                  local.get 4
                  local.get 4
                  i64.load offset=362 align=2
                  i64.store offset=296
                  local.get 4
                  local.get 4
                  i64.load offset=368 align=2
                  i64.store offset=302 align=2
                  local.get 4
                  i32.load8_u offset=361
                  local.set 5
                  local.get 3
                  local.set 7
                end
                local.get 4
                i32.const 472
                i32.add
                call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i32.const 488
                i32.add
                call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i32.const 0
                i32.store8 offset=80
                local.get 4
                i32.const 0
                i32.store16 offset=496
                local.get 4
                i32.const 257
                i32.store16 offset=480
                local.get 4
                i64.const 8589934592
                i64.store offset=472
                local.get 4
                local.get 4
                i32.const 80
                i32.add
                i32.store offset=512
                local.get 4
                i32.const 16
                i32.add
                local.get 4
                i32.const 472
                i32.add
                call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                local.get 4
                local.get 4
                i32.load offset=20
                local.tee 8
                i32.store offset=364
                local.get 4
                local.get 4
                i32.load offset=16
                local.tee 3
                i32.store offset=360
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=80
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
                  br_if 5 (;@2;)
                  local.get 4
                  i32.const 360
                  i32.add
                  call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                  br 5 (;@2;)
                end
                local.get 3
                i32.eqz
                br_if 4 (;@2;)
                local.get 4
                local.get 4
                i64.load offset=336
                i64.store offset=488
                local.get 4
                local.get 4
                i64.load offset=328
                i64.store offset=480
                local.get 4
                i32.const 0
                i32.store8 offset=328
                local.get 4
                local.get 5
                i32.store8 offset=497
                local.get 4
                local.get 7
                i32.store8 offset=496
                local.get 4
                i64.const 12884901888
                i64.store offset=472
                local.get 4
                local.get 4
                i64.load offset=296
                i64.store offset=498 align=2
                local.get 4
                local.get 4
                i64.load offset=302 align=2
                i64.store offset=504 align=2
                local.get 4
                local.get 8
                i32.store offset=520
                local.get 4
                local.get 3
                i32.store offset=516
                local.get 4
                i32.const 6
                i32.store8 offset=512
                local.get 4
                local.get 4
                i32.const 328
                i32.add
                i32.store offset=528
                local.get 4
                i32.const 8
                i32.add
                local.get 4
                i32.const 472
                i32.add
                call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 3>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
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
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=328
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
                  br_if 4 (;@3;)
                  local.get 4
                  i32.const 360
                  i32.add
                  call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                  br 4 (;@3;)
                end
                local.get 3
                i32.eqz
                br_if 3 (;@3;)
                local.get 4
                local.get 5
                i32.store offset=56
                local.get 4
                local.get 3
                i32.store offset=52
                local.get 4
                i32.const 6
                i32.store8 offset=48
                local.get 3
                local.get 3
                i32.load
                i32.const 1
                i32.add
                local.tee 7
                i32.store
                local.get 7
                i32.eqz
                br_if 5 (;@1;)
                local.get 4
                local.get 3
                i32.store offset=332
                local.get 4
                i32.const 6
                i32.store8 offset=328
                local.get 4
                local.get 5
                i64.extend_i32_u
                i64.store offset=336
                local.get 4
                i32.const 0
                i32.store16 offset=304
                local.get 4
                i32.const 1066307
                i32.store offset=300
                local.get 4
                i32.const 1066301
                i32.store offset=296
                local.get 4
                i32.const 472
                i32.add
                local.get 4
                i32.const 296
                i32.add
                call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=472
                        local.tee 3
                        i32.const 255
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 4
                        local.get 4
                        i64.load offset=476 align=4
                        i64.store offset=364 align=4
                        local.get 4
                        i32.const 3
                        i32.store8 offset=360
                        local.get 4
                        i32.const 296
                        i32.add
                        local.get 4
                        i32.const 328
                        i32.add
                        local.get 4
                        i32.const 360
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=296
                          i32.const 255
                          i32.ne
                          br_if 0 (;@11;)
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
                          br 4 (;@7;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=320
                        i64.store offset=496
                        local.get 4
                        local.get 4
                        i64.load offset=312
                        i64.store offset=488
                        local.get 4
                        local.get 4
                        i64.load offset=304
                        i64.store offset=480
                        local.get 4
                        local.get 4
                        i64.load offset=296
                        i64.store offset=472
                        local.get 4
                        i32.const 360
                        i32.add
                        local.get 4
                        i32.const 472
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                        block ;; label = @11
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=360
                            i32.const 255
                            i32.eq
                            br_if 0 (;@12;)
                            local.get 4
                            local.get 4
                            i64.load offset=368
                            i64.store offset=120
                            local.get 4
                            local.get 4
                            i64.load offset=360
                            i64.store offset=112
                            br 1 (;@11;)
                          end
                          local.get 4
                          i32.const 256
                          i32.store16 offset=112
                        end
                        local.get 4
                        i32.const 472
                        i32.add
                        call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 488
                        i32.add
                        call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        local.get 4
                                        i32.load8_u offset=48
                                        local.tee 5
                                        br_table 6 (;@12;) 6 (;@12;) 0 (;@18;) 1 (;@17;) 2 (;@16;) 3 (;@15;) 4 (;@14;) 5 (;@13;) 6 (;@12;)
                                      end
                                      local.get 4
                                      i64.load offset=56
                                      local.set 6
                                      br 9 (;@8;)
                                    end
                                    local.get 4
                                    i32.load offset=52
                                    local.tee 3
                                    local.get 3
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 7
                                    i32.store
                                    local.get 7
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    br 7 (;@9;)
                                  end
                                  local.get 4
                                  i32.load offset=52
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
                                  local.get 4
                                  i64.load8_u offset=60
                                  i64.const 32
                                  i64.shl
                                  local.get 4
                                  i64.load32_u offset=56
                                  i64.or
                                  local.set 6
                                  br 7 (;@8;)
                                end
                                local.get 4
                                i32.load offset=52
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
                                br 5 (;@9;)
                              end
                              local.get 4
                              i32.load offset=52
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
                            i32.load offset=52
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
                            br 1 (;@11;)
                          end
                          local.get 4
                          i32.load8_u offset=49
                          local.set 7
                        end
                        br 2 (;@8;)
                      end
                      local.get 4
                      local.get 4
                      i32.load8_u offset=475
                      i32.store8 offset=363
                      local.get 4
                      local.get 4
                      i32.load16_u offset=473 align=1
                      i32.store16 offset=361 align=1
                      local.get 4
                      local.get 4
                      i32.load offset=484
                      i32.store offset=372
                      local.get 4
                      local.get 4
                      i64.load offset=476 align=4
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
                    local.set 6
                  end
                  local.get 4
                  local.get 6
                  i64.store offset=200
                  local.get 4
                  local.get 3
                  i32.store offset=196
                  local.get 4
                  local.get 7
                  i32.store8 offset=193
                  local.get 4
                  local.get 5
                  i32.store8 offset=192
                  local.get 4
                  i64.const 1
                  i64.store offset=184
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
                                      i32.load8_u offset=32
                                      local.tee 5
                                      br_table 6 (;@11;) 6 (;@11;) 0 (;@17;) 1 (;@16;) 2 (;@15;) 3 (;@14;) 4 (;@13;) 5 (;@12;) 6 (;@11;)
                                    end
                                    local.get 4
                                    i64.load offset=40
                                    local.set 6
                                    br 8 (;@8;)
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
                                  br_if 14 (;@1;)
                                  br 6 (;@9;)
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
                                br_if 13 (;@1;)
                                local.get 4
                                i64.load8_u offset=44
                                i64.const 32
                                i64.shl
                                local.get 4
                                i64.load32_u offset=40
                                i64.or
                                local.set 6
                                br 6 (;@8;)
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
                              br_if 12 (;@1;)
                              br 4 (;@9;)
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
                            br_if 11 (;@1;)
                            br 3 (;@9;)
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
                          br_if 10 (;@1;)
                          br 1 (;@10;)
                        end
                        local.get 4
                        i32.load8_u offset=33
                        local.set 7
                      end
                      br 1 (;@8;)
                    end
                    local.get 4
                    i64.load32_u offset=40
                    local.set 6
                  end
                  local.get 4
                  i32.const 192
                  i32.add
                  local.set 8
                  local.get 4
                  local.get 6
                  i64.store offset=464
                  local.get 4
                  local.get 3
                  i32.store offset=460
                  local.get 4
                  local.get 7
                  i32.store8 offset=457
                  local.get 4
                  local.get 5
                  i32.store8 offset=456
                  local.get 4
                  i64.const 0
                  i64.store offset=368
                  local.get 4
                  i32.const 2
                  i32.store8 offset=360
                  local.get 4
                  i32.const 328
                  i32.add
                  local.get 4
                  i32.const 456
                  i32.add
                  local.get 4
                  i32.const 360
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                  block ;; label = @8
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=328
                      i32.const 255
                      i32.ne
                      br_if 0 (;@9;)
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
                      local.get 8
                      call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                      br 1 (;@8;)
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=352
                    i64.store offset=384
                    local.get 4
                    local.get 4
                    i64.load offset=344
                    i64.store offset=376
                    local.get 4
                    local.get 4
                    i64.load offset=336
                    i64.store offset=368
                    local.get 4
                    local.get 4
                    i64.load offset=328
                    i64.store offset=360
                    local.get 4
                    i32.const 456
                    i32.add
                    local.get 4
                    i32.const 360
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                    block ;; label = @9
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=456
                        i32.const 255
                        i32.eq
                        br_if 0 (;@10;)
                        local.get 4
                        local.get 4
                        i64.load offset=464
                        i64.store offset=256
                        local.get 4
                        local.get 4
                        i64.load offset=456
                        i64.store offset=248
                        br 1 (;@9;)
                      end
                      local.get 4
                      i32.const 256
                      i32.store16 offset=248
                    end
                    local.get 4
                    i32.const 360
                    i32.add
                    call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i32.const 376
                    i32.add
                    call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i64.const 4607182418800017408
                    i64.store offset=368
                    local.get 4
                    i32.const 2
                    i32.store8 offset=360
                    local.get 4
                    i32.const 224
                    i32.add
                    local.get 4
                    i32.const 248
                    i32.add
                    local.get 4
                    i32.const 360
                    i32.add
                    call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
                    local.get 4
                    local.get 4
                    i64.load offset=232
                    i64.store offset=208
                    local.get 4
                    local.get 4
                    i64.load offset=240
                    i64.store offset=216
                    block ;; label = @9
                      local.get 4
                      i64.load offset=224
                      i64.const 1
                      i64.ne
                      br_if 0 (;@9;)
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
                      local.get 8
                      call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                      br 1 (;@8;)
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=216
                    i64.store offset=512
                    local.get 4
                    local.get 4
                    i64.load offset=208
                    i64.store offset=504
                    local.get 4
                    local.get 4
                    i64.load offset=184
                    i64.store offset=472
                    local.get 4
                    local.get 4
                    i64.load offset=192
                    i64.store offset=480
                    local.get 4
                    local.get 4
                    i64.load offset=200
                    i64.store offset=488
                    local.get 4
                    i64.const 0
                    i64.store offset=496
                    local.get 4
                    i32.const 160
                    i32.add
                    local.get 4
                    i32.const 472
                    i32.add
                    call $"nanvm_lib::vm::unstable::spread_array::<nanvm_lib::naive::Naive, [nanvm_lib::vm::unstable::ArrayItem<nanvm_lib::naive::Naive>; 2]>"
                    local.get 4
                    local.get 4
                    i64.load offset=168
                    i64.store offset=144
                    local.get 4
                    local.get 4
                    i64.load offset=176
                    i64.store offset=152
                    block ;; label = @9
                      local.get 4
                      i64.load offset=160
                      i64.const 1
                      i64.ne
                      br_if 0 (;@9;)
                      local.get 0
                      local.get 4
                      i64.load offset=152
                      i64.store offset=16
                      local.get 0
                      local.get 4
                      i64.load offset=144
                      i64.store offset=8
                      local.get 0
                      i64.const 1
                      i64.store
                      br 1 (;@8;)
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=152
                    i64.store offset=136
                    local.get 4
                    local.get 4
                    i64.load offset=144
                    i64.store offset=128
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
                                        i32.load8_u offset=48
                                        local.tee 5
                                        br_table 6 (;@12;) 6 (;@12;) 0 (;@18;) 1 (;@17;) 2 (;@16;) 3 (;@15;) 4 (;@14;) 5 (;@13;) 6 (;@12;)
                                      end
                                      local.get 4
                                      i64.load offset=56
                                      local.set 6
                                      br 8 (;@9;)
                                    end
                                    local.get 4
                                    i32.load offset=52
                                    local.tee 3
                                    local.get 3
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 7
                                    i32.store
                                    local.get 7
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    br 6 (;@10;)
                                  end
                                  local.get 4
                                  i32.load offset=52
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
                                  local.get 4
                                  i64.load8_u offset=60
                                  i64.const 32
                                  i64.shl
                                  local.get 4
                                  i64.load32_u offset=56
                                  i64.or
                                  local.set 6
                                  br 6 (;@9;)
                                end
                                local.get 4
                                i32.load offset=52
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
                                br 4 (;@10;)
                              end
                              local.get 4
                              i32.load offset=52
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
                              br 3 (;@10;)
                            end
                            local.get 4
                            i32.load offset=52
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
                            br 1 (;@11;)
                          end
                          local.get 4
                          i32.load8_u offset=49
                          local.set 7
                        end
                        br 1 (;@9;)
                      end
                      local.get 4
                      i64.load32_u offset=56
                      local.set 6
                    end
                    local.get 4
                    local.get 6
                    i64.store offset=368
                    local.get 4
                    local.get 3
                    i32.store offset=364
                    local.get 4
                    local.get 7
                    i32.store8 offset=361
                    local.get 4
                    local.get 5
                    i32.store8 offset=360
                    local.get 4
                    i64.const 4611686018427387904
                    i64.store offset=480
                    local.get 4
                    i32.const 2
                    i32.store8 offset=472
                    local.get 4
                    i32.const 392
                    i32.add
                    local.get 4
                    i32.const 360
                    i32.add
                    local.get 4
                    i32.const 472
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                    block ;; label = @9
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=392
                        i32.const 255
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 4
                        i32.const 392
                        i32.add
                        i32.const 8
                        i32.add
                        local.set 3
                        br 1 (;@9;)
                      end
                      local.get 4
                      local.get 4
                      i64.load offset=416
                      i64.store offset=496
                      local.get 4
                      local.get 4
                      i64.load offset=408
                      i64.store offset=488
                      local.get 4
                      local.get 4
                      i64.load offset=400
                      i64.store offset=480
                      local.get 4
                      local.get 4
                      i64.load offset=392
                      i64.store offset=472
                      local.get 4
                      i32.const 360
                      i32.add
                      local.get 4
                      i32.const 472
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
                          i64.store offset=232
                          local.get 4
                          local.get 4
                          i64.load offset=360
                          i64.store offset=224
                          br 1 (;@10;)
                        end
                        local.get 4
                        i32.const 256
                        i32.store16 offset=224
                      end
                      local.get 4
                      i32.const 472
                      i32.add
                      call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      i32.const 488
                      i32.add
                      call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      i64.const 0
                      i64.store offset=480
                      local.get 4
                      i32.const 2
                      i32.store8 offset=472
                      local.get 4
                      i32.const 424
                      i32.add
                      local.get 4
                      i32.const 224
                      i32.add
                      local.get 4
                      i32.const 472
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=424
                        i32.const 255
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 4
                        i32.const 424
                        i32.add
                        i32.const 8
                        i32.add
                        local.set 3
                        br 1 (;@9;)
                      end
                      local.get 4
                      local.get 4
                      i64.load offset=448
                      i64.store offset=496
                      local.get 4
                      local.get 4
                      i64.load offset=440
                      i64.store offset=488
                      local.get 4
                      local.get 4
                      i64.load offset=432
                      i64.store offset=480
                      local.get 4
                      local.get 4
                      i64.load offset=424
                      i64.store offset=472
                      local.get 4
                      i32.const 360
                      i32.add
                      local.get 4
                      i32.const 472
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                      i32.const 1
                      local.set 3
                      i32.const 0
                      local.set 5
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=360
                        local.tee 7
                        i32.const 255
                        i32.eq
                        br_if 0 (;@10;)
                        local.get 4
                        local.get 4
                        i64.load offset=362 align=2
                        i64.store offset=64
                        local.get 4
                        local.get 4
                        i64.load offset=368 align=2
                        i64.store offset=70 align=2
                        local.get 4
                        i32.load8_u offset=361
                        local.set 3
                        local.get 7
                        local.set 5
                      end
                      local.get 4
                      i32.const 472
                      i32.add
                      call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      i32.const 488
                      i32.add
                      call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      local.get 4
                      i64.load offset=120
                      local.tee 6
                      i64.store offset=88
                      local.get 4
                      local.get 4
                      i64.load offset=112
                      local.tee 9
                      i64.store offset=80
                      local.get 4
                      local.get 4
                      i64.load offset=152
                      local.tee 10
                      i64.store offset=104
                      local.get 4
                      local.get 4
                      i64.load offset=144
                      local.tee 11
                      i64.store offset=96
                      local.get 4
                      i32.const 0
                      i32.store8 offset=184
                      local.get 4
                      i64.const 12884901888
                      i64.store offset=472
                      local.get 4
                      local.get 9
                      i64.store offset=480
                      local.get 4
                      local.get 6
                      i64.store offset=488
                      local.get 4
                      local.get 11
                      i64.store offset=496
                      local.get 4
                      local.get 10
                      i64.store offset=504
                      local.get 4
                      local.get 3
                      i32.store8 offset=513
                      local.get 4
                      local.get 5
                      i32.store8 offset=512
                      local.get 4
                      local.get 4
                      i64.load offset=64
                      i64.store offset=514 align=2
                      local.get 4
                      local.get 4
                      i64.load offset=70 align=2
                      i64.store offset=520 align=2
                      local.get 4
                      local.get 4
                      i32.const 184
                      i32.add
                      i32.store offset=528
                      local.get 4
                      local.get 4
                      i32.const 472
                      i32.add
                      call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 3>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                      local.get 4
                      local.get 4
                      i32.load offset=4
                      local.tee 5
                      i32.store offset=364
                      local.get 4
                      local.get 4
                      i32.load
                      local.tee 3
                      i32.store offset=360
                      block ;; label = @10
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=184
                          i32.const 1
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 3
                          local.get 3
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 2
                          i32.store
                          local.get 2
                          br_if 1 (;@10;)
                          local.get 4
                          i32.const 360
                          i32.add
                          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                          br 1 (;@10;)
                        end
                        local.get 3
                        i32.eqz
                        br_if 0 (;@10;)
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
                        i32.const 48
                        i32.add
                        call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 32
                        i32.add
                        call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                        local.get 2
                        local.get 2
                        i32.load
                        i32.const -1
                        i32.add
                        local.tee 0
                        i32.store
                        local.get 0
                        br_if 6 (;@4;)
                        br 5 (;@5;)
                      end
                      i32.const 1053928
                      i32.const 43
                      local.get 4
                      i32.const 543
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
                    i32.const 128
                    i32.add
                    call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                  end
                  local.get 4
                  i32.const 112
                  i32.add
                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                end
                local.get 4
                i32.const 48
                i32.add
                call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
              end
              local.get 4
              i32.const 32
              i32.add
              call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
              local.get 2
              local.get 2
              i32.load
              i32.const -1
              i32.add
              local.tee 0
              i32.store
              local.get 0
              br_if 1 (;@4;)
            end
            local.get 4
            i32.const 24
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
          end
          local.get 4
          i32.const 544
          i32.add
          global.set $__stack_pointer
          return
        end
        i32.const 1053928
        i32.const 43
        local.get 4
        i32.const 543
        i32.add
        i32.const 1053912
        i32.const 1053972
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1053928
      i32.const 43
      local.get 4
      i32.const 543
      i32.add
      i32.const 1053912
      i32.const 1053972
      call $core::result::unwrap_failed
      unreachable
    end
    unreachable
  )
