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
    // 用 wx.navigateTo 到一个用 open-type=chooseAvatar 的中间 button 触发
    // 简单起见, 直接用 chooseMedia 拍/选
    this.pickFromAlbum();
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
      // 用户取消
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
      // 1. 选本地永久路径
      const fs = wx.getFileSystemManager();
      const localPath = `${wx.env.USER_DATA_PATH}/avatar_${Date.now()}.jpg`;
      fs.copyFileSync(tempFilePath, localPath);
      // 2. 读 base64
      const buffer = fs.readFileSync(localPath);
      const base64 = buffer.toString('base64');
      const dataUrl = 'data:image/jpeg;base64,' + base64;
      // 3. 发到后端
      const j = await new Promise((resolve, reject) => {
        wx.request({
          url: 'https://lurecamp1.xiabebe.cn:3005/api/users/' + encodeURIComponent(u.userId) + '/avatar',
          method: 'POST',
          data: { avatarDataUrl: dataUrl },
          success: r => resolve(r.data),
          fail: reject
        });
      });
      wx.hideLoading();
      if (j && j.code === 0) {
        // 4. 缓存到本地, 刷新 UI
        u.avatarUrl = j.data.avatarUrl;
        setUser(u);
        app.globalData.user = u;
        this.setData({ user: u });
        wx.showToast({ title: '头像已更新', icon: 'success' });
      } else {
        wx.showToast({ title: j.message || '上传失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      console.error('[Avatar] 上传失败', e);
      wx.showToast({ title: '上传失败', icon: 'none' });
    }
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
