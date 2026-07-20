# 更新日誌

本專案所有值得注意的變更都會記錄於此。

本文件格式依循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)，
版本編號遵循[語意化版本](https://semver.org/lang/zh-TW/)。

## [未發布]

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
- 將功能規格與開發里程碑分別維護於 `SPEC.md` 和 `PLAN.md`。
- 產品版本統一使用三段數字，並提供單一指令同步 Frontend、Backend 與鎖檔版本。
- Release 檔名加入作業系統與 CPU 架構資訊。

### 修正

- 修正全螢幕模式下 Explorer 分隔線與內容寬度上限不同步的問題。
- 修正 Details 與 Explorer 側邊欄可拖曳超出合理寬度的問題。
- 改善工作台在不同視窗尺寸下的版面與面板限制。

[未發布]: https://github.com/HowardWhile/ros2-node-map/commits/develop
