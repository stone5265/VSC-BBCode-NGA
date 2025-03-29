BBCode (NGA)
=============

支持 [NGA](https://bbs.nga.cn/) BBCode 语法 的 VSCode 插件。自动识别后缀为 `.nga` 和 `.bbsnga` 的文件。

覆盖 NGA 常用 BBCode 的**语法高亮**、**代码片段**。

该插件为 Sublime 插件 SublimeBBCodeNGA 的 VSCode 移植版，详细功能更新日志请查看 [SublimeBBCodeNGA](https://github.com/stone5265/SublimeBBCodeNGA)

## 特性

- **语法高亮**
  - BBCode 代码块高亮提示
  - 包裹光标的代码块高亮提示
  - 未闭合的代码块警告提示

- **代码片段**
  - BBCode 代码块 ( 对应 tag 并双写其首字母，比如 **bb** 对应 `[b][/b]` )

  - 专楼模板 ( 前缀为 `template` )
    - `template_character`: 角色模块
    - `template_video`: 视频模块
    - `template_episode_preview`: 先行情报模块
    - `template_overall`: 先行情报模块

- **快捷键**
  - **ctrl+b**: 在选中区域两侧 添加/去除 `[b][/b]`
  - **ctrl+i**: 在选中区域两侧 添加/去除 `[i][/i]`
  - **ctrl+u**: 在选中区域两侧 添加/去除 `[u][/u]`
  - **ctrl+q**: 在选中区域两侧 添加/去除 `[quote][/quote]`

- **右键菜单**
  - BBCode转纯文本: 使选中区域内 BBCode 失去效果，显示为纯文本
  - 精简URL: 将选中区域中的url代码块中的NGA域名精简掉，比如将`[url=https://bbs.nga.cn/read.php?tid=XXX]`精简成`[url=/read.php?tid=XXX]`
