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
let currentAdmin = null;
let editingAdId = null;

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    checkAdminAuth();
    initAdminUI();
});

// Check Admin Authentication
function checkAdminAuth() {
    const token = localStorage.getItem('google_token');
    const userData = localStorage.getItem('user_data');
    
    if (token && userData) {
        try {
            const user = JSON.parse(userData);
            
            // Check if user is admin
            if (user.email === 'bo2584668@gmail.com') {
                currentAdmin = user;
                document.getElementById('adminLoginForm').style.display = 'none';
                document.getElementById('adminDashboard').style.display = 'block';
                document.getElementById('adminName').textContent = user.displayName || 'المشرف';
                document.getElementById('adminEmail').textContent = user.email;
                
                // Load admin data
                loadAdminStats();
                loadAdsForAdmin();
                return;
            }
        } catch (error) {
            console.error("Error checking admin auth:", error);
        }
    }
    
    // Not logged in or not admin
    currentAdmin = null;
    document.getElementById('adminLoginForm').style.display = 'block';
    document.getElementById('adminDashboard').style.display = 'none';
}

// Initialize Admin UI
function initAdminUI() {
    // Login button
    document.getElementById('adminLoginBtn').addEventListener('click', triggerAdminGoogleSignIn);
    
    // Logout button
    document.getElementById('adminLogoutBtn').addEventListener('click', adminSignOut);
    
    // Navigation
    document.getElementById('navAds').addEventListener('click', (e) => {
        e.preventDefault();
        showSection('adsManagement');
        setActiveNav('navAds');
    });
    
    document.getElementById('navUsers').addEventListener('click', (e) => {
        e.preventDefault();
        showSection('usersManagement');
        setActiveNav('navUsers');
        loadUsersForAdmin();
    });
    
    document.getElementById('navStats').addEventListener('click', (e) => {
        e.preventDefault();
        showSection('statsManagement');
        setActiveNav('navStats');
        loadDetailedStats();
    });
    
    document.getElementById('navBroadcast').addEventListener('click', (e) => {
        e.preventDefault();
        showSection('broadcastManagement');
        setActiveNav('navBroadcast');
    });
    
    // Add ad form
    document.getElementById('addAdForm').addEventListener('submit', handleAddAd);
    
    // Clear form button
    document.getElementById('clearFormBtn').addEventListener('click', clearAdForm);
    
    // Broadcast form
    document.getElementById('broadcastForm').addEventListener('submit', handleBroadcast);
}

// Trigger Admin Google Sign-In
function triggerAdminGoogleSignIn() {
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
                callback: handleAdminGoogleSignIn,
                auto_select: false,
                cancel_on_tap_outside: true
            });
            google.accounts.id.prompt();
        };
        document.head.appendChild(script);
    }
}

// Handle Admin Google Sign-In Response
function handleAdminGoogleSignIn(response) {
    console.log("Admin Google Sign-In Response:", response);
    
    try {
        // Decode JWT token
        const token = response.credential;
        const payload = decodeJWT(token);
        
        console.log("Decoded JWT Payload:", payload);
        
        // Check if user is admin
        if (payload.email === 'bo2584668@gmail.com') {
            // Create admin user object
            const adminUser = {
                uid: payload.sub,
                displayName: payload.name,
                email: payload.email,
                photoURL: payload.picture,
                emailVerified: payload.email_verified
            };
            
            // Save token and user data
            localStorage.setItem('google_token', token);
            localStorage.setItem('user_data', JSON.stringify(adminUser));
            
            // Update UI
            currentAdmin = adminUser;
            document.getElementById('adminLoginForm').style.display = 'none';
            document.getElementById('adminDashboard').style.display = 'block';
            document.getElementById('adminName').textContent = adminUser.displayName || 'المشرف';
            document.getElementById('adminEmail').textContent = adminUser.email;
            
            // Load admin data
            loadAdminStats();
            loadAdsForAdmin();
            
            showNotification('تم تسجيل الدخول بنجاح كمسؤول', 'success');
        } else {
            showNotification('ليس لديك صلاحية الدخول كمسؤول', 'error');
            adminSignOut();
        }
        
    } catch (error) {
        console.error("Error handling admin Google Sign-In:", error);
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

// Admin Sign Out
function adminSignOut() {
    // Revoke Google token
    const token = localStorage.getItem('google_token');
    if (token && typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        google.accounts.id.revoke(token, function() {
            console.log("Admin token revoked successfully");
        });
    }
    
    // Clear localStorage
    localStorage.removeItem('google_token');
    localStorage.removeItem('user_data');
    
    // Update UI
    currentAdmin = null;
    document.getElementById('adminLoginForm').style.display = 'block';
    document.getElementById('adminDashboard').style.display = 'none';
    
    showNotification('تم تسجيل الخروج بنجاح', 'success');
}

// Show Section
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.admin-only').forEach(section => {
        section.style.display = 'none';
    });
    
    // Show selected section
    document.getElementById(sectionId).style.display = 'block';
}

// Set Active Navigation
function setActiveNav(navId) {
    document.querySelectorAll('.admin-nav a').forEach(nav => {
        nav.classList.remove('active');
    });
    document.getElementById(navId).classList.add('active');
}

// Load Admin Stats
async function loadAdminStats() {
    try {
        // Count ads
        const adsSnapshot = await db.collection('ads').where('status', '==', 'active').get();
        document.getElementById('totalAdsCount').textContent = adsSnapshot.size;
        document.getElementById('adsCount').textContent = adsSnapshot.size;
        
        // Count users
        const usersSnapshot = await db.collection('users').get();
        document.getElementById('totalUsersCount').textContent = usersSnapshot.size;
        
        // Today's stats
        const today = new Date().toDateString();
        const todayStart = new Date(today);
        const todayEnd = new Date(today);
        todayEnd.setDate(todayEnd.getDate() + 1);
        
        const viewsSnapshot = await db.collection('adViews')
            .where('watchedAt', '>=', todayStart)
            .where('watchedAt', '<', todayEnd)
            .get();
        
        document.getElementById('todayViews').textContent = viewsSnapshot.size;
        
        // Calculate today's earnings
        let todayEarnings = 0;
        viewsSnapshot.forEach(doc => {
            todayEarnings += doc.data().points || 0;
        });
        document.getElementById('todayEarnings').textContent = todayEarnings;
        
    } catch (error) {
        console.error('Error loading admin stats:', error);
    }
}

// Load Ads for Admin
async function loadAdsForAdmin() {
    try {
        const adsList = document.getElementById('adminAdsList');
        adsList.innerHTML = `
            <div class="loading-ads">
                <div class="spinner"></div>
                <p>جاري تحميل الإعلانات...</p>
            </div>
        `;
        
        const adsSnapshot = await db.collection('ads')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        
        if (adsSnapshot.empty) {
            adsList.innerHTML = '<p>لا توجد إعلانات منشورة بعد.</p>';
            return;
        }
        
        adsList.innerHTML = '';
        adsSnapshot.forEach(doc => {
            const ad = doc.data();
            const adId = doc.id;
            
            const adItem = document.createElement('div');
            adItem.className = 'ad-item';
            adItem.dataset.id = adId;
            
            adItem.innerHTML = `
                <div class="ad-info">
                    <h4>${ad.title}</h4>
                    <p>${ad.description}</p>
                    <small>
                        النقاط: ${ad.points} | المدة: ${ad.duration}ث | النوع: ${getCategoryName(ad.category)} | 
                        الحالة: <span class="${ad.status === 'active' ? 'ad-available' : 'ad-completed'}">${ad.status === 'active' ? 'نشط' : 'غير نشط'}</span>
                    </small>
                </div>
                <div class="ad-actions">
                    <button class="btn-icon btn-view" title="عرض" data-id="${adId}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon btn-edit" title="تعديل" data-id="${adId}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" title="حذف" data-id="${adId}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            adsList.appendChild(adItem);
        });
        
        // Add event listeners
        document.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', function() {
                const adId = this.dataset.id;
                viewAd(adId);
            });
        });
        
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', function() {
                const adId = this.dataset.id;
                editAd(adId);
            });
        });
        
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', function() {
                const adId = this.dataset.id;
                deleteAd(adId);
            });
        });
        
    } catch (error) {
        console.error('Error loading ads for admin:', error);
        showNotification('حدث خطأ في تحميل الإعلانات', 'error');
    }
}

// Get Category Name
function getCategoryName(category) {
    switch(category) {
        case 'short': return 'قصير';
        case 'medium': return 'متوسط';
        case 'long': return 'طويل';
        default: return 'غير معروف';
    }
}

// View Ad
function viewAd(adId) {
    window.open(`https://linkjust.com/xbTIX`, '_blank');
}

// Edit Ad
async function editAd(adId) {
    try {
        const adDoc = await db.collection('ads').doc(adId).get();
        
        if (adDoc.exists) {
            const ad = adDoc.data();
            editingAdId = adId;
            
            // Fill form
            document.getElementById('adTitle').value = ad.title;
            document.getElementById('adDescription').value = ad.description;
            document.getElementById('adLink').value = ad.link;
            document.getElementById('adImage').value = ad.image;
            document.getElementById('adDuration').value = ad.duration;
            document.getElementById('adPoints').value = ad.points;
            document.getElementById('adCategory').value = ad.category;
            
            // Change button text
            document.querySelector('#addAdForm button[type="submit"]').innerHTML = '<i class="fas fa-save"></i> تحديث الإعلان';
            
            // Scroll to form
            document.getElementById('adTitle').scrollIntoView({ behavior: 'smooth' });
            
            showNotification('تم تحميل بيانات الإعلان للتعديل', 'info');
        }
    } catch (error) {
        console.error('Error editing ad:', error);
        showNotification('حدث خطأ في تحميل الإعلان', 'error');
    }
}

// Delete Ad
async function deleteAd(adId) {
    if (confirm('هل أنت متأكد من حذف هذا الإعلان؟ سيتم حذفه نهائياً.')) {
        try {
            await db.collection('ads').doc(adId).delete();
            showNotification('تم حذف الإعلان بنجاح', 'success');
            loadAdsForAdmin();
            loadAdminStats();
        } catch (error) {
            console.error('Error deleting ad:', error);
            showNotification('حدث خطأ في حذف الإعلان', 'error');
        }
    }
}

// Handle Add/Edit Ad
async function handleAddAd(e) {
    e.preventDefault();
    
    if (!currentAdmin) {
        showNotification('يجب تسجيل الدخول أولاً', 'error');
        return;
    }
    
    const adData = {
        title: document.getElementById('adTitle').value,
        description: document.getElementById('adDescription').value,
        link: document.getElementById('adLink').value,
        image: document.getElementById('adImage').value || `https://picsum.photos/400/250?random=${Math.floor(Math.random() * 1000)}`,
        duration: parseInt(document.getElementById('adDuration').value),
        points: parseInt(document.getElementById('adPoints').value),
        category: document.getElementById('adCategory').value,
        status: 'active',
        createdAt: editingAdId ? undefined : firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: currentAdmin.uid
    };
    
    try {
        if (editingAdId) {
            // Update existing ad
            await db.collection('ads').doc(editingAdId).update(adData);
            showNotification('تم تحديث الإعلان بنجاح', 'success');
            editingAdId = null;
        } else {
            // Add new ad
            await db.collection('ads').add(adData);
            showNotification('تم نشر الإعلان بنجاح', 'success');
        }
        
        // Clear form
        clearAdForm();
        
        // Reload ads
        loadAdsForAdmin();
        loadAdminStats();
        
    } catch (error) {
        console.error('Error saving ad:', error);
        showNotification('حدث خطأ في حفظ الإعلان', 'error');
    }
}

// Clear Ad Form
function clearAdForm() {
    document.getElementById('addAdForm').reset();
    document.getElementById('adLink').value = 'https://linkjust.com/xbTIX';
    document.getElementById('adDuration').value = '30';
    document.getElementById('adPoints').value = '60';
    document.getElementById('adCategory').value = 'medium';
    document.getElementById('adImage').value = '';
    
    // Reset button text
    document.querySelector('#addAdForm button[type="submit"]').innerHTML = '<i class="fas fa-save"></i> نشر الإعلان';
    
    editingAdId = null;
}

// Load Users for Admin
async function loadUsersForAdmin() {
    try {
        const usersList = document.getElementById('usersList');
        usersList.innerHTML = `
            <div class="loading-ads">
                <div class="spinner"></div>
                <p>جاري تحميل المستخدمين...</p>
            </div>
        `;
        
        const usersSnapshot = await db.collection('users')
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();
        
        if (usersSnapshot.empty) {
            usersList.innerHTML = '<p>لا يوجد مستخدمين بعد.</p>';
            return;
        }
        
        let usersHtml = `
            <div class="users-table">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #f8f9fa;">
                            <th style="padding: 12px; text-align: right;">المستخدم</th>
                            <th style="padding: 12px; text-align: right;">البريد الإلكتروني</th>
                            <th style="padding: 12px; text-align: right;">الرصيد</th>
                            <th style="padding: 12px; text-align: right;">المجموع</th>
                            <th style="padding: 12px; text-align: right;">التسجيل</th>
                            <th style="padding: 12px; text-align: right;">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        usersSnapshot.forEach(doc => {
            const user = doc.data();
            const userId = doc.id;
            const joinDate = user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString('ar-SA') : 'غير معروف';
            
            usersHtml += `
                <tr style="border-bottom: 1px solid #e9ecef;">
                    <td style="padding: 12px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <img src="${user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || user.email)}" 
                                 alt="صورة المستخدم" 
                                 style="width: 40px; height: 40px; border-radius: 50%;">
                            <div>
                                <strong>${user.displayName || 'بدون اسم'}</strong>
                                ${user.isAdmin ? '<span style="background-color: #3b82f6; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-right: 5px;">مسؤول</span>' : ''}
                            </div>
                        </div>
                    </td>
                    <td style="padding: 12px;">${user.email}</td>
                    <td style="padding: 12px; font-weight: bold; color: #4361ee;">${user.balance || 0} نقطة</td>
                    <td style="padding: 12px;">${user.totalEarned || 0} نقطة</td>
                    <td style="padding: 12px;">${joinDate}</td>
                    <td style="padding: 12px;">
                        <button class="btn btn-small" onclick="viewUserDetails('${userId}')">عرض</button>
                        ${!user.isAdmin ? `<button class="btn btn-small btn-danger" onclick="deleteUser('${userId}')">حذف</button>` : ''}
                    </td>
                </tr>
            `;
        });
        
        usersHtml += `
                    </tbody>
                </table>
            </div>
        `;
        
        usersList.innerHTML = usersHtml;
        
    } catch (error) {
        console.error('Error loading users for admin:', error);
        showNotification('حدث خطأ في تحميل المستخدمين', 'error');
    }
}

// View User Details (global function for onclick)
window.viewUserDetails = async function(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
            const user = userDoc.data();
            const joinDate = user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleString('ar-SA') : 'غير معروف';
            const lastLogin = user.lastLogin ? new Date(user.lastLogin.seconds * 1000).toLocaleString('ar-SA') : 'غير معروف';
            
            alert(`
                معلومات المستخدم:
                الاسم: ${user.displayName || 'غير محدد'}
                البريد: ${user.email}
                الرصيد: ${user.balance || 0} نقطة
                المجموع المكتسب: ${user.totalEarned || 0} نقطة
                مسؤول: ${user.isAdmin ? 'نعم' : 'لا'}
                تاريخ التسجيل: ${joinDate}
                آخر دخول: ${lastLogin}
                إعلانات اليوم: ${user.dailyStats?.adsWatched || 0}
                نقاط اليوم: ${user.dailyStats?.pointsEarned || 0}
            `);
        }
    } catch (error) {
        console.error('Error viewing user details:', error);
    }
};

// Delete User (global function for onclick)
window.deleteUser = function(userId) {
    if (confirm('هل أنت متأكد من حذف هذا المستخدم؟ سيتم حذف جميع بياناته.')) {
        db.collection('users').doc(userId).delete()
            .then(() => {
                showNotification('تم حذف المستخدم بنجاح', 'success');
                loadUsersForAdmin();
            })
            .catch(error => {
                console.error('Error deleting user:', error);
                showNotification('حدث خطأ في حذف المستخدم', 'error');
            });
    }
};

// Load Detailed Stats
async function loadDetailedStats() {
    try {
        const statsContent = document.getElementById('statsContent');
        statsContent.innerHTML = `
            <div class="loading-ads">
                <div class="spinner"></div>
                <p>جاري تحميل الإحصائيات...</p>
            </div>
        `;
        
        // Get all users
        const usersSnapshot = await db.collection('users').get();
        const totalUsers = usersSnapshot.size;
        
        // Get all ads
        const adsSnapshot = await db.collection('ads').where('status', '==', 'active').get();
        const totalAds = adsSnapshot.size;
        
        // Get today's date
        const today = new Date().toDateString();
        const todayStart = new Date(today);
        const todayEnd = new Date(today);
        todayEnd.setDate(todayEnd.getDate() + 1);
        
        // Get today's ad views
        const viewsSnapshot = await db.collection('adViews')
            .where('watchedAt', '>=', todayStart)
            .where('watchedAt', '<', todayEnd)
            .get();
        
        const todayViews = viewsSnapshot.size;
        
        // Calculate today's earnings
        let todayEarnings = 0;
        viewsSnapshot.forEach(doc => {
            todayEarnings += doc.data().points || 0;
        });
        
        // Calculate total earnings
        let totalEarnings = 0;
        usersSnapshot.forEach(doc => {
            totalEarnings += doc.data().totalEarned || 0;
        });
        
        // Get top users
        const topUsers = [];
        usersSnapshot.forEach(doc => {
            const user = doc.data();
            topUsers.push({
                name: user.displayName || user.email,
                balance: user.balance || 0,
                totalEarned: user.totalEarned || 0
            });
        });
        
        // Sort by total earned
        topUsers.sort((a, b) => b.totalEarned - a.totalEarned);
        const top5Users = topUsers.slice(0, 5);
        
        statsContent.innerHTML = `
            <div class="detailed-stats">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: var(--border-radius); text-align: center;">
                        <h3 style="color: var(--primary-color); margin-bottom: 10px;">إجمالي المستخدمين</h3>
                        <p style="font-size: 32px; font-weight: bold;">${totalUsers}</p>
                    </div>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: var(--border-radius); text-align: center;">
                        <h3 style="color: var(--primary-color); margin-bottom: 10px;">الإعلانات النشطة</h3>
                        <p style="font-size: 32px; font-weight: bold;">${totalAds}</p>
                    </div>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: var(--border-radius); text-align: center;">
                        <h3 style="color: var(--primary-color); margin-bottom: 10px;">مشاهدات اليوم</h3>
                        <p style="font-size: 32px; font-weight: bold;">${todayViews}</p>
                    </div>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: var(--border-radius); text-align: center;">
                        <h3 style="color: var(--primary-color); margin-bottom: 10px;">أرباح اليوم</h3>
                        <p style="font-size: 32px; font-weight: bold;">${todayEarnings}</p>
                    </div>
                </div>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: var(--border-radius); margin-bottom: 30px;">
                    <h3 style="color: var(--primary-color); margin-bottom: 20px;">أفضل 5 مستخدمين</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">المستخدم</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">الرصيد الحالي</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">إجمالي الأرباح</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${top5Users.map(user => `
                                <tr>
                                    <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">${user.name}</td>
                                    <td style="padding: 12px; border-bottom: 1px solid #dee2e6; font-weight: bold; color: #4361ee;">${user.balance} نقطة</td>
                                    <td style="padding: 12px; border-bottom: 1px solid #dee2e6; font-weight: bold;">${user.totalEarned} نقطة</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: var(--border-radius);">
                    <h3 style="color: var(--primary-color); margin-bottom: 20px;">إحصائيات عامة</h3>
                    <ul style="list-style: none; padding: 0;">
                        <li style="padding: 10px 0; border-bottom: 1px solid #dee2e6;">
                            <strong>إجمالي النقاط الموزعة:</strong> ${totalEarnings} نقطة
                        </li>
                        <li style="padding: 10px 0; border-bottom: 1px solid #dee2e6;">
                            <strong>متوسط رصيد المستخدم:</strong> ${Math.round(totalEarnings / totalUsers)} نقطة
                        </li>
                        <li style="padding: 10px 0; border-bottom: 1px solid #dee2e6;">
                            <strong>متوسط مشاهدة اليوم للمستخدم:</strong> ${(todayViews / totalUsers).toFixed(2)} إعلان
                        </li>
                        <li style="padding: 10px 0;">
                            <strong>إجمالي القيمة الموزعة:</strong> $${(totalEarnings / 100).toFixed(2)}
                        </li>
                    </ul>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading detailed stats:', error);
        statsContent.innerHTML = '<p>حدث خطأ في تحميل الإحصائيات</p>';
    }
}

// Handle Broadcast
async function handleBroadcast(e) {
    e.preventDefault();
    
    if (!currentAdmin) {
        showNotification('يجب تسجيل الدخول أولاً', 'error');
        return;
    }
    
    const title = document.getElementById('broadcastTitle').value;
    const message = document.getElementById('broadcastMessage').value;
    
    if (!title || !message) {
        showNotification('يرجى ملء جميع الحقول', 'error');
        return;
    }
    
    try {
        // Create broadcast ad
        const broadcastAd = {
            title: `[إعلان للجميع] ${title}`,
            description: message,
            link: "https://linkjust.com/xbTIX",
            image: `https://picsum.photos/400/250?random=${Math.floor(Math.random() * 1000)}`,
            duration: 30,
            points: 50,
            category: "short",
            status: 'active',
            isBroadcast: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentAdmin.uid
        };
        
        await db.collection('ads').add(broadcastAd);
        
        // Clear form
        document.getElementById('broadcastForm').reset();
        
        // Show success message
        showNotification('تم إرسال الإعلان للجميع بنجاح!', 'success');
        
        // Reload ads
        loadAdsForAdmin();
        loadAdminStats();
        
    } catch (error) {
        console.error('Error sending broadcast:', error);
        showNotification('حدث خطأ في إرسال الإعلان', 'error');
    }
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
