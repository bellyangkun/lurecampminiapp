// pages/checkin/checkin.js - v0.8.0
const { getCheckinStats, API_BASE } = require('../../utils/api.js');
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
      const stats = j.data || { unique: 0, latest: [] };
      stats.latest = (stats.latest || []).map(c => ({
        ...c,
        shotUrl: this.normalizeShotUrl(c.shotUrl)
      }));
      this.setData({ stats, loading: false });
    } catch (e) {
      console.warn('[Checkin] 拉统计失败', e);
      this.setData({ loading: false });
    }
  },

  // 后端返回的 shotUrl 可能是相对路径，转成小程序可访问的完整 URL
  normalizeShotUrl(shotUrl) {
    if (!shotUrl) return '';
    if (/^https?:\/\//.test(shotUrl)) return shotUrl;
    if (shotUrl.startsWith('/ar_shots/')) {
      return API_BASE.replace(/\/api$/, '') + shotUrl;
    }
    return API_BASE + shotUrl;
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
