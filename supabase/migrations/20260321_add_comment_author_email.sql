-- Lägg till valfritt e-postfält för svarsnotiser på bloggkommentarer
ALTER TABLE blog_comments ADD COLUMN author_email text;
