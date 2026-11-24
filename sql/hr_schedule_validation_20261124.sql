BEGIN;
CREATE OR REPLACE FUNCTION public.validate_hr_schedule_row_v1()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
 p jsonb := NEW.change_payload;
 k text;
 ids uuid[];
 primary_id uuid;
BEGIN
 IF NEW.status <> 'pending' THEN RETURN NEW; END IF;
 IF NEW.effective_date <= (now() AT TIME ZONE 'Asia/Tokyo')::date THEN
 RAISE EXCEPTION '予約日は明日以降を指定してください';
 END IF;
 PERFORM 1 FROM public.employees WHERE id=NEW.employee_id AND is_active IS TRUE AND retirement_date IS NULL AND status IS DISTINCT FROM 'retired' AND status IS DISTINCT FROM 'past' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '対象社員が在籍していません'; END IF;
 IF EXISTS (SELECT 1 FROM public.employee_hr_scheduled_changes s WHERE s.employee_id=NEW.employee_id AND s.id<>NEW.id AND s.status IN ('pending','processing')) THEN
 RAISE EXCEPTION '未反映の予約があります。先に取消してください';
 END IF;
 FOREACH k IN ARRAY ARRAY['assignment_changed','title_changed','employment_changed'] LOOP
 IF jsonb_typeof(p->k) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION '変更区分が不正です: %',k; END IF;
 END LOOP;
 IF NOT ((p->>'assignment_changed')::boolean OR (p->>'title_changed')::boolean OR (p->>'employment_changed')::boolean) THEN RAISE EXCEPTION '変更内容がありません'; END IF;
 IF NULLIF(btrim(NEW.memo),'') IS NULL THEN RAISE EXCEPTION '変更理由を入力してください'; END IF;
 IF (p->>'assignment_changed')::boolean THEN
 IF NOT EXISTS (SELECT 1 FROM public.centers WHERE id=(p->>'center_id')::uuid) OR NOT EXISTS (SELECT 1 FROM public.divisions WHERE id=(p->>'division_id')::uuid) OR NOT EXISTS (SELECT 1 FROM public.positions WHERE id=(p->>'position_id')::uuid) THEN RAISE EXCEPTION '所属・部門・職種が不正です'; END IF;
 IF p->>'grade_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.grades WHERE id=(p->>'grade_id')::uuid) THEN RAISE EXCEPTION '等級が不正です'; END IF;
 END IF;
 IF (p->>'title_changed')::boolean THEN
 IF jsonb_typeof(p->'job_title_ids') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION '役職指定が不正です'; END IF;
 SELECT ARRAY(SELECT DISTINCT x::uuid FROM jsonb_array_elements_text(p->'job_title_ids') x) INTO ids;
 primary_id := (p->>'primary_job_title_id')::uuid;
 IF EXISTS (SELECT 1 FROM unnest(ids) x LEFT JOIN public.job_titles j ON j.id=x AND j.is_active=true WHERE j.id IS NULL) THEN RAISE EXCEPTION '無効な役職です'; END IF;
 IF (cardinality(ids)=0 AND primary_id IS NOT NULL) OR (cardinality(ids)>0 AND (primary_id IS NULL OR NOT(primary_id=ANY(ids)))) THEN RAISE EXCEPTION '代表役職が不正です'; END IF;
 END IF;
 IF (p->>'employment_changed')::boolean AND (p->>'employment_type' IS NULL OR p->>'employment_type' NOT IN ('正社員','準社員S','準社員A','準社員B','副社員')) THEN RAISE EXCEPTION '雇用区分が不正です'; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_hr_schedule_row_v1() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS validate_hr_schedule_row ON public.employee_hr_scheduled_changes;
CREATE TRIGGER validate_hr_schedule_row BEFORE INSERT ON public.employee_hr_scheduled_changes FOR EACH ROW EXECUTE FUNCTION public.validate_hr_schedule_row_v1();
COMMIT;
