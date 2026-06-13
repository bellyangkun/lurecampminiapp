// pages/login/login.js - v0.7.8 微信一键登录
// 优先: 微信一键登录 (open-type=getPhoneNumber 真机拿手机号, 或 wx.login 拿 code 模拟器/开发期)
// 备选: 手机号+验证码 (开发模式)
const { sendSms } = require('../../utils/api.js');
const { setUser } = require('../../utils/user.js');
const app = getApp();

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

  // v0.7.8: 微信一键登录 - 主流程
  // 1. wx.login 拿 code (app.js onLaunch 已存过 globalData.wxCode)
  // 2. 真机: open-type=getPhoneNumber 回调拿 encryptedData, iv, 手机号
  // 3. 模拟器/开发期: 走 wx.login code 即可, 后端用 openid 识别
  async onWxLoginTap() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先勾选同意用户协议', icon: 'none' });
      return;
    }
    this.setData({ logging: true });
    try {
      // 拿最新的 wx login code
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({ success: resolve, fail: reject });
      });
      const code = loginRes.code;
      if (!code) {
        throw new Error('wx.login 拿不到 code');
      }
      // 直接用 openid 走"游客快速登录"分支 (后端 /api/auth/wx-quick-login 拿 openid 创建/找回用户)
      // 真机拿手机号走 onWxGetPhone, 模拟器 fallback 拿不到手机号, 用 openid
      await this.doLogin({ code, openid: 'dev_' + code.slice(0, 12) });
    } catch (e) {
      console.error('[WxLogin] 失败', e);
      this.setData({ logging: false });
      wx.showToast({ title: '登录失败: ' + (e.message || '未知'), icon: 'none' });
    }
  },

  // 真机: open-type=getPhoneNumber 拿到加密手机号后, 用这个登录
  async onWxGetPhone(e) {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先勾选同意用户协议', icon: 'none' });
      return;
    }
    if (!e.detail.encryptedData) {
      // 用户拒绝授权手机号, 走 code fallback
      console.log('[WxGetPhone] 用户拒绝手机号, 走 code fallback');
      return;
    }
    this.setData({ logging: true });
    try {
      const { encryptedData, iv } = e.detail;
      const code = app.globalData.wxCode || await new Promise((resolve, reject) => {
        wx.login({ success: r => resolve(r.code), fail: reject });
      });
      // 把 encryptedData/iv/code 都发到后端 /api/auth/wx-login
      // 后端用微信 session_key 解密, 拿 phoneNumber + openid, 创建/找回用户
      // 没接该接口前, 先用 encryptedData 模拟 phone
      await this.doLogin({ code, encryptedData, iv, phone: 'wx_' + Date.now().toString(36) });
    } catch (err) {
      console.error('[WxGetPhone] 失败', err);
      this.setData({ logging: false });
      wx.showToast({ title: '手机号授权失败', icon: 'none' });
    }
  },

  // v0.7.8: 统一登录后处理 - 写 user storage + 跳主页
  async doLogin({ code, phone, openid, encryptedData, iv }) {
    try {
      // 真机流程: 把 code + encryptedData 发到后端 /api/auth/wx-login 拿 phone+openid
      // 后端没实现前, 模拟器/开发期 fallback
      let realPhone = phone;
      let realOpenid = openid;
      if (code && !realPhone) {
        try {
          const j = await new Promise((resolve, reject) => {
            wx.request({
              url: 'https://lurecamp1.xiabebe.cn:3005/api/auth/wx-login',
              method: 'POST',
              data: { code, encryptedData, iv },
              success: r => resolve(r.data),
              fail: reject
            });
          });
          if (j && j.data && j.data.phone) {
            realPhone = j.data.phone;
            realOpenid = j.data.openid || openid;
          }
        } catch (apiErr) {
          console.warn('[doLogin] /api/auth/wx-login 失败 (开发期忽略), 用 dev openid fallback', apiErr);
        }
      }
      // 构造 user 对象
      const oldUser = app.globalData.user || {};
      const newUser = {
        userId: oldUser.userId || ('u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
        phone: realPhone || oldUser.phone || '',
        nickname: oldUser.nickname || '微信用户',
        openid: realOpenid,
        loggedIn: true,
        loggedAt: Date.now()
      };
      // 写 storage + globalData
      setUser(newUser);
      app.globalData.user = newUser;
      // 同步 coupon 聚合 phone (v0.7.3 跨设备)
      // issue 接口在下次领券时自动合并 anonymousId 老券
      this.setData({ logging: false });
      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/me/me' });
      }, 800);
    } catch (e) {
      this.setData({ logging: false });
      throw e;
    }
  },

  // 折叠区: 手机号登录 (开发模式)
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
    setTimeout(() => {
      this.doLogin({ phone }).then(() => {
        // doLogin 自己处理跳转
      }).catch(e => {
        this.setData({ logging: false });
        wx.showToast({ title: '登录失败', icon: 'none' });
      });
    }, 500);
  }
});
