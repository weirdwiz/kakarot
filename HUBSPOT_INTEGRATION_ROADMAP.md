# HubSpot Integration Roadmap

Based on HubSpot's official blueprint, here's our implementation strategy for integrating HubSpot with Kakarot.

---

## Phase 1: ✅ Desktop-First Implementation (COMPLETED)

We've improved our current Electron-based HubSpot integration to follow HubSpot's official API patterns exactly.

### Changes Made

#### 1. **Improved Contact Search** (`CRMEmailMatcher.ts`)
- **Before**: Listed all contacts and filtered client-side (inefficient, doesn't scale)
- **After**: Uses HubSpot's official `/crm/v3/objects/contacts/search` API
  ```typescript
  POST https://api.hubapi.com/crm/v3/objects/contacts/search
  {
    filterGroups: [{
      filters: [{
        propertyName: 'email',
        operator: 'EQ',
        value: 'user@example.com'
      }]
    }],
    properties: ['firstname', 'lastname', 'email'],
    limit: 1
  }
  ```
- **Benefit**: More efficient, exact matches, official API

#### 2. **Proper Note Creation** (`CRMNoteSyncService.ts`)
- **Before**: Attempted to associate via contact endpoint (incorrect API)
- **After**: Two-step process following HubSpot's pattern:
  1. Create note with `hsnotebody` property:
     ```typescript
     POST https://api.hubapi.com/crm/v3/objects/notes
     {
       properties: {
         hsnotebody: "Meeting notes transcript..."
       }
     }
     ```
  2. Associate note to contact:
     ```typescript
     PUT https://api.hubapi.com/crm/v3/objects/notes/{noteId}/associations/contacts/{contactId}/notetocontact
     ```
- **Benefit**: Proper HubSpot data model, notes appear on contact timeline

#### 3. **Better Note Formatting**
- **Before**: Unstructured text with "No notes available" fallbacks
- **After**: Proper HubSpot format with sections:
  ```
  Meeting: Team Standup
  Date: 1/3/2026, 8:30 AM
  Duration: 30 minutes
  
  Participants:
  alice@company.com, bob@company.com
  
  Summary:
  Discussed project timeline and blockers...
  
  Details:
  - Q1 roadmap items
  - Bug fixes prioritized
  ```

### Current Architecture

```
Kakarot Desktop App (Electron)
├── RecordingView (post-meeting prompt modal)
├── CRMEmailMatcher (search contacts by email)
├── CRMNoteSyncService (create notes + associations)
└── HubSpotOAuthProvider (handle OAuth)
    ↓
HubSpot API (direct calls from desktop)
├── /crm/v3/objects/contacts/search
├── /crm/v3/objects/notes (POST)
└── /crm/v3/objects/notes/{id}/associations/contacts/{id}/notetocontact
```

### Testing the Current Implementation

1. **Connect HubSpot** in Settings
2. **Record a meeting** with attendee emails matching HubSpot contacts
3. **Stop recording** → Post-meeting prompt appears
4. **Click "Yes"** → Notes synced to matching contacts in HubSpot

---

## Phase 2: Optional Backend Service (RECOMMENDED FUTURE)

While our desktop implementation works, HubSpot recommends a backend service for:

### 🔒 Security Improvements

**Current Risk**: Client secret stored in desktop app (vulnerable to reverse engineering)

**Solution**: Lightweight backend service

### Architecture

```
Kakarot Desktop App
  ↓ (initiates OAuth)
  ↓
Backend Service (Node/Express)
├── POST /hubspot/connect → Returns OAuth URL
├── GET /hubspot/oauth/callback → Exchanges code for token (secure)
├── POST /hubspot/create-note → Calls HubSpot API
└── Stores tokens in secure database
  ↓
HubSpot API (backend-only calls)
```

### Implementation Steps

1. **Create Express backend** (minimal)
   ```
   src/backend/
   ├── index.ts (Express server)
   ├── routes/hubspot.ts (OAuth + note endpoints)
   ├── services/hubspot.ts (API calls)
   └── db.ts (token storage)
   ```

2. **OAuth Flow**
   - Desktop: `window.kakarot.crm.initiateOAuth('hubspot')`
   - Backend: Opens browser, handles `/hubspot/oauth/callback`, securely exchanges code
   - Desktop: Receives tokens via callback, stores in AppSettings

3. **Note Creation Flow**
   - Desktop: Calls `POST /backend/hubspot/create-note` with meeting data
   - Backend: Searches contacts, creates note, associates, refreshes token if needed
   - Desktop: Shows success/error to user

4. **Token Refresh**
   - Backend automatically refreshes tokens before expiry
   - No manual intervention needed

### Optional: Free Hosting
- Deploy to **Render** (free tier with PostgreSQL)
- Or **Railway** (credits + free tier)
- Desktop points to `https://your-backend.render.com`

---

## Phase 3: Future Enhancements

### API Scopes to Add Later
Currently requesting:
- `crm.objects.contacts.read`
- `crm.objects.contacts.write`
- `crm.objects.notes.write`

Can expand to:
- `crm.objects.deals.read` → Link notes to deals
- `crm.objects.meetings.read/write` → Create HubSpot meetings from Kakarot
- `crm.objects.companies.read` → Company context

### Features to Implement
1. **Find/Create Contact** - If contact doesn't exist, create from participant email
2. **File Attachments** - Upload audio/transcript to HubSpot File Manager
3. **Deal Association** - Link meeting notes to deals
4. **Custom Properties** - Map meeting metadata to HubSpot contact properties
5. **Bulk Note Creation** - Sync multiple meetings at once

---

## Reference: HubSpot API Patterns Used

### 1. Search Contacts by Email
```typescript
POST https://api.hubapi.com/crm/v3/objects/contacts/search
Authorization: Bearer {accessToken}

{
  "filterGroups": [{
    "filters": [{
      "propertyName": "email",
      "operator": "EQ",
      "value": "user@example.com"
    }]
  }],
  "properties": ["firstname", "lastname", "email"],
  "limit": 1
}
```

### 2. Create Note
```typescript
POST https://api.hubapi.com/crm/v3/objects/notes
Authorization: Bearer {accessToken}

{
  "properties": {
    "hsnotebody": "Meeting transcript with full details..."
  }
}
```

### 3. Associate Note to Contact
```typescript
PUT https://api.hubapi.com/crm/v3/objects/notes/{noteId}/associations/contacts/{contactId}/notetocontact
Authorization: Bearer {accessToken}
```

---

## Environment Variables Required

For Phase 2 backend:

```bash
# In .env
HUBSPOT_CLIENT_ID=your_client_id
HUBSPOT_CLIENT_SECRET=your_client_secret          # Server-side only!
HUBSPOT_REDIRECT_URI=https://your-backend.com/hubspot/oauth/callback

# Database (if using Render/Railway)
DATABASE_URL=postgresql://user:pass@host/db
```

---

## Checklist: Phase 1 Status ✅

- [x] OAuth flow for HubSpot in Electron
- [x] Contact search using official API
- [x] Note creation with `hsnotebody`
- [x] Note-to-contact association
- [x] Post-meeting prompt modal
- [x] Error handling and logging
- [x] TypeScript types for tokens

---

## Next Steps

1. **Test in Production** - Try syncing notes to real HubSpot contacts
2. **Gather Feedback** - See if notes appear correctly in HubSpot timeline
3. **Plan Phase 2** - If security concerns arise, build backend service
4. **Expand Scopes** - Add deal/meeting associations as needed

---

## Questions?

If HubSpot requires additional scopes or API changes, refer to:
- [HubSpot CRM Object API](https://developers.hubspot.com/docs/crm/understand-the-crm)
- [Notes Object](https://developers.hubspot.com/docs/crm/understand-the-crm/notes)
- [Associations API](https://developers.hubspot.com/docs/crm/associations/v4-beta-changes)
