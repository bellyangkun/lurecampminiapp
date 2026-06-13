// pages/profile-setup/profile-setup.js - v0.8.0
// 微信一键登录后, 引导用户选择微信头像 + 微信昵称
// 因微信已禁止静默获取头像/昵称, 这里使用官方组件:
//   - button open-type="chooseAvatar" 一键选择微信头像
//   - input type="nickname" 一键选择微信昵称
const { updateProfile, uploadAvatar } = require('../../utils/api.js');
const { setUser, getUser } = require('../../utils/user.js');
const app = getApp();

const DEFAULT_NICKNAME = '微信用户';

Page({
  data: {
    avatarUrl: '',
    nickname: '',
    avatarTempPath: '',  // 微信 chooseAvatar 返回的临时路径 (需上传到自己后端, 微信 URL 几天就过期)
    saving: false
  },

  onLoad() {
    // 优先复用服务端已有资料 (换设备登录时保持一致)
    const u = getUser();
    this.setData({
      avatarUrl: u.avatarUrl || '',
      nickname: u.nickname || ''
    });
  },

  // 微信选头像 - 真机弹原生选择器, 默认推荐微信头像
  onChooseAvatar(e) {
    console.log('[profile-setup] chooseAvatar', e.detail);
    const tempPath = e.detail.avatarUrl;
    if (!tempPath) return;
    // 微信返回的是临时路径 (http://tmp/...), 需提交时上传到自己后端
    this.setData({ avatarTempPath: tempPath, avatarUrl: tempPath });
  },

  // 微信昵称 - 真机弹原生选择器, 自动填入 input
  onNickBlur(e) {
    const nick = e.detail.value || '';
    console.log('[profile-setup] nickname blur:', nick);
    this.setData({ nickname: nick });
  },

  async onSubmit() {
    if (this.data.saving) return;

    const nickname = this.data.nickname.trim() || DEFAULT_NICKNAME;
    if (!this.data.avatarTempPath && !this.data.avatarUrl) {
      wx.showToast({ title: '请选择微信头像', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    try {
      const u = getUser();
      let finalAvatarUrl = this.data.avatarUrl;

      // 1. 若选了新头像, 先上传到自己后端 (微信临时 URL 会过期)
      if (this.data.avatarTempPath) {
        try {
          const base64 = await this.tempPathToBase64(this.data.avatarTempPath);
          const res = await uploadAvatar(u.userId, base64);
          if (res && res.code === 0 && res.data && res.data.avatarUrl) {
            finalAvatarUrl = res.data.avatarUrl;
          }
        } catch (uploadErr) {
          console.warn('[profile-setup] 头像上传失败, 用临时路径', uploadErr);
          finalAvatarUrl = this.data.avatarUrl || this.data.avatarTempPath;
        }
      }

      // 2. 同步到后端用户资料
      try {
        await updateProfile(u.userId, { nickname, avatarUrl: finalAvatarUrl });
      } catch (profileErr) {
        console.warn('[profile-setup] 写后端失败', profileErr);
      }

      // 3. 写本地 user
      const newUser = { ...u, nickname, avatarUrl: finalAvatarUrl };
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

  // 跳过设置: 给默认昵称, 头像留空由我的页显示占位
  onSkip() {
    const u = getUser();
    const nickname = this.data.nickname.trim() || DEFAULT_NICKNAME;
    const newUser = { ...u, nickname, avatarUrl: u.avatarUrl || '' };
    setUser(newUser);
    app.globalData.user = newUser;
    // 异步同步后端, 不阻塞跳转
    updateProfile(u.userId, { nickname, avatarUrl: newUser.avatarUrl }).catch(() => {});
    wx.switchTab({ url: '/pages/me/me' });
  },

  // 把微信临时头像路径转成 base64 dataUrl
  tempPathToBase64(tempPath) {
    return new Promise((resolve, reject) => {
      try {
        const fs = wx.getFileSystemManager();
        const localPath = `${wx.env.USER_DATA_PATH}/setup_avatar_${Date.now()}.jpg`;
        fs.copyFileSync(tempPath, localPath);
        const buffer = fs.readFileSync(localPath);
        const base64 = buffer.toString('base64');
        resolve('data:image/jpeg;base64,' + base64);
      } catch (e) {
        reject(e);
      }
    });
  }
});
