import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const RequestDemo = () => {
  const { t } = useTranslation()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    position: '',
    phone: '',
    employees: '',
    interests: [],
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


  const handleCheckboxChange = (e) => {
    const { value, checked } = e.target
    if (checked) {
      setFormData(prev => ({
        ...prev,
        interests: [...prev.interests, value]
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        interests: prev.interests.filter(interest => interest !== value)
      }))
    }
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
        position: '',
        phone: '',
        employees: '',
        interests: [],
        message: ''
      })
    }, 1500)
  }

  return (
    <div className="page-shell flex flex-col">
      <main className="flex-grow page-container">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold neon-title mb-6">
            {t('demo.title')}
          </h1>
          <p className="text-lg text-[#e0e0e0] mb-8">
            {t('demo.description')}
          </p>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {/* Demo Form */}
            <div className="md:col-span-2">
              <div className="page-card p-0 overflow-hidden">
                <div className="bg-[#00D9FF] h-3"></div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-white mb-6">
                    {t('demo.form_title')}
                  </h3>
                  
                  <form onSubmit={handleSubmit}>
                    <div className="grid md:grid-cols-2 gap-6 mb-6">
                      {/* Name */}
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-[#e0e0e0] mb-1">
                          {t('demo.name_label')}
                        </label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-[#00D9FF]/30 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/50 focus:border-[#00D9FF]"
                          required
                        />
                      </div>
                      
                      {/* Email */}
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-[#e0e0e0] mb-1">
                          {t('demo.email_label')}
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-[#00D9FF]/30 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/50 focus:border-[#00D9FF]"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6 mb-6">
                      {/* Company */}
                      <div>
                        <label htmlFor="company" className="block text-sm font-medium text-[#e0e0e0] mb-1">
                          {t('demo.company_label')}
                        </label>
                        <input
                          type="text"
                          id="company"
                          name="company"
                          value={formData.company}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-[#00D9FF]/30 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/50 focus:border-[#00D9FF]"
                          required
                        />
                      </div>
                      
                      {/* Position */}
                      <div>
                        <label htmlFor="position" className="block text-sm font-medium text-[#e0e0e0] mb-1">
                          {t('demo.position_label')}
                        </label>
                        <input
                          type="text"
                          id="position"
                          name="position"
                          value={formData.position}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-[#00D9FF]/30 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/50 focus:border-[#00D9FF]"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6 mb-6">
                      {/* Phone */}
                      <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-[#e0e0e0] mb-1">
                          {t('demo.phone_label')}
                        </label>
                        <input
                          type="tel"
                          id="phone"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-[#00D9FF]/30 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/50 focus:border-[#00D9FF]"
                          required
                        />
                      </div>
                      
                      {/* Company Size */}
                      <div>
                        <label htmlFor="employees" className="block text-sm font-medium text-[#e0e0e0] mb-1">
                          {t('demo.employees_label')}
                        </label>
                        <select
                          id="employees"
                          name="employees"
                          value={formData.employees}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-[#00D9FF]/30 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/50 focus:border-[#00D9FF]"
                          required
                        >
                          <option value="">{t('demo.employees_placeholder')}</option>
                          <option value="1-10">1-10</option>
                          <option value="11-50">11-50</option>
                          <option value="51-200">51-200</option>
                          <option value="201-500">201-500</option>
                          <option value="501+">501+</option>
                        </select>
                      </div>
                    </div>
                    
                    {/* Interests */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-[#e0e0e0] mb-2">
                        {t('demo.interests_label')}
                      </label>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="flex items-start">
                          <input
                            type="checkbox"
                            id="interest-mobile"
                            name="interests"
                            value="mobile"
                            checked={formData.interests.includes('mobile')}
                            onChange={handleCheckboxChange}
                            className="mt-1 mr-2"
                          />
                          <label htmlFor="interest-mobile" className="text-[#e0e0e0]">
                            {t('demo.interest_mobile')}
                          </label>
                        </div>
                        <div className="flex items-start">
                          <input
                            type="checkbox"
                            id="interest-api"
                            name="interests"
                            value="api"
                            checked={formData.interests.includes('api')}
                            onChange={handleCheckboxChange}
                            className="mt-1 mr-2"
                          />
                          <label htmlFor="interest-api" className="text-[#e0e0e0]">
                            {t('demo.interest_api')}
                          </label>
                        </div>
                        <div className="flex items-start">
                          <input
                            type="checkbox"
                            id="interest-integrations"
                            name="interests"
                            value="integrations"
                            checked={formData.interests.includes('integrations')}
                            onChange={handleCheckboxChange}
                            className="mt-1 mr-2"
                          />
                          <label htmlFor="interest-integrations" className="text-[#e0e0e0]">
                            {t('demo.interest_integrations')}
                          </label>
                        </div>
                        <div className="flex items-start">
                          <input
                            type="checkbox"
                            id="interest-enterprise"
                            name="interests"
                            value="enterprise"
                            checked={formData.interests.includes('enterprise')}
                            onChange={handleCheckboxChange}
                            className="mt-1 mr-2"
                          />
                          <label htmlFor="interest-enterprise" className="text-[#e0e0e0]">
                            {t('demo.interest_enterprise')}
                          </label>
                        </div>
                        <div className="flex items-start">
                          <input
                            type="checkbox"
                            id="interest-flight"
                            name="interests"
                            value="flight"
                            checked={formData.interests.includes('flight')}
                            onChange={handleCheckboxChange}
                            className="mt-1 mr-2"
                          />
                          <label htmlFor="interest-flight" className="text-[#e0e0e0]">
                            {t('flight_predictor.title')}
                          </label>
                        </div>
                      </div>
                    </div>
                    
                    {/* Message */}
                    <div className="mb-6">
                      <label htmlFor="message" className="block text-sm font-medium text-[#e0e0e0] mb-1">
                        {t('demo.message_label')}
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        rows="4"
                        className="w-full px-3 py-2 border border-[#00D9FF]/30 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/50 focus:border-[#00D9FF]"
                      ></textarea>
                    </div>
                    
                    {/* Submit Button */}
                    <div className="text-right">
                      <button
                        type="submit"
                        disabled={formStatus === 'loading'}
                        className="neon-cta font-black px-6 py-3 rounded-xl transition-all duration-300 hover:scale-105 disabled:opacity-70"
                      >
                        {formStatus === 'loading' ? t('demo.submitting') : t('demo.submit_button')}
                      </button>
                    </div>
                    
                    {/* Success Message */}
                    {formStatus === 'success' && (
                      <div className="mt-4 p-3 bg-green-50 text-green-800 rounded-md">
                        {t('demo.success_message')}
                      </div>
                    )}
                  </form>
                </div>
              </div>
            </div>

            {/* Demo Information */}
            <div className="md:col-span-1">
              <div className="page-card p-0 overflow-hidden">
                <div className="bg-[#00D9FF] h-3"></div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-white mb-6">
                    {t('demo.info_title')}
                  </h3>
                  
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-base font-medium text-white mb-2">
                        {t('demo.what_included')}
                      </h4>
                      <ul className="space-y-2 text-[#e0e0e0]">
                        <li className="flex items-start">
                          <svg className="h-3 w-3 text-teal-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {t('demo.included_1')}
                        </li>
                        <li className="flex items-start">
                          <svg className="h-3 w-3 text-teal-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {t('demo.included_2')}
                        </li>
                        <li className="flex items-start">
                          <svg className="h-3 w-3 text-teal-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {t('demo.included_3')}
                        </li>
                        <li className="flex items-start">
                          <svg className="h-3 w-3 text-teal-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {t('demo.included_4')}
                        </li>
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="text-base font-medium text-white mb-2">
                        {t('demo.testimonial_title')}
                      </h4>
                      <div className="bg-[#0a0e27] p-4 rounded-md">
                        <p className="text-[#e0e0e0] italic mb-3">"{t('demo.testimonial_quote')}"</p>
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-[#2d3548] mr-3"></div>
                          <div>
                            <p className="text-sm font-medium text-white">{t('demo.testimonial_name')}</p>
                            <p className="text-xs text-[#a0a0a0]">{t('demo.testimonial_position')}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-base font-medium text-white mb-2">
                        {t('demo.questions_title')}
                      </h4>
                      <p className="text-[#e0e0e0] mb-2">{t('demo.questions_text')}</p>
                      <a href="#" className="text-[#00D9FF] hover:text-[#00D9FF] font-medium">
                        {t('demo.questions_link')} →
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default RequestDemo




