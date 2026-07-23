# ros2-node-map

> [English](README.md)

[![最新版本](https://img.shields.io/github/v/release/HowardWhile/ros2-node-map?display_name=tag&sort=semver)](https://github.com/HowardWhile/ros2-node-map/releases/latest)
[![授權條款](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/HowardWhile/ros2-node-map?style=social)](https://github.com/HowardWhile/ros2-node-map/stargazers)

**一個互動式 ROS 2 node 檢視器，讓 node、topic、service 與 action 的關係，比 `rqt_graph` 的呈現方式更容易理解。**

![ros2-node-map 顯示 ROS node、topic、service 與 action 的互動式拓樸](./pic/README/image-20260715015056371.png)

[觀看示範影片](./pic/README/ros2-node-map.mp4) · [下載 release](https://github.com/HowardWhile/ros2-node-map/releases/latest) · [閱讀文件](docs/getting-started.md)

## 為什麼需要 ros2-node-map？

大型 ROS 2 系統同時包含 publisher、subscriber、service 與 action；若全部擠在
一張圖上，很難快速判斷系統拓樸。`ros2-node-map` 提供可探索的工作區：

- 將 **node、topic、service 與 action** 分別呈現在 graph 中。
- 可搜尋、依 namespace 與類型篩選、選取項目並查看關聯。
- 在有 ROS 2 Jazzy 的 Linux 主機進行即時 discovery；沒有 ROS 時也可直接開啟 graph JSON snapshot。
- 可匯出完整 **JSON**、目前畫面的 **PNG**，或可見拓樸的 **Mermaid Markdown**。

## 快速開始

### 在 Linux 檢視即時 ROS 2 graph

Linux x86-64 或 ARM64 可安裝最新 AppImage 後直接啟動：

```bash
wget -qO- https://raw.githubusercontent.com/HowardWhile/ros2-node-map/develop/scripts/install-node-map.sh | bash
node-map
```

即時 discovery 需要主機已有 ROS 2 Jazzy。若 ROS 不可用，app 會進入
**File-only Mode**，仍可檢視已匯出的 snapshot。

### 在任何環境開啟 snapshot

啟動 app 後選擇 **Open JSON**，或將 graph JSON 檔拖放到視窗中。File-only Mode
保留 graph 探索、篩選、詳細資訊與匯出功能，不需要 ROS discovery；Windows 固定使用此模式。

[Getting started](docs/getting-started.md) 說明 release、離線安裝、backend 與 Windows 建置細節。

## 可以解決什麼問題？

| 需求 | ros2-node-map 提供的能力 |
| --- | --- |
| 理解資料流 | 以 topic node 呈現有方向的 publisher／subscriber 關係 |
| 檢查 RPC 與任務 | 顯示 service、action 的 client／server 關係 |
| 降低雜訊 | 搜尋及 namespace、類型、系統資源、action internal 篩選 |
| 分享拓樸 | 穩定的 graph JSON snapshot 與 Mermaid Markdown 匯出 |
| 不在 robot 上工作 | 無 ROS 或 Windows 主機也可開啟 snapshot |

## 選擇使用模式

| 模式 | 適用情境 | 執行內容 |
| --- | --- | --- |
| Live mode | 有 ROS 2 Jazzy 的 Linux 主機 | bundled Python backend discovery 並串流 ROS graph |
| File-only Mode | Windows、沒有 ROS 的 Linux，或離線 review | 只執行 Electron viewer，載入 graph JSON snapshot |
| Headless / capture | 沒有桌面環境的 Linux ROS 主機 | 以 HTTP 提供 viewer，或輸出一次 graph JSON snapshot |

## 文件

- [Getting started](docs/getting-started.md) — 安裝、啟動、File-only Mode 與 snapshot 流程
- [架構](docs/architecture.md) — backend/frontend 邊界、HTTP API、WebSocket 與 runtime capability
- [開發與封裝](docs/development.md) — 本機環境、backend CLI、測試與 release build
- [Graph JSON schema](docs/graph-json-schema.md) — 穩定的 snapshot 格式
- [測試](docs/testing.md) — 自動與手動驗證
- [更新日誌](CHANGELOG.md) · [開發路線圖](docs/roadmap.md)

## 協助改善

如果 `ros2-node-map` 幫助你理解 ROS 2 系統，歡迎 [Star 專案](https://github.com/HowardWhile/ros2-node-map/stargazers)，
讓更多 ROS 開發者能找到它。Bug report 與具體工作流程建議可透過
[issue tracker](https://github.com/HowardWhile/ros2-node-map/issues) 提出。

## 授權

[MIT](LICENSE)
