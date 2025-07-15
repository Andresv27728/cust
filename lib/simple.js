// Función simple para parsear mensaje básico
export function smsg(conn, m) {
  if (!m) return m
  if (!m.message) return m
  // Ejemplo de obtener texto: conversación o caption para media
  m.text = m.message.conversation ||
           m.message.extendedTextMessage?.text ||
           m.message.imageMessage?.caption ||
           m.message.videoMessage?.caption ||
           ''
  m.sender = m.key?.fromMe ? conn.user.id : m.key?.remoteJid
  m.isGroup = m.key?.remoteJid?.endsWith('@g.us')
  m.chat = m.key?.remoteJid
  m.name = (conn.chats[m.chat]?.name) || m.pushName || ''
  return m
}
