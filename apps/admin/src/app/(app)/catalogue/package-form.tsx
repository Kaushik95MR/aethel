import { btnPrimary, field, Panel } from "@/components/ui";
import { savePackage } from "./actions";
import { CATEGORIES } from "./categories";

export type PackageValues = {
  tags?: string[];
  id?: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  duration_days: number;
  base_price_paise: number | string | null;
  price_note: string | null;
  inclusions: string[];
  exclusions: string[];
  highlights: string[];
  is_domestic: boolean;
  status: string;
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

export function PackageForm({ pkg }: { pkg?: PackageValues }) {
  const rupees = pkg?.base_price_paise != null ? String(Number(pkg.base_price_paise) / 100) : "";
  return (
    <form action={savePackage} className="space-y-6">
      {pkg?.id && <input type="hidden" name="id" value={pkg.id} />}

      <Panel title="About the trip">
        <div className="space-y-4">
          <Label text="Title">
            <input name="title" required minLength={2} maxLength={120} defaultValue={pkg?.title} className={field} />
          </Label>
          <Label text="Short summary" hint="One or two sentences shown on the package card.">
            <textarea name="summary" rows={2} maxLength={300} defaultValue={pkg?.summary ?? ""} className={field} />
          </Label>
          <Label text="Description">
            <textarea name="description" rows={5} maxLength={5000} defaultValue={pkg?.description ?? ""} className={field} />
          </Label>
        </div>
      </Panel>

      <Panel title="Who is this trip for?">
        <p className="mb-3 text-sm text-zinc-500">Pick every kind that fits. The trip shows under each one on the website.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {CATEGORIES.map((c) => (
            <label key={c.slug} className="flex items-start gap-2.5 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm">
              <input type="checkbox" name="categories" value={c.slug} defaultChecked={pkg?.tags?.includes(c.slug)} className="mt-0.5 size-4" />
              <span>
                <span className="block font-medium text-zinc-900">{c.name}</span>
                <span className="block text-zinc-500">{c.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </Panel>

      <Panel title="Length, price and visibility">
        <div className="grid gap-4 sm:grid-cols-3">
          <Label text="Days">
            <input name="duration_days" type="number" min={1} max={60} required defaultValue={pkg?.duration_days ?? 3} className={field} />
          </Label>
          <Label text="Price per person (₹)">
            <input name="price" inputMode="decimal" defaultValue={rupees} className={field} />
          </Label>
          <Label text="Status" hint="Draft stays hidden. Published shows on the website.">
            <select name="status" defaultValue={pkg?.status ?? "draft"} className={field}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </Label>
        </div>
        <div className="mt-4">
          <Label text="Price note" hint="For example: from Bengaluru, per person on twin sharing.">
            <input name="price_note" maxLength={200} defaultValue={pkg?.price_note ?? ""} className={field} />
          </Label>
        </div>
      </Panel>

      <Panel title="What's included">
        <div className="grid gap-4 md:grid-cols-3">
          <Label text="Included" hint="One item per line.">
            <textarea name="inclusions" rows={6} defaultValue={pkg?.inclusions.join("\n")} className={field} />
          </Label>
          <Label text="Not included" hint="One item per line.">
            <textarea name="exclusions" rows={6} defaultValue={pkg?.exclusions.join("\n")} className={field} />
          </Label>
          <Label text="Highlights" hint="Short points shown as tags.">
            <textarea name="highlights" rows={6} defaultValue={pkg?.highlights.join("\n")} className={field} />
          </Label>
        </div>
      </Panel>

      <details className="rounded-xl border border-zinc-200 bg-white">
        <summary className="flex items-center justify-between px-5 py-4 text-base font-semibold text-zinc-900">
          Web address and more
          <span className="text-sm font-normal text-zinc-500">Usually left as it is</span>
        </summary>
        <div className="space-y-4 border-t border-zinc-100 px-5 py-4">
          <Label text="Web address" hint="Lowercase words joined by dashes. Leave blank to build it from the title.">
            <input name="slug" maxLength={80} defaultValue={pkg?.slug} className={field} />
          </Label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_domestic" defaultChecked={pkg?.is_domestic ?? true} className="size-4" />
            <span>Trip within India</span>
          </label>
        </div>
      </details>

      <div className="flex items-center gap-3">
        <button type="submit" className={btnPrimary}>
          {pkg?.id ? "Save changes" : "Create package"}
        </button>
        {!pkg?.id && <p className="text-sm text-zinc-500">A starter itinerary is created for you.</p>}
      </div>
    </form>
  );
}
