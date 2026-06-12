// pages/coupons/coupons.js
const { getCouponTemplates, getMyCoupons, issueCoupon } = require('../../utils/api.js');
const { getUserId } = require('../../utils/user.js');

Page({
  data: {
    activeTab: 'all',   // all | mine
    templates: [],
    mine: [],
    loading: true
  },

  onShow() {
    if (this.data.activeTab === 'all') this.loadTemplates();
    else this.loadMine();
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    if (tab === 'all') this.loadTemplates();
    else this.loadMine();
  },

  async loadTemplates() {
    this.setData({ loading: true });
    try {
      const j = await getCouponTemplates();
      const list = (j.data && j.data.templates) || (Array.isArray(j) ? j : []);
      this.setData({ templates: list, loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async loadMine() {
    this.setData({ loading: true });
    try {
      const j = await getMyCoupons(getUserId());
      this.setData({ mine: (j.data && j.data.coupons) || [], loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async onClaimTap(e) {
    const id = e.currentTarget.dataset.id;
    const tpl = this.data.templates.find(t => t.id === id);
    if (!tpl) return;
    try {
      await issueCoupon({ templateId: id, userId: getUserId() });
      wx.showToast({ title: '领取成功', icon: 'success' });
      // 刷新我的券数量
      this.loadMine();
    } catch (e) {
      wx.showToast({ title: '领取失败', icon: 'none' });
    }
  },

  onCopyCode(e) {
    const code = e.currentTarget.dataset.code;
    if (!code) return;
    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({ title: '券码已复制', icon: 'success' });
      }
    });
  },

  switchToAll() {
    this.setData({ activeTab: 'all' });
    this.loadTemplates();
  }
});
