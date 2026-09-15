# Payment proof fixtures for local / Playwright testing

| File | Use |
|------|-----|
| `sinpe.jpg` | Sample SINPE / transfer screenshot for member upload |

In the app: Member → Pay → choose a missing payment → upload `test/sinpe.jpg`.
Owner gets a `proof_uploaded` notification → opens the subscription → Review → Confirm or Decline.
Decline sets payment back to missing, clears the proof, and notifies the member.
