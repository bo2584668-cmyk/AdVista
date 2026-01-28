
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// إعداد Firebase
const firebaseConfig = {
    apiKey: "AIzaSyC4fZQ-BTUeHsN9nQtMGmnjJz-NKdcUgkc",
    authDomain: "advista-b64ab.firebaseapp.com",
    projectId: "advista-b64ab",
    storageBucket: "advista-b64ab.firebasestorage.app",
    messagingSenderId: "509713648189",
    appId: "1:509713648189:web:0ccd6ada1f4e07f85d3854"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// الثوابت والروابط
const AD_REWARD = 50;
const PENALTY = 5;
const ADMIN_EMAIL = "bo2584668@gmail.com";
const GOOGLE_CLIENT_ID = "805966277330-9j5j1nvluj69f8uieog0kk77p0jb46q4.apps.googleusercontent.com";

let userData: any = null;
let isWatching = false;
let adTimer: any = null;
let timeLeft = 30;

// تهيئة Google Identity Services
function initializeGoogleSignIn() {
    if ((window as any).google) {
        (window as any).google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredentialResponse
        });
        (window as any).google.accounts.id.renderButton(
            document.getElementById("googleBtnContainer"),
            { theme: "outline", size: "large", width: "100%" }
        );
    } else {
        setTimeout(initializeGoogleSignIn, 500);
    }
}

// معالجة رد جوجل
async function handleGoogleCredentialResponse(response: any) {
    const idToken = response.credential;
    const credential = firebase.auth.GoogleAuthProvider.credential(idToken);
    
    try {
        await auth.signInWithCredential(credential);
    } catch (error) {
        console.error("Auth error:", error);
        showToast("خطأ في تسجيل الدخول عبر جوجل", true);
    }
}

// تسجيل الخروج
(window as any).signOut = () => {
    auth.signOut();
};

// مراقبة حالة المصادقة
auth.onAuthStateChanged(async (user) => {
    if (user) {
        document.getElementById('loginPage')!.style.display = 'none';
        document.getElementById('mainPage')!.style.display = 'block';
        
        // جلب البيانات من Firestore
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            userData = {
                uid: user.uid,
                name: user.displayName,
                email: user.email,
                photo: user.photoURL,
                points: 100,
                isAdmin: user.email === ADMIN_EMAIL
            };
            await db.collection('users').doc(user.uid).set(userData);
        } else {
            userData = userDoc.data();
        }

        updateUI();
        listenToAds();
        
        if (userData.isAdmin) {
            document.getElementById('adminNavItem')!.classList.remove('hidden');
        }
        
        // تحديث النقاط لحظياً
        db.collection('users').doc(user.uid).onSnapshot(doc => {
            if (doc.exists) {
                userData = doc.data();
                document.getElementById('userPoints')!.innerText = userData.points;
            }
        });

    } else {
        document.getElementById('loginPage')!.style.display = 'flex';
        document.getElementById('mainPage')!.style.display = 'none';
        initializeGoogleSignIn();
    }
});

function updateUI() {
    if (userData) {
        document.getElementById('headerAvatar')!.setAttribute('src', userData.photo || '');
        document.getElementById('headerName')!.innerText = userData.name || 'مستخدم';
        document.getElementById('userPoints')!.innerText = userData.points || 0;
    }
}

// مراقبة الإعلانات (للكل)
function listenToAds() {
    db.collection('ads').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        const adsGrid = document.getElementById('adsGrid')!;
        adsGrid.innerHTML = '';
        snapshot.forEach(doc => {
            const ad = doc.data();
            const card = document.createElement('div');
            card.className = 'ad-card';
            card.innerHTML = `
                <div class="ad-title">${ad.title}</div>
                <span class="ad-points">+${AD_REWARD} نقطة</span>
                <button class="watch-btn" onclick="startWatch('${ad.link}', '${doc.id}')">مشاهدة الآن</button>
            `;
            adsGrid.appendChild(card);
        });
    });
}

// منطق المشاهدة
(window as any).startWatch = (link: string, adId: string) => {
    if (isWatching) return;
    
    isWatching = true;
    timeLeft = 30;
    
    // فتح الإعلان
    window.open(link, '_blank');
    
    // إظهار واجهة المؤقت
    document.getElementById('timerOverlay')!.style.display = 'flex';
    const timerText = document.getElementById('countdownTimer')!;
    timerText.innerText = timeLeft.toString();

    adTimer = setInterval(() => {
        timeLeft--;
        timerText.innerText = timeLeft.toString();
        
        if (timeLeft <= 0) {
            finishWatch(true);
        }
    }, 1000);
};

// مراقبة العودة للتبويب (للتحقق من الغش)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isWatching && timeLeft > 0) {
        // إذا عاد المستخدم قبل انتهاء الوقت
        finishWatch(false);
    }
});

async function finishWatch(success: boolean) {
    clearInterval(adTimer);
    isWatching = false;
    document.getElementById('timerOverlay')!.style.display = 'none';

    if (success) {
        const newPoints = (userData.points || 0) + AD_REWARD;
        await db.collection('users').doc(userData.uid).update({ points: newPoints });
        showToast(`أحسنت! تمت إضافة ${AD_REWARD} نقطة لرصيدك`);
    } else {
        const newPoints = Math.max(0, (userData.points || 0) - PENALTY);
        await db.collection('users').doc(userData.uid).update({ points: newPoints });
        showToast(`عقوبة: تم خصم ${PENALTY} نقاط لمغادرة صفحة الإعلان!`, true);
    }
}

// الإدارة
(window as any).createNewAd = async () => {
    const link = (document.getElementById('newAdLink') as HTMLInputElement).value;
    const title = (document.getElementById('newAdTitle') as HTMLInputElement).value;
    
    if (!link || !title) return showToast("يرجى إدخال كافة البيانات", true);

    await db.collection('ads').add({
        link,
        title,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        adminEmail: userData.email
    });
    
    (document.getElementById('newAdLink') as HTMLInputElement).value = '';
    (document.getElementById('newAdTitle') as HTMLInputElement).value = '';
    showToast("تم نشر الإعلان بنجاح لجميع المستخدمين");
};

// طلبات السحب
(window as any).requestWithdrawal = async () => {
    const phone = (document.getElementById('withdrawPhone') as HTMLInputElement).value;
    if (!phone || phone.length < 10) return showToast("رقم فودافون كاش غير صحيح", true);
    
    if ((userData.points || 0) < 20000) return showToast("نقاطك أقل من الحد الأدنى (20,000)", true);

    await db.collection('withdrawals').add({
        uid: userData.uid,
        email: userData.email,
        phone,
        amount: "1$",
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await db.collection('users').doc(userData.uid).update({
        points: userData.points - 20000
    });

    showToast("تم إرسال طلب السحب للمراجعة");
};

// التنقل
(window as any).switchSection = (section: string) => {
    document.getElementById('adsSection')!.classList.add('hidden');
    document.getElementById('adminSection')!.classList.add('hidden');
    document.getElementById('profileSection')!.classList.add('hidden');
    
    document.getElementById(`${section}Section`)!.classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    const activeBtn = Array.from(document.querySelectorAll('.nav-item')).find(btn => 
        btn.getAttribute('onclick')?.includes(section)
    );
    activeBtn?.classList.add('active');
};

function showToast(msg: string, isError = false) {
    const toast = document.getElementById('toast')!;
    toast.innerText = msg;
    toast.style.background = isError ? '#ef4444' : '#10b981';
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 4000);
}

// بدء التشغيل
document.addEventListener('DOMContentLoaded', initializeGoogleSignIn);
