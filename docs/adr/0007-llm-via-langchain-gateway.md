# ADR-0007：LLM 与 Embedding 经 LangChain 接入内部网关

- 状态：已接受
- 日期：2026-08-28

## 背景

问答与向量化依赖 LLM 与 Embedding 模型。本地 compose 形态不强制离线可用，可使用网络可达的内部模型服务。

## 决策

- LLM（chat）与 Embedding 均使用**内部网关服务**，网关同时提供两类能力。
- api 通过 **LangChain.js** 接入网关，模型名称、baseURL、密钥走环境变量配置。
- LangChain 的使用**限定在 api 的检索与摄取边界内**（retrieval / ingest 模块），禁止泄漏到控制器、DTO 与 web；以 ESLint 边界规则强制。
- 不引入本地模型运行时（如 Ollama）。

## 后果

- 本机无需 GPU/大内存，compose 资源占用可控；代价是依赖网络与网关可用性。
- 切换模型供应商时只需改动 retrieval/ingest 边界内的适配代码与配置。
- 网关协议细节（OpenAI 兼容程度）在实现首个调用时验证，若不兼容需在边界内写适配层。
