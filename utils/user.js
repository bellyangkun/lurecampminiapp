// utils/user.js - 用户身份管理
const USER_KEY = 'campsite_user';
const OPENID_KEY = 'campsite_openid';        // 设备级稳定 openid (退出登录不清)
const USERID_KEY = 'campsite_userid';        // 设备级稳定 userId (退出登录不清)

function getUser() {
  let u = wx.getStorageSync(USER_KEY);
  if (!u) {
    // 临时身份 (未登录用 anonymousId, 跟 H5 一致)
    u = {
      userId: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      phone: '',
      nickname: '游客',
      loggedIn: false
    };
    wx.setStorageSync(USER_KEY, u);
  }
  return u;
}

function setUser(u) {
  wx.setStorageSync(USER_KEY, u);
  // v0.7.14: 同步缓存 userId 到设备级 storage, 退出登录也能用
  if (u && u.userId) wx.setStorageSync(USERID_KEY, u.userId);
}

function clearUser() {
  // v0.7.14: 清 user 缓存, 但保留 openid 和 userId 稳定派生
  // 重新登录时, 用 device-stable userId 当 anonymousId, 让后端能找回同一 user
  wx.removeStorageSync(USER_KEY);
}

// v0.7.14: 拿稳定 openid (设备级, 永不删)
function getStableOpenid() {
  return wx.getStorageSync(OPENID_KEY) || '';
}

function setStableOpenid(openid) {
  if (openid) wx.setStorageSync(OPENID_KEY, openid);
}

// v0.7.14: 拿稳定 userId (设备级, 永不删, 用于后端迁移 anonymousId 找同一 user)
function getStableUserId() {
  return wx.getStorageSync(USERID_KEY) || '';
}

function setStableUserId(userId) {
  if (userId) wx.setStorageSync(USERID_KEY, userId);
}

function getUserId() {
  return getUser().userId;
}

module.exports = {
  getUser, setUser, clearUser, getUserId, USER_KEY,
  getStableOpenid, setStableOpenid, OPENID_KEY,
  getStableUserId, setStableUserId, USERID_KEY
};
