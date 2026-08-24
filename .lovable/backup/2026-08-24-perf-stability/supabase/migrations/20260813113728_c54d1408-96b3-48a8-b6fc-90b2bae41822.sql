CREATE TABLE IF NOT EXISTS public._sec_test_log(seq serial, note text);

DO $$
DECLARE a uuid; b uuid; u uuid; cid uuid;
BEGIN
  SELECT p.id INTO a FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id WHERE r.role IN ('business','creator','admin') LIMIT 1;
  SELECT p.id INTO b FROM public.profiles p WHERE p.id <> a LIMIT 1;
  SELECT p.id INTO u FROM public.profiles p WHERE p.id NOT IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin','business','creator')) LIMIT 1;
  INSERT INTO public._sec_test_log(note) VALUES (format('actors A=%s B=%s U=%s', a, b, u));

  PERFORM set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);

  INSERT INTO public.arena_challenges(company_id,company_name,logo_url,title,description,category,target_audience,terms,region,prize,status,starts_at)
  VALUES (a,'FAKE Coca-Cola','http://evil/logo.png','SECTEST1','d','c','t','tt','r','p','active',now()) RETURNING id INTO cid;
  INSERT INTO public._sec_test_log(note)
  SELECT format('T1 own-challenge created: name=%s logo=%s ownerIsSelf=%s', company_name, coalesce(logo_url,'NULL'), company_id=a)
  FROM public.arena_challenges WHERE id=cid;

  BEGIN
    INSERT INTO public.arena_challenges(company_id,company_name,title,description,category,target_audience,terms,region,prize,status,starts_at)
    VALUES (b,'B Corp','SECTEST2','d','c','t','tt','r','p','active',now());
    INSERT INTO public._sec_test_log(note)
    SELECT format('T2 foreign company_id was rewritten to own account: ownerIsSelf=%s name=%s', company_id=a, company_name)
    FROM public.arena_challenges WHERE title='SECTEST2';
  EXCEPTION WHEN others THEN
    INSERT INTO public._sec_test_log(note) VALUES ('T2 blocked: '||SQLERRM);
  END;

  BEGIN
    UPDATE public.arena_challenges SET company_id=b WHERE id=cid;
    INSERT INTO public._sec_test_log(note) VALUES ('T3 FAIL company_id changed');
  EXCEPTION WHEN others THEN
    INSERT INTO public._sec_test_log(note) VALUES ('T3 blocked: '||SQLERRM);
  END;

  UPDATE public.arena_challenges SET company_name='Nike Inc', logo_url='http://evil/nike.png' WHERE id=cid;
  INSERT INTO public._sec_test_log(note)
  SELECT format('T3b rename attempt result: name=%s logo=%s', company_name, coalesce(logo_url,'NULL'))
  FROM public.arena_challenges WHERE id=cid;

  UPDATE public.arena_challenges SET status='closed' WHERE id=cid;
  INSERT INTO public._sec_test_log(note)
  SELECT format('T5 legit update ok: status=%s', status) FROM public.arena_challenges WHERE id=cid;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true);
  BEGIN
    INSERT INTO public.arena_challenges(company_id,company_name,title,description,category,target_audience,terms,region,prize,status,starts_at)
    VALUES (u,'My Co','SECTEST4','d','c','t','tt','r','p','active',now());
    INSERT INTO public._sec_test_log(note) VALUES ('T4 FAIL normal user created challenge');
  EXCEPTION WHEN others THEN
    INSERT INTO public._sec_test_log(note) VALUES ('T4 blocked: '||SQLERRM);
  END;

  PERFORM set_config('request.jwt.claims','',true);
  DELETE FROM public.arena_challenges WHERE title LIKE 'SECTEST%';
END $$;