// Verifies that every statically referenced translation key exists in the German locale.
// Dynamic keys (template literals) are checked by their longest static prefix.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { de } from '../src/i18n/locales/de.ts'

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : []
  })

const lookup = (key) => {
  let node = de
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in node) node = node[part]
    else if (node && typeof node === 'object' && `${part}_one` in node) return true
    else return false
  }
  return true
}

const missing = []
const pattern = /\bt\(\s*(['"`])((?:(?!\1).)*)\1/g
for (const file of walk('src')) {
  const source = readFileSync(file, 'utf8')
  for (const [, quote, key] of source.matchAll(pattern)) {
    if (quote === '`' && key.includes('${')) {
      const prefix = key.slice(0, key.indexOf('${')).replace(/\.$/, '')
      if (prefix && !lookup(prefix)) missing.push(`${file}: ${key} (prefix ${prefix})`)
    } else if (!lookup(key)) {
      missing.push(`${file}: ${key}`)
    }
  }
}

if (missing.length) {
  console.error(`Missing translation keys:\n${missing.join('\n')}`)
  process.exit(1)
}
console.log('All translation keys present.')
