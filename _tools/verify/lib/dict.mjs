import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './common.mjs';

export function loadDict(lang) {
  const sandbox = { window: { I18N: {} } };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, `js/i18n/${lang}.js`), 'utf8'), sandbox);
  return sandbox.window.I18N[lang];
}
export const loadBoth = () => ({ en: loadDict('en'), pt: loadDict('pt'), es: loadDict('es') });
