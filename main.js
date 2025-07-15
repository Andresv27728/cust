import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import fs from 'fs'
import path from 'path'

const pluginsDir = path.join(process.cwd(), 'plugins')
const plugins = new Map()

// Carga dinámica de plugins
for (const file of fs.readdirSync(pluginsDir)) {
  if (file.endsWith('.js')) {
    const plugin = await import(path.join(pluginsDir, file))
    plugins.set(plugin.default.name.toLowerCase(), plugin.default)
  }
}

async function startBot() {
  console.log('Iniciando conexión con WhatsApp...')

  const { state, saveCreds } = await useMultiFileAuthState('./auth_info')

  const sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut
      console.log('Conexión cerrada, reconnect:', shouldReconnect)
      if (shouldReconnect) startBot()
    } else if (connection === 'open') {
      console.log('Conectado a WhatsApp correctamente')
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue
      // Enviar a handler para manejar mensaje y comandos
      await global.handler({ messages: [msg] }).catch(console.error)
    }
  })

  // Exponer el socket en global para uso en handler/plugins
  global.conn = sock
}

startBot()
  .catch(console.error)
