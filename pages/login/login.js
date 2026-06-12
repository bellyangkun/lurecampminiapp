// pages/login/login.js - 手机号 + 验证码登录
const { sendSms } = require('../../utils/api.js');
const { setUser } = require('../../utils/user.js');
const app = getApp();

Page({
  data: { phone: '', code: '', sending: false, counting: 0, devCode: '' },

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
        wx.showModal({ title: '验证码 (开发模式)', content: '本次验证码: ' + j.data.code, showCancel: false });
      } else {
        wx.showToast({ title: '已发送', icon: 'success' });
      }
      // 倒计时
      this.timer = setInterval(() => {
        if (this.data.counting <= 0) { clearInterval(this.timer); return; }
        this.setData({ counting: this.data.counting - 1 });
      }, 1000);
    } catch (e) {
      this.setData({ sending: false });
      wx.showToast({ title: '发送失败', icon: 'none' });
    }
  },

  onLogin() {
    if (!this.data.phone || !this.data.code) {
      wx.showToast({ title: '请填手机号 + 验证码', icon: 'none' });
      return;
    }
    // DEV 模式: 不验真, 直接存
    const u = app.globalData.user;
    u.phone = this.data.phone;
    u.loggedIn = true;
    setUser(u);
    app.globalData.user = u;
    wx.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 800);
  }
});
