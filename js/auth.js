/**
 * 认证模块 - 处理用户登录、注册、密码修改、会员系统等功能
 */

// ============================================
// Supabase 配置
// ============================================
const SUPABASE_URL = 'https://szeedpcuharbupkjrnob.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6ZWVkcGN1aGFyYnVwa2pybm9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTY3MDAsImV4cCI6MjA4ODEzMjcwMH0.7Qhchq8-NJG_Yqpx40r2idwt9iN98Hg63cHWIZ8lMTY';

let supabaseClient;
try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase 初始化成功');
} catch (error) {
    console.error('Supabase 初始化失败:', error);
}

// ============================================
// 全局状态
// ============================================
let currentUser = null;
let currentUserProfile = null;

// ============================================
// DOM 元素
// ============================================
const elements = {
    authSection: document.getElementById('auth-section'),
    loginBtn: document.getElementById('login-btn'),
    
    authModal: document.getElementById('auth-modal'),
    authBackdrop: document.getElementById('auth-backdrop'),
    authModalContent: document.getElementById('auth-modal-content'),
    closeAuthModal: document.getElementById('close-auth-modal'),
    
    tabLogin: document.getElementById('tab-login'),
    tabRegister: document.getElementById('tab-register'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    formToggleText: document.getElementById('form-toggle-text'),
    showRegister: document.getElementById('show-register'),
    
    loginFormElement: document.getElementById('login-form-element'),
    loginEmail: document.getElementById('login-email'),
    loginPassword: document.getElementById('login-password'),
    loginSubmit: document.getElementById('login-submit'),
    loginLoading: document.getElementById('login-loading'),
    
    registerFormElement: document.getElementById('register-form-element'),
    registerEmail: document.getElementById('register-email'),
    registerPassword: document.getElementById('register-password'),
    registerConfirmPassword: document.getElementById('register-confirm-password'),
    registerSubmit: document.getElementById('register-submit'),
    registerLoading: document.getElementById('register-loading'),
    
    toastContainer: document.getElementById('toast-container')
};

// ============================================
// 工具函数
// ============================================

function showToast(message, type = 'success') {
    const container = elements.toastContainer;
    container.style.zIndex = '9999';
    
    const colors = {
        success: 'border-green-500/50 bg-green-500/10 text-green-400',
        error: 'border-red-500/50 bg-red-500/10 text-red-400',
        warning: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400',
        info: 'border-blue-500/50 bg-blue-500/10 text-blue-400'
    };
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const toast = document.createElement('div');
    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border ${colors[type]} backdrop-blur-md transform translate-x-full transition-all duration-300 shadow-lg`;
    toast.innerHTML = `
        <i class="fa ${icons[type]} text-lg"></i>
        <span class="text-sm font-medium">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.remove('translate-x-full'), 10);
    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function setButtonLoading(button, loader, isLoading, originalText) {
    const textSpan = button.querySelector('span');
    if (isLoading) {
        button.disabled = true;
        button.classList.add('opacity-70', 'cursor-not-allowed');
        loader.classList.remove('hidden');
        if (textSpan) textSpan.textContent = '处理中...';
    } else {
        button.disabled = false;
        button.classList.remove('opacity-70', 'cursor-not-allowed');
        loader.classList.add('hidden');
        if (textSpan) textSpan.textContent = originalText;
    }
}

function shakeForm(form) {
    form.classList.add('animate-shake');
    setTimeout(() => form.classList.remove('animate-shake'), 500);
}

function forceClearSession() {
    const projectRef = SUPABASE_URL.split('//')[1].split('.')[0];
    localStorage.removeItem(`sb-${projectRef}-auth-token`);
    sessionStorage.removeItem(`sb-${projectRef}-auth-token`);
    
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('sb-'))) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    currentUser = null;
    currentUserProfile = null;
    updateUIForLoggedOutUser();
}

function getTodayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

function getCurrentTimestamp() {
    return new Date().toISOString();
}

// ============================================
// 弹窗控制
// ============================================

function openModal(modal, backdrop, content) {
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    setTimeout(() => {
        backdrop.classList.remove('opacity-0');
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function closeModal(modal, backdrop, content, callback) {
    backdrop.classList.add('opacity-0');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    
    setTimeout(() => {
        modal.classList.add('hidden');
        document.body.style.pointerEvents = '';
        document.body.style.overflow = '';
        if (callback) callback();
    }, 300);
}

function openAuthModal() {
    openModal(elements.authModal, elements.authBackdrop, elements.authModalContent);
}

function closeAuthModal() {
    closeModal(elements.authModal, elements.authBackdrop, elements.authModalContent, () => {
        elements.loginFormElement.reset();
        elements.registerFormElement.reset();
        switchToLogin();
    });
}

function switchToLogin() {
    elements.tabLogin.classList.add('tab-active');
    elements.tabLogin.classList.remove('text-gray-400');
    elements.tabRegister.classList.remove('tab-active');
    elements.tabRegister.classList.add('text-gray-400');
    elements.loginForm.classList.remove('hidden');
    elements.registerForm.classList.add('hidden');
    elements.formToggleText.innerHTML = 
        '还没有账号？ <button type="button" id="show-register" class="text-neon-blue hover:text-neon-purple font-medium transition-colors">立即注册</button>';
    document.getElementById('show-register').addEventListener('click', switchToRegister);
}

function switchToRegister() {
    elements.tabRegister.classList.add('tab-active');
    elements.tabRegister.classList.remove('text-gray-400');
    elements.tabLogin.classList.remove('tab-active');
    elements.tabLogin.classList.add('text-gray-400');
    elements.registerForm.classList.remove('hidden');
    elements.loginForm.classList.add('hidden');
    elements.formToggleText.innerHTML = 
        '已有账号？ <button type="button" id="show-login" class="text-neon-purple hover:text-neon-blue font-medium transition-colors">立即登录</button>';
    document.getElementById('show-login').addEventListener('click', switchToLogin);
}

// ============================================
// 忘记密码弹窗（修复版）
// ============================================
function openForgotPasswordModal() {
    // 如果已存在弹窗，先移除（避免重复）
    const existingModal = document.getElementById('forgot-password-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'forgot-password-modal';
    modal.className = 'fixed inset-0 z-[60]';
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity opacity-0" id="forgot-backdrop"></div>
        <div class="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div class="glass-effect rounded-2xl w-full max-w-md transform scale-95 opacity-0 transition-all duration-300 p-6 text-center pointer-events-auto" id="forgot-content">
                <button id="close-forgot-modal" class="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                    <i class="fa fa-times text-xl"></i>
                </button>
                
                <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg">
                    <i class="fa fa-exclamation-triangle text-2xl text-white"></i>
                </div>
                
                <h2 class="text-2xl font-bold text-white mb-4">账号安全提醒</h2>
                
                <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6 text-left">
                    <p class="text-yellow-200 mb-2">您的账号可能存在密码风险</p>
                    <p class="text-gray-300 text-sm mb-4">为了您的账号安全，请联系管理员重置您的密码</p>
                    
                    <div class="flex items-center gap-3 bg-dark/50 rounded-lg p-3">
                        <i class="fa fa-weixin text-green-500 text-2xl"></i>
                        <div>
                            <p class="text-gray-400 text-xs">管理员微信</p>
                            <p class="text-white font-mono font-bold select-all">GameTogether1</p>
                        </div>
                        <button id="copy-wechat" class="ml-auto px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs text-white transition-colors">
                            复制
                        </button>
                    </div>
                </div>
                
                <button id="close-forgot-btn" class="w-full py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors">
                    我知道了
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 显示动画
    setTimeout(() => {
        document.getElementById('forgot-backdrop').classList.remove('opacity-0');
        document.getElementById('forgot-content').classList.remove('scale-95', 'opacity-0');
        document.getElementById('forgot-content').classList.add('scale-100', 'opacity-100');
    }, 10);
    
    // 复制微信
    document.getElementById('copy-wechat').addEventListener('click', () => {
        navigator.clipboard.writeText('GameTogether1').then(() => {
            showToast('已复制到剪贴板', 'success');
        });
    });
    
    // 关闭弹窗
    const closeModal = () => {
        document.getElementById('forgot-backdrop').classList.add('opacity-0');
        document.getElementById('forgot-content').classList.remove('scale-100', 'opacity-100');
        document.getElementById('forgot-content').classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.remove();
        }, 300);
    };
    
    document.getElementById('close-forgot-modal').addEventListener('click', closeModal);
    document.getElementById('close-forgot-btn').addEventListener('click', closeModal);
    document.getElementById('forgot-backdrop').addEventListener('click', closeModal);
}

// ============================================
// 会员相关弹窗
// ============================================

function openMemberRequiredModal() {
    let modal = document.getElementById('member-required-modal');
    
    if (modal) {
        modal.classList.remove('hidden');
        const backdrop = document.getElementById('member-required-backdrop');
        const content = document.getElementById('member-required-content');
        backdrop.classList.remove('opacity-0');
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
        return;
    }
    
    modal = document.createElement('div');
    modal.id = 'member-required-modal';
    modal.className = 'fixed inset-0 z-[60]';
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity opacity-0" id="member-required-backdrop"></div>
        <div class="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div class="glass-effect rounded-2xl w-full max-w-sm transform scale-95 opacity-0 transition-all duration-300 p-6 text-center pointer-events-auto" id="member-required-content">
                <button id="close-member-required" class="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                    <i class="fa fa-times text-xl"></i>
                </button>
                
                <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
                    <i class="fa fa-crown text-2xl text-white"></i>
                </div>
                
                <h2 class="text-xl font-bold text-white mb-2">会员专属资源</h2>
                <p class="text-gray-400 text-sm mb-6">该资源需要会员权限,开通会员后享受全站终身畅享</p>
                
                <button id="goto-vip-btn" class="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold transition-all shadow-lg hover:shadow-yellow-500/30">
                    <i class="fa fa-crown mr-2"></i>开通会员
                </button>
                
                <button id="cancel-member-required" class="w-full mt-3 py-2 text-gray-400 hover:text-white text-sm transition-colors">
                    暂时不开通
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => {
        document.getElementById('member-required-backdrop').classList.remove('opacity-0');
        document.getElementById('member-required-content').classList.remove('scale-95', 'opacity-0');
        document.getElementById('member-required-content').classList.add('scale-100', 'opacity-100');
    }, 10);
    
    const closeModal = () => {
        document.getElementById('member-required-backdrop').classList.add('opacity-0');
        document.getElementById('member-required-content').classList.remove('scale-100', 'opacity-100');
        document.getElementById('member-required-content').classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.body.style.pointerEvents = '';
        }, 300);
    };
    
    document.getElementById('close-member-required').addEventListener('click', closeModal);
    document.getElementById('cancel-member-required').addEventListener('click', closeModal);
    document.getElementById('member-required-backdrop').addEventListener('click', closeModal);
    document.getElementById('goto-vip-btn').addEventListener('click', () => {
        closeModal();
        setTimeout(() => openVIPModal(), 300);
    });
}

function openVIPModal() {
    let modal = document.getElementById('vip-modal');
    
    if (modal) {
        modal.classList.remove('hidden');
        const backdrop = document.getElementById('vip-backdrop');
        const content = document.getElementById('vip-content');
        backdrop.classList.remove('opacity-0');
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
        return;
    }
    
    modal = document.createElement('div');
    modal.id = 'vip-modal';
    modal.className = 'fixed inset-0 z-[60]';
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity opacity-0" id="vip-backdrop"></div>
        <div class="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div class="glass-effect rounded-2xl w-full max-w-2xl transform scale-95 opacity-0 transition-all duration-300 overflow-hidden pointer-events-auto" id="vip-content">
                <button id="close-vip-modal" class="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10">
                    <i class="fa fa-times text-xl"></i>
                </button>
                
                <div class="flex flex-col md:flex-row">
                    <div class="p-8 md:w-1/2 flex flex-col justify-center">
                        <h2 class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-6">
                            开通会员
                        </h2>
                        
                        <div class="space-y-4 text-gray-300">
                            <p>为更好的运营网站，</p>
                            <p>需要您的一份支持。</p>
                            <br>
                            <p>白嫖是您的权力，</p>
                            <p class="text-yellow-400 font-bold">打赏更显您的格局。</p>
                            <br>
                            <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                                <p class="text-yellow-300 font-bold mb-1">打赏一次，终身免费！</p>
                                <p class="text-white font-bold">全站资源，无限下载！</p>
                            </div>
                        </div>
                        
                        <button id="paid-btn" class="mt-8 w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold transition-all shadow-lg hover:shadow-green-500/30">
                            <i class="fa fa-check-circle mr-2"></i>我已完成支付
                        </button>
                    </div>
                    
                    <div class="md:w-1/2 bg-dark/50 p-8 flex items-center justify-center">
                        <div class="relative">
                            <div class="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl blur-xl"></div>
                            <img src="https://free.picui.cn/free/2026/03/09/69ae4457b98d4.png" 
                                alt="支付二维码" 
                                class="relative rounded-xl shadow-2xl max-w-full h-auto border border-gray-700">
                            <p class="text-center text-gray-400 text-sm mt-4">微信扫码支付</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => {
        document.getElementById('vip-backdrop').classList.remove('opacity-0');
        document.getElementById('vip-content').classList.remove('scale-95', 'opacity-0');
        document.getElementById('vip-content').classList.add('scale-100', 'opacity-100');
    }, 10);
    
    const closeModal = () => {
        document.getElementById('vip-backdrop').classList.add('opacity-0');
        document.getElementById('vip-content').classList.remove('scale-100', 'opacity-100');
        document.getElementById('vip-content').classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.body.style.pointerEvents = '';
        }, 300);
    };
    
    document.getElementById('close-vip-modal').addEventListener('click', closeModal);
    document.getElementById('vip-backdrop').addEventListener('click', closeModal);
    document.getElementById('paid-btn').addEventListener('click', () => {
        closeModal();
        setTimeout(() => openOrderInputModal(), 300);
    });
}

// ============================================
// 订单输入弹窗
// ============================================
function openOrderInputModal() {
    console.log('打开订单输入窗口');
    
    const existingModal = document.getElementById('order-input-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'order-input-modal';
    modal.className = 'fixed inset-0 z-[60]';
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity opacity-0" id="order-backdrop"></div>
        <div class="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div class="glass-effect rounded-2xl w-full max-w-md transform scale-95 opacity-0 transition-all duration-300 p-6 pointer-events-auto" id="order-content">
                <button id="close-order-modal" class="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                    <i class="fa fa-times text-xl"></i>
                </button>
                
                <div class="text-center mb-6">
                    <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                        <i class="fa fa-wechat text-2xl text-white"></i>
                    </div>
                    <h2 class="text-xl font-bold text-white mb-2">输入微信支付订单号</h2>
                    <p class="text-gray-400 text-xs">微信 → 我 → 服务 → 钱包 → 账单</p>
                </div>
                
                <div class="mb-6">
                    <input type="text" id="order-input" maxlength="32" 
                        class="w-full bg-transparent border-b-2 border-gray-700 text-center text-2xl tracking-widest text-white focus:outline-none focus:border-green-500 transition-colors font-mono"
                        placeholder="">
                    
                    <div class="flex justify-between mt-3 px-1" id="order-dots">
                        ${Array(32).fill(0).map((_, i) => 
                            `<div class="w-1.5 h-1.5 rounded-full bg-gray-700 transition-colors duration-200" data-index="${i}"></div>`
                        ).join('')}
                    </div>
                    
                    <p class="text-center text-gray-500 text-xs mt-2">
                        <span id="input-count">0</span>/32
                    </p>
                </div>
                
                <div class="flex gap-3">
                    <button id="back-to-vip" class="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors">
                        返回
                    </button>
                    <button id="submit-order" class="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold transition-all shadow-lg hover:shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                        提交
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => {
        document.getElementById('order-backdrop').classList.remove('opacity-0');
        document.getElementById('order-content').classList.remove('scale-95', 'opacity-0');
        document.getElementById('order-content').classList.add('scale-100', 'opacity-100');
    }, 10);
    
    bindOrderInputEvents(modal);
    
    setTimeout(() => {
        const input = document.getElementById('order-input');
        if (input) input.focus();
    }, 100);
}

function bindOrderInputEvents(modal) {
    const input = document.getElementById('order-input');
    const dots = document.querySelectorAll('#order-dots div');
    const countSpan = document.getElementById('input-count');
    const submitBtn = document.getElementById('submit-order');
    
    input.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '');
        
        const value = e.target.value;
        const len = value.length;
        
        dots.forEach((dot, index) => {
            if (index < len) {
                dot.classList.remove('bg-gray-700');
                dot.classList.add('bg-green-500', 'shadow-lg', 'shadow-green-500/50');
            } else {
                dot.classList.remove('bg-green-500', 'shadow-lg', 'shadow-green-500/50');
                dot.classList.add('bg-gray-700');
            }
        });
        
        countSpan.textContent = len;
        submitBtn.disabled = len !== 32;
    });
    
    submitBtn.addEventListener('click', async () => {
        const orderNumber = input.value;
        
        if (orderNumber.length !== 32) {
            showToast('请输入32位订单号', 'error');
            return;
        }
        
        const datePart = orderNumber.substring(10, 18);
        const today = getTodayDateString();
        
        console.log('订单日期:', datePart, '今天:', today);
        
        if (datePart !== today) {
            showToast('订单号无效，请核对后再输入', 'error');
            shakeForm(document.getElementById('order-content'));
            return;
        }
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin mr-2"></i>验证中...';
        
        try {
            const { data, error } = await supabaseClient
                .from('GameTogether')
                .update({ 
                    is_member: true,
                    order_id: orderNumber
                })
                .eq('id', currentUser.id)
                .select();
            
            if (error) throw error;
            
            currentUserProfile = { 
                ...currentUserProfile, 
                is_member: true,
                order_id: orderNumber
            };
            
            showToast('支付验证成功！您已是终身会员', 'success');
            
            const backdrop = document.getElementById('order-backdrop');
            const content = document.getElementById('order-content');
            backdrop.classList.add('opacity-0');
            content.classList.remove('scale-100', 'opacity-100');
            content.classList.add('scale-95', 'opacity-0');
            
            setTimeout(() => {
                modal.remove();
                document.body.style.pointerEvents = '';
                updateUIForLoggedInUser(currentUser, true);
            }, 300);
            
        } catch (error) {
            console.error('更新会员状态失败:', error);
            showToast('验证失败：' + error.message, 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '提交';
        }
    });
    
    const closeModal = () => {
        const backdrop = document.getElementById('order-backdrop');
        const content = document.getElementById('order-content');
        backdrop.classList.add('opacity-0');
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.remove();
            document.body.style.pointerEvents = '';
        }, 300);
    };
    
    document.getElementById('close-order-modal').addEventListener('click', closeModal);
    document.getElementById('order-backdrop').addEventListener('click', closeModal);
    document.getElementById('back-to-vip').addEventListener('click', () => {
        closeModal();
        setTimeout(() => openVIPModal(), 300);
    });
}

// ============================================
// 修改密码弹窗
// ============================================
function openChangePasswordModal() {
    let modal = document.getElementById('change-password-modal-simple');
    
    if (modal) {
        modal.classList.remove('hidden');
        const backdrop = document.getElementById('simple-password-backdrop');
        const content = document.getElementById('simple-password-content');
        backdrop.classList.remove('opacity-0');
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
        return;
    }
    
    modal = document.createElement('div');
    modal.id = 'change-password-modal-simple';
    modal.className = 'fixed inset-0 z-[60]';
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity opacity-0" id="simple-password-backdrop"></div>
        <div class="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div class="glass-effect rounded-2xl w-full max-w-md transform scale-95 opacity-0 transition-all duration-300 p-6 pointer-events-auto" id="simple-password-content">
                <button id="close-simple-password" class="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10">
                    <i class="fa fa-times text-xl"></i>
                </button>
                
                <div class="text-center mb-6">
                    <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-neon-purple to-neon-pink flex items-center justify-center shadow-neon-purple animate-pulse-glow">
                        <i class="fa fa-lock text-2xl text-white"></i>
                    </div>
                    <h2 class="text-2xl font-bold text-white mb-1">修改密码</h2>
                    <p class="text-gray-400 text-sm">请输入新密码</p>
                </div>
                
                <form id="simple-change-password-form" class="space-y-4">
                    <div class="relative group">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <i class="fa fa-lock text-gray-500 group-focus-within:text-neon-purple transition-colors"></i>
                        </div>
                        <input type="password" id="simple-new-password" required minlength="6"
                            class="w-full pl-10 pr-12 py-3 rounded-xl bg-dark/50 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-neon-purple input-glow-purple transition-all"
                            placeholder="新密码（至少6位）">
                        <button type="button" class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-white toggle-password" data-target="simple-new-password">
                            <i class="fa fa-eye"></i>
                        </button>
                    </div>
                    
                    <div class="relative group">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <i class="fa fa-lock text-gray-500 group-focus-within:text-neon-purple transition-colors"></i>
                        </div>
                        <input type="password" id="simple-confirm-password" required 
                            class="w-full pl-10 pr-12 py-3 rounded-xl bg-dark/50 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-neon-purple input-glow-purple transition-all"
                            placeholder="确认新密码">
                        <button type="button" class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-white toggle-password" data-target="simple-confirm-password">
                            <i class="fa fa-eye"></i>
                        </button>
                    </div>
                    
                    <button type="submit" id="simple-password-submit" 
                        class="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold transition-all hover:shadow-neon-purple btn-shine flex items-center justify-center gap-2 mt-6">
                        <span>确认修改</span>
                        <div class="loading-spinner w-5 h-5 hidden" id="simple-password-loading"></div>
                    </button>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => {
        document.getElementById('simple-password-backdrop').classList.remove('opacity-0');
        document.getElementById('simple-password-content').classList.remove('scale-95', 'opacity-0');
        document.getElementById('simple-password-content').classList.add('scale-100', 'opacity-100');
    }, 10);
    
    document.getElementById('simple-change-password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newPass = document.getElementById('simple-new-password').value;
        const confirmPass = document.getElementById('simple-confirm-password').value;
        
        if (newPass !== confirmPass) {
            showToast('两次输入的密码不一致', 'error');
            shakeForm(document.getElementById('simple-change-password-form'));
            return;
        }
        
        if (newPass.length < 6) {
            showToast('密码长度至少为6位', 'error');
            return;
        }
        
        const submitBtn = document.getElementById('simple-password-submit');
        const loader = document.getElementById('simple-password-loading');
        
        setButtonLoading(submitBtn, loader, true, '确认修改');
        
        try {
            const { error } = await supabaseClient.auth.updateUser({
                password: newPass
            });
            
            if (error) throw error;
            
            showToast('密码修改成功！', 'success');
            
            const backdrop = document.getElementById('simple-password-backdrop');
            const content = document.getElementById('simple-password-content');
            backdrop.classList.add('opacity-0');
            content.classList.remove('scale-100', 'opacity-100');
            content.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                modal.classList.add('hidden');
                document.body.style.pointerEvents = '';
            }, 300);
            
        } catch (error) {
            console.error('修改密码失败:', error);
            showToast('修改密码失败：' + error.message, 'error');
            shakeForm(document.getElementById('simple-change-password-form'));
        } finally {
            setButtonLoading(submitBtn, loader, false, '确认修改');
        }
    });
    
    modal.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const icon = this.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });
    
    const closeModal = () => {
        const backdrop = document.getElementById('simple-password-backdrop');
        const content = document.getElementById('simple-password-content');
        backdrop.classList.add('opacity-0');
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.body.style.pointerEvents = '';
        }, 300);
    };
    
    document.getElementById('close-simple-password').addEventListener('click', closeModal);
    document.getElementById('simple-password-backdrop').addEventListener('click', closeModal);
}

// ============================================
// UI 更新
// ============================================

function updateUIForLoggedInUser(user, isMember = false) {
    const email = user.email;
    const displayName = email.split('@')[0];
    const memberStatus = isMember || currentUserProfile?.is_member;
    
    elements.authSection.innerHTML = `
        <div class="relative group">
            <button id="user-menu-btn" class="flex items-center gap-2 bg-dark-light hover:bg-dark-light/80 border border-gray-700 hover:border-neon-blue transition-all rounded-full pl-2 pr-4 py-1.5">
                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center text-white text-sm font-bold">
                    ${displayName.charAt(0).toUpperCase()}
                </div>
                <span class="text-white font-medium text-sm">${displayName}</span>
                ${memberStatus ? '<i class="fa fa-crown text-yellow-400 text-xs"></i>' : ''}
                <i class="fa fa-chevron-down text-gray-400 text-xs"></i>
            </button>
            
            <div class="absolute right-0 mt-2 w-48 rounded-xl glass-effect border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right z-50">
                <div class="py-2">
                    <button id="change-password-btn" class="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                        <i class="fa fa-key mr-2"></i>修改密码
                    </button>
                    ${memberStatus ? `
                        <div class="px-4 py-2 text-sm text-yellow-400">
                            <i class="fa fa-crown mr-2"></i>终身会员
                        </div>
                    ` : `
                        <button id="vip-btn" class="w-full text-left px-4 py-2 text-sm text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 transition-colors">
                            <i class="fa fa-crown mr-2"></i>开通会员
                        </button>
                    `}
                    <div class="border-t border-gray-700 my-1"></div>
                    <button id="logout-btn" class="w-full text-left px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
                        <i class="fa fa-sign-out mr-2"></i>退出登录
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('change-password-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openChangePasswordModal();
    });
    
    if (!memberStatus) {
        document.getElementById('vip-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openVIPModal();
        });
    }
    
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        handleLogout();
    });
}

function updateUIForLoggedOutUser() {
    elements.authSection.innerHTML = `
        <button id="login-btn" class="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-6 rounded-full transition-all hover:shadow-neon-blue flex items-center btn-shine">
            <i class="fa fa-user-circle mr-2"></i> 登录
        </button>
    `;
    document.getElementById('login-btn').addEventListener('click', openAuthModal);
}

// ============================================
// 认证逻辑
// ============================================

async function validateSession() {
    try {
        if (!currentUser) return false;
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        if (error || !user) return false;
        return true;
    } catch (error) {
        return false;
    }
}

async function fetchUserProfile() {
    try {
        if (!currentUser) return;
        
        const { data, error } = await supabaseClient
            .from('GameTogether')
            .select('*')
            .eq('id', currentUser.id)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                console.log('GameTogether 记录不存在');
                currentUserProfile = null;
                return;
            }
            throw error;
        }
        
        currentUserProfile = data;
        console.log('用户资料:', currentUserProfile);
        
    } catch (error) {
        console.error('获取用户资料失败:', error);
        currentUserProfile = null;
    }
}

async function checkAuthStatus() {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        
        if (session) {
            currentUser = session.user;
            const isValid = await validateSession();
            
            if (isValid) {
                await fetchUserProfile();
                updateUIForLoggedInUser(currentUser, currentUserProfile?.is_member);
            } else {
                showToast('登录已过期，请重新登录', 'warning');
                forceClearSession();
            }
        }
    } catch (error) {
        console.error('检查登录状态失败:', error);
        forceClearSession();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = elements.loginEmail.value;
    const password = elements.loginPassword.value;
    
    setButtonLoading(elements.loginSubmit, elements.loginLoading, true, '立即登录');
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            if (error.message.includes('Email not confirmed')) {
                showToast('请前往邮箱确认邮件后再登录', 'warning');
                return;
            }
            throw error;
        }
        
        currentUser = data.user;
        await fetchUserProfile();
        
        showToast('登录成功！欢迎回来', 'success');
        updateUIForLoggedInUser(currentUser, currentUserProfile?.is_member);
        
        closeAuthModal();
        
    } catch (error) {
        console.error('登录失败:', error);
        let message = '登录失败，请检查账号密码';
        if (error.message.includes('Invalid login credentials')) {
            message = '邮箱或密码错误';
        }
        showToast(message, 'error');
        shakeForm(elements.loginFormElement);
    } finally {
        setButtonLoading(elements.loginSubmit, elements.loginLoading, false, '立即登录');
    }
}

async function checkEmailExists(email) {
    try {
        const { error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: 'this_is_a_wrong_password_for_testing_12345'
        });
        
        if (error) {
            if (error.message.includes('Invalid login credentials')) {
                return { exists: true, confirmed: true };
            }
            if (error.message.includes('Email not confirmed')) {
                return { exists: true, confirmed: false };
            }
            return { exists: false, confirmed: false };
        }
        
        return { exists: false, confirmed: false };
    } catch (error) {
        return { exists: false, confirmed: false };
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const email = elements.registerEmail.value;
    const password = elements.registerPassword.value;
    const confirmPassword = elements.registerConfirmPassword.value;
    
    if (password !== confirmPassword) {
        showToast('两次输入的密码不一致', 'error');
        shakeForm(elements.registerFormElement);
        return;
    }
    
    if (password.length < 6) {
        showToast('密码长度至少为6位', 'error');
        shakeForm(elements.registerFormElement);
        return;
    }
    
    setButtonLoading(elements.registerSubmit, elements.registerLoading, true, '立即注册');
    
    try {
        const { exists, confirmed } = await checkEmailExists(email);
        
        if (exists) {
            if (confirmed) {
                showToast('该邮箱已注册，请直接登录', 'error');
            } else {
                showToast('该邮箱已注册但未验证，请前往邮箱确认邮件', 'warning');
            }
            setButtonLoading(elements.registerSubmit, elements.registerLoading, false, '立即注册');
            return;
        }
        
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password
        });
        
        if (error) throw error;
        
        if (data.user) {
            try {
                const { error: insertError } = await supabaseClient
                    .from('GameTogether')
                    .insert([{
                        id: data.user.id,
                        email: email,
                        is_member: false,
                        created_at: getCurrentTimestamp(),
                        daily_download_count: 0,
                        daily_download_date: null,
                        daily_download_game_id: null,
                        order_id: null
                    }]);
                
                if (insertError) {
                    console.error('创建 GameTogether 记录失败:', insertError);
                }
            } catch (profileError) {
                console.error('创建 GameTogether 记录异常:', profileError);
            }
        }
        
        showToast('注册成功！请前往邮箱查看验证邮件', 'success');
        elements.registerFormElement.reset();
        setTimeout(() => {
            switchToLogin();
        }, 2000);
        
    } catch (error) {
        console.error('注册失败:', error);
        let message = '注册失败，请重试';
        if (error.message.includes('User already registered')) {
            message = '该邮箱已被注册';
        } else if (error.message.includes('valid email')) {
            message = '请输入有效的邮箱地址';
        }
        showToast(message, 'error');
        shakeForm(elements.registerFormElement);
    } finally {
        setButtonLoading(elements.registerSubmit, elements.registerLoading, false, '立即注册');
    }
}

async function handleLogout() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) console.warn('服务器退出失败:', error);
        
        forceClearSession();
        showToast('已退出登录', 'info');
    } catch (error) {
        forceClearSession();
        showToast('已退出登录', 'info');
    }
}

// ============================================
// 网盘链接处理
// ============================================

window.handleDownloadClick = function(url, type) {
    console.log('下载点击:', type, '用户:', currentUser?.email, '会员:', currentUserProfile?.is_member);
    
    if (!currentUser) {
        showToast('请先登录', 'warning');
        openAuthModal();
        return false;
    }
    
    const isMember = currentUserProfile?.is_member;
    
    if (!isMember) {
        openMemberRequiredModal();
        return false;
    }
    
    window.open(url, '_blank');
    return true;
};

window.initDownloadButtons = function() {
    console.log('初始化下载按钮');
    
    document.addEventListener('click', (e) => {
        const target = e.target.closest('a, button');
        if (!target) return;
        
        if (target.id === 'quark-link' || target.closest('#quark-link')) {
            e.preventDefault();
            const url = target.href || target.closest('a').href;
            handleDownloadClick(url, 'quark');
        }
        
        if (target.id === 'thunder-link' || target.closest('#thunder-link')) {
            e.preventDefault();
            const url = target.href || target.closest('a').href;
            handleDownloadClick(url, 'thunder');
        }
    });
};

// ============================================
// 事件绑定
// ============================================

function initEventListeners() {
    if (elements.loginBtn) {
        elements.loginBtn.addEventListener('click', openAuthModal);
    }
    
    elements.closeAuthModal.addEventListener('click', closeAuthModal);
    elements.authBackdrop.addEventListener('click', closeAuthModal);
    
    elements.tabLogin.addEventListener('click', switchToLogin);
    elements.tabRegister.addEventListener('click', switchToRegister);
    elements.showRegister.addEventListener('click', switchToRegister);
    
    elements.loginFormElement.addEventListener('submit', handleLogin);
    elements.registerFormElement.addEventListener('submit', handleRegister);
    
    // 修复：精确绑定忘记密码链接（位于登录表单内）
    const forgotPasswordLink = document.querySelector('#login-form a.text-neon-blue');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            openForgotPasswordModal();
        });
    } else {
        // 备用方案：通过文本内容查找
        const allLinks = document.querySelectorAll('#login-form a');
        allLinks.forEach(link => {
            if (link.textContent.includes('忘记密码')) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    openForgotPasswordModal();
                });
            }
        });
    }
    
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const icon = this.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!elements.authModal.classList.contains('hidden')) {
                closeAuthModal();
            }
            
            const modals = ['forgot-password-modal', 'member-required-modal', 'vip-modal', 'order-input-modal', 'change-password-modal-simple'];
            modals.forEach(id => {
                const modal = document.getElementById(id);
                if (modal && !modal.classList.contains('hidden')) {
                    const backdrop = modal.querySelector('[id$="-backdrop"]');
                    if (backdrop) backdrop.click();
                }
            });
        }
    });
    
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            currentUser = session.user;
            await fetchUserProfile();
            updateUIForLoggedInUser(currentUser, currentUserProfile?.is_member);
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            currentUserProfile = null;
            updateUIForLoggedOutUser();
        }
    });
    
    initDownloadButtons();
}

// ============================================
// 初始化
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    checkAuthStatus();
});