-- 1. Fix newsletter_send_status SELECT policy: scope to authenticated instead of public
DROP POLICY IF EXISTS "Admins can view newsletter send status" ON public.newsletter_send_status;
CREATE POLICY "Admins can view newsletter send status" ON public.newsletter_send_status
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Add explicit admin-only UPDATE policy on user_roles to prevent future drift
CREATE POLICY "Only admins can update roles" ON public.user_roles
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));