import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const Contact = () => {
  const { t } = useTranslation()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    subject: '',
    message: ''
  })
  const [formStatus, setFormStatus] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // Simulate form submission
    setFormStatus('loading')
    
    setTimeout(() => {
      setFormStatus('success')
      setFormData({
        name: '',
        email: '',
        company: '',
        subject: '',
        message: ''
      })
    }, 1500)
  }

  return (
    <div className="page-shell flex flex-col">
      <main className="flex-grow page-container">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            {t('contact.title')}
          </h1>
          <p className="text-lg text-gray-700 mb-8">
            {t('contact.description')}
          </p>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {/* Contact Information */}
            <div className="md:col-span-1">
              <div className="page-card overflow-hidden">
                <div className="bg-teal-600 h-3"></div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6">
                    {t('contact.info_title')}
                  </h3>
                  
                  {/* Email */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-500 mb-1">{t('contact.email')}</h4>
                    <p className="text-gray-900">info@wadatrip.com</p>
                  </div>
                  
                  {/* Phone */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-500 mb-1">{t('contact.phone')}</h4>
                    <p className="text-gray-900">+1 (555) 123-4567</p>
                  </div>
                  
                  {/* Address */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-500 mb-1">{t('contact.address')}</h4>
                    <p className="text-gray-900">
                      123 Travel Street<br />
                      Suite 456<br />
                      San Francisco, CA 94103<br />
                      USA
                    </p>
                  </div>
                  
                  {/* Social Media */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-3">{t('contact.social')}</h4>
                    <div className="flex space-x-4">
                      <a href="#" className="text-gray-400 hover:text-teal-600 transition-colors">
                        <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z" />
                        </svg>
                      </a>
                      <a href="#" className="text-gray-400 hover:text-teal-600 transition-colors">
                        <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723 10.054 10.054 0 01-3.127 1.184 4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                        </svg>
                      </a>
                      <a href="#" className="text-gray-400 hover:text-teal-600 transition-colors">
                        <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm4.441 16.892c-2.102.144-6.784.144-8.883 0C5.282 16.736 5.017 15.622 5 12c.017-3.629.285-4.736 2.558-4.892 2.099-.144 6.782-.144 8.883 0C18.718 7.264 18.982 8.378 19 12c-.018 3.629-.285 4.736-2.559 4.892zM10 9.658l4.917 2.338L10 14.342V9.658z" />
                        </svg>
                      </a>
                      <a href="#" className="text-gray-400 hover:text-teal-600 transition-colors">
                        <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-2 16h4v-2h-4v2zm0-3h4v-2h-4v2zm0-3h4V8h-4v2zm-1-4h6V4H9v2z" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="md:col-span-2">
              <div className="page-card overflow-hidden">
                <div className="bg-teal-600 h-3"></div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6">
                    {t('contact.form_title')}
                  </h3>
                  
                  <form onSubmit={handleSubmit}>
                    <div className="grid md:grid-cols-2 gap-6 mb-6">
                      {/* Name */}
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                          {t('contact.name_label')}
                        </label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          required
                        />
                      </div>
                      
                      {/* Email */}
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                          {t('contact.email_label')}
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6 mb-6">
                      {/* Company */}
                      <div>
                        <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                          {t('contact.company_label')}
                        </label>
                        <input
                          type="text"
                          id="company"
                          name="company"
                          value={formData.company}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                      </div>
                      
                      {/* Subject */}
                      <div>
                        <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                          {t('contact.subject_label')}
                        </label>
                        <input
                          type="text"
                          id="subject"
                          name="subject"
                          value={formData.subject}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          required
                        />
                      </div>
                    </div>
                    
                    {/* Message */}
                    <div className="mb-6">
                      <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('contact.message_label')}
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        rows="5"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        required
                      ></textarea>
                    </div>
                    
                    {/* Submit Button */}
                    <div className="text-right">
                      <button
                        type="submit"
                        disabled={formStatus === 'loading'}
                        className="bg-teal-600 text-white px-6 py-3 rounded-md font-medium hover:bg-teal-700 transition-colors disabled:opacity-70"
                      >
                        {formStatus === 'loading' ? t('contact.sending') : t('contact.send_button')}
                      </button>
                    </div>
                    
                    {/* Success Message */}
                    {formStatus === 'success' && (
                      <div className="mt-4 p-3 bg-green-50 text-green-800 rounded-md">
                        {t('contact.success_message')}
                      </div>
                    )}
                  </form>
                </div>
              </div>
            </div>
          </div>

          {/* Map Section */}
          <div className="page-card overflow-hidden mb-12">
            <div className="bg-teal-600 h-3"></div>
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">
                {t('contact.location_title')}
              </h3>
              <div className="h-96 bg-gray-200 rounded-md flex items-center justify-center">
                <p className="text-gray-500">{t('contact.map_placeholder')}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Contact

