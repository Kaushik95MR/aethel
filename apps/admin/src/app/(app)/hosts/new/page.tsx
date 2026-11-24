import { requireStaff } from "@/lib/auth";
import { serviceKeyConfigured } from "@/lib/supabase/service";
import { Flash, PageHeader } from "@/components/ui";
import { AddHostForm } from "../login-forms";

export default async function NewHostPage() {
  await requireStaff(["owner", "manager"]);
  const ready = serviceKeyConfigured();
  return (
    <>
      <PageHeader
        back={{ href: "/hosts", label: "Hosts" }}
        title="Add a host"
        description="You create the host's login. They sign in, choose their own password, set up two-step sign-in, then write their trips for you to review."
      />
      {!ready && (
        <Flash tone="error">
          Creating logins needs the database service key. Add SUPABASE_SERVICE_ROLE_KEY=your-key to apps/admin/.env.local (the key is in your Supabase
          dashboard under Project Settings, API), then restart the admin.
        </Flash>
      )}
      <AddHostForm />
    </>
  );
}
