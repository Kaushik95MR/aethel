import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { btnPrimary, field, Flash } from "@/components/ui";
import { signIn } from "./actions";

const MESSAGES: Record<string, string> = {
  invalid: "That email or password didn't work. Try again.",
  not_staff: "This account doesn't have staff access. Ask an owner to invite you.",
};

type Props = { searchParams: Promise<{ error?: string }> };

export default function LoginPage({ searchParams }: Props) {
  return (
    <Suspense>
      <LoginForm searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginForm({ searchParams }: Props) {
  const { error } = await searchParams;
  const message = error ? MESSAGES[error] : undefined;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <Brand />
      <form action={signIn} className="w-full max-w-sm space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
        <div>
          <h1 className="font-display text-xl font-semibold">Staff sign in</h1>
          <p className="text-sm text-zinc-500">Access is by invitation only.</p>
        </div>
        {message && <Flash tone="error">{message}</Flash>}
        <label className="block space-y-1.5 text-sm font-medium">
          Email
          <input name="email" type="email" autoComplete="username" required className={`${field} font-normal`} />
        </label>
        <label className="block space-y-1.5 text-sm font-medium">
          Password
          <input name="password" type="password" autoComplete="current-password" required className={`${field} font-normal`} />
        </label>
        <button type="submit" className={`${btnPrimary} w-full`}>
          Continue
        </button>
      </form>
    </main>
  );
}
