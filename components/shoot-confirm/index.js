// components/shoot-confirm/index.js
Component({
  properties: {
    visible: { type: Boolean, value: false },
    tempFilePath: { type: String, value: '' },
    pointName: { type: String, value: '主动拍照打卡' },
    isOther: { type: Boolean, value: false },
    uploading: { type: Boolean, value: false }
  },

  methods: {
    onCloseTap() {
      if (this.data.uploading) return;
      this.triggerEvent('close');
    },

    onSubmitTap() {
      this.triggerEvent('submit', { tempFilePath: this.data.tempFilePath });
    },

    onRetakeTap() {
      if (this.data.uploading) return;
      this.triggerEvent('retake');
    },

    // 防止冒泡到底图
    noop() {}
  }
});
