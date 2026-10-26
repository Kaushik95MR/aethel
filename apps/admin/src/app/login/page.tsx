import { Suspense } from "react";
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
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <form action={signIn} className="w-full max-w-sm space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
        <div>
          <h1 className="text-lg font-medium">Staff sign in</h1>
          <p className="text-sm text-zinc-500">Access is by invitation only.</p>
        </div>
        {message && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {message}
          </p>
        )}
        <label className="block text-sm">
          Email
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <button type="submit" className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800">
          Continue
        </button>
      </form>
    </main>
  );
}
