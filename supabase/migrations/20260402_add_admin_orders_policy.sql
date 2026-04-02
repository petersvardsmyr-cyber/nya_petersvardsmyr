-- Lägg till explicit admin SELECT-policy för orders-tabellen.
-- Bakgrund: säkerhetsfixen i okt 2025 (migration 20251015143637) lade till
-- admin-policies för blog_posts, products, newsletter_subscribers och email_templates
-- men missade orders. Admin-åtkomst har fungerat via den breda
-- "Edge functions can manage orders" (FOR ALL USING true)-policyn, men
-- en explicit admin-policy är korrektare och mer robust.

CREATE POLICY "Admins can view all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
