// pages/login/login.js - v0.7.8 微信一键登录
// 优先: 微信一键登录 (open-type=getPhoneNumber 真机拿手机号, 或 wx.login 拿 code 模拟器/开发期)
// 备选: 手机号+验证码 (开发模式)
const { sendSms } = require('../../utils/api.js');
const { setUser } = require('../../utils/user.js');
const app = getApp();

Page({
  data: {
    phone: '',
    code: '',
    sending: false,
    logging: false,
    counting: 0,
    devCode: '',
    timer: null,
    agreed: false,
    showPhoneLogin: false   // 折叠手机号表单
  },

  onUnload() {
    if (this.data.timer) clearInterval(this.data.timer);
  },

  onAgreeToggle() {
    this.setData({ agreed: !this.data.agreed });
  },

  onAgreementTap() {
    wx.navigateTo({ url: '/pages/agreement/agreement' });
  },

  onTogglePhoneLogin() {
    this.setData({ showPhoneLogin: !this.data.showPhoneLogin });
  },

  onPhoneInput(e) { this.setData({ phone: e.detail.value }); },
  onCodeInput(e) { this.setData({ code: e.detail.value }); },

  async onSendCode() {
    if (!/^1[3-9]\d{9}$/.test(this.data.phone)) {
      wx.showToast({ title: '手机号格式不对', icon: 'none' });
      return;
    }
    this.setData({ sending: true });
    try {
      const j = await sendSms(this.data.phone);
      this.setData({ devCode: (j.data && j.data.code) || '', sending: false, counting: 60 });
      if (j.data && j.data.code) {
        wx.showModal({
          title: '验证码 (开发模式)',
          content: '本次验证码: ' + j.data.code,
          showCancel: false
        });
      } else {
        wx.showToast({ title: '已发送', icon: 'success' });
      }
      if (this.data.timer) clearInterval(this.data.timer);
      this.data.timer = setInterval(() => {
        if (this.data.counting <= 1) {
          clearInterval(this.data.timer);
          this.setData({ counting: 0 });
          return;
        }
        this.setData({ counting: this.data.counting - 1 });
      }, 1000);
    } catch (e) {
      this.setData({ sending: false });
      wx.showToast({ title: '发送失败', icon: 'none' });
    }
  },

  // v0.7.11: 微信一键登录 - 稳定 openid
  // 关键修复: openid 必须稳定, 不能每次用 code 派生
  // 真机: 第一次登录后, 后端会从 encryptedData 解密拿真实 openid, 缓存到 storage
  // 模拟器: 用一个**本地随机生成的稳定 dev openid** (写 storage), 永不删 (除非清缓存)
  // 退出登录**不清** openid, 重新登录时用同一个 openid → 后端找回同一 user → nickname 不变
  async onWxLoginTap() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先勾选同意用户协议', icon: 'none' });
      return;
    }
    this.setData({ logging: true });
    try {
      // 1. 拿稳定 openid (优先 storage 缓存)
      let stableOpenid = wx.getStorageSync('campsite_openid');
      if (!stableOpenid) {
        // 第一次登录, 生成稳定 dev openid (写 storage, 永不删)
        stableOpenid = 'dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        wx.setStorageSync('campsite_openid', stableOpenid);
      }
      // 2. 拿 wx.login code (即使 code 每次变, 我们用 stableOpenid 作 openid)
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({ success: resolve, fail: reject });
      });
      const code = loginRes.code;
      if (!code) {
        throw new Error('wx.login 拿不到 code');
      }
      // 3. 用 stableOpenid 作 openid 登录 (后端按 openid 找/建 user)
      await this.doLogin({ code, openid: stableOpenid });
    } catch (e) {
      console.error('[WxLogin] 失败', e);
      this.setData({ logging: false });
      wx.showToast({ title: '登录失败: ' + (e.message || '未知'), icon: 'none' });
    }
  },

  // 真机: open-type=getPhoneNumber 拿到加密手机号后, 用这个登录
  async onWxGetPhone(e) {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先勾选同意用户协议', icon: 'none' });
      return;
    }
    if (!e.detail.encryptedData) {
      // 用户拒绝授权手机号, 走 code fallback
      console.log('[WxGetPhone] 用户拒绝手机号, 走 code fallback');
      return;
    }
    this.setData({ logging: true });
    try {
      const { encryptedData, iv } = e.detail;
      const code = app.globalData.wxCode || await new Promise((resolve, reject) => {
        wx.login({ success: r => resolve(r.code), fail: reject });
      });
      // v0.7.11: 用稳定 openid (从 storage 拿, 没有生成一个)
      let stableOpenid = wx.getStorageSync('campsite_openid');
      if (!stableOpenid) {
        stableOpenid = 'dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        wx.setStorageSync('campsite_openid', stableOpenid);
      }
      // 把 encryptedData/iv/code/stableOpenid 都发到后端
      // 后端解密 encryptedData 拿真 phoneNumber, 用 openid 找/建 user
      // 不再传 phone 字段 (用后端解密结果)
      await this.doLogin({ code, openid: stableOpenid, encryptedData, iv });
    } catch (err) {
      console.error('[WxGetPhone] 失败', err);
      this.setData({ logging: false });
      wx.showToast({ title: '手机号授权失败', icon: 'none' });
    }
  },

  // v0.7.10: 统一登录后处理 - 写 user storage + 跳主页
  // 关键: 用户 ID/nickname/avatarUrl/phone 全部以**后端返回为准** (后端是 source of truth)
  // 这样: 退出登录 → 清 storage → 重新登录 → 后端用 openid 找回同一个 user → 信息不丢
  async doLogin({ code, phone, openid, encryptedData, iv }) {
    try {
      const oldUser = app.globalData.user || {};
      let realPhone = phone || oldUser.phone || '';
      let realOpenid = openid || oldUser.openid || '';
      let serverUser = null;  // 后端返回的 user (有 id/nickname/avatarUrl/phone/checkinCount/createdAt)

      // 真机 + 模拟器: 走 /api/auth/wx-login, 后端按 openid 找/建用户
      if (code) {
        try {
          const j = await new Promise((resolve, reject) => {
            wx.request({
              url: 'https://lurecamp1.xiabebe.cn:3005/api/auth/wx-login',
              method: 'POST',
              data: { code, encryptedData, iv, anonymousId: oldUser.userId },
              success: r => resolve(r.data),
              fail: reject
            });
          });
          if (j && j.code === 0 && j.user) {
            serverUser = j.user;
            // 后端返的 phone 是脱敏的, 但 j.phone (顶层) 才是真值
            realPhone = j.phone || j.user.phone || realPhone;
            realOpenid = j.user.openid || realOpenid;
          }
        } catch (apiErr) {
          console.warn('[doLogin] /api/auth/wx-login 失败 (开发期忽略), 用 dev openid fallback', apiErr);
          // fallback: dev_openid 本地派生 (用于开发期没接通后端时)
          if (!realOpenid) realOpenid = 'dev_' + code.slice(0, 12);
        }
      }

      // 手机号登录分支: 调 /api/auth/login 校验验证码 + 找/建用户
      if (phone && !code) {
        // (手机号登录仍走原 sendSms 验证码, 此分支保留供旧流程)
        // 没接 /api/auth/login 时, 本地生成 dev user
      }

      // 构造 user 对象 - 优先用后端 serverUser 字段
      const newUser = {
        userId: (serverUser && serverUser.id) || oldUser.userId || ('u_' + realOpenid.slice(0, 12)),
        phone: realPhone,
        nickname: (serverUser && serverUser.nickname) || oldUser.nickname || '微信用户',
        avatarUrl: (serverUser && serverUser.avatarUrl) || oldUser.avatarUrl || '',
        openid: realOpenid,
        checkinCount: (serverUser && serverUser.checkinCount) || oldUser.checkinCount || 0,
        createdAt: (serverUser && serverUser.createdAt) || oldUser.createdAt || Date.now(),
        loggedIn: true,
        loggedAt: Date.now()
      };

      // 写 storage + globalData
      setUser(newUser);
      app.globalData.user = newUser;
      // v0.7.11: 同步更新 stable openid 缓存 (后端返真 openid 时, 用真的覆盖 dev openid)
      if (realOpenid) {
        wx.setStorageSync('campsite_openid', realOpenid);
      }
      // 同步 coupon 聚合 phone (v0.7.3 跨设备)
      // issue 接口在下次领券时自动合并 anonymousId 老券
      this.setData({ logging: false });
      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/me/me' });
      }, 800);
    } catch (e) {
      this.setData({ logging: false });
      throw e;
    }
  },

  // 折叠区: 手机号登录 (开发模式)
  async onPhoneLogin() {
    const { phone, code, agreed } = this.data;
    if (!agreed) {
      wx.showToast({ title: '请先勾选同意用户协议', icon: 'none' });
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请填正确手机号', icon: 'none' });
      return;
    }
    if (!code || code.length < 4) {
      wx.showToast({ title: '请填验证码', icon: 'none' });
      return;
    }
    this.setData({ logging: true });
    try {
      const oldUser = app.globalData.user || {};
      const j = await new Promise((resolve, reject) => {
        wx.request({
          url: 'https://lurecamp1.xiabebe.cn:3005/api/auth/login',
          method: 'POST',
          data: { phone, code, anonymousId: oldUser.userId },
          success: r => resolve(r.data),
          fail: reject
        });
      });
      if (j && j.code === 0 && j.user) {
        // v0.7.10: 用后端返回的 user.id/nickname/avatarUrl/phone (source of truth)
        const newUser = {
          userId: j.user.id,
          phone: j.phone || j.user.phone || phone,
          nickname: j.user.nickname,
          avatarUrl: j.user.avatarUrl || '',
          openid: j.openid || j.user.openid || '',
          checkinCount: j.user.checkinCount || 0,
          createdAt: j.user.createdAt || Date.now(),
          loggedIn: true,
          loggedAt: Date.now()
        };
        setUser(newUser);
        app.globalData.user = newUser;
        this.setData({ logging: false });
        wx.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(() => wx.switchTab({ url: '/pages/me/me' }), 800);
      } else {
        this.setData({ logging: false });
        wx.showToast({ title: j.message || '登录失败', icon: 'none' });
      }
    } catch (e) {
      this.setData({ logging: false });
      wx.showToast({ title: '登录失败', icon: 'none' });
    }
  }
});
