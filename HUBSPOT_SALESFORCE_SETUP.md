# HubSpot & Salesforce OAuth Setup Guide

## Quick Setup

To use HubSpot and Salesforce integration with Kakarot, you need to configure OAuth credentials.

---

## HubSpot Setup

### Step 1: Create a HubSpot Public App

1. Go to [HubSpot App Marketplace](https://app.hubspot.com/ecosystem/app-marketplace)
2. Or navigate to **Settings → Integrations → Private Apps**
3. Click **"Create app"**
4. Fill in app name (e.g., "Kakarot Meeting Notes")

### Step 2: Configure Scopes

In the **Scopes** section, add these scopes:

- `crm.objects.contacts.read` - Read contact data
- `crm.objects.contacts.write` - Create/update contacts
- `crm.objects.notes.write` - Create notes
- `crm.objects.deals.read` - (Optional) Link notes to deals
- `crm.objects.meetings.read` - (Optional) Meeting context

### Step 3: Set OAuth Redirect URI

Under **Auth**:
- Redirect URLs: `http://localhost:3000/oauth/hubspot`
- (For production: `https://your-domain.com/oauth/hubspot`)

### Step 4: Get Credentials

1. Click **"Show"** next to the Client ID and Client Secret
2. Copy both values
3. Add to your `.env` file:

```bash
HUBSPOT_CLIENT_ID=your_copied_client_id
HUBSPOT_CLIENT_SECRET=your_copied_client_secret
```

### Step 5: Verify

Restart Kakarot. You should now be able to:
1. Go to **Settings → CRM**
2. Click **"Connect HubSpot"**
3. Authenticate in the browser window
4. See "Connected" status

---

## Salesforce Setup

### Step 1: Create a Connected App

1. Log in to your Salesforce org
2. Go to **Setup → Apps → App Manager**
3. Click **"New Connected App"**
4. Fill in:
   - **Connected App Name**: Kakarot Meeting Notes
   - **API Name**: kakarot_meeting_notes (auto-generated)
   - **Contact Email**: your-email@company.com

### Step 2: Enable OAuth Settings

1. Check **"Enable OAuth Settings"**
2. Set **Callback URL**: `http://localhost:3000/oauth/salesforce`
   - (For production: `https://your-domain.com/oauth/salesforce`)
3. In **Selected OAuth Scopes**, add:
   - `api` - Access the org's API
   - `refresh_token` - Obtain refresh token
   - (Optional) `chatter_api` - Post to Chatter

### Step 3: Get Credentials

1. Click your app name in the list
2. In **API (Enable OAuth Settings)** section:
   - **Consumer Key** = Client ID
   - **Consumer Secret** = Client Secret (click **"Show"**)
3. Copy both values
4. Add to your `.env` file:

```bash
SALESFORCE_CLIENT_ID=your_consumer_key
SALESFORCE_CLIENT_SECRET=your_consumer_secret
```

### Step 4: Verify

Restart Kakarot. You should now be able to:
1. Go to **Settings → CRM**
2. Click **"Connect Salesforce"**
3. Authenticate with your Salesforce org
4. See "Connected" status

---

## Environment File Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in the OAuth credentials:
   ```bash
   # HubSpot
   HUBSPOT_CLIENT_ID=xyz123...
   HUBSPOT_CLIENT_SECRET=abc789...
   
   # Salesforce
   SALESFORCE_CLIENT_ID=xyz123...
   SALESFORCE_CLIENT_SECRET=abc789...
   ```

3. Keep these credentials **private** - never commit `.env` to git

4. Restart Kakarot for changes to take effect

---

## Testing

### Test HubSpot Integration

1. **Connect HubSpot** in Settings
2. **Record a meeting** with attendee emails that exist in your HubSpot contacts
3. **Stop recording** → Post-meeting prompt appears
4. Click **"Yes"** to sync notes
5. Open HubSpot → Find contact → Scroll to **Timeline** → See the note

### Test Salesforce Integration

1. **Connect Salesforce** in Settings
2. **Record a meeting** with attendee emails that exist in your Salesforce contacts
3. **Stop recording** → Post-meeting prompt appears
4. Click **"Yes"** to sync notes
5. Open Salesforce → Find contact → Look for **Task** record with meeting notes

---

## Troubleshooting

### "OAuth credentials not configured"

**Solution**: 
- Check that `.env` file has `HUBSPOT_CLIENT_ID` and `HUBSPOT_CLIENT_SECRET`
- Restart Kakarot after updating `.env`
- Check that environment variables are loaded: In Kakarot console, you should see:
  ```
  [INFO] HubSpot OAuth initialized
  ```

### "Authorization failed"

**Possible causes**:
1. **Wrong scopes** - Check that your app has the required scopes enabled
2. **Redirect URI mismatch** - Verify callback URL matches exactly: `http://localhost:3000/oauth/hubspot`
3. **Expired app** - Some apps have expiration dates, renew if needed

**Solution**:
- Delete the old app and create a new one
- Double-check all settings match the guide above
- Restart Kakarot

### "No contacts found"

**Possible causes**:
1. **Email mismatch** - Meeting attendees' emails don't match exactly in CRM
2. **Empty attendee list** - Make sure meeting has attendee emails populated
3. **No matching contacts** - Attendee emails not in your CRM

**Solution**:
- Verify attendee emails in the meeting match contact emails in CRM (case-insensitive)
- For HubSpot: Check **Contacts** page, search by email
- For Salesforce: Check **Contacts** tab, verify email field

### Notes not syncing

**Check Kakarot logs**:
1. Open Kakarot app console (Cmd+Shift+I on macOS)
2. Look for error messages
3. Common errors:
   - `"No matching contacts found"` - Email addresses don't match
   - `"Invalid token"` - Token expired, reconnect CRM
   - `"API rate limited"` - Too many requests, wait and retry

**Solution**:
- Disconnect and reconnect the CRM
- Check that you have write permissions in HubSpot/Salesforce
- Verify meeting has valid attendee emails

---

## Next Steps

- **Single CRM**: Connect just HubSpot or Salesforce
- **Both CRMs**: Connect both (notes sync to both platforms)
- **Settings → CRM Behavior**: Choose "Ask Before Sending" or "Always Send"
- **Custom Fields** (Future): Map meeting fields to CRM custom properties

---

## Support

For CRM-specific issues:
- **HubSpot**: [Developer Docs](https://developers.hubspot.com/)
- **Salesforce**: [Developer Docs](https://developer.salesforce.com/)

For Kakarot issues:
- Check error logs in the console
- Create an issue with the error message and steps to reproduce
