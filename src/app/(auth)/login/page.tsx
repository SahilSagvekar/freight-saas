import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/utils";
import { getAuth } from "@/server/auth";
import { AuthShell } from "../auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; set?: string | string[] }> }) {
  if (await getAuth()) redirect("/app");
  const { next, set } = await searchParams;
  return (
    <AuthShell title="Welcome back" subtitle={`Sign in to your ${APP_NAME} account.`}>
      <LoginForm next={typeof next === "string" ? next : undefined} notice={set === "1" ? "Your password is saved. Sign in with it below." : undefined} />
    </AuthShell>
  );
}
