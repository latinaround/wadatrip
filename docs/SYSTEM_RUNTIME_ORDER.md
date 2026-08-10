# WadaTrip: runtime order and ownership

This file is the operational source of truth for the live platform.

## 1. Identity and authorization

1. The mobile traveler signs in with Firebase Auth (email, Google, or Apple).
2. The mobile app sends the Firebase ID token to `POST /auth/firebase` on the WadaTrip gateway.
3. The gateway verifies the Firebase signature and claims for `FIREBASE_PROJECT_ID`, then issues its own WadaTrip JWT.
4. Every protected gateway request uses that WadaTrip JWT. The client never chooses the user by email or user ID.
5. Guide code sign-in remains a separate gateway-owned path: `POST /auth/request-code` then `POST /auth/verify-code`.

Firebase API configuration is public mobile configuration. It is never used as `JWT_SECRET`.

## 2. Data ownership

| Domain | System of record | Access path |
| --- | --- | --- |
| Users, providers, listings, bookings, trips | PostgreSQL on Render | WadaTrip gateway |
| Firebase identity | Firebase Auth | verified only by the gateway |
| Web administration | Vercel web application plus Firebase admin session | browser admin UI |
| Mobile application | Expo / React Native | WadaTrip gateway |
| Push-device registrations | PostgreSQL `push_devices` | `POST /devices/push-token` |

The separate community analytics backend is not the source of truth for bookings, trips, users, or marketplace data. Any feature still calling it must be migrated deliberately to the gateway or documented as analytics-only.

## 3. Request order

```text
Mobile Firebase login
  -> Firebase ID token
  -> gateway /auth/firebase
  -> gateway JWT stored by mobile
  -> trips / bookings / providers APIs
  -> optional Expo push-token registration

Web admin login
  -> Firebase admin session in Vercel web
  -> gateway administrative/provider APIs
```

## 4. Deployment order

1. Commit and push the gateway, Prisma schema, and migrations together.
2. In Render set `FIREBASE_PROJECT_ID` to the Firebase project ID and keep the existing independent `JWT_SECRET`.
3. Apply Prisma migrations in order, including `add_trips` before `add_firebase_identity_and_push_devices`.
4. Deploy the Render `wadatrip` service and check `/health`.
5. Publish the web only after the gateway is live.
6. Build/publish the Expo mobile client after testing Firebase login, one protected trip request, and push registration on a real device.

## 5. Security boundaries

- `JWT_SECRET` belongs only to Render/local gateway configuration and is never in Firebase, Vercel public variables, source code, or Git.
- `FIREBASE_PROJECT_ID` is required by the gateway; Firebase ID-token signature, issuer, audience, expiry, subject, and verified email are checked before a JWT is issued.
- Gateway JWTs, not email query parameters, scope protected data to a user.
- Expo push tokens are associated with the authenticated gateway user. Storing tokens is implemented; sending notifications requires a later notification-delivery worker.