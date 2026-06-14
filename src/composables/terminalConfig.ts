import { useStorage } from '@vueuse/core'

export interface TerminalConfig {
  // 配色テーマ名。アプリのライト/ダーク外観に応じて該当スロットを使う。
  lightThemeName: string
  darkThemeName: string
  // 空文字なら既定の等幅フォントスタックにフォールバック。
  fontFamily: string
  fontSize: number
}

// xterm に渡す既定の等幅フォントスタック。等幅であれば無衬線を優先する。
export const DEFAULT_TERMINAL_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", monospace'

export const DEFAULT_TERMINAL_FONT_SIZE = 13
export const DEFAULT_LIGHT_THEME_NAME = 'Alabaster'
export const DEFAULT_DARK_THEME_NAME = 'Afterglow'

// 設定モーダルのフォントサイズ候補。
export const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32]

// よく使われる等幅フォント。ライブのターミナルが末尾に汎用 monospace を補うので、
// 未インストールの選択肢は安全にフォールバックされる。
export const FONT_FAMILIES = [
  'Menlo',
  'Monaco',
  'SF Mono',
  'Consolas',
  'Cascadia Code',
  'Fira Code',
  'JetBrains Mono',
  'Source Code Pro',
  'IBM Plex Mono',
  'Roboto Mono',
  'Ubuntu Mono',
  'Courier New',
]

const DEFAULT_TERMINAL_CONFIG: TerminalConfig = {
  lightThemeName: DEFAULT_LIGHT_THEME_NAME,
  darkThemeName: DEFAULT_DARK_THEME_NAME,
  fontFamily: '',
  fontSize: DEFAULT_TERMINAL_FONT_SIZE,
}

// ローカルに永続化されるターミナル設定。ref を直接参照することで、設定変更が
// ライブのターミナルへ即座に反映される（再生成不要 = SSH セッションを切らない）。
export const terminalConfig = useStorage<TerminalConfig>('config/terminal', {
  ...DEFAULT_TERMINAL_CONFIG,
})

export const terminalFontFamily = (config: TerminalConfig): string => {
  const family = config.fontFamily.trim()
  if (!family) return DEFAULT_TERMINAL_FONT
  const quoted = /\s/.test(family) ? `"${family}"` : family
  return `${quoted}, ${DEFAULT_TERMINAL_FONT}`
}

export const terminalFontSize = (config: TerminalConfig): number =>
  config.fontSize > 0 ? config.fontSize : DEFAULT_TERMINAL_FONT_SIZE
