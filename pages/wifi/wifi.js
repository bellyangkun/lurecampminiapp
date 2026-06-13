// pages/wifi/wifi.js - 一键连接营地 WiFi
// WiFi 配置优先从后端 /settings/wifi 获取，失败时使用本地兜底配置
const { getCampWifi } = require('../../utils/api.js');
const drawQrcode = require('../../utils/weapp-qrcode.js');

const DEFAULT_WIFI = {
  ssid: 'XiangYueHuaTing-Guest',
  password: '12345678'
};

// 连接超时时间（毫秒）
const CONNECT_TIMEOUT = 10000;

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
        }, () => this.drawWifiQr());
      } else {
        this.drawWifiQr();
      }
    }).catch(e => {
      console.warn('[WiFi] 拉取后台配置失败，使用默认配置', e);
      this.drawWifiQr();
    });
  },

  onReady() {
    this.drawWifiQr();
  },

  // 绘制 WiFi 连接二维码（iOS/安卓相机均可识别）
  drawWifiQr() {
    const { ssid, password } = this.data;
    if (!ssid) return;
    // 标准 WiFi 二维码格式
    const text = `WIFI:T:WPA;S:${ssid};P:${password};H:false;;`;
    try {
      drawQrcode({
        width: 200,
        height: 200,
        canvasId: 'wifiQrCode',
        text,
        correctLevel: 3 // H
      });
    } catch (e) {
      console.warn('[WiFi] 绘制二维码失败', e);
    }
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

  // 一键自动连接：iOS 直接引导手动，安卓尝试自动连并加超时兜底
  onAutoConnect() {
    const { ssid, password } = this.data;
    if (!ssid) {
      wx.showToast({ title: 'WiFi 名称不能为空', icon: 'none' });
      return;
    }

    // iOS 不支持小程序直接连 WiFi，直接引导手动
    const systemInfo = wx.getSystemInfoSync();
    if (systemInfo.platform === 'ios') {
      this.showManualGuide();
      return;
    }

    this.setData({ connecting: true });
    let timer = null;
    let finished = false;

    const finish = (success, errMsg) => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      this.setData({ connecting: false });
      if (success) {
        wx.showToast({ title: '连接成功', icon: 'success' });
      } else {
        console.warn('[WiFi] 自动连接失败', errMsg);
        this.showManualGuide();
      }
    };

    // 超时兜底：避免「正在搜索设备」一直卡住
    timer = setTimeout(() => {
      finish(false, 'timeout');
    }, CONNECT_TIMEOUT);

    wx.startWifi({
      success: () => {
        wx.connectWifi({
          SSID: ssid,
          password: password,
          success: () => finish(true),
          fail: (e) => finish(false, e)
        });
      },
      fail: (e) => finish(false, e)
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
