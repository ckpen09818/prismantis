# 個人分支功能清單（personal）

這份清單列出 `personal` 分支上、上游沒有的功能。合併上游（`main` → `personal`）之後，逐項確認每個功能還在、測試還過；任何一項被上游覆蓋，都要把它補回來，不能用上游版本取代。

合併後第一步：

```bash
scripts/check-personal.sh
claude plugin validate . && claude plugin test .
```

`scripts/check-personal.sh` 檢查下表「辨識字串」是否還在對應檔案裡。它只能證明字串存在，行為仍要靠測試。新增功能時，同時更新這份清單和該腳本。

## 功能一覽

| # | 功能 | 主要檔案 | 辨識字串（檔案 :: 字串） | 測試 |
|---|------|----------|--------------------------|------|
| 1 | `one-dark-pro` 主題與 VS Code One Dark Pro 程式碼上色 | `hooks/presets.ts`、`hooks/render.tsx`、`hooks/theme.ts`、`.claude-plugin/plugin.json` | `hooks/presets.ts :: one-dark-pro` | `tests/render.test.tsx`、`tests/contrast.test.tsx` |
| 2 | `promptSide` 選項：提示氣泡靠左滿版；時間移到 `⬤ You` 右邊（藍色粗體）；Claude 回覆用主題 accent 色；You 標頭上方留一行 | `hooks/render.tsx`、`hooks/theme.ts`、`hooks/help.ts`、`.claude-plugin/plugin.json` | `hooks/theme.ts :: promptSide`、`.claude-plugin/plugin.json :: promptSide` | `tests/features.test.tsx` |
| 3 | setup pane：新增 `promptSide` 步驟、Back / Skip 按鈕、左側頁面清單（點哪頁切哪頁，選了存檔但留在原頁） | `hooks/help.ts`、`hooks/register.tsx` | `hooks/help.ts :: promptSide`、`hooks/register.tsx :: SETUP_PAGE` | `tests/features.test.tsx` |
| 4 | 回覆標頭：`workspace-{name}` 目錄下，`⬤ Claude` 換成 `{Name}` | `hooks/render.tsx`、`hooks/register.tsx` | `hooks/render.tsx :: agentName` | `tests/features.test.tsx` |
| 5 | 頭像：有 `avatars/avatar.png` 時畫在名字旁並拿掉 `⬤`；`userAvatar` 設定換掉你提示標頭的 `⬤` | `hooks/render.tsx`、`hooks/register.tsx`、`hooks/theme.ts`、`.claude-plugin/plugin.json` | `hooks/register.tsx :: avatars/avatar.png`、`hooks/theme.ts :: userAvatar` | 無專屬測試，合併後用 `/prismantis demo` 目視 |
| 6 | 效能 A：`UserMessage`／`AssistantMessage` 共用一次 session root 查詢（`locateOnce`，在 `tool.call`、`prompt.submit`、`session.start` 時作廢）；工具列仍每次呼叫 `locate` | `hooks/register.tsx` | `hooks/register.tsx :: locateOnce` | `tests/features.test.tsx` |
| 7 | 效能 B：渲染提示只在第 1 輪與每第 10 輪送（`HINT_EVERY`）；窄窗格寬度提示仍每輪送 | `hooks/register.tsx` | `hooks/register.tsx :: HINT_EVERY` | `tests/features.test.tsx` |
| 8 | 效能 C：程式碼區塊在渲染點合併相鄰同色 token（`mergedRuns`）；`segmentRows` 不動，diff 逐字比對不受影響 | `hooks/render.tsx` | `hooks/render.tsx :: mergedRuns` | `tests/render.test.tsx` |
| 9 | 貼圖預覽：拖進輸入框的圖片在送出前顯示縮圖，可放大、可移除；支援本機 macOS 剪貼簿與拖曳剪貼簿 | `hooks/paste.tsx`、`hooks/register.tsx`、`bin/imgview.py`、`types/index.d.ts` | `hooks/paste.tsx :: IMAGE_TAG`、`bin/imgview.py` | `tests/paste.test.tsx`、`tests/clipboard.test.tsx` |
| 10 | `copyButtonStyle: hover`：點 `⧉` 標記本身就執行該區塊第一個複製動作（含整則回覆右下角的 `⧉`） | `hooks/render.tsx`、`hooks/register.tsx` | `hooks/render.tsx :: rememberPress`、`hooks/render.tsx :: markPress`、`hooks/register.tsx :: rememberPress` | `tests/render.test.tsx`（「copyButtonStyle hover copies a block on a press of its ⧉ marker」） |

不是功能但必須保持的差異：`.github/workflows/` 已刪除（`main` 與 `personal` 都沒有 CI）。

## 合併時的衝突熱點

| 檔案 | 為什麼容易衝突 |
|------|----------------|
| `hooks/render.tsx` | 功能 1、2、4、5、8、10 都在這裡；上游常改標頭、hover 複製標記、程式碼上色 |
| `hooks/register.tsx` | 功能 3、4、5、6、7、9、10；上游常動 `copy()`、setup pane、提示組裝 |
| `hooks/help.ts` | setup 步驟清單；上游新增步驟時，頁數與測試要一起改 |
| `hooks/theme.ts`、`.claude-plugin/plugin.json` | 新選項要保留（`promptSide`、`userAvatar`、`one-dark-pro`） |
| `tests/features.test.tsx`、`tests/render.test.tsx` | setup 頁數、按鈕數、hover 標記的結構斷言 |

## 各功能的合併注意事項

- **功能 10（點 `⧉`）**：複製按鈕的 `onPress` 閉包不在元素 props 上，所以靠 `copy()` 建立按鈕時用 `rememberPress` 登記、標記用 `markPress` 取回。若上游改了 `copy()` 的簽章或 `floating()` 的標記結構，要同步調整；若 `markPress` 取不到處理函式，標記會退回純文字（不會報錯），要靠上面那則測試才抓得到。
- **功能 3（setup）**：上游新增 setup 步驟時，測試裡的頁數與按鈕數必須等於 `hooks/help.ts` 的 `setupSteps`（0.39.1 為 14 頁：上游 13 + `promptSide`）。
- **功能 6**：`locateOnce` 只用在 `UserMessage`／`AssistantMessage`；工具列刻意保留 `locate`，因為上游測試要求工具列路徑跟隨 worktree 移動。
- **新增的 token**：上游新增主題 token 時，`hooks/presets.ts` 的 `one-dark-pro` 要補齊，並通過 WCAG AA（4.5:1）。
- 凡是接收 `$` 的函式，要宣告在 `hooks/register.tsx` 最上層，不能巢狀在 `register` 裡。

## 不在這個 repo 的功能

`image-inline`（送出後把對話裡的 `[Image #N]` 換成縮圖，右上角 `⤢` 開預覽面板）目前是獨立的 mod，放在 Claude Code session 的開發資料夾，不是 prismantis 的一部分。要併進來的話，在這份清單新增一列。
