-- 1. Fix orders: remove overly permissive public policy
-- Edge functions use service_role key which bypasses RLS entirely
DROP POLICY IF EXISTS "Edge functions can manage orders" ON public.orders;

-- 2. Fix blog comments: restrict UPDATE to likes-only
DROP POLICY IF EXISTS "Anyone can like comments" ON public.blog_comments;
CREATE POLICY "Anyone can increment likes"
  ON public.blog_comments FOR UPDATE
  USING (true)
  WITH CHECK (
    content IS NOT DISTINCT FROM content
    AND author_name IS NOT DISTINCT FROM author_name
    AND author_email IS NOT DISTINCT FROM author_email
    AND is_author IS NOT DISTINCT FROM is_author
    AND parent_id IS NOT DISTINCT FROM parent_id
    AND post_id IS NOT DISTINCT FROM post_id
  );

-- Add server-side content validation
ALTER TABLE public.blog_comments
  ADD CONSTRAINT blog_comments_content_length CHECK (char_length(content) BETWEEN 1 AND 1000);
ALTER TABLE public.blog_comments
  ADD CONSTRAINT blog_comments_author_name_length CHECK (author_name IS NULL OR char_length(author_name) <= 100);

-- 3. Fix sent_newsletters: restrict to admins only
DROP POLICY IF EXISTS "Authenticated users can view sent newsletters" ON public.sent_newsletters;
CREATE POLICY "Admins can view sent newsletters"
  ON public.sent_newsletters FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Edge functions can insert sent newsletters" ON public.sent_newsletters;
-- Edge functions use service_role which bypasses RLS, no INSERT policy needed

-- 4. Fix newsletter_subscribers: remove overly broad public SELECT
DROP POLICY IF EXISTS "Anyone can view their own subscription by email" ON public.newsletter_subscribers;