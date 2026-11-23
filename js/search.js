/**
 * 搜索模块 - 实现下拉列表实时搜索
 * 功能：输入时显示匹配游戏的下拉列表，点击项后自动滚动到游戏卡片位置
 */
(function() {
    // 注入下拉列表样式
    const style = document.createElement('style');
    style.textContent = `
        .search-dropdown {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 12px;
            margin-top: 8px;
            max-height: 320px;
            overflow-y: auto;
            z-index: 1000;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.2);
            backdrop-filter: blur(10px);
            display: none;
        }
        .search-dropdown-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            cursor: pointer;
            transition: background 0.2s;
            border-bottom: 1px solid #334155;
        }
        .search-dropdown-item:last-child {
            border-bottom: none;
        }
        .search-dropdown-item:hover {
            background: #2d3a4e;
        }
        .search-dropdown-img {
            width: 40px;
            height: 40px;
            object-fit: cover;
            border-radius: 8px;
        }
        .search-dropdown-info {
            flex: 1;
        }
        .search-dropdown-title {
            font-weight: 600;
            color: white;
            font-size: 0.9rem;
        }
        .search-dropdown-category {
            font-size: 0.7rem;
            color: #94a3b8;
            margin-top: 2px;
        }
        .search-dropdown-empty {
            padding: 24px;
            text-align: center;
            color: #94a3b8;
        }
        .search-wrapper {
            position: relative;
            width: 100%;
        }
    `;
    document.head.appendChild(style);

    // 获取搜索输入框元素
    const searchInput = document.getElementById('search-input');
    const mobileSearchInput = document.getElementById('mobile-search-input');
    
    if (!searchInput && !mobileSearchInput) return;
    
    // 创建下拉容器
    function createDropdown(container) {
        let dropdown = container.querySelector('.search-dropdown');
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'search-dropdown';
            container.style.position = 'relative';
            container.appendChild(dropdown);
        }
        return dropdown;
    }
    
    // 关闭所有下拉菜单
    function closeAllDropdowns() {
        document.querySelectorAll('.search-dropdown').forEach(dd => {
            dd.style.display = 'none';
        });
    }
    
    // 滚动到指定游戏卡片
    function scrollToGame(gameId) {
        const card = document.querySelector(`.game-card[data-game-id="${gameId}"]`);
        if (card) {
            const headerOffset = 120; // 顶部导航栏高度偏移
            const elementPosition = card.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.scrollY - headerOffset;
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
            // 添加高亮效果
            card.classList.add('search-highlight');
            setTimeout(() => card.classList.remove('search-highlight'), 1500);
        }
    }
    
    // 渲染下拉列表
    function renderDropdown(dropdown, games, inputElement) {
        dropdown.innerHTML = '';
        if (!games || games.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'search-dropdown-empty';
            emptyDiv.textContent = '未找到相关游戏';
            dropdown.appendChild(emptyDiv);
            dropdown.style.display = 'block';
            return;
        }
        
        games.forEach(game => {
            const item = document.createElement('div');
            item.className = 'search-dropdown-item';
            item.innerHTML = `
                <img src="${escapeHtml(game.image)}" alt="${escapeHtml(game.title)}" class="search-dropdown-img" loading="lazy">
                <div class="search-dropdown-info">
                    <div class="search-dropdown-title">${escapeHtml(game.title)}</div>
                    <div class="search-dropdown-category">${escapeHtml(game.category || game.letter || '')}</div>
                </div>
            `;
            item.addEventListener('click', () => {
                scrollToGame(game.id);
                inputElement.value = '';
                closeAllDropdowns();
            });
            dropdown.appendChild(item);
        });
        dropdown.style.display = 'block';
    }
    
    // 防抖函数
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    // 处理搜索输入
    function handleSearchInput(e, inputElement, dropdownContainer) {
        const keyword = e.target.value.trim().toLowerCase();
        const dropdown = createDropdown(dropdownContainer);
        
        if (keyword === '') {
            dropdown.style.display = 'none';
            return;
        }
        
        // 从全局游戏数据中筛选
        if (!window.gameData || !window.gameData.allGames) return;
        
        const filtered = window.gameData.allGames.filter(game => 
            game.title.toLowerCase().includes(keyword) ||
            (game.category && game.category.toLowerCase().includes(keyword))
        ).slice(0, 12); // 最多显示12个
        
        renderDropdown(dropdown, filtered, inputElement);
    }
    
    // 绑定搜索框
    function bindSearch(inputElement) {
        if (!inputElement) return;
        // 获取父容器作为下拉相对定位容器
        const parent = inputElement.parentElement;
        if (!parent.classList.contains('search-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'search-wrapper';
            parent.insertBefore(wrapper, inputElement);
            wrapper.appendChild(inputElement);
        }
        const wrapper = inputElement.closest('.search-wrapper');
        const debouncedHandle = debounce((e) => handleSearchInput(e, inputElement, wrapper), 300);
        inputElement.addEventListener('input', debouncedHandle);
        inputElement.addEventListener('focus', () => {
            if (inputElement.value.trim() !== '') {
                const dropdown = createDropdown(wrapper);
                if (dropdown.children.length > 0) dropdown.style.display = 'block';
            }
        });
        // 点击外部关闭下拉
        document.addEventListener('click', function(e) {
            if (!wrapper.contains(e.target)) {
                const dropdown = wrapper.querySelector('.search-dropdown');
                if (dropdown) dropdown.style.display = 'none';
            }
        });
    }
    
    // 辅助函数：防止XSS
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
    
    // 初始化
    if (searchInput) bindSearch(searchInput);
    if (mobileSearchInput) bindSearch(mobileSearchInput);
})();
