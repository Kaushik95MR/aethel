import { requireStaff } from "@/lib/auth";
import { Flash, PageHeader } from "@/components/ui";
import { PackageForm } from "../package-form";

const ERRORS: Record<string, string> = {
  invalid: "Check the fields: a title, a valid web address and a price in rupees are needed.",
  slug_taken: "Another package already uses that web address. Pick a different one.",
  failed: "Couldn't create the package. You may not have access.",
};

export default async function NewPackagePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireStaff(["owner", "manager", "content_editor"]);
  const { error } = await searchParams;

  return (
    <>
      <PageHeader
        back={{ href: "/catalogue", label: "Catalogue" }}
        title="New package"
        description="It stays hidden until you publish it. We set up a starter itinerary and look for photos once it is created."
      />
      {error && ERRORS[error] && <Flash tone="error">{ERRORS[error]}</Flash>}
      <PackageForm />
    </>
  );
}
