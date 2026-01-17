import React from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

const PrivacyPolicy = () => {
  const { t } = useTranslation()

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="page-card p-0 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link 
            to="/" 
            className="inline-flex items-center text-teal-600 hover:text-teal-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back_home')}
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('privacy.title')}
          </h1>
          <p className="text-gray-600 mt-2">
            {t('privacy.last_updated')}: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="page-card">
          {/* Introduction */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              {t('privacy.introduction_title')}
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              {t('privacy.introduction_p1')}
            </p>
            <p className="text-gray-700 leading-relaxed">
              {t('privacy.introduction_p2')}
            </p>
          </section>

          {/* Information We Collect */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              {t('privacy.info_collect_title')}
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {t('privacy.personal_info_title')}
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  {t('privacy.personal_info_desc')}
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {t('privacy.usage_info_title')}
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  {t('privacy.usage_info_desc')}
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {t('privacy.device_info_title')}
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  {t('privacy.device_info_desc')}
                </p>
              </div>
            </div>
          </section>

          {/* How We Use Information */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              {t('privacy.how_use_title')}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>{t('privacy.use_1')}</li>
              <li>{t('privacy.use_2')}</li>
              <li>{t('privacy.use_3')}</li>
              <li>{t('privacy.use_4')}</li>
              <li>{t('privacy.use_5')}</li>
            </ul>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              {t('privacy.contact_title')}
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              {t('privacy.contact_desc')}
            </p>
            <div className="bg-teal-50 p-4 rounded-lg">
              <p className="text-teal-800">
                <strong>Email:</strong> privacy@wadatrip.com<br />
                <strong>{t('privacy.address')}:</strong> WadaTrip Inc., 123 Travel Street, Suite 456, City, Country
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicy
