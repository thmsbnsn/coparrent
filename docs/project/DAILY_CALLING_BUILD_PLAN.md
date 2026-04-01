# CoParrent Daily Calling Build Plan

_Drafted: 2026-03-26. Updated: 2026-03-27._

This plan is for adding **custom in-app audio and video calling** to CoParrent using **Daily**.

It is intentionally scoped for this repo, not a generic Daily integration.

## Implementation Status

Implemented in repo on March 26, 2026:

- Daily calling schema foundation (`call_sessions`, `call_participants`, `call_events`) plus enums and RLS
- shared Daily REST and webhook helpers for room creation, token creation, and webhook verification
- edge functions:
  - `create-call-session`
  - `join-call-session`
  - `respond-to-call`
  - `end-call-session`
  - `daily-webhook`
- frontend hooks:
  - `useCallSessions`
  - `useDailyCall`
  - `useCallableFamilyMembers`
- Messaging Hub direct-message audio/video call buttons
- shared incoming, outgoing, and active call overlays
- app-wide call mounting through a global call manager in `DashboardLayout`
- dashboard caller widget with contact-card selection and a second-step audio/video confirmation surface
- server-side incoming-call notifications that create an app notification row and attempt Web Push delivery to subscribed devices

Live-verified on March 27, 2026:

- dashboard-started audio call
- Messaging Hub-started video call
- deployed `create-call-session`, `join-call-session`, `respond-to-call`, `end-call-session`, and `daily-webhook` flow
- actor-attributed `call_events`, `call_participants`, and Messaging Hub thread log records
- saved evidence artifacts in `docs/acquisition/diligence/evidence/daily-calls-20260327T085509Z-*`

Still not done:

- real-device incoming-call push verification as part of the broader push/PWA pass
- broader automated call-flow coverage beyond the live verifier

## Goal

Add **1:1 human-to-human calling** that works from:

- the **Messaging Hub** via phone/video buttons on direct-message threads
- the **Dashboard** via a call launcher widget with contact-card selection

The call experience should:

- use **Daily** for media transport
- use **Supabase** for authorization, app-side signaling, and persistence
- follow the existing family-role security model
- fit the current CoParrent product posture

## Recommended V1 Scope

Resolved product decisions:

- 1:1 calls only
- in-app audio and video together
- callable roles include active parent, guardian, and third-party members
- child accounts cannot place or receive calls
- incoming call, outgoing call, accepted, declined, missed, cancelled, ended states
- visible call outcomes inside Messaging Hub
- every outcome should capture who initiated, accepted, declined, cancelled, joined, left, or ended the call
- dashboard call widget is parent/guardian only

Do **not** build in V1:

- group calls
- PSTN / real phone numbers
- recording
- transcripts
- Pipecat integration
- screen share
- voicemail

## Repo Constraints

This plan assumes:

- `src/hooks/useMessagingHub.ts` is the authoritative messaging layer
- `src/pages/MessagingHubPage.tsx` is the primary thread UI
- `src/pages/Dashboard.tsx` is the right place for a launcher widget
- push infrastructure already exists and can be reused for incoming-call notifications
- role enforcement remains server-side per the security model in `docs/security/SECURITY_MODEL.md`

## Daily Pieces We Will Use

Daily docs referenced for this plan:

- REST reference: https://docs.daily.co/reference
- `POST /rooms`: create private one-time rooms
- `POST /meeting-tokens`: create short-lived participant join tokens
- `POST /webhooks`: webhook registration
- Webhook verification via `X-Webhook-Signature` / `X-Webhook-Timestamp`
- `daily-js` / `daily-react` for custom React call UI

Implementation choice:

- use **Daily custom UI**
- do **not** use Daily Prebuilt
- do **not** use Pipecat for human calling

## Architecture

### Media Layer

Daily handles:

- WebRTC transport
- room media session
- participant media tracks
- device/media behavior

CoParrent handles:

- who is allowed to call whom
- call creation and acceptance
- ringing state
- missed/declined/cancelled/ended state
- call history
- push alerts
- call ownership and auditability

### Signaling Layer

Use Supabase as the app signaling layer.

Realtime events will come from changes to:

- `call_sessions`
- `call_events`

This keeps the product model consistent with the existing repo instead of relying on Daily alone for call state.

The schema should stay easy to extend later for recording and transcripts, but V1 should not carry recording-specific product behavior or UI.

## Data Model

### New enums

- `call_type`
  - `audio`
  - `video`

- `call_status`
  - `ringing`
  - `accepted`
  - `declined`
  - `missed`
  - `cancelled`
  - `ended`
  - `failed`

- `call_event_type`
  - `created`
  - `ringing`
  - `accepted`
  - `declined`
  - `missed`
  - `cancelled`
  - `joined`
  - `left`
  - `ended`
  - `failed`

### New tables

#### `call_sessions`

Purpose:

- authoritative app-side record of one call attempt / session

Fields:

- `id`
- `family_id`
- `thread_id` nullable
- `initiator_profile_id`
- `callee_profile_id`
- `initiator_role_snapshot`
- `callee_role_snapshot`
- `initiator_display_name`
- `callee_display_name`
- `call_type`
- `status`
- `source`
- `daily_room_name`
- `daily_room_url`
- `room_expires_at` nullable
- `started_at` nullable
- `answered_at` nullable
- `ended_at` nullable
- `ended_by_profile_id` nullable
- `failed_reason` nullable
- `created_at`
- `updated_at`

#### `call_participants`

Purpose:

- who joined the Daily room and when

Fields:

- `id`
- `call_session_id`
- `profile_id`
- `member_role_snapshot`
- `display_name_snapshot`
- `joined_at` nullable
- `left_at` nullable
- `created_at`

#### `call_events`

Purpose:

- append-only state history for auditing and debugging

Fields:

- `id`
- `call_session_id`
- `event_type`
- `actor_profile_id` nullable
- `actor_role_snapshot` nullable
- `actor_display_name` nullable
- `payload` jsonb
- `created_at`

## Authorization Rules

Server-side enforcement only.

Baseline rules:

- only authenticated users can create or join calls
- caller and callee must belong to the same family
- child accounts cannot initiate or receive calls
- active third-party members are callable in V1
- users can only view call sessions they are part of or are authorized to see via family policy
- Daily room creation and token creation never happen from the client

RLS should follow the same pattern as messaging and family-scoped authorization:

- allow reads only to authorized family members
- allow inserts/updates only through server logic or tightly scoped RLS

## Env Vars

Add server-side env vars:

- `DAILY_API_KEY`
- `DAILY_DOMAIN`
- `DAILY_WEBHOOK_HMAC` if using your own configured HMAC secret
- `DAILY_WEBHOOK_UUID` optional if you want to store the registered webhook identity

Potential frontend env vars:

- none required if all token and room access is issued by edge functions

## Edge Functions

### `create-call-session`

Purpose:

- validate caller/callee pair
- create app-side session row
- create a Daily private room
- persist Daily room metadata
- emit initial call event

Input:

- `target_profile_id`
- `call_type`
- optional `thread_id`
- optional `source` = `messaging_hub` or `dashboard`

Output:

- call session object
- initial status

### `join-call-session`

Purpose:

- validate the current user is a valid participant
- create short-lived Daily meeting token
- return join payload for `daily-js`

Input:

- `call_session_id`

Output:

- `room_url`
- `token`
- `call_type`
- participant metadata

### `respond-to-call`

Purpose:

- accept or decline a ringing call

Input:

- `call_session_id`
- `response` = `accept` or `decline`

Output:

- updated call status

### `end-call-session`

Purpose:

- end active or ringing call

Input:

- `call_session_id`

Output:

- updated call status

### `daily-webhook`

Purpose:

- verify Daily webhook signature
- upsert join/leave/start/end events
- reconcile app state if browser actions fail to report cleanly

Expected Daily events to care about:

- participant joined
- participant left
- meeting started
- meeting ended

## Frontend Implementation

### New hooks

#### `src/hooks/useCallSessions.ts`

Purpose:

- fetch call state
- subscribe to realtime updates
- expose actions:
  - create call
  - accept
  - decline
  - cancel
  - end

#### `src/hooks/useDailyCall.ts`

Purpose:

- wrap `daily-js`
- create/join/leave/destroy the Daily call object
- expose local media state:
  - joined
  - mic enabled
  - camera enabled
  - remote participant presence
  - errors

### New components

Suggested component set:

- `src/components/calls/CallActionButtons.tsx`
  - phone + video icons for direct-message thread header

- `src/components/calls/IncomingCallSheet.tsx`
  - incoming call UI

- `src/components/calls/OutgoingCallSheet.tsx`
  - ringing / cancel UI

- `src/components/calls/ActiveCallPanel.tsx`
  - active audio/video call surface

- `src/components/calls/CallLauncherWidget.tsx`
  - dashboard widget entry point

- `src/components/calls/ContactCallCard.tsx`
  - avatar + name card

- `src/components/calls/CallConfirmCard.tsx`
  - flip-card confirmation layer with green call button

- `src/components/calls/CallHistoryCard.tsx`
  - optional later, if you want recent call activity on dashboard or in messaging

### Messaging Hub integration

Files:

- `src/pages/MessagingHubPage.tsx`
- `src/hooks/useMessagingHub.ts`

Work:

- show call buttons only on direct-message threads
- disable call actions on family channel and group threads
- wire create-call flow
- show in-call / ringing sheets above the thread UI
- optionally insert a system entry or badge for call history

### Dashboard integration

Files:

- `src/pages/Dashboard.tsx`

Work:

- add a “Start a Call” widget
- list available contacts as cards
- select card
- flip card animation
- second confirmation layer with green phone/video button
- start the same backend flow used by Messaging Hub
- only render the widget for parent/guardian users in the active family

### App shell integration

Files:

- `src/App.tsx`
- possibly `src/components/dashboard/DashboardLayout.tsx`

Work:

- mount global incoming-call listener UI for authenticated parent/guardian users
- ensure active/incoming call surfaces can appear above normal app routes

## Push / Notification Integration

Incoming calls must notify absent users.

Reuse:

- `src/hooks/useNotificationService.ts`
- `src/hooks/usePushNotifications.ts`
- existing push edge-function paths

Add notification type:

- `incoming_call`

Payload should include only safe metadata:

- caller name
- call type
- relative action URL

Do **not** include private message content.

## UX Plan

### Messaging Hub

- direct-message header gets:
  - phone icon
  - video icon

- clicking either:
  - creates a call session
  - opens outgoing-call state

### Dashboard

- add call launcher widget
- render contact cards with:
  - avatar
  - name
  - role label if useful

- selecting card:
  - flips card
  - reveals green confirm button
  - second action confirms call intent

### Incoming call

- full-screen mobile sheet or modal
- avatar
- display name
- audio vs video indicator
- answer / decline

### Active call

Audio:

- participant name
- call timer
- mute
- speaker hint if possible
- end call

Video:

- remote tile
- local preview
- mute
- camera toggle
- end call

## Room and Token Policy

Recommended Daily room creation rules:

- `privacy: private`
- `max_participants: 2`
- short room expiration
- one room per call session

Recommended token rules:

- always set `room_name`
- always set `exp`
- set `user_name`
- do not give owner powers unless required

## Realtime Flow

### Outgoing path

1. caller clicks phone/video
2. frontend calls `create-call-session`
3. backend creates `call_sessions` row and Daily room
4. realtime updates callee UI if online
5. push notification sent if needed
6. caller sees outgoing-call screen

### Accept path

1. callee accepts
2. frontend calls `respond-to-call`
3. backend updates session to `accepted`
4. both clients call `join-call-session`
5. both receive Daily tokens and join room

### End path

1. either side ends
2. frontend calls `end-call-session`
3. backend marks session ended
4. both UIs leave Daily room
5. call event is logged

## Suggested File-Level To-Do List

### Phase 1: Foundation

- add Daily packages to `package.json`
- add env handling for Daily server config
- create migration for enums and tables
- add RLS policies
- regenerate Supabase types if needed

### Phase 2: Server Logic

- add `create-call-session`
- add `join-call-session`
- add `respond-to-call`
- add `end-call-session`
- add `daily-webhook`
- add webhook signature verification helper

### Phase 3: Frontend Call Core

- add `useCallSessions`
- add `useDailyCall`
- add incoming/outgoing/active call components
- add global call overlay mounting point

### Phase 4: Messaging Hub Integration

- add phone/video buttons to direct-message thread header
- connect buttons to call creation flow
- add outgoing/incoming call presentation in messaging context

### Phase 5: Dashboard Widget

- add call launcher widget to dashboard
- add contact-card selection flow
- add flip-card confirm animation

### Phase 6: Push + Realtime Polish

- add `incoming_call` notification path
- trigger push on ringing call when callee is absent
- test in-app realtime and background notification behavior

### Phase 7: QA and Verification

- unit tests for call-state logic
- component tests for incoming/outgoing/accept/decline UI
- live verification script for call creation and join flow
- browser/device QA matrix

## Verification Checklist

- caller can start audio call from Messaging Hub
- caller can start video call from Messaging Hub
- dashboard widget launches call flow correctly
- callee sees incoming call when online
- callee gets push when offline or backgrounded
- accept joins Daily room successfully
- decline marks session declined
- no answer marks session missed
- end marks session ended
- child account cannot call
- unauthorized family member cannot join
- direct-message-only restriction is enforced
- parent/co-parent/third-party eligibility is enforced
- dashboard widget is hidden from third-party and child users

## Estimated Delivery

If done in the recommended order:

- audio-only internal MVP: 1 to 2 weeks
- audio + video + dashboard widget + call history: 3 to 5 weeks
- with stronger mobile QA and push polish: 4 to 8 weeks

## Locked Scope

The feature should be built against these decisions unless product direction changes:

1. V1 stays 1:1 only.
2. V1 ships audio and video together.
3. V1 allows active parent, guardian, and third-party users to call each other within the same family.
4. Child accounts cannot place or receive calls.
5. Messaging Hub should show visible call records with actor attribution.
6. Dashboard calling is parent/guardian only.
7. Recording and transcripts stay out of scope for V1.
