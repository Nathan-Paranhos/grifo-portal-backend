import { redirect } from "next/navigation";

export default async function Home() {
  // Auth removed: land on dashboard by default
  redirect("/dashboard");
}
