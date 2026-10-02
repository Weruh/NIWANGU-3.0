-- Run only in an isolated database. All fixtures and mutations roll back.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('30000000-0000-0000-0000-000000000001','regression-alex@example.test','{"full_name":"Regression Alex","age":30,"gender":"male","seeking_gender":"female","location":"Nairobi"}');
insert into auth.users(id,email,raw_user_meta_data)
select ('40000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'regression-'||i||'@example.test',
jsonb_build_object('full_name','Regression Member '||i,'age',28,'gender','female','seeking_gender','male','location','Nairobi') from generate_series(1,14) i;
insert into public.profile_photos(profile_id,sort_order,public_url) select p.id,i,'http://localhost:3000/boost-promo-hero.webp' from (select * from public.profiles where full_name like 'Regression %') p cross join generate_series(0,2) i;
insert into public.ritual_answers(profile_id,question_id,answer_text) select p.id,q.question_id,q.answer_text from (select * from public.profiles where full_name like 'Regression %') p cross join (select distinct on(question_id) question_id,answer_text from public.ritual_answer_codes order by question_id,answer_text) q;
insert into public.ritual_answers(profile_id,question_id,answer_text) select id,12,'Respect and honesty are essential to every meaningful connection.' from public.profiles where full_name like 'Regression %';
update public.profiles set boundary='Please respect my time and boundaries.',profile_ready=true,onboarding_completed=true where full_name='Regression Alex' or full_name like 'Regression Member %';
select id as actor from public.profiles where full_name='Regression Alex' \gset
select id as partner from public.profiles where full_name='Regression Member 1' \gset
select id as extra from public.profiles where full_name='Regression Member 14' \gset
insert into public.swipes(actor_profile_id,target_profile_id,direction) values(:'partner',:'actor','like');
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$ begin
 if (select used_views from public.get_profile_view_status())<>0 then raise exception 'initial quota'; end if;
 if (select count(*) from public.get_discovery_profiles(p_limit=>50) where name like 'Regression Member %')<>14 then raise exception 'discovery pool'; end if;
 perform public.get_discovery_profiles();perform public.get_discovery_profiles();
 if (select used_views from public.get_profile_view_status())<>0 then raise exception 'browsing consumed decisions'; end if;
 begin perform public.get_discovery_profiles('likes');raise exception 'free likes accepted';exception when raise_exception then if SQLERRM<>'premium_required' then raise;end if;end;
 begin update public.profiles set is_premium=true where auth_user_id=auth.uid();raise exception 'plan modification accepted';exception when raise_exception then if SQLERRM<>'plan_fields_require_payment' then raise;end if;end;
end $$;
select * from public.handle_swipe(:'partner','like') \gset
\if :matched
\else
\echo Mutual match failed
\quit 1
\endif
select * from public.handle_swipe(:'extra','pass');
-- Repeated requests cannot charge twice.
select * from public.handle_swipe(:'extra','pass');
do $$ begin if (select used_views from public.get_profile_view_status())<>2 then raise exception 'duplicate charged twice';end if;end $$;
reset role;
select id as target2 from public.profiles where full_name='Regression Member 2' \gset
select id as target3 from public.profiles where full_name='Regression Member 3' \gset
select id as target4 from public.profiles where full_name='Regression Member 4' \gset
select id as target5 from public.profiles where full_name='Regression Member 5' \gset
select id as target6 from public.profiles where full_name='Regression Member 6' \gset
select id as target7 from public.profiles where full_name='Regression Member 7' \gset
select id as target8 from public.profiles where full_name='Regression Member 8' \gset
select id as target9 from public.profiles where full_name='Regression Member 9' \gset
select id as target10 from public.profiles where full_name='Regression Member 10' \gset
set local role authenticated;

select * from public.handle_swipe(:'target2','pass');
select * from public.handle_swipe(:'target3','pass');
select * from public.handle_swipe(:'target4','pass');
select * from public.handle_swipe(:'target5','pass');
select * from public.handle_swipe(:'target6','pass');
select * from public.handle_swipe(:'target7','pass');
select * from public.handle_swipe(:'target8','pass');
select * from public.handle_swipe(:'target9','pass');
do $$ begin
 if (select used_views from public.get_profile_view_status())<>10 then raise exception 'quota not ten';end if;
 if not (select is_locked from public.get_profile_view_status()) then raise exception 'limit not enforced';end if;
 if (select count(*) from public.get_discovery_profiles())<>0 then raise exception 'locked discovery leaked';end if;
 if (select count(*) from public.get_matches())<>1 then raise exception 'quota locked matched chat';end if;
 if (select locked_until at time zone 'Africa/Nairobi' from public.get_profile_view_status())::time<>'00:00'::time then raise exception 'reset not midnight';end if;
end $$;
-- A boundary must be acknowledged before the first message.
select set_config('test.match',:'match_id',true);
do $$ begin
 begin perform public.send_match_message(current_setting('test.match')::uuid,'Before acknowledgement');raise exception 'boundary bypass accepted';exception when raise_exception then if SQLERRM<>'boundary_not_acknowledged' then raise;end if;end;
end $$;
-- Locked users can send and read matched messages.
select public.acknowledge_boundary(:'match_id');
select public.send_match_message(:'match_id','Hello, meaningful connection!');
select * from public.get_match_messages(:'match_id');
\set target :target10
select set_config('test.target',:'target',true);
do $$ begin
 begin perform public.handle_swipe(current_setting('test.target')::uuid,'like');raise exception 'eleventh accepted';exception when raise_exception then if SQLERRM<>'daily_limit_reached' then raise;end if;end;
end $$;
reset role;
update public.profiles set is_premium=true,premium_expires_at=now()+interval '1 day' where id=:'actor';
set local role authenticated;
select * from public.handle_swipe(:'target10','pass');
select public.undo_last_pass();
do $$ begin
 if (select used_views from public.get_profile_view_status())<>11 then raise exception 'undo refunded quota';end if;
 if (select is_locked from public.get_profile_view_status()) then raise exception 'premium still locked';end if;
end $$;
select public.report_member(:'partner','Review harassment report');
select public.block_member(:'partner');
do $$ begin if (select count(*) from public.get_matches())<>0 then raise exception 'blocked inbox leaked';end if;end $$;
select set_config('test.match',:'match_id',true);
do $$ begin
 begin perform public.send_match_message(current_setting('test.match')::uuid,'Should fail');raise exception 'blocked send accepted';exception when raise_exception then if SQLERRM<>'Connection unavailable' then raise;end if;end;
end $$;
reset role;
-- Previous-day decisions no longer consume today’s allowance.
update public.profiles set is_premium=false,premium_expires_at=null where id=:'actor';
update public.member_decisions set created_at=now()-interval '2 days' where profile_id=:'actor';
set local role authenticated;
do $$ begin if (select remaining_views from public.get_profile_view_status())<>10 then raise exception 'daily reset failed';end if;end $$;
reset role;
rollback;
\echo PASS: browsing, quota, duplicate requests, mutual match, free chat, premium, undo, blocks, reports, and Kenya reset
