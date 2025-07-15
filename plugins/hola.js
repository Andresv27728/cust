export default {
    name: 'hola',
    description: 'Saluda al usuario',
    async call(m, { conn }) {
        await conn.sendMessage(m.chat, { text: '¡Hola! ¿En qué puedo ayudarte?' })
    }
}
