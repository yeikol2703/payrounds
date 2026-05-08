import type { Timestamp } from "firebase/firestore";

// ─── Users ────────────────────────────────────────────────────────────────────

export type UserRole = "owner" | "member";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: Timestamp;
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export type SubscriptionStatus = "active" | "cancelled";

export interface Subscription {
  id: string;
  ownerId: string;
  name: string;
  /** Total subscription cost for the period (same currency as members’ `amountOwed`). */
  totalCost: number;
  /** Day of month payment is due (1–28). */
  dueDayOfMonth: number;
  status: SubscriptionStatus;
  createdAt: Timestamp;
}

// ─── Members (subcollection of Subscription) ──────────────────────────────────

export interface Member {
  uid: string;
  email: string;
  displayName: string;
  /** Snapshot of `totalCost ÷ (memberCount + 1)` when last recalculated. */
  amountOwed: number;
  joinedAt: Timestamp;
}

// ─── Cycles (subcollection of Subscription) ─────────────────────────────────────

export type CycleStatus = "open" | "success" | "closed_with_issues";

export interface Cycle {
  /** `"YYYY-MM"` — document id. */
  id: string;
  status: CycleStatus;
  dueDate: Timestamp;
  closedAt: Timestamp | null;
  closedBy: string | null;
}

// ─── Payments (subcollection of Cycle) ────────────────────────────────────────

export type PaymentStatus = "missing" | "pending_review" | "confirmed";

export interface Payment {
  /** Document id = member uid. */
  uid: string;
  status: PaymentStatus;
  proofImagePath: string | null;
  proofUploadedAt: Timestamp | null;
  confirmedAt: Timestamp | null;
  rejectionNote: string | null;
  /** Snapshot of member’s `amountOwed` at cycle creation. */
  amount: number;
}

// ─── Notifications (subcollection of User) ────────────────────────────────────

export type NotificationType =
  | "proof_uploaded"
  | "payment_confirmed"
  | "payment_rejected"
  | "deadline_reminder"
  | "cycle_closed";

export interface AppNotification {
  id: string;
  type: NotificationType;
  subId: string;
  subName: string;
  cycleId: string;
  fromUid: string;
  fromDisplayName: string;
  read: boolean;
  createdAt: Timestamp;
  /** Owner rejection text for `payment_rejected`, etc. */
  detail?: string | null;
}

// ─── Composite / UI types ─────────────────────────────────────────────────────

export interface SubscriptionWithMembers extends Subscription {
  members: Member[];
}

export interface CycleWithPayments extends Cycle {
  payments: Payment[];
}

export interface PaymentWithMember extends Payment {
  displayName: string;
  email: string;
}

/** Invite document at `/invites/{token}` (document id === `token`). */
export interface PendingInvite {
  id: string;
  token: string;
  subId: string;
  subName: string;
  invitedEmail: string;
  ownerId: string;
  ownerDisplayName: string;
  expiresAt: Timestamp;
  accepted: boolean;
}
