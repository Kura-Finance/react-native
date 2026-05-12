# i18n 国际化集成指南

本应用已集成 i18next 进行全面的国际化支持。当前支持英文 (en) 和中文 (zh)。

## 🏗️ 架构文件

```
src/shared/locales/
├── i18n.ts                 # i18next 配置和初始化
├── index.ts                # 翻译资源导出
├── en/
│   └── common.json         # 英文翻译
└── zh/
    └── common.json         # 中文翻译
src/shared/hooks/
└── useAppTranslation.ts    # 自定义 hook，结合 Zustand 状态管理
```

## 🚀 快速开始

### 1. 在任何组件中使用翻译

```typescript
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';

export default function MyComponent() {
  const { t, language, changeLanguage } = useAppTranslation();

  return (
    <View>
      <Text>{t('common.appName')}</Text>
      <Text>当前语言：{language}</Text>
      <Button title="切换中文" onPress={() => changeLanguage('zh')} />
    </View>
  );
}
```

### 2. 翻译 key 的命名规范

翻译文件采用分组结构，使用点号分隔：

```
{
  "common": {
    "appName": "Kura"
  },
  "settings": {
    "language": "Language"
  }
}
```

使用时：`t('common.appName')` 或 `t('settings.language')`

## 🔧 添加新的翻译

### 步骤 1：在翻译文件中添加新的 key

编辑 `src/shared/locales/en/common.json`：
```json
{
  "myNewSection": {
    "myNewKey": "My new text"
  }
}
```

编辑 `src/shared/locales/zh/common.json`：
```json
{
  "myNewSection": {
    "myNewKey": "我的新文本"
  }
}
```

### 步骤 2：在组件中使用

```typescript
import { useAppTranslation } from '../shared/hooks/useAppTranslation';

const { t } = useAppTranslation();

<Text>{t('myNewSection.myNewKey')}</Text>
```

## 🌍 添加新语言（例如：日文）

### 步骤 1：创建新的翻译文件

创建目录 `src/shared/locales/ja/`

创建文件 `src/shared/locales/ja/common.json`：
```json
{
  "common": {
    "appName": "Kura"
  }
  // ... 其他翻译
}
```

### 步骤 2：更新翻译资源

编辑 `src/shared/locales/index.ts`：
```typescript
import jaCommon from './ja/common.json';

export const resources = {
  en: { common: enCommon },
  zh: { common: zhCommon },
  ja: { common: jaCommon },  // 新增
};
```

### 步骤 3：更新 Language 类型

编辑 `src/shared/store/useAppStore.ts`：
```typescript
export type Language = 'en' | 'zh' | 'ja';  // 新增 'ja'
```

## 🔄 语言切换原理

### 双向同步

`useAppTranslation` hook 确保了双向同步：

1. **Zustand 更新 → i18next**：用户在设置中选择语言时，`setLanguage()` 更新 Zustand store，hook 自动调用 `i18n.changeLanguage()`
2. **i18next 更新 → UI 重新渲染**：i18next 更新时触发 React 重新渲染，使用新语言的翻译

```typescript
useEffect(() => {
  if (i18n.language !== language) {
    i18n.changeLanguage(language);  // 保持同步
  }
}, [language, i18n]);
```

## 📝 翻译文件结构

当前翻译组织方式：

| 分组 | 用途 | 示例 |
|------|------|------|
| `common` | 通用按钮和文字 | 关闭、保存、取消等 |
| `auth` | 认证相关 | 登录、注册、密码等 |
| `dashboard` | 仪表板 | 净资产、总收入等 |
| `accounts` | 账户管理 | 账户、余额等 |
| `investments` | 投资相关 | 投资组合、持仓等 |
| `settings` | 设置 | 偏好、语言、通知等 |
| `currency` | 货币名称 | 美元、欧元等 |
| `errors` | 错误消息 | 网络错误、服务器错误等 |

## ⚙️ 集成点

### App.tsx 中的初始化

```typescript
import './src/shared/locales/i18n';
import i18n from './src/shared/locales/i18n';
import { I18nextProvider } from 'react-i18next';

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      {/* 应用内容 */}
    </I18nextProvider>
  );
}
```

### 状态管理整合

语言偏好持久化存储在 Zustand store 中：

```typescript
export interface UserPreferences {
  language: Language;
  baseCurrency: BaseCurrency;
  // ...
}
```

## 🎯 最佳实践

1. **使用一致的 key 命名**：避免在同一分组中有重复的 key

2. **保持翻译同步**：在 en/common.json 中添加 key 时，也要在 zh/common.json 中添加对应翻译

3. **避免硬编码文本**：所有用户面向的文本都应该使用翻译系统

4. **使用翻译 key 的 TypeScript 提示**：
```typescript
// ❌ 不好 - 字符串容易出错
t('some.invalid.key')

// ✅ 好 - 对应翻译文件中的实际 key
t('settings.language')
```

5. **处理缺失的翻译**：如果某个 key 缺失，i18next 默认会返回 key 本身，便于识别缺失翻译

## 🐛 调试

如果翻译不工作：

1. **检查 key 是否存在**：查看 `en/common.json` 和 `zh/common.json` 中的 key

2. **检查语言是否正确设置**：`const { language } = useAppTranslation()` 查看当前语言

3. **检查 i18n 初始化**：在 App.tsx 中确保 `I18nextProvider` 包裹了应用

4. **查看浏览器控制台**：i18next 会在缺失翻译时输出警告

## 📚 更多资源

- [i18next 文档](https://www.i18next.com/)
- [react-i18next 文档](https://react.i18next.com/)
- [本项目翻译文件](./en/common.json)
