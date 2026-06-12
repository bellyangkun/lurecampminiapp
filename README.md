# 露营地小程序 (lurecampminiapp)

> 微信小程序版, AppID: `wx038540196a10ea82`
>
> **关联 H5**: https://lurecamp1.xiabebe.cn
>
> **后端共享**: Node.js API (跟 H5 同一份 server.js, 零改动)

## 状态: v0.1 (PoC)

- 主页: 地图 (腾讯地图) + 目标下拉 + 类型 chip + 拍照 fab
- 拍照 fab: 直接 `wx.chooseMedia` → `wx.uploadFile` → `/api/ar/shoot` 合成 → `/api/checkins` 提交
- 打卡 tab: 拉 `/api/checkins/stats` 渲染印章 + 最近打卡缩略图 (点开 `wx.previewImage`)
- 我的 tab: 用户信息 + 统计 + 登录入口
- 优惠/预约/AI: 占位页 (v0.2 填)

## 目录

```
lurecampminiapp/
├── app.js / app.json / app.wxss
├── sitemap.json / project.config.json
├── pages/
│   ├── index/      # 主页 (地图 + fab)
│   ├── checkin/    # 打卡记录
│   ├── coupons/    # 优惠券 (v0.2)
│   ├── booking/    # 预约 (v0.2)
│   ├── ai/         # AI 客服 (v0.2)
│   ├── me/         # 我的
│   └── login/      # 登录
└── utils/
    ├── api.js      # 后端 API 封装 (wx.request)
    ├── user.js     # 用户身份 (storage)
    └── coords.js   # WGS-84 ↔ GCJ-02
```

## 开发

1. 微信开发者工具打开本目录
2. 顶部菜单 → 详情 → 本地设置 → 勾选 "不校验合法域名" (开发期)
3. 真机调试需要后端配 `request合法域名` (用户/管理员)

## 待办

- [ ] 优惠券页 (3 tab: 可领/我的/记录)
- [ ] 预约页 (选活动/时间/人数)
- [ ] AI 客服页 (跟 H5 ai.js 一样调 /api/ai)
- [ ] 后端实现 `/api/auth/wx-login` (code2session)
- [ ] 微信小程序后台配 `request合法域名: lurecamp1.xiabebe.cn`
- [ ] tabBar 图标 (目前用纯文字, 实际发布需要 5 张 81x81 PNG)
- [ ] 真机调试: iOS + Android 各一次

## 部署

1. 微信开发者工具 → 上传 → 填版本号 + 项目备注
2. 微信公众平台 (mp.weixin.qq.com) → 版本管理 → 提交审核
3. 类目: 旅游 / 工具
4. 审核通过后 → 发布
