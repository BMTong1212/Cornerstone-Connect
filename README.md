# Cornerstone Connect — Local Business Directory

**Cornerstone Connect** is a responsive, mobile-first client-side web application designed to track, explore, and share trusted local business recommendations in Slidell, LA. It acts as a digital rolodex for the Oak Harbor Nail Spa network and clients, helping newcomers find trusted services and allowing operators to easily add new networking contacts simply by scanning business cards.

## Features

- 🔍 **Interactive Directory Lookup:** Real-time search and categorization filters (Real Estate, Home Services, Beauty, etc.) with pre-sorted partner/featured badges.
- 📸 **Camera Card OCR Scanner:** Capture a business card via your smartphone's camera (or upload an image) and parse the text directly in the browser using client-side **Tesseract.js**.
- 🤖 **Regex-Based Info Parser:** Automatically detects and isolates business name, owner name, US phone numbers, emails, website links, social media handles, and physical addresses from scanned cards.
- 📥 **Form Prefill & Verification:** Displays parsed fields side-by-side with original text for quick verification and manual corrections before saving.
- 🗃️ **Save to Contacts (vCard):** Dynamically generates standard `.vcf` vCard contact cards on the fly. Clicking "Save to Contacts" downloads the file, prompting iOS and Android devices to add the business directly to the phone's native address book.
- 🔒 **Privacy First / Local Storage:** Contacts are saved locally in the browser's `localStorage`. No data is ever sent to external databases or servers.
- 🔄 **Network Backup & Sync:** Easily export custom contacts as a JSON backup file and import them on other devices to synchronize lists.
- 🎨 **Sleek Dark/Light Aesthetics:** Default dark theme with warm wood/gold tones that complement the Oak Harbor brand visual identity.

## File Structure

```
local-business-directory/
├── index.html          # Semantic HTML structure & view panels
├── style.css           # Custom dark/light Vanilla CSS styling & sweep animations
├── app.js              # State management, OCR logger, parsing rules, vCard generator
├── directory-data.js   # Seed database containing initial Slidell partner listings
└── README.md           # This file
```

## Running Locally

Since the application is 100% static, you can run it in multiple ways:

1. **Direct Open:** Simply double-click `index.html` to open it directly in any modern browser.
2. **Local Python Server (Recommended for testing and local network synchronization):**
   Run the custom web server from the project's root directory:
   ```bash
   python3 server.py
   ```
   This script runs a static server that also handles a local HTTP API at `/api/sync`, allowing client mobile devices on the same Wi-Fi subnet to sync listings directly to the host Mac even without internet access.
   
   Once running, open `http://localhost:8000` in your browser.

## Deployment to Vercel (Production)

Because the project is entirely serverless and static, it is fully compatible with Vercel's zero-config deployment:

1. Navigate to your Vercel Dashboard.
2. Link your GitHub repository.
3. Select the `local-business-directory` folder as the root directory, or deploy the folder directly via Vercel CLI:
   ```bash
   npx vercel
   ```
4. Once deployed, load the link on your mobile phone's browser, tap "Add to Home Screen" to use it as a progressive web shortcut, and start scanning business cards on the go!
