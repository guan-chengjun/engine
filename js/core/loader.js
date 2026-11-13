import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// 模型加载：GLTFLoader 在线加载 GLB，带进度回调与失败回调
// ============================================================

/**
 * @param {string} url 模型地址（见 js/config.js 的 modelUrl）
 * @param {object} callbacks
 *   onProgress(percent, loadedBytes, totalBytes)  percent 可能为 null（服务器未给总长度）
 *   onError(message)
 * @returns {Promise<GLTF>}
 */
export function loadModel(url, { onProgress, onError } = {}) {
  const loader = new GLTFLoader();

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      // 加载完成
      (gltf) => resolve(gltf),
      // 加载进度：服务器返回 Content-Length 时 evt.total 才有值
      (evt) => {
        if (!onProgress) return;
        const percent = evt.total > 0 ? Math.round((evt.loaded / evt.total) * 100) : null;
        onProgress(percent, evt.loaded, evt.total);
      },
      // 加载失败（网络错误 / 跨域 / 地址失效都会走到这里）
      (err) => {
        const message =
          (err && err.message) ||
          '网络请求失败，请检查网络连接或模型地址是否仍可访问';
        if (onError) onError(message);
        reject(new Error(message));
      }
    );
  });
}
