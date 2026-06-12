// pages/me/me.js
const { getCheckinStats, getMyCoupons } = require('../../utils/api.js');
const { getUser, getUserId } = require('../../utils/user.js');
const app = getApp();

Page({
  data: { user: null, stats: { unique: 0 }, couponCount: 0 },

  onShow() {
    this.setData({ user: getUser() });
    getCheckinStats(getUserId()).then(j => {
      this.setData({ stats: j.data });
    }).catch(e => console.warn(e));
    getMyCoupons(getUserId()).then(j => {
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
  }
});
