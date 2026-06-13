// pages/login/login.js - v0.8.0 微信一键登录
// 主流程: 微信 wx.login 拿 code -> 后端 /api/auth/wx-login 换 openid + 用户资料
// 备选: 手机号+验证码 (开发模式 / 特殊场景)
const { sendSms, wxLogin, phoneLogin } = require('../../utils/api.js');
const { setUser, getUser, getStableOpenid, setStableOpenid, getStableUserId, setStableUserId } = require('../../utils/user.js');
const app = getApp();

// 开发期开关: 后端网络不通时是否允许本地降级身份 (生产建议设为 false)
const DEV_FALLBACK = true;

function hasRealProfile(u) {
  return !!(u && u.avatarUrl && u.nickname && !u.nickname.startsWith('微信用户') && u.nickname !== '游客');
}

function buildLocalUser({ openid, phone = '' }) {
  const oldUser = getUser();
  const stableUserId = getStableUserId();
  return {
    userId: stableUserId || oldUser.userId || ('u_' + (openid || 'local').slice(0, 12)),
    phone: phone || oldUser.phone || '',
    nickname: oldUser.nickname || '微信用户',
    avatarUrl: oldUser.avatarUrl || '',
    openid: openid || oldUser.openid || '',
    checkinCount: oldUser.checkinCount || 0,
    createdAt: oldUser.createdAt || Date.now(),
    loggedIn: true,
    loggedAt: Date.now()
  };
}

function normalizeServerUser(serverUser, phone) {
  const oldUser = getUser();
  return {
    userId: serverUser.id || oldUser.userId || getStableUserId(),
    phone: phone || serverUser.phone || oldUser.phone || '',
    nickname: serverUser.nickname || oldUser.nickname || '微信用户',
    avatarUrl: serverUser.avatarUrl || oldUser.avatarUrl || '',
    openid: serverUser.openid || oldUser.openid || getStableOpenid() || '',
    checkinCount: serverUser.checkinCount || oldUser.checkinCount || 0,
    createdAt: serverUser.createdAt || oldUser.createdAt || Date.now(),
    loggedIn: true,
    loggedAt: Date.now()
  };
}

Page({
  data: {
    phone: '',
    code: '',
    sending: false,
    logging: false,
    counting: 0,
    devCode: '',
    timer: null,
    agreed: false,
    showPhoneLogin: false   // 折叠手机号表单
  },

  onUnload() {
    if (this.data.timer) clearInterval(this.data.timer);
  },

  onAgreeToggle() {
    this.setData({ agreed: !this.data.agreed });
  },

  onAgreementTap() {
    wx.navigateTo({ url: '/pages/agreement/agreement' });
  },

  onTogglePhoneLogin() {
    this.setData({ showPhoneLogin: !this.data.showPhoneLogin });
  },

  onPhoneInput(e) { this.setData({ phone: e.detail.value }); },
  onCodeInput(e) { this.setData({ code: e.detail.value }); },

  async onSendCode() {
    if (!/^1[3-9]\d{9}$/.test(this.data.phone)) {
      wx.showToast({ title: '手机号格式不对', icon: 'none' });
      return;
    }
    this.setData({ sending: true });
    try {
      const j = await sendSms(this.data.phone);
      this.setData({ devCode: (j.data && j.data.code) || '', sending: false, counting: 60 });
      if (j.data && j.data.code) {
        wx.showModal({
          title: '验证码 (开发模式)',
          content: '本次验证码: ' + j.data.code,
          showCancel: false
        });
      } else {
        wx.showToast({ title: '已发送', icon: 'success' });
      }
      if (this.data.timer) clearInterval(this.data.timer);
      this.data.timer = setInterval(() => {
        if (this.data.counting <= 1) {
          clearInterval(this.data.timer);
          this.setData({ counting: 0 });
          return;
        }
        this.setData({ counting: this.data.counting - 1 });
      }, 1000);
    } catch (e) {
      this.setData({ sending: false });
      wx.showToast({ title: '发送失败', icon: 'none' });
    }
  },

  // v0.8.0: 微信一键登录 - 仅依赖 wx.login code, 后端用 jscode2session 拿真 openid
  async onWxLoginTap() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先勾选同意用户协议', icon: 'none' });
      return;
    }
    this.setData({ logging: true });
    try {
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({ success: resolve, fail: reject });
      });
      const code = loginRes.code;
      if (!code) throw new Error('wx.login 拿不到 code');

      // 传 device-stable userId 给后端, 便于匿名数据迁移
      const anonymousId = getStableUserId();
      const res = await wxLogin({ code, anonymousId });
      if (res && res.code === 0 && res.user) {
        this.applyLogin(normalizeServerUser(res.user, res.phone));
      } else {
        throw new Error((res && res.message) || '登录失败');
      }
    } catch (e) {
      console.error('[WxLogin] 失败', e);
      // 开发期后端未部署/网络不通时, 允许本地降级, 但提示用户
      const isNetworkErr = !!(e && (e.errMsg || e.message || '').match(/(fail|timeout|network|request)/i));
      if (DEV_FALLBACK && isNetworkErr) {
        wx.showToast({ title: '后端未连通, 使用本地测试身份', icon: 'none' });
        let stableOpenid = getStableOpenid();
        if (!stableOpenid) {
          stableOpenid = 'dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
          setStableOpenid(stableOpenid);
        }
        this.applyLogin(buildLocalUser({ openid: stableOpenid }));
        return;
      }
      this.setData({ logging: false });
      wx.showToast({ title: '登录失败: ' + (e.message || '未知'), icon: 'none' });
    }
  },

  // 统一登录成功处理: 写缓存、同步 stable id、跳转
  applyLogin(newUser) {
    setUser(newUser);
    app.globalData.user = newUser;
    if (newUser.openid) setStableOpenid(newUser.openid);
    if (newUser.userId) setStableUserId(newUser.userId);

    this.setData({ logging: false });
    wx.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => {
      // 资料完整 -> 我的页; 否则引导完善资料 (使用微信头像/昵称选择器)
      if (hasRealProfile(newUser)) {
        wx.switchTab({ url: '/pages/me/me' });
      } else {
        wx.redirectTo({ url: '/pages/profile-setup/profile-setup' });
      }
    }, 800);
  },

  // 手机号+验证码登录 (开发模式 / 备用)
  async onPhoneLogin() {
    const { phone, code, agreed } = this.data;
    if (!agreed) {
      wx.showToast({ title: '请先勾选同意用户协议', icon: 'none' });
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请填正确手机号', icon: 'none' });
      return;
    }
    if (!code || code.length < 4) {
      wx.showToast({ title: '请填验证码', icon: 'none' });
      return;
    }
    this.setData({ logging: true });
    try {
      const anonymousId = getStableUserId();
      const res = await phoneLogin({ phone, code, anonymousId });
      if (res && res.code === 0 && res.user) {
        this.applyLogin(normalizeServerUser(res.user, res.phone || phone));
      } else {
        this.setData({ logging: false });
        wx.showToast({ title: (res && res.message) || '登录失败', icon: 'none' });
      }
    } catch (e) {
      console.error('[PhoneLogin] 失败', e);
      this.setData({ logging: false });
      wx.showToast({ title: '登录失败', icon: 'none' });
    }
  }
});
