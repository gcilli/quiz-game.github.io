// Firebase Configuration
// Follow these steps to set up Firebase:
// 1. Go to https://firebase.google.com/
// 2. Click "Get Started" and sign in with your Google account
// 3. Click "Add Project" and create a new project (e.g., "barsa-quiz")
// 4. When asked about Google Analytics, you can disable it for this project
// 5. Once created, click on the Web icon (</>) to add a web app
// 6. Register your app with a nickname (e.g., "Quiz App")
// 7. Copy the firebaseConfig object from the setup screen
// 8. Replace the firebaseConfig object below with your own
// 9. In the Firebase console, go to "Build" > "Realtime Database"
// 10. Click "Create Database" and start in test mode
// 11. Your Firebase setup is complete!

// IMPORTANT: Add the databaseURL after creating the Realtime Database
// You can find it in Firebase Console > Realtime Database (at the top of the page)
const firebaseConfig = {
  apiKey: "AIzaSyBfYSiF4DCyUrQ7Yua1XqX00oKDSKNcS7o",
  authDomain: "quiz-game-gcilli.firebaseapp.com",
  databaseURL: "https://quiz-game-gcilli-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "quiz-game-gcilli",
  storageBucket: "quiz-game-gcilli.firebasestorage.app",
  messagingSenderId: "908101005553",
  appId: "1:908101005553:web:dc126060222c4017b23950"
};

// Initialize Firebase
let app = null;
let database = null;

function initializeFirebase() {
  try {
    // Check if Firebase is loaded
    if (typeof firebase === 'undefined') {
      console.error('Firebase SDK not loaded. Check your internet connection and script tags.');
      return false;
    }

    // Check if already initialized
    if (app !== null) {
      console.log('Firebase already initialized');
      return true;
    }

    // Initialize Firebase app
    app = firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    
    // Update window references
    window.firebaseApp = app;
    window.firebaseDatabase = database;
    
    console.log('Firebase initialized successfully');
    return true;
  } catch (error) {
    // Check if error is because app already exists
    if (error.code === 'app/duplicate-app') {
      console.log('Firebase app already exists, using existing instance');
      app = firebase.app();
      database = firebase.database();
      window.firebaseApp = app;
      window.firebaseDatabase = database;
      return true;
    }
    
    console.error('Error initializing Firebase:', error);
    alert('Errore durante l\'inizializzazione di Firebase. Controlla la configurazione.');
    return false;
  }
}

// Export for use in other modules
window.initializeFirebase = initializeFirebase;
