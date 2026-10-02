\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email,raw_user_meta_data) values('50000000-0000-0000-0000-000000000001','payment-review@example.test','{"full_name":"Payment Review","age":30,"gender":"male","seeking_gender":"female","location":"Nairobi"}'),('50000000-0000-0000-0000-000000000002','moderation-review@example.test','{"full_name":"Moderation Review","age":30,"gender":"female","seeking_gender":"male","location":"Nairobi"}');
select id as actor from public.profiles where auth_user_id='50000000-0000-0000-0000-000000000001' \gset
select id as target from public.profiles where auth_user_id='50000000-0000-0000-0000-000000000002' \gset
insert into public.payments(profile_id,reference,phone_number,amount,plan_id,status) values
(:'actor','test-seven','254712345678',99,'7_days','pending'),(:'actor','test-thirty','254712345678',199,'30_days','pending'),(:'actor','test-underpaid','254712345678',199,'30_days','pending');
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"50000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{}}',true);
set local role authenticated;
do $$ begin
 begin perform public.complete_payment('test-seven',null,'1','success',99);raise exception 'browser granted premium';exception when insufficient_privilege then null;end;
 begin perform public.list_report_queue();raise exception 'member read moderator queue';exception when raise_exception then if SQLERRM<>'Forbidden' then raise;end if;end;
end $$;
select public.report_member(:'target','Test abuse report for moderator review');
reset role;
-- The purchased amount is authoritative even if the catalogue price changes before settlement.
update public.pricing_plans set price_ksh=199 where plan_id='7_days';
set local role service_role;
select public.complete_payment('test-seven',null,'1','success',99);
select public.complete_payment('test-seven',null,'1','replay',99);
select public.complete_payment('test-thirty',null,'2','success',199);
select public.complete_payment('test-underpaid',null,'3','success',100);
reset role;
do $$ begin
 if (select boost_credits from public.profiles where auth_user_id='50000000-0000-0000-0000-000000000001')<>3 then raise exception 'included boosts or replay failed';end if;
 if (select premium_expires_at from public.profiles where auth_user_id='50000000-0000-0000-0000-000000000001') not between now()+interval '36 days' and now()+interval '38 days' then raise exception 'renewal days did not stack';end if;
 if (select status from public.payments where reference='test-underpaid')<>'amount_mismatch' then raise exception 'underpayment not rejected';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"50000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"moderator"}}',true);
set local role authenticated;
select * from public.list_report_queue();
reset role;
select id as report from public.member_reports where profile_id=:'actor' \gset
set local role authenticated;
select public.review_member_report(:'report','resolved',true);
reset role;
do $$ begin
 if not (select is_suspended from public.profiles where auth_user_id='50000000-0000-0000-0000-000000000002') then raise exception 'moderator suspension failed';end if;
end $$;
rollback;
\echo PASS: service-only activation, recorded purchase amount, replay protection, stacked renewal, included boosts, underpayment, and moderator authorization
