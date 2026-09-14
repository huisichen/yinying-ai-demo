# 银映 RAG API

接口：`POST /api/generate`

请求示例：

```json
{
  "topic": "快递包裹破损理赔诈骗",
  "audience": "70—79岁 · 中高龄银发",
  "duration": "60秒",
  "actors": "2人",
  "location": "社区服务站",
  "goal": "风险提醒"
}
```

处理链路：需求结构化 → 混合检索 → 证据上下文 → 模型生成 → SilverFit 规则评分 → 结构化方案。

服务端环境变量：

```text
LLM_API_KEY=
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
```

接口兼容 OpenAI 风格的 `POST {LLM_BASE_URL}/chat/completions`。当前默认使用 DeepSeek 的 `deepseek-chat`；只要在服务端设置 `LLM_API_KEY` 即可调用，也可通过另外两个变量覆盖平台和模型。密钥未配置或远端调用失败时，接口仍会运行真实检索并返回确定性的演示方案，`trace.mode` 为 `local-rag` 或 `local-rag-fallback`。密钥不能写入 `docs/`、浏览器代码或 Git 仓库。

GitHub Pages 前端通过 `docs/config.js` 的 `window.YINYING_API_URL` 指向已部署的后端。GitHub Pages 只托管静态文件，无法安全保存模型密钥。

