import { Link } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// No support WhatsApp number is configured. Route to the actual contact page.
const WhatsAppButton = () => {
  const { t } = useTranslation()
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Link to="/contact" aria-label="Contact support" title={t('contact.title')} className="inline-flex bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg">
        <MessageCircle className="w-6 h-6" />
      </Link>
    </div>
  )
}
export default WhatsAppButton
