BEGIN;
CREATE TABLE IF NOT EXISTS public.employee_employment_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
 effective_date date NOT NULL,
 previous_type text,
 employment_type text,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 recorded_by uuid REFERENCES auth.users(id),
 source text NOT NULL CHECK(source IN ('baseline','change'))
);
CREATE INDEX IF NOT EXISTS employee_employment_history_lookup ON public.employee_employment_history(employee_id,effective_date,recorded_at);
ALTER TABLE public.employee_employment_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employee_employment_history FROM PUBLIC,anon,authenticated;
-- Baseline establishes only the migration date, not the original hire date.
LOCK TABLE public.employees IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO public.employee_employment_history(employee_id,effective_date,employment_type,source)
SELECT e.id,(now() AT TIME ZONE 'Asia/Tokyo')::date,e.employment_type,'baseline'
FROM public.employees e
WHERE NOT EXISTS (SELECT 1 FROM public.employee_employment_history h WHERE h.employee_id=e.id);
CREATE OR REPLACE FUNCTION public.capture_employment_history_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='INSERT' THEN
 INSERT INTO public.employee_employment_history(employee_id,effective_date,employment_type,recorded_by,source)
 VALUES(NEW.id,(now() AT TIME ZONE 'Asia/Tokyo')::date,NEW.employment_type,auth.uid(),'baseline');
 ELSIF OLD.employment_type IS DISTINCT FROM NEW.employment_type THEN
 INSERT INTO public.employee_employment_history(employee_id,effective_date,previous_type,employment_type,recorded_by,source)
 VALUES(NEW.id,(now() AT TIME ZONE 'Asia/Tokyo')::date,OLD.employment_type,NEW.employment_type,auth.uid(),'change');
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.capture_employment_history_v1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS capture_employment_history ON public.employees;
CREATE TRIGGER capture_employment_history AFTER INSERT OR UPDATE OF employment_type ON public.employees FOR EACH ROW EXECUTE FUNCTION public.capture_employment_history_v1();
CREATE OR REPLACE FUNCTION public.list_employee_employment_history_v1(p_employee_id uuid)
RETURNS SETOF public.employee_employment_history LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM public.assert_hr_scheduler_access_v1();
 RETURN QUERY SELECT h.* FROM public.employee_employment_history h WHERE h.employee_id=p_employee_id ORDER BY h.effective_date,h.recorded_at,h.id;
END;
$$;
REVOKE ALL ON FUNCTION public.list_employee_employment_history_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.list_employee_employment_history_v1(uuid) TO authenticated;
COMMIT;
