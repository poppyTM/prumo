// packages/prumo-coder/src/theme/syntax.ts
// Syntax style engine for rich text markdown and code highlights
import { SyntaxStyle, type CliRenderer } from "@opentui/core";
import type { ThemePalette } from "./palette";

export function createPrumoSyntaxStyle(renderer: CliRenderer, palette: ThemePalette): SyntaxStyle {
  return SyntaxStyle.fromStyles({
    default: { fg: palette.text },
    keyword: { fg: palette.accent, bold: true },
    string: { fg: palette.success },
    number: { fg: palette.warning },
    comment: { fg: palette.muted, italic: true },
    operator: { fg: palette.accent },
    function: { fg: palette.secondary, bold: true },
    type: { fg: palette.warning },

    // Rich text Markdown scopes
    "markup.heading": { fg: palette.accent, bold: true },
    "markup.heading.1": { fg: palette.secondary, bold: true },
    "markup.heading.2": { fg: palette.accent, bold: true },
    "markup.heading.3": { fg: palette.warning, bold: true },
    "markup.link": { fg: palette.accent, underline: true },
    "markup.strong": { bold: true },
    "markup.italic": { italic: true },
    "markup.raw": { fg: palette.warning },
    "markup.raw.inline": { fg: palette.warning },
    "markup.list": { fg: palette.secondary },
    "markup.quote": { fg: palette.muted, italic: true },
  }, renderer.nativeScene);
}
