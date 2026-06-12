// pages/checkin/checkin.js
const { getCheckinStats } = require('../../utils/api.js');
const { getUserId } = require('../../utils/user.js');

Page({
  data: { stats: { unique: 0, latest: [] }, loading: true },

  onShow() {
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
