# @deepseek-ai/dsh-skill-minimal

[English](README.md) | 中文

极简 skill 斜杠命令处理。Web UI 的 skill 选择器保持现有交互；当用户提交 `/name` 形式的 skill 手势时，插件只把该 skill 的文件地址追加进提示词，而不加载 skill 正文。不注册任何面向模型的 tool。

## Model Experience

### skill 地址提示

#### What the model sees

每个有效的 `/name` 手势注入一条用户消息，例如：

##### Example injected address

```markdown
Skill "my-skill" is available at: /absolute/path/to/my-skill/SKILL.md
```

#### Token effect

每个被调用的 skill 一行短文本，仅在该 step 出现。

#### KV Cache effect

仅追加：注入地址取决于用户手势与解析出的 skill 路径，不会破坏此前请求前缀。

## Known Limitations and Deferred Work

- **只给地址**——模型需要用自己的现有工具去读取 skill 文件。
- **未知或用户禁用的 skill 保持普通文本**——插件不会拦截那些不是有效 user-invocable skill 的 `/name`。
