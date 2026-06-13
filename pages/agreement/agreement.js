// pages/agreement/agreement.js
Page({
  data: {},

  onAgree() {
    // v0.7.5: 同意 → 写缓存 + 返回上一页
    wx.setStorageSync('campsite_privacy_agreed', true);
    const app = getApp();
    if (app) app.globalData.privacyAgreed = true;
    wx.showToast({ title: '已同意协议', icon: 'success' });
    setTimeout(() => {
      wx.navigateBack({ delta: 1, fail: () => {
        wx.switchTab({ url: '/pages/index/index' });
      }});
    }, 600);
  },

  onDisagree() {
    wx.showModal({
      title: '需要同意协议',
      content: '不同意用户协议将无法使用鹿营小程序, 是否退出?',
      success: (res) => {
        if (res.confirm) {
          wx.exitMiniProgram({ fail: () => {} });
        }
      }
    });
  }
});
