// app.js
const { getUser } = require('./utils/user.js');

App({
  onLaunch() {
    // 初始化用户身份
    const user = getUser();
    this.globalData.user = user;

    // 微信登录拿 code
    wx.login({
      success: (res) => {
        if (res.code) {
          this.globalData.wxCode = res.code;
          // TODO: 发到后端 /api/auth/wx-login 换 session (需要后端先实现该接口)
        }
      }
    });

    // 拉取用户位置 (持续更新)
    this.startLocationWatch();
  },

  startLocationWatch() {
    wx.startLocationUpdate({
      success: () => {
        wx.onLocationChange((res) => {
          this.globalData.userLat = res.latitude;
          this.globalData.userLng = res.longitude;
        });
      },
      fail: (e) => {
        console.warn('[App] startLocationUpdate 失败', e);
      }
    });
  },

  globalData: {
    user: null,
    userLat: null,
    userLng: null,
    wxCode: null,
    points: []   // POI 缓存
  }
});
