import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { Smartphone, Users, Globe, Brain, Shield, Star } from 'lucide-react'
import React, { useState } from 'react'

const AboutSection = () => {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="py-20 bg-gradient-to-br from-[#003c3d] via-[#006d6f] to-[#00b7b3] text-white">
      {/* Search CTA Section */}
      <section className="py-20 bg-gradient-to-br from-[#003c3d] via-[#006d6f] to-[#00b7b3] text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">{t('search.title')}</h2>
          <p className="text-xl text-gray-200 mb-8 max-w-2xl mx-auto">
            {t('search.description')}
          </p>
          <Button
            size="lg"
            onClick={() => setShowForm(true)}
            className="bg-[#00c4b4] hover:bg-[#00e0cc] text-white px-8 py-3 text-lg font-semibold rounded-full shadow-lg shadow-black/30 transition-all duration-300"
          >
            {t('search.cta_button')}
          </Button>
        </div>
      </section>

      {/* Feature Icons Section */}
      <section className="py-24 bg-gradient-to-br from-[#004f50] via-[#006d6f] to-[#00a5a1]">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12 text-white">{t('about.mobile_app')}</h3>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10 text-center">
            {[
              { icon: Smartphone, label: t('about.feature_mobile'), desc: t('about.feature_mobile_desc') },
              { icon: Globe, label: t('about.feature_global'), desc: t('about.feature_global_desc') },
              { icon: Brain, label: t('about.feature_ai'), desc: t('about.feature_ai_desc') },
              { icon: Shield, label: t('about.feature_secure'), desc: t('about.feature_secure_desc') },
              { icon: Users, label: t('about.feature_community'), desc: t('about.feature_community_desc') },
              { icon: Star, label: t('about.feature_reviews'), desc: t('about.feature_reviews_desc') },
            ].map(({ icon: Icon, label, desc }, idx) => (
              <Card
                key={idx}
                className="bg-white/10 backdrop-blur-lg border border-white/20 hover:bg-white/20 transition-all duration-300 rounded-2xl shadow-md p-5 text-white flex flex-col items-center"
              >
                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-[#00b7b3] to-[#009b9f] rounded-full shadow-md mb-3 shrink-0">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <CardContent className="p-0 text-center">
                  <h4 className="text-lg font-semibold mb-1">{label}</h4>
                  <p className="text-sm text-gray-300 leading-snug">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gradient-to-r from-[#00a5a1] to-[#00c4b4] text-white">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">{t('about.why_choose')}</h3>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold mb-2">10K+</div>
              <div className="text-xl text-white/80">{t('about.satisfied_travelers')}</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">150+</div>
              <div className="text-xl text-white/80">{t('about.available_destinations')}</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">4.9★</div>
              <div className="text-xl text-white/80">{t('about.average_rating')}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default AboutSection
