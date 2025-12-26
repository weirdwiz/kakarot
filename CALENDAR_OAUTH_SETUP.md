# Calendar OAuth Setup Guide

Kakarot supports integration with Google Calendar, Outlook Calendar, and iCloud Calendar. To connect your calendars, you'll need to set up OAuth credentials for each provider.

## Google Calendar Setup

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/apis/credentials

2. **Create or Select a Project**
   - Click "Select a project" → "New Project"
   - Give it a name like "Kakarot Calendar"
   - Click "Create"

3. **Enable Google Calendar API**
   - Navigate to "APIs & Services" → "Library"
   - Search for "Google Calendar API"
   - Click on it and press "Enable"

4. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "+ CREATE CREDENTIALS" → "OAuth client ID"
   - Select "Desktop app" as application type
   - Give it a name like "Kakarot Desktop"
   - Click "Create"

5. **Copy Credentials**
   - You'll see a dialog with your Client ID and Client Secret
   - Copy both values
   - In Kakarot Settings, click "+ Connect Your Google Calendar"
   - Paste the Client ID and Client Secret
   - Click "Save & Connect"

6. **Authorize**
   - Your browser will open Google's OAuth consent screen
   - Sign in with your Google account
   - Grant calendar read permissions
   - You'll be redirected to a success page
   - Return to Kakarot - your calendar is now connected!

---

## Outlook Calendar Setup

1. **Go to Azure Portal**
   - Visit: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade

2. **Register Application**
   - Click "+ New registration"
   - Name: "Kakarot"
   - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
   - Click "Register"

3. **Add Redirect URI**
   - In your app's overview, go to "Authentication"
   - Click "+ Add a platform"
   - Select "Mobile and desktop applications"
   - Add custom redirect URI: `http://localhost:8888/oauth/callback`
   - Click "Configure"

4. **Add API Permissions**
   - Go to "API permissions"
   - Click "+ Add a permission"
   - Select "Microsoft Graph"
   - Choose "Delegated permissions"
   - Search and add:
     - `Calendars.Read`
     - `Calendars.Read.Shared`
     - `offline_access` (for refresh tokens)
   - Click "Add permissions"

5. **Create Client Secret**
   - Go to "Certificates & secrets"
   - Click "+ New client secret"
   - Description: "Kakarot OAuth"
   - Expires: Choose duration (recommend 24 months)
   - Click "Add"
   - **Copy the secret VALUE immediately** (it won't be shown again!)

6. **Copy Credentials**
   - Application (client) ID is on the Overview page
   - In Kakarot Settings, click "+ Connect Your Outlook Calendar"
   - Paste the Client ID and Client Secret
   - Click "Save & Connect"

7. **Authorize**
   - Your browser will open Microsoft's OAuth consent screen
   - Sign in with your Microsoft account
   - Grant calendar read permissions
   - Return to Kakarot - your calendar is now connected!

---

## iCloud Calendar Setup

**Note:** iCloud uses CalDAV authentication with app-specific passwords instead of OAuth.

1. **Generate App-Specific Password**
   - Visit: https://appleid.apple.com/account/manage
   - Sign in with your Apple ID
   - In the "Security" section, find "App-Specific Passwords"
   - Click "Generate Password"
   - Label it "Kakarot"
   - Copy the generated password (format: xxxx-xxxx-xxxx-xxxx)

2. **Configure in Kakarot**
   - In Kakarot Settings, click "+ Connect Your iCloud Calendar"
   - Client ID: Enter your Apple ID email (e.g., `your@icloud.com`)
   - Client Secret: Paste the app-specific password
   - Click "Save & Connect"

**Note:** Full iCloud CalDAV integration is coming soon. The current implementation stores credentials securely but event syncing is not yet active.

---

## Security Notes

- **Encrypted Storage**: All tokens and credentials are encrypted using your OS's secure storage (Keychain on macOS, DPAPI on Windows, libsecret on Linux)
- **Token Refresh**: Access tokens are automatically refreshed before expiry
- **Local OAuth**: The OAuth callback server runs locally on `http://localhost:8888` and only accepts connections during the auth flow
- **No Cloud Storage**: Your tokens never leave your device

## Troubleshooting

### "Please configure OAuth credentials in Settings first"
You need to set up OAuth credentials before connecting. Follow the setup guide for your provider above.

### "OAuth flow failed or was cancelled"
- Make sure you clicked "Allow" on the OAuth consent screen
- Check that your redirect URI is exactly: `http://localhost:8888/oauth/callback`
- Ensure port 8888 is not blocked by firewall or in use by another app

### "Failed to connect: Invalid credentials"
- Double-check your Client ID and Client Secret
- For Google: Make sure you created "Desktop app" credentials
- For Outlook: Verify redirect URI is added to your Azure app
- For iCloud: Confirm you're using an app-specific password, not your main Apple ID password

### Calendar events not showing up
- Make sure you've granted read permissions during OAuth
- Check that the calendar contains events in the next 24 hours
- Try disconnecting and reconnecting the calendar

## Disconnecting Calendars

To disconnect a calendar:
1. Go to Settings
2. Click on a connected calendar button (it will show a green checkmark)
3. The calendar will be disconnected and tokens revoked
4. You can reconnect anytime by setting it up again
