# FinGist release guide (iPhone with Xcode, then App Store)

## 0. One-time setup on your Mac
- Xcode (latest, from the Mac App Store), opened once to install its components
- CocoaPods: `brew install cocoapods` (or `sudo gem install cocoapods`)
- Node.js 20+
- Apple Developer account (signed in to Xcode: Xcode → Settings → Accounts → +)
- On your iPhone: Settings → Privacy & Security → Developer Mode → On (shown after the first Xcode run)

Get the code with git (easier to update than zip files):
```bash
cd ~/Documents
git clone -b phase-2-app https://github.com/Sandip-ios/FinGist.git
cd FinGist/app
npm install
```
Later updates: `git pull` then `npm install`.

## 1. Create the Xcode project
```bash
npx expo prebuild --platform ios --clean
open ios/FinGist.xcworkspace
```
Always open the `.xcworkspace` file (not `.xcodeproj`). Run `prebuild --clean` again after every `git pull`;
the `ios` folder is generated and never edited by hand.

## 2. Signing in Xcode
1. Left sidebar: click **FinGist** (top, blue icon) → target **FinGist** → **Signing & Capabilities**.
2. Tick **Automatically manage signing**, choose your **Team**.
3. Bundle Identifier must be `com.sandippatel.fingist`.
4. Check that **Push Notifications** and **Background Modes → Remote notifications** are listed (added automatically).

## 3. Run on your iPhone
1. Connect the iPhone by cable, unlock it, tap **Trust**.
2. At the top of Xcode choose your iPhone as the run destination.
3. For a real standalone test (no Metro server needed):
   **Product → Scheme → Edit Scheme… → Run → Build Configuration → Release**.
4. Press ▶ (Run). First time: on the iPhone allow Developer Mode and trust the developer
   (Settings → General → VPN & Device Management).

(With the **Debug** configuration the app loads its code from your Mac: run `npx expo start` first.)

## 4. Push notifications for your own build
Expo needs your Apple push key once, for this bundle ID:
```bash
npx eas-cli@latest credentials -p ios
```
Choose **production** → **Push Notifications** → **Set up a new key** (sign in with your Apple ID when asked).
Then in the app: ☰ More → turn News alerts off and on again (the token changes for a real build).

## 5. Create the app in App Store Connect
appstoreconnect.apple.com → **Apps → + → New App**
- Platform: iOS
- Name: `FinGist` (must be unique on the App Store; if taken, try `FinGist: Market News`)
- Primary language: English (India) or English (U.K.)
- Bundle ID: `com.sandippatel.fingist`
- SKU: `fingist-ios`

Copy the **Apple ID** number shown under App Information into `app.json` → `extra.iosAppStoreId`
(used by "Rate FinGist" and "Share FinGist").

## 6. Upload a build (TestFlight)
1. In `app.json`, `version` is the version users see (`1.0.0`). In Xcode → target → **General → Build**,
   use `1` for the first upload and increase it (2, 3, …) for every new upload.
2. Run destination: **Any iOS Device (arm64)**.
3. **Product → Archive** (a few minutes).
4. Organizer opens → **Distribute App → App Store Connect → Upload** → keep defaults → Upload.
5. Wait 10–30 minutes for processing (email from Apple).
6. App Store Connect → your app → **TestFlight** → add yourself under **Internal Testing** →
   install the **TestFlight** app on the iPhone and install FinGist from there.

## 7. Submit for App Store review
Before submitting, these must be ready:
- [ ] **Website uploaded** to BigRock (privacy policy URL and support URL are required)
- [ ] Screenshots: 6.9" iPhone (1320 × 2868) — at least 3 (feed, search, alerts/More)
- [ ] App description, keywords, promotional text, support URL, privacy policy URL
- [ ] Category: **News** (secondary: Finance)
- [ ] Age rating questionnaire (no objectionable content → 4+)
- [ ] App Privacy questionnaire (we will fill it together)
- [ ] Review notes: "No login needed. News summaries are AI-generated from publishers' RSS headlines and
      descriptions; each card links to the original article. Not investment advice."
Then: App Store tab → choose the build → **Add for Review → Submit**. Review usually takes 1–3 days.

## Android (Play Store)
Building Android in Android Studio needs your own signing key setup; EAS does it for you:
```bash
npx eas-cli@latest build -p android --profile preview      # APK to install and test on a phone
npx eas-cli@latest build -p android --profile production   # .aab for Play Console
```
- Push alerts on Android need Firebase: create a Firebase project, add an Android app
  `com.sandippatel.fingist`, download `google-services.json`, and upload the FCM V1 key with
  `npx eas-cli@latest credentials -p android`.
- New personal Play Console accounts must run a **closed test with at least 12 testers for 14 days**
  before production release.

## If Xcode gives you trouble
The cloud route does signing and uploading for you:
```bash
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest submit -p ios
```
