// pages/me/me.js
const { getUser } = require('../../utils/user.js');
const { getCheckinStats } = require('../../utils/api.js');
const app = getApp();

Page({
  data: { user: null, stats: { unique: 0 } },

  onShow() {
    this.setData({ user: getUser() });
    getCheckinStats(getUser().userId).then(j => {
      this.setData({ stats: j.data });
    }).catch(e => console.warn(e));
  },

  onPhoneLoginTap() {
    wx.navigateTo({ url: '/pages/login/login' });
  }
});
