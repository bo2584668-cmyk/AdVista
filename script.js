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
let userBalance = 0;

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    initUI();
    initGoogleSignIn();
    checkGoogleAuthState();
    loadGlobalStats();
    loadPublicAds();
});

// Initialize Google Sign-In
function initGoogleSignIn() {
    // Wait for Google script to load
    if (typeof google !== 'undefined') {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleSignInResponse,
            auto_select: false,
            cancel_on_tap_outside: true
        });
        
        // Show Google Sign-In button
        const googleSignInBtn = document.getElementById('g_id_signin');
        if (googleSignInBtn) {
            google.accounts.id.renderButton(googleSignInBtn, {
                type: 'standard',
                theme: 'filled_blue',
                size: 'medium',
                text: 'signin_with',
                shape: 'rectangular',
                logo_alignment: 'left',
                width: '200'
            });
        }
    }
}

// Handle Google Sign-In Response (global function)
window.handleGoogleSignInResponse = function(response) {
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
};

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

// Initialize UI
function initUI() {
    // Navigation Menu Toggle
    const mobileToggle = document.getElementById('mobileToggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (mobileToggle) {
        mobileToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            document.body.classList.toggle('menu-open');
            this.classList.toggle('active');
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(event) {
            if (!navMenu.contains(event.target) && !mobileToggle.contains(event.target)) {
                navMenu.classList.remove('active');
                mobileToggle.classList.remove('active');
                document.body.classList.remove('menu-open');
            }
        });
    }
    
    // Close menu when clicking on links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function() {
            navMenu.classList.remove('active');
            mobileToggle.classList.remove('active');
            document.body.classList.remove('menu-open');
        });
    });
    
    // Login button
    document.getElementById('loginBtn').addEventListener('click', triggerGoogleSignIn);
    document.getElementById('dashboardLoginBtn')?.addEventListener('click', triggerGoogleSignIn);
    document.getElementById('withdrawLoginBtn')?.addEventListener('click', triggerGoogleSignIn);
    
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
    
    // Withdraw modal
    document.getElementById('closeWithdrawModal').addEventListener('click', closeWithdrawModal);
    document.getElementById('closeConfirmModal').addEventListener('click', closeConfirmModal);
    document.getElementById('closeConfirmBtn').addEventListener('click', closeConfirmModal);
    
    // Withdraw form
    document.getElementById('withdrawForm')?.addEventListener('submit', handleWithdrawRequest);
    
    // Withdraw amount input
    document.getElementById('withdrawAmount')?.addEventListener('input', updateWithdrawSummary);
}

// Trigger Google Sign-In
function triggerGoogleSignIn() {
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        google.accounts.id.prompt();
    } else {
        // If Google script not loaded, reload page
        location.reload();
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
                loadUserData();
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

// Load User Data
async function loadUserData() {
    if (!currentUser) return;
    
    await loadUserAds();
    await loadDashboard();
    await loadWithdrawSection();
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
    userBalance = 0;
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
                totalWithdrawn: 0,
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
        loadUserData();
        showNotification(`مرحباً ${user.displayName}!`, 'success');
        
    } catch (error) {
        console.error('Error initializing user data:', error);
        showNotification('حدث خطأ في تسجيل الدخول', 'error');
    }
}

// Update UI for Logged In User
function updateUIForLoggedInUser(user) {
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('g_id_signin').style.display = 'none';
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
}

// Update UI for Logged Out User
function updateUIForLoggedOutUser() {
    document.getElementById('loginBtn').style.display = 'block';
    document.getElementById('g_id_signin').style.display = 'block';
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
    
    // Reset withdraw section
    const withdrawContainer = document.getElementById('withdrawContainer');
    if (withdrawContainer) {
        withdrawContainer.innerHTML = `
            <div class="login-required">
                <i class="fas fa-lock"></i>
                <h3>يجب تسجيل الدخول لعرض قسم السحب</h3>
                <p>سجل الدخول باستخدام حساب جوجل لطلب سحب أرباحك</p>
                <button class="btn btn-primary" id="withdrawLoginBtn">
                    <i class="fab fa-google"></i> تسجيل الدخول الآن
                </button>
            </div>
        `;
        
        // Re-attach event listener
        document.getElementById('withdrawLoginBtn').addEventListener('click', triggerGoogleSignIn);
    }
}

// Load User Balance
async function loadUserBalance() {
    if (!currentUser) return 0;
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            userBalance = userData.balance || 0;
            document.getElementById('balance').textContent = userBalance.toLocaleString();
            return userBalance;
        }
    } catch (error) {
        console.error('Error loading user balance:', error);
    }
    return 0;
}

// Load Global Stats
async function loadGlobalStats() {
    try {
        // Count users
        const usersSnapshot = await db.collection('users').get();
        document.getElementById('totalUsers').textContent = usersSnapshot.size.toLocaleString();
        
        // Count active ads
        const adsSnapshot = await db.collection('ads').where('status', '==', 'active').get();
        document.getElementById('totalAds').textContent = adsSnapshot.size.toLocaleString();
        
        // Calculate total payouts
        const usersData = await Promise.all(usersSnapshot.docs.map(doc => doc.data()));
        const totalPayouts = usersData.reduce((sum, user) => sum + (user.totalEarned || 0), 0);
        document.getElementById('totalPayouts').textContent = (totalPayouts / 20000).toFixed(2);
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
                        <span>${ad.points.toLocaleString()} نقطة</span>
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
        userBalance += currentAd.points;
        document.getElementById('balance').textContent = userBalance.toLocaleString();
        showNotification(`مبروك! لقد ربحت ${currentAd.points.toLocaleString()} نقطة`, 'success');
        
        // Close timer
        closeAdTimer();
        
        // Reload user data
        loadUserData();
        
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
        userBalance = userData.balance || 0;
        
        const dashboard = document.getElementById('userDashboard');
        dashboard.innerHTML = `
            <div class="dashboard-card balance-card">
                <div class="card-icon">
                    <i class="fas fa-wallet"></i>
                </div>
                <h3>رصيدك الحالي</h3>
                <p class="balance-amount">${userBalance.toLocaleString()} نقطة</p>
                <p class="balance-value">≈ $${(userBalance / 20000).toFixed(2)}</p>
                <button class="btn btn-small" id="withdrawBtn" ${userBalance < 20000 ? 'disabled' : ''}>
                    ${userBalance < 20000 ? 'الحد الأدنى للسحب 20,000 نقطة' : 'سحب الأرباح'}
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
                        <span>20,000 نقطة</span>
                        <span>$1</span>
                    </div>
                    <div class="reward-item">
                        <span>100,000 نقطة</span>
                        <span>$5</span>
                    </div>
                    <div class="reward-item">
                        <span>200,000 نقطة</span>
                        <span>$10</span>
                    </div>
                    <div class="reward-item">
                        <span>1,000,000 نقطة</span>
                        <span>$50</span>
                    </div>
                </div>
                <button class="btn btn-small" id="redeemBtn">استبدال النقاط</button>
            </div>
        `;
        
        // Update balance in navbar
        document.getElementById('balance').textContent = userBalance.toLocaleString();
        
        // Add event listeners
        document.getElementById('withdrawBtn')?.addEventListener('click', openWithdrawModal);
        document.getElementById('redeemBtn')?.addEventListener('click', handleRedeem);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Load Withdraw Section
async function loadWithdrawSection() {
    if (!currentUser) return;
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userData = userDoc.data();
        userBalance = userData.balance || 0;
        
        // Get user's withdrawal requests
        const withdrawRequests = await getUserWithdrawRequests();
        
        const withdrawContainer = document.getElementById('withdrawContainer');
        withdrawContainer.innerHTML = `
            <div class="withdraw-info">
                <h3><i class="fas fa-info-circle"></i> معلومات السحب</h3>
                <div class="withdraw-rules">
                    <ul>
                        <li><i class="fas fa-exclamation-circle"></i> الحد الأدنى للسحب: 20,000 نقطة (1 دولار)</li>
                        <li><i class="fas fa-exclamation-circle"></i> نسبة التحويل: 20,000 نقطة = 1 دولار</li>
                        <li><i class="fas fa-exclamation-circle"></i> يجب أن يكون لديك حساب فودافون كاش</li>
                        <li><i class="fas fa-exclamation-circle"></i> تتم المراجعة والتحويل خلال 24-48 ساعة</li>
                        <li><i class="fas fa-exclamation-circle"></i> يمكنك تتبع حالة طلب السحب أدناه</li>
                    </ul>
                </div>
                
                <div class="withdraw-stats">
                    <div class="withdraw-stat">
                        <h4>رصيدك الحالي</h4>
                        <p>${userBalance.toLocaleString()} نقطة</p>
                    </div>
                    <div class="withdraw-stat">
                        <h4>القيمة بالدولار</h4>
                        <p>$${(userBalance / 20000).toFixed(2)}</p>
                    </div>
                    <div class="withdraw-stat">
                        <h4>المسحوب سابقاً</h4>
                        <p>${(userData.totalWithdrawn || 0).toLocaleString()} نقطة</p>
                    </div>
                    <div class="withdraw-stat">
                        <h4>المجموع المكتسب</h4>
                        <p>${(userData.totalEarned || 0).toLocaleString()} نقطة</p>
                    </div>
                </div>
                
                <button class="btn btn-primary btn-large" id="requestWithdrawBtn" ${userBalance < 20000 ? 'disabled' : ''}>
                    <i class="fas fa-money-bill-wave"></i> طلب سحب جديد
                </button>
            </div>
            
            <div class="withdraw-requests">
                <h3><i class="fas fa-history"></i> طلبات السحب السابقة</h3>
                ${withdrawRequests.length > 0 ? 
                    withdrawRequests.map(request => `
                        <div class="request-item">
                            <div class="request-info">
                                <h4>طلب سحب #${request.requestId}</h4>
                                <div class="request-details">
                                    <span><i class="fas fa-calendar"></i> ${request.requestDate}</span>
                                    <span><i class="fas fa-coins"></i> ${request.amount.toLocaleString()} نقطة</span>
                                    <span><i class="fas fa-dollar-sign"></i> $${(request.amount / 20000).toFixed(2)}</span>
                                </div>
                            </div>
                            <div class="request-status status-${request.status}">
                                ${getStatusText(request.status)}
                            </div>
                        </div>
                    `).join('') : 
                    `<div class="no-requests">
                        <i class="fas fa-file-invoice-dollar"></i>
                        <h4>لا توجد طلبات سحب سابقة</h4>
                        <p>يمكنك طلب سحب أرباحك بمجرد وصول رصيدك إلى 20,000 نقطة</p>
                    </div>`
                }
            </div>
        `;
        
        // Add event listener for withdraw button
        document.getElementById('requestWithdrawBtn')?.addEventListener('click', openWithdrawModal);
        
    } catch (error) {
        console.error('Error loading withdraw section:', error);
    }
}

// Get User Withdraw Requests
async function getUserWithdrawRequests() {
    if (!currentUser) return [];
    
    try {
        const requestsSnapshot = await db.collection('withdrawals')
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
        
        const requests = [];
        requestsSnapshot.forEach(doc => {
            const data = doc.data();
            const requestDate = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('ar-SA') : 'غير معروف';
            
            requests.push({
                requestId: doc.id.substring(0, 8),
                amount: data.amount || 0,
                status: data.status || 'pending',
                requestDate: requestDate
            });
        });
        
        return requests;
    } catch (error) {
        console.error('Error getting withdraw requests:', error);
        return [];
    }
}

// Get Status Text
function getStatusText(status) {
    switch(status) {
        case 'pending': return 'قيد المراجعة';
        case 'approved': return 'تم الموافقة';
        case 'rejected': return 'مرفوض';
        case 'completed': return 'تم التحويل';
        default: return 'غير معروف';
    }
}

// Open Withdraw Modal
function openWithdrawModal() {
    if (!currentUser) {
        showNotification('يجب تسجيل الدخول أولاً', 'error');
        return;
    }
    
    if (userBalance < 20000) {
        showNotification('الحد الأدنى للسحب هو 20,000 نقطة', 'error');
        return;
    }
    
    // Update summary
    document.getElementById('currentBalanceSummary').textContent = `${userBalance.toLocaleString()} نقطة`;
    document.getElementById('withdrawAmount').value = 20000;
    document.getElementById('withdrawAmount').min = 20000;
    document.getElementById('withdrawAmount').max = userBalance;
    
    updateWithdrawSummary();
    
    // Show modal
    document.getElementById('withdrawModal').style.display = 'flex';
}

// Close Withdraw Modal
function closeWithdrawModal() {
    document.getElementById('withdrawModal').style.display = 'none';
}

// Close Confirm Modal
function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
    closeWithdrawModal();
}

// Update Withdraw Summary
function updateWithdrawSummary() {
    const amountInput = document.getElementById('withdrawAmount');
    if (!amountInput) return;
    
    const amount = parseInt(amountInput.value) || 0;
    const maxAmount = Math.min(userBalance, 1000000); // Limit to 1,000,000 points max per request
    
    // Validate amount
    if (amount < 20000) {
        amountInput.value = 20000;
        updateWithdrawSummary();
        return;
    }
    
    if (amount > maxAmount) {
        amountInput.value = maxAmount;
        updateWithdrawSummary();
        return;
    }
    
    // Calculate dollar value
    const dollarValue = amount / 20000;
    const remainingBalance = userBalance - amount;
    
    // Update UI
    document.getElementById('amountInDollars').textContent = `= $${dollarValue.toFixed(2)}`;
    document.getElementById('requestedAmount').textContent = `${amount.toLocaleString()} نقطة`;
    document.getElementById('amountInDollar').textContent = `$${dollarValue.toFixed(2)}`;
    document.getElementById('remainingBalance').textContent = `${remainingBalance.toLocaleString()} نقطة`;
}

// Handle Withdraw Request
async function handleWithdrawRequest(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showNotification('يجب تسجيل الدخول أولاً', 'error');
        return;
    }
    
    const amount = parseInt(document.getElementById('withdrawAmount').value);
    const vodafoneNumber = document.getElementById('vodafoneNumber').value;
    const notes = document.getElementById('withdrawNotes').value;
    
    // Validate amount
    if (amount < 20000) {
        showNotification('الحد الأدنى للسحب هو 20,000 نقطة', 'error');
        return;
    }
    
    if (amount > userBalance) {
        showNotification('رصيدك غير كافي', 'error');
        return;
    }
    
    // Validate Vodafone number
    if (!vodafoneNumber || !/^01[0-9]{9}$/.test(vodafoneNumber)) {
        showNotification('يرجى إدخال رقم فودافون كاش صحيح (11 رقم)', 'error');
        return;
    }
    
    try {
        // Start transaction
        await db.runTransaction(async (transaction) => {
            // Get user data
            const userRef = db.collection('users').doc(currentUser.uid);
            const userDoc = await transaction.get(userRef);
            const userData = userDoc.data();
            
            // Check if user has enough balance
            if ((userData.balance || 0) < amount) {
                throw new Error('رصيدك غير كافي');
            }
            
            // Create withdrawal request
            const withdrawalRef = db.collection('withdrawals').doc();
            const withdrawalData = {
                withdrawalId: withdrawalRef.id,
                userId: currentUser.uid,
                userEmail: currentUser.email,
                userName: currentUser.displayName,
                amount: amount,
                dollarValue: amount / 20000,
                vodafoneNumber: vodafoneNumber,
                notes: notes || '',
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Update user balance
            const newBalance = (userData.balance || 0) - amount;
            const totalWithdrawn = (userData.totalWithdrawn || 0) + amount;
            
            transaction.set(withdrawalRef, withdrawalData);
            transaction.update(userRef, {
                balance: newBalance,
                totalWithdrawn: totalWithdrawn
            });
        });
        
        // Update local balance
        userBalance -= amount;
        document.getElementById('balance').textContent = userBalance.toLocaleString();
        
        // Show success message
        document.getElementById('withdrawModal').style.display = 'none';
        document.getElementById('confirmModal').style.display = 'flex';
        
        // Reset form
        document.getElementById('withdrawForm').reset();
        
        // Reload user data
        loadUserData();
        
        // Send notification to admin
        await sendAdminNotification(amount, vodafoneNumber);
        
    } catch (error) {
        console.error('Error processing withdraw request:', error);
        showNotification(error.message || 'حدث خطأ في معالجة طلب السحب', 'error');
    }
}

// Send Notification to Admin
async function sendAdminNotification(amount, vodafoneNumber) {
    try {
        const notificationRef = db.collection('adminNotifications').doc();
        const notificationData = {
            type: 'withdrawal_request',
            title: 'طلب سحب جديد',
            message: `طلب سحب جديد من ${currentUser.displayName || currentUser.email}`,
            details: {
                userId: currentUser.uid,
                userName: currentUser.displayName,
                userEmail: currentUser.email,
                amount: amount,
                dollarValue: amount / 20000,
                vodafoneNumber: vodafoneNumber
            },
            isRead: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await notificationRef.set(notificationData);
        console.log('تم إرسال إشعار للمشرف');
    } catch (error) {
        console.error('Error sending admin notification:', error);
    }
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

// Initialize Google Sign-In on window load
window.addEventListener('load', function() {
    if (typeof google !== 'undefined') {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleSignInResponse,
            auto_select: false,
            cancel_on_tap_outside: true
        });
        
        // Try to auto sign-in
        google.accounts.id.prompt();
    }
});
