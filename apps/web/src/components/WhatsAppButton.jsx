import { useTranslation } from 'react-i18next'
import { MessageCircle } from 'lucide-react'

const WhatsAppButton = () => {
  const { t } = useTranslation()

  const handleWhatsAppClick = () => {
    const message = encodeURIComponent(t('whatsapp.message'))
    const phoneNumber = "1234567890" // Replace with actual WhatsApp number
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`
    window.open(whatsappUrl, '_blank')
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={handleWhatsAppClick}
        className="bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group"
        title={t('whatsapp.tooltip')}
      >
        <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
      </button>
      
      {/* Tooltip */}
      <div className="absolute bottom-16 right-0 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        {t('whatsapp.tooltip')}
        <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  )
}

export default WhatsAppButton

