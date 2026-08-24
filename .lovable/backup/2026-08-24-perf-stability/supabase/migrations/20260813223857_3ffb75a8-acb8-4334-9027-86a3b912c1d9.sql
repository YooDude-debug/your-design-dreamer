INSERT INTO public.user_roles (user_id, role)
SELECT id, 'moderator'::public.app_role FROM public.profiles WHERE username = 'natasa_agr'
ON CONFLICT (user_id, role) DO NOTHING;