import { redirect } from "next/navigation";

/** Deep links go to the unified member pay hub. */
export default async function PaySubIdRedirectPage() {
  redirect("/pay");
}
