import Link from "next/link";
export const PAGE_SIZE = 25;

export function parsePage(value: string | undefined): number {
  const n = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10_000) : 1;
}

export function Pagination({
  page,
  total,
  basePath,
  params,
}: {
  page: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  return (
    <div className="flex items-center justify-between pt-3 text-sm text-zinc-600">
      <span>
        {total === 0 ? "No results" : `Page ${page} of ${pages} · ${total} total`}
      </span>
      <div className="flex gap-3">
        {page > 1 && <Link href={href(page - 1)} className="underline">Previous</Link>}
        {page < pages && <Link href={href(page + 1)} className="underline">Next</Link>}
      </div>
    </div>
  );
}
