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

  // v0.7.5: 隐私协议 - 检测 + 弹窗 + 持久化
  checkPrivacyAgreement() {
    return new Promise(resolve => {
      const stored = wx.getStorageSync('campsite_privacy_agreed');
      if (stored) {
        this.globalData.privacyAgreed = true;
        resolve(true);
        return;
      }
      // v0.7.5: 调用 wx.getPrivacySetting 检测平台是否需要弹
      if (typeof wx.getPrivacySetting !== 'function') {
        // 老基础库没这个 API, 直接放行 (开发期)
        this.globalData.privacyAgreed = true;
        resolve(true);
        return;
      }
      wx.getPrivacySetting({
        success: (res) => {
          if (!res.needAuthorization) {
            // 平台不要求, 放行
            this.globalData.privacyAgreed = true;
            wx.setStorageSync('campsite_privacy_agreed', true);
            resolve(true);
            return;
          }
          // 需要用户同意, 弹 modal
          wx.showModal({
            title: '用户协议与隐私政策',
            content: '鹿营小程序需要获取你的位置, 用于显示附近目的地和路线规划; 使用相机, 用于拍照打卡。\n\n请阅读并同意《用户协议》与《隐私政策》后继续使用。',
            confirmText: '查看协议',
            cancelText: '不同意并退出',
            success: (m) => {
              if (m.confirm) {
                // 唤起微信原生隐私协议页
                wx.openPrivacyContract({
                  success: () => {
                    // 唤起后等用户点同意/拒绝, 用 onNeedPrivacyAuthorization 回调
                    this.globalData.privacyAgreed = true;
                    wx.setStorageSync('campsite_privacy_agreed', true);
                    this.startLocationWatch();
                    resolve(true);
                  },
                  fail: () => {
                    wx.showModal({
                      title: '无法打开协议',
                      content: '请到设置中允许"隐私协议"授权',
                      showCancel: false
                    });
                    resolve(false);
                  }
                });
              } else {
                // 拒绝, 退出小程序
                wx.exitMiniProgram({ success: () => resolve(false), fail: () => resolve(false) });
              }
            }
          });
        },
        fail: () => {
          // 检测失败, 放行 (开发期)
          this.globalData.privacyAgreed = true;
          resolve(true);
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
