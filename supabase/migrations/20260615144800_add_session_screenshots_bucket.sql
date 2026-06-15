-- Create a new bucket for session screenshots if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-screenshots', 'session-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to the bucket so anyone can view the screenshots
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'session-screenshots');

-- Allow anon and authenticated users to upload screenshots
CREATE POLICY "Anon Uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'session-screenshots');

-- Allow users to update/overwrite screenshots
CREATE POLICY "Anon Updates"
ON storage.objects FOR UPDATE
USING (bucket_id = 'session-screenshots');
