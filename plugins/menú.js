export default {
  name: 'menú',
  description: 'Muestra el menú de comandos',
  async call(m, { conn }) {
    const menu = `
*Menú de comandos:*
- menú: Muestra este menú
- hola: Saluda
- info: Información del bot
    `
    await conn.sendMessage(m.chat, { text: menu }, { quoted: m }).catch(console.error)
  }
}
