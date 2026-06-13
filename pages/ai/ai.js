// pages/ai/ai.js - AI 客服
const { aiChat } = require('../../utils/api.js');
const { requireLogin } = require('../../utils/user.js');
const FAQS = require('../../utils/ai-faqs.js');

Page({
  data: {
    messages: [],   // { role: 'user'|'bot', text, ts }
    inputText: '',
    sending: false,
    scrollIntoView: ''
  },

  onLoad() {
    this.setData({
      messages: [{
        role: 'bot',
        text: '👋 你好, 我是鹿营 AI 客服小悦, 有什么可以帮你的吗?\n\n试试问我: 营业时间 / 地址 / 预约 / 天幕烧烤 / 皮划艇',
        ts: Date.now()
      }],
      scrollIntoView: 'msg-' + Date.now()
    });
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  noop() {},

  // 点建议问题
  onSuggestTap(e) {
    const q = e.currentTarget.dataset.q;
    this.setData({ inputText: q });
    this.sendMessage();
  },

  async sendMessage() {
    // v0.7.17: AI 对话必须登录
    if (!requireLogin('AI 客服对话')) return;
    const text = (this.data.inputText || '').trim();
    if (!text || this.data.sending) return;
    // 用户消息
    const userMsg = { role: 'user', text, ts: Date.now() };
    this.setData({
      messages: [...this.data.messages, userMsg],
      inputText: '',
      sending: true,
      scrollIntoView: 'msg-' + Date.now()
    });
    try {
      const prompt = `用户问题: ${text}`;
      const j = await aiChat({ prompt, faqs: FAQS });
      const answer = (j.answer || j.message || '服务暂时不可用, 请联系前台 021-59978686');
      this.setData({
        messages: [...this.data.messages, { role: 'bot', text: answer, ts: Date.now() }],
        sending: false,
        scrollIntoView: 'msg-' + Date.now()
      });
    } catch (e) {
      this.setData({
        messages: [...this.data.messages, { role: 'bot', text: '网络错误: ' + (e.errMsg || e.message), ts: Date.now() }],
        sending: false,
        scrollIntoView: 'msg-' + Date.now()
      });
    }
  }
});
