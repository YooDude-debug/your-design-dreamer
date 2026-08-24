DROP INDEX IF EXISTS public.slang_tags_name_unique_ci;
ALTER TABLE public.slang_tags DROP CONSTRAINT IF EXISTS slang_tags_name_key;
DROP INDEX IF EXISTS public.slang_tags_name_key;