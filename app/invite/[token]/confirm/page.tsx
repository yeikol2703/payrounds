import { redirect } from "next/navigation";

/** Magic-link invite confirmation is retired — finish joining on the invite page. */
export default async function InviteTokenConfirmRedirectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/invite/${encodeURIComponent(token)}`);
}
