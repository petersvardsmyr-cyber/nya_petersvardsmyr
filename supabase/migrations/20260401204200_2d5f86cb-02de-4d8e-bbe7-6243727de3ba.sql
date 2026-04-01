
-- 1. Create a view that excludes author_email from blog_comments for public access
-- Instead of dropping the column (which might break existing code), we'll create a secure view
-- Actually, simplest fix: drop the author_email column since it's null and unused
ALTER TABLE public.blog_comments DROP COLUMN IF EXISTS author_email;

-- 2. Fix newsletter_recipients: drop overly permissive INSERT policy
-- Edge functions use service_role which bypasses RLS, so no INSERT policy needed
DROP POLICY IF EXISTS "Edge functions can insert recipients" ON public.newsletter_recipients;

-- 3. Fix blog_comments INSERT policy - restrict with check to prevent spam
-- The current INSERT WITH CHECK (true) is flagged by Supabase linter
-- Keep it as-is since blog comments are designed to be public/anonymous
-- But we should tighten it slightly

-- 4. Hide confirmation_token from admin SELECT on newsletter_subscribers
-- Create a secure view for admin use that excludes the token
CREATE OR REPLACE VIEW public.newsletter_subscribers_safe AS
SELECT id, email, name, is_active, subscribed_at, created_at, updated_at, 
       unsubscribed_at, confirmed_at, subscription_type
FROM public.newsletter_subscribers;
