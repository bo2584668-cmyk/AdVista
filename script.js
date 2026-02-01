// Firebase Configuration للتخزين فقط
const firebaseConfig = {
    apiKey: "AIzaSyC4fZQ-BTUeHsN9nQtMGmnjJz-NKdcUgkc",
    authDomain: "advista-b64ab.firebaseapp.com",
    projectId: "advista-b64ab",
    storageBucket: "advista-b64ab.firebasestorage.app",
    messagingSenderId: "509713648189",
    appId: "1:509713648189:web:0ccd6ada1f4e07f85d3854",
    measurementId: "G-VG4S1SMKH8"
};

// Initialize Firebase للتخزين فقط - مع منع التكرار
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); // إذا تم التهيئة مسبقاً
}
const db = firebase.firestore();

// Google Sign-In Configuration
const GOOGLE_CLIENT_ID = '805966277330-9j5j1nvluj69f8uieog0kk77p0jb46q4.apps.googleusercontent.com';

// Global Variables
let currentUser = null;
let currentAd = null;
let adTimerInterval = null;
let timerPausedAt = null;
let googleSignInInitialized = false;

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    initUI();
    loadGoogleSignIn(); // تحميل مكتبة Google Sign-In أولاً
    checkGoogleAuthState();
    loadGlobalStats();
    loadPublicAds();
});

// تحميل مكتبة Google Sign-In
function loadGoogleSignIn() {
    // تحقق إذا كانت المكتبة محملة بالفعل
    if (typeof google !== 'undefined' && google.accounts) {
        console.log("Google Sign-In library already loaded");
        return;
    }
    
    console.log("Loading Google Sign-In library...");
    
    // إنشاء عنصر script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.id = 'google-signin-script';
    
    script.onload = function() {
        console.log("Google Sign-In library loaded successfully");
        initializeGoogleSignIn();
    };
    
    script.onerror = function() {
        console.error("Failed to load Google Sign-In library");
        showNotification('تعذر تحميل خدمة تسجيل الدخول من جوجل', 'error');
        
        // إعادة المحاولة بعد 3 ثواني
        setTimeout(() => {
            console.log("Retrying to load Google Sign-In...");
            loadGoogleSignIn();
        }, 3000);
    };
    
    document.head.appendChild(script);
}

// تهيئة Google Sign-In
function initializeGoogleSignIn() {
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
        console.error("Google Sign-In library not available");
        return;
    }
    
    try {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleSignIn,
            auto_select: false,
            cancel_on_tap_outside: true,
            context: 'signin',
            ux_mode: 'popup',
            itp_support: true
        });
        
        googleSignInInitialized = true;
        console.log("Google Sign-In initialized successfully");
        
        // إذا كان المستخدم مسجل دخول سابقاً، حاول استعادة الجلسة
        const token = localStorage.getItem('google_token');
        if (token) {
            google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    console.log("Google Sign-In prompt was not displayed or was skipped");
                }
            });
        }
        
    } catch (error) {
        console.error("Error initializing Google Sign-In:", error);
        showNotification('تعذر تهيئة تسجيل الدخول من جوجل', 'error');
    }
}

// Initialize UI
function initUI() {
    // Navigation
    const mobileToggle = document.getElementById('mobileToggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (mobileToggle) {
        mobileToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            this.innerHTML = navMenu.classList.contains('active') 
                ? '<i class="fas fa-times"></i>' 
                : '<i class="fas fa-bars"></i>';
        });
    }
    
    // Close menu when clicking on links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function() {
            if (navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
                if (mobileToggle) {
                    mobileToggle.innerHTML = '<i class="fas fa-bars"></i>';
                }
            }
        });
    });
    
    // Login button - تحديث لاستخدام وظيفة جديدة
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log("Login button clicked");
            triggerGoogleSignIn();
        });
        
        // إضافة مؤشر تحميل
        loginBtn.innerHTML = '<i class="fab fa-google"></i> تسجيل الدخول';
    }
    
    // Dashboard login button
    const dashboardLoginBtn = document.getElementById('dashboardLoginBtn');
    if (dashboardLoginBtn) {
        dashboardLoginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log("Dashboard login button clicked");
            triggerGoogleSignIn();
        });
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            signOut();
        });
    }
    
    // Start earning button
    const startEarningBtn = document.getElementById('startEarningBtn');
    if (startEarningBtn) {
        startEarningBtn.addEventListener('click', function() {
            const adsSection = document.getElementById('ads');
            if (adsSection) {
                adsSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
    
    // Ad filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterAds(this.dataset.filter);
        });
    });
    
    // Timer close button
    const closeTimerBtn = document.getElementById('closeTimerBtn');
    if (closeTimerBtn) {
        closeTimerBtn.addEventListener('click', closeAdTimer);
    }
    
    // Claim points button
    const claimPointsBtn = document.getElementById('claimPointsBtn');
    if (claimPointsBtn) {
        claimPointsBtn.addEventListener('click', claimAdPoints);
    }
}

// Trigger Google Sign-In - وظيفة محسنة
function triggerGoogleSignIn() {
    console.log("Triggering Google Sign-In...");
    console.log("Google Sign-In Initialized:", googleSignInInitialized);
    
    // إظهار مؤشر تحميل على الزر
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        const originalText = loginBtn.innerHTML;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحميل...';
        loginBtn.disabled = true;
        
        setTimeout(() => {
            loginBtn.innerHTML = originalText;
            loginBtn.disabled = false;
        }, 3000);
    }
    
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
        console.error("Google Sign-In library not loaded yet");
        showNotification('جاري تحميل خدمة تسجيل الدخول...', 'info');
        
        // إعادة تحميل المكتبة
        loadGoogleSignIn();
        
        // المحاولة مرة أخرى بعد تحميل المكتبة
        setTimeout(() => {
            if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
                console.log("Retrying Google Sign-In after library load");
                triggerGoogleSignIn();
            }
        }, 2000);
        return;
    }
    
    if (!googleSignInInitialized) {
        console.log("Google Sign-In not initialized, initializing now...");
        initializeGoogleSignIn();
        
        // المحاولة مرة أخرى بعد التهيئة
        setTimeout(() => {
            if (googleSignInInitialized) {
                triggerGoogleSignIn();
            }
        }, 1000);
        return;
    }
    
    try {
        console.log("Prompting Google Sign-In...");
        
        // طريقة 1: استخدام prompt مباشرة
        google.accounts.id.prompt((notification) => {
            console.log("Google Sign-In prompt notification:", notification);
            
            if (notification.isNotDisplayed()) {
                console.log("Prompt not displayed, reason:", notification.getNotDisplayedReason());
                
                // طريقة 2: محاولة استخدام renderButton كبديل
                showCustomGoogleButton();
            }
            
            if (notification.isSkippedMoment()) {
                console.log("Prompt was skipped");
                // يمكن إعادة المحاولة أو عرض زر مخصص
                showCustomGoogleButton();
            }
            
            if (notification.isDismissedMoment()) {
                console.log("Prompt was dismissed");
                showNotification('تم إلغاء تسجيل الدخول', 'info');
            }
        });
        
    } catch (error) {
        console.error("Error prompting Google Sign-In:", error);
        showNotification('حدث خطأ في تسجيل الدخول، حاول مرة أخرى', 'error');
        
        // عرض زر جوجل مخصص كحل بديل
        showCustomGoogleButton();
    }
}

// عرض زر جوجل مخصص كبديل
function showCustomGoogleButton() {
    console.log("Showing custom Google button as fallback...");
    
    // إنشاء زر جوجل مخصص
    const googleButtonContainer = document.createElement('div');
    googleButtonContainer.id = 'custom-google-button-container';
    googleButtonContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    googleButtonContainer.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; text-align: center; max-width: 400px;">
            <h3 style="margin-bottom: 20px;">تسجيل الدخول باستخدام جوجل</h3>
            <div id="google-signin-button" style="margin: 20px 0;"></div>
            <p style="color: #666; margin-bottom: 20px;">سيتم فتح نافذة جديدة لتسجيل الدخول</p>
            <button id="close-custom-modal" style="padding: 10px 20px; background: #f0f0f0; border: none; border-radius: 5px; cursor: pointer;">
                إلغاء
            </button>
        </div>
    `;
    
    document.body.appendChild(googleButtonContainer);
    
    // تهيئة زر جوجل في الحاوية المخصصة
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        google.accounts.id.renderButton(
            document.getElementById('google-signin-button'),
            {
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                shape: 'rectangular',
                logo_alignment: 'center',
                width: 250
            }
        );
    } else {
        // إذا لم تكن مكتبة جوجل متوفرة، عرض رسالة خطأ
        document.getElementById('google-signin-button').innerHTML = `
            <button style="padding: 12px 24px; background: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">
                <i class="fab fa-google" style="margin-left: 10px;"></i>
                تسجيل الدخول باستخدام جوجل
            </button>
        `;
        
        document.getElementById('google-signin-button').querySelector('button').addEventListener('click', function() {
            // فتح نافذة جديدة لتسجيل الدخول التقليدي
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(window.location.origin)}&response_type=token&scope=email%20profile&state=${Date.now()}`;
            window.open(authUrl, 'google_auth', 'width=500,height=600');
        });
    }
    
    // إضافة حدث لإغلاق النافذة
    document.getElementById('close-custom-modal').addEventListener('click', function() {
        document.body.removeChild(googleButtonContainer);
    });
}

// Handle Google Sign-In Response
function handleGoogleSignIn(response) {
    console.log("Google Sign-In Response received");
    
    // إزالة النافذة المخصصة إذا كانت موجودة
    const customModal = document.getElementById('custom-google-button-container');
    if (customModal) {
        document.body.removeChild(customModal);
    }
    
    // تحقق من صحة الاستجابة
    if (!response || !response.credential) {
        console.error("Invalid Google response:", response);
        showNotification('فشل تسجيل الدخول، حاول مرة أخرى', 'error');
        return;
    }
    
    try {
        // Decode JWT token
        const token = response.credential;
        const payload = decodeJWT(token);
        
        console.log("Decoded JWT Payload:", payload);
        
        // Create user object
        const user = {
            uid: payload.sub,
            displayName: payload.name,
            email: payload.email,
            photoURL: payload.picture,
            emailVerified: payload.email_verified
        };
        
        // Save token to localStorage
        localStorage.setItem('google_token', token);
        localStorage.setItem('user_data', JSON.stringify(user));
        
        // Initialize user in Firebase
        initializeUserData(user);
        
    } catch (error) {
        console.error("Error handling Google Sign-In:", error);
        showNotification('حدث خطأ أثناء تسجيل الدخول', 'error');
    }
}

// Decode JWT token
function decodeJWT(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error("Error decoding JWT:", error);
        throw error;
    }
}

// Check Google Auth State
function checkGoogleAuthState() {
    const token = localStorage.getItem('google_token');
    const userData = localStorage.getItem('user_data');
    
    if (token && userData) {
        try {
            const payload = decodeJWT(token);
            const currentTime = Math.floor(Date.now() / 1000);
            
            // Check if token is expired
            if (payload.exp && payload.exp > currentTime) {
                // Token is valid
                const user = JSON.parse(userData);
                currentUser = user;
                updateUIForLoggedInUser(user);
                loadUserAds();
                loadDashboard();
                return;
            } else {
                // Token expired
                console.log("Token expired, signing out...");
                signOut(); // استدعاء دالة تسجيل الخروج لتنظيف كل شيء
                return;
            }
        } catch (error) {
            console.error("Error checking auth state:", error);
            signOut(); // في حالة الخطأ، نعمل تسجيل خروج
        }
    }
    
    // Not logged in
    updateUIForLoggedOutUser();
}

// Sign Out
function signOut() {
    console.log("Signing out...");
    
    // إخفاء أي نافذة مخصصة
    const customModal = document.getElementById('custom-google-button-container');
    if (customModal) {
        document.body.removeChild(customModal);
    }
    
    // Revoke Google token
    const token = localStorage.getItem('google_token');
    if (token && typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        google.accounts.id.revoke(token, function(response) {
            console.log("Token revocation response:", response);
        });
    }
    
    // Clear localStorage
    localStorage.removeItem('google_token');
    localStorage.removeItem('user_data');
    
    // Update UI
    currentUser = null;
    updateUIForLoggedOutUser();
    showNotification('تم تسجيل الخروج بنجاح', 'success');
    
    // Reload ads
    loadPublicAds();
}

// Initialize User Data in Firebase
async function initializeUserData(user) {
    try {
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();
        
        const today = new Date().toDateString();
        const userData = {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            isAdmin: user.email === 'bo2584668@gmail.com'
        };
        
        if (!userDoc.exists) {
            // Create new user
            await userRef.set({
                ...userData,
                balance: 0,
                totalEarned: 0,
                dailyStats: {
                    adsWatched: 0,
                    pointsEarned: 0,
                    lastReset: today
                },
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showNotification('مرحباً بك في ادفيستا!', 'success');
        } else {
            // Update existing user
            const existingData = userDoc.data();
            
            if (existingData.dailyStats?.lastReset !== today) {
                await userRef.update({
                    ...userData,
                    'dailyStats.adsWatched': 0,
                    'dailyStats.pointsEarned': 0,
                    'dailyStats.lastReset': today
                });
            } else {
                await userRef.update(userData);
            }
        }
        
        // Update UI
        currentUser = user;
        updateUIForLoggedInUser(user);
        loadUserAds();
        loadDashboard();
        showNotification(`مرحباً ${user.displayName}!`, 'success');
        
    } catch (error) {
        console.error('Error initializing user data:', error);
        showNotification('حدث خطأ في تسجيل الدخول', 'error');
    }
}

// Update UI for Logged In User
function updateUIForLoggedInUser(user) {
    const loginBtn = document.getElementById('loginBtn');
    const userProfile = document.getElementById('userProfile');
    const userBalance = document.getElementById('userBalance');
    
    if (loginBtn) loginBtn.style.display = 'none';
    if (userProfile) userProfile.style.display = 'flex';
    if (userBalance) userBalance.style.display = 'flex';
    
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    
    if (user.photoURL && userAvatar) {
        userAvatar.src = user.photoURL;
    } else if (userAvatar) {
        userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=4361ee&color=fff`;
    }
    
    if (userName) {
        userName.textContent = user.displayName || user.email;
    }
    
    // Load user balance
    loadUserBalance(user.uid);
}

// Update UI for Logged Out User
function updateUIForLoggedOutUser() {
    const loginBtn = document.getElementById('loginBtn');
    const userProfile = document.getElementById('userProfile');
    const userBalance = document.getElementById('userBalance');
    
    if (loginBtn) {
        loginBtn.style.display = 'block';
        loginBtn.innerHTML = '<i class="fab fa-google"></i> تسجيل الدخول';
        loginBtn.disabled = false;
    }
    if (userProfile) userProfile.style.display = 'none';
    if (userBalance) userBalance.style.display = 'none';
    
    // Reset dashboard
    const dashboard = document.getElementById('userDashboard');
    if (dashboard) {
        dashboard.innerHTML = `
            <div class="login-required">
                <i class="fas fa-lock"></i>
                <h3>يجب تسجيل الدخول لعرض لوحة التحكم</h3>
                <p>سجل الدخول باستخدام حساب جوجل لمشاهدة رصيدك وإحصائياتك</p>
                <button class="btn btn-primary" id="dashboardLoginBtn">
                    <i class="fab fa-google"></i> تسجيل الدخول الآن
                </button>
            </div>
        `;
        
        // Re-attach event listener
        const dashboardLoginBtn = document.getElementById('dashboardLoginBtn');
        if (dashboardLoginBtn) {
            dashboardLoginBtn.addEventListener('click', function(e) {
                e.preventDefault();
                triggerGoogleSignIn();
            });
        }
    }
}

// Load User Balance
async function loadUserBalance(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const balanceElement = document.getElementById('balance');
            if (balanceElement) {
                balanceElement.textContent = userData.balance || 0;
            }
        }
    } catch (error) {
        console.error('Error loading user balance:', error);
    }
}

// Load Global Stats
async function loadGlobalStats() {
    try {
        // Count users
        const usersSnapshot = await db.collection('users').get();
        const totalUsersElement = document.getElementById('totalUsers');
        if (totalUsersElement) {
            totalUsersElement.textContent = usersSnapshot.size;
        }
        
        // Count active ads
        const adsSnapshot = await db.collection('ads').where('status', '==', 'active').get();
        const totalAdsElement = document.getElementById('totalAds');
        if (totalAdsElement) {
            totalAdsElement.textContent = adsSnapshot.size;
        }
        
        // Calculate total payouts
        const usersData = await Promise.all(usersSnapshot.docs.map(doc => doc.data()));
        const totalPayouts = usersData.reduce((sum, user) => sum + (user.totalEarned || 0), 0);
        const totalPayoutsElement = document.getElementById('totalPayouts');
        if (totalPayoutsElement) {
            totalPayoutsElement.textContent = totalPayouts;
        }
    } catch (error) {
        console.error('Error loading global stats:', error);
    }
}

// Load Public Ads
async function loadPublicAds() {
    try {
        const adsGrid = document.getElementById('adsGrid');
        if (!adsGrid) return;
        
        adsGrid.innerHTML = `
            <div class="loading-ads">
                <div class="spinner"></div>
                <p>جاري تحميل الإعلانات المتاحة...</p>
            </div>
        `;
        
        const adsSnapshot = await db.collection('ads')
            .where('status', '==', 'active')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
        
        if (adsSnapshot.empty) {
            await createSampleAds();
            loadPublicAds();
            return;
        }
        
        // للزوار، نمرر مجموعة فارغة للإعلانات المشاهدة
        displayAds(adsSnapshot.docs, new Set());
    } catch (error) {
        console.error('Error loading public ads:', error);
        showNotification('حدث خطأ في تحميل الإعلانات', 'error');
    }
}

// Load User Ads
async function loadUserAds() {
    try {
        if (!currentUser) return;
        
        const adsGrid = document.getElementById('adsGrid');
        if (!adsGrid) return;
        
        adsGrid.innerHTML = `
            <div class="loading-ads">
                <div class="spinner"></div>
                <p>جاري تحميل الإعلانات المتاحة...</p>
            </div>
        `;
        
        const adsSnapshot = await db.collection('ads')
            .where('status', '==', 'active')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
        
        if (adsSnapshot.empty) {
            await createSampleAds();
            loadUserAds();
            return;
        }
        
        // Get user's watched ads
        const userWatchedAds = await getUserWatchedAds();
        displayAds(adsSnapshot.docs, userWatchedAds);
    } catch (error) {
        console.error('Error loading user ads:', error);
        showNotification('حدث خطأ في تحميل الإعلانات', 'error');
    }
}

// Get User Watched Ads
async function getUserWatchedAds() {
    if (!currentUser) return new Set();
    
    try {
        const today = new Date().toDateString();
        const watchedSnapshot = await db.collection('adViews')
            .where('userId', '==', currentUser.uid)
            .where('date', '==', today)
            .get();
        
        const watchedAds = new Set();
        watchedSnapshot.forEach(doc => {
            watchedAds.add(doc.data().adId);
        });
        
        return watchedAds;
    } catch (error) {
        console.error('Error getting watched ads:', error);
        return new Set();
    }
}

// Create Sample Ads
async function createSampleAds() {
    try {
        const ads = [];
        
        for (let i = 1; i <= 20; i++) {
            const durations = [15, 20, 30, 45, 60];
            const duration = durations[Math.floor(Math.random() * durations.length)];
            const points = duration * 2;
            
            let category;
            if (duration <= 30) category = "short";
            else if (duration <= 60) category = "medium";
            else category = "long";
            
            const ad = {
                title: `إعلان ${i}: منتج جديد مذهل`,
                description: `شاهد هذا الإعلان لمدة ${duration} ثانية لتحصل على ${points} نقطة.`,
                link: "https://linkjust.com/xbTIX",
                image: `https://picsum.photos/400/250?random=${i}&t=${Date.now()}`,
                duration: duration,
                points: points,
                category: category,
                status: 'active',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: 'system'
            };
            
            ads.push(ad);
        }
        
        // Add ads to Firestore
        const batch = db.batch();
        ads.forEach(ad => {
            const adRef = db.collection('ads').doc();
            batch.set(adRef, ad);
        });
        
        await batch.commit();
        console.log('تم إنشاء 20 إعلان تجريبي');
    } catch (error) {
        console.error('Error creating sample ads:', error);
    }
}

// Display Ads
function displayAds(adDocs, watchedAds = new Set()) {
    const adsGrid = document.getElementById('adsGrid');
    if (!adsGrid) return;
    
    adsGrid.innerHTML = '';
    
    if (adDocs.length === 0) {
        adsGrid.innerHTML = '<div class="no-ads"><p>لا توجد إعلانات متاحة حالياً</p></div>';
        return;
    }
    
    adDocs.forEach(doc => {
        const ad = doc.data();
        const adId = doc.id;
        const isWatched = watchedAds.has(adId);
        
        const adCard = document.createElement('div');
        adCard.className = 'ad-card';
        adCard.dataset.category = ad.category;
        adCard.dataset.id = adId;
        
        adCard.innerHTML = `
            <div class="ad-image">
                <img src="${ad.image}" alt="${ad.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x250/4361ee/ffffff?text=AdVista'">
            </div>
            <div class="ad-content">
                <h3 class="ad-title">${ad.title}</h3>
                <p class="ad-description">${ad.description}</p>
                <div class="ad-details">
                    <div class="ad-points">
                        <i class="fas fa-coins"></i>
                        <span>${ad.points} نقطة</span>
                    </div>
                    <div class="ad-time">
                        <i class="fas fa-clock"></i>
                        <span>${ad.duration} ثانية</span>
                    </div>
                </div>
                ${isWatched ? 
                    `<div class="ad-status ad-completed">
                        <i class="fas fa-check-circle"></i> تمت المشاهدة اليوم
                    </div>` : 
                    `<button class="btn btn-primary btn-small watch-ad-btn" 
                            data-ad-id="${adId}"
                            data-title="${ad.title}"
                            data-duration="${ad.duration}"
                            data-points="${ad.points}">
                        <i class="fas fa-play-circle"></i> مشاهدة الإعلان
                    </button>`
                }
            </div>
        `;
        
        adsGrid.appendChild(adCard);
    });
    
    // Add event listeners to watch buttons
    document.querySelectorAll('.watch-ad-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const adId = this.dataset.adId;
            const title = this.dataset.title;
            const duration = parseInt(this.dataset.duration);
            const points = parseInt(this.dataset.points);
            
            startAdTimer(adId, title, duration, points);
        });
    });
}

// Filter Ads
function filterAds(filter) {
    const allAds = document.querySelectorAll('.ad-card');
    
    allAds.forEach(ad => {
        if (filter === 'all' || ad.dataset.category === filter) {
            ad.style.display = 'block';
        } else {
            ad.style.display = 'none';
        }
    });
}

// Start Ad Timer
function startAdTimer(adId, title, duration, points) {
    if (!currentUser) {
        showNotification('يجب تسجيل الدخول أولاً', 'error');
        // افتح نافذة تسجيل الدخول تلقائياً
        triggerGoogleSignIn();
        return;
    }
    
    currentAd = {
        id: adId,
        title: title,
        duration: duration,
        points: points,
        startTime: Date.now(),
        completed: false,
        paused: false,
        remainingTime: duration
    };
    
    // Show timer overlay
    const timerOverlay = document.getElementById('adTimerOverlay');
    const timerSeconds = document.getElementById('timerSeconds');
    const timerProgress = document.querySelector('.timer-progress');
    const adTimerTitle = document.getElementById('adTimerTitle');
    
    if (!timerOverlay || !timerSeconds || !timerProgress || !adTimerTitle) {
        showNotification('عناصر العداد غير موجودة', 'error');
        return;
    }
    
    timerOverlay.style.display = 'flex';
    timerSeconds.textContent = duration;
    adTimerTitle.textContent = `جاري مشاهدة: ${title}`;
    
    // Calculate progress circle
    const circleLength = 339.292;
    timerProgress.style.strokeDashoffset = circleLength;
    
    // Start countdown
    startCountdown(duration, circleLength);
    
    // Track focus events
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    
    console.log("بدأ الإعلان:", currentAd);
}

// Start Countdown
function startCountdown(duration, circleLength) {
    let timeLeft = duration;
    const timerSeconds = document.getElementById('timerSeconds');
    const timerProgress = document.querySelector('.timer-progress');
    
    if (!timerSeconds || !timerProgress) return;
    
    adTimerInterval = setInterval(() => {
        if (currentAd && !currentAd.paused) {
            timeLeft--;
            currentAd.remainingTime = timeLeft;
            timerSeconds.textContent = timeLeft;
            
            // Update progress circle
            const progress = (duration - timeLeft) / duration;
            timerProgress.style.strokeDashoffset = circleLength - (progress * circleLength);
            
            // If timer completes
            if (timeLeft <= 0) {
                clearInterval(adTimerInterval);
                adTimerComplete();
            }
        }
    }, 1000);
}

// Handle Visibility Change
function handleVisibilityChange() {
    const timerStatus = document.getElementById('timerStatus');
    if (!timerStatus) return;
    
    if (document.hidden) {
        pauseTimer();
        timerStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> تم إيقاف العد بسبب تركيز الصفحة';
        timerStatus.style.backgroundColor = '#fef3c7';
        timerStatus.style.color = '#92400e';
    } else {
        resumeTimer();
        timerStatus.innerHTML = '<i class="fas fa-check-circle"></i> الإعلان قيد التشغيل';
        timerStatus.style.backgroundColor = '#d1fae5';
        timerStatus.style.color = '#065f46';
    }
}

// Handle Window Blur
function handleWindowBlur() {
    pauseTimer();
}

// Handle Window Focus
function handleWindowFocus() {
    resumeTimer();
}

// Pause Timer
function pauseTimer() {
    if (currentAd && !currentAd.paused) {
        currentAd.paused = true;
        timerPausedAt = Date.now();
        console.log("تم إيقاف العداد");
    }
}

// Resume Timer
function resumeTimer() {
    if (currentAd && currentAd.paused) {
        currentAd.paused = false;
        const pauseDuration = Date.now() - timerPausedAt;
        timerPausedAt = null;
        console.log("تم استئناف العداد بعد:", pauseDuration, "ms");
    }
}

// Ad Timer Complete
function adTimerComplete() {
    if (currentAd) {
        currentAd.completed = true;
    }
    
    // Show claim button
    const timerAction = document.getElementById('timerAction');
    const timerStatus = document.getElementById('timerStatus');
    
    if (timerAction) timerAction.style.display = 'block';
    if (timerStatus) {
        timerStatus.style.display = 'none';
    }
    
    // Remove event listeners
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('blur', handleWindowBlur);
    window.removeEventListener('focus', handleWindowFocus);
    
    console.log("اكتمل الإعلان بنجاح");
}

// Claim Ad Points
async function claimAdPoints() {
    if (!currentUser || !currentAd || !currentAd.completed) {
        showNotification('لا يمكنك المطالبة بالنقاط الآن', 'error');
        return;
    }
    
    try {
        const userRef = db.collection('users').doc(currentUser.uid);
        const today = new Date().toDateString();
        
        // Start a transaction
        await db.runTransaction(async (transaction) => {
            // Get user data
            const userDoc = await transaction.get(userRef);
            const userData = userDoc.data();
            
            // Check if ad already watched today
            const adViewRef = db.collection('adViews').doc(`${currentUser.uid}_${currentAd.id}_${today}`);
            const adViewDoc = await transaction.get(adViewRef);
            
            if (adViewDoc.exists) {
                // لا ترمي خطأ، فقط أخبر المستخدم وأغلق العداد
                showNotification('لقد شاهدت هذا الإعلان اليوم بالفعل', 'warning');
                closeAdTimer();
                // نرمي خطأ لإيقاف المعاملة، ولكن لن نعرضه كخطأ للمستخدم
                throw new Error('Ad already watched today');
            }
            
            // Record ad view
            transaction.set(adViewRef, {
                userId: currentUser.uid,
                adId: currentAd.id,
                date: today,
                points: currentAd.points,
                watchedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Update user balance and stats
            const newBalance = (userData.balance || 0) + currentAd.points;
            const newTotalEarned = (userData.totalEarned || 0) + currentAd.points;
            const dailyAdsWatched = (userData.dailyStats?.adsWatched || 0) + 1;
            const dailyPointsEarned = (userData.dailyStats?.pointsEarned || 0) + currentAd.points;
            
            transaction.update(userRef, {
                balance: newBalance,
                totalEarned: newTotalEarned,
                'dailyStats.adsWatched': dailyAdsWatched,
                'dailyStats.pointsEarned': dailyPointsEarned,
                lastActivity: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        
        // Update UI
        updateBalance(currentAd.points);
        showNotification(`مبروك! لقد ربحت ${currentAd.points} نقطة`, 'success');
        
        // Close timer
        closeAdTimer();
        
        // Reload ads to update status
        loadUserAds();
        loadDashboard();
        
        console.log("تمت إضافة النقاط:", currentAd.points);
        
    } catch (error) {
        // تجاهل الخطأ إذا كان بسبب مشاهدة الإعلان مسبقاً
        if (error.message !== 'Ad already watched today') {
            console.error('Error claiming points:', error);
            showNotification(error.message || 'حدث خطأ في المطالبة بالنقاط', 'error');
            closeAdTimer();
        }
    }
}

// Close Ad Timer
function closeAdTimer() {
    const timerOverlay = document.getElementById('adTimerOverlay');
    if (timerOverlay) {
        timerOverlay.style.display = 'none';
    }
    
    // Reset timer
    const timerSeconds = document.getElementById('timerSeconds');
    const timerProgress = document.querySelector('.timer-progress');
    const timerAction = document.getElementById('timerAction');
    const timerStatus = document.getElementById('timerStatus');
    
    if (timerSeconds) timerSeconds.textContent = '30';
    if (timerProgress) timerProgress.style.strokeDashoffset = '339.292';
    if (timerAction) timerAction.style.display = 'none';
    if (timerStatus) {
        timerStatus.style.display = 'flex';
        timerStatus.innerHTML = '<i class="fas fa-check-circle"></i> الإعلان قيد التشغيل';
        timerStatus.style.backgroundColor = '#d1fae5';
        timerStatus.style.color = '#065f46';
    }
    
    // Remove event listeners
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('blur', handleWindowBlur);
    window.removeEventListener('focus', handleWindowFocus);
    
    // Clear interval
    if (adTimerInterval) {
        clearInterval(adTimerInterval);
        adTimerInterval = null;
        
        if (currentAd && !currentAd.completed) {
            console.log("تم إغلاق الإعلان قبل اكتماله");
        }
    }
    
    currentAd = null;
    timerPausedAt = null;
}

// Load Dashboard
async function loadDashboard() {
    if (!currentUser) return;
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userData = userDoc.data();
        
        const dashboard = document.getElementById('userDashboard');
        if (!dashboard) return;
        
        dashboard.innerHTML = `
            <div class="dashboard-card balance-card">
                <div class="card-icon">
                    <i class="fas fa-wallet"></i>
                </div>
                <h3>رصيدك الحالي</h3>
                <p class="balance-amount">${userData.balance || 0} نقطة</p>
                <p class="balance-value">≈ $${((userData.balance || 0) / 100).toFixed(2)}</p>
                <button class="btn btn-small" id="withdrawBtn" ${(userData.balance || 0) < 500 ? 'disabled' : ''}>
                    ${(userData.balance || 0) < 500 ? 'الحد الأدنى للسحب 500 نقطة' : 'سحب الأرباح'}
                </button>
            </div>
            
            <div class="dashboard-card stats-card">
                <div class="card-icon">
                    <i class="fas fa-chart-bar"></i>
                </div>
                <h3>إحصائيات اليوم</h3>
                <div class="stats-list">
                    <div class="stat-item">
                        <span>الإعلانات المشاهدة</span>
                        <span>${userData.dailyStats?.adsWatched || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span>النقاط المكتسبة</span>
                        <span>${userData.dailyStats?.pointsEarned || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span>الدقائق المستثمرة</span>
                        <span>${Math.floor((userData.dailyStats?.pointsEarned || 0) / 2)}</span>
                    </div>
                </div>
            </div>
            
            <div class="dashboard-card tasks-card">
                <div class="card-icon">
                    <i class="fas fa-tasks"></i>
                </div>
                <h3>المهام المتاحة</h3>
                <div class="tasks-list" id="availableTasks">
                    <div class="task-item">
                        <span>شاهد 5 إعلانات اليوم</span>
                        <span class="task-progress">${Math.min(userData.dailyStats?.adsWatched || 0, 5)}/5</span>
                    </div>
                    <div class="task-item">
                        <span>اجمع 100 نقطة اليوم</span>
                        <span class="task-progress">${Math.min(userData.dailyStats?.pointsEarned || 0, 100)}/100</span>
                    </div>
                    <div class="task-item">
                        <span>سجل دخول 7 أيام متتالية</span>
                        <span class="task-progress">0/7</span>
                    </div>
                </div>
            </div>
            
            <div class="dashboard-card rewards-card">
                <div class="card-icon">
                    <i class="fas fa-gift"></i>
                </div>
                <h3>المكافآت</h3>
                <div class="rewards-list">
                    <div class="reward-item">
                        <span>500 نقطة</span>
                        <span>$5</span>
                    </div>
                    <div class="reward-item">
                        <span>1,000 نقطة</span>
                        <span>$10</span>
                    </div>
                    <div class="reward-item">
                        <span>2,500 نقطة</span>
                        <span>$25</span>
                    </div>
                    <div class="reward-item">
                        <span>5,000 نقطة</span>
                        <span>$50</span>
                    </div>
                </div>
                <button class="btn btn-small" id="redeemBtn">استبدال النقاط</button>
            </div>
        `;
        
        // Update balance in navbar
        updateBalance(0); // هذا سيعرض الرصيد الحالي فقط
        
        // Add event listeners
        const withdrawBtn = document.getElementById('withdrawBtn');
        if (withdrawBtn) {
            withdrawBtn.addEventListener('click', handleWithdraw);
        }
        
        const redeemBtn = document.getElementById('redeemBtn');
        if (redeemBtn) {
            redeemBtn.addEventListener('click', handleRedeem);
        }
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Update Balance
function updateBalance(pointsEarned) {
    const balanceElement = document.getElementById('balance');
    if (balanceElement) {
        const currentBalance = parseInt(balanceElement.textContent) || 0;
        const newBalance = currentBalance + pointsEarned;
        balanceElement.textContent = newBalance;
    }
}

// Handle Withdraw
function handleWithdraw() {
    showNotification('سيتم تفعيل نظام السحب قريباً', 'info');
}

// Handle Redeem
function handleRedeem() {
    showNotification('سيتم تفعيل نظام الاستبدال قريباً', 'info');
}

// Show Notification
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 
                          type === 'error' ? 'exclamation-circle' : 
                          type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(-50%) translateY(-20px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, 5000);
}

// Error handling
window.addEventListener('error', function(e) {
    console.error('حدث خطأ:', e.error);
    showNotification('حدث خطأ غير متوقع، يرجى تحديث الصفحة', 'error');
});

// Handle offline/online status
window.addEventListener('online', function() {
    showNotification('تم استعادة الاتصال بالإنترنت', 'success');
});

window.addEventListener('offline', function() {
    showNotification('فقدت الاتصال بالإنترنت', 'warning');
});

// معالجة رسائل Google Sign-In من النوافذ المنبثقة
window.addEventListener('message', function(event) {
    console.log("Message received:", event);
    
    // تحقق من مصدر الرسالة
    if (event.origin !== window.location.origin) {
        return;
    }
    
    // معالجة رسائل Google Sign-In
    if (event.data && event.data.type === 'google_auth_response') {
        console.log("Google auth response received:", event.data);
        handleGoogleSignIn({ credential: event.data.token });
    }
});

// إضافة حدث لفحص حالة Google Sign-In بشكل دوري
setInterval(() => {
    if (!googleSignInInitialized && typeof google !== 'undefined' && google.accounts) {
        console.log("Auto-initializing Google Sign-In...");
        initializeGoogleSignIn();
    }
}, 5000);
