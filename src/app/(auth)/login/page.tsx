import type { Metadata } from "next";
import { LoginCard } from "./login-card";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/lists";
  const error = typeof params.error === "string" ? params.error : undefined;
  return <LoginCard next={next} error={error} />;
}
