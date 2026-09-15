/**
 * Seed Auth + Firestore emulators via HTTP REST (avoids Node gRPC ↔ Docker issues on Windows).
 */
const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-payround";
const AUTH =
  "http://" +
  (process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099").replace(
    /^https?:\/\//,
    "",
  );
const FS =
  "http://" +
  (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8181").replace(
    /^https?:\/\//,
    "",
  );

const OWNER_EMAIL = "owner@payround.test";
const MEMBER_EMAIL = "member@payround.test";
const PASSWORD = "testpass123";

async function signUp(email, password) {
  const res = await fetch(
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    },
  );
  const data = await res.json();
  if (data.error) {
    // already exists → sign in
    const signIn = await fetch(
      `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      },
    );
    const signed = await signIn.json();
    if (signed.error) {
      throw new Error(JSON.stringify(signed.error));
    }
    return { localId: signed.localId, idToken: signed.idToken };
  }
  return { localId: data.localId, idToken: data.idToken };
}

async function updateDisplayName(idToken, displayName) {
  await fetch(
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:update?key=demo`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, displayName, returnSecureToken: true }),
    },
  );
}

function str(v) {
  return { stringValue: String(v) };
}
function num(v) {
  return { doubleValue: Number(v) };
}
function int(v) {
  return { integerValue: String(v) };
}
function nullVal() {
  return { nullValue: null };
}
function ts(date = new Date()) {
  return { timestampValue: date.toISOString() };
}

async function upsertDoc(path, fields) {
  // path like users/abc or subscriptions/x/members/y
  const parts = path.split("/");
  const docId = parts.pop();
  const collectionPath = parts.join("/");
  const url = `${FS}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath}?documentId=${encodeURIComponent(docId)}`;
  // Emulator admin bypass — rules still apply for the real app / Playwright client.
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer owner",
    },
    body: JSON.stringify({ fields }),
  });
  if (res.status === 409) {
    // already exists → PATCH
    const patchUrl = `${FS}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
    const patch = await fetch(patchUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer owner",
      },
      body: JSON.stringify({ fields }),
    });
    if (!patch.ok) {
      throw new Error(
        `Firestore patch ${path} failed: ${patch.status} ${await patch.text()}`,
      );
    }
    return;
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore write ${path} failed: ${res.status} ${text}`);
  }
}

async function main() {
  console.log("Seeding via REST", { PROJECT_ID, AUTH, FS });

  const owner = await signUp(OWNER_EMAIL, PASSWORD);
  await updateDisplayName(owner.idToken, "Owner Gon");
  console.log("owner", owner.localId);

  const member = await signUp(MEMBER_EMAIL, PASSWORD);
  await updateDisplayName(member.idToken, "Friend Mel");
  console.log("member", member.localId);

  await upsertDoc(`users/${owner.localId}`, {
    uid: str(owner.localId),
    email: str(OWNER_EMAIL),
    displayName: str("Owner Gon"),
    role: str("member"),
    createdAt: ts(),
  });
  await upsertDoc(`users/${member.localId}`, {
    uid: str(member.localId),
    email: str(MEMBER_EMAIL),
    displayName: str("Friend Mel"),
    role: str("member"),
    createdAt: ts(),
  });

  const subId = "sub-demo-netflix";
  await upsertDoc(`subscriptions/${subId}`, {
    ownerId: str(owner.localId),
    name: str("Netflix Shared"),
    totalCost: num(15.99),
    dueDayOfMonth: int(15),
    status: str("active"),
    createdAt: ts(),
  });

  const amountOwed = Number((15.99 / 2).toFixed(2));
  await upsertDoc(`subscriptions/${subId}/members/${member.localId}`, {
    uid: str(member.localId),
    email: str(MEMBER_EMAIL),
    displayName: str("Friend Mel"),
    amountOwed: num(amountOwed),
    joinedAt: ts(),
  });

  const now = new Date();
  const cycleId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  await upsertDoc(`subscriptions/${subId}/cycles/${cycleId}`, {
    status: str("open"),
    dueDate: ts(new Date(now.getFullYear(), now.getMonth(), 15)),
    closedAt: nullVal(),
    closedBy: nullVal(),
  });
  await upsertDoc(
    `subscriptions/${subId}/cycles/${cycleId}/payments/${member.localId}`,
    {
      uid: str(member.localId),
      status: str("missing"),
      proofImagePath: nullVal(),
      proofUploadedAt: nullVal(),
      confirmedAt: nullVal(),
      rejectionNote: nullVal(),
      amount: num(amountOwed),
    },
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        owner: { email: OWNER_EMAIL, uid: owner.localId, password: PASSWORD },
        member: {
          email: MEMBER_EMAIL,
          uid: member.localId,
          password: PASSWORD,
        },
        subscriptionId: subId,
        cycleId,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
