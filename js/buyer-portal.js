        async function doRankSearch() {
            let key = document.getElementById('rankKeyInput').value.trim();
            let myCn = document.getElementById('rankCnInput').value.trim();
            
            if(!key || !myCn) { showToast("密鑰和CN不能為空！🔑 請輸入團長提供的查詢密鑰和你的CN。", 'warning'); return; }
            
            showLoading('正在生成你的吃谷報告...');
            let res = await db.from('leader_data').select('group_data').eq('query_key', key).limit(1);
            if(res.error || !res.data || res.data.length === 0) {
                await new Promise(r => setTimeout(r, 1000));
                res = await db.from('leader_data').select('group_data').eq('query_key', key).limit(1);
            }
            hideLoading();
            
            let data = res.data ? res.data[0] : null;
            if(!data) { showToast("未找到密鑰！🤔 請檢查密鑰是否正確，或聯繫團長獲取最新密鑰。", 'error'); return; }
            
            let allItems = data.group_data || [];
            if(allItems.length === 0) { showToast("團長還沒有錄入任何谷子哦！", 'info'); return; }
            
            // 聚合所有人的數據
            let userStats = {};
            allItems.forEach(item => {
                let cn = (item.cn || '').trim();
                // 排除代排：凡是帶"代排"或者"代發"字眼的都不算入榜單
                if(cn.includes('代排') || cn.includes('代发')) return; 
                
                let lowerCn = cn.toLowerCase();
                if(!userStats[lowerCn]) {
                    userStats[lowerCn] = { cn: cn, count: 0, amount: 0 };
                }
                userStats[lowerCn].count += item.count;
                userStats[lowerCn].amount += (item.price * item.count);
            });
            
            let myLowerCn = myCn.toLowerCase();
            if(!userStats[myLowerCn]) {
                showToast("沒有找到你的吃谷記錄哦！請確保CN與團長錄入時完全一致（不含空格），代排數據不計入排名。", 'info'); return;
            }
            
            let myData = userStats[myLowerCn];
            
            // 計算排名
            let rankList = Object.values(userStats);
            
            // 1. 數量排名
            rankList.sort((a, b) => b.count - a.count);
            let countRank = rankList.findIndex(u => u.cn.toLowerCase() === myLowerCn) + 1;
            
            // 2. 金額排名
            rankList.sort((a, b) => b.amount - a.amount);
            let amountRank = rankList.findIndex(u => u.cn.toLowerCase() === myLowerCn) + 1;
            
            let totalBuyers = rankList.length;
            
            // 渲染結果
            document.getElementById('rankResultArea').classList.remove('hidden');
            document.getElementById('rankResultText').innerHTML = `
                <div class="text-center text-lg mb-4 text-gray-700 leading-relaxed">
                    恭喜你，<strong class="text-pink-600 text-2xl">${escapeHtml(myData.cn)}</strong>！<br>
                    你在本團一共吃了 <strong class="text-blue-500 text-3xl">${myData.count}</strong> 件谷子，<br>
                    目前累計腎額為 <strong class="text-red-500 text-3xl">¥${myData.amount.toFixed(2)}</strong>！
                </div>
                <div class="bg-pink-50 border border-pink-200 rounded p-4 text-center shadow-sm">
                    <p class="text-pink-800 font-bold mb-3 text-lg">🏆 你的全團排位 🏆</p>
                    <p class="text-sm text-gray-700 leading-loose">
                        你是全團 <strong class="text-pink-600 text-xl">${totalBuyers}</strong> 隻小豬豬中：<br>
                        吃谷數量 排名第 <strong class="text-blue-500 text-2xl">${countRank}</strong> 👑<br>
                        腎額 排名第 <strong class="text-red-500 text-2xl">${amountRank}</strong> 👑
                    </p>
                </div>
                <p class="text-xs text-gray-400 text-center mt-4">⚠️ 註：榜單已自動過濾含有"代排"的記錄，含金量極高！</p>
            `;
        }

        window.currentBuyerSearchItems = [];
        window.currentBuyerSearchImgData = {};

        async function doBuyerSearch() {
            let key = document.getElementById('queryKeyInput').value.trim();
            let cn = document.getElementById('queryCnInput').value.trim().toLowerCase();
            if(!key || !cn) { showToast("密鑰和CN不能為空！🔑 請輸入團長提供的查詢密鑰和你的CN。", 'warning'); return; }

            showLoading('查詢中...');
                        let res = await db.from('leader_data').select('group_data, image_data').eq('query_key', key).limit(1);
            if(res.error || !res.data || res.data.length === 0) {
                // 如果休眠了，等1秒再試一次
                await new Promise(r => setTimeout(r, 1000));
                res = await db.from('leader_data').select('group_data, image_data').eq('query_key', key).limit(1);
            }
            const data = res.data ? res.data[0] : null;
            const error = res.error;
            hideLoading();
            if(!data) { showToast("未找到密鑰！🤔 請檢查密鑰是否正確，或聯繫團長獲取最新密鑰。", 'error'); return; }

            let myItems = data.group_data.filter(item => item.cn.toLowerCase().includes(cn));
            if(myItems.length === 0) { showToast("未查到相關數據。🤔 請確認CN拼寫與團長錄入一致，或嘗試更換查詢密鑰。", 'info'); return; }

            window.currentBuyerSearchItems = myItems;
            window.currentBuyerSearchImgData = data.image_data || {};

            document.getElementById('buyerResultArea').classList.remove('hidden');
            
            // 新增：提取該買家參與過的所有獨立團期，並填充到下拉框
            let buyerBatches = [...new Set(myItems.map(i => i.batch))].filter(b => b);
            let filterSelect = document.getElementById('buyerBatchFilter');
            filterSelect.innerHTML = '<option value="all">全部團期</option>' + buyerBatches.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');

            window.renderBuyerSearchPage(0);
        }

        window.renderBuyerSearchPage = function(pageIndex) {
            const listDiv = document.getElementById('buyerList'); 
            listDiv.innerHTML = ''; 
            
            // 1. 獲取當前選中的團期
            let selectedBatch = document.getElementById('buyerBatchFilter').value;
            
            // 2. 根據選中的團期過濾數據
            let filteredItems = window.currentBuyerSearchItems;
            if (selectedBatch !== 'all') {
                filteredItems = window.currentBuyerSearchItems.filter(item => item.batch === selectedBatch);
            }

            // 3. 動態更新頂部的匯總信息 (僅統計當前篩選出的數據)
            let totalCount = 0; let groupedData = {}; 
            filteredItems.forEach(item => { 
                if(!groupedData[item.cn]) groupedData[item.cn] = []; 
                groupedData[item.cn].push(item); totalCount += item.count; 
            }); 
            let cnInput = document.getElementById('queryCnInput').value.trim().toLowerCase();
            let matchedNames = Object.keys(groupedData); 
            let nameStr = matchedNames.length > 1 ? `包含 "${cnInput}" 的匹配項` : (matchedNames[0] || cnInput); 
            document.getElementById('buyerSummary').innerHTML = `搜索結果：${escapeHtml(nameStr)} <br>當前展示數量：<strong class="text-blue-500">${totalCount}</strong> 件`;
            
            // 4. 處理分頁
            let pageSize = 10; 
            let totalItems = filteredItems.length;
            let totalPages = Math.ceil(totalItems / pageSize);
            
            if (pageIndex < 0) pageIndex = 0;
            if (pageIndex >= totalPages && totalPages > 0) pageIndex = totalPages - 1;
            
            let pageItems = filteredItems.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
            
            let pageGrouped = {};
            pageItems.forEach(item => {
                if(!pageGrouped[item.cn]) pageGrouped[item.cn] = [];
                pageGrouped[item.cn].push(item);
            });

            // 5. 重新計算當前篩選條件下的金額統計
            let globalGrouped = {};
            filteredItems.forEach(item => {
                if(!globalGrouped[item.cn]) globalGrouped[item.cn] = { count: 0, total: 0, paid: 0, unpaid: 0 };
                globalGrouped[item.cn].count += item.count;
                let money = item.price * item.count;
                globalGrouped[item.cn].total += money;
                if(item.paidStatus === '已交') globalGrouped[item.cn].paid += money;
                else globalGrouped[item.cn].unpaid += money;
            });

            // 6. 渲染列表卡片
            Object.keys(pageGrouped).forEach(buyerCn => {
                let cnGlobal = globalGrouped[buyerCn];
                
                let groupDiv = document.createElement('div'); 
                groupDiv.className = "mb-6 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm fade-in"; 
                
                groupDiv.innerHTML = `<div class="bg-blue-50 p-4 border-b border-blue-100 flex flex-col gap-2"><div class="flex justify-between items-center"><span class="text-blue-700 font-bold text-lg">CN: ${escapeHtml(buyerCn)}</span> <span class="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">共 ${cnGlobal.count} 件 (展示中)</span></div><div class="grid grid-cols-3 gap-2 text-center text-xs mt-2 bg-white p-2 rounded border border-blue-100"><div><span class="block text-gray-500">應付總額</span><span class="font-bold text-gray-800">¥${cnGlobal.total.toFixed(2)}</span></div><div class="border-l"><span class="block text-gray-500">已交款</span><span class="font-bold text-green-600">¥${cnGlobal.paid.toFixed(2)}</span></div><div class="border-l"><span class="block text-gray-500">未交款</span><span class="font-bold ${cnGlobal.unpaid > 0 ? 'text-red-500' : 'text-gray-400'}">¥${cnGlobal.unpaid.toFixed(2)}</span></div></div></div>`;

                let itemsContainer = document.createElement('div'); 
                itemsContainer.className = "p-3 space-y-4 bg-gray-50"; 

                let batchGroups = {}; 
                pageGrouped[buyerCn].forEach(i => { if(!batchGroups[i.batch]) batchGroups[i.batch] = []; batchGroups[i.batch].push(i); });

                for (let batchName in batchGroups) {
                    let batchDiv = document.createElement('div'); batchDiv.className = "space-y-2";
                    batchDiv.innerHTML = `<div class="text-sm font-bold text-gray-700 border-l-4 border-blue-400 pl-2 bg-white rounded shadow-sm py-1.5 px-2">${escapeHtml(batchName)}</div>`;
                    batchGroups[batchName].forEach(item => { 
                        let key = item.batch + '|' + item.category + '|' + item.character; 
                        let imgSrc = window.currentBuyerSearchImgData[key];
                        let imgHTML = imgSrc ? `<img src="${imgSrc}" class="w-20 h-20 md:w-24 md:h-24 object-cover rounded border border-gray-200 flex-shrink-0 bg-white">` : `<div class="w-20 h-20 bg-gray-100 rounded border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">無圖</div>`;
                        let card = document.createElement('div'); card.className = "border border-gray-100 bg-white rounded p-3 text-sm flex gap-3 shadow-sm"; 
                        card.innerHTML = `${imgHTML}<div class="flex-1 flex flex-col justify-center min-w-0"><div class="text-xs text-gray-500 truncate">${escapeHtml(item.category)}</div><div class="font-bold text-gray-800 text-base truncate mb-1">${escapeHtml(item.character)}</div><div class="flex justify-between items-center mt-auto"><div class="text-xs"><span class="text-gray-500">¥${item.price} × </span><span class="text-blue-500 font-bold">${item.count}</span></div><div class="flex gap-1"><span class="text-[10px] px-1.5 py-0.5 rounded border ${item.status==='已到货'?'border-blue-200 bg-blue-50 text-blue-600':item.status==='已排发'?'border-purple-200 bg-purple-50 text-purple-600':'border-gray-200 bg-gray-50 text-gray-500'} whitespace-nowrap">${escapeHtml(item.status||'未到货')}</span><span class="text-[10px] px-1.5 py-0.5 rounded border ${item.paidStatus==='已交'?'border-green-200 bg-green-50 text-green-600':'border-red-200 bg-red-50 text-red-500'} whitespace-nowrap">${escapeHtml(item.paidStatus||'未交')}</span></div></div></div>`;
                        batchDiv.appendChild(card); 
                    });
                    itemsContainer.appendChild(batchDiv);
                }
                groupDiv.appendChild(itemsContainer); 
                listDiv.appendChild(groupDiv); 
            });

            if (totalPages > 1) {
                let paginationDiv = document.createElement('div');
                paginationDiv.className = "mt-4 flex justify-between items-center text-sm bg-white p-3 rounded-lg shadow-sm border border-gray-200";
                paginationDiv.innerHTML = `
                    <button onclick="window.scrollTo({top: 0, behavior: 'smooth'}); renderBuyerSearchPage(${pageIndex - 1})" class="px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 font-bold transition disabled:opacity-50 disabled:cursor-not-allowed" ${pageIndex === 0 ? 'disabled' : ''}>上一頁</button>
                    <span class="text-gray-600 font-bold">第 ${pageIndex + 1} / ${totalPages} 頁</span>
                    <button onclick="window.scrollTo({top: 0, behavior: 'smooth'}); renderBuyerSearchPage(${pageIndex + 1})" class="px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 font-bold transition disabled:opacity-50 disabled:cursor-not-allowed" ${pageIndex === totalPages - 1 ? 'disabled' : ''}>下一頁</button>
                `;
                listDiv.appendChild(paginationDiv);
            }
        };

        // ================= 交腎系統核心邏輯 =================
        let currentPayBuyerCn = ''; let currentPayRawCn = ''; let currentPayKey = ''; let payUserId = ''; 
        let currentPayData = { items: [], reqs: [], paySettings: {}, imgData: {} };
        
        async function doPaymentSearch() {
            let key = document.getElementById('payKeyInput').value.trim(); 
            currentPayRawCn = document.getElementById('payCnInput').value.trim();
            currentPayBuyerCn = currentPayRawCn.toLowerCase(); 
            if(!key || !currentPayRawCn) { showToast("密鑰和CN不能為空！🔑 請輸入團長提供的查詢密鑰和你的CN。", 'warning'); return; }
            showLoading("查詢中..."); 
                        let res = await db.from('leader_data').select('user_id, group_data, image_data').eq('query_key', key).limit(1);
            if(res.error || !res.data || res.data.length === 0) {
                await new Promise(r => setTimeout(r, 1000));
                res = await db.from('leader_data').select('user_id, group_data, image_data').eq('query_key', key).limit(1);
            }
            const data = res.data ? res.data[0] : null;
            const error = res.error; 
            hideLoading();
            if(error || !data) { showToast("未找到密鑰或團長未設置全局密鑰！🔑 請確認密鑰正確，或聯繫團長完成設置。", 'error'); return; }
            currentPayKey = key; payUserId = data.user_id; let imgData = data.image_data || {}; 
            currentPayData.imgData = imgData;
            let reqs = JSON.parse(imgData['__PAYMENT_REQS__'] || '[]');
            currentPayData.paySettings = JSON.parse(imgData['__PAYMENT_SETTINGS__'] || '{}'); 
            currentPayData.reqs = reqs;
            let myReqs = reqs.filter(r => r.cn.toLowerCase() === currentPayBuyerCn);
            renderPayHistory(myReqs);
            currentPayData.allItems = data.group_data || []; 
            let myItems = currentPayData.allItems.filter(i => i.cn.toLowerCase() === currentPayBuyerCn && i.paidStatus !== '已交');
            let requestedItemIds = new Set(); 
            myReqs.filter(r => r.status === '待审核').forEach(r => r.items.forEach(id => requestedItemIds.add(id)));
            currentPayData.items = myItems.filter(i => !requestedItemIds.has(i.id));
            renderPayItemsPage(); 
            document.getElementById('payHistoryArea').classList.remove('hidden'); 
            document.getElementById('payResultArea').classList.remove('hidden');
        }

        function renderPayHistory(myReqs) {
            const list = document.getElementById('payHistoryList'); list.innerHTML = '';
            if(myReqs.length === 0) { list.innerHTML = '<p class="text-sm text-gray-400 text-center">暫無交腎記錄</p>'; return; }
            myReqs.slice().reverse().forEach(req => {
                let badge = req.status==='审核通过'?'bg-green-500':req.status==='被驳回'?'bg-red-500':'bg-yellow-500';
                list.innerHTML += `<div class="bg-white border border-gray-200 rounded p-3 text-sm shadow-sm relative"><div class="flex justify-between items-center mb-2"><span class="text-gray-500 text-xs font-bold">${new Date(req.time).toLocaleString()}</span><span class="text-white px-2 py-0.5 rounded text-xs font-bold ${badge}">${escapeHtml(req.status)}</span></div><div class="text-gray-700 font-bold mb-1">團期：${escapeHtml(req.batch)} (共 ${req.items.length} 項)</div><div class="text-red-500 font-bold">交腎金額：¥${req.amount.toFixed(2)}</div>${req.status === '被驳回' ? `<div class="mt-2 text-xs text-red-600 bg-red-50 p-1 rounded border border-red-200">駁回原因: ${escapeHtml(req.remark||'无')}</div>` : ''}</div>`;
            });
        }

        window.renderPayItemsPage = function() {
            const list = document.getElementById('payItemsList'); list.innerHTML = '';
            if(currentPayData.items.length === 0) { list.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">當前沒有需要交腎的商品。</p>'; return; }
            let batchGroups = {};
            currentPayData.items.forEach(item => { if(!batchGroups[item.batch]) batchGroups[item.batch] = { items: [], total: 0 }; batchGroups[item.batch].items.push(item); batchGroups[item.batch].total += item.price * item.count; });
            for(let batch in batchGroups) {
                let bData = batchGroups[batch]; let itemIds = bData.items.map(i => i.id).join(',');
                let batchHtml = `<div class="mb-5 bg-white rounded border border-yellow-200 overflow-hidden shadow-sm"><div class="bg-yellow-50 text-yellow-800 font-bold px-3 py-3 text-sm flex justify-between items-center border-b border-yellow-200"><span>🏷️ 團期：${escapeHtml(batch)}</span><span class="text-red-600 text-lg">¥${bData.total.toFixed(2)}</span></div><div class="p-3 space-y-2 bg-gray-50">`;
                bData.items.forEach(item => { batchHtml += `<div class="flex justify-between items-center text-sm border-b border-gray-100 pb-1"><span class="text-gray-600 truncate flex-1">${escapeHtml(item.category)} - ${escapeHtml(item.character)} x${item.count}</span><span class="text-gray-800 font-bold ml-2">¥${(item.price * item.count).toFixed(2)}</span></div>`; });
                batchHtml += `</div><div class="p-3 bg-white"><button onclick="openPayForm('${batch}', ${bData.total}, '${itemIds}')" class="w-full bg-yellow-500 text-white font-bold py-2 rounded hover:bg-yellow-600 transition shadow">📝 去交腎</button></div></div>`;
                list.innerHTML += batchHtml;
            }
        }

        window.currentPayContext = null;
        window.openPayForm = function(batch, total, itemIdsStr) {
            window.currentPayContext = { batch, total, itemIds: itemIdsStr.split(',') };
            document.getElementById('payTotalAmount').innerText = `¥${total.toFixed(2)}`;
            let codeUrl = currentPayData.paySettings[batch] || currentPayData.paySettings['__DEFAULT__'] || '';
            document.getElementById('payCodeArea').innerHTML = codeUrl ? `<img src="${codeUrl}" class="w-48 h-48 mx-auto object-contain border rounded shadow-sm">` : '<div class="text-red-400">團長未設置此團期的收款碼，請聯繫團長。</div>';
            window.currentBuyerUploadBase64 = '';
            let preview = document.getElementById('payUploadPreview'); if(preview) { preview.classList.add('hidden'); preview.querySelector('img').src = ''; }
            document.getElementById('payFormModal').classList.remove('hidden');
        }

        window.closePayForm = function() { document.getElementById('payFormModal').classList.add('hidden'); }

        window.submitPayment = async function() {
            if(!window.currentBuyerUploadBase64) { showToast("請上傳交腎付款截圖！", 'warning'); return; }
            var ctx = window.currentPayContext;
            var confirmed = await showConfirmModal(
                '確認提交交腎作業？<br><br><span class="text-sm text-gray-500">團期：' + escapeHtml(ctx.batch) + '<br>金額：¥' + ctx.total.toFixed(2) + '<br>商品數：' + ctx.itemIds.length + ' 件</span>',
                '確認提交', '再檢查下');
            if(!confirmed) return;
            let req = { id: generateSafeId(), cn: currentPayRawCn, batch: ctx.batch, items: ctx.itemIds, amount: ctx.total, proofImg: window.currentBuyerUploadBase64, remark: document.getElementById('payRemark').value.trim(), status: '待审核', time: Date.now() };
            showLoading("提交作業中...");
            try {
                const { data } = await db.from('leader_data').select('image_data').eq('user_id', payUserId).single();
                let imgData = data.image_data || {}; let latestReqs = JSON.parse(imgData['__PAYMENT_REQS__'] || '[]');
                latestReqs.push(req); imgData['__PAYMENT_REQS__'] = JSON.stringify(latestReqs);
                const { error } = await db.from('leader_data').update({ image_data: imgData }).eq('user_id', payUserId);
                if(error) throw error; hideLoading(); closePayForm(); showToast("交腎作業提交成功，等待團長批改！", 'success'); doPaymentSearch();
            } catch(e) { hideLoading(); showToast("提交失敗！請檢查網絡後重試。", 'error'); }
        }

        // ================= 排發系統核心邏輯 =================
        let currentShipBuyerCn = ''; let currentShipRawCn = ''; let currentShipKey = ''; let shipUserId = ''; 
        let currentShipData = { items: [], reqs: [], postageUrl: '', imgData: {} };
        
        window.currentShipSelectedIds = new Set();
        
        async function doShippingSearch() {
            let key = document.getElementById('shipKeyInput').value.trim(); 
            currentShipRawCn = document.getElementById('shipCnInput').value.trim();
            currentShipBuyerCn = currentShipRawCn.toLowerCase(); 
            
            if(!key || !currentShipRawCn) { showToast("密鑰和CN不能為空！🔑 請輸入團長提供的查詢密鑰和你的CN。", 'warning'); return; }
            
            showLoading("查詢中..."); 
                        let res = await db.from('leader_data').select('user_id, group_data, image_data').eq('query_key', key).limit(1);
            if(res.error || !res.data || res.data.length === 0) {
                await new Promise(r => setTimeout(r, 1000));
                res = await db.from('leader_data').select('user_id, group_data, image_data').eq('query_key', key).limit(1);
            }
            const data = res.data ? res.data[0] : null;
            const error = res.error;
            hideLoading();
            
            if(error || !data) {
                console.error("查詢錯誤:", error);
                showToast("未找到密鑰或團長未設置全局密鑰！🔑 請確認密鑰正確，或聯繫團長完成設置。", 'error'); return;
            }
            
            currentShipKey = key; shipUserId = data.user_id;
            let imgData = data.image_data || {}; 
            currentShipData.imgData = imgData; 
            
            let reqs = JSON.parse(imgData['__SHIPPING_REQS__'] || '[]');
            
            currentShipData.locSettings = JSON.parse(imgData['__LOCATION_SETTINGS__'] || '{}'); 
            currentShipData.reqs = reqs;
            
            let myReqs = reqs.filter(r => r.cn.toLowerCase().includes(currentShipBuyerCn));
            renderShipHistory(myReqs);
            
            currentShipData.allItems = data.group_data || []; 
            let allItems = currentShipData.allItems;
            let myItems = allItems.filter(i => i.cn.toLowerCase().includes(currentShipBuyerCn) && i.status === '已到货' && i.paidStatus === '已交');
            
            let requestedItemIds = new Set(); 
            myReqs.forEach(r => r.items.forEach(id => requestedItemIds.add(id)));
            currentShipData.items = myItems.filter(i => !requestedItemIds.has(i.id));
            
            window.currentShipSelectedIds.clear();
            renderShipItemsPage(0); 
            
            document.getElementById('shipHistoryArea').classList.remove('hidden'); 
            document.getElementById('shipResultArea').classList.remove('hidden');
        }

        function renderShipHistory(myReqs) {
            const list = document.getElementById('shipHistoryList'); list.innerHTML = '';
            if(myReqs.length === 0) { list.innerHTML = '<p class="text-sm text-gray-400 text-center">暫無排發歷史</p>'; return; }
            
            let displayReqs = myReqs.slice().reverse();
            displayReqs.forEach(req => {
                let badge = req.status==='已排发'?'bg-green-500':req.status==='需补邮'?'bg-red-500':'bg-yellow-500';
                
                let deleteBtnHtml = req.status !== '已排发' 
                    ? `<button onclick="event.stopPropagation(); deleteBuyerShipReq('${req.id}')" class="text-[10px] bg-red-50 text-red-500 border border-red-200 px-1.5 py-0.5 rounded hover:bg-red-100 ml-2">撤銷申請</button>` 
                    : '';

                list.innerHTML += `
                <div onclick="openShipDetail('${req.id}')" class="bg-white border border-gray-200 rounded p-3 text-sm shadow-sm cursor-pointer hover:bg-green-50 transition relative">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-gray-500 text-xs font-bold">${new Date(req.time).toLocaleString()}</span> 
                        <div class="flex items-center">
                            <span class="text-white px-2 py-0.5 rounded text-xs font-bold ${badge}">${req.status} ${req.trackingNo ? '🚚' : ''}</span>
                            ${deleteBtnHtml}
                        </div>
                    </div>
                    <div class="flex justify-between items-center">
                        <div class="text-gray-700 font-bold">已申請 ${req.items.length} 項谷子</div>
                        <div class="text-blue-500 text-xs bg-blue-50 px-2 py-1 rounded">查看詳情與回覆</div>
                    </div>
                </div>`;
            });
        }

        window.openShipDetail = function(reqId) {
            let req = currentShipData.reqs.find(r => r.id === reqId);
            if(!req) return;
            
            let itemsHtml = req.items.map(id => {
                let item = currentShipData.allItems.find(i => i.id === id);
                return item ? `<li>[${escapeHtml(item.batch)}] ${escapeHtml(item.category)} - ${escapeHtml(item.character)} <strong class="text-blue-500 ml-1">x${item.count}</strong></li>` : `<li class="text-red-400">未知/已刪除商品</li>`;
            }).join('');

            let badge = req.status==='已排发'?'text-green-600':req.status==='需补邮'?'text-red-500':'text-yellow-600';

            let fStatus = req.buyerFeedbackStatus || '未查看';
            let fRemark = req.buyerFeedbackRemark || '';

            document.getElementById('shipDetailContent').innerHTML = `
                <div class="border-b pb-2 mb-2">
                    <p><span class="font-bold">申請時間：</span>${new Date(req.time).toLocaleString()}</p>
                    <p><span class="font-bold">當前狀態：</span><span class="${badge} font-bold">${escapeHtml(req.status)}</span></p>
                </div>
                <div class="border-b pb-2 mb-2 bg-gray-50 p-2 rounded">
                    <p class="mb-1"><span class="font-bold text-green-700">📦 快遞單號：</span><span class="font-mono text-base ml-1 select-all">${escapeHtml(req.trackingNo || '暂无')}</span></p>
                    <p><span class="font-bold text-red-500">💬 團長回覆：</span>${escapeHtml(req.remark || '暂无')}</p>
                </div>
                <div class="border-b pb-2 mb-2">
                    <p><span class="font-bold">收件地址：</span>${escapeHtml(req.address)}</p>
                    <p><span class="font-bold">快遞要求：</span>${escapeHtml(req.express || '无')} <span class="ml-2 font-bold text-gray-500">(付郵：${escapeHtml(req.isPaid)})</span></p>
                </div>
                ${req.proofImg ? `
                <div class="border-b pb-2 mb-2">
                    <p class="font-bold mb-1 text-blue-600">📸 團長提供的平鋪圖/發貨憑證：</p>
                    <img src="${req.proofImg}" class="w-full object-contain rounded border shadow-sm" onclick="window.open(this.src)" title="點擊放大查看">
                </div>
                ` : ''}
                <div>
                    <p class="font-bold mb-1">包含的商品明細：</p>
                    <ul class="list-disc pl-5 text-gray-600 space-y-1 text-xs">${itemsHtml}</ul>
                </div>
                
                <div class="mt-4 pt-3 border-t border-dashed border-gray-300 bg-blue-50 p-2 rounded">
                    <p class="font-bold text-blue-800 mb-2">📢 平鋪圖/排發情況反饋</p>
                    <div class="space-y-2">
                        <select id="feedbackStatus_${req.id}" class="w-full border rounded p-1.5 text-sm font-bold text-gray-700">
                            <option value="未查看" ${fStatus==='未查看'?'selected':''}>🔘 默認：未查看</option>
                            <option value="已查看，无问题" ${fStatus==='已查看，无问题'?'selected':''}>✅ 已查看，無問題</option>
                            <option value="已查看，有问题" ${fStatus==='已查看，有问题'?'selected':''}>❌ 已查看，有問題</option>
                        </select>
                        <input type="text" id="feedbackRemark_${req.id}" value="${fRemark}" placeholder="團員備註 (如有問題請簡述，無問題可不填)" class="w-full border rounded p-1.5 text-sm">
                        <button onclick="submitBuyerFeedback('${req.id}')" class="w-full bg-blue-500 text-white font-bold py-1.5 rounded hover:bg-blue-600 transition text-sm shadow-sm mt-1">提交反饋給團長</button>
                    </div>
                </div>
            `;
            document.getElementById('shipDetailModal').classList.remove('hidden');
        }
        
        window.closeShipDetail = () => document.getElementById('shipDetailModal').classList.add('hidden');

        window.submitBuyerFeedback = async function(reqId) {
            let status = document.getElementById(`feedbackStatus_${reqId}`).value;
            let remark = document.getElementById(`feedbackRemark_${reqId}`).value.trim();
            
            showLoading("提交反饋中...");
            try {
                const { data } = await db.from('leader_data').select('image_data').eq('user_id', shipUserId).single();
                let imgData = data.image_data || {}; 
                let reqs = JSON.parse(imgData['__SHIPPING_REQS__'] || '[]');
                
                let target = reqs.find(r => r.id === reqId);
                if(target) {
                    target.buyerFeedbackStatus = status;
                    target.buyerFeedbackRemark = remark;
                    imgData['__SHIPPING_REQS__'] = JSON.stringify(reqs);
                    
                    const { error } = await db.from('leader_data').update({ image_data: imgData }).eq('user_id', shipUserId);
                    if(error) throw error;
                    
                    let localTarget = currentShipData.reqs.find(r => r.id === reqId);
                    if(localTarget) { localTarget.buyerFeedbackStatus = status; localTarget.buyerFeedbackRemark = remark; }
                    
                    hideLoading(); showToast("反饋提交成功！團長那邊已經能看到了。", 'success');
                }
            } catch(e) { hideLoading(); showToast("反饋提交失敗！請檢查網絡後重試。", 'error'); }
        }
        
        window.updateShipSelection = function(cb) {
            if(cb.checked) window.currentShipSelectedIds.add(cb.value);
            else window.currentShipSelectedIds.delete(cb.value);
        }
        
        window.currentShipPageIndex = 0; 
        window.renderShipItemsPage = function(pageIndex) {
            const list = document.getElementById('shipItemsList'); 
            list.innerHTML = '';
            let totalItems = currentShipData.items.length;
            if(totalItems === 0) { list.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">當前沒有可申請排發的商品。</p>'; return; }
            
            let pageSize = 10;
            let totalPages = Math.ceil(totalItems / pageSize);
            if(pageIndex < 0) pageIndex = 0;
            if(pageIndex >= totalPages) pageIndex = totalPages - 1;

            window.currentShipPageIndex = pageIndex; 
            
            let pageItems = currentShipData.items.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
            
            let locGroups = {};
            pageItems.forEach(item => {
                let loc = item.location || '默认未分配仓库';
                if(!locGroups[loc]) locGroups[loc] = [];
                locGroups[loc].push(item);
            });

            for(let loc in locGroups) {
                let locHtml = `<div class="mb-5 bg-gray-50 rounded border border-gray-200 overflow-hidden shadow-sm">
                    <div class="bg-blue-100 text-blue-800 font-bold px-3 py-2 text-sm flex justify-between items-center">
                        <span>🏠 囤貨地：${escapeHtml(loc)}</span>
                        <button onclick="toggleSelectLoc('${escapeHtml(loc)}')" class="text-xs bg-white text-blue-600 px-2 py-1 rounded shadow-sm border border-blue-200 hover:bg-blue-50 transition">本倉全選</button>
                    </div>
                    <div class="p-2 space-y-2">`;

                locGroups[loc].forEach(item => {
                    let key = `${item.batch}|${item.category}|${item.character}`;
                    let imgSrc = currentShipData.imgData[key];
                    let imgHTML = imgSrc ? `<img src="${imgSrc}" class="w-16 h-16 object-cover rounded border bg-white flex-shrink-0">` : `<div class="w-16 h-16 bg-gray-100 rounded border border-dashed flex items-center justify-center text-xs text-gray-400 flex-shrink-0">無圖</div>`;

                    let cnTag = '';
                    if(item.cn.toLowerCase() !== currentShipBuyerCn) {
                        cnTag = `<div class="mt-1"><span class="inline-block text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded break-all leading-tight">🏷️ 實際CN: ${escapeHtml(item.cn)}</span></div>`;
                    }

                    let isChecked = window.currentShipSelectedIds.has(item.id) ? 'checked' : '';

                    locHtml += `<label class="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded cursor-pointer hover:bg-green-50 transition">
                        <input type="checkbox" class="ship-item-cb w-5 h-5 text-green-500 border-gray-300 rounded flex-shrink-0" value="${item.id}" data-loc="${escapeHtml(loc)}" onchange="updateShipSelection(this)" ${isChecked}>
                        ${imgHTML}
                        <div class="flex-1 min-w-0 flex flex-col justify-center gap-0.5 pointer-events-none">
                            <div class="text-xs text-gray-500 leading-tight">
                                <span class="inline-block bg-gray-100 px-1 rounded text-[10px] text-gray-700 border border-gray-200">${escapeHtml(item.batch)}</span>
                                <span class="break-words">${escapeHtml(item.category)}</span>
                            </div>
                            <div class="font-bold text-gray-800 leading-tight break-words text-sm md:text-base">${escapeHtml(item.character)}</div>
                            ${cnTag}
                        </div>
                        <div class="text-green-600 font-bold text-base md:text-lg px-1 text-right whitespace-nowrap pointer-events-none">x${item.count}</div>
                    </label>`;
                });
                
                locHtml += `</div></div>`;
                list.innerHTML += locHtml;
            }
            
            if (totalPages > 1) {
                let paginationDiv = document.createElement('div');
                paginationDiv.className = "mt-4 flex justify-between items-center text-sm bg-white p-3 rounded-lg shadow-sm border border-gray-200";
                paginationDiv.innerHTML = `
                    <button onclick="window.scrollTo({top: 0, behavior: 'smooth'}); renderShipItemsPage(${pageIndex - 1})" class="px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 font-bold transition disabled:opacity-50 disabled:cursor-not-allowed" ${pageIndex === 0 ? 'disabled' : ''}>上一頁</button>
                    <span class="text-gray-600 font-bold">第 ${pageIndex + 1} / ${totalPages} 頁</span>
                    <button onclick="window.scrollTo({top: 0, behavior: 'smooth'}); renderShipItemsPage(${pageIndex + 1})" class="px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 font-bold transition disabled:opacity-50 disabled:cursor-not-allowed" ${pageIndex === totalPages - 1 ? 'disabled' : ''}>下一頁</button>
                `;
                list.appendChild(paginationDiv);
            }
        }       
        
        window.currentBuyerUploadBase64 = ''; 

        window.openShipForm = function() {
            let selected = Array.from(window.currentShipSelectedIds);
            if(selected.length === 0) { showToast('請先勾選要排發的谷子！', 'warning'); return; }
            
            let selectedLocs = new Set();
            selected.forEach(id => {
                let item = currentShipData.items.find(i => i.id === id);
                if(item) selectedLocs.add(item.location || '默认未分配仓库');
            });
            
            if(selectedLocs.size > 1) {
                showToast('抱歉，不同囤貨地（倉庫）的商品不能合併發貨！請分多次提交申請，每次只勾選同一個囤貨地標籤下的商品。', 'warning'); return;
            }

            let loc = Array.from(selectedLocs)[0];
            let settings = currentShipData.locSettings || {}; 
            let locConf = settings[loc] || {};
            
            let postageText = locConf.cost ? `📦 [${escapeHtml(loc)}] 郵費說明：${escapeHtml(locConf.cost)}` : `⚠️ [${escapeHtml(loc)}] 未設置明確郵費，請看群公告`;
            let imgHtml = locConf.url ? `<img src="${locConf.url}" class="w-40 h-40 mx-auto object-contain border rounded shadow-sm mt-2">` : '<div class="text-gray-400 mt-2 text-xs">團長未在此囤貨地上傳收款碼，可先選"否"提交</div>';
            
            document.getElementById('postageNoticeText').innerText = postageText;
            document.getElementById('postageCodeArea').innerHTML = imgHtml; 
            
            window.currentBuyerUploadBase64 = '';
            document.getElementById('shipUploadPreview').classList.add('hidden');
            document.getElementById('shipUploadPreview').querySelector('img').src = '';

            document.getElementById('shipFormModal').classList.remove('hidden');
        }

        window.closeShipForm = function() { document.getElementById('shipFormModal').classList.add('hidden'); }

        window.submitShipping = async function() {
            let selected = Array.from(window.currentShipSelectedIds);
            let address = document.getElementById('shipAddress').value.trim();
            if(!address) { showToast("請填寫詳細的收件地址！", 'warning'); return; }
            
            let req = { id: generateSafeId(), cn: currentShipRawCn, items: selected, address: address, express: document.getElementById('shipExpress').value.trim(), isPaid: document.getElementById('shipIsPaid').value, status: '处理中', trackingNo: '', remark: '', time: Date.now(), buyerProofImg: window.currentBuyerUploadBase64 };
            
            showLoading("提交中...");
            try {
                const { data } = await db.from('leader_data').select('image_data').eq('user_id', shipUserId).single();
                let imgData = data.image_data || {}; let latestReqs = JSON.parse(imgData['__SHIPPING_REQS__'] || '[]');
                latestReqs.push(req); imgData['__SHIPPING_REQS__'] = JSON.stringify(latestReqs);
                const { error } = await db.from('leader_data').update({ image_data: imgData }).eq('user_id', shipUserId);
                if(error) throw error; hideLoading(); closeShipForm(); showToast("提交成功！", 'success'); doShippingSearch(); 
            } catch(e) { hideLoading(); showToast("提交失敗！請檢查網絡後重試，或聯繫團長。", 'error'); }
        }
        // ================= 排發清單導出邏輯 =================
        // openShipExportModal 定義在 shipping-export.js 中

        window.deleteBuyerShipReq = async function(reqId) {
            var shipConfirmed = await showConfirmModal('確定要撤銷並刪除這條排發申請嗎？撤銷後你可以重新勾選商品發起申請。');
            if(!shipConfirmed) return;
            showLoading("撤銷中...");
            try {
                const { data } = await db.from('leader_data').select('image_data').eq('user_id', shipUserId).single();
                let imgData = data.image_data || {};
                let latestReqs = JSON.parse(imgData['__SHIPPING_REQS__'] || '[]');
                
                latestReqs = latestReqs.filter(r => r.id !== reqId);
                imgData['__SHIPPING_REQS__'] = JSON.stringify(latestReqs);
                
                const { error } = await db.from('leader_data').update({ image_data: imgData }).eq('user_id', shipUserId);
                if(error) throw error;
                
                hideLoading();
                showToast("已成功撤銷申請！", 'success');
                doShippingSearch(); 
            } catch(e) {
                hideLoading();
                showToast("撤銷失敗！請檢查網絡後重試。", 'error');
            }
        }
