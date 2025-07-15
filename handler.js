import { smsg } from './lib/simple.js'
import path, { join } from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk'
import { watchFile, unwatchFile } from 'fs'
import { jidDecode } from '@whiskeysockets/baileys/lib/WABinary.js'

const isNumber = x => typeof x === 'number' && !isNaN(x)
const delay = ms => isNumber(ms) && new Promise(resolve => setTimeout(resolve, ms))

// Función segura para descodificar JID
function safeDecodeJid(jid) {
  if (!jid || typeof jid !== 'string') {
    console.warn('jid inválido para decodeJid:', jid)
    return null
  }
  try {
    return jidDecode(jid)
  } catch (e) {
    console.warn('Error al decodificar jid:', jid, e)
    return null
  }
}

export async function handler(chatUpdate) {
  this.msgqueque = this.msgqueque || []
  if (!chatUpdate?.messages?.length) return

  let m = chatUpdate.messages[chatUpdate.messages.length - 1]
  if (!m || !m.message) return

  if (global.db.data == null) await global.loadDatabase()
  try {
    m = smsg(this, m) || m
    if (!m) return

    m.text = typeof m.text === 'string' ? m.text : ''
    m.exp = 0
    m.limit = false

    // --- Inicialización usuario/chat similar a tu código ---
    if (!m.sender) return

    let user = global.db.data.users[m.sender]
    if (typeof user !== 'object') global.db.data.users[m.sender] = {}
    user = global.db.data.users[m.sender]

    if (!isNumber(user.exp)) user.exp = 0
    if (!isNumber(user.limit)) user.limit = 10
    if (!('premium' in user)) user.premium = false
    if (!user.premium) user.premiumTime = 0
    if (!('registered' in user)) user.registered = false
    if (!user.registered) {
      if (!('name' in user)) user.name = m.name || 'Desconocido'
      if (!isNumber(user.age)) user.age = -1
      if (!isNumber(user.regTime)) user.regTime = -1
    }
    if (!isNumber(user.afk)) user.afk = -1
    if (!('afkReason' in user)) user.afkReason = ''
    if (!('banned' in user)) user.banned = false
    if (!('useDocument' in user)) user.useDocument = false
    if (!isNumber(user.level)) user.level = 0
    if (!isNumber(user.bank)) user.bank = 0

    let chat = global.db.data.chats[m.chat]
    if (typeof chat !== 'object') global.db.data.chats[m.chat] = {}
    chat = global.db.data.chats[m.chat]

    if (!('isBanned' in chat)) chat.isBanned = false
    if (!('bienvenida' in chat)) chat.bienvenida = true
    if (!('antiLink' in chat)) chat.antiLink = false
    if (!('onlyLatinos' in chat)) chat.onlyLatinos = false
    if (!('nsfw' in chat)) chat.nsfw = false
    if (!isNumber(chat.expired)) chat.expired = 0

    let settings = global.db.data.settings[this.user.jid]
    if (typeof settings !== 'object') global.db.data.settings[this.user.jid] = {}
    settings = global.db.data.settings[this.user.jid]

    if (!('self' in settings)) settings.self = false
    if (!('autoread' in settings)) settings.autoread = false
    // --- fin inicialización ---

    if (opts?.nyimak) return
    if (!m.fromMe && opts?.self) return
    if (opts?.swonly && m.chat !== 'status@broadcast') return

    let _user = global.db.data?.users?.[m.sender]

    // Permisos seguros con decodeJid validado
    const decodedBotId = safeDecodeJid(global.conn.user.id)
    const ownerNumbers = global.owner.map(([number]) => number?.replace(/[^0-9]/g, ''))
    const isROwner = [
      ...(decodedBotId?.user ? [decodedBotId.user] : []),
      ...ownerNumbers
    ].map(v => v + '@s.whatsapp.net').includes(m.sender)

    const isOwner = isROwner || m.fromMe
    const isMods = isOwner || global.mods
      .map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net')
      .includes(m.sender)
    const isPrems = isROwner || global.prems
      .map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net')
      .includes(m.sender) || _user?.premium === true

    if (opts?.queque && m.text && !(isMods || isPrems)) {
      let queque = this.msgqueque, time = 1000 * 5
      const previousID = queque[queque.length - 1]
      queque.push(m.id || m.key.id)
      setInterval(async function () {
        if (queque.indexOf(previousID) === -1) clearInterval(this)
        await delay(time)
      }, time)
    }

    if (m.isBaileys) return
    m.exp += Math.ceil(Math.random() * 10)

    // Carga info grupo y permisos
    const groupMetadata = (m.isGroup ? ((this.chats[m.chat] || {}).metadata || await this.groupMetadata(m.chat).catch(() => null)) : {}) || {}
    const participants = (m.isGroup ? groupMetadata.participants : []) || []
    const userGroup = (m.isGroup ? participants.find(u => this.decodeJid(u.id) === m.sender) : {}) || {}
    const botGroup = (m.isGroup ? participants.find(u => this.decodeJid(u.id) === this.user.jid) : {}) || {}
    const isRAdmin = userGroup?.admin === 'superadmin'
    const isAdmin = isRAdmin || userGroup?.admin === 'admin'
    const isBotAdmin = botGroup?.admin === true

    const ___dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), './plugins')

    // Comandos sin prefijo (texto exacto)
    let text = m.text.toLowerCase().trim()
    let plugin = null
    let command = null
    let args = []

    for (let name in global.plugins) {
      let p = global.plugins[name]
      if (!p) continue
      if (p.disabled) continue

      if (p.name && p.name.toLowerCase() === text) {
        plugin = p
        command = p.name.toLowerCase()
        args = []
        break
      }
    }

    if (!plugin) return

    // Validaciones permisos y estados (igual que antes)
    // Usa plugin.rowner, plugin.owner, etc. para controlar acceso
    if (m.chat in global.db.data.chats || m.sender in global.db.data.users) {
      let chat = global.db.data.chats[m.chat]
      let user = global.db.data.users[m.sender]
      let setting = global.db.data.settings[this.user.jid]
      if (plugin.name !== 'group-unbanchat.js' && chat?.isBanned) return
      if (plugin.name !== 'owner-unbanuser.js' && user?.banned) return
      if (plugin.name !== 'owner-unbanbot.js' && setting?.banned) return
    }
    if (plugin.rowner && plugin.owner && !(isROwner || isOwner)) { global.dfail('owner', m, this); return }
    if (plugin.rowner && !isROwner) { global.dfail('rowner', m, this); return }
    if (plugin.owner && !isOwner) { global.dfail('owner', m, this); return }
    if (plugin.mods && !isMods) { global.dfail('mods', m, this); return }
    if (plugin.premium && !isPrems) { global.dfail('premium', m, this); return }
    if (plugin.group && !m.isGroup) { global.dfail('group', m, this); return }
    if (plugin.botAdmin && !isBotAdmin) { global.dfail('botAdmin', m, this); return }
    if (plugin.admin && !isAdmin) { global.dfail('admin', m, this); return }
    if (plugin.private && m.isGroup) { global.dfail('private', m, this); return }
    if (plugin.register === true && _user.registered === false) { global.dfail('unreg', m, this); return }

    m.isCommand = true
    let xp = 'exp' in plugin ? parseInt(plugin.exp) : 17
    if (xp > 200) m.reply('chirrido -_-')
    else m.exp += xp

    if (!isPrems && plugin.limit && global.db.data.users[m.sender].limit < plugin.limit * 1) {
      this.reply(m.chat, `Se agotaron tus *Chocos*`, m)
      return
    }

    let extra = {
      command,
      args,
      conn: this,
      participants,
      groupMetadata,
      user: userGroup,
      bot: botGroup,
      isROwner,
      isOwner,
      isRAdmin,
      isAdmin,
      isBotAdmin,
      isPrems,
      chatUpdate,
      __dirname: ___dirname
    }

    try {
      await plugin.call(this, m, extra)
      if (!isPrems) m.limit = m.limit || plugin.limit || false
    } catch (e) {
      m.error = e
      console.error("Error ejecutando plugin:", e)
      m.reply(String(e))
    }

  } catch (e) {
    console.error("Error general en handler:", e)
  } finally {
    // Limpieza y estadísticas - igual que el tuyo
    if (opts?.queque && m.text) {
      const quequeIndex = this.msgqueque.indexOf(m.id || m.key.id)
      if (quequeIndex !== -1) this.msgqueque.splice(quequeIndex, 1)
    }
    let user, stats = global.db.data.stats
    if (m && m.sender) {
      user = global.db.data.users[m.sender]
      if (user) {
        user.exp += m.exp
        user.limit -= m.limit * 1
      }
    }
    if (m && m.plugin) {
      let now = +new Date()
      let stat = stats[m.plugin] || { total: 0, success: 0, last: 0, lastSuccess: 0 }
      stat.total = (stat.total || 0) + 1
      stat.last = now
      if (!m.error) {
        stat.success = (stat.success || 0) + 1
        stat.lastSuccess = now
      }
      stats[m.plugin] = stat
    }
    try {
      if (!opts?.noprint) {
        const print = await import(`./lib/print.js`)
        await print.default(m, this)
      }
    } catch (e) {
      console.error("Error en print:", e)
    }
    const settingsREAD = global.db.data.settings[this.user.jid] || {}
    if (opts?.autoread) await this.readMessages([m.key])
    if (settingsREAD.autoread) await this.readMessages([m.key])
  }
}

global.dfail = (type, m, conn) => {
  const mensajes = {
    rowner: '🔐 Solo el *Creador* de la Bot puede usar este comando.',
    owner: '👑 Solo el *Creador* y *Sub Bots* pueden usar este comando.',
    mods: '🛡️ Solo los *Moderadores* pueden usar este comando.',
    premium: '💎 Solo usuarios *Premium* pueden usar este comando.',
    group: '👥 Este comando es solo para *Grupos*.',
    private: '🔒 Solo en Chat *Privado* puedes usar este comando.',
    admin: '⚔️ Solo los *Admins* del Grupo pueden usar este comando.',
    botAdmin: '🤖 La Bot debe ser *Admin* para ejecutar esto.',
    unreg: '📝 Debes estar *Registrado* para usar este comando.',
    restrict: '⛔ Esta función está *deshabilitada*.'
  }
  const msg = mensajes[type]
  if (msg) return conn.reply(m.chat, msg, m).then(() => m.react('❌'))
}

const file = fileURLToPath(import.meta.url)
watchFile(file, async () => {
  unwatchFile(file)
  console.log(chalk.magenta("Se actualizo 'handler.js'"))
  if (global.reloadHandler) console.log(await global.reloadHandler())
})

    unwatchFile(file)
    console.log(chalk.magenta("Se actualizo 'handler.js'"))
    if (global.reloadHandler) console.log(await global.reloadHandler())
})
