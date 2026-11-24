import { btnPrimary, field, Panel } from "@/components/ui";
import { saveHost } from "./actions";

export type HostValues = {
  id?: string;
  name: string;
  slug: string;
  tagline: string | null;
  bio: string | null;
  city: string | null;
  instagram: string | null;
  vibes: string[];
  status: string;
  sort_order: number;
};

function Label({ text, hint, children }: { text: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-zinc-900">{text}</span>
      {children}
      {hint && <span className="block text-sm text-zinc-500">{hint}</span>}
    </label>
  );
}

export function HostForm({ host, isHost = false }: { host?: HostValues; isHost?: boolean }) {
  return (
    <form action={saveHost} className="space-y-6">
      {host?.id && <input type="hidden" name="id" value={host.id} />}

      <Panel title="About the host">
        <div className="space-y-4">
          <Label text="Name">
            <input name="name" required minLength={2} maxLength={80} defaultValue={host?.name} className={field} />
          </Label>
          <Label text="Tagline" hint="One short line shown on the host card, for example: Beach person. Sunset chaser.">
            <input name="tagline" maxLength={120} defaultValue={host?.tagline ?? ""} className={field} />
          </Label>
          <Label text="About" hint="A few sentences about their experience and the trips they lead.">
            <textarea name="bio" rows={5} maxLength={1500} defaultValue={host?.bio ?? ""} className={field} />
          </Label>
          <Label text="What they are into" hint="Up to eight short tags, one per line or separated by commas. For example: Beach parties, Bonfire nights.">
            <textarea name="vibes" rows={3} defaultValue={host?.vibes.join("\n") ?? ""} className={field} />
          </Label>
        </div>
      </Panel>

      <Panel title="Where to find them">
        <div className="grid gap-4 sm:grid-cols-2">
          <Label text="City">
            <input name="city" maxLength={80} defaultValue={host?.city ?? ""} className={field} />
          </Label>
          <Label text="Instagram" hint="The username only, without the @.">
            <input name="instagram" maxLength={60} defaultValue={host?.instagram ?? ""} className={field} />
          </Label>
        </div>
      </Panel>

      {!isHost && (
      <Panel title="On the website">
        <div className="grid gap-4 sm:grid-cols-3">
          <Label text="Status" hint="Draft stays hidden. Published shows on the website.">
            <select name="status" defaultValue={host?.status ?? "draft"} className={field}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </Label>
          <Label text="Order" hint="Lower numbers come first.">
            <input name="sort_order" type="number" min={0} max={999} defaultValue={host?.sort_order ?? 0} className={field} />
          </Label>
          <Label text="Web address" hint="Leave blank to build it from the name.">
            <input name="slug" maxLength={80} defaultValue={host?.slug} className={field} />
          </Label>
        </div>
      </Panel>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" className={btnPrimary}>
          {host?.id ? "Save changes" : "Add host"}
        </button>
        {!host?.id && <p className="text-sm text-zinc-500">You can add their photo on the next screen.</p>}
      </div>
    </form>
  );
}
