// app.js - v0.8.0
const { getUser, setUser, getStableUserId, setStableUserId, setStableOpenid } = require('./utils/user.js');
const { wxLogin } = require('./utils/api.js');

App({
  onLaunch() {
    // 初始化用户身份
    const user = getUser();
    this.globalData.user = user;

    // v0.8.0: 若本地已登录, 启动时用 wx.login code 刷新服务端最新资料
    // 保证换设备后头像/昵称/已领券/打卡/预约等数据一致
    if (user && user.loggedIn) {
      this.refreshUserFromServer();
    } else {
      // 未登录时也调用 wx.login, 把 code 暂存, 供登录页使用
      wx.login({
        success: (res) => {
          if (res.code) {
            this.globalData.wxCode = res.code;
          }
        }
      });
    }

    // v0.7.5: 隐私协议检测 - 未同意先弹, 同意后才用定位/相机等接口
    this.checkPrivacyAgreement().then(agreed => {
      if (agreed) {
        this.startLocationWatch();
      }
    });
  },

  // v0.8.0: 用 wx.login code 调后端 /api/auth/wx-login, 刷新本地用户资料
  refreshUserFromServer() {
    wx.login({
      success: (res) => {
        if (!res.code) {
          console.warn('[App] wx.login 未拿到 code, 跳过启动刷新');
          return;
        }
        this.globalData.wxCode = res.code;
        const anonymousId = getStableUserId();
        wxLogin({ code: res.code, anonymousId })
          .then((r) => {
            if (r && r.code === 0 && r.user) {
              const serverUser = r.user;
              const localUser = getUser();
              const newUser = {
                ...localUser,
                userId: serverUser.id || localUser.userId,
                phone: serverUser.phone || r.phone || localUser.phone,
                nickname: serverUser.nickname || localUser.nickname,
                avatarUrl: serverUser.avatarUrl || localUser.avatarUrl,
                openid: serverUser.openid || localUser.openid,
                checkinCount: serverUser.checkinCount || localUser.checkinCount || 0,
                loggedIn: true
              };
              setUser(newUser);
              this.globalData.user = newUser;
              if (newUser.openid) setStableOpenid(newUser.openid);
              if (newUser.userId) setStableUserId(newUser.userId);
              console.log('[App] 启动刷新用户资料成功', newUser.userId);
            }
          })
          .catch((e) => {
            console.warn('[App] 启动刷新用户资料失败', e);
          });
      },
      fail: (e) => {
        console.warn('[App] wx.login 失败', e);
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

  // v0.8.1: 启动位置实时更新, 先确保权限, 失败时降级用 wx.getLocation
  startLocationWatch() {
    if (this._locationStarted) return;
    this._locationStarted = true;

    const doStart = () => {
      wx.startLocationUpdate({
        success: () => {
          console.log('[App] startLocationUpdate 成功');
          wx.onLocationChange((res) => {
            this.globalData.userLat = res.latitude;
            this.globalData.userLng = res.longitude;
          });
        },
        fail: (e) => {
          console.warn('[App] startLocationUpdate 失败, 降级用 wx.getLocation', e);
          this._locationStarted = false;
          this.fallbackGetLocation();
        }
      });
    };

    // 先检查权限
    wx.getSetting({
      success: (res) => {
        const auth = res.authSetting['scope.userLocation'];
        if (auth === false) {
          // 之前被拒绝, 引导去设置页
          console.warn('[App] 用户之前拒绝定位权限');
          wx.showModal({
            title: '需要定位权限',
            content: '用于显示你的当前位置和附近目的地，请在设置中开启定位权限。',
            confirmText: '去开启',
            success: (m) => {
              if (m.confirm) wx.openSetting();
            }
          });
          return;
        }
        if (auth === true || auth == null) {
          doStart();
        }
      },
      fail: () => doStart()
    });
  },

  // v0.8.1: 降级方案 - 用 wx.getLocation 取一次位置
  fallbackGetLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.globalData.userLat = res.latitude;
        this.globalData.userLng = res.longitude;
        console.log('[App] wx.getLocation 成功', res.latitude, res.longitude);
      },
      fail: (e) => {
        console.warn('[App] wx.getLocation 也失败', e);
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
