# Firebase Security Setup

## ⚠️ IMPORTANT: Secure Your Firebase Database

Your Firebase API key is visible in the client code, which is **normal and safe** for web apps. Firebase API keys are designed to be public. However, you MUST configure proper security rules to prevent abuse.

## Why It's Safe to Commit firebase-config.js

- ✅ **Firebase API keys are meant to be public** - Google's official stance
- ✅ **They're identifiers, not secrets** - Like a username, not a password
- ✅ **Security comes from Database Rules** - Not from hiding the key
- ✅ **Every major Firebase app has public keys** - This is standard practice
- ✅ **Required for GitHub Pages** - Static sites need config in the repo

**The real security is in your Firebase Console settings, not hiding the key.**

## Step 1: Update Database Security Rules

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Build** > **Realtime Database** > **Rules**
4. Replace the rules with the following:

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        // Anyone can read room data
        ".read": true,
        
        // Anyone can create a room, and update specific game control fields
        ".write": "!data.exists() || 
                   newData.hasChildren(['gameStarted']) || 
                   newData.hasChildren(['currentQuestion']) || 
                   newData.hasChildren(['questionStartTime']) || 
                   newData.hasChildren(['gameStartTime']) || 
                   newData.hasChildren(['questionsVersion']) ||
                   newData.hasChildren(['gameEnded'])",
        
        // Players can join and update their status
        "players": {
          "$playerId": {
            ".write": true
          }
        },
        
        // Anyone in the room can submit answers
        "answers": {
          ".write": true
        },
        
        // Anyone in the room can update scores
        "scores": {
          ".write": true
        }
      }
    }
  }
}
```

5. Click **Publish**

## Step 2: Add Domain Restrictions

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll to **Authorized domains**
3. Add your production domain
4. Remove unauthorized domains (keep `localhost` only for development)

## Step 3: Set Up API Key Restrictions (Optional but Recommended)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to **APIs & Services** > **Credentials**
4. Find your API key and click the edit icon
5. Under **Application restrictions**, select **HTTP referrers**
6. Add your domain (e.g., `yourdomain.com/*`)
7. Under **API restrictions**, select **Restrict key** and only allow:
   - Firebase Realtime Database API
   - Firebase Authentication API (if using auth)
8. Click **Save**

## Step 4: Monitor Usage

1. In Firebase Console, go to **Build** > **Realtime Database** > **Usage**
2. Check for unusual activity
3. Set up budget alerts in Firebase Console > Project Settings > Usage and billing

## For GitHub Pages Deployment

**You SHOULD commit `firebase-config.js` to your repository.** This is safe and necessary because:

1. Firebase API keys are public identifiers (not secrets)
2. GitHub Pages is a static hosting service that needs the config file
3. Security is enforced through Firebase Database Rules, not by hiding the key
4. All Firebase web apps work this way

**The `firebase-config.template.js` file is just for documentation purposes.**

## Additional Security Measures

### Rate Limiting
Consider implementing rate limiting in your application code to prevent abuse.

### Room Cleanup
Add automatic cleanup of old rooms to prevent database bloat:

```javascript
// Example: Delete rooms older than 24 hours
const cleanupOldRooms = async () => {
  const roomsRef = database.ref('rooms');
  const snapshot = await roomsRef.once('value');
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;
  
  snapshot.forEach(child => {
    const roomData = child.val();
    if (roomData.createdAt && (now - roomData.createdAt) > dayInMs) {
      child.ref.remove();
    }
  });
};
```

### Authentication (Advanced)
For production apps, consider adding Firebase Authentication to track users properly.

## FAQ

**Q: Is it safe to expose the API key?**  
A: Yes, Firebase API keys are meant to be public in web apps. Security comes from database rules, not from hiding the key.

**Q: Someone is abusing my database!**  
A: Immediately update your security rules and add domain restrictions. Check the Usage tab for suspicious activity.

**Q: How do I completely remove the API key from my code?**  
A: Use a backend proxy server that handles Firebase communication, but this is overkill for most apps.

## Resources

- [Firebase Security Rules Guide](https://firebase.google.com/docs/database/security)
- [Understanding Firebase API Keys](https://firebase.google.com/docs/projects/api-keys)
- [Firebase Best Practices](https://firebase.google.com/docs/database/security/best-practices)
