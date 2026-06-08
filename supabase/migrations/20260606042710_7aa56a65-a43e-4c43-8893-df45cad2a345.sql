
CREATE POLICY "attach_read" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'incident-attachments' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'admin')
  )
);
CREATE POLICY "attach_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'incident-attachments' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "attach_delete" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'incident-attachments' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
  )
);
