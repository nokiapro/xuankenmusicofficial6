// Firebase config — XuanKen Music
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyChU4i-6QN7ttYEPGnMNnfKbHXWdBR5NHo",
    authDomain: "music6-dfd59.firebaseapp.com",
    databaseURL: "https://music6-dfd59-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "music6-dfd59",
    storageBucket: "music6-dfd59.firebasestorage.app",
    messagingSenderId: "360247162639",
    appId: "1:360247162639:web:8167752f11cccd6d9bb07a"
};

// Khởi tạo (compat SDK)
if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
    }
    window.fbDB = firebase.database();
    try {
        window.fbAuth = firebase.auth();
        // Giữ phiên đăng nhập trên trình duyệt
        if (firebase.auth.Auth && firebase.auth.Auth.Persistence) {
            window.fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {});
        }
    } catch (e) {
        console.error('Firebase Auth init lỗi', e);
        window.fbAuth = null;
    }
} else {
    console.error('Firebase SDK chưa load');
    window.fbDB = null;
    window.fbAuth = null;
}

window.FIREBASE_CONFIG = FIREBASE_CONFIG;
