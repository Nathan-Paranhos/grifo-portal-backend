import { redirect } from "next/navigation";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Home() {
  // Auth removed: land on dashboard by default
  redirect("/dashboard");
}
