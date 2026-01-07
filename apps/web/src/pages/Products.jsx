import { useTranslation } from 'react-i18next'

const Products = () => {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            {t('products.title')}
          </h1>
          <p className="text-lg text-gray-700 mb-8">
            {t('products.description')}
          </p>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Mobile App */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-teal-600 h-3"></div>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {t('footer.mobile_app')}
                </h3>
                <p className="text-gray-700 mb-4">
                  {t('products.mobile_app_desc')}
                </p>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start">
                    <svg className="h-3 w-3 text-teal-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('products.mobile_app_feature1')}
                  </li>
                  <li className="flex items-start">
                    <svg className="h-3 w-3 text-teal-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('products.mobile_app_feature2')}
                  </li>
                  <li className="flex items-start">
                    <svg className="h-3 w-3 text-teal-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('products.mobile_app_feature3')}
                  </li>
                </ul>
              </div>
            </div>

            {/* API */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-teal-600 h-3"></div>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {t('footer.api')}
                </h3>
                <p className="text-gray-700 mb-4">
                  {t('products.api_desc')}
                </p>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start">
                    <svg className="h-3 w-3 text-teal-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('products.api_feature1')}
                  </li>
                  <li className="flex items-start">
                    <svg className="h-3 w-3 text-teal-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('products.api_feature2')}
                  </li>
                  <li className="flex items-start">
                    <svg className="h-3 w-3 text-teal-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('products.api_feature3')}
                  </li>
                </ul>
              </div>
            </div>

            {/* Integrations */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-teal-600 h-3"></div>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {t('footer.integrations')}
                </h3>
                <p className="text-gray-700 mb-4">
                  {t('products.integrations_desc')}
                </p>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start">
                    <svg className="h-3 w-3 text-teal-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('products.integrations_feature1')}
                  </li>
                  <li className="flex items-start">
                    <svg className="h-3 w-3 text-teal-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('products.integrations_feature2')}
                  </li>
                  <li className="flex items-start">
                    <svg className="h-3 w-3 text-teal-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('products.integrations_feature3')}
                  </li>
                </ul>
              </div>
            </div>

            {/* Wadaflight */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-teal-600 h-3"></div>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {t('flight_predictor.title')}
                </h3>
                <p className="text-gray-700 mb-4">
                  {t('flight_predictor.description')}
                </p>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start">
                    <svg className="h-3 w-3 text-teal-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('products.wadaflight_feature1')}
                  </li>
                  <li className="flex items-start">
                    <svg className="h-3 w-3 text-teal-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('products.wadaflight_feature2')}
                  </li>
                  <li className="flex items-start">
                    <svg className="h-3 w-3 text-teal-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('products.wadaflight_feature3')}
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-teal-50 rounded-lg p-8 text-center">
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">
              {t('products.cta_title')}
            </h3>
            <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
              {t('products.cta_description')}
            </p>
            <button className="bg-teal-600 text-white px-6 py-3 rounded-md font-medium hover:bg-teal-700 transition-colors">
              {t('nav.request_demo')}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Products