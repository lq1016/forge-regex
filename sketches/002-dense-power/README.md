## Variant: Dense Power

### Design stance
regex101 启发的高密度工具界面。深色主题、左右分栏，一切操作在同一屏内完成。

### Key choices
- **Layout**: 左右分栏（1:1），左侧输入+结果，右侧测试区
- **Typography**: 更小的字体尺寸（11-13px），更多 monospace 文字
- **Color**: 深色背景（#0f0f11），teal 作为强调色，terminal 风格
- **Interaction**: 展开/折叠 explanation、标签页切换、匹配列表表格

### Trade-offs
- **Strong at**: 重度用户效率高——输入、看结果、测试都在一个屏幕
- **Weak at**: 对新用户有一定认知负担，深色主题对部分用户不够"专业"
- **维护成本**: 分栏布局在移动端需要额外处理

### Best for
- 付费用户的"工作台"视图（登录后的默认界面）
- 开发者/工程师用户群——他们习惯终端和 IDE 风格
- 作为 Pro 订阅的卖点："升级到 Pro 使用专业工作台"
