// pages/login/login.js - 手机号 + 验证码登录
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
    timer: null
  },

  onUnload() {
    if (this.data.timer) clearInterval(this.data.timer);
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
      // 倒计时
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
      wx.showToast({ title: '发送失败: ' + (e.errMsg || e.message || ''), icon: 'none' });
    }
  },

  async onLogin() {
    const { phone, code } = this.data;
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请填正确手机号', icon: 'none' });
      return;
    }
    if (!code || code.length < 4) {
      wx.showToast({ title: '请填验证码', icon: 'none' });
      return;
    }
    this.setData({ logging: true });
    // DEV 模式: 不验真, 直接登录 (生产需接 /api/auth/login 验真)
    setTimeout(() => {
      const u = app.globalData.user || {};
      u.phone = phone;
      u.nickname = u.nickname || ('用户' + phone.slice(-4));
      u.loggedIn = true;
      setUser(u);
      app.globalData.user = u;
      this.setData({ logging: false });
      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    }, 500);
  },

  onAgreementTap() {
    wx.showModal({
      title: '用户协议',
      content: '本协议是度假村小程序跟用户之间的简单约定: 用户授权手机号用于登录/接收验证码, 不做其他用途. 度假村保护用户隐私.',
      showCancel: false
    });
  }
});
