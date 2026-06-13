// pages/wifi/wifi.js - 一键连接营地 WiFi
// WiFi 配置优先从后端 /settings/wifi 获取，失败时使用本地兜底配置
const { getCampWifi } = require('../../utils/api.js');

const DEFAULT_WIFI = {
  ssid: 'XiangYueHuaTing-Guest',
  password: '12345678'
};

Page({
  data: {
    ssid: DEFAULT_WIFI.ssid,
    password: DEFAULT_WIFI.password,
    connecting: false
  },

  onLoad() {
    getCampWifi().then(j => {
      if (j && j.data) {
        this.setData({
          ssid: j.data.ssid || DEFAULT_WIFI.ssid,
          password: j.data.password || DEFAULT_WIFI.password
        });
      }
    }).catch(e => {
      console.warn('[WiFi] 拉取后台配置失败，使用默认配置', e);
    });
  },

  onCopySsid() {
    wx.setClipboardData({
      data: this.data.ssid,
      success: () => wx.showToast({ title: 'WiFi 名称已复制', icon: 'success' })
    });
  },

  onCopyPassword() {
    wx.setClipboardData({
      data: this.data.password,
      success: () => wx.showToast({ title: '密码已复制', icon: 'success' })
    });
  },

  // 尝试自动连接（安卓支持较好，iOS 通常失败）
  onAutoConnect() {
    const { ssid, password } = this.data;
    this.setData({ connecting: true });

    wx.startWifi({
      success: () => {
        wx.connectWifi({
          SSID: ssid,
          password: password,
          success: () => {
            this.setData({ connecting: false });
            wx.showToast({ title: '连接成功', icon: 'success' });
          },
          fail: (e) => {
            this.setData({ connecting: false });
            console.warn('[WiFi] 自动连接失败', e);
            this.showManualGuide();
          }
        });
      },
      fail: (e) => {
        this.setData({ connecting: false });
        console.warn('[WiFi] 初始化 WiFi 失败', e);
        this.showManualGuide();
      }
    });
  },

  showManualGuide() {
    wx.showModal({
      title: '需要手动连接',
      content: 'iOS 或部分安卓机型不支持小程序直接连 WiFi。已复制密码，请前往系统设置 → WLAN 选择该网络并粘贴密码。',
      confirmText: '复制密码',
      cancelText: '知道了',
      success: (res) => {
        if (res.confirm) {
          wx.setClipboardData({
            data: this.data.password,
            success: () => wx.showToast({ title: '密码已复制', icon: 'success' })
          });
        }
      }
    });
  }
});
