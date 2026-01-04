# Fix: "HubSpot OAuth credentials not configured" Error

## Problem

When you click "Connect HubSpot" in Kakarot Settings, you get:

```
Failed to connect hubspot: Error invoking remote method 'crm:connect': 
Error: Failed to connect hubspot: HubSpot OAuth credentials not configured
```

## Solution: Configure HubSpot OAuth

### Option 1: Quick Setup (Recommended)

1. **Create a HubSpot App**
   - Go to https://app.hubspot.com/
   - Click your profile → **Settings**
   - Go to **Integrations → Private Apps**
   - Click **Create App**

2. **Fill in App Details**
   - **App name**: "Kakarot Meeting Notes"
   - Go to the **Auth** tab
   - Add **Redirect URLs**: `http://localhost:3000/oauth/hubspot`

3. **Add Scopes** (in the Scopes section)
   ```
   crm.objects.contacts.read
   crm.objects.contacts.write
   crm.objects.notes.write
   ```

4. **Get Your Credentials**
   - Click **Show** next to **Client ID** and **Client Secret**
   - Copy both values

5. **Add to .env File**
   - Open `.env` in your project root
   - Find these lines:
     ```
     HUBSPOT_CLIENT_ID=your_hubspot_client_id_here
     HUBSPOT_CLIENT_SECRET=your_hubspot_client_secret_here
     ```
   - Replace with your actual credentials:
     ```
     HUBSPOT_CLIENT_ID=abc123xyz...
     HUBSPOT_CLIENT_SECRET=def456uvw...
     ```

6. **Restart Kakarot**
   - Close Kakarot completely
   - Reopen it
   - Go to Settings → CRM → Click "Connect HubSpot"
   - You should now see the OAuth login screen

### Option 2: Using Settings UI (Coming Soon)

In future versions, you'll be able to add OAuth credentials directly in the Settings UI without editing `.env`.

---

## Verify It Worked

After setup, you should see:

✅ **In Kakarot Settings → CRM**: "Connected" status next to HubSpot
✅ **In HubSpot**: The app listed under **Integrations → Connected Apps**
✅ **When recording**: Post-meeting prompt offers to send notes to HubSpot

---

## Still Getting the Error?

### Check 1: File Location
- Make sure `.env` is in the **root** of the project:
  ```
  /Users/moxo/Desktop/kakarot-master/.env  ✅
  /Users/moxo/Desktop/kakarot-master/src/.env  ❌
  ```

### Check 2: Credentials Format
- Copy the entire Client ID and Secret from HubSpot
- Don't include quotes or extra spaces:
  ```
  ✅ HUBSPOT_CLIENT_ID=abc123xyz
  ❌ HUBSPOT_CLIENT_ID="abc123xyz"
  ❌ HUBSPOT_CLIENT_ID= abc123xyz (extra space)
  ```

### Check 3: Restart After Editing
- Always close and reopen Kakarot after changing `.env`
- The app reads `.env` on startup only

### Check 4: Check Console for More Details
1. Open Kakarot
2. Press **Cmd+Shift+I** (macOS) to open Developer Console
3. Look for messages like:
   - `[INFO] HubSpot OAuth initialized` ✅
   - `[ERROR] HubSpot credentials missing` ❌
4. Share any error messages if still stuck

---

## What Happens After Setup?

Once HubSpot is connected:

1. **Record a Meeting**
   - Make sure attendee emails match people in HubSpot contacts

2. **Stop Recording**
   - Post-meeting prompt appears: "Would you like to send these notes to HubSpot?"

3. **Click "Yes"**
   - Kakarot searches for matching contacts
   - Creates a note for each contact
   - Links note to their HubSpot record

4. **Check HubSpot**
   - Open a contact
   - Scroll to **Timeline**
   - See the meeting note appear!

---

## Need Help?

Check the full guide: [HUBSPOT_SALESFORCE_SETUP.md](./HUBSPOT_SALESFORCE_SETUP.md)

Or review your setup:
- HubSpot has OAuth docs at: https://developers.hubspot.com/docs/api/intro-to-auth
- Make sure all **Scopes** are enabled in your private app
- Verify **Redirect URL** matches exactly: `http://localhost:3000/oauth/hubspot`
