import { LoginForm } from "@/components/LoginForm";

/** Login page — the `next` param is validated server-side in the action. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/fa";
  return <LoginForm next={next} />;
}
