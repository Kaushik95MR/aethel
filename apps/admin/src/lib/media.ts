/** The public address of a file in storage. */
export const publicUrl = (m: { bucket: string; path: string }) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${m.bucket}/${m.path}`;
