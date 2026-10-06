import { Anchor } from "lucide-react";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/utils";
import { getAuth } from "@/server/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getAuth()) redirect("/app");
  const { next } = await searchParams;
  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_28rem]">
      <section className="relative hidden overflow-hidden bg-navy-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2.5 text-lg font-semibold">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-500"><Anchor className="size-5" aria-hidden /></span>
          {APP_NAME}
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">Passengers, vehicles and cargo — one booking, one manifest.</h2>
          <p className="mt-4 text-brand-200">Sell at the ticket desk even when the signal drops. Everything syncs when you&apos;re back online.</p>
        </div>
        <p className="text-sm text-brand-300/70">Built for ferry and freight operators.</p>
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-40 size-[28rem] rounded-full bg-brand-500/15" />
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mb-6 mt-1 text-sm text-muted">Sign in to your {APP_NAME} account.</p>
          <LoginForm next={typeof next === "string" ? next : undefined} />
        </div>
      </section>
    </main>
  );
}
