-- Flagga för att markera kommentarer skrivna av bloggförfattaren/admin
ALTER TABLE blog_comments ADD COLUMN is_author boolean DEFAULT false;
