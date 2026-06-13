// pages/profile-setup/profile-setup.js - 微信一键登录后, 让用户选微信头像 + 微信昵称
const { setUser, getUser } = require('../../utils/user.js');
const app = getApp();

Page({
  data: {
    avatarUrl: '',
    nickname: '',
    avatarTempPath: '',  // 微信 chooseAvatar 返回的临时路径 (需上传到自己后端, 微信 URL 几天就过期)
    saving: false
  },

  onLoad() {
    // 复用当前 user 已有值
    const u = getUser();
    this.setData({
      avatarUrl: u.avatarUrl || '',
      nickname: u.nickname || ''
    });
  },

  // v0.7.13: 微信选头像 - 真机弹原生选择器, 模拟器返回模拟路径
  onChooseAvatar(e) {
    console.log('[profile-setup] chooseAvatar', e.detail);
    const tempPath = e.detail.avatarUrl;
    if (!tempPath) return;
    // 微信返回的是临时路径 (http://tmp/...), 需上传到自己后端
    this.setData({ avatarTempPath: tempPath, avatarUrl: tempPath });
  },

  // v0.7.13: 微信昵称 - 真机弹原生选择器, 自动写入 input
  onNickBlur(e) {
    const nick = e.detail.value || '';
    console.log('[profile-setup] nickname blur:', nick);
    this.setData({ nickname: nick });
  },

  async onSubmit() {
    if (this.data.saving) return;
    if (!this.data.avatarTempPath && !this.data.avatarUrl) {
      wx.showToast({ title: '请选择微信头像', icon: 'none' });
      return;
    }
    if (!this.data.nickname.trim()) {
      wx.showToast({ title: '请填写微信昵称', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      const u = getUser();
      let finalAvatarUrl = this.data.avatarUrl;

      // 如果有临时路径, 上传到自己后端 (微信临时路径几天就过期)
      if (this.data.avatarTempPath) {
        try {
          const fs = wx.getFileSystemManager();
          const localPath = `${wx.env.USER_DATA_PATH}/setup_avatar_${Date.now()}.jpg`;
          fs.copyFileSync(this.data.avatarTempPath, localPath);
          const buffer = fs.readFileSync(localPath);
          const base64 = buffer.toString('base64');
          const dataUrl = 'data:image/jpeg;base64,' + base64;
          const j = await new Promise((resolve, reject) => {
            wx.request({
              url: 'https://lurecamp1.xiabebe.cn:3005/api/users/' + encodeURIComponent(u.userId) + '/avatar',
              method: 'POST',
              data: { avatarDataUrl: dataUrl },
              success: r => resolve(r.data),
              fail: reject
            });
          });
          if (j && j.code === 0) {
            finalAvatarUrl = j.data.avatarUrl;
          }
        } catch (uploadErr) {
          console.warn('[profile-setup] 头像上传失败, 用临时路径', uploadErr);
        }
      }

      // 写后端更新 user.nickname
      try {
        await new Promise((resolve) => {
          wx.request({
            url: 'https://lurecamp1.xiabebe.cn:3005/api/users/' + encodeURIComponent(u.userId) + '/profile',
            method: 'POST',
            data: { nickname: this.data.nickname, avatarUrl: finalAvatarUrl },
            success: resolve,
            fail: resolve  // 不阻塞
          });
        });
      } catch (e) {
        console.warn('[profile-setup] 写后端失败', e);
      }

      // 写本地 user
      const newUser = { ...u, nickname: this.data.nickname, avatarUrl: finalAvatarUrl };
      setUser(newUser);
      app.globalData.user = newUser;

      this.setData({ saving: false });
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/me/me' });
      }, 800);
    } catch (e) {
      console.error('[profile-setup] save fail', e);
      this.setData({ saving: false });
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  onSkip() {
    wx.switchTab({ url: '/pages/me/me' });
  }
});
