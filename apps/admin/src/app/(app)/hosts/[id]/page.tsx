import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { publicUrl } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, btn, btnDanger, Empty, Flash, PageHeader, Panel } from "@/components/ui";
import { ConfirmButton } from "../../catalogue/[id]/confirm-button";
import { deleteHost, removeHostPhoto, resetHostMfa, setHostLoginActive } from "../actions";
import { CreateLoginForm, ResetPasswordForm } from "../login-forms";
import { HostForm, type HostValues } from "../host-form";
import { PhotoUploader } from "./photo-uploader";

const MESSAGES: Record<string, { tone: "ok" | "error"; text: string }> = {
  saved: { tone: "ok", text: "Saved." },
  invalid: { tone: "error", text: "Check the fields and try again. The Instagram name can only use letters, numbers, dots and underscores." },
  slug_taken: { tone: "error", text: "Another host already uses that web address." },
  failed: { tone: "error", text: "Couldn't save. You may not have access." },
};

type Row = HostValues & {
  id: string;
  staff_id: string | null;
  is_sample: boolean;
  photo: { bucket: string; path: string } | null;
  departures: { id: string; start_date: string; end_date: string; status: string; package: { id: string; title: string } | null }[];
};

export default async function HostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const staff = await requireStaff(["owner", "manager", "content_editor", "host"]);
  const isHost = staff.role === "host";
  const canDelete = staff.role === "owner" || staff.role === "manager";
  const canManageLogin = canDelete;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const sp = await searchParams;
  const flash = sp.saved ? MESSAGES.saved : sp.error ? MESSAGES[sp.error] : undefined;

  const supabase = await createClient();
  const { data } = await supabase
    .from("hosts")
    .select(
      "id, slug, name, tagline, bio, city, instagram, vibes, status, sort_order, is_sample, staff_id, photo:media!photo_media_id(bucket, path), departures(id, start_date, end_date, status, package:packages(id, title))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const host = data as unknown as Row;
  // A host opens only their own profile. Other published hosts are readable by everyone, but not editable.
  if (isHost && host.staff_id !== staff.userId) notFound();
  const { data: login } = canManageLogin && host.staff_id ? await supabase.from("staff").select("active").eq("id", host.staff_id).maybeSingle() : { data: null };
  const dates = [...host.departures].sort((a, b) => a.start_date.localeCompare(b.start_date));

  return (
    <>
      <PageHeader
        back={{ href: "/hosts", label: "Hosts" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {host.name}
            <StatusBadge status={host.status} />
          </span>
        }
        description={isHost ? "This is how you appear on the website. An admin publishes your profile." : host.is_sample ? "A sample host used while the site is built. Edit and save to make them a real host." : `/${host.slug}`}
      />

      {flash && <Flash tone={flash.tone}>{flash.text}</Flash>}

      <Panel title="Photo">
        <div className="flex flex-wrap items-center gap-5">
          {host.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={publicUrl(host.photo)} alt="" className="size-28 rounded-xl object-cover" />
          ) : (
            <span className="grid size-28 place-items-center rounded-xl bg-zinc-100">
              <Avatar name={host.name} />
            </span>
          )}
          <div className="space-y-2">
            <p className="max-w-sm text-sm text-zinc-500">
              Use a clear, well-lit portrait of the host, and only a photo they have agreed to share. JPG, PNG, WebP or AVIF, up to 10 MB.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <PhotoUploader hostId={host.id} name={host.name} hasPhoto={!!host.photo} />
              {host.photo && (
                <form action={removeHostPhoto}>
                  <input type="hidden" name="id" value={host.id} />
                  <button type="submit" className={btnDanger}>
                    Remove photo
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </Panel>

      {canManageLogin && (
        <Panel title="Login">
          {!host.staff_id ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-500">This host has no login yet. Create one so they can sign in and write their trips.</p>
              <CreateLoginForm host={{ id: host.id, name: host.name }} />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500">
                {login?.active === false ? "The login is switched off, so this host cannot sign in." : "This host can sign in with their email and their own password, then a code from their authenticator app."}
              </p>
              <div className="flex flex-wrap items-start gap-3">
                <ResetPasswordForm hostId={host.id} />
                <form action={resetHostMfa}>
                  <input type="hidden" name="host_id" value={host.id} />
                  <ConfirmButton
                    message={`Reset two-step sign-in for ${host.name}? They will set up their authenticator app again the next time they sign in.`}
                    className={btn}
                  >
                    Reset two-step sign-in
                  </ConfirmButton>
                </form>
                <form action={setHostLoginActive}>
                  <input type="hidden" name="host_id" value={host.id} />
                  <input type="hidden" name="active" value={login?.active === false ? "true" : "false"} />
                  <ConfirmButton
                    message={login?.active === false ? `Switch ${host.name}'s login back on?` : `Switch off ${host.name}'s login? They will not be able to sign in.`}
                    className={login?.active === false ? btn : btnDanger}
                  >
                    {login?.active === false ? "Switch login on" : "Switch login off"}
                  </ConfirmButton>
                </form>
              </div>
            </div>
          )}
        </Panel>
      )}

      <HostForm host={host} isHost={isHost} />

      <Panel title="Trip dates with this host">
        {dates.length === 0 ? (
          <Empty>No dates yet. Open a trip, go to Dates and choose this host on a date.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {dates.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>
                  <span className="block font-medium text-zinc-900">{d.package?.title ?? "Trip"}</span>
                  <span className="block text-sm text-zinc-500">
                    {formatDate(d.start_date)} to {formatDate(d.end_date)}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <StatusBadge status={d.status} />
                  {d.package && (
                    <Link href={`/catalogue/${d.package.id}?tab=dates`} className={btn}>
                      Open dates
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {canDelete && (
        <form className="pt-2">
          <input type="hidden" name="id" value={host.id} />
          <ConfirmButton
            formAction={deleteHost}
            message={`Delete ${host.name}? Their trip dates are kept with no host. This can't be undone.`}
            className={btnDanger}
          >
            Delete this host
          </ConfirmButton>
        </form>
      )}
    </>
  );
}
