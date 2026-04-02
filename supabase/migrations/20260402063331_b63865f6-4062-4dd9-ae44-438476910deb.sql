
-- 1. Fix blog_comments INSERT: prevent is_author impersonation
DROP POLICY IF EXISTS "Anyone can add comments" ON public.blog_comments;
CREATE POLICY "Anyone can add comments" ON public.blog_comments
FOR INSERT TO public
WITH CHECK (
  (is_author = false OR is_author IS NULL) OR has_role(auth.uid(), 'admin'::app_role)
);

-- 2. Add explicit admin-only INSERT/DELETE policies on user_roles
CREATE POLICY "Only admins can insert roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete roles" ON public.user_roles
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
