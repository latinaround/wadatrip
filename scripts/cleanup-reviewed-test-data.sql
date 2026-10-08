-- MANUAL OWNER-AUTHORIZED OPERATION ONLY. Never run from build/startup/migrations.
-- Requires encrypted backup, successful isolated rehearsal and explicit session opt-in.
-- No bookings, payments, events, availability or ambiguous accounts are changed.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SET LOCAL timezone='UTC';
DO $cleanup$
DECLARE
 actor text := 'cmuvl3qhp0002l92kukw0jipm';
 remove_ids text[] := ARRAY['cmgmuauif0002flzk0hi54qra','cmmyc62ry0000mc4flmoxqp1n','cmmyc631y0001mc4fdy0obbyu','cmn3ghiyf0000jq4l9l9mf0sa','cmn3gkdkb0001jq4l8mjwmjva','cmn513si80003m95e6grrrsen','cmpydmcbz0000of5sdyl8b9hd','cmqfeqzbk0000oe58kb0sv5lo','cmqff2h500003oe582g433br0','cmqffcsjz0000ko5qfq990qzt'];
 deactivate_ids text[] := ARRAY['cmjbsctvx0000fl6gyb9owbxi','cmpydom0m0001of5snr6uxsnj','cmpydp2xs0004of5s49fxznpx','cmpye1agf0009of5s50pcjhgp'];
 financial_ids text[] := ARRAY['cmjbsez3y0000flrk82kg7l77','cmmwltk9s0000mf4dqq4qg5rx','cmmwm5p340000ms57ctm0032s','cmn51098i0000m95eg1j3prwn','cmn54ex9h0000ot57eyu76beb'];
 provider_ids text[] := ARRAY['cmpydom8a0003of5sh0o2fjwr','cmpydp36p0006of5s02ho6ro2','cmpye1aok000bof5shygarz6e'];
 listing_ids text[] := ARRAY['cmpydp3jx0008of5snbgahhjq','cmpye1b7g000dof5smzksrvnr'];
 expected_tables text[] := ARRAY['OperatorWallet','PaymentEvent','PaymentRecord','_prisma_migrations','admin_audit_log','admin_mfa','adred_predictions','alert_subscriptions','alerts','auth_login_codes','bookings','destination_covers','itineraries','itinerary_items','itinerary_versions','listing_availability','listings','operator_leads','provider_documents','providers','push_devices','tour_date_requests','tour_request_notifications','trip_experiences','trips','users'];
 all_ids text[]; actual_tables text[]; before_tables jsonb := '{}'::jsonb;
 protected_before text; financial_before text; provider_before text; listing_before text; inactive_before text;
 hash_value text; n bigint; changed bigint; t record; candidate_rec record;
BEGIN
 IF current_setting('wadatrip.test_cleanup_authorized',true) IS DISTINCT FROM 'reviewed-20261008' THEN RAISE EXCEPTION 'Explicit cleanup authorization missing'; END IF;
 all_ids:=remove_ids||deactivate_ids||financial_ids;
 IF cardinality(all_ids)<>19 OR (SELECT count(DISTINCT id) FROM unnest(all_ids) id)<>19 THEN RAISE EXCEPTION 'Invalid reviewed scope'; END IF;
 SELECT array_agg(tablename::text ORDER BY tablename COLLATE "C") INTO actual_tables FROM pg_tables WHERE schemaname='public';
 IF actual_tables IS DISTINCT FROM expected_tables THEN RAISE EXCEPTION 'Database surface changed; repeat discovery'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_schema='public') THEN RAISE EXCEPTION 'Unexpected triggers'; END IF;
 -- Brief write barrier prevents new FK and soft/JSON references during deletion.
 -- Application HTTP is drained during the production maintenance window.
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename COLLATE "C" LOOP
  EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE',t.tablename);
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM users u JOIN admin_mfa m ON m.user_id=u.id WHERE u.id=actor AND u.status='active' AND m.enabled_at IS NOT NULL) THEN RAISE EXCEPTION 'Owner enrollment precondition failed'; END IF;
 IF (SELECT count(*) FROM users WHERE id=ANY(all_ids) AND status='active')<>19 THEN RAISE EXCEPTION 'Reviewed accounts changed'; END IF;
 IF EXISTS(SELECT 1 FROM _prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL) THEN RAISE EXCEPTION 'Unresolved migration history'; END IF;
 -- A missing amount is NOT proof of financial safety: all actual flow references are checked.
 FOR candidate_rec IN SELECT id,email FROM users WHERE id=ANY(remove_ids) LOOP
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('users','_prisma_migrations') LOOP
   EXECUTE format('SELECT count(*) FROM public.%I r WHERE strpos(lower(to_jsonb(r)::text),lower($1))>0 OR strpos(lower(to_jsonb(r)::text),lower($2))>0',t.tablename) INTO n USING candidate_rec.id,candidate_rec.email;
   IF n<>0 THEN RAISE EXCEPTION 'Deletion candidate has references: %',candidate_rec.id; END IF;
  END LOOP;
 END LOOP;
 IF (SELECT count(*) FROM providers WHERE id=ANY(provider_ids) AND user_id=ANY(deactivate_ids) AND status='pending' AND verification_status='pending' AND nullif(trim(stripe_account_id),'') IS NULL)<>3 THEN RAISE EXCEPTION 'Test provider precondition failed'; END IF;
 IF (SELECT count(*) FROM listings WHERE id=ANY(listing_ids) AND provider_id=ANY(provider_ids) AND status='draft')<>2 THEN RAISE EXCEPTION 'Test listing precondition failed'; END IF;
 IF EXISTS(SELECT 1 FROM bookings WHERE provider_id=ANY(provider_ids) OR listing_id=ANY(listing_ids))
  OR EXISTS(SELECT 1 FROM "PaymentRecord" WHERE provider_id=ANY(provider_ids))
  OR EXISTS(SELECT 1 FROM "OperatorWallet" WHERE "operatorId"=ANY(provider_ids||deactivate_ids))
  OR EXISTS(SELECT 1 FROM itineraries WHERE agent_id=ANY(provider_ids) OR owner_id=ANY(deactivate_ids))
  OR EXISTS(SELECT 1 FROM provider_documents WHERE provider_id=ANY(provider_ids))
  OR EXISTS(SELECT 1 FROM listing_availability WHERE listing_id=ANY(listing_ids))
  OR EXISTS(SELECT 1 FROM tour_date_requests WHERE listing_id=ANY(listing_ids) OR user_id=ANY(deactivate_ids))
 THEN RAISE EXCEPTION 'Archive candidate has operational or financial dependencies'; END IF;
 IF (SELECT count(*) FROM bookings WHERE user_id=ANY(deactivate_ids))<>1
  OR NOT EXISTS(SELECT 1 FROM bookings WHERE id='cmjbscu8h0005fl6g25l4xtex' AND user_id='cmjbsctvx0000fl6gyb9owbxi' AND status='pending' AND payment_status='pending' AND nullif(trim(checkout_session_id),'') IS NULL AND nullif(trim(payment_intent_id),'') IS NULL)
  OR EXISTS(SELECT 1 FROM "PaymentRecord" p JOIN bookings b ON b.id=p.booking_id WHERE b.user_id=ANY(deactivate_ids))
 THEN RAISE EXCEPTION 'Account deactivation has financial ambiguity'; END IF;
 FOR candidate_rec IN SELECT id,email FROM users WHERE id=ANY(deactivate_ids) UNION ALL SELECT id,email FROM providers WHERE id=ANY(provider_ids) LOOP
  IF EXISTS(SELECT 1 FROM "PaymentEvent" e WHERE strpos(lower(to_jsonb(e)::text),lower(candidate_rec.id))>0 OR strpos(lower(to_jsonb(e)::text),lower(candidate_rec.email))>0) THEN RAISE EXCEPTION 'Archive candidate has a payment event'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM "PaymentEvent" e WHERE strpos(to_jsonb(e)::text,'cmjbscu8h0005fl6g25l4xtex')>0) THEN RAISE EXCEPTION 'Booking has a payment event'; END IF;
 -- Preserve every other table byte-for-byte, including all financial/inventory history.
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('users','providers','listings','admin_audit_log') LOOP
  EXECUTE format('SELECT md5(coalesce(string_agg(h,%L ORDER BY h),%L)) FROM (SELECT md5(to_jsonb(r)::text) h FROM public.%I r) q','','',t.tablename) INTO hash_value;
  before_tables:=before_tables||jsonb_build_object(t.tablename,hash_value);
 END LOOP;
 SELECT md5(coalesce(string_agg(to_jsonb(u)::text,'' ORDER BY id),'')) INTO protected_before FROM users u WHERE NOT(id=ANY(all_ids));
 SELECT md5(coalesce(string_agg(to_jsonb(u)::text,'' ORDER BY id),'')) INTO financial_before FROM users u WHERE id=ANY(financial_ids);
 SELECT md5(string_agg((to_jsonb(u)-'status')::text,'' ORDER BY id)) INTO inactive_before FROM users u WHERE id=ANY(deactivate_ids);
 SELECT md5(coalesce(string_agg((to_jsonb(p)-ARRAY['status','verification_status'])::text,'' ORDER BY id),'')) INTO provider_before FROM providers p;
 SELECT md5(coalesce(string_agg((to_jsonb(l)-'status')::text,'' ORDER BY id),'')) INTO listing_before FROM listings l;
 INSERT INTO admin_audit_log(id,actor_id,action,resource_id,result)
 SELECT 'tdc20261008_'||md5('delete:'||id),actor,'test_data.account_deleted',id,'success' FROM users WHERE id=ANY(remove_ids);
 DELETE FROM users WHERE id=ANY(remove_ids);
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>10 THEN RAISE EXCEPTION 'Unexpected deleted count'; END IF;
 UPDATE users SET status='inactive' WHERE id=ANY(deactivate_ids);
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>4 THEN RAISE EXCEPTION 'Unexpected inactive count'; END IF;
 INSERT INTO admin_audit_log(id,actor_id,action,resource_id,result)
 SELECT 'tdc20261008_'||md5('deactivate:'||id),actor,'test_data.account_deactivated',id,'success' FROM users WHERE id=ANY(deactivate_ids);
 UPDATE providers SET status='rejected',verification_status='rejected' WHERE id=ANY(provider_ids);
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>3 THEN RAISE EXCEPTION 'Unexpected rejected count'; END IF;
 INSERT INTO admin_audit_log(id,actor_id,action,resource_id,result)
 SELECT 'tdc20261008_'||md5('provider:'||id),actor,'test_data.provider_archived',id,'success' FROM providers WHERE id=ANY(provider_ids);
 UPDATE listings SET status='inactive' WHERE id=ANY(listing_ids);
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>2 THEN RAISE EXCEPTION 'Unexpected listing count'; END IF;
 INSERT INTO admin_audit_log(id,actor_id,action,resource_id,result)
 SELECT 'tdc20261008_'||md5('listing:'||id),actor,'test_data.listing_archived',id,'success' FROM listings WHERE id=ANY(listing_ids);
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('users','providers','listings','admin_audit_log') LOOP
  EXECUTE format('SELECT md5(coalesce(string_agg(h,%L ORDER BY h),%L)) FROM (SELECT md5(to_jsonb(r)::text) h FROM public.%I r) q','','',t.tablename) INTO hash_value;
  IF hash_value IS DISTINCT FROM before_tables->>t.tablename THEN RAISE EXCEPTION 'Protected history changed: %',t.tablename; END IF;
 END LOOP;
 IF protected_before IS DISTINCT FROM (SELECT md5(coalesce(string_agg(to_jsonb(u)::text,'' ORDER BY id),'')) FROM users u WHERE NOT(id=ANY(all_ids)))
  OR financial_before IS DISTINCT FROM (SELECT md5(coalesce(string_agg(to_jsonb(u)::text,'' ORDER BY id),'')) FROM users u WHERE id=ANY(financial_ids))
  OR inactive_before IS DISTINCT FROM (SELECT md5(string_agg((to_jsonb(u)-'status')::text,'' ORDER BY id)) FROM users u WHERE id=ANY(deactivate_ids))
  OR provider_before IS DISTINCT FROM (SELECT md5(coalesce(string_agg((to_jsonb(p)-ARRAY['status','verification_status'])::text,'' ORDER BY id),'')) FROM providers p)
  OR listing_before IS DISTINCT FROM (SELECT md5(coalesce(string_agg((to_jsonb(l)-'status')::text,'' ORDER BY id),'')) FROM listings l)
 THEN RAISE EXCEPTION 'Unapproved row changes'; END IF;
END
$cleanup$;
COMMIT;
SELECT json_build_object('deleted_test_users',10,'inactive_test_users',4,'archived_test_providers',3,'inactive_test_listings',2,'financial_cases_untouched',5,'financial_history','UNCHANGED','inventory','UNCHANGED');
