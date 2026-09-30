function generateSafeId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

        const APP_VERSION = '1.3.0';

        let groupData = [];
        let imageUrlData = {};
        
        let currentManageBatch = 'all';
        let currentSearchKeyword = ''; 
        
        window.scheduleSteps = {};
        window.scheduleCols = {}; 

        let currentEditImageKey = '';
        let currentUser = null;
        let resetTargetEmail = ''; 
        let registerTargetEmail = ''; 
        let draggedItemRowId = null;
        let dismissedReqIds = new Set();

        function showLoading(text="處理中...") { document.getElementById('loadingText').innerText=text; document.getElementById('globalLoading').classList.remove('hidden'); }
        function hideLoading() { document.getElementById('globalLoading').classList.add('hidden'); }
        function showScreen(screenId) {
            ['portal-screen', 'buyer-screen', 'shipping-apply-screen', 'payment-apply-screen', 'login-screen', 'register-screen', 'verify-signup-screen', 'forgot-screen', 'reset-screen', 'dashboard-screen', 'rank-screen', 'about-screen', 'intl-freight-screen'].forEach(id => {
                let el = document.getElementById(id);
                if(el) el.classList.add('hidden');
            });
            document.getElementById(screenId).classList.remove('hidden');
        }

        // P6: 黑夜模式 — 初始化/切換
        window.initTheme = function() {
            const saved = localStorage.getItem('theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const isDark = saved === 'dark' || (!saved && prefersDark);
            document.documentElement.classList.toggle('dark', isDark);
            updateThemeIcon();
        };
        window.toggleTheme = function() {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateThemeIcon();
        };
        function updateThemeIcon() {
            const btn = document.getElementById('themeToggleBtn');
            if (btn) btn.textContent = document.documentElement.classList.contains('dark') ? '☀️' : '🌙';
        }
        initTheme(); // 立即初始化（core.js 在 body 末尾加載，DOM 已就緒）

        // P12: 功能開關檢測 — 默認開啟（缺省 = true）
        window.isFeatureEnabled = function(name) {
            const config = JSON.parse(imageUrlData['__APP_CONFIG__'] || '{}');
            return config.features?.[name] !== false;
        };

        // P15: 應用自定義背景（支持純色/圖片+自動遮罩）
        window.applyBackground = function() {
            const config = JSON.parse(imageUrlData['__APP_CONFIG__'] || '{}');
            const bgType = config.bgType || 'none';
            const body = document.body;
            body.style.backgroundImage = '';
            body.style.backgroundColor = '';
            body.classList.remove('has-custom-bg');

            if (bgType === 'color' && config.bgColor) {
                body.style.backgroundColor = config.bgColor;
            } else if (bgType === 'image' && config.bgUrl) {
                body.style.backgroundImage = `url(${config.bgUrl})`;
                body.style.backgroundSize = 'cover';
                body.style.backgroundPosition = 'center';
                body.style.backgroundAttachment = 'fixed';
                body.classList.add('has-custom-bg');
                const opacity = config.bgOpacity || 0.4;
                document.documentElement.style.setProperty('--bg-overlay-opacity', opacity);
            }
        };

        // XSS 防護：轉義 HTML 特殊字符
        function escapeHtml(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.appendChild(document.createTextNode(String(str)));
            return div.innerHTML;
        }

        function showToast(msg, type = 'info') {
            const colors = { success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-500', info: 'bg-blue-500' };
            const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
            const toast = document.createElement('div');
            toast.className = `${colors[type] || colors.info} text-white px-4 py-3 rounded-lg shadow-lg fade-in text-sm font-bold flex items-center gap-2`;
            toast.style.cssText = 'position:fixed; top:1rem; right:1rem; z-index:9999; max-width:20rem;';
            toast.textContent = `${icons[type] || icons.info} ${msg}`;
            document.body.appendChild(toast);
            setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3000);
        }

        function updateSyncStatus(status) {
            const statusEl = document.getElementById('syncStatusText');
            if(!statusEl) return;
            if(status === 'saving') {
                statusEl.innerHTML = '⏳ 正在保存...';
                statusEl.className = 'text-yellow-600 font-bold flex items-center gap-1 text-sm';
            } else if(status === 'saved') {
                statusEl.innerHTML = '☁️ 雲端已同步';
                statusEl.className = 'text-green-500 font-bold flex items-center gap-1 text-sm';
            } else if(status === 'error') {
                statusEl.innerHTML = '❌ 同步失敗';
                statusEl.className = 'text-red-500 font-bold flex items-center gap-1 text-sm';
            }
        }

        // P0: Custom confirm modal — replaces native confirm() for styled, consistent dialogs
        window.showConfirmModal = function(message, confirmText, cancelText) {
            confirmText = confirmText || '確認';
            cancelText = cancelText || '取消';
            return new Promise(function(resolve) {
                var backdrop = document.createElement('div');
                backdrop.className = 'fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[100]';
                backdrop.innerHTML = '<div class="bg-white dark:bg-gray-800 rounded-lg p-5 w-full max-w-sm shadow-xl border border-gray-200 dark:border-gray-600">'
                    + '<p class="text-gray-700 dark:text-gray-200 mb-5 text-sm">' + message + '</p>'
                    + '<div class="flex justify-end gap-3">'
                    + '<button id="confirmCancel" class="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">' + cancelText + '</button>'
                    + '<button id="confirmOk" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-bold">' + confirmText + '</button>'
                    + '</div></div>';
                document.body.appendChild(backdrop);
                backdrop.querySelector('#confirmCancel').onclick = function() { backdrop.remove(); resolve(false); };
                backdrop.querySelector('#confirmOk').onclick = function() { backdrop.remove(); resolve(true); };
                backdrop.addEventListener('click', function(e) { if(e.target === backdrop) { backdrop.remove(); resolve(false); } });
            });
        };

        // P0: Undo toast — shows for 30s, user can click "撤銷" to revert
        window.showUndoToast = function(message, onUndo) {
            var toast = document.createElement('div');
            toast.className = 'bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg fade-in text-sm flex items-center gap-3';
            toast.style.cssText = 'position:fixed; bottom:1.5rem; left:50%; transform:translateX(-50%); z-index:9999; max-width:24rem;';
            toast.innerHTML = '<span>🗑️ ' + message + '</span><button class="text-yellow-400 font-bold hover:text-yellow-300 underline text-sm">撤銷</button>';
            document.body.appendChild(toast);
            var undone = false;
            var timer = setTimeout(function() { if(!undone) toast.remove(); }, 30000);
            toast.querySelector('button').onclick = function() { undone = true; toast.remove(); clearTimeout(timer); onUndo(); };
        };

        // P1: First-visit portal onboarding — pure client-side, zero server deps
        window.initOnboarding = function() {
            if(localStorage.getItem('onboarding_done')) return;
            var overlay = document.createElement('div');
            overlay.id = 'onboardingOverlay';
            overlay.innerHTML = '<div class="fixed inset-0 bg-black bg-opacity-60 z-[90] flex items-center justify-center p-4">'
                + '<div class="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-600">'
                + '<h2 class="text-xl font-bold text-blue-600 mb-1">👋 歡迎來到排單系統！</h2>'
                + '<p class="text-gray-400 text-xs mb-4">共 6 個功能入口，每個都有專屬顏色幫你快速定位</p>'
                + '<div class="space-y-3 text-sm mb-5">'
                + '<div class="flex gap-3"><span class="text-lg">🔍</span><div><span class="font-bold text-gray-700 dark:text-gray-200">團員自查</span><p class="text-gray-400 text-xs">輸入密鑰+CN，查詢你的所有歷史排單</p></div></div>'
                + '<div class="flex gap-3"><span class="text-lg">💰</span><div><span class="font-bold text-yellow-700 dark:text-yellow-500">交腎中心</span><p class="text-gray-400 text-xs">上傳付款截圖，提交給團長審核</p></div></div>'
                + '<div class="flex gap-3"><span class="text-lg">📦</span><div><span class="font-bold text-green-700 dark:text-green-500">排發中心</span><p class="text-gray-400 text-xs">申請發貨，查看快遞單號</p></div></div>'
                + '<div class="flex gap-3"><span class="text-lg">🐷</span><div><span class="font-bold text-pink-600 dark:text-pink-400">豬豬成就</span><p class="text-gray-400 text-xs">看看你的吃谷戰鬥力排名</p></div></div>'
                + '<div class="flex gap-3"><span class="text-lg">👑</span><div><span class="font-bold text-blue-700 dark:text-blue-400">團長後台</span><p class="text-gray-400 text-xs">登錄後管理排單、審核、統計</p></div></div>'
                + '<div class="flex gap-3"><span class="text-lg">ℹ️</span><div><span class="font-bold text-gray-700 dark:text-gray-200">關於</span><p class="text-gray-400 text-xs">系統介紹和使用說明</p></div></div>'
                + '</div>'
                + '<div class="flex items-center gap-3">'
                + '<label class="flex items-center gap-2 text-xs text-gray-400 cursor-pointer"><input type="checkbox" id="onboardingSkip" class="rounded"> 下次不再顯示</label>'
                + '<button id="onboardingClose" class="ml-auto px-5 py-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 text-sm">開始使用 →</button>'
                + '</div></div></div>';
            document.body.appendChild(overlay);
            overlay.querySelector('#onboardingClose').onclick = function() {
                if(overlay.querySelector('#onboardingSkip').checked) localStorage.setItem('onboarding_done', '1');
                overlay.remove();
            };
        };
