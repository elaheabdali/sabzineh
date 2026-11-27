import { RegisterForm } from "@/components/RegisterForm";

/** Customer registration page. */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/fa";
  return <RegisterForm next={next} />;
}
