-- Rename nip to nuptk in teachers table
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'teachers' AND column_name = 'nip') THEN
    ALTER TABLE public.teachers RENAME COLUMN nip TO nuptk;
  END IF;
END $$;

-- Make sure nuptk is unique
ALTER TABLE public.teachers ADD CONSTRAINT teachers_nuptk_key UNIQUE (nuptk);
