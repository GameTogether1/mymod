// ========================================
// 游戏MOD网站主逻辑 + ModTogether（一块Mod）客户端桥接
// 功能：加载游戏列表、按 letter 分组、展开 MOD 详情、支持 postMessage 一键下载自动导入
// ========================================

let allGames = [];
let currentGame = null;
let currentMod = null;

// 检测是否运行在 ModTogether（一块Mod）内置页面中
const isEmbeddedInModTogether =
    window.self !== window.top ||
    new URLSearchParams(window.location.search).get('embed') === 'modtogether';

if (isEmbeddedInModTogether) {
    document.body.classList.add('modtogether-embed');
}

// 站点游戏 ID -> ModTogether 客户端内部 gameId 映射表
const SITE_TO_CLIENT_GAME_ID = {
    'resident-evil-2': 're2r',
    'resident-evil-3': 're3r',
    'resident-evil-4': 're4r',
    'resident-evil-7': 're7',
    'resident-evil-8': 're8',
    'elden-ring': 'eldenring',
    'the-witcher-3': 'witcher3',
    'cyberpunk-2077': 'cyberpunk2077',
    'stellar-blade': 'stellar_blade',
    'black-myth-wukong': 'wukong',
    'skyrim': 'skyrimse',
    'red-dead-redemption-2': 'rdr2',
};

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
const quarkQrModal = document.getElementById('quark-qr-modal');
const quarkQrBackdrop = document.getElementById('quark-qr-backdrop');
const quarkQrBox = document.getElementById('quark-qr-box');
const closeQuarkQrBtn = document.getElementById('close-quark-qr');
const siteToast = document.getElementById('site-toast');
const importBtn = document.getElementById('modtogether-import-btn');
const importBtnLabel = document.getElementById('modtogether-import-label');
const browseGamesBtn = document.getElementById('browse-games');
const hotModsBtn = document.getElementById('hot-mods');

function groupGamesByLetter(games) {
    const groups = {};
    games.forEach(game => {
        const letter = game.letter || '#';
        if (!groups[letter]) groups[letter] = [];
        groups[letter].push(game);
    });
    return groups;
}

function renderAlphabetNav(groups) {
    if (!alphabetNav) return;
    const letters = Object.keys(groups).sort();
    alphabetNav.innerHTML = letters.map(letter => `
        <a href="#section-${letter}" class="alphabet-link w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800/80 hover:bg-cyan-500 hover:text-zinc-950 transition-all duration-200 text-sm font-bold">${letter}</a>
    `).join('');

    document.querySelectorAll('.alphabet-link').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            if (targetSection) {
                window.scrollTo({
                    top: targetSection.offsetTop - 72,
                    behavior: 'smooth'
                });
            }
        });
    });
}

function renderGames(groups) {
    if (!gamesContainer) return;
    let html = '';
    const sortedLetters = Object.keys(groups).sort();
    sortedLetters.forEach(letter => {
        const games = groups[letter];
        html += `
            <section id="section-${letter}" class="mb-12">
                <h2 class="text-xl font-bold mb-5 text-cyan-400 flex items-center gap-3">
                    <span class="w-9 h-9 rounded-xl bg-zinc-800/90 border border-zinc-700/80 flex items-center justify-center text-base">${letter}</span>
                    <span class="h-px flex-1 bg-zinc-800"></span>
                </h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        `;
        games.forEach(game => {
            html += `
                <div class="game-card cursor-pointer group" data-game-id="${escapeHtml(game.id)}">
                    <div class="relative aspect-[16/10] bg-zinc-900 overflow-hidden">
                        <img src="${escapeHtml(game.image)}" alt="${escapeHtml(game.title)}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                        <div class="game-card-overlay absolute inset-0 flex flex-col justify-end p-4">
                            <h3 class="text-base font-bold text-white tracking-wide">${escapeHtml(game.title)}</h3>
                            <span class="text-[11px] text-cyan-300/90 mt-0.5">点击查看 MOD 列表 →</span>
                        </div>
                    </div>
                </div>
            `;
        });
        html += `</div></section>`;
    });
    gamesContainer.innerHTML = html;

    document.querySelectorAll('.game-card').forEach(card => {
        card.addEventListener('click', () => {
            const gameId = card.getAttribute('data-game-id');
            openGameModModal(gameId);
        });
    });
}

async function loadGames() {
    try {
        const response = await fetch('data/games.json');
        if (!response.ok) throw new Error('加载游戏列表失败');
        allGames = await response.json();
        const groups = groupGamesByLetter(allGames);
        renderAlphabetNav(groups);
        renderGames(groups);

        window.gameData = {
            allGames,
            renderGames: (filteredGames) => {
                const g = groupGamesByLetter(filteredGames);
                renderAlphabetNav(g);
                renderGames(g);
            }
        };
    } catch (err) {
        console.error(err);
        if (gamesContainer) {
            gamesContainer.innerHTML = '<div class="text-center text-red-400 py-12">加载游戏列表失败，请刷新重试</div>';
        }
    }
}

async function openGameModModal(gameId) {
    const game = allGames.find(g => g.id === gameId);
    if (!game) return;
    currentGame = game;
    modalGameTitle.textContent = game.title;
    modsContainer.innerHTML = '<div class="col-span-full text-center text-gray-400 py-10">正在加载 MOD 列表...</div>';
    gameModModal.classList.remove('hidden');

    try {
        const modsResponse = await fetch(`data/mods/${gameId}.json`);
        if (!modsResponse.ok) throw new Error('暂未上传该游戏的 MOD');
        const mods = await modsResponse.json();

        if (!Array.isArray(mods) || mods.length === 0) {
            modsContainer.innerHTML = '<div class="col-span-full text-center text-gray-400 py-10">该游戏暂未上传 MOD，敬请期待</div>';
            return;
        }

        modsContainer.innerHTML = '';
        mods.forEach(mod => {
            const hasDirect = Boolean(mod.downloadUrl || mod.directUrl);
            const modCard = document.createElement('div');
            modCard.className = 'mod-card overflow-hidden cursor-pointer group';
            modCard.setAttribute('data-mod-id', mod.id);
            modCard.innerHTML = `
                <div class="relative aspect-[16/10] bg-zinc-900 overflow-hidden">
                    <img src="${escapeHtml(mod.previewImage)}" alt="${escapeHtml(mod.title)}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                    ${hasDirect ? '<span class="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/90 text-white shadow">支持一键导入</span>' : ''}
                    <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent flex items-end p-3">
                        <h4 class="mod-title text-white text-sm font-semibold line-clamp-1">${escapeHtml(mod.title)}</h4>
                    </div>
                </div>
            `;
            modsContainer.appendChild(modCard);
            modCard.addEventListener('click', () => openModDetailModal(mod));
        });
    } catch (err) {
        console.error(err);
        modsContainer.innerHTML = '<div class="col-span-full text-center text-gray-400 py-10">该游戏暂未上传 MOD 数据</div>';
    }
}

function openModDetailModal(mod) {
    currentMod = mod;
    modalModTitle.textContent = mod.title;

    const currentImage = document.getElementById('current-image');
    const imageIndicators = document.getElementById('image-indicators');
    const imgs = Array.isArray(mod.images) && mod.images.length > 0 ? mod.images : [mod.previewImage];
    let currentImageIndex = 0;
    currentImage.src = imgs[0] || '';

    imageIndicators.innerHTML = '';
    imgs.forEach((_, idx) => {
        const indicator = document.createElement('div');
        indicator.className = `w-2.5 h-2.5 rounded-full ${idx === 0 ? 'bg-white scale-110' : 'bg-white/40'} transition-all cursor-pointer`;
        indicator.addEventListener('click', () => {
            currentImageIndex = idx;
            currentImage.src = imgs[currentImageIndex];
            updateIndicators();
        });
        imageIndicators.appendChild(indicator);
    });

    function updateIndicators() {
        const indicators = imageIndicators.querySelectorAll('div');
        indicators.forEach((ind, idx) => {
            ind.className = `w-2.5 h-2.5 rounded-full ${idx === currentImageIndex ? 'bg-white scale-110' : 'bg-white/40'} transition-all cursor-pointer`;
        });
    }

    const prevBtn = document.getElementById('prev-image');
    const nextBtn = document.getElementById('next-image');
    if (prevBtn && nextBtn) {
        const newPrev = prevBtn.cloneNode(true);
        const newNext = nextBtn.cloneNode(true);
        prevBtn.parentNode.replaceChild(newPrev, prevBtn);
        nextBtn.parentNode.replaceChild(newNext, nextBtn);

        newPrev.addEventListener('click', () => {
            currentImageIndex = (currentImageIndex - 1 + imgs.length) % imgs.length;
            currentImage.src = imgs[currentImageIndex];
            updateIndicators();
        });
        newNext.addEventListener('click', () => {
            currentImageIndex = (currentImageIndex + 1) % imgs.length;
            currentImage.src = imgs[currentImageIndex];
            updateIndicators();
        });
    }

    modDetailContent.innerHTML = `
        <div class="space-y-2 rounded-xl bg-zinc-900/70 border border-zinc-800 p-4">
            <h4 class="text-sm font-bold text-cyan-400">MOD 说明</h4>
            <p class="text-sm text-gray-300 leading-relaxed">${escapeHtml(mod.description || '暂无说明')}</p>
        </div>
    `;

    // 网盘链接
    if (mod.quarkLink) {
        quarkLink.href = mod.quarkLink;
        quarkLink.classList.remove('hidden');
    } else {
        quarkLink.classList.add('hidden');
    }

    if (mod.thunderLink) {
        thunderLink.href = mod.thunderLink;
        thunderLink.classList.remove('hidden');
    } else {
        thunderLink.classList.add('hidden');
    }

    // 一键下载并导入到 ModTogether（一块Mod）按钮（当 JSON 配置了 downloadUrl / directUrl 时显示）
    const directDownloadUrl = mod.downloadUrl || mod.directUrl || '';
    if (importBtn) {
        if (directDownloadUrl) {
            importBtn.classList.remove('hidden');
            importBtn.disabled = false;
            if (importBtnLabel) {
                importBtnLabel.textContent = isEmbeddedInModTogether
                    ? '一键下载并导入到 一块Mod'
                    : '高速直链下载';
            }
            importBtn.onclick = () => {
                const clientGameId =
                    (currentGame && SITE_TO_CLIENT_GAME_ID[currentGame.id]) ||
                    (currentGame && currentGame.id) ||
                    '';
                if (isEmbeddedInModTogether) {
                    importBtn.disabled = true;
                    if (importBtnLabel) importBtnLabel.textContent = '正在下载并导入...';
                    window.parent.postMessage(
                        {
                            type: 'MODTOGETHER_DOWNLOAD_MOD',
                            gameId: clientGameId,
                            modId: mod.id,
                            modName: mod.title,
                            downloadUrl: directDownloadUrl
                        },
                        '*'
                    );
                } else {
                    window.open(directDownloadUrl, '_blank', 'noopener,noreferrer');
                }
            };
        } else {
            importBtn.classList.add('hidden');
        }
    }

    modDetailModal.classList.remove('hidden');
}

// 轻提示 Toast
let siteToastTimer = null;
function showSiteToast(text) {
    if (!siteToast) return;
    siteToast.textContent = text;
    siteToast.classList.remove('hidden');
    if (siteToastTimer) clearTimeout(siteToastTimer);
    siteToastTimer = setTimeout(() => {
        siteToast.classList.add('hidden');
    }, 3200);
}

// 兼容 iframe 环境的可靠剪贴板复制
async function copyTextReliably(text, toastMessage) {
    let copied = false;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            copied = true;
        }
    } catch (_) {}

    if (!copied) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        } catch (_) {}
    }

    // 同步通知 ModTogether 客户端写入系统剪贴板并弹出客户端提示
    if (isEmbeddedInModTogether) {
        window.parent.postMessage(
            {
                type: 'MODTOGETHER_COPY_TEXT',
                text,
                message: toastMessage
            },
            '*'
        );
    }

    showSiteToast(toastMessage);
}

// 打开夸克网盘二维码弹窗
function openQuarkQrModal(url) {
    if (!quarkQrModal || !quarkQrBox || !url) return;
    quarkQrBox.innerHTML = '';

    if (typeof window.QRCode === 'function') {
        new window.QRCode(quarkQrBox, {
            text: url,
            width: 208,
            height: 208,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: window.QRCode.CorrectLevel.M
        });
    } else {
        const img = document.createElement('img');
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=208x208&margin=0&data=${encodeURIComponent(url)}`;
        img.alt = '夸克网盘二维码';
        img.className = 'w-[208px] h-[208px]';
        quarkQrBox.appendChild(img);
    }

    quarkQrModal.classList.remove('hidden');
}

function closeQuarkQrModal() {
    if (quarkQrModal) {
        quarkQrModal.classList.add('hidden');
    }
}

if (closeQuarkQrBtn) {
    closeQuarkQrBtn.addEventListener('click', closeQuarkQrModal);
}
if (quarkQrBackdrop) {
    quarkQrBackdrop.addEventListener('click', closeQuarkQrModal);
}

// 暴露给全局（供 auth.js 验证通过后或直接点击调用）
window.openQuarkQrModal = openQuarkQrModal;
window.copyThunderLink = function (url) {
    copyTextReliably(url, '迅雷网盘链接已复制，请转存后再下载。');
};

// 若页面未启用 auth.js 拦截，则由 main.js 直接处理夸克二维码与迅雷复制
if (quarkLink) {
    quarkLink.addEventListener('click', (e) => {
        if (typeof window.handleDownloadClick === 'function') return;
        e.preventDefault();
        const url = (currentMod && currentMod.quarkLink) || quarkLink.getAttribute('href');
        if (!url || url === '#') return;
        openQuarkQrModal(url);
    });
}

if (thunderLink) {
    thunderLink.addEventListener('click', (e) => {
        if (typeof window.handleDownloadClick === 'function') return;
        e.preventDefault();
        const url = (currentMod && currentMod.thunderLink) || thunderLink.getAttribute('href');
        if (!url || url === '#') return;
        window.copyThunderLink(url);
    });
}

// 接收 ModTogether（一块Mod）客户端回传的导入结果
window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== 'MODTOGETHER_IMPORT_RESULT') return;
    if (importBtn && importBtnLabel) {
        importBtn.disabled = false;
        importBtnLabel.textContent = data.ok ? '已导入到 一块Mod ✓' : '重试一键导入';
        setTimeout(() => {
            if (importBtnLabel) importBtnLabel.textContent = '一键下载并导入到 一块Mod';
        }, 3000);
    }
});

function closeModalWithAnimation(modal, modalContentSelector = '.modal-animation-enter') {
    const modalContent = modal.querySelector(modalContentSelector);
    if (modalContent) {
        modalContent.classList.add('tree-animation');
        setTimeout(() => {
            modal.classList.add('hidden');
            modalContent.classList.remove('tree-animation');
        }, 200);
    } else {
        modal.classList.add('hidden');
    }
}

closeModModal.addEventListener('click', () => closeModalWithAnimation(gameModModal));
closeDetailModal.addEventListener('click', () => closeModalWithAnimation(modDetailModal));
gameModModal.querySelector('.absolute.inset-0').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModModal.click();
});
modDetailModal.querySelector('.absolute.inset-0').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeDetailModal.click();
});

// 支持按 ESC 键关闭弹窗
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (quarkQrModal && !quarkQrModal.classList.contains('hidden')) {
            closeQuarkQrModal();
        } else if (!modDetailModal.classList.contains('hidden')) {
            closeDetailModal.click();
        } else if (!gameModModal.classList.contains('hidden')) {
            closeModModal.click();
        }
    }
});

if (browseGamesBtn) {
    browseGamesBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const firstGameSection = document.querySelector('section[id^="section-"]');
        if (firstGameSection) {
            window.scrollTo({ top: firstGameSection.offsetTop - 80, behavior: 'smooth' });
        }
    });
}

if (hotModsBtn) {
    hotModsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const firstGameSection = document.querySelector('section[id^="section-"]');
        if (firstGameSection) {
            window.scrollTo({ top: firstGameSection.offsetTop - 80, behavior: 'smooth' });
        }
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        return m;
    });
}

loadGames();
