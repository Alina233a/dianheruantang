document.addEventListener('DOMContentLoaded', () => {
    const apiContainer = document.getElementById('api-container');
    const addBtn = document.getElementById('add-btn');
    const modalOverlay = document.getElementById('modal-overlay');
    const cancelBtn = document.getElementById('cancel-btn');
    const apiForm = document.getElementById('api-form');
    const detailOverlay = document.getElementById('detail-modal-overlay');
    const batchActionBar = document.getElementById('batch-action-bar');
    
    let currentDetailIndex = -1; 
    let currentCategory = '全部';
    let isBatchMode = false;
    let selectedApis = [];

    // 增加安全捕获机制，防止数据损坏导致整个页面死机
    let categoryList = [];
    let rawList = [];
    try {
        categoryList = JSON.parse(localStorage.getItem('softboxCategoryStore')) || []; 
        rawList = JSON.parse(localStorage.getItem('softboxApiStore')) || [];
    } catch (e) {
        console.error("本地数据损坏，已重置为空", e);
        alert("检测到本地缓存数据格式有误，已临时跳过错误数据以保证页面正常运行。");
    }

    // 【数据平滑迁移】将原本的单分类变成多分类数组
    let apiList = rawList.map(api => {
        if (api.category !== undefined) {
            if (api.category && api.category !== '未分类' && api.category !== '') {
                api.categories = [api.category];
            } else {
                api.categories = [];
            }
            delete api.category;
        }
        if (!api.categories) api.categories = [];
        return api;
    });
    localStorage.setItem('softboxApiStore', JSON.stringify(apiList));

    // 获取当前过滤后的列表
    function getFilteredList() {
        if (currentCategory === '未分类') {
            return apiList.filter(api => !api.categories || api.categories.length === 0);
        } else if (currentCategory !== '全部') {
            return apiList.filter(api => api.categories && api.categories.includes(currentCategory));
        }
        return apiList;
    }

    function renderCategories() {
        const tabsContainer = document.getElementById('category-tabs');
        if (!tabsContainer) return;
        
        const hasUncategorized = apiList.some(api => !api.categories || api.categories.length === 0);
        let tabsHtml = `<button class="cat-tab ${currentCategory === '全部' ? 'active' : ''}" onclick="switchCategory('全部')">全部</button>`;
        
        if (hasUncategorized || currentCategory === '未分类') {
            tabsHtml += `<button class="cat-tab ${currentCategory === '未分类' ? 'active' : ''}" onclick="switchCategory('未分类')">未分类</button>`;
        }
        
        categoryList.forEach(cat => {
            tabsHtml += `<button class="cat-tab ${currentCategory === cat ? 'active' : ''}" onclick="switchCategory('${cat}')">${cat}</button>`;
        });
        tabsContainer.innerHTML = tabsHtml;

        // 渲染多选标签到弹窗里
        const renderMultiSelect = (containerId) => {
            const el = document.getElementById(containerId);
            if (!el) return;
            el.innerHTML = '';
            categoryList.forEach(cat => {
                const span = document.createElement('span');
                span.className = 'multi-cat-tag';
                span.innerText = cat;
                span.onclick = () => span.classList.toggle('active');
                el.appendChild(span);
            });
        };
        renderMultiSelect('api-category-list');
        renderMultiSelect('batch-category-list');
    }

    window.switchCategory = function(catName) {
        if(isBatchMode) return; 
        currentCategory = catName;
        renderCategories(); 
        renderAPIs();       
    }

    window.openManageMenu = function() { document.getElementById('manage-menu-overlay').classList.remove('hidden'); }
    window.closeManageMenu = function() { document.getElementById('manage-menu-overlay').classList.add('hidden'); }

    window.showBatchMove = function() {
        if (selectedApis.length === 0) return alert("请先选中要追加分类的卡片喔！");
        document.querySelectorAll('#batch-category-list .multi-cat-tag').forEach(el => el.classList.remove('active'));
        document.getElementById('batch-move-overlay').classList.remove('hidden');
    }
    window.closeBatchMove = function() { document.getElementById('batch-move-overlay').classList.add('hidden'); }

    window.openCategoryManage = function() {
        if(isBatchMode) return alert("请先退出批量管理模式喔");
        const action = prompt("输入新分类名称来添加，或者输入 '-分类名' 来删除（例如：-游戏）：");
        if (!action) return;
        
        if (action.startsWith('-')) {
            const target = action.substring(1).trim();
            if(confirm(`确定要删掉 [${target}] 分类吗？ Ovo \n(卡片不会被删，只会摘除这个标签)`)) {
                categoryList = categoryList.filter(c => c !== target);
                apiList.forEach(api => {
                    if (api.categories) api.categories = api.categories.filter(c => c !== target);
                });
                localStorage.setItem('softboxApiStore', JSON.stringify(apiList));
            }
        } else {
            const newCat = action.trim();
            if (newCat && !categoryList.includes(newCat) && newCat !== '未分类' && newCat !== '全部') {
                categoryList.push(newCat);
            }
        }
        localStorage.setItem('softboxCategoryStore', JSON.stringify(categoryList));
        if(!categoryList.includes(currentCategory) && currentCategory !== '全部' && currentCategory !== '未分类') {
            currentCategory = '全部';
        }
        renderCategories();
        renderAPIs();
    }

    window.toggleBatchMode = function() {
        isBatchMode = !isBatchMode;
        selectedApis = []; 
        if (isBatchMode) {
            batchActionBar.classList.remove('hidden');
            addBtn.classList.add('hidden'); 
        } else {
            batchActionBar.classList.add('hidden');
            addBtn.classList.remove('hidden');
        }
        updateBatchCount();
        renderAPIs(); 
    }

    function updateBatchCount() {
        document.getElementById('batch-count-num').innerText = selectedApis.length;
    }

    window.moveUp = function() {
        if (selectedApis.length !== 1) return alert("请仅选中 1 个卡片进行移动排序喔！");
        const globalIdx = selectedApis[0];
        let currentFiltered = getFilteredList();
        const visibleIdx = currentFiltered.findIndex(api => api === apiList[globalIdx]);
        
        if (visibleIdx > 0) {
            const targetGlobalIdx = apiList.indexOf(currentFiltered[visibleIdx - 1]);
            [apiList[globalIdx], apiList[targetGlobalIdx]] = [apiList[targetGlobalIdx], apiList[globalIdx]];
            selectedApis = [targetGlobalIdx]; 
            localStorage.setItem('softboxApiStore', JSON.stringify(apiList));
            renderAPIs();
        }
    }

    window.moveDown = function() {
        if (selectedApis.length !== 1) return alert("请仅选中 1 个卡片进行移动排序喔！");
        const globalIdx = selectedApis[0];
        let currentFiltered = getFilteredList();
        const visibleIdx = currentFiltered.findIndex(api => api === apiList[globalIdx]);
        
        if (visibleIdx !== -1 && visibleIdx < currentFiltered.length - 1) {
            const targetGlobalIdx = apiList.indexOf(currentFiltered[visibleIdx + 1]);
            [apiList[globalIdx], apiList[targetGlobalIdx]] = [apiList[targetGlobalIdx], apiList[globalIdx]];
            selectedApis = [targetGlobalIdx]; 
            localStorage.setItem('softboxApiStore', JSON.stringify(apiList));
            renderAPIs();
        }
    }

    window.batchMove = function() {
        const activeEls = document.querySelectorAll('#batch-category-list .active');
        const targetCats = Array.from(activeEls).map(el => el.innerText);
        if (targetCats.length === 0) return alert("请在上面点击选择至少一个分类标签喔！");

        selectedApis.forEach(globalIdx => {
            const api = apiList[globalIdx];
            const merged = new Set([...(api.categories || []), ...targetCats]);
            api.categories = Array.from(merged);
        });

        localStorage.setItem('softboxApiStore', JSON.stringify(apiList));
        closeBatchMove();
        toggleBatchMode(); 
        alert(`成功为这 ${selectedApis.length} 个站子追加了分类啦！`);
    }

    window.batchDelete = function() {
        if (selectedApis.length === 0) return alert("请先选中要删除的卡片喔！");
        if (confirm(`确定要一口气删掉这 ${selectedApis.length} 个站子吗？ (不可恢复哦) Ovo`)) {
            selectedApis.sort((a, b) => b - a).forEach(index => {
                apiList.splice(index, 1);
            });
            localStorage.setItem('softboxApiStore', JSON.stringify(apiList));
            toggleBatchMode();
        }
    }

    function renderAPIs() {
        apiContainer.innerHTML = '';
        let filteredList = getFilteredList();
        
        if (filteredList.length === 0) {
            apiContainer.innerHTML = '<p style="text-align:center; width:100%; color:#bca0dc; font-size:1.1rem; margin-top: 40px; font-weight: bold;">这里还空着喔 ૮₍ ˶ᵔ ᵕ ᵔ˶ ₎ა</p>';
            return;
        }

        // 优化：使用文档片段一次性渲染，解决卡顿
        const fragment = document.createDocumentFragment();

        filteredList.forEach((api) => {
            const realIndex = apiList.indexOf(api);
            const card = document.createElement('div');
            card.className = 'api-card hand-drawn-border';
            
            if (isBatchMode && selectedApis.includes(realIndex)) {
                card.classList.add('selected');
            }

            card.onclick = () => {
                if (isBatchMode) {
                    if (selectedApis.includes(realIndex)) {
                        selectedApis = selectedApis.filter(i => i !== realIndex);
                        card.classList.remove('selected');
                    } else {
                        selectedApis.push(realIndex);
                        card.classList.add('selected');
                    }
                    updateBatchCount();
                } else {
                    openDetail(realIndex);
                }
            };
            
            const tapeClass = realIndex % 2 === 0 ? 'top-center' : 'top-left';
            const urlBtnClass = api.url ? 'btn-blue' : 'btn-disabled';
            const keyBtnClass = api.key ? 'btn-yellow' : 'btn-disabled';
            const shareBtnClass = api.share ? 'btn-green' : 'btn-disabled';
            const deleteBtnHtml = isBatchMode ? '' : `<button class="delete-btn" onclick="deleteAPI(event, ${realIndex})" title="擦除记录">✖</button>`;

            let tagsHtml = '';
            if (api.categories && api.categories.length > 0) {
                tagsHtml = api.categories.map(c => `<span class="card-category-tag">${c}</span>`).join(' ');
            }

            let content = `
                <div class="tape ${tapeClass}"></div>
                ${deleteBtnHtml}
                <h3>${api.name} <br> ${tagsHtml}</h3>
                <div class="card-buttons">
                    <button class="macaron-btn ${urlBtnClass}" onclick="copyText(event, '${api.url || ''}')">链接</button>
                    <button class="macaron-btn ${keyBtnClass}" onclick="copyText(event, '${api.key || ''}')">密钥</button>
                    <button class="macaron-btn ${shareBtnClass}" onclick="copyText(event, '${api.share || ''}')">邀人</button>
                </div>
            `;
            card.innerHTML = content;
            fragment.appendChild(card);
        }); 

        apiContainer.appendChild(fragment);
    }

    window.openDetail = function(index) {
        currentDetailIndex = index;
        const api = apiList[index];
        document.getElementById('detail-name').innerText = api.name;
        document.getElementById('detail-url').innerText = api.url;
        document.getElementById('detail-key').innerText = api.key ? api.key : "无";
        document.getElementById('detail-share').innerText = api.share ? api.share : "无";
        document.getElementById('page-1').classList.remove('d-none');
        document.getElementById('page-2').classList.add('d-none');
        renderModels(); 
        detailOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    detailOverlay.addEventListener('click', (e) => {
        if (e.target === detailOverlay) {
            detailOverlay.classList.add('hidden');
            document.body.style.overflow = '';
        }
    });

    window.editApiInfo = function() {
        if (currentDetailIndex === -1) return;
        const api = apiList[currentDetailIndex];
        const newName = prompt("修改 API 名称：", api.name) || api.name;
        const newUrl = prompt("修改 URL：", api.url) || api.url;
        const newKey = prompt("修改 KEY (可为空)：", api.key || "") || api.key;
        const newShare = prompt("修改 邀人链接 (可为空)：", api.share || "") || api.share;
        
        const currentCats = (api.categories || []).join(', ');
        const newCatsInput = prompt("修改分类 (多个请用逗号隔开，清空则设为无分类)：", currentCats);
        
        if (newCatsInput !== null) {
            const newCatsArray = newCatsInput.split(/[,，]/).map(c => c.trim()).filter(c => c !== '');
            api.categories = newCatsArray;
            
            newCatsArray.forEach(cat => {
                if (!categoryList.includes(cat)) categoryList.push(cat);
            });
            localStorage.setItem('softboxCategoryStore', JSON.stringify(categoryList));
        }
        
        api.name = newName.trim();
        api.url = newUrl.trim();
        api.key = newKey.trim();
        api.share = newShare.trim();
        
        localStorage.setItem('softboxApiStore', JSON.stringify(apiList));
        document.getElementById('detail-name').innerText = api.name;
        document.getElementById('detail-url').innerText = api.url;
        document.getElementById('detail-key').innerText = api.key ? api.key : "无";
        document.getElementById('detail-share').innerText = api.share ? api.share : "无";
        renderCategories();
        renderAPIs(); 
    }

    window.flipPage = function(targetPage) {
        if (targetPage === 2) {
            document.getElementById('page-1').classList.add('d-none');
            document.getElementById('page-2').classList.remove('d-none');
        } else {
            document.getElementById('page-2').classList.add('d-none');
            document.getElementById('page-1').classList.remove('d-none');
        }
    }

    function renderModels() {
        const listEl = document.getElementById('model-list');
        listEl.innerHTML = '';
        if (currentDetailIndex === -1) return;
        const models = apiList[currentDetailIndex].models || [];
        if (models.length === 0) {
            listEl.innerHTML = '<p style="text-align:center; color: #bca0dc; font-size: 0.9rem; margin-top:20px;">还没有添加任何模型喔<br>快在上面输入并添加吧！</p>';
            return;
        }
        
        // 优化：使用文档片段一次性渲染，解决翻页卡顿
        const fragment = document.createDocumentFragment();
        
        models.forEach((model, mIndex) => {
            const item = document.createElement('div');
            item.className = 'model-item';
            item.innerHTML = `
                <span class="model-item-name">${model}</span>
                <div class="model-actions-btn">
                    <button class="sticker-btn btn-blue copy-icon-btn" onclick="copyText(event, '${model}')" title="复制">⧉</button>
                    <button class="model-delete-btn" onclick="deleteModel(${mIndex})" title="删除模型">✖</button>
                </div>
            `;
            fragment.appendChild(item);
        });

        listEl.appendChild(fragment);
    }

    window.addModel = function() {
        const input = document.getElementById('new-model-input');
        const modelName = input.value.trim();
        if (modelName && currentDetailIndex !== -1) {
            if (!apiList[currentDetailIndex].models) {
                apiList[currentDetailIndex].models = [];
            }
            apiList[currentDetailIndex].models.push(modelName);
            localStorage.setItem('softboxApiStore', JSON.stringify(apiList));
            input.value = ''; 
            renderModels(); 
        }
    }

    window.deleteModel = function(modelIndex) {
        if (currentDetailIndex !== -1) {
            if(confirm("确定要删除这个模型吗？ Ovo")) {
                apiList[currentDetailIndex].models.splice(modelIndex, 1);
                localStorage.setItem('softboxApiStore', JSON.stringify(apiList));
                renderModels();
            }
        }
    }

    window.copyText = function(e, text) {
        e.stopPropagation(); 
        if (!text || text === "无" || isBatchMode) return; 
        navigator.clipboard.writeText(text).then(() => {
            const btn = e.target;
            const originalText = btn.innerText;
            if (btn.classList.contains('copy-icon-btn')) {
                btn.innerText = "✓";
            } else {
                btn.innerText = "✓ 已复制";
            }
            setTimeout(() => { btn.innerText = originalText; }, 1500);
        });
    }

    window.deleteAPI = function(e, index) {
        e.stopPropagation(); 
        if(confirm("要把这个站子擦掉吗？ Ovo")) {
            apiList.splice(index, 1);
            localStorage.setItem('softboxApiStore', JSON.stringify(apiList));
            renderAPIs();
        }
    }

    addBtn.addEventListener('click', () => {
        document.querySelectorAll('#api-category-list .multi-cat-tag').forEach(el => el.classList.remove('active'));
        modalOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    });

    cancelBtn.addEventListener('click', () => {
        modalOverlay.classList.add('hidden');
        apiForm.reset();
        document.body.style.overflow = '';
    });

    apiForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const activeEls = document.querySelectorAll('#api-category-list .active');
        const selectedCats = Array.from(activeEls).map(el => el.innerText);

        const newAPI = {
            name: document.getElementById('api-name').value,
            url: document.getElementById('api-url').value,
            key: document.getElementById('api-key').value,
            share: document.getElementById('api-share').value,
            categories: selectedCats, 
            models: [] 
        };
        apiList.push(newAPI);
        localStorage.setItem('softboxApiStore', JSON.stringify(apiList)); 
        renderAPIs(); 
        modalOverlay.classList.add('hidden'); 
        apiForm.reset(); 
        document.body.style.overflow = '';
    });

    renderCategories();
    renderAPIs();
});