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

    // v0.7.5: 隐私协议检测 - 未同意先弹, 同意后才用定位/相机等接口
    this.checkPrivacyAgreement().then(agreed => {
      if (agreed) {
        this.startLocationWatch();
      }
    });
  },

  // v0.7.5: 隐私协议 - 检测 + 弹窗 + 持久化 (走自实现 agreement 页, 不依赖微信原生 __usePrivacyCheck__)
  checkPrivacyAgreement() {
    return new Promise(resolve => {
      const stored = wx.getStorageSync('campsite_privacy_agreed');
      if (stored) {
        this.globalData.privacyAgreed = true;
        resolve(true);
        return;
      }
      // 未同意 → 弹自定义 modal, 用户点查看协议 → 跳 agreement 页
      wx.showModal({
        title: '用户协议与隐私政策',
        content: '鹿营小程序需要获取你的位置 (用于显示附近目的地和路线) 和相机权限 (用于拍照打卡)。\n\n请阅读并同意《用户协议》与《隐私政策》后继续使用。',
        confirmText: '查看协议',
        cancelText: '不同意并退出',
        success: (m) => {
          if (m.confirm) {
            wx.navigateTo({ url: '/pages/agreement/agreement' });
            // 跳到 agreement 页后, 用户点"我已阅读并同意"会写 storage, 不在这里 resolve
            // 等下次 onShow 检查 (在 agreement 同意后)
            setTimeout(() => resolve(false), 1000);
          } else {
            // 拒绝, 退出小程序
            wx.exitMiniProgram({ success: () => resolve(false), fail: () => resolve(false) });
          }
        }
      });
    });
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
