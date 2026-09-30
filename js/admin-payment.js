// ================= 團長端交腎管理 =================
        window.updatePayAdminCodeDisplay = function() {
            let batch = document.getElementById('payAdminBatchSelect').value;
            let settings = JSON.parse(imageUrlData['__PAYMENT_SETTINGS__'] || '{}');
            document.getElementById('payAdminCodeInput').value = settings[batch] || '';
        };

        window.renderPaymentAdmin = function() {
            const batchSelect = document.getElementById('payAdminBatchSelect');
            const batches = [...new Set(groupData.map(i => i.batch))].filter(b => b);
            if(batchSelect) batchSelect.innerHTML = batches.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');
            
            updatePayAdminCodeDisplay();
            let settings = JSON.parse(imageUrlData['__PAYMENT_SETTINGS__'] || '{}');
            document.getElementById('payAdminDefaultCodeInput').value = settings['__DEFAULT__'] || '';

            let reqs = JSON.parse(imageUrlData['__PAYMENT_REQS__'] || '[]'); 
            const list = document.getElementById('paymentAdminList'); list.innerHTML = '';
            if(reqs.length === 0) { list.innerHTML = '<p class="text-gray-400 text-sm">暫無交腎申請</p>'; return; }
            let now = Date.now(); let needSave = false;
            reqs.forEach(r => { if (r.proofImg && (now - r.time > 7 * 24 * 3600 * 1000)) { delete r.proofImg; needSave = true; } });
            if (needSave) { imageUrlData['__PAYMENT_REQS__'] = JSON.stringify(reqs); saveImageUrlData(); }
            reqs.slice().reverse().forEach(req => {
                let badge = req.status==='待審核'?'text-yellow-600':req.status==='審核通過'?'text-green-600':'text-red-500';
                let btnHtml = req.status === '待審核' ? `<div class="flex gap-2 mt-3"><button onclick="approvePayment('${req.id}')" class="flex-1 bg-green-500 text-white font-bold py-1.5 rounded hover:bg-green-600">✅ 確認已交款</button><button onclick="rejectPayment('${req.id}')" class="flex-1 bg-red-100 text-red-600 font-bold py-1.5 rounded hover:bg-red-200 border border-red-200">❌ 駁回</button></div>` : `<div class="mt-3 text-sm font-bold ${badge} text-center bg-gray-50 py-1.5 rounded border">狀態: ${req.status}<button onclick="deletePaymentReq('${req.id}')" class="ml-4 text-xs text-gray-400 hover:text-red-500 underline font-normal">刪除記錄</button></div>`;
                list.innerHTML += `<div class="border border-yellow-200 bg-white p-4 rounded shadow-sm mb-3"><div class="flex justify-between items-center border-b pb-2 mb-2"><span class="font-bold text-gray-800 text-lg">${req.cn}</span><span class="text-xs text-gray-500">${new Date(req.time).toLocaleString()}</span></div><div class="text-sm space-y-1 mb-2"><p><strong>團期：</strong>${req.batch}</p><p><strong>應交金額：</strong><span class="text-red-500 font-bold text-lg">¥${req.amount.toFixed(2)}</span></p><p><strong>買家留言：</strong>${req.remark || '無'}</p><p><strong>涉及穀子：</strong>共 ${req.items.length} 項</p></div>${req.proofImg ? `<img src="${req.proofImg}" class="w-full max-h-48 object-contain rounded border shadow-sm cursor-pointer bg-gray-50" onclick="window.open(this.src)">` : '<div class="text-xs text-gray-400 text-center py-4 bg-gray-50 border rounded">截圖已過期或未上傳</div>'}${btnHtml}</div>`;
            });
        }

        window.setBatchPayCode = function() {
            let batch = document.getElementById('payAdminBatchSelect').value; let codeUrl = document.getElementById('payAdminCodeInput').value.trim();
            if(!batch) { showToast("請選擇團期！", 'warning'); return; }
            let settings = JSON.parse(imageUrlData['__PAYMENT_SETTINGS__'] || '{}'); settings[batch] = codeUrl;
            imageUrlData['__PAYMENT_SETTINGS__'] = JSON.stringify(settings); saveImageUrlData();
            showToast(`團期 [${batch}] 的專用收款碼設定成功！`, 'success');
        }

        window.setDefaultPayCode = function() {
            let codeUrl = document.getElementById('payAdminDefaultCodeInput').value.trim();
            let settings = JSON.parse(imageUrlData['__PAYMENT_SETTINGS__'] || '{}');
            settings['__DEFAULT__'] = codeUrl;
            imageUrlData['__PAYMENT_SETTINGS__'] = JSON.stringify(settings); saveImageUrlData();
            showToast(`全域預設收款碼設定成功！`, 'success');
        }

        window.approvePayment = async function(reqId) {
            if(!confirm('確認該團員已交款？\n確認後，他申請的這批穀子狀態將全部自動變為"已交"！')) return;
            showLoading("審批中...");
            try {
                let reqs = JSON.parse(imageUrlData['__PAYMENT_REQS__'] || '[]'); let target = reqs.find(r => r.id === reqId);
                if(target) {
                    target.status = '審核通過';
                    groupData.forEach(item => { if(target.items.includes(item.id)) item.paidStatus = '已交'; });
                    imageUrlData['__PAYMENT_REQS__'] = JSON.stringify(reqs);
                    saveDataLocalOnly(); await syncToCloud(); renderPaymentAdmin();
                    if(document.getElementById('page-manage').classList.contains('hidden') === false) renderManageTable();
                    hideLoading(); showToast("審批通過，相關穀子已自動更新為【已交】狀態！", 'success');
                }
            } catch(e) { hideLoading(); showToast("審批失敗！", 'error'); }
        }

        window.rejectPayment = async function(reqId) {
            let reason = prompt('請輸入駁回原因 (團員可見):', '截圖模糊或金額不對'); if(reason === null) return;
            showLoading("駁回中...");
            try {
                let reqs = JSON.parse(imageUrlData['__PAYMENT_REQS__'] || '[]'); let target = reqs.find(r => r.id === reqId);
                if(target) { target.status = '被駁回'; target.remark = reason; imageUrlData['__PAYMENT_REQS__'] = JSON.stringify(reqs); saveImageUrlData(); renderPaymentAdmin(); hideLoading(); }
            } catch(e) { hideLoading(); showToast("操作失敗！", 'error'); }
        }

        window.deletePaymentReq = function(reqId) {
            if(!confirm('確定要刪除這條申請記錄嗎？(僅刪除記錄，不影響穀子狀態)')) return;
            dismissedReqIds.add(reqId);
            let reqs = JSON.parse(imageUrlData['__PAYMENT_REQS__'] || '[]'); reqs = reqs.filter(r => r.id !== reqId);
            imageUrlData['__PAYMENT_REQS__'] = JSON.stringify(reqs); saveImageUrlData(); renderPaymentAdmin();
        }
