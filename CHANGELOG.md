# 更新日誌

本專案所有值得注意的變更都會記錄於此。

本文件格式依循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)，
版本編號遵循[語意化版本](https://semver.org/lang/zh-TW/)。

## [未發布]

## [v0.3.1] - 2026-07-24

### 新增

- 新增 Windows portable File-only 版本；不包含 ROS backend，可載入、檢視與匯出 graph JSON。
- 新增本機 Docker Buildx 建置腳本，可產生 Linux x86_64 與 ARM64 AppImage，無須依賴 GitHub Actions。
- 新增 AppImage 建置、版本命名、單一架構建置及疑難排解文件。

### 變更

- AppImage 打包前會自動準備 Electron 預設圖示。
- 更新繁體中文知識圖譜、專案導覽與 README 截圖。

### 修正

- Linux 缺少 ROS 2 或 bundled backend 時，明確切換為 File-only Mode。
- 版本一致性檢查現在同時支援 LF 與 Windows CRLF 換行。
- Windows portable EXE 改用 ZIP 壓縮，降低啟動時的解壓延遲。
- AppImage 的 `-c`／`--capture` 與 `--headless` 模式會自動停用 GUI、GPU 與軟體光柵化，避免無 X server 的裝置因 Electron 顯示初始化失敗。
- AppImage launcher 可在 x86_64 主機直接修補 ARM64 產物，不需要執行跨架構 AppImage。

## [v0.3.0] - 2026-07-22

### 新增

- 提供安裝腳本，可從 GitHub latest release 安裝目前架構的 Linux AppImage，支援 `--offline` 使用本地 release，並顯示下載進度條。
- 新增 headless web 模式，可在沒有 GUI 的裝置提供 topology 網頁、HTTP API 與 WebSocket stream；支援 `-p`／`--port` 指定監聽 port。
- 新增 `-c`／`--capture`，在 DDS discovery 等待後將完整 topology 寫入 JSON snapshot。
- AppImage 支援 `--install`／`--uninstall` 管理 `node-map` symlink。
- 新增 `-h`／`--help` 與 `-v`／`--version` 指令。

### 修正

- 改善 AppImage `--uninstall` 的錯誤處理，避免預期失敗時產生未處理的 Promise rejection。

## [v0.2.1] - 2026-07-20

### 新增

- 在 Graph View 右下角顯示產品版本。

## [v0.2.0] - 2026-07-20

### 新增

- 探索 ROS 2 節點、主題、服務與動作，並呈現發布、訂閱、客戶端及伺服端關係。
- 提供 FastAPI HTTP／WebSocket 後端，以及快照與伺服器命令列介面。
- 提供 Electron、React、Lumino 與 Cytoscape 組成的互動式拓樸工作台，包含搜尋、篩選、節點詳情及 ROS CLI 指令複製功能。
- 支援系統、自訂 ROS domain ID 的動態切換。
- 支援將完整拓樸匯出為 PNG、JSON 或 Mermaid Markdown。
- 支援拖放或選取 JSON 拓樸檔案，並在無 ROS 環境時以檔案模式啟動。
- 提供 Linux x86_64 AppImage，內含 Python 後端執行環境，並使用主機上的 ROS 2 Jazzy。
- 提供 Understand-Anything 知識圖譜與互動式 Dashboard 的使用說明。

### 變更

- 即時拓樸更新會保留既有圖形的位置與物理狀態。
- JSON 匯出改為保留未經前端篩選的完整拓樸資料，載入後才套用顯示篩選。
- 篩選器顏色與圖形節點顏色保持一致。
- 下載選單改用 PNG、MD、JSON 圖示與提示文字。
- 將功能規格與開發里程碑分別維護於 `.agents/SPEC.md` 和 `.agents/PLAN.md`。
- 產品版本統一使用三段數字，並提供單一指令同步 Frontend、Backend 與鎖檔版本。
- Release 檔名加入作業系統與 CPU 架構資訊。
- Release 檔名的產品版本改用 `v0.2.0` 格式。
- 新增繁體中文 README，並提供中英文文件切換連結。

### 修正

- 修正全螢幕模式下 Explorer 分隔線與內容寬度上限不同步的問題。
- 修正 Details 與 Explorer 側邊欄可拖曳超出合理寬度的問題。
- 改善工作台在不同視窗尺寸下的版面與面板限制。

[未發布]: https://github.com/HowardWhile/ros2-node-map/compare/v0.3.1...HEAD
[v0.3.1]: https://github.com/HowardWhile/ros2-node-map/releases/tag/v0.3.1
[v0.3.0]: https://github.com/HowardWhile/ros2-node-map/releases/tag/v0.3.0
[v0.2.1]: https://github.com/HowardWhile/ros2-node-map/releases/tag/v0.2.1
[v0.2.0]: https://github.com/HowardWhile/ros2-node-map/releases/tag/v0.2.0
