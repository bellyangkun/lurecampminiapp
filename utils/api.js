// utils/api.js - 后端 API 封装 (跟 H5 共享)
const API_BASE = 'https://lurecamp1.xiabebe.cn/api';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: API_BASE + path,
      method: options.method || 'GET',
      data: options.data,
      header: { 'Content-Type': 'application/json', ...(options.header || {}) },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(res);
        }
      },
      fail: reject
    });
  });
}

module.exports = {
  API_BASE,
  request,

  // 业务接口
  getPoints: () => request('/points'),
  getActivities: () => request('/activities'),
  getMyBookings: (userId) => request('/bookings?userId=' + encodeURIComponent(userId)),
  submitBooking: (data) => request('/bookings', { method: 'POST', data }),
  getCheckinStats: (userId) => request('/checkins/stats?userId=' + encodeURIComponent(userId)),
  submitCheckin: (data) => request('/checkins', { method: 'POST', data }),
  getCouponTemplates: () => request('/coupons/templates'),
  // v0.7.3: 接受 {userId, phone} 对象 (后端 phone 聚合匿名 userId 老券)
  getMyCoupons: (arg) => {
    if (typeof arg === 'string') {
      return request('/coupons/my?userId=' + encodeURIComponent(arg));
    }
    const qs = [];
    if (arg.userId) qs.push('userId=' + encodeURIComponent(arg.userId));
    if (arg.phone) qs.push('phone=' + encodeURIComponent(arg.phone));
    return request('/coupons/my?' + qs.join('&'));
  },
  issueCoupon: (data) => request('/coupons/issue', { method: 'POST', data }),
  redeemCoupon: (data) => request('/coupons/redeem', { method: 'POST', data }),

  // v0.2: 拍照合成 (跟 H5 一致: JSON + base64)
  // 注意: tempFilePath 可能是 wxfile:// (真机) 或 http://tmp/ (IDE 模拟器), 两种都处理
  shootPhoto: async ({ userId, pointId, tempFilePath }) => {
    console.log('[shootPhoto:v2] START, tempFilePath:', tempFilePath);
    const fs = wx.getFileSystemManager();

    // 1. 先把 tempFilePath 复制到本地永久路径 (wxfile:// 是沙箱, http://tmp/ 也要复制)
    const localPath = `${wx.env.USER_DATA_PATH}/shoot_${Date.now()}.jpg`;
    console.log('[shootPhoto:v2] localPath:', localPath);
    try {
      fs.copyFileSync(tempFilePath, localPath);
      console.log('[shootPhoto:v2] copyFile OK');
    } catch (e) {
      console.error('[shootPhoto:v2] copyFile 失败', e);
      throw new Error('复制图片失败: ' + (e.errMsg || e.message));
    }

    // 2. 读 base64 - 改用异步 readFile (新基础库 readFileSync 有问题)
    const base64 = await new Promise((resolve, reject) => {
      fs.readFile({
        filePath: localPath,
        encoding: 'base64',
        success: (res) => resolve(res.data),
        fail: (e) => reject(e)
      });
    });
    console.log('[shootPhoto:v2] base64 长度:', base64.length);
    const photoDataUrl = 'data:image/jpeg;base64,' + base64;
    return new Promise((resolve, reject) => {
      wx.request({
        url: API_BASE + '/ar/shoot',
        method: 'POST',
        header: { 'Content-Type': 'application/json' },
        data: { userId, pointId: pointId || null, photoDataUrl },
        success: (r) => {
          console.log('[shootPhoto:v2] HTTP', r.statusCode, JSON.stringify(r.data).slice(0, 200));
          if (r.statusCode >= 200 && r.statusCode < 300) resolve(r.data);
          else reject(new Error('HTTP ' + r.statusCode + ' ' + (r.data && r.data.message || '')));
        },
        fail: (e) => {
          console.error('[shootPhoto:v2] 网络失败', e);
          reject(new Error('网络失败: ' + (e.errMsg || e.message)));
        }
      });
    });
  },

  // 登录/用户资料接口 (v0.8.0 统一收敛到这里, 移除各页面硬编码 :3005)
  sendSms: (phone) => request('/sms/send', { method: 'POST', data: { phone } }),

  // 微信 code 登录, 后端用 jscode2session 换 openid, 返回用户完整资料
  wxLogin: ({ code, anonymousId, encryptedData, iv }) => request('/auth/wx-login', {
    method: 'POST',
    data: { code, anonymousId, encryptedData, iv }
  }),

  // 手机号 + 验证码登录
  phoneLogin: ({ phone, code, anonymousId }) => request('/auth/login', {
    method: 'POST',
    data: { phone, code, anonymousId }
  }),

  // 更新用户昵称/头像 URL
  updateProfile: (userId, { nickname, avatarUrl }) => request('/users/' + encodeURIComponent(userId) + '/profile', {
    method: 'POST',
    data: { nickname, avatarUrl }
  }),

  // 上传头像 base64, 返回永久 avatarUrl
  uploadAvatar: (userId, avatarDataUrl) => request('/users/' + encodeURIComponent(userId) + '/avatar', {
    method: 'POST',
    data: { avatarDataUrl }
  }),

  aiChat: (data) => request('/ai', { method: 'POST', data })
};
