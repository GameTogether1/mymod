// ========================================
// 游戏MOD网站主逻辑
// 功能：加载游戏列表，按 letter 字段分组，渲染字母导航和游戏卡片，展示MOD详情
// ========================================

// 全局变量
let allGames = [];          // 存储所有游戏对象
let currentGame = null;    // 当前选中的游戏
let currentMod = null;     // 当前选中的MOD

// DOM 元素
const gamesContainer = document.getElementById('games-container');
const alphabetNav = document.getElementById('alphabet-links');
const gameModModal = document.getElementById('game-mod-modal');
const modDetailModal = document.getElementById('mod-detail-modal');
const modalGameTitle = document.getElementById('modal-game-title');
const modalModTitle = document.getElementById('modal-mod-title');
const modsContainer = document.getElementById('mods-container');
const modDetailContent = document.getElementById('mod-detail-content');
const closeModModal = document.getElementById('close-mod-modal');
const closeDetailModal = document.getElementById('close-detail-modal');
const quarkLink = document.getElementById('quark-link');
const thunderLink = document.getElementById('thunder-link');
const browseGamesBtn = document.getElementById('browse-games');
const hotModsBtn = document.getElementById('hot-mods');

// 按 letter 字段分组游戏
function groupGamesByLetter(games) {
    const groups = {};
    games.forEach(game => {
        const letter = game.letter; // 直接使用 JSON 中的 letter 字段
        if (!groups[letter]) groups[letter] = [];
        groups[letter].push(game);
    });
    return groups;
}

// 渲染字母导航（只显示存在的字母）
function renderAlphabetNav(groups) {
    const letters = Object.keys(groups).sort();
    alphabetNav.innerHTML = letters.map(letter => `
        <a href="#section-${letter}" class="alphabet-link w-8 h-8 flex items-center justify-center rounded-full bg-dark-light hover:bg-primary hover:text-white transition-all duration-300 text-sm font-bold">${letter}</a>
    `).join('');
    
    // 绑定点击事件（平滑滚动）
    document.querySelectorAll('.alphabet-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            if (targetSection) {
                window.scrollTo({
                    top: targetSection.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// 渲染游戏卡片（按字母分组）
function renderGames(groups) {
    let html = '';
    const sortedLetters = Object.keys(groups).sort();
    sortedLetters.forEach(letter => {
        const games = groups[letter];
        html += `
            <section id="section-${letter}" class="mb-16">
                <h2 class="text-3xl font-bold mb-6 text-neon-blue text-shadow-neon flex items-center">
                    <span class="w-10 h-10 rounded-full bg-dark-light flex items-center justify-center mr-3">${letter}</span>
                    
                </h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        `;
        games.forEach(game => {
            html += `
                <div class="game-card rounded-lg overflow-hidden border border-gray-800 cursor-pointer" data-game-id="${game.id}">
                    <div class="relative">
                        <img src="${escapeHtml(game.image)}" alt="${escapeHtml(game.title)}" class="w-full h-48 object-cover">
                        <div class="game-card-overlay absolute inset-0 flex flex-col justify-end p-4">
                            <h3 class="text-xl font-bold text-white">${escapeHtml(game.title)}</h3>
                        </div>
                    </div>
                </div>
            `;
        });
        html += `</div></section>`;
    });
    gamesContainer.innerHTML = html;
    
    // 绑定游戏卡片点击事件
    document.querySelectorAll('.game-card').forEach(card => {
        card.addEventListener('click', () => {
            const gameId = card.getAttribute('data-game-id');
            openGameModModal(gameId);
        });
    });
}

// 加载游戏列表
async function loadGames() {
    try {
        const response = await fetch('data/games.json');
        if (!response.ok) throw new Error('加载游戏列表失败');
        allGames = await response.json();
        const groups = groupGamesByLetter(allGames);
        renderAlphabetNav(groups);
        renderGames(groups);
        
        // 暴露给全局，供搜索模块使用
        window.gameData = {
            allGames,
            renderGames: (filteredGames) => {
                const groups = groupGamesByLetter(filteredGames);
                renderAlphabetNav(groups);
                renderGames(groups);
            }
        };
    } catch (err) {
        console.error(err);
        gamesContainer.innerHTML = '<div class="text-center text-red-500">加载游戏列表失败，请刷新重试</div>';
    }
}

// 打开游戏MOD模态框
async function openGameModModal(gameId) {
    const game = allGames.find(g => g.id === gameId);
    if (!game) return;
    currentGame = game;
    modalGameTitle.textContent = game.title;
    modsContainer.innerHTML = '<div class="col-span-full text-center py-10">加载中...</div>';
    gameModModal.classList.remove('hidden');
    
    try {
        // 加载该游戏的MOD列表
        const modsResponse = await fetch(`data/mods/${gameId}.json`);
        if (!modsResponse.ok) throw new Error('加载MOD列表失败');
        const mods = await modsResponse.json();
        
        // 渲染MOD卡片
        modsContainer.innerHTML = '';
        mods.forEach(mod => {
            const modCard = document.createElement('div');
            modCard.className = 'mod-card rounded-lg overflow-hidden border border-gray-700 cursor-pointer';
            modCard.setAttribute('data-mod-id', mod.id);
            modCard.innerHTML = `
                <div class="relative">
                    <img src="${escapeHtml(mod.previewImage)}" alt="${escapeHtml(mod.title)}" class="w-full h-32 object-cover">
                    <div class="absolute inset-0 bg-gradient-to-t from-dark to-transparent flex items-end p-3">
                        <h4 class="text-white font-bold">${escapeHtml(mod.title)}</h4>
                    </div>
                </div>
            `;
            modsContainer.appendChild(modCard);
            modCard.addEventListener('click', () => openModDetailModal(mod));
        });
    } catch (err) {
        console.error(err);
        modsContainer.innerHTML = '<div class="col-span-full text-center text-red-500">加载MOD失败，请重试</div>';
    }
}

// 打开MOD详情模态框
function openModDetailModal(mod) {
    currentMod = mod;
    modalModTitle.textContent = mod.title;
    
    // 图片轮播初始化
    const currentImage = document.getElementById('current-image');
    const imageIndicators = document.getElementById('image-indicators');
    let currentImageIndex = 0;
    currentImage.src = mod.images[0];
    
    // 生成指示器
    imageIndicators.innerHTML = '';
    mod.images.forEach((_, idx) => {
        const indicator = document.createElement('div');
        indicator.className = `w-3 h-3 rounded-full ${idx === 0 ? 'bg-white' : 'bg-white/50'} transition-all cursor-pointer`;
        indicator.addEventListener('click', () => {
            currentImageIndex = idx;
            currentImage.src = mod.images[currentImageIndex];
            updateIndicators();
        });
        imageIndicators.appendChild(indicator);
    });
    
    function updateIndicators() {
        const indicators = imageIndicators.querySelectorAll('div');
        indicators.forEach((ind, idx) => {
            ind.className = `w-3 h-3 rounded-full ${idx === currentImageIndex ? 'bg-white' : 'bg-white/50'} transition-all cursor-pointer`;
        });
    }
    
    // 绑定左右箭头（移除旧监听器，避免重复）
    const prevBtn = document.getElementById('prev-image');
    const nextBtn = document.getElementById('next-image');
    if (prevBtn && nextBtn) {
        const newPrev = prevBtn.cloneNode(true);
        const newNext = nextBtn.cloneNode(true);
        prevBtn.parentNode.replaceChild(newPrev, prevBtn);
        nextBtn.parentNode.replaceChild(newNext, nextBtn);
        
        newPrev.addEventListener('click', () => {
            currentImageIndex = (currentImageIndex - 1 + mod.images.length) % mod.images.length;
            currentImage.src = mod.images[currentImageIndex];
            updateIndicators();
        });
        newNext.addEventListener('click', () => {
            currentImageIndex = (currentImageIndex + 1) % mod.images.length;
            currentImage.src = mod.images[currentImageIndex];
            updateIndicators();
        });
    }
    
    // 填充说明
    modDetailContent.innerHTML = `
        <div class="space-y-3">
            <h4 class="text-lg font-bold text-neon-blue">MOD说明</h4>
            <p class="text-gray-300">${escapeHtml(mod.description)}</p>
        </div>
    `;
    
    // 设置下载链接
    quarkLink.href = mod.quarkLink;
    thunderLink.href = mod.thunderLink;
    
    modDetailModal.classList.remove('hidden');
}

// 关闭模态框（带动画）
function closeModalWithAnimation(modal, modalContentSelector = '.modal-animation-enter') {
    const modalContent = modal.querySelector(modalContentSelector);
    if (modalContent) {
        modalContent.classList.add('tree-animation');
        setTimeout(() => {
            modal.classList.add('hidden');
            modalContent.classList.remove('tree-animation');
        }, 500);
    } else {
        modal.classList.add('hidden');
    }
}

// 事件绑定
closeModModal.addEventListener('click', () => closeModalWithAnimation(gameModModal));
closeDetailModal.addEventListener('click', () => closeModalWithAnimation(modDetailModal));
gameModModal.querySelector('.absolute.inset-0').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModModal.click();
});
modDetailModal.querySelector('.absolute.inset-0').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeDetailModal.click();
});

// 浏览游戏按钮滚动到第一个游戏区域
browseGamesBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const firstGameSection = document.querySelector('section[id^="section-"]');
    if (firstGameSection) {
        window.scrollTo({ top: firstGameSection.offsetTop - 80, behavior: 'smooth' });
    }
});

// 热门MOD按钮（简单提示）
hotModsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    alert('热门MOD功能开发中');
});

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

// 初始化加载游戏
loadGames();
