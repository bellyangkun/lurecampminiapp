// pages/booking/booking.js - v0.8.0 活动预约
const { getActivities, getMyBookings, submitBooking } = require('../../utils/api.js');
const { getUserId, requireLogin } = require('../../utils/user.js');

const KIND_META = {
  activity:  { icon: '⛺', name: '活动' },
  catering:  { icon: '🍽️', name: '餐饮' },
  hotel:     { icon: '🏨', name: '酒店' },
  event:     { icon: '🎉', name: '主题' }
};

Page({
  data: {
    activeTab: 'list',  // list | mine
    kindFilter: 'all',
    kindMeta: KIND_META,
    kindList: [
      { key: 'all', label: '全部' },
      { key: 'activity', label: '⛺ 活动' },
      { key: 'catering', label: '🍽️ 餐饮' },
      { key: 'hotel', label: '🏨 酒店' },
      { key: 'event', label: '🎉 主题' }
    ],
    activities: [],
    filteredActivities: [],
    selectedActivity: null,
    form: { name: '', phone: '', date: '', count: 1, note: '' },
    submitting: false,
    today: ''
  },

  onShow() {
    this.setData({ today: new Date().toISOString().split('T')[0] });
    if (this.data.activeTab === 'list') this.loadActivities();
    else this.loadMine();
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    // v0.8.0: 切到"我的预约"必须先登录
    if (tab === 'mine' && !requireLogin('查看我的预约')) {
      this.setData({ activeTab: 'list' });
      return;
    }
    this.setData({ activeTab: tab });
    if (tab === 'list') this.loadActivities();
    else this.loadMine();
  },

  onKindFilterTap(e) {
    const kind = e.currentTarget.dataset.kind;
    const filtered = kind === 'all'
      ? this.data.activities
      : this.data.activities.filter(a => a.kind === kind);
    this.setData({ kindFilter: kind, filteredActivities: filtered });
  },

  async loadActivities() {
    try {
      const j = await getActivities();
      const list = (j.data && j.data.activities) || (Array.isArray(j) ? j : []);
      this.setData({
        activities: list,
        filteredActivities: this.data.kindFilter === 'all'
          ? list
          : list.filter(a => a.kind === this.data.kindFilter)
      });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async loadMine() {
    // v0.8.0: 查看个人预约记录必须先登录
    if (!requireLogin('查看我的预约')) {
      this.setData({ activeTab: 'list', mine: [] });
      return;
    }
    try {
      const j = await getMyBookings(getUserId());
      this.setData({ mine: (j.data && j.data.bookings) || [] });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onBookTap(e) {
    // v0.7.17: 点"立即预约"必须登录
    if (!requireLogin('预约活动')) return;
    const id = e.currentTarget.dataset.id;
    const a = this.data.activities.find(x => x.id === id);
    if (!a) return;
    // 预填用户身份信息
    const u = wx.getStorageSync('campsite_user') || {};
    this.setData({
      selectedActivity: a,
      form: {
        name: u.nickname || '',
        phone: u.phone || '',
        date: this.data.today,
        count: 1,
        note: ''
      }
    });
  },

  closeForm() {
    this.setData({ selectedActivity: null, submitting: false });
  },

  noop() {},

  onFormInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onCountChange(e) {
    this.setData({ 'form.count': parseInt(e.detail.value, 10) || 1 });
  },

  async onSubmit() {
    // v0.7.17: 提交预约必须登录
    if (!requireLogin('提交预约')) return;
    const { name, phone, date, count } = this.data.form;
    if (!name) { wx.showToast({ title: '请填姓名', icon: 'none' }); return; }
    if (!/^1[3-9]\d{9}$/.test(phone)) { wx.showToast({ title: '请填正确手机号', icon: 'none' }); return; }
    if (!date) { wx.showToast({ title: '请选日期', icon: 'none' }); return; }
    if (!count || count < 1) { wx.showToast({ title: '至少 1 人', icon: 'none' }); return; }

    this.setData({ submitting: true });
    try {
      const j = await submitBooking({
        userId: getUserId(),
        activityId: this.data.selectedActivity.id,
        activityName: this.data.selectedActivity.name,
        name, phone, date, count,
        note: this.data.form.note
      });
      if (j.code !== 0) throw new Error(j.message || '提交失败');
      wx.showToast({ title: '预约成功, 等客服确认', icon: 'success' });
      this.closeForm();
      this.setData({ activeTab: 'mine' });
      this.loadMine();
    } catch (e) {
      this.setData({ submitting: false });
      wx.showToast({ title: e.message || '提交失败', icon: 'none' });
    }
  }
});
