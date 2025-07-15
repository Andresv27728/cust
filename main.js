import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import fs from 'fs'
import path from 'path'
import { handler } from './handler.js'

const plugins = new Map()
const pluginsDir = path.join(process.cwd(), 'plugins')

for (const file of fs.readdirSync(pluginsDir)) {
  if (file.endsWith('.js')) {
    const mod = await import(path.join(pluginsDir, file))
    const plugin = mod.default || mod
    if (!plugin.name) {
      console.warn(`Plugin ${file} omitido: falta propiedad 'name'`)
      continue
    }
    plugins.set(plugin.name.toLowerCase(), plugin)
  }
}

// Exponer global plugins y handler
global.plugins = plugins
global.handler = handler

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info')

  const sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    syncFullHistory: false
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode || 0
      const reason = lastDisconnect?.error?.output?.payload?.reason || ''
      console.log(`Conexión cerrada, código: ${code}, razón: ${reason}`)
      if (code !== DisconnectReason.loggedOut) startBot()
    } else if (connection === 'open') {
      console.log('Conectado correctamente a WhatsApp')
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const m of messages) {
      if (!m.message || m.key.fromMe) continue
      try {
        await handler.call(sock, { messages: [m] })
      } catch (e) {
        console.error('Error en handler:', e)
      }
    }
  })
}

startBot().catch(console.error)
