import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithCredential, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, arrayUnion, query, where, getDocs, onSnapshot, increment, addDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-analytics.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC4fZQ-BTUeHsN9nQtMGmnjJz-NKdcUgkc",
    authDomain: "advista-b64ab.firebaseapp.com",
    projectId: "advista-b64ab",
    storageBucket: "advista-b64ab.firebasestorage.app",
    messagingSenderId: "509713648189",
    appId: "1:509713648189:web:d662e29e808f6ab65d3854",
    measurementId: "G-EHNL172NNT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

// Setup globally accessible firebase object
(window as any).firebase = {
    auth: auth,
    db: db,
    analytics: analytics,
    signOut: signOut,
    onAuthStateChanged: (a: any, cb: any) => onAuthStateChanged(a, cb),
    firestore: {
        collection: collection,
        doc: doc,
        setDoc: setDoc,
        getDoc: getDoc,
        updateDoc: updateDoc,
        arrayUnion: arrayUnion,
        query: query,
        where: where,
        getDocs: getDocs,
        onSnapshot: (ref: any, cb: any) => onSnapshot(ref, cb),
        increment: increment,
        addDoc: addDoc
    }
};

// Handle Google Credential Response from GIS
(window as any).handleCredentialResponse = async (response: any) => {
    try {
        const idToken = response.credential;
        const credential = GoogleAuthProvider.credential(idToken);
        
        // Use Firebase Auth to sign in with the credential received from Google Identity
        await signInWithCredential(auth, credential);
        
    } catch (error) {
        console.error('Google Auth Error:', error);
        showNotification('حدث خطأ في تسجيل الدخول عبر جوجل', 'error');
    }
};

// Constants
const POINTS_PER_AD = 50;
const WELCOME_POINTS = 100;
const POINTS_PER_DOLLAR = 20000;
const ADMIN_EMAIL = "bo2584668@gmail.com";

// Global variables
let currentUser: any = null;
let userData: any = null;
let currentAdId: any = null;
let timerInterval: any = null;
let secondsLeft = 30;
let isWatchingAd = false;

// Initialize app
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Check auth state
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                await handleUserLogin(user);
                // Reload stats after login in case permissions are restricted to auth users
                loadPublicStats();
            } else {
                showLoginPage();
            }
            hideLoading();
        });
        
        // Initial attempt to load public stats
        loadPublicStats();
        
    } catch (error) {
        console.error('App initialization error:', error);
        showNotification('حدث خطأ في تحميل التطبيق', 'error');
        hideLoading();
    }
});

// Event Listeners
document.getElementById('logoutBtn')?.addEventListener('click', handleSignOut);
document.getElementById('submitWithdrawalBtn')?.addEventListener('click', submitWithdrawal);
document.getElementById('withdrawAmount')?.addEventListener('input', updateRequiredPoints);
document.getElementById('refreshAdminBtn')?.addEventListener('click', refreshAdminData);

// Attach global functions used in HTML
(window as any).startWatchingAd = startWatchingAd;
(window as any).approveWithdrawal = approveWithdrawal;
(window as any).rejectWithdrawal = rejectWithdrawal;
(window as any).refreshAdminData = refreshAdminData;

// Handle user login
async function handleUserLogin(user: any) {
    try {
        // Create or update user data
        await createOrUpdateUser(user);
        
        // Load user data
        await loadUserData();
        
        // Show main page
        showMainPage();
        
        showNotification(`مرحباً ${user.displayName}!`, 'success');
        
    } catch (error) {
        console.error('Login handling error:', error);
        showNotification('حدث خطأ في معالجة تسجيل الدخول', 'error');
    }
}

// Create or update user
async function createOrUpdateUser(user: any) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
        // New user - give welcome points
        await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            points: WELCOME_POINTS,
            totalPoints: WELCOME_POINTS,
            adsWatched: 0,
            timeWatched: 0,
            totalEarned: 0,
            withdrawals: [],
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            isAdmin: user.email === ADMIN_EMAIL
        });
    } else {
        // Update last login
        await updateDoc(userRef, {
            lastLogin: new Date().toISOString()
        });
    }
}

// Load user data
async function loadUserData() {
    if (!currentUser) return;
    
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
        userData = userSnap.data();
        updateUserUI();
        loadAds();
        
        // Show admin panel for admin
        if (userData.isAdmin) {
            const adminPanel = document.getElementById('adminPanel');
            if (adminPanel) adminPanel.style.display = 'block';
            loadAdminData();
        }
        
        // Real-time updates
        onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                userData = docSnap.data();
                updateUserUI();
            }
        });
    }
}

// Update user UI
function updateUserUI() {
    if (!userData) return;
    
    const elements = {
        userName: document.getElementById('userName'),
        userEmail: document.getElementById('userEmail'),
        greetingName: document.getElementById('greetingName'),
        userAvatar: document.getElementById('userAvatar') as HTMLImageElement,
        userPoints: document.getElementById('userPoints'),
        totalEarnings: document.getElementById('totalEarnings'),
        adsWatched: document.getElementById('adsWatched'),
        timeWatched: document.getElementById('timeWatched'),
        withdrawalsCount: document.getElementById('withdrawalsCount'),
        withdrawableBalance: document.getElementById('withdrawableBalance'),
        pointsBalance: document.getElementById('pointsBalance')
    };

    if (elements.userName) elements.userName.textContent = userData.displayName;
    if (elements.userEmail) elements.userEmail.textContent = userData.email;
    if (elements.greetingName) elements.greetingName.textContent = userData.displayName.split(' ')[0];
    
    if (userData.photoURL && elements.userAvatar) {
        elements.userAvatar.src = userData.photoURL;
    }
    
    if (elements.userPoints) elements.userPoints.textContent = userData.points.toLocaleString();
    if (elements.totalEarnings) elements.totalEarnings.textContent = `$${(userData.totalEarned || 0).toFixed(2)}`;
    if (elements.adsWatched) elements.adsWatched.textContent = (userData.adsWatched || 0).toString();
    if (elements.timeWatched) elements.timeWatched.textContent = Math.floor((userData.timeWatched || 0) / 60).toString();
    if (elements.withdrawalsCount) elements.withdrawalsCount.textContent = (userData.withdrawals || []).length.toString();
    
    const withdrawableDollars = (userData.points / POINTS_PER_DOLLAR).toFixed(2);
    if (elements.withdrawableBalance) elements.withdrawableBalance.textContent = `$${withdrawableDollars}`;
    if (elements.pointsBalance) elements.pointsBalance.textContent = userData.points.toLocaleString();
}

// Load public stats
async function loadPublicStats() {
    try {
        const usersRef = collection(db, "users");
        // Use a small timeout or check if we have permission issues
        const usersSnap = await getDocs(usersRef).catch(err => {
            console.warn("Public users access restricted:", err.message);
            return null;
        });
        
        if (usersSnap) {
            const totalUsersEl = document.getElementById('totalUsers');
            if (totalUsersEl) totalUsersEl.textContent = usersSnap.size.toString();
        }
        
        const withdrawalsRef = collection(db, "withdrawals");
        const completedQuery = query(withdrawalsRef, where("status", "==", "completed"));
        const completedSnap = await getDocs(completedQuery).catch(err => {
            console.warn("Public withdrawals access restricted:", err.message);
            return null;
        });
        
        if (completedSnap) {
            let totalWithdrawn = 0;
            completedSnap.forEach(docSnap => {
                totalWithdrawn += docSnap.data().amount;
            });
            const totalWithdrawnEl = document.getElementById('totalWithdrawn');
            if (totalWithdrawnEl) totalWithdrawnEl.textContent = `$${totalWithdrawn.toFixed(2)}`;
        }
        
    } catch (error) {
        console.error('Error loading public stats:', error);
    }
}

// Load ads
function loadAds() {
    const adsGrid = document.getElementById('adsGrid');
    if (!adsGrid) return;
    adsGrid.innerHTML = '';
    
    const ads = [
        { id: 1, title: "عروض التقنية الحديثة", category: "تقنية", color: "#3b82f6" },
        { id: 2, title: "تسوق بخصومات كبيرة", category: "تسوق", color: "#10b981" },
        { id: 3, title: "دورات تعليمية مجانية", category: "تعليم", color: "#8b5cf6" },
        { id: 4, title: "ألعاب وتطبيقات ترفيهية", category: "ترفيه", color: "#f59e0b" },
        { id: 5, title: "عروض صحية ورياضية", category: "صحة", color: "#ef4444" },
        { id: 6, title: "عروض السفر والسياحة", category: "سفر", color: "#06b6d4" }
    ];
    
    ads.forEach(ad => {
        const adCard = document.createElement('div');
        adCard.className = 'ad-card';
        adCard.innerHTML = `
            <div class="ad-category" style="background: ${ad.color}20; color: ${ad.color};">${ad.category}</div>
            <h3 class="ad-title">${ad.title}</h3>
            <p style="color: var(--gray); margin-bottom: 15px; font-size: 0.9rem;">
                شاهد هذا الإعلان لمدة 30 ثانية
            </p>
            <div class="ad-reward">+${POINTS_PER_AD} نقطة</div>
            <button class="watch-btn" onclick="startWatchingAd(${ad.id})" id="watchBtn${ad.id}">
                <i class="fas fa-play"></i> مشاهدة الإعلان
            </button>
        `;
        adsGrid.appendChild(adCard);
    });
}

// Start watching ad
function startWatchingAd(adId: any) {
    if (isWatchingAd) return;
    
    if (!currentUser || !userData) {
        showNotification('يجب تسجيل الدخول أولاً', 'warning');
        return;
    }
    
    isWatchingAd = true;
    currentAdId = adId;
    secondsLeft = 30;
    
    const timerContainer = document.getElementById('timerContainer');
    const timer = document.getElementById('timer');
    
    if (timerContainer) timerContainer.style.display = 'block';
    if (timer) timer.textContent = secondsLeft.toString();
    
    document.querySelectorAll('.watch-btn').forEach((btn: any) => {
        btn.disabled = true;
    });
    
    timerInterval = setInterval(() => {
        secondsLeft--;
        if (timer) timer.textContent = secondsLeft.toString();
        
        if (secondsLeft <= 0) {
            completeAdWatch();
        }
    }, 1000);
}

// Complete ad watch
async function completeAdWatch() {
    clearInterval(timerInterval);
    isWatchingAd = false;
    
    const pointsEarnedEl = document.getElementById('pointsEarned');
    if (pointsEarnedEl) pointsEarnedEl.style.display = 'block';
    
    try {
        const userRef = doc(db, "users", currentUser.uid);
        
        await updateDoc(userRef, {
            points: increment(POINTS_PER_AD),
            totalPoints: increment(POINTS_PER_AD),
            adsWatched: increment(1),
            timeWatched: increment(30)
        });
        
        await recordAdWatch(currentAdId);
        
        showNotification(`🎉 لقد ربحت ${POINTS_PER_AD} نقطة!`, 'success');
        
    } catch (error) {
        console.error('Error completing ad watch:', error);
        showNotification('حدث خطأ أثناء معالجة النقاط', 'error');
    }
    
    setTimeout(() => {
        const timerContainer = document.getElementById('timerContainer');
        const pointsEarned = document.getElementById('pointsEarned');
        if (timerContainer) timerContainer.style.display = 'none';
        if (pointsEarned) pointsEarned.style.display = 'none';
        document.querySelectorAll('.watch-btn').forEach((btn: any) => {
            btn.disabled = false;
        });
    }, 3000);
}

// Record ad watch
async function recordAdWatch(adId: any) {
    try {
        const watchRef = collection(db, "adWatches");
        await addDoc(watchRef, {
            userId: currentUser.uid,
            adId: adId,
            pointsEarned: POINTS_PER_AD,
            timestamp: new Date().toISOString(),
            userEmail: currentUser.email,
            userName: currentUser.displayName
        });
    } catch (error) {
        console.error('Error recording ad watch:', error);
    }
}

// Update required points for withdrawal
function updateRequiredPoints() {
    const amountEl = document.getElementById('withdrawAmount') as HTMLInputElement;
    if (!amountEl) return;
    const amount = parseFloat(amountEl.value);
    const requiredPoints = amount * POINTS_PER_DOLLAR;
    const reqPointsEl = document.getElementById('requiredPoints');
    if (reqPointsEl) reqPointsEl.textContent = requiredPoints.toLocaleString();
}

// Submit withdrawal
async function submitWithdrawal() {
    if (!currentUser || !userData) {
        showNotification('يجب تسجيل الدخول أولاً', 'warning');
        return;
    }
    
    const amountEl = document.getElementById('withdrawAmount') as HTMLInputElement;
    const vodafoneEl = document.getElementById('vodafoneNumber') as HTMLInputElement;
    
    if (!amountEl || !vodafoneEl) return;
    
    const amount = parseFloat(amountEl.value);
    const points = amount * POINTS_PER_DOLLAR;
    const vodafoneNumber = vodafoneEl.value.trim();
    
    if (userData.points < points) {
        showNotification('❌ لا تملك نقاطاً كافية للسحب', 'error');
        return;
    }
    
    if (amount < 1) {
        showNotification('❌ الحد الأدنى للسحب هو 1 دولار', 'error');
        return;
    }
    
    if (!vodafoneNumber || !/^01[0-2|5]\d{8}$/.test(vodafoneNumber)) {
        showNotification('❌ يرجى إدخال رقم فودافون كاش صحيح', 'error');
        return;
    }
    
    try {
        const btn = document.getElementById('submitWithdrawalBtn') as HTMLButtonElement;
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px;"></div> جاري الإرسال...';
        
        const withdrawalData = {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            userName: currentUser.displayName,
            userAvatar: currentUser.photoURL,
            amount: amount,
            points: points,
            method: 'vodafone_cash',
            vodafoneNumber: vodafoneNumber,
            status: 'pending',
            createdAt: new Date().toISOString(),
            adminEmail: ADMIN_EMAIL
        };
        
        const withdrawalRef = collection(db, "withdrawals");
        const docRef = await addDoc(withdrawalRef, withdrawalData);
        
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, {
            points: increment(-points),
            withdrawals: arrayUnion(docRef.id)
        });
        
        await notifyAdmin(withdrawalData, docRef.id);
        
        amountEl.value = "1";
        vodafoneEl.value = '';
        updateRequiredPoints();
        
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال طلب السحب';
        
        showNotification(`✅ تم إرسال طلب السحب بنجاح!`, 'success');
        
    } catch (error) {
        console.error('Withdrawal submission error:', error);
        showNotification('❌ حدث خطأ في إرسال طلب السحب', 'error');
        
        const btn = document.getElementById('submitWithdrawalBtn') as HTMLButtonElement;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال طلب السحب';
        }
    }
}

// Notify admin
async function notifyAdmin(withdrawalData: any, requestId: any) {
    try {
        const notificationRef = collection(db, "adminNotifications");
        await addDoc(notificationRef, {
            type: 'withdrawal_request',
            withdrawalId: requestId,
            data: withdrawalData,
            read: false,
            createdAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error notifying admin:', error);
    }
}

// Load admin data
async function loadAdminData() {
    if (!userData || !userData.isAdmin) return;
    
    try {
        const withdrawalsRef = collection(db, "withdrawals");
        const q = query(withdrawalsRef, where("status", "==", "pending"));
        const querySnapshot = await getDocs(q);
        
        const tableBody = document.getElementById('withdrawalsTable');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        
        if (querySnapshot.empty) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 30px; color: var(--gray);">
                        لا توجد طلبات سحب معلقة
                    </td>
                </tr>
            `;
        } else {
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            ${data.userAvatar ? `<img src="${data.userAvatar}" style="width: 30px; height: 30px; border-radius: 50%;">` : ''}
                            <div>
                                <div style="font-weight: 600;">${data.userName}</div>
                                <div style="font-size: 0.8rem; color: var(--gray);">${data.userEmail}</div>
                            </div>
                        </div>
                    </td>
                    <td style="font-weight: bold; color: var(--primary);">$${data.amount}</td>
                    <td dir="ltr">${data.vodafoneNumber}</td>
                    <td>${new Date(data.createdAt).toLocaleDateString('ar-EG')}</td>
                    <td>
                        <span class="status-badge status-pending">⏳ بانتظار المراجعة</span>
                    </td>
                    <td>
                        <button class="action-btn approve-btn" onclick="approveWithdrawal('${docSnap.id}')">
                            ✅ قبول
                        </button>
                        <button class="action-btn reject-btn" onclick="rejectWithdrawal('${docSnap.id}')">
                            ❌ رفض
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        }
        
        await loadSiteStatistics();
        
    } catch (error) {
        console.error('Error loading admin data:', error);
        showNotification('حدث خطأ في تحميل بيانات الإدارة', 'error');
    }
}

// Load site statistics
async function loadSiteStatistics() {
    try {
        const usersRef = collection(db, "users");
        const usersSnap = await getDocs(usersRef);
        const adminTotalUsers = document.getElementById('adminTotalUsers');
        if (adminTotalUsers) adminTotalUsers.textContent = usersSnap.size.toString();
        
        const withdrawalsRef = collection(db, "withdrawals");
        const completedQuery = query(withdrawalsRef, where("status", "==", "completed"));
        const completedSnap = await getDocs(completedQuery);
        
        let totalWithdrawn = 0;
        completedSnap.forEach(docSnap => {
            totalWithdrawn += docSnap.data().amount;
        });
        const adminTotalWithdrawals = document.getElementById('adminTotalWithdrawals');
        if (adminTotalWithdrawals) adminTotalWithdrawals.textContent = `$${totalWithdrawn.toFixed(2)}`;
        
        const adsRef = collection(db, "adWatches");
        const adsSnap = await getDocs(adsRef);
        const adminTotalAds = document.getElementById('adminTotalAds');
        if (adminTotalAds) adminTotalAds.textContent = adsSnap.size.toString();
        
        const siteRevenue = adsSnap.size * 0.01;
        const adminSiteRevenue = document.getElementById('adminSiteRevenue');
        if (adminSiteRevenue) adminSiteRevenue.textContent = `$${siteRevenue.toFixed(2)}`;
        
    } catch (error) {
        console.error('Error loading site statistics:', error);
    }
}

// Approve withdrawal
async function approveWithdrawal(withdrawalId: string) {
    if (!confirm('هل أنت متأكد من قبول طلب السحب وإرسال المبلغ؟')) return;
    
    try {
        const withdrawalRef = doc(db, "withdrawals", withdrawalId);
        const withdrawalDoc = await getDoc(withdrawalRef);
        const data = withdrawalDoc.data();
        
        await updateDoc(withdrawalRef, {
            status: 'completed',
            approvedAt: new Date().toISOString(),
            approvedBy: currentUser.email
        });
        
        showNotification(`✅ تم قبول طلب السحب وإرسال $${data?.amount}`, 'success');
        loadAdminData();
        
    } catch (error) {
        console.error('Error approving withdrawal:', error);
        showNotification('❌ حدث خطأ في قبول السحب', 'error');
    }
}

// Reject withdrawal
async function rejectWithdrawal(withdrawalId: string) {
    const reason = prompt('سبب الرفض:');
    if (!reason) return;
    
    try {
        const withdrawalRef = doc(db, "withdrawals", withdrawalId);
        const withdrawalDoc = await getDoc(withdrawalRef);
        const withdrawalData = withdrawalDoc.data();
        
        if (!withdrawalData) return;

        const userRef = doc(db, "users", withdrawalData.userId);
        await updateDoc(userRef, {
            points: increment(withdrawalData.points)
        });
        
        await updateDoc(withdrawalRef, {
            status: 'rejected',
            rejectReason: reason,
            rejectedAt: new Date().toISOString(),
            rejectedBy: currentUser.email
        });
        
        showNotification('❌ تم رفض طلب السحب وإرجاع النقاط', 'warning');
        loadAdminData();
        
    } catch (error) {
        console.error('Error rejecting withdrawal:', error);
        showNotification('❌ حدث خطأ في رفض السحب', 'error');
    }
}

// Refresh admin data
function refreshAdminData() {
    loadAdminData();
    showNotification('🔄 تم تحديث بيانات الإدارة', 'success');
}

// Sign out
async function handleSignOut() {
    try {
        await signOut(auth);
        showNotification('تم تسجيل الخروج بنجاح', 'success');
    } catch (error) {
        console.error('Sign out error:', error);
        showNotification('حدث خطأ في تسجيل الخروج', 'error');
    }
}

// UI State Functions
function showLoginPage() {
    const loginPage = document.getElementById('loginPage');
    const mainPage = document.getElementById('mainPage');
    if (loginPage) loginPage.style.display = 'flex';
    if (mainPage) mainPage.style.display = 'none';
}

function showMainPage() {
    const loginPage = document.getElementById('loginPage');
    const mainPage = document.getElementById('mainPage');
    if (loginPage) loginPage.style.display = 'none';
    if (mainPage) mainPage.style.display = 'block';
    window.scrollTo(0, 0);
}

function hideLoading() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 300);
    }
}

function showNotification(message: string, type: string = 'success') {
    const notification = document.getElementById('notification');
    const messageDiv = document.getElementById('notificationMessage');
    
    if (!notification || !messageDiv) return;

    notification.classList.remove('error', 'warning', 'success');
    notification.classList.add(type);
    
    messageDiv.innerHTML = message;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
}