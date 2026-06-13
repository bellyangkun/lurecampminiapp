// pages/me/me.js - 我的页 v0.9.0
const { getCheckinStats, getMyCoupons, getMyBookings, uploadAvatar, updateProfile } = require('../../utils/api.js');
const { getUser, getUserId, setUser, clearUser, requireLogin } = require('../../utils/user.js');
const app = getApp();

Page({
  data: { user: null, stats: { unique: 0 }, couponCount: 0, bookingCount: 0 },

  onShow() {
    const u = getUser();
    this.setData({ user: u });

    // 已集印章
    getCheckinStats(getUserId()).then(j => {
      this.setData({ stats: j.data });
    }).catch(e => console.warn(e));

    // 可用优惠券数
    getMyCoupons({ userId: getUserId(), phone: u.phone || '' }).then(j => {
      const list = (j.data && j.data.coupons) || [];
      const now = Date.now();
      const active = list.filter(c => c.status === 'active' && (!c.expiresAt || c.expiresAt > now));
      this.setData({ couponCount: active.length });
    }).catch(e => console.warn(e));

    // 我的预约数
    getMyBookings(getUserId()).then(j => {
      const list = (j.data && j.data.bookings) || [];
      this.setData({ bookingCount: list.length });
    }).catch(e => console.warn(e));
  },

  onPhoneLoginTap() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  onEditProfileTap() {
    if (!requireLogin('编辑资料')) return;
    wx.navigateTo({ url: '/pages/profile-setup/profile-setup' });
  },

  onCouponTap() {
    if (!requireLogin('我的优惠券')) return;
    wx.navigateTo({ url: '/pages/coupons/coupons' });
  },

  onAiTap() {
    wx.switchTab({ url: '/pages/ai/ai' });
  },

  onCheckinTap() {
    if (!requireLogin('我的打卡')) return;
    wx.switchTab({ url: '/pages/checkin/checkin' });
  },

  onBookingTap() {
    if (!requireLogin('我的预约')) return;
    wx.navigateTo({ url: '/pages/booking/booking' });
  },

  onCallTap() {
    wx.makePhoneCall({ phoneNumber: '021-59978686' });
  },

  onAgreementTap() {
    wx.navigateTo({ url: '/pages/agreement/agreement' });
  },

  // v0.7.9: 退出登录 - 二次确认 + 清缓存 + 重新生成 anonymousId + 刷新页面
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
        clearUser();
        app.globalData.user = getUser();
        this.setData({ user: app.globalData.user });
        wx.showToast({ title: '已退出登录', icon: 'success' });
        this.onShow();
      }
    });
  },

  // v0.7.9: 换头像 - 已登录才生效
  onAvatarTap() {
    const u = getUser();
    if (!u.loggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.showActionSheet({
      itemList: ['从微信选头像', '从相册选图', '拍一张'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.chooseWxAvatar();
        } else if (res.tapIndex === 1) {
          this.pickFromAlbum();
        } else if (res.tapIndex === 2) {
          this.shootAvatar();
        }
      }
    });
  },

  // 微信原生选头像 (2.21.2+ 基础库)
  chooseWxAvatar() {
    wx.navigateTo({ url: '/pages/profile-setup/profile-setup' });
  },

  async pickFromAlbum() {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['album'],
          sizeType: ['compressed'],
          success: resolve,
          fail: reject
        });
      });
      const tempFile = res.tempFiles && res.tempFiles[0];
      if (tempFile && tempFile.tempFilePath) {
        this.uploadAvatar(tempFile.tempFilePath);
      }
    } catch (e) {
      console.log('[Avatar] 选图取消', e);
    }
  },

  async shootAvatar() {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['camera'],
          sizeType: ['compressed'],
          camera: 'front',
          success: resolve,
          fail: reject
        });
      });
      const tempFile = res.tempFiles && res.tempFiles[0];
      if (tempFile && tempFile.tempFilePath) {
        this.uploadAvatar(tempFile.tempFilePath);
      }
    } catch (e) {
      console.log('[Avatar] 拍照取消', e);
    }
  },

  // 上传头像到后端
  async uploadAvatar(tempFilePath) {
    const u = getUser();
    wx.showLoading({ title: '上传中...' });
    try {
      const fs = wx.getFileSystemManager();
      const localPath = `${wx.env.USER_DATA_PATH}/avatar_${Date.now()}.jpg`;
      fs.copyFileSync(tempFilePath, localPath);
      const buffer = fs.readFileSync(localPath);
      const base64 = 'data:image/jpeg;base64,' + buffer.toString('base64');
      const j = await uploadAvatar(u.userId, base64);
      wx.hideLoading();
      if (j && j.code === 0 && j.data && j.data.avatarUrl) {
        const avatarUrl = j.data.avatarUrl;
        await updateProfile(u.userId, { nickname: u.nickname, avatarUrl }).catch(() => {});
        const newUser = { ...getUser(), avatarUrl };
        setUser(newUser);
        app.globalData.user = newUser;
        this.setData({ user: newUser });
        wx.showToast({ title: '头像已更新', icon: 'success' });
      } else {
        wx.showToast({ title: j.message || '上传失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      console.error('[Avatar] 上传失败', e);
      wx.showToast({ title: '上传失败', icon: 'none' });
    }
  }
});
