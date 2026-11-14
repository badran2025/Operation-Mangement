-- Admin can delete ticket attachments (cleanup / mistakes)
create policy ticket_files_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ticket-files' and public.is_admin());
create policy tatt_admin_delete on public.ticket_attachments for delete to authenticated
  using (public.is_admin());
