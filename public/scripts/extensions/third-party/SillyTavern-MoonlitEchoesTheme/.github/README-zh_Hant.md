# Moonlit Echoes Theme

[English](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/)｜**繁體中文**

![](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/visual_novel_mode.png)

**「Moonlit Echoes 月下回聲」** 是一款供 SillyTavern 使用的介面主題。依據我的個人喜好進行調整和修改，旨在讓其更加現代、優雅、簡潔，並盡可能提供桌面與行動端更舒服的使用體驗。

Moonlit Echoes 最初於 2024 年 11 月 25 日在 SillyTavern Disocord 伺服器公開並更新至今，期間得到許多人的回饋和支持。最終，為了可維護性並方便使用者更新、在其他地方找到它（以及滿足我對更美觀主題的執著），我將其製作為 SillyTavern 擴充功能並於 GitHub 開源。

| UI Interface | System Messages |
|----------------------|-------------------|
| <img src="https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/ui_overview.png"> | <img src="https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/system_messages.png"> |

## 功能與特色

### 核心功能
- **多種訊息樣式**：除了 SillyTavern 預設的「平面 (Flat)」、「氣泡 (Bubble)」和「文件 (Document)」訊息風格外，還設計了額外的聊天訊息樣式，如「回聲 (Echo)」、「低語 (Whisper)」、「寂靜 (Hush)」、「漣漪 (Ripple)」和「潮汐 (Tide)」——為不同的聊天場景設計，並提供額外的客製化選項。
- **跨平台友好**：致力於改善桌面端和在行動裝置上的使用體驗，如具有更寬的輸入欄位和自適應佈局——非常適合注重細節或想喜歡跨設備使用的使用者。

### Moonlit Echoes 主題預設設定檔
使用者現在可以輕鬆分享基於 Moonlit Echoes Theme 的配色與主題，並與 SillyTavern 內建 UI 主題無縫切換。

<img src="https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/moonlit_theme_presets.png" width="500">

## 螢幕截圖
以下截圖來自 **2.5.0** 版本，在使用 Chrome 的 MacBook 上截取，展示了 2.5.0 中新增的 **「微光 (Glimmer)」** 主題。

![](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/1chatstyle_flat.png)
![](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/2chatstyle_bubble.png)
![](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/3chatstyle_document.png)
![](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/4chatstyle_echo.png)
![](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/5chatstyle_whisper.png)
![](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/6chatstyle_hush.png)
![](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/7chatstyle_ripple.png)
![](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/8chatstyle_tide.png)

## 安裝說明

### 前提條件
建議使用 **最新版** 的 SillyTavern（無論是 Release 或 Staging 版本）與 Chrome 瀏覽器。

### 安裝步驟

#### 1. 安裝 Moonlit Echoes Theme
在 **SillyTavern 擴充管理器**中，點選「安裝擴充功能（Install from URL）」，貼入以下 Git URL：
```
https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme
```

#### 2. 更新 `/SillyTavern/config.yaml` 的縮圖設定
雖然先前建議直接禁用縮圖功能，但這可能會影響行動裝置的圖片載入速度。以下是目前推薦並經過測試的設定：
```
 thumbnails:
    enabled: true
    format: png
    quality: 100
    dimensions:
      bg:
        - 240
        - 135
      avatar:
        - 864
        - 1280
```
建議在應用設定前刪除整個縮圖資料夾（通常位於 `/SillyTavern/data/default-user/thumbnails`）。別擔心——SillyTavern 會在重新啟動後自動產生新的縮圖。

#### 3. 下載並啟用主題（強烈建議！）
安裝後即可使用月下回聲主題擴充。不過，若想完全重現預覽圖中的畫面，建議下載 **「Glimmer（微光）」** 主題設定檔並匯入 SillyTavern 使用者設定中。
特別推薦 2.5.0 版本中新增的 **「微光（Glimmer）」** 主題。這個主題是專為本次發布設計的——極簡、通用，非常適合在晚上用手機躲在被窩裡使用。

你可以在 GitHub 主題（theme）文件夾中找到它，或直接透過連結下載：
- [Glimmer - by Rivelle.json](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/theme/Glimmer%20-%20by%20Rivelle.json) → 用於 SillyTavern 使用者設定（User Settings）
- [[Moonlit] Glimmer - by Rivelle.json](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/theme/%5BMoonlit%5D%20Glimmer%20-%20by%20Rivelle.json) → 用於月下回聲主題預設（Moonlit Echoes Theme Presets）

無需進行任何調整或修改檔名——匯入後即可使用！

### 給 Termux 使用者 📱
若你透過 Termux 使用 SillyTavern，以下是修改 `config.yaml` 的方法。

> [!Warning]
> 我對 Android 設備或 Termux 沒有經驗，因此無法解答相關問題、測試步驟或保證結果。以下方法由其他使用者提供。

> [!NOTE]
> SillyTavern 資料夾內可能會有兩個 `config.yaml` 檔案。請務必編輯 ST 根目錄 下的 `/SillyTavern/config.yaml`。**請勿修改** `/SillyTavern/default/config.yaml` 或 default 資料夾內的任何內容。

### 方法 1：透過 Termux 編輯
1. 打開 Termux，輸入：`cd SillyTavern`
2. 接著輸入並執行：`nano config.yaml` 以編輯檔案
### 方法 2：使用 Material Files（Android 檔案管理器）
1. 開啟 Material Files > 新增儲存空間 > 前往 Termux > SillyTavern
2. 打開 SillyTavern 資料夾，直接編輯 `config.yaml`

# 使用指南

## 如何使用月下回聲主題預設？
月下回聲主題預設與 SillyTavern 的 UI 主題部分同步。若有對應名稱，切換其中一個會自動同步設定。不過，兩者本質上是獨立存在的。月下回聲主題不會創建或修改任何 SillyTavern UI 主題。

### 匯入與匯出
- Moonlit Echoes 主題預設設定檔的檔案名稱格式為 `[Moonlit] 預設名稱.json`（如：`[Moonlit] Honey Cream.json`）。`[Moonlit]` 之後有一個半形空格
- 這不會影響功能，你 **「不需要」** 在匯入前移除 `[Moonlit] `前綴，只需直接匯入文件即可
- 若匯入的預設未與 SillyTavern 的 UI 主題同步，請重新載入頁面或選擇其他主題來套用變更

## 常見問題

### Ｑ：介面損壞、跑版或與不兼容其他擴充？
**Ａ：** 是的，儘管我盡了最大努力，但我無法保證與每個第三方 SillyTavern 擴充完全兼容。如果你遇到任何問題，請依序嘗試以下排除方式：

1. 確保你使用的是最新版本的 SillyTavern 和最新版本的 Chrome。
2. 暫時禁用此主題擴充，檢查是否是它造成的問題。如果是——或者你使用的第三方擴充尚未得到支持——隨時歡迎回報！

月下回聲是第三方主題擴充，與官方 SillyTavern 項目無關。它是源於對 SillyTavern 的熱愛和對視覺設計的強烈偏好的個人項目。如果你遇到任何問題，請先聯繫我——我會盡力提供協助！

### Ｑ：在預覽圖片中使用了哪些其他擴充？
**Ａ：** 以下是我強烈推薦並確認與月下回聲完全兼容的擴充：
- **[SillyTavern / Extension-TopInfoBar](https://github.com/SillyTavern/Extension-TopInfoBar)**：官方擴充。支援快速切換聊天、搜尋訊息關鍵字、顯示目前的連線設定⋯我的最愛——強烈推薦！
- **[SillyTavern / Extension-QuickPersona](https://github.com/SillyTavern/Extension-QuickPersona)**：官方擴充。從聊天輸入區域輕鬆切換角色，帶有時尚的視覺提示。
- **[SillyTavern / Extension-TypingIndicator](https://github.com/SillyTavern/Extension-TypingIndicator)**：官方擴充。在角色回應時顯示可愛的 `{{char}} 正在輸入...` 指示器。
- **[zerofata / SillyTavern-Dialogue-Colorizer-Plus](https://github.com/zerofata/SillyTavern-Dialogue-Colorizer-Plus)**：原始 [SillyTavern-Dialogue-Colorizer](https://github.com/XanadusWorks/SillyTavern-Dialogue-Colorizer) 的分支，改進了自定義角色對話顏色的變數支持。
- **[qvink / SillyTavern-MessageSummarize](https://github.com/qvink/SillyTavern-MessageSummarize)**：進階版的聊天摘要功能，可為 LLM 模擬長期和短期記憶——非常強大且有用！
- **[LenAnderson / SillyTavern-MoreFlexibleContinues](https://github.com/LenAnderson/SillyTavern-MoreFlexibleContinues/)**：為繼續生成文本添加更多靈活性，並可快速進行切換。
- **[splitclover / rewrite-extension](https://github.com/splitclover/rewrite-extension)**：允許快速部分重寫和刪除訊息內容。

### Ｑ：使用月下回聲切換主題時出現延遲和卡頓？
**Ａ：** 是的，這是行動裝置上的已知問題，而我暫時束手無策。切換時，畫面可能會短暫凍結數秒，請耐心等待載入完成。此問題在桌面端幾乎不會出現。

# 回饋與建議
若有任何問題或功能建議，請在 Issues 頁面提交回饋，並使用提供的模板填寫詳細資訊。
歡迎在 Discussions 區分享配色方案！無論是 SillyTavern UI 主題還是 Moonlit Echoes 主題預設，我都很期待看到美麗的配色。

# 特別感謝
由衷感謝所有人一路上的幫助與喜愛。

- 感謝 ceruleandeep 在 SillyTavern Discord 群組的初期支援——這一切都是從你開始的。
- 特別感謝 IceFog72 鼓勵我製作 SillyTavern 主題，並開發了 [SillyTavern-CustomThemeStyleInputs](https://github.com/IceFog72/SillyTavern-CustomThemeStyleInputs)，這讓我在初期省去了許多麻煩。
- 感謝 Bronya-Rand 的開源貢獻，讓我從你的 SillyTavern 擴充 中學到了許多，並參考了功能排版設計。
- 感謝 vesper，我從你的自定義主題中得到了設計 Ripple 訊息風格的靈感。

最後，特別、特別感謝 Wolfsblvt 和 Cohee，為 SillyTavern 增加了 讓第三方擴充能夠使用 SillyTavern i18n（國際化系統） 的功能。這極大地改善了非英語使用者的體驗，真的非常感謝！

# 授權協議
AGPLv3
