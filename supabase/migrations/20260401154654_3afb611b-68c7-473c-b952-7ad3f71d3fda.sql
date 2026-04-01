-- 1. Fix newsletter_send_status: remove overly permissive public ALL policy
DROP POLICY IF EXISTS "Service role can manage newsletter send status" ON public.newsletter_send_status;

-- 2. Fix blog comments: replace UPDATE policy with secure RPC
DROP POLICY IF EXISTS "Anyone can increment likes" ON public.blog_comments;

-- Remove direct UPDATE for public users entirely
-- No UPDATE policy needed - likes go through RPC now

CREATE OR REPLACE FUNCTION public.increment_comment_likes(comment_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE blog_comments SET likes = likes + 1 WHERE id = comment_id;
$$;

-- Add likes non-negative constraint
ALTER TABLE public.blog_comments
  DROP CONSTRAINT IF EXISTS likes_non_negative;
ALTER TABLE public.blog_comments
  ADD CONSTRAINT likes_non_negative CHECK (likes >= 0);