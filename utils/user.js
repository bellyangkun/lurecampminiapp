// utils/user.js - 用户身份管理
const USER_KEY = 'campsite_user';

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
}

// v0.7.7: 退出登录 - 清掉 user 缓存, 下次 getUser() 会重新生成 anonymousId
function clearUser() {
  wx.removeStorageSync(USER_KEY);
}

function getUserId() {
  return getUser().userId;
}

module.exports = { getUser, setUser, clearUser, getUserId, USER_KEY };
