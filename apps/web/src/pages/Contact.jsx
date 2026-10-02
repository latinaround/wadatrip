import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildContactEmail, SUPPORT_EMAIL } from '../services/contactEmail'

const Contact = () => {
  const { t } = useTranslation()
  const [formData, setFormData] = useState({ name: '', email: '', company: '', subject: '', message: '' })
  const [draftReady, setDraftReady] = useState(false)
  const draftUrl = buildContactEmail(formData.subject, formData)
  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setDraftReady(false)
  }
  return (
    <div className="page-shell flex flex-col">
      <main className="flex-grow page-container">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold neon-title mb-6">{t('contact.title')}</h1>
          <p className="text-lg text-[#e0e0e0] mb-8">{t('contact.description')}</p>
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="page-card md:col-span-1">
              <h3 className="text-xl font-semibold text-white mb-6">{t('contact.info_title')}</h3>
              <p className="text-sm text-[#a0a0a0] mb-2">{t('contact.email')}</p>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#00D9FF] break-all">{SUPPORT_EMAIL}</a>
            </div>
            <div className="page-card md:col-span-2">
              <h3 className="text-xl font-semibold text-white mb-6">{t('contact.form_title')}</h3>
              <p className="text-sm text-[#cad3df] mb-6">{t('email_draft.instructions')}</p>
              <form onSubmit={event => { event.preventDefault(); setDraftReady(true) }} className="space-y-6">
                {Object.entries(formData).map(([field, value]) => (
                  <div key={field}>
                    <label htmlFor={field} className="block text-sm font-medium text-[#e0e0e0] mb-1">{t(`contact.${field}_label`)}</label>
                    {field === 'message' ? (
                      <textarea id={field} name={field} value={value} onChange={handleChange} rows={5} required className="w-full px-3 py-2 border border-[#00D9FF]/30 rounded-md" />
                    ) : (
                      <input id={field} name={field} type={field === 'email' ? 'email' : 'text'} value={value} onChange={handleChange} required={field !== 'company'} className="w-full px-3 py-2 border border-[#00D9FF]/30 rounded-md" />
                    )}
                  </div>
                ))}
                <button type="submit" className="neon-cta font-black px-6 py-3 rounded-xl">{t('email_draft.prepare')}</button>
                {draftReady && (
                  <div role="status" className="space-y-3 rounded-md border border-[#00D9FF]/30 p-4 text-[#cad3df]">
                    <p>{t('email_draft.ready')}</p>
                    <a href={draftUrl} className="inline-block text-[#00D9FF] underline">{t('email_draft.open')}</a>
                    <p>{t('email_draft.fallback', { email: SUPPORT_EMAIL })}</p>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
export default Contact
