"use client";

import { getAuth } from "firebase/auth";
import { voidPendingInvitesForSubscription } from "@/app/actions/invites";
import { cancelSubscription, getMembers } from "@/lib/firestore/subscriptions";
import { createNotification } from "@/lib/firestore/notifications";
import { toCycleId } from "@/lib/firestore/cycles";

/**
 * Soft-cancel a subscription: void pending invites, mark cancelled, notify members.
 */
export async function cancelSubscriptionFully(input: {
  subId: string;
  subName: string;
  ownerUid: string;
  ownerDisplayName: string;
}): Promise<void> {
  const { subId, subName, ownerUid, ownerDisplayName } = input;
  const members = await getMembers(subId);
  const idToken = await getAuth().currentUser?.getIdToken(true);
  let pendingInviteeUids: string[] = [];
  if (idToken) {
    try {
      const voided = await voidPendingInvitesForSubscription(idToken, subId);
      pendingInviteeUids = voided.inviteeUids;
    } catch (err) {
      console.warn("void pending invites failed", err);
    }
  }

  await cancelSubscription(subId);
  const cycleId = toCycleId(new Date());
  const notifyUids = new Set([
    ...members.map((m) => m.uid),
    ...pendingInviteeUids,
  ]);
  await Promise.all(
    [...notifyUids].map((uid) =>
      createNotification({
        recipientUid: uid,
        type: "subscription_cancelled",
        subId,
        subName,
        cycleId,
        fromUid: ownerUid,
        fromDisplayName: ownerDisplayName,
      }).catch((err) => {
        console.warn("cancel notification failed", uid, err);
      }),
    ),
  );
}
