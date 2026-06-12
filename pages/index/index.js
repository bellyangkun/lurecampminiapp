// pages/index/index.js - 主页: 地图 + 目标 + 工具栏 + 拍照 fab
const { wgs84ToGcj02, haversine } = require('../../utils/coords.js');
const { getPoints, submitCheckin, shootPhoto } = require('../../utils/api.js');
const { getUserId } = require('../../utils/user.js');
const app = getApp();

const TYPE_META = {
  entrance:  { icon: '🚪', name: '入口' },
  activity:  { icon: '⛺', name: '活动' },
  service:   { icon: '🛒', name: '服务' },
  flash:     { icon: '⚡', name: '快闪' },
  restaurant:{ icon: '🍽️', name: '餐厅' },
  toilet:    { icon: '🚻', name: '卫生间' },
  hotel:     { icon: '🏨', name: '酒店' },
  teahouse:  { icon: '🍵', name: '茶' },
  other:     { icon: '📍', name: '其他' }
};

Page({
  data: {
    points: [],
    markers: [],
    markerIdToPointId: {},  // v0.1: marker id (number) → POI id (string) 映射
    polyline: [],
    selectedDestId: '',
    selectedDestIdx: null,
    selectedDestName: '',
    typeFilter: 'all',
    types: [{ key: 'all', label: '全部' }, ...Object.entries(TYPE_META).map(([k, v]) => ({ key: k, label: v.icon + ' ' + v.name }))],
    userLat: null,
    userLng: null,
    distance: null,
    walkMins: null,
    endNavBtnShown: false,
    loading: true,
    // v0.2: 拍照确认面板
    shootConfirm: { visible: false, tempFilePath: '', point: null, isOther: false, uploading: false }
  },

  onLoad() {
    this.loadPoints();
  },

  onShow() {
    // 每次显示刷一次 (从其他 tab 回来时)
    if (app.globalData.points && app.globalData.points.length) {
      this.setData({ points: app.globalData.points });
      this.refreshMarkers();
    }
  },

  async loadPoints() {
    try {
      // v0.1: 兜底 timeout, 避免 request 域名没配时一直挂住
      const j = await Promise.race([
        getPoints(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))
      ]);
      const points = (j.data && j.data.points) || (Array.isArray(j) ? j : []);
      app.globalData.points = points;
      this.setData({ points, loading: false });
      this.refreshMarkers();
    } catch (e) {
      console.error('[Index] 拉 POI 失败', e);
      this.setData({ loading: false });
      wx.showModal({
        title: 'POI 加载失败',
        content: '可能原因:\n1. 后端没配 request 合法域名 (开发期勾选"不校验合法域名")\n2. lurecamp1.xiabebe.cn 后端未通',
        showCancel: false
      });
    }
  },

  // WGS-84 → GCJ-02 (腾讯地图坐标系)
  refreshMarkers() {
    const { points, typeFilter, selectedDestId } = this.data;
    const filtered = points.filter(p => {
      if (typeFilter !== 'all' && p.type !== typeFilter) return false;
      if (selectedDestId && p.id !== selectedDestId) return false;
      return true;
    });
    // v0.1: marker id 必须是 number, 用 POI 在 points 全集中的下标 (保证稳定, 过滤也不影响)
    const pointIdToMarkerId = {};
    const markerIdToPointId = {};
    points.forEach((p, i) => {
      pointIdToMarkerId[p.id] = i + 1;
      markerIdToPointId[i + 1] = p.id;
    });
    const markers = filtered.map(p => {
      const [gLng, gLat] = wgs84ToGcj02(p.lng, p.lat);
      return {
        id: pointIdToMarkerId[p.id],
        latitude: gLat,
        longitude: gLng,
        title: p.name,
        width: 32,
        height: 32,
        callout: {
          content: p.name,
          color: '#fff',
          fontSize: 11,
          borderRadius: 4,
          bgColor: '#2e7d32',
          padding: 4,
          display: 'BYCLICK'
        }
      };
    });
    this.setData({ markers, markerIdToPointId });
  },

  onTypeChipTap(e) {
    const t = e.currentTarget.dataset.type;
    this.setData({ typeFilter: t });
    this.refreshMarkers();
  },

  onDestChange(e) {
    // v0.1: picker 拿到的 e.detail.value 是 points 数组下标 (不是 POI id)
    const idx = e.detail.value;
    const point = this.data.points[idx];
    if (!point) return;
    this.setData({
      selectedDestIdx: idx,
      selectedDestId: point.id,
      selectedDestName: point.name
    });
    this.refreshMarkers();
    this.drawRoute();
  },

  drawRoute() {
    const dest = this.data.points.find(p => p.id === this.data.selectedDestId);
    const uLat = app.globalData.userLat, uLng = app.globalData.userLng;
    if (!dest) return;
    if (uLat != null && uLng != null) {
      const [dGjLng, dGjLat] = wgs84ToGcj02(dest.lng, dest.lat);
      this.setData({
        polyline: [{ points: [{ latitude: uLat, longitude: uLng }, { latitude: dGjLat, longitude: dGjLng }], color: '#2196F3', width: 4, dottedLine: true }],
        distance: Math.round(haversine(uLat, uLng, dest.lat, dest.lng)),
        walkMins: Math.round(haversine(uLat, uLng, dest.lat, dest.lng) / 80),
        endNavBtnShown: true
      });
    } else {
      this.setData({ endNavBtnShown: true, distance: null, walkMins: null });
    }
  },

  clearRoute() {
    this.setData({ polyline: [], distance: null, walkMins: null, endNavBtnShown: false });
  },

  onEndNavTap() {
    this.setData({
      selectedDestId: '',
      selectedDestIdx: null,
      selectedDestName: ''
    });
    this.refreshMarkers();
    this.clearRoute();
    wx.showToast({ title: '已结束导航', icon: 'success' });
  },

  onLocateTap() {
    if (app.globalData.userLat == null) {
      wx.showToast({ title: '定位中, 请稍候', icon: 'none' });
      return;
    }
    this.setData({
      latitude: app.globalData.userLat,
      longitude: app.globalData.userLng,
      scale: 16
    });
  },

  onWalkNavTap() {
    this.openNav('walk');
  },

  onDriveNavTap() {
    this.openNav('drive');
  },

  // v0.1: 唤起导航 (步行 / 驾车)
  // 优先用 wx.openLocation (微信内置地图, 跨 iOS/Android)
  // 失败时给用户看坐标, 让他手动复制到地图 App
  openNav(mode) {
    const dest = this.data.points.find(p => p.id === this.data.selectedDestId);
    if (!dest) { wx.showToast({ title: '请先选目标', icon: 'none' }); return; }
    const [gLng, gLat] = wgs84ToGcj02(dest.lng, dest.lat);
    const modeText = mode === 'drive' ? '驾车' : '步行';
    wx.openLocation({
      latitude: gLat,
      longitude: gLng,
      name: dest.name,
      address: `${dest.name} (${gLat.toFixed(5)}, ${gLng.toFixed(5)})`,
      scale: 17
    });
  },

  onShootFabTap() {
    // 主动拍照打卡 (跳相机, 拍完弹确认面板)
    const uLat = app.globalData.userLat, uLng = app.globalData.userLng;
    if (uLat == null || uLng == null) {
      wx.showToast({ title: '需要先开启定位', icon: 'none' });
      return;
    }
    // 找 200m 内最近 POI
    let nearPoint = null;
    for (const p of this.data.points) {
      const d = haversine(uLat, uLng, p.lat, p.lng);
      if (d <= 200 && (!nearPoint || d < nearPoint._d)) nearPoint = { ...p, _d: d };
    }
    this.openCamera(nearPoint, uLat, uLng);
  },

  openCamera(point, uLat, uLng) {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      camera: 'back',
      success: (res) => {
        const file = res.tempFiles[0];
        // 弹确认面板, 不直接上传
        this.setData({
          shootConfirm: {
            visible: true,
            tempFilePath: file.tempFilePath,
            point: point,
            isOther: !point,
            uploading: false
          }
        });
        // 存一下坐标给提交时用
        this._shootUCoords = { uLat, uLng };
      },
      fail: (e) => {
        console.warn('[Shoot] 取消拍照', e);
      }
    });
  },

  // 确认面板: 关闭 / 重拍 / 提交
  onShootClose() {
    this.setData({ 'shootConfirm.visible': false, 'shootConfirm.tempFilePath': '' });
  },

  onShootRetake() {
    const { uLat, uLng } = this._shootUCoords || {};
    const point = this.data.shootConfirm.point;
    this.setData({ 'shootConfirm.visible': false, 'shootConfirm.tempFilePath': '' });
    this.openCamera(point, uLat, uLng);
  },

  async onShootSubmit() {
    const { tempFilePath, point, isOther } = this.data.shootConfirm;
    const { uLat, uLng } = this._shootUCoords || {};
    this.setData({ 'shootConfirm.uploading': true });
    wx.showLoading({ title: '上传中...' });
    try {
      // v0.2: 走 utils/api.js shootPhoto (跟 H5 一致: JSON + base64)
      const shootRes = await shootPhoto({
        userId: getUserId(),
        pointId: point ? point.id : null,
        tempFilePath
      });
      if (shootRes.code !== 0) throw new Error(shootRes.message || '拍照合成失败');
      const shotUrl = shootRes.data && shootRes.data.url;
      await submitCheckin({
        userId: getUserId(),
        pointId: point ? point.id : null,
        pointName: point ? point.name : '主动拍照打卡',
        userLat: uLat,
        userLng: uLng,
        dwellTime: 0,
        auto: false,
        kind: point ? 'normal' : 'other',
        shotUrl: shotUrl
      });
      wx.hideLoading();
      this.setData({ 'shootConfirm.visible': false, 'shootConfirm.uploading': false });
      wx.showToast({ title: point ? '打卡成功 +1 印章' : '主动拍照已记录', icon: 'success' });
    } catch (e) {
      wx.hideLoading();
      this.setData({ 'shootConfirm.uploading': false });
      const msg = (e && e.message) || '提交失败';
      wx.showToast({ title: msg.length > 12 ? '提交失败' : msg, icon: 'none' });
      console.error('[ShootSubmit] 失败', e);
    }
  },

  onMarkerTap(e) {
    // v0.1: marker.id → POI.id 映射, 联动下拉选目标 + 画路线
    const markerId = e.detail.markerId;
    const pointId = this.data.markerIdToPointId[markerId];
    if (!pointId) return;
    const idx = this.data.points.findIndex(p => p.id === pointId);
    const point = this.data.points[idx];
    this.setData({
      selectedDestIdx: idx,
      selectedDestId: pointId,
      selectedDestName: point ? point.name : '已选'
    });
    this.refreshMarkers();
    this.drawRoute();
  }
});
