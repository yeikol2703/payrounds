import { redirect } from "next/navigation";

/** Legacy /account → /settings */
export default function AccountRedirectPage() {
  redirect("/settings");
}
