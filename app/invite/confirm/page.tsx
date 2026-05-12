import { redirect } from "next/navigation";

/** Magic-link completion URL is retired; members use email + password on `/login`. */
export default function InviteConfirmRedirectPage() {
  redirect("/login");
}
