# Firebase Setup Guide for Multiplayer Quiz

This guide will help you set up Firebase for the multiplayer quiz feature.

## Prerequisites

- A Google account
- The quiz application files

## Step-by-Step Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter a project name (e.g., "barsa-quiz" or "quiz-multiplayer")
4. Click **Continue**
5. (Optional) Disable Google Analytics if you don't need it
6. Click **Create project**
7. Wait for the project to be created, then click **Continue**

### 2. Register Your Web App

1. In the Firebase Console, click on the **Web icon** (`</>`) to add a web app
2. Enter a nickname for your app (e.g., "Quiz App")
3. **DO NOT** check "Also set up Firebase Hosting" (we'll use GitHub Pages)
4. Click **Register app**

### 3. Get Your Firebase Configuration

1. You'll see a code snippet with your Firebase configuration
2. Copy the **firebaseConfig** object that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXxXxXxXxXxXxXxXxXxXxXxXxXxXxX",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890abcdef"
};
```

3. Open the file `js/firebase-config.js` in your quiz project
4. **Replace** the placeholder configuration with your actual configuration

### 4. Set Up Realtime Database

1. In the Firebase Console, go to **Build** → **Realtime Database** (in the left sidebar)
2. Click **Create Database**
3. Select a location (choose the one closest to your users)
   - For Europe: `europe-west1`
   - For USA: `us-central1`
4. When asked about security rules, select **"Start in test mode"**
5. Click **Enable**

⚠️ **Important**: Test mode allows anyone to read/write your database. This is fine for development but you should update the rules for production.

### 5. Configure Security Rules (Optional but Recommended)

After testing, update your database rules for better security:

1. In the Realtime Database section, click on the **Rules** tab
2. Replace the rules with the following:

```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": true,
        ".write": true,
        "players": {
          "$playerId": {
            ".validate": "newData.hasChildren(['name', 'joined'])"
          }
        },
        "scores": {
          "$playerId": {
            ".validate": "newData.isNumber()"
          }
        }
      }
    }
  }
}
```

3. Click **Publish**

### 6. Test Your Configuration

1. Open `multiplayer.html` in your browser
2. Try creating a room
3. If you see any errors, check the browser console (F12)
4. Common issues:
   - **Firebase SDK not loaded**: Check your internet connection
   - **Configuration error**: Make sure you copied the entire config object correctly
   - **Database not initialized**: Make sure you created the Realtime Database

### 7. Deploy to GitHub Pages

Once everything works locally:

1. Commit all your files to your GitHub repository:
```bash
git add .
git commit -m "Add multiplayer feature with Firebase"
git push
```

2. Enable GitHub Pages:
   - Go to your repository on GitHub
   - Click **Settings** → **Pages**
   - Under "Source", select your main branch
   - Click **Save**

3. Your app will be available at: `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

### 8. Update Firebase Authorized Domains (for Production)

1. In Firebase Console, go to **Build** → **Authentication**
2. Click on the **Settings** tab → **Authorized domains**
3. Add your GitHub Pages domain: `YOUR_USERNAME.github.io`

## Database Structure

Your Firebase Realtime Database will store data in this structure:

```
rooms/
  ├── ABC123/  (room code)
  │   ├── host: "player_id"
  │   ├── hostName: "John"
  │   ├── created: 1234567890
  │   ├── gameStarted: false
  │   ├── currentQuestion: 0
  │   ├── numQuestions: 10
  │   ├── timer: 30
  │   ├── players/
  │   │   ├── player_1/
  │   │   │   ├── name: "John"
  │   │   │   ├── joined: 1234567890
  │   │   │   └── ready: true
  │   │   └── player_2/
  │   │       ├── name: "Jane"
  │   │       ├── joined: 1234567891
  │   │       └── ready: false
  │   ├── scores/
  │   │   ├── player_1: 150
  │   │   └── player_2: 120
  │   ├── questions: [...]
  │   └── answers/
  │       ├── 0/  (question index)
  │       │   ├── player_1/
  │       │   │   ├── answer: 0
  │       │   │   ├── correct: true
  │       │   │   ├── time: 5.2
  │       │   │   └── points: 90
```

## Troubleshooting

### Error: "Firebase SDK not loaded"
- Check your internet connection
- Make sure the Firebase CDN links in `multiplayer.html` are correct
- Try opening the browser console to see the actual error

### Error: "Permission denied"
- Check that you created the Realtime Database
- Make sure your security rules allow read/write access
- Verify your Firebase configuration is correct

### Error: "Room not found"
- The room code might be incorrect
- The room might have been deleted (Firebase can auto-delete old data)
- Check the Firebase Console → Realtime Database to see if data is being saved

### Players not seeing updates
- Make sure all players are using the same room code
- Check the browser console for JavaScript errors
- Verify that Firebase listeners are set up correctly

## Cost Information

Firebase offers a generous free tier (Spark Plan):

- **Realtime Database**: 1 GB storage, 10 GB/month downloads
- **Hosting**: 10 GB storage, 360 MB/day transfer (if you use it)

For a quiz app with ~100 active users:
- Each game session uses ~50 KB of data
- You can host thousands of games per month for free

If you exceed the free tier, you can upgrade to the Blaze Plan (pay-as-you-go).

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify your Firebase configuration in `js/firebase-config.js`
3. Check the Firebase Console for database activity
4. Review the [Firebase Documentation](https://firebase.google.com/docs/database)

## Security Best Practices

For production use:
1. Update database security rules to validate data
2. Implement rate limiting to prevent abuse
3. Add authentication if needed
4. Monitor usage in the Firebase Console
5. Set up budget alerts to avoid unexpected charges

Good luck with your multiplayer quiz! 🎮
