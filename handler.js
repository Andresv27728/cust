import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import fs from 'fs'
import path from 'path'

const pluginsDir = path.join(process.cwd(), 'plugins')
const plugins = new Map()

for (const file of fs.readdirSync(pluginsDir)) {
  if (file.endsWith('.js')) {
    const pluginModule = await import(path.join(pluginsDir, file))
    const plugin = pluginModule.default || pluginModule
    if (!plugin?.name) {
      console.warn(`Plugin ${file} no tiene propiedad 'name', se omitirá.`)
      continue
    }
    plugins.set(plugin.name.toLowerCase(), plugin)
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info')

  const sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
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
      // Obtener texto y comando
      const text = msg.message.conversation?.toLowerCase()?.trim()
      if (!text) continue
      const plugin = plugins.get(text)
      if (plugin) {
        try {
          // Aquí pasamos sock como conn y msg para que el plugin maneje el mensaje
          await plugin.call(sock, msg, [])
        } catch (err) {
          console.error('Error en plugin', plugin.name, err)
        }
      }
    }
  })
}

startBot().catch(console.error)
