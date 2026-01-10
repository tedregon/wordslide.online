# Firebase Security Setup Guide

## Important: API Key Security

**The Firebase API key in `firebase-config.js` is PUBLIC by design.** This is normal and expected for client-side Firebase applications. Firebase API keys are not secrets - they're meant to be included in client-side code.

**Security comes from Firestore Security Rules**, not from hiding the API key.

## Setting Up Firestore Security Rules

The `firestore.rules` file in this repository contains the recommended security rules. You need to deploy these rules to your Firebase project.

### Option 1: Using Firebase Console (Easiest)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `wordslide-game` (note: project ID may still be "wordslide-game" even though the app is now called WordJam)
3. Navigate to **Firestore Database** → **Rules** tab
4. Copy the contents of `firestore.rules` from this repository
5. Paste into the rules editor
6. Click **Publish**

### Option 2: Using Firebase CLI

If you have Firebase CLI installed:

```bash
# Install Firebase CLI (if not already installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase (if not already done)
firebase init firestore

# Deploy rules
firebase deploy --only firestore:rules
```

## What the Rules Do

The security rules in `firestore.rules`:

- ✅ **Allow public read access** to `daily_words` collection (needed for the game)
- ❌ **Block all public writes** to prevent unauthorized data modification
- ✅ **Validate data structure** for any authenticated writes (if you add admin functionality later)
- ❌ **Block access to all other collections** by default

## Verifying Rules Are Active

After deploying rules, you need to test them to ensure writes are blocked. Here are several methods:

### Method 1: Firebase Console Rules Simulator (Easiest)

1. Go to Firebase Console → **Firestore Database** → **Rules** tab
2. Click the **Rules Playground** button (or "Simulator" tab)
3. Test a write operation:
   - **Location:** `daily_words/2024-01-01`
   - **Operation:** `write` or `create`
   - **Authenticated:** Leave unchecked (simulates unauthenticated user)
   - Click **Run**
   - **Expected Result:** ❌ **Denied** (should show red X)
4. Test a read operation:
   - **Location:** `daily_words/2024-01-01`
   - **Operation:** `read` or `get`
   - **Authenticated:** Leave unchecked
   - Click **Run**
   - **Expected Result:** ✅ **Allowed** (should show green checkmark)

### Method 2: Browser Console Test

Open your browser's developer console on your website and run:

```javascript
// Test 1: Try to write (should fail)
firebase.firestore().collection('daily_words').doc('test-date').set({
  words: ['TEST', 'WORDS']
}).then(() => {
  console.error('❌ SECURITY ISSUE: Write was allowed!');
}).catch((error) => {
  console.log('✅ SECURITY OK: Write was blocked:', error.message);
});

// Test 2: Try to read (should succeed)
firebase.firestore().collection('daily_words').doc('2024-01-01').get()
  .then((doc) => {
    if (doc.exists) {
      console.log('✅ Read allowed:', doc.data());
    } else {
      console.log('✅ Read allowed (document does not exist)');
    }
  })
  .catch((error) => {
    console.error('❌ Read was blocked (unexpected):', error.message);
  });
```

### Method 3: Create a Test HTML File

Create a file `test-firebase-rules.html` in your project:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Firebase Rules Test</title>
  <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
  <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js"></script>
  <script src="firebase-config.js"></script>
</head>
<body>
  <h1>Firebase Security Rules Test</h1>
  <button onclick="testWrite()">Test Write (Should Fail)</button>
  <button onclick="testRead()">Test Read (Should Succeed)</button>
  <div id="results"></div>

  <script>
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    function testWrite() {
      const results = document.getElementById('results');
      results.innerHTML = '<p>Testing write...</p>';
      
      db.collection('daily_words').doc('test-' + Date.now()).set({
        words: ['TEST', 'WORDS']
      }).then(() => {
        results.innerHTML = '<p style="color: red;">❌ SECURITY ISSUE: Write was allowed!</p>';
      }).catch((error) => {
        results.innerHTML = '<p style="color: green;">✅ SECURITY OK: Write was blocked</p><p>' + error.message + '</p>';
      });
    }

    function testRead() {
      const results = document.getElementById('results');
      results.innerHTML = '<p>Testing read...</p>';
      
      db.collection('daily_words').doc('2024-01-01').get()
        .then((doc) => {
          if (doc.exists) {
            results.innerHTML = '<p style="color: green;">✅ Read allowed</p><pre>' + JSON.stringify(doc.data(), null, 2) + '</pre>';
          } else {
            results.innerHTML = '<p style="color: green;">✅ Read allowed (document does not exist)</p>';
          }
        })
        .catch((error) => {
          results.innerHTML = '<p style="color: red;">❌ Read was blocked (unexpected)</p><p>' + error.message + '</p>';
        });
    }
  </script>
</body>
</html>
```

Open this file in your browser and click the buttons to test.

### Expected Test Results

✅ **Read Test:** Should succeed (allow reading daily_words)
❌ **Write Test:** Should fail with error like:
- `"Missing or insufficient permissions"`
- `"PERMISSION_DENIED: false for 'create'"`
- `"FirebaseError: [code=permission-denied]"`

### What to Do If Writes Are NOT Blocked

If writes are allowed when they shouldn't be:

1. **Check rules are deployed:**
   - Go to Firebase Console → Firestore → Rules
   - Verify the rules match `firestore.rules` file
   - Look for "Last published" timestamp

2. **Check rule syntax:**
   - Rules should have `allow write: if false;` for daily_words
   - Make sure there are no syntax errors (check console)

3. **Clear browser cache:**
   - Sometimes cached rules can cause issues
   - Try in incognito/private browsing mode

4. **Verify you're testing correctly:**
   - Make sure you're not authenticated (logged in)
   - The test should be from an unauthenticated context

## Additional Security Recommendations

### Firebase App Check (Optional but Recommended)

Firebase App Check helps protect your backend resources from abuse:

1. Go to Firebase Console → **App Check**
2. Register your web app
3. Enable App Check for Firestore
4. Add App Check to your client code (requires additional setup)

### Monitoring

- Set up Firebase alerts for unusual activity
- Monitor Firestore usage in the Firebase Console
- Review access logs regularly

## Current Status

✅ **Input validation added** - `firebase-service.js` now validates all data from Firebase
✅ **Security rules documented** - `firestore.rules` file created
✅ **Rules deployed** - Security rules have been deployed to Firebase Console
✅ **Rules tested** - Verified that reads work and writes are blocked

---

**Completed:**
1. ✅ Deployed the `firestore.rules` to Firebase project
2. ✅ Tested that reads work but writes are blocked
3. ⚠️ **Optional:** Consider enabling Firebase App Check for additional protection

