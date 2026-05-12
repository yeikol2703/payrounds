import { redirect } from "next/navigation";

/** Deep links go to the unified member pay hub. */
export default function PaySubIdRedirectPage() {
  redirect("/pay");
}
