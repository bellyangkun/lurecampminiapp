// pages/checkin/checkin.js - v0.8.0
const { getCheckinStats } = require('../../utils/api.js');
const { getUserId, requireLogin } = require('../../utils/user.js');

Page({
  data: { stats: { unique: 0, latest: [] }, loading: true },

  onShow() {
    // v0.8.0: 查看个人打卡记录必须先登录
    if (!requireLogin('查看打卡记录')) {
      this.setData({ loading: false });
      return;
    }
    this.loadStats();
  },

  async loadStats() {
    try {
      const j = await getCheckinStats(getUserId());
      this.setData({ stats: j.data, loading: false });
    } catch (e) {
      console.warn('[Checkin] 拉统计失败', e);
      this.setData({ loading: false });
    }
  },

  onThumbTap(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.previewImage({ urls: [url], current: url });
  },

  goIndex() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
