# Chrome Web Store Publishing Guide

> 📅 **Last Updated**: Based on Chrome Web Store API official documentation as of December 22, 2025

## Automated Deployment Setup

This project is automatically deployed to the Chrome Web Store via GitHub Actions.

## Initial Setup (Required Once)

### 1. Google Cloud Console Setup

#### 1-1. Enable Chrome Web Store API

1. Access [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing project
3. Enter "Chrome Web Store API" in the search bar
4. Enable "Chrome Web Store API"

#### 1-2. Configure OAuth Consent Screen

1. Navigate to "OAuth consent screen" menu
2. Select User Type: **External** → Create
3. Enter required information:
   - App name: Choose a name (e.g., "HoverComp Publisher")
   - User support email: Your email
   - Developer contact information: Your email
4. Click "Save and Continue"
5. Skip the Scopes screen (Save and Continue)
6. Add your email to Test users → Save and Continue

#### 1-3. Create OAuth Client

1. Navigate to "Credentials" menu
2. Select "Create Credentials" → "OAuth client ID"
3. Select Application type: **"Web application"**
4. Enter a name (e.g., "Chrome Web Store Publisher")
5. Add to Authorized redirect URIs:
   - `https://developers.google.com/oauthplayground`
6. Click "Create"
7. **Copy and securely store the Client ID and Client Secret**

> ⚠️ **Important**:
>
> - According to official documentation, use **"Web application"** type (as of December 2025)
> - Client Secret can only be viewed in full at the time of creation

### 2. Generate Access Token & Refresh Token

#### Using OAuth 2.0 Playground (Official Recommended Method)

1. Access [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)

2. **Configure Settings** (Click ⚙️ in the top right):
   - ✅ Check "Use your own OAuth credentials"
   - Enter OAuth Client ID
   - Enter OAuth Client secret

3. **Step 1 - Authorize APIs**:
   - Enter in "Input your own scopes" field:
     ```
     https://www.googleapis.com/auth/chromewebstore
     ```
   - Click "Authorize APIs"
   - Sign in with Google account and approve permissions

4. **Step 2 - Exchange authorization code for tokens**:
   - Click "Exchange authorization code for tokens"
   - **Copy Refresh token** (reusable)
   - Access token is also displayed (valid for 1 hour)

> 💡 **Tip**: The Refresh token is permanently usable. When the Access token expires, it can be regenerated using the Refresh token.

### 3. Verify Chrome Extension ID

1. Access [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click "Add new item" → Upload ZIP file
3. Enter Store listing information (Privacy tab required)
4. Check Extension ID from URL: `...detail/YOUR_EXTENSION_ID/...`

> 📝 Extension ID is automatically generated as 32 lowercase letters

### 4. Configure GitHub Secrets

Add the following Secrets in your GitHub repository's Settings → Secrets and variables → Actions:

- `CHROME_EXTENSION_ID`: Extension ID
- `CHROME_CLIENT_ID`: OAuth Client ID
- `CHROME_CLIENT_SECRET`: OAuth Client Secret
- `CHROME_REFRESH_TOKEN`: Generated Refresh Token

## Deployment Methods

### Automated Deployment (Recommended)

1. Update version:

   ```bash
   # Change the version in both package.json and manifest.json to be identical
   npm version patch  # or minor, major
   ```

2. Deploy with tag:

   ```bash
   git add .
   git commit -m "Release v0.1.0"
   git tag v0.1.0
   git push origin main --tags
   ```

3. GitHub Actions automatically:
   - Runs tests
   - Packages the extension
   - Uploads and publishes to Chrome Web Store
   - Creates GitHub Release

### Manual Deployment

You can manually run the "Publish to Chrome Web Store" workflow from the GitHub Actions page.

## Version Management

- The versions in `manifest.json` and `package.json` must always be identical
- The test workflow automatically verifies version consistency
- Follows Semantic Versioning: `MAJOR.MINOR.PATCH`

## Workflows

### Test Workflow (`.github/workflows/test.yml`)

- Automatically runs on push to main, develop branches
- Automatically runs on Pull Requests
- Performs lint, tests, and version verification

### Publish Workflow (`.github/workflows/publish.yml`)

- Automatically runs on `v*` tag push
- Can be run manually
- Test → Package → Deploy → Create Release

## Troubleshooting

### "Invalid refresh token" error

- Regenerate the Refresh Token and update GitHub Secrets

### "Extension ID not found" error

- Verify the Extension ID in Chrome Web Store and update Secrets

### Version mismatch error

- Make the version values in `manifest.json` and `package.json` identical

## References

- [Chrome Web Store API Official Documentation](https://developer.chrome.com/docs/webstore/using-api) (Updated 2025-12-22)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [chrome-extension-upload Action](https://github.com/mnao305/chrome-extension-upload)

---

**✅ Verified**: This guide is based on the Chrome Web Store API official documentation (Last updated 2025-12-22 UTC).
