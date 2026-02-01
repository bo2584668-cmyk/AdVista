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

// Initialize Firebase للتخزين فقط
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Google Sign-In Configuration
const GOOGLE_CLIENT_ID = '805966277330-9j5j1nvluj69f8uieog0kk77p0jb46q4.apps.googleusercontent.com';

// Global Variables
let currentUser = null;
let currentAd = null;
let adTimerInterval = null;
let timerPausedAt = null;

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    initUI();
    checkGoogleAuthState();
    loadGlobalStats();
    loadPublicAds();
});

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
            navMenu.classList.remove('active');
            mobileToggle.innerHTML = '<i class="fas fa-bars"></i>';
        });
    });
    
    // Login button
    document.getElementById('loginBtn').addEventListener('click', function() {
        triggerGoogleSignIn();
    });
    
    // Dashboard login button
    document.getElementById('dashboardLoginBtn')?.addEventListener('click', function() {
        triggerGoogleSignIn();
    });
    
    // Logout button
    document.getElementById('logoutBtn')?.addEventListener('click', signOut);
    
    // Start earning button
    document.getElementById('startEarningBtn').addEventListener('click', function() {
        document.getElementById('ads').scrollIntoView({ behavior: 'smooth' });
    });
    
    // Ad filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterAds(this.dataset.filter);
        });
    });
    
    // Timer close button
    document.getElementById('closeTimerBtn').addEventListener('click', closeAdTimer);
    
    // Claim points button
    document.getElementById('claimPointsBtn').addEventListener('click', claimAdPoints);
}

// Trigger Google Sign-In
function triggerGoogleSignIn() {
    // Initialize Google Sign-In if not already initialized
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        google.accounts.id.prompt();
    } else {
        // Load Google Sign-In script
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = function() {
            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleSignIn,
                auto_select: false,
                cancel_on_tap_outside: true
            });
            google.accounts.id.prompt();
        };
        document.head.appendChild(script);
    }
}

// Handle Google Sign-In Response
function handleGoogleSignIn(response) {
    console.log("Google Sign-In Response:", response);
    
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
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
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
                localStorage.removeItem('google_token');
                localStorage.removeItem('user_data');
            }
        } catch (error) {
            console.error("Error checking auth state:", error);
            localStorage.removeItem('google_token');
            localStorage.removeItem('user_data');
        }
    }
    
    // Not logged in
    updateUIForLoggedOutUser();
}

// Sign Out
function signOut() {
    // Revoke Google token
    const token = localStorage.getItem('google_token');
    if (token && typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        google.accounts.id.revoke(token, function() {
            console.log("Token revoked successfully");
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
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('userProfile').style.display = 'flex';
    document.getElementById('userBalance').style.display = 'flex';
    
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    
    if (user.photoURL) {
        userAvatar.src = user.photoURL;
    } else {
        userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=4361ee&color=fff`;
    }
    
    userName.textContent = user.displayName || user.email;
    
    // Load user balance
    loadUserBalance(user.uid);
}

// Update UI for Logged Out User
function updateUIForLoggedOutUser() {
    document.getElementById('loginBtn').style.display = 'block';
    document.getElementById('userProfile').style.display = 'none';
    document.getElementById('userBalance').style.display = 'none';
    
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
        document.getElementById('dashboardLoginBtn').addEventListener('click', triggerGoogleSignIn);
    }
}

// Load User Balance
async function loadUserBalance(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            document.getElementById('balance').textContent = userData.balance || 0;
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
        document.getElementById('totalUsers').textContent = usersSnapshot.size;
        
        // Count active ads
        const adsSnapshot = await db.collection('ads').where('status', '==', 'active').get();
        document.getElementById('totalAds').textContent = adsSnapshot.size;
        
        // Calculate total payouts
        const usersData = await Promise.all(usersSnapshot.docs.map(doc => doc.data()));
        const totalPayouts = usersData.reduce((sum, user) => sum + (user.totalEarned || 0), 0);
        document.getElementById('totalPayouts').textContent = totalPayouts;
    } catch (error) {
        console.error('Error loading global stats:', error);
    }
}

// Load Public Ads
async function loadPublicAds() {
    try {
        const adsGrid = document.getElementById('adsGrid');
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
        
        displayAds(adsSnapshot.docs);
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
                <img src="${ad.image}" alt="${ad.title}" loading="lazy" onerror="this.src='https://picsum.photos/400/250?random=1'">
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
    
    if (filter === 'all') {
        allAds.forEach(ad => {
            ad.style.display = 'block';
        });
    } else {
        allAds.forEach(ad => {
            if (ad.dataset.category === filter) {
                ad.style.display = 'block';
            } else {
                ad.style.display = 'none';
            }
        });
    }
}

// Start Ad Timer
function startAdTimer(adId, title, duration, points) {
    if (!currentUser) {
        showNotification('يجب تسجيل الدخول أولاً', 'error');
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
    
    adTimerInterval = setInterval(() => {
        if (!currentAd.paused) {
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
    if (document.hidden) {
        pauseTimer();
        document.getElementById('timerStatus').innerHTML = '<i class="fas fa-exclamation-triangle"></i> تم إيقاف العد بسبب تركيز الصفحة';
        document.getElementById('timerStatus').style.backgroundColor = '#fef3c7';
        document.getElementById('timerStatus').style.color = '#92400e';
    } else {
        resumeTimer();
        document.getElementById('timerStatus').innerHTML = '<i class="fas fa-check-circle"></i> الإعلان قيد التشغيل';
        document.getElementById('timerStatus').style.backgroundColor = '#d1fae5';
        document.getElementById('timerStatus').style.color = '#065f46';
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
    currentAd.completed = true;
    
    // Show claim button
    document.getElementById('timerAction').style.display = 'block';
    document.getElementById('timerStatus').style.display = 'none';
    
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
                throw new Error('لقد شاهدت هذا الإعلان اليوم بالفعل');
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
        console.error('Error claiming points:', error);
        showNotification(error.message || 'حدث خطأ في المطالبة بالنقاط', 'error');
        closeAdTimer();
    }
}

// Close Ad Timer
function closeAdTimer() {
    const timerOverlay = document.getElementById('adTimerOverlay');
    timerOverlay.style.display = 'none';
    
    // Reset timer
    document.getElementById('timerSeconds').textContent = '30';
    document.querySelector('.timer-progress').style.strokeDashoffset = '339.292';
    document.getElementById('timerAction').style.display = 'none';
    document.getElementById('timerStatus').style.display = 'flex';
    document.getElementById('timerStatus').innerHTML = '<i class="fas fa-check-circle"></i> الإعلان قيد التشغيل';
    document.getElementById('timerStatus').style.backgroundColor = '#d1fae5';
    document.getElementById('timerStatus').style.color = '#065f46';
    
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
        document.getElementById('balance').textContent = userData.balance || 0;
        
        // Add event listeners
        document.getElementById('withdrawBtn')?.addEventListener('click', handleWithdraw);
        document.getElementById('redeemBtn')?.addEventListener('click', handleRedeem);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Update Balance
function updateBalance(pointsEarned) {
    const balanceElement = document.getElementById('balance');
    const currentBalance = parseInt(balanceElement.textContent) || 0;
    const newBalance = currentBalance + pointsEarned;
    balanceElement.textContent = newBalance;
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
