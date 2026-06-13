// utils/user.js - 用户身份管理
const USER_KEY = 'campsite_user';
const OPENID_KEY = 'campsite_openid';        // 设备级稳定 openid (退出登录不清)
const USERID_KEY = 'campsite_userid';        // 设备级稳定 userId (退出登录不清)

function getUser() {
  let u = wx.getStorageSync(USER_KEY);
  if (!u) {
    // 临时身份 (未登录用 anonymousId, 跟 H5 一致)
    // v0.7.16: 优先用 device-stable userId (保证 ID 不变), 没有才生成新 anonymousId
    const stableId = wx.getStorageSync(USERID_KEY);
    u = {
      userId: stableId || ('u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
      phone: '',
      nickname: '游客',
      loggedIn: false
    };
    wx.setStorageSync(USER_KEY, u);
    // 同步回 stable storage (首次生成)
    if (!stableId) wx.setStorageSync(USERID_KEY, u.userId);
  }
  return u;
}

function setUser(u) {
  if (!u) return;
  wx.setStorageSync(USER_KEY, u);
  // v0.7.16: 同步缓存 userId 到设备级 storage, 退出登录也能用
  if (u.userId) wx.setStorageSync(USERID_KEY, u.userId);
}

function clearUser() {
  // v0.7.16: 清 user 缓存, 但保留 openid 和 userId 稳定派生
  // 重新登录时, 用 device-stable userId 当 anonymousId, 让后端能找回同一 user
  wx.removeStorageSync(USER_KEY);
  // 不重新生成 anonymousId; 下次 getUser() 会用 stableId
}

// v0.7.16: 拿稳定 openid (设备级, 永不删)
function getStableOpenid() {
  return wx.getStorageSync(OPENID_KEY) || '';
}

function setStableOpenid(openid) {
  if (openid) wx.setStorageSync(OPENID_KEY, openid);
}

// v0.7.16: 拿稳定 userId (设备级, 永不删)
function getStableUserId() {
  return wx.getStorageSync(USERID_KEY) || '';
}

function setStableUserId(userId) {
  if (userId) wx.setStorageSync(USERID_KEY, userId);
}

// v0.7.16: getUserId 永远优先用 stable storage 的 userId (保证 ID 不变)
function getUserId() {
  const stable = wx.getStorageSync(USERID_KEY);
  if (stable) return stable;
  return getUser().userId;
}

// v0.8.0: 判断是否已登录
function isLoggedIn() {
  const u = getUser();
  return !!(u && u.loggedIn);
}

// v0.7.17: 业务动作前检查登录态 - 未登录弹 modal 提示, 跳登录页
// 返回 true=已登录可继续, false=未登录已拦截
// actionLabel: 业务名, e.g. '拍照打卡' / '领取优惠券' / '提交预约'
function requireLogin(actionLabel) {
  const u = getUser();
  if (u.loggedIn) return true;
  wx.showModal({
    title: '需要登录',
    content: `${actionLabel || '该操作'} 需要先登录才能继续。\n\n是否前往登录?`,
    confirmText: '去登录',
    cancelText: '取消',
    success: (res) => {
      if (res.confirm) {
        wx.navigateTo({ url: '/pages/login/login' });
      }
    }
  });
  return false;
}

// v0.8.0: 未登录时弹窗并执行 callback(是否已登录)
// 用于页面 onShow 等需要先判断再决定是否继续的场景
function withLogin(actionLabel, callback) {
  const ok = requireLogin(actionLabel);
  if (typeof callback === 'function') callback(ok);
  return ok;
}

module.exports = {
  getUser, setUser, clearUser, getUserId, USER_KEY,
  getStableOpenid, setStableOpenid, OPENID_KEY,
  getStableUserId, setStableUserId, USERID_KEY,
  isLoggedIn, requireLogin, withLogin
};
