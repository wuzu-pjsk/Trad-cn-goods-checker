// 本地調試賬戶：無需聯網，數據存瀏覽器 localStorage
const DEBUG_EMAIL = 'test@test.com';
const DEBUG_PWD = 'test123';
const DEBUG_USER_ID = 'debug-local-user';

async function handleLogin() {
    let email = document.getElementById('authEmail').value.trim();
    let pwd = document.getElementById('authPassword').value;
    if(!email || !pwd) { showToast('請輸入賬號和密碼', 'warning'); return; }
    // 調試賬戶繞過 Supabase，純本地模式
    if (email === DEBUG_EMAIL && pwd === DEBUG_PWD) {
        currentUser = { id: DEBUG_USER_ID, email: DEBUG_EMAIL, isDebug: true };
        initCloudData();
        return;
    }
    showLoading('登錄中...');
    try {
        const { data, error } = await db.auth.signInWithPassword({ email, password: pwd });
        hideLoading();
        if(error) { showToast('登錄失敗: 賬號不存在或密碼錯誤', 'error'); return; }
        currentUser = data.user; initCloudData();
    } catch (err) { hideLoading(); showToast('連接雲端失敗！', 'error'); }
}

async function handleRegisterSubmit() {
    let email = document.getElementById('regEmail').value.trim();
    let pwd = document.getElementById('regPassword').value;
    if(!email) { showToast('請正確填寫郵箱！', 'warning'); return; }
    if(pwd.length < 6 || pwd !== document.getElementById('regConfirmPassword').value) { showToast('密碼無效或不一致！', 'warning'); return; }
    showLoading('提交註冊中...');
    try {
        const { data, error } = await db.auth.signUp({ email, password: pwd, options: { emailRedirectTo: window.location.origin } });
        hideLoading();
        if(error) showToast('註冊失敗: ' + error.message, 'error');
        else {
            showToast('註冊成功！請前往郵箱點擊確認鏈接完成註冊。（可能在垃圾郵件裡）', 'success');
            showScreen('login-screen');
        }
    } catch (err) { hideLoading(); showToast('錯誤，請檢查網絡', 'error'); }
}

async function handleSendResetCode() {
    let email = document.getElementById('forgotEmail').value.trim();
    if(!email) { showToast('請輸入註冊時的郵箱', 'warning'); return; }
    showLoading('發送請求中...');
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    hideLoading();
    if(error) showToast('發送失敗: ' + error.message, 'error');
    else {
        showToast('密碼重置鏈接已發送！請前往郵箱點擊鏈接設置新密碼。', 'success');
        showScreen('login-screen');
    }
}

// 核心：監聽用戶從郵件裡點擊鏈接跳回網頁的動作
db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
        showScreen('reset-screen');
    }
});

async function handleDoResetPassword() {
    let newPwd = document.getElementById('resetNewPassword').value;
    if(newPwd.length < 6) { showToast('新密碼至少需要6位', 'warning'); return; }
    showLoading('正在重置...');
    const { error } = await db.auth.updateUser({ password: newPwd });
    hideLoading();
    if(error) return showToast('更新失敗：' + error.message, 'error');

    showToast('密碼重置成功！', 'success');
    currentUser = (await db.auth.getUser()).data.user;
    initCloudData();
}

async function saveQueryKey() {
    let key = document.getElementById('settingQueryKey').value.trim();
    if(!key) { showToast('請輸入密鑰！', 'warning'); return; }
    if (currentUser.isDebug) { showToast('調試模式不支持密鑰設置', 'info'); return; }
    showLoading('保存密鑰...');
    const { error } = await db.from('leader_data').update({ query_key: key }).eq('user_id', currentUser.id);
    hideLoading();
    if(error) showToast('密鑰保存失敗！', 'error');
    else showToast('全局密鑰設置成功！', 'success');
}

async function handleLogout() {
    if (!currentUser.isDebug) await db.auth.signOut();
    localStorage.removeItem('assistant_uid');
    currentUser = null; groupData = []; imageUrlData = {};
    showScreen('portal-screen');
}

async function initCloudData() {
    try {
        // 調試賬戶：從 localStorage 讀取數據
        if (currentUser.isDebug) {
            const saved = localStorage.getItem('groupData_V4');
            if (saved) groupData = JSON.parse(saved);
            const savedImg = localStorage.getItem('imageUrlData_V1');
            if (savedImg) imageUrlData = JSON.parse(savedImg);
            showScreen('dashboard-screen'); updateBatchDatalist(); switchTab('input');
            if (typeof applyBackground === 'function') applyBackground();
            if (typeof applyFeatureToggles === 'function') applyFeatureToggles();
            return;
        }
        showLoading('正在拉取數據...');
        const { data, error } = await db.from('leader_data').select('*').eq('user_id', currentUser.id).single();
        if(data) {
            groupData = data.group_data || []; imageUrlData = data.image_data || {};
            document.getElementById('settingQueryKey').value = data.query_key || '';
        } else { await db.from('leader_data').insert({ user_id: currentUser.id, group_data: [], image_data: {} }); }
    } catch(e) {} finally { hideLoading(); showScreen('dashboard-screen'); updateBatchDatalist(); switchTab('input'); if (typeof applyBackground === 'function') applyBackground(); if (typeof applyFeatureToggles === 'function') applyFeatureToggles(); }
}

// 頁面啟動時檢查是否已登錄（放在 auth.js 末尾，確保 initCloudData 已定義）
db.auth.getSession().then(({ data: { session } }) => {
    if (session) { currentUser = session.user; initCloudData(); }
    else showScreen('portal-screen');
});
