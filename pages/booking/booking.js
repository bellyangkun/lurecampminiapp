// pages/booking/booking.js - v0.8.0 活动预约
const { getActivities, getMyBookings, submitBooking } = require('../../utils/api.js');
const { getUserId, requireLogin } = require('../../utils/user.js');

const KIND_META = {
  activity:  { icon: '⛺', name: '活动' },
  catering:  { icon: '🍽️', name: '餐饮' },
  hotel:     { icon: '🏨', name: '酒店' },
  event:     { icon: '🎉', name: '主题' }
};

function fmtError(e) {
  if (!e) return '提交失败';
  if (e.message) return e.message;
  if (e.errMsg) return e.errMsg;
  if (e.data && e.data.message) return e.data.message;
  return '提交失败';
}

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
    // v0.8.1: 默认日期优先用活动可预约 slots 第一天, 避免默认今天不在可选时段
    const defaultDate = (a.slots && a.slots.length) ? a.slots[0] : this.data.today;
    this.setData({
      selectedActivity: a,
      form: {
        name: u.nickname || '',
        phone: u.phone || '',
        date: defaultDate,
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

    // v0.8.1: 客户端提前校验日期是否在活动 slots 内, 给出明确提示
    const act = this.data.selectedActivity;
    if (act && act.slots && act.slots.length && !act.slots.includes(date)) {
      wx.showToast({ title: '该日期不在可选时段内: ' + act.slots.join(', '), icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const payload = {
        userId: getUserId(),
        activityId: act.id,
        activityName: act.name,
        name, phone, date, count,
        note: this.data.form.note
      };
      console.log('[Booking] submit payload', payload);
      const j = await submitBooking(payload);
      console.log('[Booking] submit response', j);
      if (!j || j.code !== 0) {
        throw new Error((j && j.message) || '提交失败');
      }
      wx.showToast({ title: '预约成功, 等客服确认', icon: 'success' });
      this.closeForm();
      this.setData({ activeTab: 'mine' });
      this.loadMine();
    } catch (e) {
      console.error('[Booking] submit error', e);
      this.setData({ submitting: false });
      wx.showToast({ title: fmtError(e), icon: 'none' });
    }
  }
});
