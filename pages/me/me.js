// pages/me/me.js
const { getCheckinStats, getMyCoupons } = require('../../utils/api.js');
const { getUser, getUserId, clearUser } = require('../../utils/user.js');
const app = getApp();

Page({
  data: { user: null, stats: { unique: 0 }, couponCount: 0 },

  onShow() {
    this.setData({ user: getUser() });
    getCheckinStats(getUserId()).then(j => {
      this.setData({ stats: j.data });
    }).catch(e => console.warn(e));
     const u = wx.getStorageSync('campsite_user') || {};
     getMyCoupons({ userId: getUserId(), phone: u.phone || '' }).then(j => {
       const list = (j.data && j.data.coupons) || [];
       // 只算未使用 + 未过期的
       const now = Date.now();
       const active = list.filter(c => c.status === 'active' && (!c.expiresAt || c.expiresAt > now));
       this.setData({ couponCount: active.length });
     }).catch(e => console.warn(e));
  },

  onPhoneLoginTap() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  onCouponTap() {
    wx.navigateTo({ url: '/pages/coupons/coupons' });
  },

  onAiTap() {
    wx.switchTab({ url: '/pages/ai/ai' });
  },

  onCheckinTap() {
    wx.switchTab({ url: '/pages/checkin/checkin' });
  },

  onBookingTap() {
    wx.navigateTo({ url: '/pages/booking/booking' });
  },

  onCallTap() {
    wx.makePhoneCall({ phoneNumber: '021-59978686' });
  },

  // v0.7.7: 退出登录 - 二次确认 + 清缓存 + 重新生成 anonymousId + 刷新页面
  onAgreementTap() {
    wx.navigateTo({ url: '/pages/agreement/agreement' });
  },

  onLogoutTap() {
    const u = getUser();
    if (!u.loggedIn) {
      wx.showToast({ title: '当前未登录', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '退出登录',
      content: '退出后将清除登录状态, 但不会删除已领取的优惠券和打卡记录。\n\n确定要退出吗?',
      confirmText: '退出登录',
      confirmColor: '#d32f2f',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) return;
        // 1. 清掉 user 缓存
        clearUser();
        // 2. 同步 globalData
        app.globalData.user = getUser();
        // 3. 刷新页面
        this.setData({ user: app.globalData.user });
        // 4. toast 提示
        wx.showToast({ title: '已退出登录', icon: 'success' });
        // 5. 重新拉一次统计 (用新 anonymousId, 数字会重置, 因为打卡是按 userId 算的)
        this.onShow();
      }
    });
  }
});
