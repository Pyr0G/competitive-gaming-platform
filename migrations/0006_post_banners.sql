ALTER TABLE posts ADD COLUMN banner_url TEXT CHECK(
  banner_url IS NULL
  OR (
    length(banner_url) BETWEEN 12 AND 500
    AND banner_url LIKE 'https://%'
  )
);
