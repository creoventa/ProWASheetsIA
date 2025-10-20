import Groq from 'groq-sdk'
import googleSheetService from './sheets.js'
import chatHistoryService from './chat-history.js'

/**
 * @class GroqService
 * Esta clase maneja toda la comunicación con la API de Groq.
 * Su responsabilidad es tomar un mensaje del usuario, obtener la configuración
 * desde Google Sheets y generar una respuesta inteligente.
 */
class GroqService {
    constructor() {
        this.groq = new Groq({
            apiKey: process.env.GROQ_API_KEY,
        })
        this.settings = null
    }

    /**
     * Carga la configuración de la IA (prompts y parámetros) desde Google Sheets.
     * Esta función se llama solo una vez y luego los datos se guardan en la caché.
     */
    async loadSettings() {
        const settings = await googleSheetService.getPrompts()
        
        for (const key in settings) {
            if (!isNaN(settings[key])) {
                settings[key] = Number(settings[key])
            }
        }
        this.settings = settings
    }

    /**
     * Genera una respuesta de la IA.
     * @param {string} userInput - El último mensaje que el usuario ha enviado.
     * @param {string} phoneNumber - Número de teléfono del contacto para obtener el historial.
     * @returns {Promise<string>} La respuesta de texto generada por el modelo de IA.
     */
    async getResponse(userInput, phoneNumber = null) {
        if (!this.settings) {
            await this.loadSettings()
        }

        try {
            const messages = [
                {
                    role: 'system',
                    content: this.settings.system_prompt || 'Eres un asistente útil.',
                }
            ]

            if (phoneNumber) {
                const contextMessages = await chatHistoryService.getContextForAI(phoneNumber)
                messages.push(...contextMessages)
                console.log(`🧠 Contexto cargado para ${phoneNumber}: ${contextMessages.length} mensajes`)
            }

            messages.push({
                role: 'user',
                content: userInput,
            })

            const chatCompletion = await this.groq.chat.completions.create({
                messages,
                model: 'llama-3.1-8b-instant',
                temperature: this.settings.temperature || 0.5,
                max_tokens: this.settings.max_tokens || 200,
                top_p: this.settings.top_p || 1,
                stop: this.settings.stop || null,
                stream: false,
            })

            const aiResponse = chatCompletion.choices[0]?.message?.content || 'No he podido generar una respuesta.'
            
            if (phoneNumber) {
                await chatHistoryService.saveMessage(phoneNumber, 'user', userInput)
                await chatHistoryService.saveMessage(phoneNumber, 'assistant', aiResponse)
            }
            
            return aiResponse
        } catch (error) {
            console.error('❌ Error al contactar con la API de Groq:', error)
            return 'Lo siento, estoy teniendo problemas para conectar con mi cerebro de IA en este momento.'
        }
    }
}

const groqService = new GroqService()
export default groqService