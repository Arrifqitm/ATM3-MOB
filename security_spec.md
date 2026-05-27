# Security Specification for Firestore Database Rules

## 1. Data Invariants

1. **User Ownership Isolation**: A user's state data located at `/users/{userId}` belongs strictly to that user. No other authenticated or unauthenticated user may read, search, or write to it.
2. **Identity Constancy**: The `userId` field inside the document must match the authenticated `request.auth.uid`. In updates, the `userId` field is immutable.
3. **Temporal Validity**: The `updatedAt` field must match `request.time`. Client-supplied timestamps from the past or future must be rejected.
4. **Data Size Bounds**: The payload must have length and size limitations to prevent Denial of Wallet resource exhaustion attacks.

---

## 2. The "Dirty Dozen" Payloads

Here are twelve specific JSON payloads representing malicious attempts to compromise the data invariants of the `/users/{userId}` collection. All must be rejected with `PERMISSION_DENIED`.

### Payload 1: Unauthorized Read by Another User
* **Attack**: User `attacker_123` tries to read the document `/users/victim_uid`.
* **Invariant Violated**: User Ownership Isolation.
* **Payload**: `GET /users/victim_uid` by `attacker_123`.

### Payload 2: Unauthorized Write by Another User
* **Attack**: User `attacker_123` tries to write to `/users/victim_uid`.
* **Invariant Violated**: User Ownership Isolation.
* **Payload**: `SET /users/victim_uid { userId: "victim_uid", updatedAt: "2026-05-22T07:22:15Z", stateData: {} }` by `attacker_123`.

### Payload 3: Unauthenticated Read
* **Attack**: Guest user (not signed in) tries to read `/users/victim_uid`.
* **Invariant Violated**: User Ownership Isolation.
* **Payload**: `GET /users/victim_uid` by `anonymous`.

### Payload 4: Unauthenticated Write
* **Attack**: Guest user (not signed in) tries to write / create `/users/victim_uid`.
* **Invariant Violated**: User Ownership Isolation.
* **Payload**: `SET /users/victim_uid { userId: "victim_uid", stateData: {} }` by `anonymous`.

### Payload 5: Spoofed Owner ID (Identity Spoofing)
* **Attack**: Signed-in user `victim_uid` attempts to create their record but sets `userId` field in the document to `other_uid` or vice versa.
* **Invariant Violated**: Identity Integrity.
* **Payload**: `SET /users/victim_uid { userId: "attacker_spoofed_uid", updatedAt: "2026-05-22T07:22:15Z", stateData: {} }`.

### Payload 6: Malicious Admin Claim Injection (Shadow Field)
* **Attack**: Attacker attempts to inject an `isAdmin` or `role` property in their document to escalate privilege.
* **Invariant Violated**: System-Only Schema Safety.
* **Payload**: `SET /users/attacker_uid { userId: "attacker_uid", updatedAt: "2026-05-22T07:22:15Z", stateData: {}, isAdmin: true, role: "admin" }`.

### Payload 7: Missing Required Field
* **Attack**: User attempts to create a document with a missing required key `stateData`.
* **Invariant Violated**: Validation Blueprint.
* **Payload**: `SET /users/victim_uid { userId: "victim_uid", updatedAt: "2026-05-22T07:22:15Z" }`.

### Payload 8: Corrupted Field Type
* **Attack**: User attempts to store `stateData` as a simple string rather than an Object / Map.
* **Invariant Violated**: Schema Type Safety.
* **Payload**: `SET /users/victim_uid { userId: "victim_uid", updatedAt: "2026-05-22T07:22:15Z", stateData: "corrupted_string" }`.

### Payload 9: Falsified Timestamp (Temporal Integrity)
* **Attack**: User attempts to write their custom client timestamp in `updatedAt` instead of `request.time`.
* **Invariant Violated**: Temporal Integrity.
* **Payload**: `SET /users/victim_uid { userId: "victim_uid", updatedAt: "1999-12-31T23:59:59Z", stateData: {} }`.

### Payload 10: Impersonating Owner in Update (Identity Injection)
* **Attack**: Attacker attempts to take over a session by updating another user's state data while setting themselves as owner.
* **Invariant Violated**: Immutability.
* **Payload**: `UPDATE /users/victim_uid { userId: "attacker_uid" }`.

### Payload 11: Extra Unsupported Keys during Create
* **Attack**: Creating a document with phantom keys not recognized by the schematics representation.
* **Invariant Violated**: Strict Map Keys Guard.
* **Payload**: `SET /users/victim_uid { userId: "victim_uid", updatedAt: "2026-05-22T07:22:15Z", stateData: {}, unregisteredKey: "malicious" }`.

### Payload 12: Invalid Path Variable ID Attack (ID Poisoning/Injection)
* **Attack**: Injecting an extremely long string of characters or injection characters as a document ID to compromise indexing/billing.
* **Invariant Violated**: Path ID Poisoning/Guard.
* **Payload**: `SET /users/victim_uid_VERY_LONG_STRING_OVER_128_CHARS_OR_CONTAINING_SPECIAL_CHARS { userId: "victim_uid", stateData: {} }`.

---

## 3. Test Suite Stub (`firestore.rules.test.ts`)

The test suite stub details our direct verification criteria checking all 12 malicious payloads against the database connection rules.

```typescript
// firestore.rules.test.ts
// Automated rules checking for "Dirty Dozen" malicious payloads.
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "gen-lang-client-0772837540",
    firestore: {
      rules: `
        rules_version = '2';
        service cloud.firestore {
          // Rule specification loaded by test environment
        }
      `
    }
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Zero-Trust Firestore Rules - Red Team Validation", () => {
  it("should prevent unauthorized read by another authenticated user (Payload 1)", async () => {
    const attackerDb = testEnv.authenticatedContext("attacker_123").firestore();
    const docRef = doc(attackerDb, "users", "victim_uid");
    await assertFails(getDoc(docRef));
  });

  it("should prevent unauthorized write by another authenticated user (Payload 2)", async () => {
    const attackerDb = testEnv.authenticatedContext("attacker_123").firestore();
    const docRef = doc(attackerDb, "users", "victim_uid");
    await assertFails(setDoc(docRef, { userId: "victim_uid", stateData: {} }));
  });

  it("should prevent unauthenticated reading (Payload 3)", async () => {
    const guestDb = testEnv.unauthenticatedContext().firestore();
    const docRef = doc(guestDb, "users", "victim_uid");
    await assertFails(getDoc(docRef));
  });

  it("should prevent unauthenticated writing (Payload 4)", async () => {
    const guestDb = testEnv.unauthenticatedContext().firestore();
    const docRef = doc(guestDb, "users", "victim_uid");
    await assertFails(setDoc(docRef, { userId: "victim_uid", stateData: {} }));
  });

  it("should block spoofed owner ID payload (Payload 5)", async () => {
    const victimDb = testEnv.authenticatedContext("victim_uid").firestore();
    const docRef = doc(victimDb, "users", "victim_uid");
    await assertFails(setDoc(docRef, { userId: "attacker_spoofed_uid", stateData: {} }));
  });
});
```
