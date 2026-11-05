import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent text-white">
            <svg viewBox="0 0 64 64" className="size-9" fill="currentColor"><path d="M14 46V28l18-12 18 12v18H38V34H26v12z" /></svg>
          </div>
          <h1 className="text-2xl font-semibold">Maratha Mandal Mulund</h1>
          <p className="text-sm text-muted">Hall booking office · हॉल बुकिंग कार्यालय</p>
        </div>
        <LoginForm next={next} />
        <p className="mt-6 text-center text-xs text-muted">
          Staff accounts are created by the administrator. Forgot your password? Ask the admin to reset it.
        </p>
      </div>
    </main>
  );
}
