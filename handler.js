import { smsg } from './lib/simple.js'

export async function handler(chatUpdate) {
  if (!chatUpdate.messages?.length) return
  let m = chatUpdate.messages[chatUpdate.messages.length - 1]
  if (!m || !m.message) return

  m = smsg(this, m)
  if (!m.text) return

  const text = m.text.toLowerCase().trim()

  const plugin = [...global.plugins.values()].find(p => p.name.toLowerCase() === text)
  if (!plugin) return

  try {
    await plugin.call(this, m)
  } catch (e) {
    console.error('Error en plugin:', e)
  }
}
